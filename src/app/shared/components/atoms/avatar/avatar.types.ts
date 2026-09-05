/* ============================================================================
    Contratos del Avatar — sistema ALOVIDA v1.0.
    Fuente: bloque `Avatars` de ALOVIDA_Sistema_de_Diseno.html (líneas 409–422)
    y su media query móvil (704–705).
    ========================================================================== */

/** xs 24 · sm 32 · md 40 · lg 56 · xl 80 px (lg→44 y xl→56 bajo 780 px). */
export const AVATAR_SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;
export type AvatarSize = (typeof AVATAR_SIZES)[number];

export const AVATAR_STATUSES = ['online', 'offline', 'none'] as const;
export type AvatarStatus = (typeof AVATAR_STATUSES)[number];

/**
 * Familias de marca sobre las que rota el color de fondo determinista.
 *
 * Cada una viaja con su tinta porque **no todas admiten texto blanco**: el
 * sistema mide blanco sobre aqua en 2,51 y sobre ámbar en 2,06 y prohíbe esos
 * rellenos con tinta clara (identidad-visual.md Parte 8.1). Con tinta petróleo
 * esos dos pares suben a 6,9 y 8,4; el blanco queda solo sobre petróleo (8,0).
 */
export const AVATAR_TONES = ['petrol', 'aqua', 'amber'] as const;
export type AvatarTone = (typeof AVATAR_TONES)[number];
