/* ============================================================================
    Contratos del selector de organización (tenant).
    ========================================================================== */

/**
 * Una organización a la que la persona pertenece según su access token.
 * El organismo la muestra; validar la pertenencia y propagar `X-Tenant-Id`
 * es de `core/auth`.
 */
export interface TenantOption {
  readonly id: string;
  readonly name: string;
  /** Rol legible en esa organización («Médico», «Administrativo»). */
  readonly role?: string;
}

/** `compact` vive en el header; `page` es la pantalla 5 de selección. */
export const TENANT_SWITCHER_VARIANTS = ['compact', 'page'] as const;
export type TenantSwitcherVariant = (typeof TENANT_SWITCHER_VARIANTS)[number];
