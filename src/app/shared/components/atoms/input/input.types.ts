/* ============================================================================
    Contratos del `app-input` — sistema REDSAT v1.0.

    Acá viven SOLO los tipos del input. `SelectOption` y `DatePickerMode` estaban
    en este archivo y se mudaron con su componente: un atom no debe ser la casa
    de los contratos de otros.
    ========================================================================== */

export const INPUT_TYPES = ['text', 'email', 'number', 'password', 'search', 'url'] as const;
export type InputType = (typeof INPUT_TYPES)[number];

/**
 * Superficie ARIA que convierte al `<input>` en el control de un combobox.
 *
 * Va como un solo objeto y no como cuatro entradas sueltas porque los cuatro
 * atributos son inseparables: un `role="combobox"` sin `aria-controls` o sin
 * `aria-expanded` es peor que no declarar el rol, porque el lector de pantalla
 * anuncia un control que después no sabe describir. Pasarlos juntos hace que
 * falte uno sea imposible.
 *
 * Sin este objeto el `<input>` no emite ninguno de los cuatro atributos, así
 * que nada cambia para el resto de los consumidores del átomo.
 */
export interface InputComboboxAria {
  /** Si la lista de opciones está desplegada. */
  readonly expanded: boolean;
  /** `id` del elemento `role="listbox"` que el control gobierna. */
  readonly controls: string;
  /** `id` de la opción activa, o `null` si no hay ninguna. */
  readonly activeDescendant: string | null;
  /** Qué tipo de sugerencia ofrece; por defecto, una lista. */
  readonly autocomplete?: 'list' | 'both' | 'none';
}
