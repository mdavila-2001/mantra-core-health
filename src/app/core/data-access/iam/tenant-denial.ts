/**
 * Las organizaciones que **no dejan actuar ahora** a una persona que sí entró.
 *
 * La política de sesión de una organización rige **solo en ella**: si una niega (franja horaria, red, segundo
 * factor, inactividad), esa organización sale de `tenants` del token y se declara en `deniedTenants` con su
 * motivo; la persona entra a las demás y no se le cierra la sesión. El login se rechaza únicamente cuando
 * ninguna organización la deja entrar.
 *
 * Llega por tres vías, siempre con los mismos cinco motivos:
 *
 * - la respuesta del login y del refresco: `deniedTenants: [{ tenantId, reason }]`;
 * - el claim del token: `deniedTenants: { [tenantId]: reason }`;
 * - el `403` de cualquier petición con `X-Tenant-Id` de esa organización: `reason` y
 *   `details: { tenantId, reason }`.
 *
 * Es presentación: lo que la persona lee. La que niega de verdad es la API en cada petición.
 */
export const TENANT_DENIAL_REASONS = [
  'OUTSIDE_ALLOWED_HOURS',
  'OUTSIDE_ALLOWED_NETWORK',
  'IDLE_TIMEOUT',
  'MFA_REQUIRED',
  'MFA_ENROLLMENT_REQUIRED',
] as const;

export type TenantDenialReason = (typeof TENANT_DENIAL_REASONS)[number];

/** Una organización que niega, con su motivo. */
export interface DeniedTenant {
  readonly tenantId: string;
  /** Uno de {@link TENANT_DENIAL_REASONS}; un motivo que la API agregue después se conserva tal cual. */
  readonly reason: string;
}

export function isTenantDenialReason(value: unknown): value is TenantDenialReason {
  return typeof value === 'string' && (TENANT_DENIAL_REASONS as readonly string[]).includes(value);
}

/**
 * El motivo en palabras de la persona, completando «La organización X no le permite entrar ahora: …».
 * Es la parte **después** de los dos puntos.
 */
export const TENANT_DENIAL_TEXT: Readonly<Record<TenantDenialReason, string>> = {
  OUTSIDE_ALLOWED_HOURS: 'está fuera del horario en que esa organización permite entrar',
  OUTSIDE_ALLOWED_NETWORK: 'esta conexión no es una de las redes que esa organización permite',
  IDLE_TIMEOUT: 'estuvo inactivo más tiempo del que esa organización permite',
  MFA_REQUIRED: 'esa organización exige el código de verificación en dos pasos y no se lo pidió al entrar',
  MFA_ENROLLMENT_REQUIRED: 'esa organización exige la verificación en dos pasos y su cuenta todavía no la tiene activada',
};

/** Qué puede hacer la persona, para decirlo junto al motivo. */
export const TENANT_DENIAL_HINT: Readonly<Record<TenantDenialReason, string>> = {
  OUTSIDE_ALLOWED_HOURS: 'Vuelva a intentar dentro de su horario.',
  OUTSIDE_ALLOWED_NETWORK: 'Conéctese a una red permitida por la organización y vuelva a entrar.',
  IDLE_TIMEOUT: 'Vuelva a iniciar sesión para actuar en ella.',
  MFA_REQUIRED: 'Cierre sesión y vuelva a entrar escribiendo el código de su aplicación.',
  MFA_ENROLLMENT_REQUIRED: 'Active la verificación en dos pasos para poder entrar.',
};

/** El motivo en palabras; uno desconocido cae en una frase neutra en lugar de mostrar un código. */
export function tenantDenialText(reason: string): string {
  return isTenantDenialReason(reason) ? TENANT_DENIAL_TEXT[reason] : 'esa organización no lo deja entrar ahora';
}

export function tenantDenialHint(reason: string): string {
  return isTenantDenialReason(reason) ? TENANT_DENIAL_HINT[reason] : 'Vuelva a intentarlo más tarde.';
}

/** La frase completa del aviso no bloqueante: «La organización X no le permite entrar ahora: …». */
export function deniedTenantMessage(organizationName: string, reason: string): string {
  return `La organización ${organizationName} no le permite entrar ahora: ${tenantDenialText(reason)}.`;
}

/** Los pares `{ tenantId, reason }` de la respuesta del login o del refresco, sin lo que no tenga la forma. */
export function deniedTenantsOfBody(body: unknown): readonly DeniedTenant[] {
  if (!Array.isArray(body)) return [];
  return body.flatMap((fila: unknown) => {
    if (typeof fila !== 'object' || fila === null) return [];
    const { tenantId, reason } = fila as Record<string, unknown>;
    return typeof tenantId === 'string' && tenantId !== '' && typeof reason === 'string' ? [{ tenantId, reason }] : [];
  });
}
