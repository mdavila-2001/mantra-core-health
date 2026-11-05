import {
  LIFECYCLE_KIND_LABELS,
  type SuspensionReasonCode,
} from '../../../core/data-access/access-governance/access-governance.types';
import type { BadgeVariant } from '../../../shared/components/atoms/badge/badge.types';

/* ============================================================================
    Las palabras del ciclo de vida del equipo (CONTRATO-GOBIERNO §6.1): casos, lista de verificación, traspaso y
    suspensión. La API habla con códigos; la persona, con frases en lenguaje simple y de usted.
   ========================================================================== */

export function caseKindLabel(kind: string): string {
  return (LIFECYCLE_KIND_LABELS as Readonly<Record<string, string>>)[kind] ?? 'Caso';
}

export function caseKindTone(kind: string): BadgeVariant {
  switch (kind) {
    case 'JOINER':
      return 'info';
    case 'MOVER':
      return 'primary';
    case 'LEAVER':
      return 'error';
    case 'SUSPENSION':
      return 'warning';
    default:
      return 'success';
  }
}

export function caseStatusLabel(status: string): string {
  switch (status) {
    case 'OPEN':
      return 'Abierto';
    case 'COMPLETED':
      return 'Completado';
    case 'CANCELLED':
      return 'Cancelado';
    default:
      return 'Sin estado';
  }
}

export function caseStatusTone(status: string): BadgeVariant {
  switch (status) {
    case 'OPEN':
      return 'warning';
    case 'COMPLETED':
      return 'success';
    default:
      return 'secondary';
  }
}

/* ---- lista de verificación -------------------------------------------------------------------------------- */

const CHECKLIST_LABELS: Readonly<Record<string, string>> = {
  IDENTITY_VERIFIED: 'Identidad verificada con documento',
  CONFIDENTIALITY_ACK: 'Compromiso de confidencialidad aceptado por la persona',
  CONFIDENTIALITY_ACKNOWLEDGED: 'Compromiso de confidencialidad aceptado por la persona',
  MFA_ENROLLED: 'Verificación en dos pasos activa',
  SUPERVISOR_ASSIGNED: 'Dueño de la cuenta asignado',
  SCOPE_REVIEWED: 'Alcance revisado sin conflictos de funciones',
  FIRST_REVIEW_SCHEDULED: 'Primera recertificación programada',
  DOCTOR_ACCEPTANCES: 'Doctores cubiertos aceptaron',
};

const CHECKLIST_HELP: Readonly<Record<string, string>> = {
  IDENTITY_VERIFIED: 'Se registra en persona o con un documento subido.',
  CONFIDENTIALITY_ACK:
    'Lo acepta la propia persona desde «Mis accesos»; usted no puede hacerlo por ella.',
  CONFIDENTIALITY_ACKNOWLEDGED:
    'Lo acepta la propia persona desde «Mis accesos»; usted no puede hacerlo por ella.',
  MFA_ENROLLED: 'Se completa solo cuando la persona activa la verificación en dos pasos.',
  SUPERVISOR_ASSIGNED: 'Elija quién será responsable de esta cuenta.',
  SCOPE_REVIEWED: 'Se completa solo si no hay conflictos de funciones sin excepción.',
  FIRST_REVIEW_SCHEDULED: 'Se completa solo al programar la primera recertificación.',
  DOCTOR_ACCEPTANCES: 'Informativo: cada doctor nombrado acepta a la persona una vez.',
};

/** El rótulo en lenguaje simple de un paso; si el código no se conoce, el que mande la API. */
export function checklistLabel(code: string, serverLabel: string): string {
  return CHECKLIST_LABELS[code] ?? (serverLabel === '' ? code : serverLabel);
}

/** Cómo se completa un paso, en una frase. */
export function checklistHelp(code: string): string {
  return CHECKLIST_HELP[code] ?? '';
}

export const IDENTITY_METHOD_OPTIONS = [
  { value: 'IN_PERSON', label: 'En persona' },
  { value: 'DOCUMENT_UPLOAD', label: 'Con un documento subido' },
] as const;

/* ---- traspaso ------------------------------------------------------------------------------------------------ */

interface HandoverKindText {
  readonly one: string;
  readonly many: string;
  readonly help: string;
}

const HANDOVER_KINDS: Readonly<Record<string, HandoverKindText>> = {
  CONVERSATION: {
    one: 'conversación',
    many: 'conversaciones',
    help: 'Pasan a quien elija, o vuelven a la bandeja común.',
  },
  TASK: {
    one: 'tarea abierta',
    many: 'tareas abiertas',
    help: 'Pasan a quien elija, o quedan por rol.',
  },
  PENDING_APPOINTMENT: {
    one: 'cita pendiente',
    many: 'citas pendientes',
    help: 'Las citas se mantienen; elija quién les da seguimiento.',
  },
  SUPERVISED_ACCOUNT: {
    one: 'cuenta que supervisaba',
    many: 'cuentas que supervisaba',
    help: 'Es obligatorio elegir un nuevo dueño.',
  },
};

const KIND_ALIASES: Readonly<Record<string, string>> = {
  WORKFLOW_TASK: 'TASK',
  PENDING_BOOKING: 'PENDING_APPOINTMENT',
  SUPERVISED_ENGAGEMENT: 'SUPERVISED_ACCOUNT',
  HANDOVER_CONVERSATION: 'CONVERSATION',
  HANDOVER_WORKFLOW_TASK: 'TASK',
  HANDOVER_SUPERVISED_ENGAGEMENT: 'SUPERVISED_ACCOUNT',
  HANDOVER_PENDING_BOOKING: 'PENDING_APPOINTMENT',
};

/** Normaliza el tipo de traspaso: la API usa `HANDOVER_*`, el mock los nombres cortos. */
export function handoverKindOf(kind: string): string {
  return KIND_ALIASES[kind] ?? kind;
}

export function handoverKindText(kind: string, count = 1): string {
  const text = HANDOVER_KINDS[handoverKindOf(kind)];
  if (text === undefined) return count === 1 ? 'elemento' : 'elementos';
  return count === 1 ? text.one : text.many;
}

export function handoverKindHelp(kind: string): string {
  return HANDOVER_KINDS[handoverKindOf(kind)]?.help ?? '';
}

/** Los tipos de traspaso que no son cuentas supervisadas (se reasignan a una persona o a la bandeja común). */
export function isSupervisedKind(kind: string): boolean {
  return handoverKindOf(kind) === 'SUPERVISED_ACCOUNT';
}

function stripHandoverPrefix(status: string): string {
  return status.startsWith('HANDOVER_') ? status.slice('HANDOVER_'.length) : status;
}

export function handoverStatusLabel(status: string): string {
  switch (stripHandoverPrefix(status)) {
    case 'PENDING':
      return 'Pendiente';
    case 'REASSIGNED':
      return 'Reasignado';
    case 'RETURNED_TO_POOL':
      return 'Devuelto a la bandeja común';
    case 'CLOSED':
      return 'Cerrado';
    default:
      return 'Sin estado';
  }
}

export function handoverStatusTone(status: string): BadgeVariant {
  switch (stripHandoverPrefix(status)) {
    case 'PENDING':
      return 'warning';
    case 'REASSIGNED':
      return 'success';
    default:
      return 'secondary';
  }
}

export function isHandoverPending(status: string): boolean {
  return stripHandoverPrefix(status) === 'PENDING';
}

/* ---- cuentas sin dueño ------------------------------------------------------------------------------------- */

const OWNERLESS_REASONS: Readonly<Record<string, string>> = {
  NO_OWNER: 'Nadie es responsable de esta cuenta.',
  OWNER_ENDED: 'Su responsable ya no está en la organización.',
  OWNER_NOT_ELIGIBLE: 'Su responsable ya no puede serlo.',
  ONLY_UNASSIGNED_DOCTORS: 'Solo cubre a doctores sin asignación vigente.',
};

export function ownerlessReasonText(reasons: readonly string[]): string {
  const known = reasons
    .map((r) => OWNERLESS_REASONS[r])
    .filter((t): t is string => t !== undefined);
  return known.length > 0 ? known.join(' ') : 'Falta asignar un responsable de la cuenta.';
}

/* ---- suspensión -------------------------------------------------------------------------------------------- */

export const SUSPENSION_REASON_OPTIONS: readonly {
  readonly value: SuspensionReasonCode;
  readonly label: string;
  readonly description: string;
}[] = [
  {
    value: 'MANUAL',
    label: 'Decisión de la administración',
    description: 'Corta el acceso por ahora; los permisos quedan guardados.',
  },
  {
    value: 'LEAVE',
    label: 'Licencia o ausencia',
    description: 'La persona no trabajará por un tiempo.',
  },
  {
    value: 'INVESTIGATION',
    label: 'Investigación',
    description: 'Solo el administrador de seguridad puede reactivarla.',
  },
  { value: 'INACTIVITY', label: 'Inactividad', description: 'No usa su acceso hace tiempo.' },
];

/* ---- plazos ------------------------------------------------------------------------------------------------- */

/** «Vence en 6 días», «Vence hoy», «Venció hace 2 días». El estado va en texto además del color. */
export function dueText(
  dueAt: string | undefined,
  now: Date = new Date(),
): { readonly text: string; readonly overdue: boolean } {
  if (dueAt === undefined) return { text: 'Sin plazo', overdue: false };
  const date = new Date(dueAt);
  if (Number.isNaN(date.getTime())) return { text: 'Sin plazo', overdue: false };
  // Días de calendario (no de 24 horas): lo que vence esta noche «vence hoy».
  const startOfDay = (d: Date): number =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
  if (days < 0)
    return { text: days === -1 ? 'Venció ayer' : `Venció hace ${-days} días`, overdue: true };
  if (days === 0) return { text: 'Vence hoy', overdue: false };
  return { text: days === 1 ? 'Vence mañana' : `Vence en ${days} días`, overdue: false };
}
