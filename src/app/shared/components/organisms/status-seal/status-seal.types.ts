/* ============================================================================
    Contratos del StatusSeal — el veredicto de un trámite, dicho en palabras.

    Las variantes son estados del dominio, no tonos: el mapeo estado → tono
    vive en el componente, una sola vez. `unknown` va aparte —espejo del patrón
    `TONES`/`NEUTRAL_TONE`— porque no es un estado del trámite: es el fallback
    para un estado que el backend emite y esta versión no conoce.
    ========================================================================== */

/** Estados con presentación propia: tono + forma de ícono. */
export const STATUS_SEAL_VARIANTS = [
  'pending',
  'in-review',
  'approved',
  'rejected',
  'expired',
] as const;

/**
 * Un estado no reconocido no se inventa ni se oculta: se muestra en neutro,
 * con la palabra que le ponga la pantalla.
 */
export const UNKNOWN_STATUS_VARIANT = 'unknown';

export type StatusSealVariant =
  | (typeof STATUS_SEAL_VARIANTS)[number]
  | typeof UNKNOWN_STATUS_VARIANT;
