/* ============================================================================
    Contratos del Alert — sistema ALOVIDA v1.0.

    Los tonos son los CUATRO estados del spec, tomados del mapa compartido
    (`shared/components/tone/`) que ya usan Badge y Chip. Los tonos de marca
    (`primary`/`secondary`) quedan afuera a propósito: un aviso en página
    siempre comunica un estado, nunca «tono de marca».
    ========================================================================== */

export const ALERT_TONES = ['info', 'success', 'warning', 'error'] as const;
export type AlertTone = (typeof ALERT_TONES)[number];

/**
 * Sustantivo que precede al mensaje para lectores de pantalla: el tono no
 * puede comunicarse solo por color (identidad-visual.md, Parte 7).
 */
export const ALERT_TONE_NOUNS: Readonly<Record<AlertTone, string>> = Object.freeze({
  info: 'Información',
  success: 'Éxito',
  warning: 'Advertencia',
  error: 'Error',
});
