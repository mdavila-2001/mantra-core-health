/* ============================================================================
    El lado del CONTROL en el contrato con `app-form-field`.

    Los siete controles del sistema (input, select, checkbox, switch,
    file-input, date-picker, radio-group) repetían el mismo bloque de seis
    líneas: pedir el campo, generar un id propio de reserva, y derivar
    `controlId`, `describedBy`, `required` e `invalid` a partir de él.

    Repetido siete veces, el bloque deja de ser un detalle: cualquier arreglo de
    accesibilidad hay que acertarlo siete veces. Acá se escribe una vez.
    ========================================================================== */

import { computed, inject, type Signal } from '@angular/core';

import { FORM_CONTROL_CONTEXT, nextControlId, type FormControlContext } from './form-control.context';

/** Lo que un control necesita saber del campo que lo envuelve (si lo hay). */
export interface FormControlBinding {
  /**
   * El campo que envuelve al control, o `null` si vive suelto. Solo hace falta
   * para lo excepcional —un grupo de radios avisando que no es «etiquetable»—;
   * lo habitual es usar las señales derivadas de abajo.
   */
  readonly field: FormControlContext | null;
  /** `id` a estampar en el elemento nativo: el del campo, o el propio. */
  readonly controlId: Signal<string>;
  /** Ids de hint y/o error; `null` si el campo no describe nada. */
  readonly describedBy: Signal<string | null>;
  /** `id` del `<label>` del campo, para quien deba usar `aria-labelledby`. */
  readonly labelledBy: Signal<string | null>;
  readonly required: Signal<boolean>;
  /** Error propio del control **o** del campo: cualquiera de los dos lo marca. */
  readonly invalid: Signal<boolean>;
}

/**
 * Conecta un control con el `app-form-field` que lo envuelve, si existe.
 *
 * Debe llamarse en contexto de inyección — como inicializador de campo, que es
 * donde lo usan los componentes:
 *
 * ```ts
 * export class InputComponent {
 *   readonly hasError = input<boolean>(false);
 *   private readonly form = injectFormControl('input', this.hasError);
 * }
 * ```
 *
 * @param prefix  Raíz del id de reserva cuando el control vive sin campo.
 * @param hasError  Señal de error propia del control, si la tiene.
 */
export function injectFormControl(
  prefix: string,
  hasError?: Signal<boolean>,
): FormControlBinding {
  const field = inject(FORM_CONTROL_CONTEXT, { optional: true });

  // Se reserva SIEMPRE, aunque haya campo: el contador avanza igual en servidor
  // y en cliente, y basta con que un control lo pida condicionalmente para que
  // las dos secuencias se separen y la hidratación deje de coincidir.
  const ownId = nextControlId(prefix);

  return {
    field,
    controlId: computed(() => field?.controlId() ?? ownId),
    describedBy: computed(() => field?.describedBy() ?? null),
    labelledBy: computed(() => field?.labelId() ?? null),
    required: computed(() => field?.required() === true),
    invalid: computed(() => hasError?.() === true || field?.invalid() === true),
  };
}
