import type {
  PrivacyJurisdiction,
  PrivacyStatus,
  PrivacyType,
} from '../../../../core/data-access/admin-portal/privacy-requests.types';
import {
  PRIVACY_JURISDICTIONS,
  PRIVACY_TYPES,
} from '../../../../core/data-access/admin-portal/privacy-requests.types';
import type { SelectOption } from '../../../../shared/components/atoms/select/select.types';
import type { Rotulo } from '../../platform/platform-labels';

/* ============================================================================
    Rótulos de las solicitudes de privacidad. Un código que la API no pudo
    reconocer llega como `null` y se dice así.
    ========================================================================== */

const STATUS: Readonly<Record<PrivacyStatus, Rotulo>> = {
  RECEIVED: { label: 'Recibida', tone: 'warning' },
  IN_PROGRESS: { label: 'En curso', tone: 'info' },
  COMPLETED: { label: 'Completada', tone: 'success' },
  REJECTED: { label: 'Rechazada', tone: 'secondary' },
};

const TYPE: Readonly<Record<PrivacyType, string>> = {
  ACCESS: 'Acceso a sus datos',
  ERASURE: 'Supresión',
  RECTIFICATION: 'Rectificación',
  PORTABILITY: 'Portabilidad',
  OBJECTION: 'Oposición',
};

const JURISDICTION: Readonly<Record<PrivacyJurisdiction, string>> = {
  PE: 'Perú',
  EU: 'Unión Europea',
  US: 'Estados Unidos',
};

export function privacyStatusLabel(code: PrivacyStatus | null): Rotulo {
  return code ? STATUS[code] : { label: 'Estado no reconocido', tone: 'secondary' };
}

export function privacyTypeLabel(code: PrivacyType | null): string {
  return code ? TYPE[code] : 'Tipo no reconocido';
}

export function jurisdictionLabel(code: PrivacyJurisdiction | null): string {
  return code ? JURISDICTION[code] : 'Sin jurisdicción declarada';
}

export const TYPE_OPTIONS: readonly SelectOption<string>[] = [
  { value: '', label: 'Cualquier tipo' },
  ...PRIVACY_TYPES.map((code) => ({ value: code, label: TYPE[code] })),
];

export const JURISDICTION_OPTIONS: readonly SelectOption<string>[] = [
  { value: '', label: 'Cualquier jurisdicción' },
  ...PRIVACY_JURISDICTIONS.map((code) => ({ value: code, label: JURISDICTION[code] })),
];

/** El verbo del botón que mueve la solicitud a ese estado. */
export const TRANSITION_ACTIONS: Readonly<
  Record<Exclude<PrivacyStatus, 'RECEIVED'>, { readonly label: string; readonly effect: string }>
> = {
  IN_PROGRESS: {
    label: 'Marcar en curso',
    effect: 'Queda registrado que alguien ya la está atendiendo.',
  },
  COMPLETED: {
    label: 'Marcar completada',
    effect:
      'Es definitivo: una solicitud completada no admite más cambios. Desde esta pantalla no se adjunta el paquete de datos.',
  },
  REJECTED: {
    label: 'Rechazar',
    effect: 'Es definitivo: una solicitud rechazada no admite más cambios.',
  },
};

/** Días enteros desde `since` hasta `now`; nunca negativo. */
export function daysSince(since: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - since.getTime()) / 86_400_000));
}
