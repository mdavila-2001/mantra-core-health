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

/** Lo que dice el sello en palabras, por estado. */
export interface VerificationCopy {
  /** Lo que se lee al lado del pictograma en la variante `label`. */
  readonly visible: string;
  /** Nombre accesible sin sujeto: «Profesional verificado». */
  readonly name: string;
  /** Qué significa, en una frase. Es el cuerpo del popover. */
  readonly meaning: string;
  /** Qué NO significa. Sólo el sello de verificado lo necesita: es el que se malinterpreta. */
  readonly limits?: string;
}

export const VERIFICATION_COPY: Readonly<Record<string, VerificationCopy>> = Object.freeze({
  VERIFIED: {
    visible: 'Verificado',
    name: 'Profesional verificado',
    meaning:
      'Identidad y matrícula profesional comprobadas por AloVida con la fuente declarada.',
    limits:
      'No es una recomendación clínica ni un aval del Ministerio de Salud o del Colegio Médico.',
  },
  IN_REVIEW: {
    visible: 'En verificación',
    name: 'Verificación en proceso',
    meaning:
      'AloVida está comprobando su identidad y su matrícula profesional. Hasta que termine no se muestra como verificado.',
  },
  EXPIRED: {
    visible: 'Verificación vencida',
    name: 'Verificación vencida',
    meaning: 'La verificación de este perfil venció (vencida) y debe renovarse. Hoy no cuenta como verificado.',
  },
  UNVERIFIED: {
    visible: 'No verificado',
    name: 'Profesional no verificado',
    meaning: 'AloVida todavía no comprobó la identidad ni la matrícula de este perfil.',
  },
});

/** Los estados que llevan pictograma. UNVERIFIED nunca dibuja un glifo: sólo texto, y sólo en `label`. */
export const VERIFICATION_GLYPH_STATES = ['VERIFIED', 'IN_REVIEW', 'EXPIRED'] as const;

/**
 * Silueta del sello de AloVida: un ESCUDO con las esquinas suaves, en una caja
 * de 24 × 24. Glifo propio —no es el festón de X ni de Instagram—, para no
 * heredar su semántica de «cuenta paga o notable». Con tilde blanco encima.
 */
export const VERIFICATION_SEAL_PATH =
  'M12 2.4c2.6 1.7 5.2 2.5 7.7 2.6.3 0 .5.2.5.5v6c0 5.2-3.2 8.8-8.2 10.5-5-1.7-8.2-5.3-8.2-10.5v-6c0-.3.2-.5.5-.5 2.5-.1 5.1-.9 7.7-2.6z';
