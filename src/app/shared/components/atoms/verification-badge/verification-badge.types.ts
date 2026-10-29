/* ============================================================================
    Contratos de la insignia de verificación — el «check azul» del profesional.

    Los estados y su adaptador viven en `core/verification`: la API los decide y
    el front sólo los pinta. Acá van las variantes de PRESENTACIÓN.
    ========================================================================== */

export { VERIFICATION_STATUSES } from '@core/verification/verification-status';
export type { VerificationStatus } from '@core/verification/verification-status';

/** `sm` acompaña un nombre en una tabla; `md` en una tarjeta; `lg` en la cabecera de una ficha. */
export const VERIFICATION_BADGE_SIZES = ['sm', 'md', 'lg'] as const;
export type VerificationBadgeSize = (typeof VERIFICATION_BADGE_SIZES)[number];

/** `icon`: sólo el pictograma. `label`: pictograma + palabra, para cuando hay lugar. */
export const VERIFICATION_BADGE_VARIANTS = ['icon', 'label'] as const;
export type VerificationBadgeVariant = (typeof VERIFICATION_BADGE_VARIANTS)[number];

/** Lo que dice el sello en palabras, por estado. `UNVERIFIED` no se estampa salvo en `label`. */
export interface VerificationCopy {
  /** Lo que se lee al lado del icono en la variante `label`. */
  readonly visible: string;
  /** Nombre accesible sin sujeto: «Profesional verificado». */
  readonly name: string;
  /** Qué significa, en una frase. Es el cuerpo del tooltip. */
  readonly meaning: string;
}

export const VERIFICATION_COPY: Readonly<Record<string, VerificationCopy>> = Object.freeze({
  VERIFIED: {
    visible: 'Verificado',
    name: 'Profesional verificado',
    meaning: 'Identidad y matrícula profesional comprobadas por AloVida.',
  },
  IN_REVIEW: {
    visible: 'En verificación',
    name: 'Verificación en proceso',
    meaning:
      'AloVida está comprobando su identidad y su matrícula profesional. Hasta que termine no se muestra como verificado.',
  },
  SUSPENDED: {
    visible: 'Verificación suspendida',
    name: 'Verificación suspendida',
    meaning: 'AloVida suspendió la verificación de este perfil.',
  },
  EXPIRED: {
    visible: 'Verificación vencida',
    name: 'Verificación vencida',
    meaning: 'La verificación de este perfil venció y debe renovarse.',
  },
  UNVERIFIED: {
    visible: 'No verificado',
    name: 'Profesional no verificado',
    meaning: 'AloVida todavía no comprobó la identidad ni la matrícula de este perfil.',
  },
});

/**
 * Contorno del sello festoneado (8 lóbulos suaves) en una caja de 24 × 24.
 * Calculado con r(θ) = R·(1 + a·cos 8θ); es la silueta de la insignia de
 * Twitter/Instagram, reconocible a 16 px.
 */
export const VERIFICATION_SEAL_PATH =
  'M12.00 1.40L12.69 1.50L13.35 1.76L13.96 2.15L14.53 2.56L15.08 2.94L15.63 3.23L16.23 3.42L16.89 3.54L17.58 3.65L18.28 3.81L18.94 4.09L19.50 4.50L19.91 5.06L20.19 5.72L20.35 6.42L20.46 7.11L20.58 7.77L20.77 8.37L21.06 8.92L21.44 9.47L21.85 10.04L22.24 10.65L22.50 11.31L22.60 12.00L22.50 12.69L22.24 13.35L21.85 13.96L21.44 14.53L21.06 15.08L20.77 15.63L20.58 16.23L20.46 16.89L20.35 17.58L20.19 18.28L19.91 18.94L19.50 19.50L18.94 19.91L18.28 20.19L17.58 20.35L16.89 20.46L16.23 20.58L15.63 20.77L15.08 21.06L14.53 21.44L13.96 21.85L13.35 22.24L12.69 22.50L12.00 22.60L11.31 22.50L10.65 22.24L10.04 21.85L9.47 21.44L8.92 21.06L8.37 20.77L7.77 20.58L7.11 20.46L6.42 20.35L5.72 20.19L5.06 19.91L4.50 19.50L4.09 18.94L3.81 18.28L3.65 17.58L3.54 16.89L3.42 16.23L3.23 15.63L2.94 15.08L2.56 14.53L2.15 13.96L1.76 13.35L1.50 12.69L1.40 12.00L1.50 11.31L1.76 10.65L2.15 10.04L2.56 9.47L2.94 8.92L3.23 8.37L3.42 7.77L3.54 7.11L3.65 6.42L3.81 5.72L4.09 5.06L4.50 4.50L5.06 4.09L5.72 3.81L6.42 3.65L7.11 3.54L7.77 3.42L8.37 3.23L8.92 2.94L9.47 2.56L10.04 2.15L10.65 1.76L11.31 1.50Z';
