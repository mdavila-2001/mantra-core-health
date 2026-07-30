/* ============================================================================
    Contratos de los controles de entrada — sistema REDSAT v1.0.
    ========================================================================== */

export const INPUT_TYPES = ['text', 'email', 'number', 'password', 'search', 'url'] as const;
export type InputType = (typeof INPUT_TYPES)[number];

export const DATE_PICKER_MODES = ['date-only', 'date-time'] as const;
export type DatePickerMode = (typeof DATE_PICKER_MODES)[number];

/**
 * Opción de un `app-select`. **Sin default `any`**: el tipo del valor viaja de
 * verdad, así lo que sale del select es el mismo dato que entró y no el string
 * al que el DOM lo degrada.
 */
export interface SelectOption<T> {
  value: T;
  label: string;
  disabled?: boolean;
}
