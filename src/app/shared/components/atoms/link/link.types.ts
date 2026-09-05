/* ============================================================================
    Contratos del Link — sistema ALOVIDA v1.0.

    El spec no declara enlaces de texto: es extensión propia con el color de
    marca y el anillo de foco del sistema. Pendiente de validación del
    diseñador — en particular si `subtle` puede subrayar solo al hover
    (mientras no lo diga, subraya siempre: el color no puede ser el único
    portador de significado).
    ========================================================================== */

export const LINK_VARIANTS = ['default', 'subtle', 'danger'] as const;
export type LinkVariant = (typeof LINK_VARIANTS)[number];

/** Protocolos que abren una pestaña. `mailto:` y `tel:` no son «externos». */
export const BROWSABLE_PROTOCOLS = ['http:', 'https:'] as const;
