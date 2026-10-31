import {
  PRIVACY_STATUSES,
  PRIVACY_TYPES,
  type PrivacyRequestsQuery,
  type PrivacyStatus,
} from '../../../../core/data-access/admin-portal/privacy-requests.types';

/* ============================================================================
    La consulta de solicitudes de privacidad, leída de la URL. Lo que la API
    rechazaría con 400 se descarta aquí. La pestaña es el estado (`status`);
    sin parámetro se ven todas. `GET /privacy/dsar` no filtra por jurisdicción.
    ========================================================================== */

export const PRIVACY_URL_KEYS = ['status', 'type'] as const;
export type PrivacyUrlValues = Readonly<Record<(typeof PRIVACY_URL_KEYS)[number], string>>;

/** Las pestañas: todas, y una por estado. */
export const PRIVACY_TABS = ['ALL', ...PRIVACY_STATUSES] as const;

export function statusOf(values: Pick<PrivacyUrlValues, 'status'>): PrivacyStatus | null {
  return (PRIVACY_STATUSES as readonly string[]).includes(values.status) ? (values.status as PrivacyStatus) : null;
}

export function tabIndexOf(values: Pick<PrivacyUrlValues, 'status'>): number {
  const status = statusOf(values);
  return status === null ? 0 : PRIVACY_TABS.indexOf(status);
}

export function privacyQuery(values: PrivacyUrlValues): PrivacyRequestsQuery {
  const status = statusOf(values);
  return {
    ...(status ? { status } : {}),
    ...((PRIVACY_TYPES as readonly string[]).includes(values.type)
      ? { type: values.type as (typeof PRIVACY_TYPES)[number] }
      : {}),
  };
}

export function hasPrivacyFilters(values: PrivacyUrlValues): boolean {
  return values.type !== '';
}

/** El texto que se le dice a la persona cuando tramitar falla. */
export function transitionFailure(status: number | null): { message: string; reload: boolean } {
  if (status === 403) {
    return {
      message: 'Su cuenta no tiene permiso para tramitar solicitudes de privacidad. No se cambió nada.',
      reload: false,
    };
  }
  if (status === 404) {
    return { message: 'La solicitud ya no existe.', reload: true };
  }
  if (status === 422) {
    return {
      message: 'La solicitud ya estaba cerrada, así que no admite más cambios. Se actualizó la pantalla.',
      reload: true,
    };
  }
  return { message: 'No se pudo guardar el cambio. No se cambió nada; puede reintentar.', reload: false };
}
