/* ============================================================================
    Contrato entre un campo (`app-form-field`) y el control que envuelve.

    Existe para cerrar el defecto de accesibilidad más caro del sistema: un
    `<label for>` sin `id` al que apuntar deja el control sin nombre accesible.
    El campo es quien conoce label, hint y error, así que es quien genera el
    `id` y la lista de `aria-describedby`; el control solo los consume.

    Un control sin campo alrededor sigue funcionando: inyecta el token como
    `{ optional: true }` y cae en su propio id.
    ========================================================================== */

import { InjectionToken, type Signal, type WritableSignal } from '@angular/core';

export interface FormControlContext {
  /**
   * Si el control es «etiquetable» en el sentido del HTML (input, select,
   * button…). Un grupo de radios NO lo es: el `for` del label no puede
   * apuntarle, y el grupo se nombra con `aria-labelledby`. El control lo
   * declara; el campo decide con eso si emite `for` o no.
   */
  readonly controlLabelable: WritableSignal<boolean>;
  /** `id` que el control debe poner en su elemento nativo. */
  readonly controlId: Signal<string>;
  /**
   * `id` del `<label>`. Un control nativo se etiqueta con `for`/`id`, pero un
   * grupo (radios) no puede: usa `aria-labelledby` apuntando acá.
   */
  readonly labelId: Signal<string>;
  /** Ids de hint y/o error, separados por espacio; `null` si no hay ninguno. */
  readonly describedBy: Signal<string | null>;
  /** El campo declara error: el control debe exponer `aria-invalid`. */
  readonly invalid: Signal<boolean>;
  /** El campo está marcado obligatorio: el control expone `aria-required`. */
  readonly required: Signal<boolean>;
}

export const FORM_CONTROL_CONTEXT = new InjectionToken<FormControlContext>('FormControlContext');

/**
 * Contador de ids. Server y cliente arrancan en 0 y avanzan en el mismo orden,
 * así que los ids coinciden y la hidratación no rompe.
 */
let sequence = 0;

/** `nextControlId('input')` → `mch-input-3`. */
export function nextControlId(prefix: string): string {
  sequence += 1;
  return `mch-${prefix}-${sequence}`;
}
