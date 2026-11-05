import { forbidden, reply, unauthorized, type MockReply, type MockRequest, type MockRouter } from '../mock-router';
import { iso, nuevoId, uuid } from '../mock-store';
import type {
  BulkImportBatch,
  BulkImportCatalog,
  BulkImportDeclaration,
  BulkImportEngineStatus,
  BulkImportFieldIssue,
  BulkImportReport,
  BulkImportReportRow,
  BulkImportRowIssue,
  BulkImportRowOutcome,
} from '../../data-access/admin-portal/bulk-imports.types';
import {
  TIPOS_SIMULADOS,
  tipoSimulado,
  type ColumnaSimulada,
  type TipoSimulado,
} from './bulk-imports.kinds';

/* ============================================================================
    Backend simulado de las cargas masivas (`/admin/bulk-imports`).

    **DATOS SINTÉTICOS (SIMULADO).** Reproduce el contrato y, sobre todo, la
    honestidad del motor de la API tal como está hoy:

    - `engine` declara que nada está conectado: los lotes viven en memoria (no
      sobreviven a un reinicio), no hay escritor de usuarios ni clínico y no hay
      resolutor de pacientes ni de códigos. Por eso, por omisión:
        · una fila de usuario válida termina `RECHAZADA / EXECUTOR_NOT_CONNECTED`;
        · una fila clínica que pasa el esquema queda `RECHAZADA /
          RESOLUTION_UNAVAILABLE` ya en la vista previa (no se puede resolver al
          paciente), así que el lote entero es `RECHAZADO`.
      Ninguna cuenta ni registro se crea. Pasar otro `engine` a
      {@link registrarCargasMasivas} simula los colaboradores conectados para
      ejercitar el camino con filas `CREADA`.
    - Validación en dos capas (esquema; después referencial en clínica), sin
      repetir nunca el valor de una celda en un mensaje.
    - Confirmación idempotente por `Idempotency-Key`; el procesamiento avanza un
      paso por cada `GET /:id` (EN_COLA → PROCESANDO → COMPLETADO), sin
      temporizadores: dos corridas dan lo mismo.
    - Topes: 20 MB y 5.000 filas (413). Declaración obligatoria por familia.

    El permiso fino (`bulk_import.users` / `bulk_import.clinical`) se da por
    concedido: en la API real hay que crear y conceder esas filas de authz.
    ========================================================================== */

/** El estado que declara la API hoy: nada conectado. */
export const ESTADO_DEL_MOTOR_SIMULADO: BulkImportEngineStatus = {
  persistence: {
    durable: false,
    adapter: 'InMemoryBatchRepository',
    note: 'SIMULADO · Los lotes viven en memoria: no sobreviven a un reinicio ni se comparten entre réplicas.',
  },
  executors: {
    users: { connected: false, adapter: 'NotConnectedUserProvisioner' },
    clinical: { connected: false, adapter: 'NotConnectedClinicalWriter' },
  },
  resolvers: {
    patients: { connected: false, adapter: 'NotConnectedPatientResolver' },
    codes: { connected: false, adapter: 'NotConnectedCodeResolver' },
  },
};

export const LIMITES_SIMULADOS = {
  maxBytes: 20 * 1024 * 1024,
  maxRows: 5_000,
  maxPreviewIssues: 200,
  maxIdempotencyKeyLength: 128,
} as const;

const MENSAJES: Readonly<Record<string, string>> = {
  KIND_UNKNOWN: 'El tipo de carga no existe',
  FORMAT_UNSUPPORTED: 'El formato debe ser csv o json',
  FILE_TOO_LARGE: 'El archivo supera el tamaño máximo',
  ROW_LIMIT_EXCEEDED: 'El lote supera la cantidad máxima de filas',
  SOURCE_AMBIGUOUS: 'Envíe un archivo o filas, no ambos ni ninguno',
  DECLARATION_INVALID: 'La declaración del lote es inválida',
  IDEMPOTENCY_KEY_REQUIRED: 'Falta la clave de idempotencia',
  IDEMPOTENCY_KEY_REUSED: 'La clave de idempotencia ya se usó en otro lote',
  BATCH_NOT_AVAILABLE: 'El lote no existe',
  BATCH_NOT_CONFIRMABLE: 'El lote no está en un estado confirmable',
  BATCH_ALREADY_CONFIRMED: 'El lote ya fue confirmado con otra clave',
  REPORT_NOT_READY: 'El lote todavía no terminó',
  FILE_UNREADABLE: 'No se pudo leer el archivo',
  FILE_EMPTY: 'El archivo no trae filas',
  COLUMN_MISSING: 'Falta una columna obligatoria',
  KIND_MISMATCH: 'El tipo del archivo no coincide',
  REQUIRED: 'Falta un dato obligatorio',
  UNKNOWN_FIELD: 'Hay una columna que no figura en la plantilla',
  INVALID_FORMAT: 'Un valor no tiene el formato esperado',
  TOO_LONG: 'Un valor es más largo que el máximo',
  OUT_OF_RANGE: 'Un valor está fuera de rango',
  FIELD_COMBINATION_INVALID: 'La combinación de campos no es válida',
  DUPLICATE_IN_FILE: 'La misma clave ya vino en una fila anterior',
  RESOLUTION_UNAVAILABLE: 'No se pudo consultar la terminología o el padrón de pacientes',
  EXECUTOR_NOT_CONNECTED: 'La escritura de este tipo de carga no está conectada en esta instalación',
};

const ESTADOS_CODIGO: Readonly<Record<number, { code: string; error: string }>> = {
  400: { code: 'VALIDATION_FAILED', error: 'Bad Request' },
  403: { code: 'FORBIDDEN', error: 'Forbidden' },
  404: { code: 'NOT_FOUND', error: 'Not Found' },
  409: { code: 'CONFLICT', error: 'Conflict' },
  413: { code: 'PAYLOAD_TOO_LARGE', error: 'Payload Too Large' },
};

/** Un error de dominio de la API: `code` por tipo HTTP y `reason` en la raíz del cuerpo. */
function fallo(status: number, reason: string, details?: Record<string, unknown>): MockReply {
  const { code, error } = ESTADOS_CODIGO[status] ?? { code: 'INTERNAL', error: 'Error' };
  return reply(status, {
    statusCode: status,
    code,
    message: MENSAJES[reason] ?? reason,
    error,
    reason,
    ...(details === undefined ? {} : { details }),
  });
}

/* ---- Archivo -> filas ----------------------------------------------------- */

type FilaCruda = Readonly<Record<string, string>>;

interface Lectura {
  readonly formato: 'csv' | 'json';
  readonly filas: readonly FilaCruda[];
  readonly problemasDeArchivo: readonly BulkImportFieldIssue[];
}

/** CSV con comillas dobles, BOM y saltos CRLF; las líneas vacías no cuentan. */
function leerCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = '';
  let entreComillas = false;
  const limpio = texto.replace(/^\uFEFF/, '');
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i]!;
    if (entreComillas) {
      if (c === '"' && limpio[i + 1] === '"') {
        celda += '"';
        i++;
      } else if (c === '"') entreComillas = false;
      else celda += c;
    } else if (c === '"') entreComillas = true;
    else if (c === ',') {
      fila.push(celda);
      celda = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpio[i + 1] === '\n') i++;
      fila.push(celda);
      celda = '';
      if (fila.some((v) => v.trim() !== '')) filas.push(fila);
      fila = [];
    } else celda += c;
  }
  fila.push(celda);
  if (fila.some((v) => v.trim() !== '')) filas.push(fila);
  return filas;
}

function problema(field: string, code: string, message: string): BulkImportFieldIssue {
  return { field, code, message };
}

function leerArchivo(tipo: TipoSimulado, nombre: string, texto: string): Lectura {
  const esJson = nombre.toLowerCase().endsWith('.json') || texto.trimStart().startsWith('{') || texto.trimStart().startsWith('[');
  const esperadas = new Set(tipo.columns.map((c) => c.name));

  if (esJson) {
    let json: unknown;
    try {
      json = JSON.parse(texto);
    } catch {
      return { formato: 'json', filas: [], problemasDeArchivo: [problema('*', 'FILE_UNREADABLE', MENSAJES['FILE_UNREADABLE']!)] };
    }
    let lista: unknown = json;
    if (typeof json === 'object' && json !== null && !Array.isArray(json)) {
      const objeto = json as Record<string, unknown>;
      if (typeof objeto['kind'] === 'string' && objeto['kind'] !== tipo.kind) {
        return { formato: 'json', filas: [], problemasDeArchivo: [problema('kind', 'KIND_MISMATCH', MENSAJES['KIND_MISMATCH']!)] };
      }
      lista = objeto['rows'] ?? objeto['example'];
    }
    if (!Array.isArray(lista)) {
      return {
        formato: 'json',
        filas: [],
        problemasDeArchivo: [problema('*', 'FILE_UNREADABLE', 'El JSON debe ser un arreglo de filas o un objeto con `rows`')],
      };
    }
    const filas = lista.map((item) =>
      typeof item === 'object' && item !== null
        ? Object.fromEntries(Object.entries(item as Record<string, unknown>).map(([k, v]) => [k, v == null ? '' : String(v).trim()]))
        : {},
    );
    return { formato: 'json', filas, problemasDeArchivo: columnasFaltantes(tipo, filas[0] ? Object.keys(filas[0]) : [], filas.length) };
  }

  const tabla = leerCsv(texto);
  if (tabla.length < 2) {
    return {
      formato: 'csv',
      filas: [],
      problemasDeArchivo: [problema('*', 'FILE_EMPTY', MENSAJES['FILE_EMPTY']!)],
    };
  }
  const encabezado = tabla[0]!.map((h) => h.trim());
  const filas = tabla.slice(1).map((celdas) => Object.fromEntries(encabezado.map((h, i) => [h, (celdas[i] ?? '').trim()])));
  const desconocidas = encabezado.flatMap((h, i) =>
    esperadas.has(h) ? [] : [problema('*', 'UNKNOWN_FIELD', `La columna ${i + 1} no figura en la plantilla`)],
  );
  return {
    formato: 'csv',
    filas,
    problemasDeArchivo: [...columnasFaltantes(tipo, encabezado, filas.length), ...desconocidas],
  };
}

function columnasFaltantes(tipo: TipoSimulado, presentes: readonly string[], cantidad: number): BulkImportFieldIssue[] {
  if (cantidad === 0) return [problema('*', 'FILE_EMPTY', MENSAJES['FILE_EMPTY']!)];
  return tipo.columns
    .filter((c) => c.required && !presentes.includes(c.name))
    .map((c) => problema(c.name, 'COLUMN_MISSING', `Falta la columna obligatoria «${c.name}»`));
}

/* ---- Validación de filas ---------------------------------------------------- */

const MAX_TEXTO = 500;
const MAX_CADENA = 120;

function esFechaReal(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().startsWith(valor);
}

function problemaDeValor(columna: ColumnaSimulada, valor: string): BulkImportFieldIssue | null {
  const ubicado = (code: string, message: string) => problema(columna.name, code, message);
  if (valor === '') {
    return columna.required ? ubicado('REQUIRED', 'El campo es obligatorio') : null;
  }
  switch (columna.type) {
    case 'string':
      if (valor.length > MAX_CADENA) return ubicado('TOO_LONG', `Admite hasta ${MAX_CADENA} caracteres`);
      if (columna.name === 'nationalId' && !/^[A-Za-z0-9.-]{4,40}$/.test(valor)) {
        return ubicado('INVALID_FORMAT', 'Admite de 4 a 40 letras, dígitos, punto y guion');
      }
      return null;
    case 'text':
      return valor.length > MAX_TEXTO ? ubicado('TOO_LONG', `Admite hasta ${MAX_TEXTO} caracteres`) : null;
    case 'email':
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor) ? null : ubicado('INVALID_FORMAT', 'Debe ser un correo electrónico válido');
    case 'phone':
      return /^\+?[0-9 ()-]{6,20}$/.test(valor) ? null : ubicado('INVALID_FORMAT', 'Debe ser un teléfono de 6 a 20 dígitos');
    case 'decimal':
      return /^-?\d+(\.\d+)?$/.test(valor) ? null : ubicado('INVALID_FORMAT', 'Debe ser un número con punto decimal');
    case 'date':
      if (!esFechaReal(valor)) return ubicado('INVALID_FORMAT', 'Debe ser una fecha real AAAA-MM-DD');
      return columna.name === 'birthDate' && valor > new Date().toISOString().slice(0, 10)
        ? ubicado('OUT_OF_RANGE', 'No puede ser una fecha futura')
        : null;
    case 'datetime':
      return /^\d{4}-\d{2}-\d{2}T/.test(valor) && !Number.isNaN(Date.parse(valor))
        ? null
        : ubicado('INVALID_FORMAT', 'Debe ser fecha y hora ISO 8601');
  }
}

interface ResultadoDeValidacion {
  readonly total: number;
  readonly validas: number[];
  readonly rechazadas: { row: number; reason: string; field: string }[];
  readonly problemas: BulkImportRowIssue[];
  readonly totalDeProblemas: number;
}

function validarFilas(tipo: TipoSimulado, filas: readonly FilaCruda[], motor: BulkImportEngineStatus): ResultadoDeValidacion {
  const vistas = new Set<string>();
  const validas: number[] = [];
  const rechazadas: { row: number; reason: string; field: string }[] = [];
  const problemas: BulkImportRowIssue[] = [];
  let totalDeProblemas = 0;

  filas.forEach((cruda, indice) => {
    const row = indice + 1;
    const hallazgos: BulkImportFieldIssue[] = [];
    for (const columna of tipo.columns) {
      const hallazgo = problemaDeValor(columna, cruda[columna.name] ?? '');
      if (hallazgo) hallazgos.push(hallazgo);
    }
    if (hallazgos.length === 0 && tipo.kind === 'hc-encuentro' && cruda['endAt'] && cruda['endAt'] < (cruda['startAt'] ?? '')) {
      hallazgos.push(problema('endAt', 'FIELD_COMBINATION_INVALID', 'El fin no puede ser anterior al inicio'));
    }
    if (hallazgos.length === 0) {
      const clave = cruda[tipo.uniqueKey] ?? '';
      if (vistas.has(clave)) hallazgos.push(problema(tipo.uniqueKey, 'DUPLICATE_IN_FILE', MENSAJES['DUPLICATE_IN_FILE']!));
      else vistas.add(clave);
    }
    // Segunda capa (clínica): sin resolutor de pacientes conectado no se puede enlazar a nadie.
    if (hallazgos.length === 0 && tipo.group === 'CLINICAL' && !motor.resolvers.patients.connected) {
      hallazgos.push(problema('nationalId', 'RESOLUTION_UNAVAILABLE', MENSAJES['RESOLUTION_UNAVAILABLE']!));
    }
    if (hallazgos.length === 0) {
      validas.push(row);
      return;
    }
    totalDeProblemas += hallazgos.length;
    for (const h of hallazgos) {
      if (problemas.length < LIMITES_SIMULADOS.maxPreviewIssues) problemas.push({ row, ...h });
    }
    rechazadas.push({ row, reason: hallazgos[0]!.code, field: hallazgos[0]!.field });
  });

  return { total: filas.length, validas, rechazadas, problemas, totalDeProblemas };
}

/* ---- Lotes ------------------------------------------------------------------ */

interface Lote {
  vista: BulkImportBatch;
  validas: readonly number[];
  rechazadas: readonly { row: number; reason: string; field: string }[];
  claveDeConfirmacion?: string;
  informe?: BulkImportReport;
}

function filaDeInforme(row: number, outcome: BulkImportRowOutcome, reason?: string, field?: string): BulkImportReportRow {
  return {
    row,
    outcome,
    ...(reason === undefined ? {} : { reason, message: MENSAJES[reason] ?? reason }),
    ...(field === undefined ? {} : { field }),
  };
}

function armarInforme(lote: Lote, motor: BulkImportEngineStatus, generadoEn: string): BulkImportReport {
  const clinico = lote.vista.group === 'CLINICAL';
  const conectado = clinico
    ? motor.executors.clinical.connected && motor.resolvers.patients.connected
    : motor.executors.users.connected;
  const motivoSinEscritor = clinico ? 'RESOLUTION_UNAVAILABLE' : 'EXECUTOR_NOT_CONNECTED';
  const filas: BulkImportReportRow[] = [
    ...lote.rechazadas.map((r) => filaDeInforme(r.row, 'RECHAZADA', r.reason, r.field)),
    ...lote.validas.map((row) =>
      conectado ? filaDeInforme(row, 'CREADA') : filaDeInforme(row, 'RECHAZADA', motivoSinEscritor),
    ),
  ].sort((a, b) => a.row - b.row);
  const cuenta = (outcome: BulkImportRowOutcome) => filas.filter((f) => f.outcome === outcome).length;
  return {
    batchId: lote.vista.id,
    kind: lote.vista.kind,
    status: lote.vista.status,
    generatedAt: generadoEn,
    totals: {
      total: filas.length,
      CREADA: cuenta('CREADA'),
      OMITIDA: 0,
      CONFLICTO: 0,
      RECHAZADA: cuenta('RECHAZADA'),
      FALLIDA: 0,
      NO_PROCESADA: 0,
    },
    fileIssues: lote.vista.fileIssues,
    rows: filas,
  };
}

function crearVista(args: {
  id: string;
  tipo: TipoSimulado;
  declaracion: BulkImportDeclaration;
  formato: 'csv' | 'json';
  bytes: number;
  total: number;
  validas: number;
  problemasDeArchivo: readonly BulkImportFieldIssue[];
  problemas: readonly BulkImportRowIssue[];
  totalDeProblemas: number;
  creadoEn: string;
}): BulkImportBatch {
  const hayArchivoRoto = args.problemasDeArchivo.length > 0;
  return {
    id: args.id,
    kind: args.tipo.kind,
    kindVersion: '1',
    group: args.tipo.group,
    status: !hayArchivoRoto && args.validas > 0 ? 'VALIDADO' : 'RECHAZADO',
    createdAt: args.creadoEn,
    updatedAt: args.creadoEn,
    declaration: args.declaracion,
    source: { format: args.formato, byteSize: args.bytes },
    counts: { total: args.total, valid: args.validas, rejected: args.total - args.validas },
    fileIssues: args.problemasDeArchivo,
    issues: {
      total: hayArchivoRoto ? args.problemasDeArchivo.length : args.totalDeProblemas,
      truncated: !hayArchivoRoto && args.totalDeProblemas > args.problemas.length,
      items: hayArchivoRoto ? [] : args.problemas,
    },
    progress: { processed: 0, total: args.validas },
  };
}

/** Los tres lotes con los que arranca la maqueta, consistentes con el motor declarado. */
function lotesIniciales(motor: BulkImportEngineStatus): Map<string, Lote> {
  const lotes = new Map<string, Lote>();
  const base = {
    declaracion: { reason: 'SIMULADO · alta de prueba' } as BulkImportDeclaration,
    formato: 'csv' as const,
    problemasDeArchivo: [] as BulkImportFieldIssue[],
  };

  // 1) Completado: dos filas con problemas de esquema; las 38 válidas no se escribieron.
  const completado: Lote = {
    vista: {
      ...crearVista({
        ...base,
        id: uuid('bulk-import-simulado-1'),
        tipo: tipoSimulado('usuario-paciente')!,
        bytes: 5_210,
        total: 40,
        validas: 38,
        problemas: [
          { row: 7, field: 'email', code: 'INVALID_FORMAT', message: 'Debe ser un correo electrónico válido' },
          { row: 22, field: 'phone', code: 'REQUIRED', message: 'El campo es obligatorio' },
        ],
        totalDeProblemas: 2,
        creadoEn: iso(-2, 10),
      }),
      status: 'COMPLETADO',
      confirmedAt: iso(-2, 10, 5),
      startedAt: iso(-2, 10, 5),
      finishedAt: iso(-2, 10, 6),
      progress: { processed: 38, total: 38 },
    },
    validas: Array.from({ length: 40 }, (_, i) => i + 1).filter((n) => n !== 7 && n !== 22),
    rechazadas: [
      { row: 7, reason: 'INVALID_FORMAT', field: 'email' },
      { row: 22, reason: 'REQUIRED', field: 'phone' },
    ],
    claveDeConfirmacion: 'simulado-confirmacion-1',
  };
  completado.informe = armarInforme(completado, motor, iso(-2, 10, 6));
  lotes.set(completado.vista.id, completado);

  // 2) Rechazado: clínica sin resolutor de pacientes conectado.
  const rechazado: Lote = {
    vista: crearVista({
      ...base,
      declaracion: {
        sourceOrganization: 'SIMULADO · Clínica de ejemplo',
        legalBasis: 'SIMULADO · Convenio de traspaso de ejemplo',
        loadedAt: iso(-1).slice(0, 10),
      },
      id: uuid('bulk-import-simulado-2'),
      tipo: tipoSimulado('hc-encuentro')!,
      bytes: 1_840,
      total: 12,
      validas: 0,
      problemas: Array.from({ length: 12 }, (_, i) => ({
        row: i + 1,
        field: 'nationalId',
        code: 'RESOLUTION_UNAVAILABLE',
        message: MENSAJES['RESOLUTION_UNAVAILABLE']!,
      })),
      totalDeProblemas: 12,
      creadoEn: iso(-1, 15),
    }),
    validas: [],
    rechazadas: Array.from({ length: 12 }, (_, i) => ({ row: i + 1, reason: 'RESOLUTION_UNAVAILABLE', field: 'nationalId' })),
  };
  lotes.set(rechazado.vista.id, rechazado);

  // 3) Validado: espera la confirmación de quien lo abra.
  const pendiente: Lote = {
    vista: crearVista({
      ...base,
      id: uuid('bulk-import-simulado-3'),
      tipo: tipoSimulado('usuario-profesional')!,
      bytes: 3_020,
      total: 25,
      validas: 25,
      problemas: [],
      totalDeProblemas: 0,
      creadoEn: iso(-1, 17),
    }),
    validas: Array.from({ length: 25 }, (_, i) => i + 1),
    rechazadas: [],
  };
  lotes.set(pendiente.vista.id, pendiente);
  return lotes;
}

/* ---- Plantillas -------------------------------------------------------------- */

function celdaCsv(valor: string): string {
  return /[",\n\r;]/.test(valor) ? `"${valor.replace(/"/g, '""')}"` : valor;
}

function plantillaCsv(tipo: TipoSimulado): string {
  const nombres = tipo.columns.map((c) => c.name);
  return `${nombres.map(celdaCsv).join(',')}\n${tipo.columns.map((c) => celdaCsv(c.example)).join(',')}\n`;
}

function plantillaJson(tipo: TipoSimulado): string {
  return `${JSON.stringify(
    {
      kind: tipo.kind,
      version: '1',
      columns: tipo.columns.map((c) => ({
        name: c.name,
        type: c.type,
        required: c.required,
        description: c.description,
        example: c.example,
        source: 'SIMULADO · columna de la maqueta, no del DTO de la API',
      })),
      example: [Object.fromEntries(tipo.columns.map((c) => [c.name, c.example]))],
      rules: [
        `Formatos admitidos: csv, json. Máximo ${LIMITES_SIMULADOS.maxRows} filas y 20 MB por archivo.`,
        'Los ejemplos son sintéticos: reemplácelos por los datos reales antes de cargar.',
      ],
    },
    null,
    2,
  )}\n`;
}

/* ---- Manejadores ------------------------------------------------------------ */

const ROLES_DE_GESTION = ['SUPERADMIN', 'SECURITY_ADMIN', 'PLATFORM_ADMIN'] as const;
const CLAVE_VALIDA = /^[A-Za-z0-9._:-]+$/;

function campo(body: unknown, clave: string): string | undefined {
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const valor = body.get(clave);
    return typeof valor === 'string' ? valor : undefined;
  }
  if (typeof body === 'object' && body !== null) {
    const valor = (body as Record<string, unknown>)[clave];
    return typeof valor === 'string' ? valor : undefined;
  }
  return undefined;
}

/** Misma regla que `assertDeclaration` de la API: lo que corresponde, y sólo eso. */
function campoInvalidoDeDeclaracion(tipo: TipoSimulado, d: BulkImportDeclaration): string | null {
  const largo = (v: string | undefined, min: number, max: number) => v !== undefined && v.trim().length >= min && v.trim().length <= max;
  if (tipo.group === 'USERS') {
    if (!largo(d.reason, 1, 500)) return 'reason';
    return (['sourceOrganization', 'legalBasis', 'loadedAt'] as const).find((c) => d[c] !== undefined) ?? null;
  }
  if (!largo(d.sourceOrganization, 1, 200)) return 'sourceOrganization';
  if (!largo(d.legalBasis, 3, 500)) return 'legalBasis';
  if (d.loadedAt === undefined || !esFechaReal(d.loadedAt) || d.loadedAt > new Date().toISOString().slice(0, 10)) return 'loadedAt';
  return d.reason !== undefined ? 'reason' : null;
}

function csvDelInforme(informe: BulkImportReport): string {
  const celda = (v: string | number | undefined) => {
    const texto = String(v ?? '');
    return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const lineas = ['row,outcome,reason,field,message'];
  for (const p of informe.fileIssues) lineas.push(['', '', p.code, p.field, p.message].map(celda).join(','));
  for (const r of informe.rows) lineas.push([r.row, r.outcome, r.reason, r.field, r.message].map(celda).join(','));
  return `${lineas.join('\n')}\n`;
}

export function registrarCargasMasivas(router: MockRouter, motor: BulkImportEngineStatus = ESTADO_DEL_MOTOR_SIMULADO): void {
  const lotes = lotesIniciales(motor);

  /** 401 sin sesión; 403 sin rol de gestión. */
  const sinAcceso = (req: MockRequest): MockReply | null => {
    if (req.user === null) return unauthorized();
    if (!req.user.roles.some((r) => (ROLES_DE_GESTION as readonly string[]).includes(r))) {
      return forbidden('Hace falta administración de seguridad o de la plataforma para las cargas masivas.');
    }
    return null;
  };

  const loteDe = (req: MockRequest): Lote | MockReply => lotes.get(req.params['id'] ?? '') ?? fallo(404, 'BATCH_NOT_AVAILABLE');

  /** Cada `GET /:id` avanza el procesamiento un paso: EN_COLA → PROCESANDO → COMPLETADO. */
  const avanzar = (lote: Lote): void => {
    const ahoraIso = new Date().toISOString();
    if (lote.vista.status === 'EN_COLA') {
      lote.vista = {
        ...lote.vista,
        status: 'PROCESANDO',
        startedAt: ahoraIso,
        updatedAt: ahoraIso,
        progress: { processed: Math.floor(lote.validas.length / 2), total: lote.validas.length },
      };
    } else if (lote.vista.status === 'PROCESANDO') {
      lote.vista = {
        ...lote.vista,
        status: 'COMPLETADO',
        finishedAt: ahoraIso,
        updatedAt: ahoraIso,
        progress: { processed: lote.validas.length, total: lote.validas.length },
      };
      lote.informe = armarInforme(lote, motor, ahoraIso);
    }
  };

  router.get('/admin/bulk-imports/templates', (req) => {
    const denegado = sinAcceso(req);
    if (denegado) return denegado;
    const catalogo: BulkImportCatalog = {
      templates: TIPOS_SIMULADOS.map((t) => ({
        kind: t.kind,
        version: '1',
        group: t.group,
        title: t.title,
        description: t.description,
        permission: t.permission,
        columnCount: t.columns.length,
        formats: ['csv', 'json'],
      })),
      limits: LIMITES_SIMULADOS,
      formats: ['csv', 'json'],
      engine: motor,
    };
    return catalogo;
  });

  router.get('/admin/bulk-imports/templates/:kind', (req) => {
    const denegado = sinAcceso(req);
    if (denegado) return denegado;
    const tipo = tipoSimulado(req.params['kind'] ?? '');
    if (!tipo) return fallo(404, 'KIND_UNKNOWN');
    const formato = req.query.get('format') ?? 'csv';
    if (formato !== 'csv' && formato !== 'json') {
      return fallo(400, 'FORMAT_UNSUPPORTED', { supported: ['csv', 'json'] });
    }
    return {
      status: 200,
      body: formato === 'csv' ? plantillaCsv(tipo) : plantillaJson(tipo),
      headers: {
        'Content-Type': formato === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="plantilla-${tipo.kind}-v1.${formato}"`,
      },
    };
  });

  router.get('/admin/bulk-imports', (req) => {
    const denegado = sinAcceso(req);
    if (denegado) return denegado;
    const pedido = req.query.get('limit');
    const limite = pedido === null ? 25 : Number(pedido);
    if (!Number.isInteger(limite) || limite < 1 || limite > 100) {
      return reply(400, {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'Error de validación',
        details: { violations: ['limit must not be greater than 100'] },
      });
    }
    return [...lotes.values()]
      .map((l) => l.vista)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limite);
  });

  router.post('/admin/bulk-imports', async (req) => {
    const denegado = sinAcceso(req);
    if (denegado) return denegado;
    const tipo = tipoSimulado(campo(req.body, 'kind') ?? '');
    if (!tipo) return fallo(404, 'KIND_UNKNOWN');

    const declaracion: BulkImportDeclaration = {
      ...(campo(req.body, 'reason') === undefined ? {} : { reason: campo(req.body, 'reason') }),
      ...(campo(req.body, 'sourceOrganization') === undefined ? {} : { sourceOrganization: campo(req.body, 'sourceOrganization') }),
      ...(campo(req.body, 'legalBasis') === undefined ? {} : { legalBasis: campo(req.body, 'legalBasis') }),
      ...(campo(req.body, 'loadedAt') === undefined ? {} : { loadedAt: campo(req.body, 'loadedAt') }),
    };
    const invalido = campoInvalidoDeDeclaracion(tipo, declaracion);
    if (invalido !== null) return fallo(400, 'DECLARATION_INVALID', { field: invalido });

    const archivo = typeof FormData !== 'undefined' && req.body instanceof FormData ? req.body.get('file') : null;
    if (!(archivo instanceof Blob)) return fallo(400, 'SOURCE_AMBIGUOUS');
    if (archivo.size > LIMITES_SIMULADOS.maxBytes) return fallo(413, 'FILE_TOO_LARGE');

    const nombre = archivo instanceof File ? archivo.name : '';
    const lectura = leerArchivo(tipo, nombre, await archivo.text());
    if (lectura.filas.length > LIMITES_SIMULADOS.maxRows) return fallo(413, 'ROW_LIMIT_EXCEEDED');

    const hayArchivoRoto = lectura.problemasDeArchivo.length > 0;
    const resultado = hayArchivoRoto
      ? { total: lectura.filas.length, validas: [] as number[], rechazadas: [], problemas: [], totalDeProblemas: 0 }
      : validarFilas(tipo, lectura.filas, motor);
    const vista = crearVista({
      id: nuevoId('bulk-import'),
      tipo,
      declaracion,
      formato: lectura.formato,
      bytes: archivo.size,
      total: resultado.total,
      validas: resultado.validas.length,
      problemasDeArchivo: lectura.problemasDeArchivo,
      problemas: resultado.problemas,
      totalDeProblemas: resultado.totalDeProblemas,
      creadoEn: new Date().toISOString(),
    });
    lotes.set(vista.id, {
      vista,
      validas: vista.status === 'VALIDADO' ? resultado.validas : [],
      rechazadas: resultado.rechazadas,
    });
    return reply(201, vista);
  });

  router.post('/admin/bulk-imports/:id/confirm', (req) => {
    const denegado = sinAcceso(req);
    if (denegado) return denegado;
    const clave = req.headers.get('Idempotency-Key');
    if (!clave || clave.length > LIMITES_SIMULADOS.maxIdempotencyKeyLength || !CLAVE_VALIDA.test(clave)) {
      return fallo(400, 'IDEMPOTENCY_KEY_REQUIRED');
    }
    const lote = loteDe(req);
    if ('status' in lote) return lote;
    if (lote.claveDeConfirmacion !== undefined) {
      return lote.claveDeConfirmacion === clave ? reply(202, lote.vista) : fallo(409, 'BATCH_ALREADY_CONFIRMED');
    }
    if ([...lotes.values()].some((otro) => otro.claveDeConfirmacion === clave)) return fallo(409, 'IDEMPOTENCY_KEY_REUSED');
    if (lote.vista.status !== 'VALIDADO') return fallo(409, 'BATCH_NOT_CONFIRMABLE');
    const ahoraIso = new Date().toISOString();
    lote.claveDeConfirmacion = clave;
    lote.vista = { ...lote.vista, status: 'EN_COLA', confirmedAt: ahoraIso, updatedAt: ahoraIso };
    return reply(202, lote.vista);
  });

  router.get('/admin/bulk-imports/:id/report', (req) => {
    const denegado = sinAcceso(req);
    if (denegado) return denegado;
    const lote = loteDe(req);
    if ('status' in lote) return lote;
    const formato = req.query.get('format') ?? 'json';
    if (formato !== 'json' && formato !== 'csv') {
      return reply(400, { statusCode: 400, code: 'VALIDATION_FAILED', message: 'Error de validación', details: { violations: ['format must be one of the following values: json, csv'] } });
    }
    let informe = lote.informe;
    if (lote.vista.status === 'RECHAZADO') {
      informe = armarInforme(lote, motor, lote.vista.updatedAt);
      informe = { ...informe, totals: { ...informe.totals, RECHAZADA: lote.rechazadas.length, total: lote.vista.counts.total } };
    }
    if (informe === undefined) return fallo(409, 'REPORT_NOT_READY');
    if (formato === 'json') return informe;
    return {
      status: 200,
      body: csvDelInforme(informe),
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="informe-${lote.vista.id}.csv"`,
      },
    };
  });

  router.get('/admin/bulk-imports/:id', (req) => {
    const denegado = sinAcceso(req);
    if (denegado) return denegado;
    const lote = loteDe(req);
    if ('status' in lote) return lote;
    avanzar(lote);
    return lote.vista;
  });
}
