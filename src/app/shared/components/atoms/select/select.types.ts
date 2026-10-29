/* ============================================================================
    Contratos del `app-select` — sistema ALOVIDA v1.0.
    ========================================================================== */

/**
 * Opción de un `app-select`. **Sin default `any`**: el tipo del valor viaja de
 * verdad, así lo que sale del select es el mismo dato que entró y no el string
 * al que el DOM lo degrada.
 */
export interface SelectOption<T> {
  value: T;
  label: string;
  /**
   * Qué significa la opción, en una frase. Se ve en segunda línea dentro del
   * modal y el buscador también la mira: una lista de estados o de tipos deja
   * de ser una lista de palabras a adivinar.
   */
  description?: string;
  disabled?: boolean;
}
