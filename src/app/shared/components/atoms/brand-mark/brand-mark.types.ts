/** `glifo` es sólo el isotipo; `completa` agrega la palabra «AloVida». */
export const BRAND_MARK_VARIANTS = ['glifo', 'completa'] as const;
export type BrandMarkVariant = (typeof BRAND_MARK_VARIANTS)[number];

export const BRAND_MARK_SIZES = ['sm', 'md', 'lg'] as const;
export type BrandMarkSize = (typeof BRAND_MARK_SIZES)[number];
