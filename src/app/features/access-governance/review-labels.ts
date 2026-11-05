import type { AtomSensitivity } from '../../core/data-access/support-access/support-atoms';
import type {
  CampaignScopeKind,
  CampaignStatus,
  ReviewerKind,
  ReviewItemState,
  UncertifiedAction,
} from '../../core/data-access/access-governance/access-reviews.types';
import type { BadgeVariant } from '../../shared/components/atoms/badge/badge.types';

/* ============================================================================
    Palabras de las campañas de certificación y de la bandeja del revisor (CONTRATO-GOBIERNO §6.2, §9.3).

    La API habla con códigos; la persona, con frases. Nada acá depende del color: cada estado trae su texto, y el tono
    solo acompaña. Un código que la API agregue después y la pantalla aún no conozca se muestra con una palabra neutra,
    nunca con el código crudo.
   ========================================================================== */

const RISK_WORD: Readonly<Record<AtomSensitivity, string>> = {
  LOW: 'bajo',
  MEDIUM: 'medio',
  HIGH: 'alto',
  CRITICAL: 'crítico',
};

/** «Riesgo alto»: la sensibilidad máxima de lo que se revisa, dicha en palabras. */
export function sensitivityRisk(sensitivity: AtomSensitivity | string | undefined): string {
  const palabra = sensitivity === undefined ? undefined : RISK_WORD[sensitivity as AtomSensitivity];
  return palabra === undefined ? 'Riesgo sin clasificar' : `Riesgo ${palabra}`;
}

export function sensitivityTone(sensitivity: AtomSensitivity | string | undefined): BadgeVariant {
  switch (sensitivity) {
    case 'LOW':
      return 'success';
    case 'MEDIUM':
      return 'info';
    case 'HIGH':
      return 'warning';
    case 'CRITICAL':
      return 'error';
    default:
      return 'secondary';
  }
}

export function campaignStatusText(status: CampaignStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Borrador';
    case 'OPEN':
      return 'Abierta';
    case 'CLOSED':
      return 'Cerrada';
    case 'CANCELLED':
      return 'Cancelada';
  }
}

export function campaignStatusTone(status: CampaignStatus): BadgeVariant {
  switch (status) {
    case 'DRAFT':
      return 'secondary';
    case 'OPEN':
      return 'info';
    case 'CLOSED':
      return 'success';
    case 'CANCELLED':
      return 'warning';
  }
}

export function scopeKindText(kind: CampaignScopeKind): string {
  switch (kind) {
    case 'ORGANIZATION':
      return 'Toda la organización';
    case 'PRACTITIONER':
      return 'Doctores elegidos';
    case 'SERVICE':
      return 'Servicios elegidos';
    case 'LOCATION':
      return 'Ubicaciones elegidas';
    case 'TEMPLATE':
      return 'Roles elegidos';
  }
}

export function uncertifiedActionText(action: UncertifiedAction): string {
  return action === 'UNCERTIFIED_REVOKE'
    ? 'Lo que nadie certifique a tiempo se quita automáticamente al cerrar la campaña.'
    : 'Lo que nadie certifique a tiempo no cambia: se escala y la campaña se cierra a mano.';
}

const REVIEWER_TEXT: Readonly<Record<string, string>> = {
  ADMIN: 'Administración de seguridad',
  DOCTOR_OWNER: 'Doctor responsable',
  SERVICE_HEAD: 'Jefatura del servicio',
  SUPERVISOR: 'Responsable de la cuenta',
};

/** Quién revisa, en palabras. */
export function reviewerKindText(kind: ReviewerKind): string {
  return REVIEWER_TEXT[kind] ?? 'Otro revisor';
}

const STATE_TEXT: Readonly<Record<string, string>> = {
  PENDING: 'Pendiente',
  CERTIFIED: 'Mantenido',
  REVOKED: 'Quitado',
  ADJUSTED: 'Ajustado',
  AUTO_REVOKED: 'Quitado por no revisarse',
  SKIPPED: 'Omitido',
};

export function itemStateText(state: ReviewItemState): string {
  return STATE_TEXT[state] ?? 'En revisión';
}

export function itemStateTone(state: ReviewItemState): BadgeVariant {
  switch (state) {
    case 'PENDING':
      return 'warning';
    case 'CERTIFIED':
      return 'success';
    case 'REVOKED':
    case 'AUTO_REVOKED':
      return 'error';
    case 'ADJUSTED':
      return 'info';
    default:
      return 'secondary';
  }
}

export interface DueCounter {
  readonly text: string;
  readonly overdue: boolean;
}

const DAY_MS = 86_400_000;

/** «Vence en 5 días» / «Venció hace 4 días»: el contador que acompaña a cada plazo. Cuenta días de calendario. */
export function dueCounter(dueAt: string, now: Date = new Date()): DueCounter {
  const due = new Date(dueAt);
  if (Number.isNaN(due.getTime())) return { text: 'Sin fecha de vencimiento', overdue: false };
  const startOf = (d: Date): number =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(due) - startOf(now)) / DAY_MS);
  if (days === 0) return { text: 'Vence hoy', overdue: false };
  if (days === 1) return { text: 'Vence mañana', overdue: false };
  if (days > 1) return { text: `Vence en ${days} días`, overdue: false };
  if (days === -1) return { text: 'Venció ayer', overdue: true };
  return { text: `Venció hace ${-days} días`, overdue: true };
}
