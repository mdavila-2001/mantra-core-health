/* ============================================================================
    Contratos del `app-input` — sistema REDSAT v1.0.

    Acá viven SOLO los tipos del input. `SelectOption` y `DatePickerMode` estaban
    en este archivo y se mudaron con su componente: un atom no debe ser la casa
    de los contratos de otros.
    ========================================================================== */

export const INPUT_TYPES = ['text', 'email', 'number', 'password', 'search', 'url'] as const;
export type InputType = (typeof INPUT_TYPES)[number];
