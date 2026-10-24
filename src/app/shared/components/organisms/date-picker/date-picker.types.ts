/* ============================================================================
    Contratos del `app-date-picker` — sistema ALOVIDA v1.0.

    Vivían en `atoms/input/input.types.ts`; se mudaron con su componente. Un
    atom no debe ser la casa de los contratos de otros.
    ========================================================================== */

export const DATE_PICKER_MODES = ['date-only', 'date-time'] as const;
export type DatePickerMode = (typeof DATE_PICKER_MODES)[number];

/**
 * Por qué el selector rechazó lo que se escribió a mano: una fecha que no
 * existe («31/02/2000», «12/1_/____») o una que existe pero cae fuera de
 * `minDate`/`maxDate` («20/02/1800» en un alta que arranca en 1910). En los
 * dos casos el modelo queda en `null`, así que quien usa el selector no puede
 * distinguirlos de un campo vacío sin este aviso.
 */
export type DateTextProblem = 'invalid' | 'out-of-range';

export const MIN_DEFAULT_YEAR = 1900;
export const MAX_DEFAULT_YEAR = 2000;
