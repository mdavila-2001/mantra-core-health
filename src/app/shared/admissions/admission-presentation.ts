import {
  ADMISSION_STATUS_LABELS,
  REASON_CODE_LABELS,
  SOURCE_TYPE_LABELS,
  type AdmissionRequirement,
  type AdmissionStatusCode,
  type ReasonCode,
  type RequirementStateCode,
  type RequirementsSummary,
  type SourceTypeCode,
} from '@core/data-access/admissions/admissions.types';
import type { BadgeVariant } from '../components/atoms/badge/badge.types';

/* ============================================================================
    Cómo se dicen y se pintan las admisiones.

    Un solo lugar para el bloque de admin (bandeja, ficha) y para la tarjeta del
    médico: dos pantallas que nombraran distinto un mismo estado confundirían a
    quien habla con soporte. El estado SIEMPRE lleva texto: el color solo no
    alcanza (accesibilidad), el badge ya trae el rótulo.
    ========================================================================== */

/** Largo del motivo que acepta la API. */
export const ADMISSION_REASON_MIN = 5;
export const ADMISSION_REASON_MAX = 500;
/** Largo de la referencia de una fuente (número de comprobante, dirección…). */
export const ADMISSION_SOURCE_MAX = 300;
/** Largo de la nota interna. */
export const ADMISSION_NOTE_MAX = 500;

/** Cuántos días hábiles tiene el equipo para resolver una admisión. */
export const ADMISSION_SLA_BUSINESS_DAYS = 3;

export function statusLabel(code: string): string {
  return (ADMISSION_STATUS_LABELS as Record<string, string>)[code] ?? code;
}

export function admissionStatusVariant(code: string): BadgeVariant {
  switch (code as AdmissionStatusCode) {
    case 'SUBMITTED':
      return 'info';
    case 'IN_REVIEW':
      return 'primary';
    case 'INFO_REQUESTED':
    case 'SUSPENDED':
      return 'warning';
    case 'VERIFIED':
      return 'success';
    case 'REJECTED':
      return 'error';
    default:
      return 'secondary';
  }
}

/** El orden de las pestañas de la bandeja: primero lo que espera a una persona. */
export const ADMISSION_STATUS_TABS: readonly { readonly code: AdmissionStatusCode; readonly label: string }[] = [
  { code: 'SUBMITTED', label: 'Enviadas' },
  { code: 'IN_REVIEW', label: 'En revisión' },
  { code: 'INFO_REQUESTED', label: 'Información requerida' },
  { code: 'VERIFIED', label: 'Verificadas' },
  { code: 'REJECTED', label: 'Rechazadas' },
  { code: 'SUSPENDED', label: 'Suspendidas' },
  { code: 'EXPIRED', label: 'Verificación vencida' },
  { code: 'ABANDONED', label: 'Abandonadas' },
  { code: 'WITHDRAWN', label: 'Retiradas' },
];

export const REQUIREMENT_STATUS_LABEL: Readonly<Record<RequirementStateCode, string>> = {
  PENDING: 'Pendiente',
  VERIFIED: 'Verificado',
  REJECTED: 'Rechazado',
  INFO_REQUIRED: 'Información requerida',
  NOT_PROVIDED: 'No aportado',
  MISSING: 'Falta',
};

export function requirementStatusLabel(code: string | null): string {
  return code === null ? 'Sin revisar' : (REQUIREMENT_STATUS_LABEL[code as RequirementStateCode] ?? code);
}

export function requirementStatusVariant(code: string | null): BadgeVariant {
  switch (code as RequirementStateCode | null) {
    case 'VERIFIED':
      return 'success';
    case 'REJECTED':
    case 'MISSING':
      return 'error';
    case 'INFO_REQUIRED':
      return 'warning';
    default:
      return 'secondary';
  }
}

/** Quien revisa solo puede actuar sobre una admisión que sigue en revisión. */
export function isInReview(code: string): boolean {
  return code === 'IN_REVIEW';
}

/* ---- avance ----------------------------------------------------------------- */

/** «5 de 7 requisitos verificados, 1 rechazado». */
export function progressText(summary: RequirementsSummary): string {
  if (summary.total === 0) return 'Sin requisitos cargados';
  const partes = [
    `${summary.verified} de ${summary.total} ${summary.total === 1 ? 'requisito verificado' : 'requisitos verificados'}`,
  ];
  if (summary.rejected > 0) {
    partes.push(`${summary.rejected} ${summary.rejected === 1 ? 'rechazado' : 'rechazados'}`);
  }
  return partes.join(', ');
}

/** Los requisitos obligatorios que todavía no se dan por cumplidos. */
export function missingMandatory(requirements: readonly AdmissionRequirement[]): readonly AdmissionRequirement[] {
  return requirements.filter((r) => r.mandatory && !r.satisfied);
}

/** Cómo se dice por qué un requisito bloquea la verificación. */
export const BLOCKER_REASON_LABEL: Readonly<Record<string, string>> = {
  MISSING: 'no se aportó',
  REJECTED: 'está rechazado',
  PENDING: 'espera su revisión',
  INFO_REQUIRED: 'espera lo que se pidió al médico',
  BELOW_MINIMUM: 'no llega al mínimo de documentos',
};

export function blockerText(blocker: { readonly label: string; readonly reason: string }): string {
  return `${blocker.label}: ${BLOCKER_REASON_LABEL[blocker.reason] ?? blocker.reason}`;
}

/* ---- validación de los formularios de decisión ------------------------------- */

export function reasonError(value: string): string | null {
  const limpio = value.trim();
  if (limpio.length === 0) return 'Escriba el motivo.';
  if (limpio.length < ADMISSION_REASON_MIN) {
    return `El motivo necesita al menos ${ADMISSION_REASON_MIN} caracteres.`;
  }
  if (limpio.length > ADMISSION_REASON_MAX) {
    return `El motivo admite hasta ${ADMISSION_REASON_MAX} caracteres (sobran ${limpio.length - ADMISSION_REASON_MAX}).`;
  }
  return null;
}

export function sourceTypeLabel(code: string): string {
  return (SOURCE_TYPE_LABELS as Record<string, string>)[code] ?? code;
}

export function reasonCodeLabel(code: string | null): string {
  return code === null ? '' : ((REASON_CODE_LABELS as Record<string, string>)[code] ?? code);
}

/**
 * La fuente declarada al verificar. El tipo es obligatorio; la referencia es
 * opcional —no todas las fuentes tienen una dirección—, salvo en «Otra
 * fuente», donde sin ella no se sabría de dónde salió el dato.
 */
export function sourceError(type: SourceTypeCode | '', ref: string): string | null {
  if (type === '') return 'Elija de dónde obtuvo el dato.';
  const limpio = ref.trim();
  if (type === 'OTHER' && limpio === '') return 'Describa la fuente que consultó.';
  if (limpio.length > ADMISSION_SOURCE_MAX) {
    return `La referencia admite hasta ${ADMISSION_SOURCE_MAX} caracteres.`;
  }
  return null;
}

export function reasonCodeError(code: ReasonCode | ''): string | null {
  return code === '' ? 'Elija el motivo.' : null;
}

export function noteError(value: string): string | null {
  return value.trim().length > ADMISSION_NOTE_MAX
    ? `La nota admite hasta ${ADMISSION_NOTE_MAX} caracteres.`
    : null;
}

/** La fecha de hoy como `YYYY-MM-DD`, en la hora local, para la fecha de consulta. */
export function todayIso(now: Date = new Date()): string {
  const mes = String(now.getMonth() + 1).padStart(2, '0');
  const dia = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${mes}-${dia}`;
}

/* ---- formato ------------------------------------------------------------------ */

/** Los primeros caracteres de una huella, para leerla sin ocupar la pantalla. */
export function shortHash(hash: string | null): string {
  return hash === null || hash === '' ? 'Sin huella' : `${hash.slice(0, 12)}…`;
}

export function formatBytes(bytes: number | null): string {
  if (bytes === null) return 'Tamaño desconocido';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toLocaleString('es-BO', { maximumFractionDigits: 0 })} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString('es-BO', { maximumFractionDigits: 1 })} MB`;
}

export function mimeLabel(mime: string | null): string {
  if (mime === null || mime === '') return 'Tipo desconocido';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('image/')) return `Imagen ${mime.slice(6).toUpperCase()}`;
  return mime;
}

/* ---- lo que ve el médico --------------------------------------------------------- */

export interface DoctorStatusCopy {
  readonly title: string;
  readonly detail: string;
  /** Si puede corregir y reenviar. */
  readonly canResubmit: boolean;
}

/**
 * Qué le decimos al médico en cada estado. Solo hechos de su solicitud: no se
 * promete un plazo que la API no dio (el plazo viaja en `dueAt`).
 */
export function doctorStatusCopy(code: string): DoctorStatusCopy {
  switch (code as AdmissionStatusCode) {
    case 'SUBMITTED':
      return {
        title: 'Recibimos su solicitud',
        detail: 'Una persona del equipo la va a revisar. Mientras tanto, su perfil aparece con la insignia «Matrícula en revisión».',
        canResubmit: false,
      };
    case 'IN_REVIEW':
      return {
        title: 'Su solicitud está en revisión',
        detail: 'Estamos contrastando su matrícula y sus títulos con las fuentes oficiales. Le avisaremos cuando haya una decisión.',
        canResubmit: false,
      };
    case 'INFO_REQUESTED':
      return {
        title: 'Necesitamos más información',
        detail: 'El equipo de revisión le pidió completar lo que se indica abajo. Corríjalo y reenvíe la solicitud.',
        canResubmit: true,
      };
    case 'VERIFIED':
      return {
        title: 'Su matrícula está verificada',
        detail: 'La revisión terminó. No tiene nada pendiente.',
        canResubmit: false,
      };
    case 'REJECTED':
      return {
        title: 'No pudimos verificar su solicitud',
        detail: 'Revise el motivo, corrija lo que haga falta y reenvíe la solicitud para que se revise de nuevo.',
        canResubmit: true,
      };
    case 'SUSPENDED':
      return {
        title: 'Su verificación está suspendida',
        detail: 'Mientras dure la suspensión no se muestra su verificación. Escriba al equipo de soporte para conocer los pasos a seguir.',
        canResubmit: false,
      };
    case 'EXPIRED':
      return {
        title: 'Su verificación venció',
        detail: 'La vigencia de su verificación terminó. Corrija lo que haga falta y reenvíe la solicitud para renovarla.',
        canResubmit: true,
      };
    case 'ABANDONED':
      return {
        title: 'Su solicitud se cerró por falta de respuesta',
        detail: 'No recibimos la información que se le pidió dentro del plazo. Puede reenviar su solicitud cuando la tenga.',
        canResubmit: true,
      };
    case 'WITHDRAWN':
      return {
        title: 'Su solicitud fue retirada',
        detail: 'Esta solicitud ya no está en curso.',
        canResubmit: false,
      };
    default:
      return { title: 'Estado de su verificación', detail: '', canResubmit: false };
  }
}
