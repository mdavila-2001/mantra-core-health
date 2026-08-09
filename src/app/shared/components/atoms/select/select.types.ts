/* ============================================================================
    Contratos del `app-select` — sistema REDSAT v1.0.
    ========================================================================== */

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
