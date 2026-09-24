import type { Tone } from '../../../shared/components/tone/tone.types';

/* ============================================================================
    Rótulos y tonos del portal administrativo.

    Traducen los códigos que devuelve la API a texto y a color. No deciden
    nada: si un código es nuevo y no está acá, se muestra el código tal cual con
    tono neutro, en vez de inventarle un significado.
    ========================================================================== */

export interface Rotulo {
  readonly label: string;
  readonly tone: Tone;
}

const NEUTRO = (code: string): Rotulo => ({ label: code, tone: 'secondary' });

function tabla(entradas: Readonly<Record<string, Rotulo>>) {
  return (code: string | null | undefined): Rotulo =>
    code ? (entradas[code] ?? NEUTRO(code)) : { label: 'Sin dato', tone: 'secondary' };
}

export const reviewStatus = tabla({
  DRAFT: { label: 'Borrador', tone: 'secondary' },
  NEEDS_REVIEW: { label: 'En revisión', tone: 'warning' },
  APPROVED: { label: 'Aprobada', tone: 'success' },
  REJECTED: { label: 'Rechazada', tone: 'error' },
});

export const observationStatus = tabla({
  OBSERVED: { label: 'Observada', tone: 'success' },
  NOT_OBSERVED: { label: 'No observada', tone: 'warning' },
  RETIRED: { label: 'Retirada', tone: 'secondary' },
});

export const scanStatus = tabla({
  QUEUED: { label: 'En cola', tone: 'info' },
  RUNNING: { label: 'En curso', tone: 'info' },
  SUCCEEDED: { label: 'Terminado', tone: 'success' },
  FAILED: { label: 'Fallido', tone: 'error' },
  CANCELLED: { label: 'Cancelado', tone: 'secondary' },
});

export const planStatus = tabla({
  PENDING_APPROVAL: { label: 'Esperando aprobación', tone: 'warning' },
  QUEUED: { label: 'En cola', tone: 'info' },
  RUNNING: { label: 'En ejecución', tone: 'info' },
  PASSED: { label: 'Aprobado', tone: 'success' },
  FAILED: { label: 'Con fallos', tone: 'error' },
  TIMED_OUT: { label: 'Sin tiempo', tone: 'warning' },
  CANCELLED: { label: 'Cancelado', tone: 'secondary' },
  INFRA_ERROR: { label: 'Error de infraestructura', tone: 'warning' },
  REJECTED: { label: 'Rechazado', tone: 'secondary' },
});

export const controlStatus = tabla({
  PASS: { label: 'Cumple', tone: 'success' },
  FAIL: { label: 'No cumple', tone: 'error' },
  UNKNOWN: { label: 'Sin evidencia', tone: 'warning' },
  NOT_APPLICABLE: { label: 'No aplica', tone: 'secondary' },
});

export const readinessStatus = tabla({
  READY: { label: 'Lista para producción', tone: 'success' },
  NOT_READY: { label: 'No está lista', tone: 'error' },
  BLOCKED_BY_UNKNOWN: { label: 'Bloqueada por falta de evidencia', tone: 'warning' },
});

/** Resultados del laboratorio y de operación, por código de concepto. */
export const conceptStatus = tabla({
  RUN_PASSED: { label: 'Aprobada', tone: 'success' },
  RUN_FAILED_STATUS: { label: 'Con fallos', tone: 'error' },
  RUN_QUEUED: { label: 'En cola', tone: 'info' },
  RUN_IN_PROGRESS: { label: 'En curso', tone: 'info' },
  RESULT_PASSED: { label: 'Pasó', tone: 'success' },
  RESULT_FAILED: { label: 'Falló', tone: 'error' },
  RESULT_SKIPPED: { label: 'Omitido', tone: 'secondary' },
  DEFECT_OPEN: { label: 'Abierto', tone: 'error' },
  DEFECT_TRIAGED: { label: 'Clasificado', tone: 'warning' },
  DEFECT_IN_PROGRESS: { label: 'En curso', tone: 'info' },
  DEFECT_RESOLVED: { label: 'Resuelto', tone: 'success' },
  DEF_SEV_CRITICAL: { label: 'Crítico', tone: 'error' },
  DEF_SEV_HIGH: { label: 'Alto', tone: 'error' },
  DEF_SEV_MEDIUM: { label: 'Medio', tone: 'warning' },
  DEF_SEV_LOW: { label: 'Bajo', tone: 'secondary' },
  INC_OPEN: { label: 'Abierto', tone: 'error' },
  INC_ACK: { label: 'Reconocido', tone: 'warning' },
  INC_MITIGATED: { label: 'Mitigado', tone: 'info' },
  INC_RESOLVED: { label: 'Resuelto', tone: 'success' },
  INC_SEV1: { label: 'SEV1 · crítico', tone: 'error' },
  INC_SEV2: { label: 'SEV2 · alto', tone: 'error' },
  INC_SEV3: { label: 'SEV3 · medio', tone: 'warning' },
  INC_SEV4: { label: 'SEV4 · bajo', tone: 'secondary' },
  DEP_SUCCEEDED: { label: 'Exitoso', tone: 'success' },
  DEP_FAILED: { label: 'Fallido', tone: 'error' },
  DEP_IN_PROGRESS: { label: 'En curso', tone: 'info' },
  DEP_PENDING: { label: 'Pendiente', tone: 'info' },
  DEP_ROLLED_BACK: { label: 'Revertido', tone: 'warning' },
  OPS_ENV_PRD: { label: 'Producción', tone: 'primary' },
  OPS_ENV_STG: { label: 'Staging', tone: 'secondary' },
  OPS_ENV_DEV: { label: 'Desarrollo', tone: 'secondary' },
  SLO_PASS: { label: 'Cumple', tone: 'success' },
  SLO_WARN: { label: 'En riesgo', tone: 'warning' },
  SLO_FAIL: { label: 'Incumple', tone: 'error' },
});

export const SENSITIVITY_OPTIONS = [
  { value: 'UNKNOWN', label: 'Sin determinar' },
  { value: 'NONE', label: 'No sensible' },
  { value: 'INTERNAL', label: 'Interna' },
  { value: 'PII', label: 'Datos personales (PII)' },
  { value: 'PHI', label: 'Datos de salud (PHI)' },
  { value: 'SECRET', label: 'Secreto' },
] as const;

export const sensitivityLabel = (code: string | null | undefined) =>
  SENSITIVITY_OPTIONS.find((o) => o.value === code)?.label ?? 'Sin determinar';

/**
 * Un ratio del servidor como porcentaje. `null` (0/0 o sin medición) nunca se
 * muestra como 0 %: dice por qué no hay número.
 */
export function porcentaje(ratio: number | null, estado?: string): string {
  if (estado === 'UNKNOWN') return 'Sin medición';
  if (estado === 'NOT_APPLICABLE' || ratio === null) return 'No aplica';
  return `${(ratio * 100).toLocaleString('es-BO', { maximumFractionDigits: 1 })} %`;
}

/** Enteros con separador de miles, o guion si el servidor no lo sabe. */
export function entero(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === '') return '—';
  return Number(valor).toLocaleString('es-BO');
}

/** Clave de idempotencia por intento del usuario (un doble clic reutiliza la misma). */
export function claveIdempotente(prefijo: string): string {
  return `${prefijo}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Error HTTP leído con su código estable; ramificar por `code`, nunca por `message`. */
export interface ErrorDeApi {
  readonly status: number;
  readonly code: string | null;
  readonly message: string | null;
  readonly details: Readonly<Record<string, unknown>> | null;
}

export function errorDeApi(error: unknown): ErrorDeApi {
  const e = error as { status?: number; error?: unknown };
  const body = (e?.error ?? null) as { code?: unknown; message?: unknown; details?: unknown } | null;
  return {
    status: typeof e?.status === 'number' ? e.status : 0,
    code: typeof body?.code === 'string' ? body.code : null,
    message: typeof body?.message === 'string' ? body.message : null,
    details:
      body?.details && typeof body.details === 'object'
        ? (body.details as Record<string, unknown>)
        : null,
  };
}
