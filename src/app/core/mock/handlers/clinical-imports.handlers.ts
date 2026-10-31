import type {
  ClinicalImportBatch,
  ClinicalImportCatalog,
  ClinicalImportCollaborator,
  ClinicalImportEngineStatus,
  ClinicalImportReport,
  ClinicalImportReportRow,
  ClinicalImportRowOutcome,
} from '../../data-access/admin-portal/clinical-imports.types';
import {
  forbidden,
  reply,
  unauthorized,
  type MockReply,
  type MockRequest,
  type MockRouter,
} from '../mock-router';
import { iso, nuevoId, uuid } from '../mock-store';
import { ISSUE_MESSAGES, messageFor } from './clinical-imports.messages';
import type { FieldIssue, ImportDeclaration, ParsedRow, RowIssue } from './clinical-imports.model';
import { detectFormat, parseFile } from './clinical-imports.parser';
import {
  KIND_SPECS,
  NON_CONTENT_COLUMNS,
  conceptGroups,
  kindSpec,
  type KindSpec,
} from './clinical-imports.schema';
import { buildTemplate } from './clinical-imports.template';
import { invalidDeclarationField, validateRows } from './clinical-imports.validator';

/* ============================================================================
    Backend simulado de la carga masiva de historias clínicas
    (`/admin/clinical-imports`, H7).

    **DATOS SINTÉTICOS (SIMULADO).** Valida y genera plantillas con el MISMO
    código que la API (copias `clinical-imports.{schema,parser,validator,
    template,messages}.ts`); lo que cambia es de dónde salen los pacientes, los
    códigos y la persistencia:

    - Un padrón sintético de cuatro pacientes (`SINT-…`): uno único, uno
      ambiguo, uno con consentimiento revocado. Un documento que no está, o que
      está con OTRA fecha de nacimiento, da el mismo `PATIENT_NOT_FOUND`.
    - Una terminología sintética (`sistema-demo` / `SINT-0001…0005`). Ningún
      código clínico real está escrito acá.
    - Sólo agrega: el índice de deduplicación omite lo idéntico (`OMITIDA`) y
      reporta como `CONFLICTO` lo que existe con otro contenido; nunca pisa.
    - El procesamiento avanza un paso por cada `GET /:id` (EN_COLA → PROCESANDO
      → COMPLETADO), sin temporizadores: dos corridas dan lo mismo.

    Pasar `MOTOR_CLINICO_SIN_CONECTAR` a {@link registrarCargasClinicas} simula
    la API tal como queda hoy (colaboradores reales sin conectar): la vista
    previa rechaza todo con `RESOLUTION_UNAVAILABLE`, sin adivinar a nadie.

    Acceso: `SECURITY_ADMIN` y `SUPERADMIN`; el resto 403. Un lote de otra
    organización (`X-Tenant-Id`) es 404, igual que uno inexistente.
    ========================================================================== */

const simulado = (adapter: string, note: string): ClinicalImportCollaborator => ({
  connected: true,
  adapter,
  note: `SIMULADO · ${note}`,
});
const sinConectar = (adapter: string): ClinicalImportCollaborator => ({
  connected: false,
  adapter,
});

/** El motor de la maqueta: todo simulado, para poder recorrer el camino completo. */
export const MOTOR_CLINICO_SIMULADO: ClinicalImportEngineStatus = {
  persistence: simulado(
    'InMemoryBatchRepository',
    'los lotes viven en memoria y no sobreviven a un reinicio.',
  ),
  writer: simulado('MockClinicalWriter', 'no se escribe en ninguna historia clínica real.'),
  audit: simulado('MockImportAudit', 'el rastro de auditoría es de ejemplo.'),
  resolvers: {
    patients: simulado('MockPatientResolver', 'cuatro pacientes sintéticos.'),
    codes: simulado('MockConceptResolver', 'terminología sintética `sistema-demo`.'),
    practitioners: simulado('MockPractitionerResolver', 'un profesional sintético.'),
  },
};

/** Lo que declara la API hoy: ningún colaborador clínico conectado. */
export const MOTOR_CLINICO_SIN_CONECTAR: ClinicalImportEngineStatus = {
  persistence: {
    connected: true,
    adapter: 'InMemoryBatchRepository',
    note: 'Los lotes viven en memoria: no sobreviven a un reinicio ni se comparten entre réplicas.',
  },
  writer: sinConectar('NotConnectedClinicalWriter'),
  audit: sinConectar('NotConnectedImportAudit'),
  resolvers: {
    patients: sinConectar('NotConnectedPatientResolver'),
    codes: sinConectar('NotConnectedConceptResolver'),
    practitioners: sinConectar('NotConnectedPractitionerResolver'),
  },
};

export const LIMITES_CLINICOS_SIMULADOS = {
  maxBytes: 20 * 1024 * 1024,
  maxRows: 5_000,
  maxPreviewIssues: 200,
  maxIdempotencyKeyLength: 128,
} as const;

/* ---- Padrón y terminología sintéticos ------------------------------------------ */

type Paciente =
  | { readonly estado: 'FOUND'; readonly id: string; readonly revocado: boolean }
  | { readonly estado: 'AMBIGUOUS' };

const PADRON: Readonly<Record<string, Paciente>> = {
  'SINT-0001|1990-01-15': { estado: 'FOUND', id: 'paciente-sintetico-1', revocado: false },
  'SINT-0002|1985-03-02': { estado: 'FOUND', id: 'paciente-sintetico-2', revocado: false },
  'SINT-0003|1970-07-07': { estado: 'AMBIGUOUS' },
  'SINT-0004|1999-09-09': { estado: 'FOUND', id: 'paciente-sintetico-4', revocado: true },
};

/** Los códigos que existen en la terminología sintética; el resto es `CODE_NOT_FOUND`. */
const CODIGOS_EXISTENTES = new Set([
  'SINT-0001',
  'SINT-0002',
  'SINT-0003',
  'SINT-0004',
  'SINT-0005',
]);
const CODIGO_AMBIGUO = 'SINT-AMBIGUO';
const MATRICULAS_EXISTENTES = new Set(['MAT-SINT-01']);

/* ---- Errores del contrato -------------------------------------------------------- */

const ESTADOS_CODIGO: Readonly<Record<number, { code: string; error: string }>> = {
  400: { code: 'VALIDATION_FAILED', error: 'Bad Request' },
  403: { code: 'FORBIDDEN', error: 'Forbidden' },
  404: { code: 'NOT_FOUND', error: 'Not Found' },
  409: { code: 'CONFLICT', error: 'Conflict' },
  413: { code: 'PAYLOAD_TOO_LARGE', error: 'Payload Too Large' },
};

function fallo(status: number, reason: string, details?: Record<string, unknown>): MockReply {
  const { code, error } = ESTADOS_CODIGO[status] ?? { code: 'INTERNAL', error: 'Error' };
  return reply(status, {
    statusCode: status,
    code,
    message: ISSUE_MESSAGES[reason] ?? reason,
    error,
    reason,
    ...(details === undefined ? {} : { details }),
  });
}

/* ---- Resolución de una fila (capa 2) --------------------------------------------- */

interface Resolucion {
  readonly problemas: readonly FieldIssue[];
  readonly clave: string;
  readonly huella: string;
}

const problema = (field: string, code: string): FieldIssue => ({
  field,
  code,
  message: messageFor(code),
});

function resolverFila(
  spec: KindSpec,
  fila: ParsedRow,
  motor: ClinicalImportEngineStatus,
  tenant: string,
  d: ImportDeclaration,
): Resolucion {
  const v = fila.values;
  const problemas: FieldIssue[] = [];
  const vacio = { problemas, clave: '', huella: '' };
  if (!motor.resolvers.patients.connected || !motor.resolvers.codes.connected) {
    return { ...vacio, problemas: [problema('*', 'RESOLUTION_UNAVAILABLE')] };
  }

  const paciente = PADRON[`${v['documentNumber'] ?? ''}|${v['birthDate'] ?? ''}`];
  let pacienteId = '';
  if (paciente === undefined) problemas.push(problema('documentNumber', 'PATIENT_NOT_FOUND'));
  else if (paciente.estado === 'AMBIGUOUS')
    problemas.push(problema('documentNumber', 'PATIENT_AMBIGUOUS'));
  else if (paciente.revocado) problemas.push(problema('documentNumber', 'CONSENT_REVOKED'));
  else pacienteId = paciente.id;

  const conceptos: string[] = [];
  for (const grupo of conceptGroups(spec)) {
    const sistema = v[grupo.systemField] ?? '';
    const codigo = v[grupo.codeField] ?? '';
    if (sistema === '' && codigo === '') continue;
    if (codigo === CODIGO_AMBIGUO) problemas.push(problema(grupo.codeField, 'CODE_AMBIGUOUS'));
    else if (sistema === 'sistema-demo' && CODIGOS_EXISTENTES.has(codigo))
      conceptos.push(`${grupo.group}=${sistema}:${codigo}`);
    else problemas.push(problema(grupo.codeField, 'CODE_NOT_FOUND'));
  }

  const matricula = v['authorLicenseNumber'] ?? '';
  if (matricula !== '' && !MATRICULAS_EXISTENTES.has(matricula)) {
    problemas.push(problema('authorLicenseNumber', 'PRACTITIONER_NOT_FOUND'));
  }

  if (problemas.length > 0) return { ...vacio, problemas };
  const contenido = Object.entries(v)
    .filter(
      ([nombre, valor]) =>
        valor !== '' &&
        !NON_CONTENT_COLUMNS.has(nombre) &&
        !nombre.endsWith('System') &&
        !nombre.endsWith('Code'),
    )
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([nombre, valor]) => `${nombre}=${valor}`);
  return {
    problemas,
    clave: [
      tenant,
      spec.kind,
      pacienteId,
      d.sourceOrganization.trim().toLowerCase(),
      v['sourceRecordId'] ?? '',
    ].join('|'),
    huella: [...contenido, ...conceptos.sort()].join('&'),
  };
}

/* ---- Lotes ------------------------------------------------------------------------- */

interface Lote {
  vista: ClinicalImportBatch;
  tenant: string;
  pendientes: readonly ParsedRow[];
  rechazadasEnVistaPrevia: readonly ClinicalImportReportRow[];
  resultados: readonly ClinicalImportReportRow[];
  cargados: readonly { row: number; kind: string; entity: string; targetId: string }[];
  claveDeConfirmacion?: string;
}

const TENANT_POR_OMISION = 'sin-organizacion';
const ROLES_AUTORIZADOS = ['SUPERADMIN', 'SECURITY_ADMIN'] as const;
const CLAVE_VALIDA = /^[A-Za-z0-9._:-]+$/;

const filaDeInforme = (
  row: number,
  outcome: ClinicalImportRowOutcome,
  reason?: string,
  field?: string,
): ClinicalImportReportRow => ({
  row,
  outcome,
  ...(reason === undefined ? {} : { reason, message: messageFor(reason) }),
  ...(field === undefined ? {} : { field }),
});

function entidadDe(spec: KindSpec): string {
  return spec.target.split(' + ')[0] ?? spec.target;
}

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

function csvDelInforme(informe: ClinicalImportReport): string {
  const celda = (v: string | number | undefined) => {
    const texto = String(v ?? '');
    return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const lineas = ['row,outcome,reason,field,message'];
  for (const p of informe.fileIssues)
    lineas.push(['', '', p.code, p.field, p.message].map(celda).join(','));
  for (const r of informe.rows)
    lineas.push([r.row, r.outcome, r.reason, r.field, r.message].map(celda).join(','));
  return `${lineas.join('\n')}\n`;
}

export function registrarCargasClinicas(
  router: MockRouter,
  motor: ClinicalImportEngineStatus = MOTOR_CLINICO_SIMULADO,
): void {
  const lotes = new Map<string, Lote>();
  /** Índice de deduplicación: clave de origen → huella del contenido. Sólo se agrega a él. */
  const indice = new Map<string, string>();

  /** 401 sin sesión; 403 sin rol. */
  const sinAcceso = (req: MockRequest): MockReply | null => {
    if (req.user === null) return unauthorized();
    if (!req.user.roles.some((r) => (ROLES_AUTORIZADOS as readonly string[]).includes(r))) {
      return forbidden(
        'Hace falta administración de seguridad para la carga masiva de historias clínicas.',
      );
    }
    return null;
  };
  const tenantDe = (req: MockRequest): string =>
    req.headers.get('X-Tenant-Id') ?? TENANT_POR_OMISION;
  /** Otra organización y «no existe» dan la misma respuesta. */
  const loteDe = (req: MockRequest): Lote | MockReply => {
    const lote = lotes.get(req.params['id'] ?? '');
    return lote !== undefined && lote.tenant === tenantDe(req)
      ? lote
      : fallo(404, 'BATCH_NOT_AVAILABLE');
  };

  const procesar = (lote: Lote): void => {
    const spec = kindSpec(lote.vista.kind);
    if (spec === undefined) return;
    const resultados: ClinicalImportReportRow[] = [];
    const cargados: { row: number; kind: string; entity: string; targetId: string }[] = [];
    for (const fila of lote.pendientes) {
      const r = resolverFila(spec, fila, motor, lote.tenant, lote.vista.declaration);
      if (r.problemas.length > 0) {
        const primero = r.problemas[0];
        resultados.push(filaDeInforme(fila.row, 'RECHAZADA', primero?.code, primero?.field));
        continue;
      }
      if (!motor.writer.connected) {
        resultados.push(filaDeInforme(fila.row, 'FALLIDA', 'WRITE_FAILED'));
        continue;
      }
      const previa = indice.get(r.clave);
      if (previa === undefined) {
        indice.set(r.clave, r.huella);
        resultados.push(filaDeInforme(fila.row, 'CREADA'));
        cargados.push({
          row: fila.row,
          kind: spec.kind,
          entity: entidadDe(spec),
          targetId: nuevoId('clinical-record'),
        });
      } else if (previa === r.huella) {
        resultados.push(filaDeInforme(fila.row, 'OMITIDA', 'ALREADY_LOADED'));
      } else {
        resultados.push(filaDeInforme(fila.row, 'CONFLICTO', 'CONTENT_CONFLICT'));
      }
    }
    const ahoraIso = new Date().toISOString();
    lote.resultados = resultados;
    lote.cargados = cargados;
    lote.pendientes = []; // el archivo no se conserva
    lote.vista = {
      ...lote.vista,
      status: 'COMPLETADO',
      finishedAt: ahoraIso,
      updatedAt: ahoraIso,
      progress: { processed: resultados.length, total: lote.vista.counts.valid },
    };
  };

  const avanzar = (lote: Lote): void => {
    const ahoraIso = new Date().toISOString();
    if (lote.vista.status === 'EN_COLA') {
      lote.vista = {
        ...lote.vista,
        status: 'PROCESANDO',
        startedAt: ahoraIso,
        updatedAt: ahoraIso,
        progress: {
          processed: Math.floor(lote.pendientes.length / 2),
          total: lote.pendientes.length,
        },
      };
    } else if (lote.vista.status === 'PROCESANDO') {
      procesar(lote);
    }
  };

  const informeDe = (lote: Lote): ClinicalImportReport => {
    const filas = [...lote.rechazadasEnVistaPrevia, ...lote.resultados].sort(
      (a, b) => a.row - b.row,
    );
    const cuenta = (o: ClinicalImportRowOutcome) => filas.filter((f) => f.outcome === o).length;
    return {
      batchId: lote.vista.id,
      kind: lote.vista.kind,
      status: lote.vista.status,
      generatedAt: new Date().toISOString(),
      totals: {
        total: filas.length,
        CREADA: cuenta('CREADA'),
        OMITIDA: cuenta('OMITIDA'),
        CONFLICTO: cuenta('CONFLICTO'),
        RECHAZADA: cuenta('RECHAZADA'),
        FALLIDA: cuenta('FALLIDA'),
        NO_PROCESADA: cuenta('NO_PROCESADA'),
      },
      fileIssues: lote.vista.fileIssues,
      rows: filas,
    };
  };

  /* -- Catálogo y plantillas -------------------------------------------------------- */

  router.get('/admin/clinical-imports/catalog', (req) => {
    const denegado = sinAcceso(req);
    if (denegado) return denegado;
    const catalogo: ClinicalImportCatalog = {
      kinds: KIND_SPECS.map((k) => ({
        kind: k.kind,
        version: k.version,
        group: 'CLINICAL',
        title: k.title,
        description: k.description,
        target: k.target,
        columnCount: k.columns.length,
        formats: ['csv', 'json'],
      })),
      limits: LIMITES_CLINICOS_SIMULADOS,
      formats: ['csv', 'json'],
      engine: motor,
    };
    return catalogo;
  });

  router.get('/admin/clinical-imports/import-template', (req) => {
    const denegado = sinAcceso(req);
    if (denegado) return denegado;
    const formato = req.query.get('format') ?? 'csv';
    if (formato !== 'csv' && formato !== 'json')
      return fallo(400, 'FORMAT_UNSUPPORTED', { supported: ['csv', 'json'] });
    const archivo = buildTemplate(req.query.get('kind') ?? '', formato);
    if (archivo === null) return fallo(404, 'KIND_UNKNOWN');
    return {
      status: 200,
      body: archivo.content,
      headers: {
        'Content-Type': archivo.contentType,
        'Content-Disposition': `attachment; filename="${archivo.fileName}"`,
      },
    };
  });

  /* -- Lotes ------------------------------------------------------------------------------ */

  router.get('/admin/clinical-imports', (req) => {
    const denegado = sinAcceso(req);
    if (denegado) return denegado;
    const pedido = req.query.get('limit');
    const limite = pedido === null ? 25 : Number(pedido);
    if (!Number.isInteger(limite) || limite < 1 || limite > 100) {
      return reply(400, {
        statusCode: 400,
        code: 'VALIDATION_FAILED',
        message: 'limit debe estar entre 1 y 100',
      });
    }
    return [...lotes.values()]
      .filter((l) => l.tenant === tenantDe(req))
      .map((l) => l.vista)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limite);
  });

  router.post('/admin/clinical-imports', async (req) => {
    const denegado = sinAcceso(req);
    if (denegado) return denegado;
    const spec = kindSpec(campo(req.body, 'kind') ?? '');
    if (spec === undefined) return fallo(404, 'KIND_UNKNOWN');

    const ahora = new Date();
    const crudo = {
      sourceOrganization: campo(req.body, 'sourceOrganization'),
      legalBasis: campo(req.body, 'legalBasis'),
      loadedAt: campo(req.body, 'loadedAt'),
    };
    const invalido = invalidDeclarationField(crudo, ahora);
    if (invalido !== null) return fallo(400, 'DECLARATION_INVALID', { field: invalido });
    const declaracion: ImportDeclaration = {
      sourceOrganization: (crudo.sourceOrganization ?? '').trim(),
      legalBasis: (crudo.legalBasis ?? '').trim(),
      loadedAt: crudo.loadedAt ?? '',
    };

    const archivo =
      typeof FormData !== 'undefined' && req.body instanceof FormData ? req.body.get('file') : null;
    if (!(archivo instanceof Blob)) return fallo(400, 'SOURCE_MISSING');
    if (archivo.size > LIMITES_CLINICOS_SIMULADOS.maxBytes) return fallo(413, 'FILE_TOO_LARGE');

    const texto = await archivo.text();
    const nombre = archivo instanceof File ? archivo.name : '';
    const lectura = parseFile(spec, detectFormat(nombre, texto), texto);
    if (lectura.rows.length > LIMITES_CLINICOS_SIMULADOS.maxRows)
      return fallo(413, 'ROW_LIMIT_EXCEEDED');

    const id = nuevoId('clinical-import');
    const tenant = tenantDe(req);
    const total = lectura.rows.length;
    const base = {
      id,
      kind: spec.kind,
      kindVersion: spec.version,
      group: 'CLINICAL' as const,
      createdAt: ahora.toISOString(),
      updatedAt: ahora.toISOString(),
      declaration: declaracion,
      source: { format: lectura.format, byteSize: archivo.size },
    };

    if (lectura.fileIssues.length > 0) {
      const vista: ClinicalImportBatch = {
        ...base,
        status: 'RECHAZADO',
        counts: { total, valid: 0, rejected: total },
        fileIssues: lectura.fileIssues,
        issues: { total: lectura.fileIssues.length, truncated: false, items: [] },
        progress: { processed: 0, total: 0 },
      };
      lotes.set(id, {
        vista,
        tenant,
        pendientes: [],
        rechazadasEnVistaPrevia: [],
        resultados: [],
        cargados: [],
      });
      return reply(201, vista);
    }

    const esquema = validateRows(spec, lectura.rows, ahora);
    const problemas: RowIssue[] = [...esquema.issues];
    const pendientes: ParsedRow[] = [];
    for (const fila of esquema.valid) {
      const r = resolverFila(spec, fila, motor, tenant, declaracion);
      if (r.problemas.length === 0) pendientes.push(fila);
      else for (const p of r.problemas) problemas.push({ row: fila.row, ...p });
    }
    problemas.sort((a, b) => a.row - b.row);
    const primeroPorFila = new Map<number, RowIssue>();
    for (const p of problemas) if (!primeroPorFila.has(p.row)) primeroPorFila.set(p.row, p);

    const vista: ClinicalImportBatch = {
      ...base,
      status: pendientes.length > 0 ? 'VALIDADO' : 'RECHAZADO',
      counts: { total, valid: pendientes.length, rejected: total - pendientes.length },
      fileIssues: [],
      issues: {
        total: problemas.length,
        truncated: problemas.length > LIMITES_CLINICOS_SIMULADOS.maxPreviewIssues,
        items: problemas.slice(0, LIMITES_CLINICOS_SIMULADOS.maxPreviewIssues),
      },
      progress: { processed: 0, total: pendientes.length },
    };
    lotes.set(id, {
      vista,
      tenant,
      pendientes,
      rechazadasEnVistaPrevia: [...primeroPorFila.values()].map((p) =>
        filaDeInforme(p.row, 'RECHAZADA', p.code, p.field),
      ),
      resultados: [],
      cargados: [],
    });
    return reply(201, vista);
  });

  router.post('/admin/clinical-imports/:id/confirm', (req) => {
    const denegado = sinAcceso(req);
    if (denegado) return denegado;
    const clave = req.headers.get('Idempotency-Key');
    if (
      !clave ||
      clave.length > LIMITES_CLINICOS_SIMULADOS.maxIdempotencyKeyLength ||
      !CLAVE_VALIDA.test(clave)
    ) {
      return fallo(400, 'IDEMPOTENCY_KEY_REQUIRED');
    }
    const lote = loteDe(req);
    if ('status' in lote) return lote;
    if (lote.claveDeConfirmacion !== undefined) {
      return lote.claveDeConfirmacion === clave
        ? reply(202, lote.vista)
        : fallo(409, 'BATCH_ALREADY_CONFIRMED');
    }
    if (
      [...lotes.values()].some(
        (otro) => otro.tenant === lote.tenant && otro.claveDeConfirmacion === clave,
      )
    ) {
      return fallo(409, 'IDEMPOTENCY_KEY_REUSED');
    }
    if (invalidDeclarationField(lote.vista.declaration, new Date()) !== null)
      return fallo(409, 'DECLARATION_INVALID');
    if (lote.vista.status !== 'VALIDADO') return fallo(409, 'BATCH_NOT_CONFIRMABLE');
    const ahoraIso = new Date().toISOString();
    lote.claveDeConfirmacion = clave;
    lote.vista = { ...lote.vista, status: 'EN_COLA', confirmedAt: ahoraIso, updatedAt: ahoraIso };
    return reply(202, lote.vista);
  });

  router.get('/admin/clinical-imports/:id/report', (req) => {
    const denegado = sinAcceso(req);
    if (denegado) return denegado;
    const lote = loteDe(req);
    if ('status' in lote) return lote;
    const formato = req.query.get('format') ?? 'json';
    if (formato !== 'json' && formato !== 'csv')
      return fallo(400, 'FORMAT_UNSUPPORTED', { supported: ['json', 'csv'] });
    if (!['COMPLETADO', 'FALLIDO', 'RECHAZADO'].includes(lote.vista.status))
      return fallo(409, 'REPORT_NOT_READY');
    const informe = informeDe(lote);
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

  router.get('/admin/clinical-imports/:id/loaded', (req) => {
    const denegado = sinAcceso(req);
    if (denegado) return denegado;
    const lote = loteDe(req);
    if ('status' in lote) return lote;
    if (!['COMPLETADO', 'FALLIDO', 'RECHAZADO'].includes(lote.vista.status))
      return fallo(409, 'REPORT_NOT_READY');
    return { batchId: lote.vista.id, records: lote.cargados };
  });

  router.get('/admin/clinical-imports/:id', (req) => {
    const denegado = sinAcceso(req);
    if (denegado) return denegado;
    const lote = loteDe(req);
    if ('status' in lote) return lote;
    avanzar(lote);
    return lote.vista;
  });

  /* -- Lotes con los que arranca la maqueta ----------------------------------------------- */

  sembrar(lotes, TENANT_POR_OMISION);
}

/** Un lote ya procesado y uno rechazado, para que la lista no arranque vacía. SINTÉTICOS. */
function sembrar(lotes: Map<string, Lote>, tenant: string): void {
  const declaracion: ImportDeclaration = {
    sourceOrganization: 'SIMULADO · Clínica de ejemplo',
    legalBasis: 'SIMULADO · Convenio de traspaso de ejemplo',
    loadedAt: iso(-2).slice(0, 10),
  };
  const spec = kindSpec('hc-alergia');
  if (spec === undefined) return;
  const completado: Lote = {
    tenant,
    pendientes: [],
    rechazadasEnVistaPrevia: [filaDeInforme(7, 'RECHAZADA', 'PATIENT_NOT_FOUND', 'documentNumber')],
    resultados: [
      ...Array.from({ length: 6 }, (_, i) => filaDeInforme(i + 1, 'CREADA')),
      filaDeInforme(8, 'OMITIDA', 'ALREADY_LOADED'),
      filaDeInforme(9, 'CONFLICTO', 'CONTENT_CONFLICT'),
    ],
    cargados: Array.from({ length: 6 }, (_, i) => ({
      row: i + 1,
      kind: spec.kind,
      entity: entidadDe(spec),
      targetId: uuid(`clinical-record-simulado-${i}`),
    })),
    vista: {
      id: uuid('clinical-import-simulado-1'),
      kind: spec.kind,
      kindVersion: spec.version,
      group: 'CLINICAL',
      status: 'COMPLETADO',
      createdAt: iso(-2, 10),
      updatedAt: iso(-2, 10, 6),
      declaration: declaracion,
      source: { format: 'csv', byteSize: 1_240 },
      counts: { total: 9, valid: 8, rejected: 1 },
      fileIssues: [],
      issues: {
        total: 1,
        truncated: false,
        items: [
          {
            row: 7,
            field: 'documentNumber',
            code: 'PATIENT_NOT_FOUND',
            message: messageFor('PATIENT_NOT_FOUND'),
          },
        ],
      },
      progress: { processed: 8, total: 8 },
      confirmedAt: iso(-2, 10, 5),
      startedAt: iso(-2, 10, 5),
      finishedAt: iso(-2, 10, 6),
    },
    claveDeConfirmacion: 'simulado-confirmacion-1',
  };
  lotes.set(completado.vista.id, completado);

  const rechazado: Lote = {
    tenant,
    pendientes: [],
    rechazadasEnVistaPrevia: [],
    resultados: [],
    cargados: [],
    vista: {
      id: uuid('clinical-import-simulado-2'),
      kind: 'hc-nota',
      kindVersion: '1',
      group: 'CLINICAL',
      status: 'RECHAZADO',
      createdAt: iso(-1, 15),
      updatedAt: iso(-1, 15),
      declaration: declaracion,
      source: { format: 'json', byteSize: 310 },
      counts: { total: 0, valid: 0, rejected: 0 },
      fileIssues: [
        {
          field: 'authorLicenseNumber',
          code: 'COLUMN_MISSING',
          message: messageFor('COLUMN_MISSING'),
        },
      ],
      issues: { total: 1, truncated: false, items: [] },
      progress: { processed: 0, total: 0 },
    },
  };
  lotes.set(rechazado.vista.id, rechazado);
}
