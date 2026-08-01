/* ============================================================================
    Contratos del Breadcrumb — sistema REDSAT v1.0.

    Extensión propia: el spec no lo declara. La jerarquía que representa es la
    del dominio — organización → sede → paciente → episodio— y por eso el
    colapso conserva SIEMPRE la raíz y las dos últimas: saber de qué
    organización se trata es tan importante como saber dónde se está parado.
    Pendiente de validación del diseñador.
    ========================================================================== */

/** Un escalón de la ruta. Sin `routerLink` es texto, no enlace. */
export interface BreadcrumbItem {
  readonly label: string;
  readonly routerLink?: string | readonly unknown[];
}

/** A partir de acá la ruta se colapsa: raíz + salto + las dos últimas. */
export const BREADCRUMB_COLLAPSE_THRESHOLD = 4;

/** Cuántos escalones finales quedan siempre a la vista. */
export const BREADCRUMB_VISIBLE_TAIL = 2;
