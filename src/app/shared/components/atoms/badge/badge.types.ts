/* ============================================================================
    Contratos del Badge — sistema REDSAT v1.0.
    Fuente: bloque `Badges / status` de REDSAT_Sistema_de_Diseno.html (líneas
    359–364). El spec declara `success · warning · error · info`; `primary` y
    `secondary` son extensión propia armada con rampas de marca siguiendo el
    MISMO patrón que los `--st-*` — pendientes de validación del diseñador
    (identidad-visual.md, pendientes).
    ========================================================================== */

/** Los tonos compartidos con el Chip, sin `neutral`: un badge siempre significa algo. */
export { TONES as BADGE_VARIANTS } from '../../tone/tone.types';
export type { Tone as BadgeVariant } from '../../tone/tone.types';

/** El spec define un solo tamaño (≡ `md`); `sm` y `lg` lo escalan. */
export const BADGE_SIZES = ['sm', 'md', 'lg'] as const;
export type BadgeSize = (typeof BADGE_SIZES)[number];

/** Lo que un badge puede mostrar: texto de estado, un conteo, o nada. */
export type BadgeValue = string | number | null;
