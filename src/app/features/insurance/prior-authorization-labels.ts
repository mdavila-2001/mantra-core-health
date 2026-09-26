import type {
  PriorAuthorizationDecision,
  PriorAuthorizationOrigin,
  PriorAuthorizationPatient,
  PriorAuthorizationStatus,
} from '../../core/data-access/insurance/prior-authorization.types';
import type { Tone } from '../../shared/components/tone/tone.types';
import { withDisplayCurrency } from '../../core/money/display-currency';

/**
 * Rótulos de las solicitudes de aprobación, compartidos por la bandeja y el
 * detalle: una solicitud tiene que decir lo mismo en los dos lados.
 */

const ORIGEN: Readonly<Record<PriorAuthorizationOrigin, string>> = {
  PHARMACY: 'Receta médica',
  DIAGNOSTIC: 'Laboratorio o imagen',
  GENERIC: 'Otra prestación',
};

const DECISION: Readonly<Record<PriorAuthorizationDecision, { label: string; tone: Tone }>> = {
  APPROVED: { label: 'Aprobada', tone: 'success' },
  PARTIAL: { label: 'Aprobación parcial', tone: 'warning' },
  DENIED: { label: 'No aprobada', tone: 'error' },
};

export function originLabel(origin: PriorAuthorizationOrigin): string {
  return ORIGEN[origin];
}

/**
 * El estado que se lee: mientras no hay decisión, «Pendiente»; después, la
 * decisión global (aprobada, parcial, no aprobada).
 */
export function statusBadge(
  status: PriorAuthorizationStatus,
  decision: PriorAuthorizationDecision | null,
): { label: string; tone: Tone } {
  if (status !== 'DETERMINED' || decision === null) {
    return { label: 'Pendiente', tone: 'info' };
  }
  return DECISION[decision];
}

export function patientName(patient: PriorAuthorizationPatient): string {
  return patient.displayName ?? patient.patientCode ?? 'Paciente sin nombre registrado';
}

/** Importe con su moneda visible, o el texto de la ausencia. Nunca suma. */
export function amountText(amount: string | null, currencyCode: string | null): string {
  if (amount === null) return 'Sin importe';
  return currencyCode === null ? amount : withDisplayCurrency(amount, currencyCode);
}
