/* ============================================================================
    Contratos del `app-date-picker` — sistema ALOVIDA v1.0.

    Vivían en `atoms/input/input.types.ts`; se mudaron con su componente. Un
    atom no debe ser la casa de los contratos de otros.
    ========================================================================== */

export const DATE_PICKER_MODES = ['date-only', 'date-time'] as const;
export type DatePickerMode = (typeof DATE_PICKER_MODES)[number];

export const MIN_DEFAULT_YEAR = 1900;
export const MAX_DEFAULT_YEAR = 2000;
