import type { BadgeVariant } from '../../shared/components/atoms/badge/badge.types';
import type {
  InvitationStatus,
  MedicalGroupStatus,
} from '../../core/data-access/medical-groups/medical-groups.types';

/**
 * Cómo se dice cada estado del grupo en pantalla. Un solo lugar para el
 * listado y la consulta: dos traducciones del mismo estado terminan diciendo
 * cosas distintas.
 */
export const GROUP_STATUS_LABEL: Readonly<
  Record<MedicalGroupStatus, { readonly label: string; readonly variant: BadgeVariant }>
> = {
  PENDING_TEAM: { label: 'Esperando al equipo', variant: 'warning' },
  SCHEDULED: { label: 'Programado', variant: 'success' },
  RESCHEDULE_PENDING: { label: 'Cambio de horario por confirmar', variant: 'warning' },
  CLOSED: { label: 'Cerrado', variant: 'secondary' },
};

export const INVITATION_STATUS_LABEL: Readonly<
  Record<InvitationStatus, { readonly label: string; readonly variant: BadgeVariant }>
> = {
  PENDING: { label: 'Sin responder', variant: 'warning' },
  ACCEPTED: { label: 'Aceptó', variant: 'success' },
  REJECTED: { label: 'Rechazó', variant: 'error' },
};

export const DATE_TIME_FORMAT = new Intl.DateTimeFormat('es-BO', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const AMOUNT_FORMAT = new Intl.NumberFormat('es-BO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `"1500.00"` → `"1.500,00"`. El monto viaja como texto decimal y se muestra así. */
export function formatAmount(amount: string): string {
  const value = Number(amount);
  return Number.isFinite(value) ? AMOUNT_FORMAT.format(value) : amount;
}
