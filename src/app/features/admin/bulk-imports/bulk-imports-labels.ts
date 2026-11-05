import { HttpErrorResponse } from '@angular/common/http';

import type {
  BulkImportBatch,
  BulkImportEngineStatus,
  BulkImportGroup,
  BulkImportLimits,
  BulkImportRowOutcome,
  BulkImportStatus,
} from '../../../core/data-access/admin-portal/bulk-imports.types';
import type { Tone } from '../../../shared/components/tone/tone.types';

/* ============================================================================
    Rótulos, tonos y mensajes de «Cargas masivas».

    Traducen los códigos del servidor a texto y a tono. No deciden nada: un
    código que no está acá se muestra tal cual, en vez de inventarle un
    significado.

    Reglas de honestidad que viven acá:
    - «Procesado» no es «creado». El resultado de cada fila es el del informe
      (`CREADA`, `RECHAZADA`…); un lote `COMPLETADO` puede tener cero creadas.
    - Lo que el motor no hace en esta instalación sale de `engine`, nunca de una
      suposición: sólo se afirma «no conectado» lo que la API declara así.
    - Un mensaje de error no repite nada de lo que la persona escribió.
    ========================================================================== */

export interface Rotulo {
  readonly label: string;
  readonly tone: Tone;
}

/* -- Familias ------------------------------------------------------------- */

export const GRUPOS_DE_CARGA: readonly {
  readonly value: BulkImportGroup;
  readonly label: string;
  readonly ayuda: string;
}[] = [
  {
    value: 'USERS',
    label: 'Altas de usuarios',
    ayuda: 'Cuentas nuevas, por tipo de alta. Nacen pendientes: cada titular activa la suya.',
  },
  {
    value: 'CLINICAL',
    label: 'Historias clínicas',
    ayuda:
      'Registros de pacientes que ya existen, por tipo de registro. Sólo se agrega: nunca se sobrescribe.',
  },
];

/* -- Estados del lote ----------------------------------------------------- */

const ESTADOS_DE_LOTE: Readonly<Record<BulkImportStatus, Rotulo>> = {
  VALIDADO: { label: 'Validado, falta confirmar', tone: 'info' },
  RECHAZADO: { label: 'Rechazado', tone: 'error' },
  EN_COLA: { label: 'En cola', tone: 'secondary' },
  PROCESANDO: { label: 'Procesando', tone: 'info' },
  COMPLETADO: { label: 'Procesado', tone: 'primary' },
  FALLIDO: { label: 'Fallido', tone: 'error' },
};

export function estadoDeLote(estado: string | null | undefined): Rotulo {
  const conocido = estado ? ESTADOS_DE_LOTE[estado as BulkImportStatus] : undefined;
  return conocido ?? { label: estado ?? 'Sin estado', tone: 'secondary' };
}

/** Un lote en estos estados todavía se mueve: la pantalla lo vuelve a pedir. */
export function estaEnCurso(estado: BulkImportStatus): boolean {
  return estado === 'EN_COLA' || estado === 'PROCESANDO';
}

/** Un lote en estos estados ya no cambia y tiene informe. */
export function estaTerminado(estado: BulkImportStatus): boolean {
  return estado === 'COMPLETADO' || estado === 'FALLIDO' || estado === 'RECHAZADO';
}

/* -- Resultado de cada fila ---------------------------------------------- */

export const RESULTADOS_DE_FILA: readonly BulkImportRowOutcome[] = [
  'CREADA',
  'OMITIDA',
  'CONFLICTO',
  'RECHAZADA',
  'FALLIDA',
  'NO_PROCESADA',
];

const RESULTADOS: Readonly<Record<BulkImportRowOutcome, Rotulo & { readonly plural: string }>> = {
  CREADA: { label: 'Creada', plural: 'Creadas', tone: 'success' },
  OMITIDA: { label: 'Omitida: ya existía igual', plural: 'Omitidas (ya existían)', tone: 'secondary' },
  CONFLICTO: { label: 'Conflicto: existe distinta', plural: 'Con conflicto', tone: 'warning' },
  RECHAZADA: { label: 'Rechazada', plural: 'Rechazadas', tone: 'error' },
  FALLIDA: { label: 'Fallida al escribir', plural: 'Fallidas', tone: 'error' },
  NO_PROCESADA: { label: 'No procesada', plural: 'No procesadas', tone: 'warning' },
};

export function resultadoDeFila(resultado: string | null | undefined): Rotulo & { readonly plural: string } {
  const conocido = resultado ? RESULTADOS[resultado as BulkImportRowOutcome] : undefined;
  return conocido ?? { label: resultado ?? 'Sin resultado', plural: resultado ?? 'Sin resultado', tone: 'secondary' };
}

/* -- Motivos --------------------------------------------------------------- */

const MOTIVOS: Readonly<Record<string, string>> = {
  REQUIRED: 'Falta un dato obligatorio',
  UNKNOWN_FIELD: 'Columna que no figura en la plantilla',
  INVALID_FORMAT: 'Formato inválido',
  TOO_LONG: 'Demasiado largo',
  TOO_SHORT: 'Demasiado corto',
  OUT_OF_RANGE: 'Fuera de rango',
  NOT_ALLOWED_VALUE: 'Valor no admitido',
  FIELD_COMBINATION_INVALID: 'Combinación de campos inválida',
  DUPLICATE_IN_FILE: 'Repetida en el archivo',
  COLUMN_MISSING: 'Falta una columna',
  FILE_UNREADABLE: 'No se pudo leer el archivo',
  FILE_EMPTY: 'El archivo no trae filas',
  KIND_MISMATCH: 'El archivo es de otro tipo de carga',
  PATIENT_NOT_FOUND: 'Paciente no encontrado',
  PATIENT_AMBIGUOUS: 'Más de un paciente coincide',
  CONSENT_REVOKED: 'Consentimiento revocado',
  CODE_NOT_FOUND: 'Código no encontrado',
  CODE_AMBIGUOUS: 'Código ambiguo',
  RESOLUTION_UNAVAILABLE: 'No se pudo consultar el padrón o la terminología',
  EXECUTOR_NOT_CONNECTED: 'La escritura no está conectada',
  WRITE_FAILED: 'No se pudo escribir',
  ROW_TIMEOUT: 'Se agotó el plazo de la fila',
  BATCH_TIMEOUT: 'Se agotó el plazo del lote',
  ALREADY_LOADED: 'Ya existía idéntico',
  CONTENT_CONFLICT: 'Existe con otro contenido',
};

/** El motivo dicho en pocas palabras; un código desconocido se muestra tal cual. */
export function motivoLegible(codigo: string | null | undefined): string {
  if (!codigo) return '—';
  return MOTIVOS[codigo] ?? codigo;
}

/* -- Tamaños ---------------------------------------------------------------- */

export function tamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('es-BO', { maximumFractionDigits: 1 })} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('es-BO', { maximumFractionDigits: 1 })} MB`;
}

/** Los topes dichos en una frase. */
export function frasePorLimites(limites: BulkImportLimits): string {
  return `Hasta ${limites.maxRows.toLocaleString('es-BO')} filas y ${tamano(limites.maxBytes)} por archivo.`;
}

/* -- Lo que el motor no hace -------------------------------------------------- */

/**
 * Lo que esta instalación todavía no hace, tal como lo declara `engine`. Una
 * lista vacía quiere decir que todo está conectado, no que no se sepa.
 */
export function avisosDelMotor(motor: BulkImportEngineStatus): readonly string[] {
  const avisos: string[] = [];
  if (!motor.persistence.durable) {
    avisos.push(
      `Los lotes no se guardan de forma durable (${motor.persistence.adapter}): un reinicio de la API los pierde y no se comparten entre instancias. Descargue el informe apenas termine.`,
    );
  }
  if (!motor.executors.users.connected) {
    avisos.push(
      `La escritura de altas de usuarios no está conectada (${motor.executors.users.adapter}): al confirmar, cada fila válida queda «Rechazada» y no se crea ninguna cuenta.`,
    );
  }
  if (!motor.executors.clinical.connected) {
    avisos.push(
      `La escritura en la historia clínica no está conectada (${motor.executors.clinical.adapter}): ningún registro clínico se agrega todavía.`,
    );
  }
  if (!motor.resolvers.patients.connected) {
    avisos.push(
      `No se puede enlazar a los pacientes por documento y fecha de nacimiento (${motor.resolvers.patients.adapter}): las filas de historia clínica quedan rechazadas ya en la vista previa.`,
    );
  }
  if (!motor.resolvers.codes.connected) {
    avisos.push(
      `Los códigos clínicos no se resuelven contra la terminología (${motor.resolvers.codes.adapter}): una fila con código no se puede aceptar.`,
    );
  }
  return avisos;
}

/** Qué dice, para el grupo del lote, el hecho de que su escritor no esté conectado. */
export function escritorDesconectado(motor: BulkImportEngineStatus, grupo: BulkImportGroup): boolean {
  return grupo === 'USERS' ? !motor.executors.users.connected : !motor.executors.clinical.connected;
}

/** La frase que resume el resultado de un lote ya procesado, sin decir más de lo que dice el informe. */
export function resumenDelInforme(totales: Readonly<Record<string, number>>): string {
  const total = totales['total'] ?? 0;
  const creadas = totales['CREADA'] ?? 0;
  if (total === 0) return 'El informe no trae filas.';
  if (creadas === 0) return `De ${total} fila${total === 1 ? '' : 's'}, ninguna se creó.`;
  return `De ${total} fila${total === 1 ? '' : 's'}, ${creadas} se crearon.`;
}

/* -- Errores de la API --------------------------------------------------------- */

/** Un fallo ya traducido a lo que la persona ve y puede hacer. */
export interface FalloDeCarga {
  readonly titulo: string;
  readonly texto: string;
  /** Campo de la declaración al que se ancla, si el servidor lo señaló. */
  readonly campo?: string;
  /** El identificador de la petición, para quien reporta el problema. */
  readonly requestId?: string;
}

interface CuerpoDeError {
  readonly code?: string;
  readonly reason?: string;
  readonly message?: string;
  readonly correlationId?: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

/** El `reason` del servidor: en la raíz del cuerpo, o dentro de `details`. */
export function razonDeApi(error: unknown): string | null {
  const cuerpo = cuerpoDe(error);
  if (typeof cuerpo?.reason === 'string') return cuerpo.reason;
  const dentro = cuerpo?.details?.['reason'];
  return typeof dentro === 'string' ? dentro : null;
}

function cuerpoDe(error: unknown): CuerpoDeError | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const cuerpo: unknown = error.error;
  return typeof cuerpo === 'object' && cuerpo !== null ? (cuerpo as CuerpoDeError) : null;
}

const CAMPOS_DE_DECLARACION: Readonly<Record<string, string>> = {
  reason: 'Escriba el motivo del alta.',
  sourceOrganization: 'Escriba la organización de origen de los datos.',
  legalBasis: 'Escriba la base legal que habilita la carga (al menos 3 caracteres).',
  loadedAt: 'Escriba una fecha real, de hoy o anterior.',
};

/**
 * Traduce un fallo de la API a un título, un texto y, si corresponde, el campo
 * de la declaración. Ramifica por `reason` (y por el estado cuando no hay),
 * nunca por el texto del servidor.
 */
export function falloDeCarga(error: unknown, limites?: BulkImportLimits): FalloDeCarga {
  const cuerpo = cuerpoDe(error);
  const estado = error instanceof HttpErrorResponse ? error.status : 0;
  const razon = razonDeApi(error);
  const requestId = cuerpo?.correlationId;
  const con = (titulo: string, texto: string, campo?: string): FalloDeCarga => ({
    titulo,
    texto,
    ...(campo === undefined ? {} : { campo }),
    ...(requestId === undefined ? {} : { requestId }),
  });

  if (estado === 0) {
    return con('Sin conexión', 'La petición no llegó. Lo que cargó sigue acá: reintente cuando vuelva la conexión.');
  }
  switch (razon) {
    case 'PERMISSION_REQUIRED': {
      const permiso = cuerpo?.details?.['permission'];
      return con(
        'Falta un permiso',
        `Su cuenta no tiene el permiso ${typeof permiso === 'string' ? `«${permiso}»` : 'de este tipo de carga'}. Pida a quien administra los permisos que se lo conceda y reintente: lo que cargó acá no se pierde.`,
      );
    }
    case 'FILE_TOO_LARGE':
      return con('El archivo es demasiado grande', `Pesa más de ${limites ? tamano(limites.maxBytes) : 'lo permitido'}. Divídalo en archivos más chicos.`);
    case 'ROW_LIMIT_EXCEEDED':
      return con(
        'El archivo trae demasiadas filas',
        `El tope es de ${limites ? limites.maxRows.toLocaleString('es-BO') : 'algunas miles de'} filas por lote. Divídalo en archivos más chicos.`,
      );
    case 'DECLARATION_INVALID': {
      const campo = cuerpo?.details?.['field'];
      const nombre = typeof campo === 'string' ? campo : undefined;
      return con('Revise la declaración', (nombre && CAMPOS_DE_DECLARACION[nombre]) || 'La declaración del lote no es válida.', nombre);
    }
    case 'SOURCE_AMBIGUOUS':
      return con('Falta el archivo', 'Elija un único archivo CSV o JSON para cargar.');
    case 'KIND_UNKNOWN':
      return con('Ese tipo de carga ya no existe', 'Actualice la pantalla y elija otro tipo.');
    case 'BATCH_NOT_AVAILABLE':
      return con('No encontramos ese lote', 'No existe o no es de la organización activa.');
    case 'BATCH_ALREADY_CONFIRMED':
      return con('Este lote ya se confirmó', 'Se confirmó con otra clave. Actualice para ver cómo va.');
    case 'IDEMPOTENCY_KEY_REUSED':
      return con('No se pudo confirmar', 'La clave de esta confirmación ya se usó en otro lote. Actualice la pantalla y reintente.');
    case 'BATCH_NOT_CONFIRMABLE':
      return con('Este lote no se puede confirmar', 'Sólo un lote validado se confirma. Actualice para ver su estado.');
    case 'REPORT_NOT_READY':
      return con('El informe todavía no está', 'El lote no terminó de procesarse. Vuelva a mirar en un momento.');
    case 'TENANT_REQUIRED':
      return con('Elija una organización', 'La carga masiva es de una organización: elíjala arriba y reintente.');
    default:
      break;
  }
  if (estado === 429 || cuerpo?.code === 'RATE_LIMITED') {
    return con('Demasiados intentos seguidos', 'Espere un minuto y reintente: revisar un archivo es un trabajo pesado y tiene tope por minuto.');
  }
  if (estado === 403) {
    return con('No tiene acceso', 'Su cuenta no puede usar las cargas masivas en esta organización.');
  }
  return con('No se pudo completar', 'Reintente. Lo que cargó sigue acá. Si el problema sigue, informe el código de la petición.');
}

/** Cuántas filas de la vista previa se muestran antes del aviso «y N más». */
export const FILAS_DE_VISTA_PREVIA = 50;

/** El nombre corto de un lote para listas y para el lector de pantalla. */
export function nombreDeLote(lote: Pick<BulkImportBatch, 'id' | 'kind'>, titulo: string | undefined): string {
  return `${titulo ?? lote.kind} · ${lote.id.slice(0, 8)}`;
}
