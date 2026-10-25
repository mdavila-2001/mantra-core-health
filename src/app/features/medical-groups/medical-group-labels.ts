import type { BadgeVariant } from '../../shared/components/atoms/badge/badge.types';
import type {
  InvitationStatus,
  MedicalGroupStatus,
  MedicalGroupTab,
} from '../../core/data-access/medical-groups/medical-groups.types';

/** Cómo se llama cada estado del grupo ante la persona, y con qué tono se dibuja. */
export const STATUS_LABEL: Readonly<Record<MedicalGroupStatus, string>> = {
  PENDING_TEAM: 'Esperando al equipo',
  SCHEDULED: 'Programado',
  RESCHEDULE_PENDING: 'Cambio de horario por resolver',
  CLOSED: 'Cerrado',
};

export const STATUS_TONE: Readonly<Record<MedicalGroupStatus, BadgeVariant>> = {
  PENDING_TEAM: 'warning',
  SCHEDULED: 'success',
  RESCHEDULE_PENDING: 'info',
  CLOSED: 'secondary',
};

export const INVITATION_LABEL: Readonly<Record<InvitationStatus, string>> = {
  PENDING: 'Sin responder',
  ACCEPTED: 'Aceptó',
  REJECTED: 'Rechazó',
};

export const INVITATION_TONE: Readonly<Record<InvitationStatus, BadgeVariant>> = {
  PENDING: 'warning',
  ACCEPTED: 'success',
  REJECTED: 'error',
};

/** Las pestañas del listado, en el orden en que se dibujan. */
export const LIST_TABS: readonly { readonly id: MedicalGroupTab; readonly label: string }[] = [
  { id: 'historico', label: 'Histórico' },
  { id: 'enviadas', label: 'Solicitudes enviadas' },
  { id: 'recibidas', label: 'Solicitudes recibidas' },
];

/** Texto legible de un estado que la API pueda agregar mañana: nunca se esconde. */
export function statusLabel(status: string): string {
  return STATUS_LABEL[status as MedicalGroupStatus] ?? status;
}

export function statusTone(status: string): BadgeVariant {
  return STATUS_TONE[status as MedicalGroupStatus] ?? 'secondary';
}
