/* ============================================================================
    Contratos del Chip — sistema ALOVIDA v1.0.

    El tono sale del mapa compartido (`shared/components/tone/`), el mismo que
    usa el Badge: un chip de faceta y una etiqueta de estado no pueden pintar
    distinto el mismo concepto. `neutral` se suma porque una faceta de listado
    («Servicio», «Aseguradora») no es un estado clínico y no debe leerse como
    tal. Extensión propia — pendiente de validación del diseñador.
    ========================================================================== */

import { NEUTRAL_TONE, TONES, type NeutralTone, type Tone } from '../../tone/tone.types';

export const CHIP_VARIANTS = [...TONES, NEUTRAL_TONE] as const;
export type ChipVariant = Tone | NeutralTone;

/** Un chip vive dentro de una barra de filtros: no hay talle grande. */
export const CHIP_SIZES = ['sm', 'md'] as const;
export type ChipSize = (typeof CHIP_SIZES)[number];

/** Teclas que quitan un chip removible, como en cualquier campo de etiquetas. */
export const CHIP_REMOVE_KEYS = ['Delete', 'Backspace'] as const;
