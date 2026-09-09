import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import { NavIcon } from '@shared/components/atoms/nav-icon/nav-icon';
import type { NavIconName } from '@shared/components/atoms/nav-icon/nav-icon.types';
import {
  FORM_CONTROL_CONTEXT,
  nextControlId,
  type FormControlContext,
} from '@shared/forms/form-control.context';

/**
 * Campo de formulario: label, hint, error y obligatoriedad alrededor de
 * cualquier control de entrada.
 *
 * Es **quien genera el `id`** del control y la lista de `aria-describedby`, y
 * los publica por DI (`FORM_CONTROL_CONTEXT`). El control que se le proyecte
 * adentro los toma solo: no hay que pasar `for` ni `id` a mano.
 *
 * ```html
 * <app-form-field icon="patients" label="Nombre" hint="Como figura en el CI" [required]="true">
 *   <app-input type="text" [(value)]="nombre" />
 * </app-form-field>
 * ```
 *
 * ## `hint` y `description` no son lo mismo
 *
 * El `hint` va **debajo del campo y siempre visible**: es la ayuda que se lee
 * sin hacer nada. La `description` es la explicación larga, que aparece al
 * apuntar el campo o al enfocarlo con el teclado y se va cuando el foco se va.
 *
 * La segunda **suma**, no reemplaza: si se mudara el `hint` a un globo, el dato
 * dejaría de existir en el teléfono —donde no hay puntero— y el campo se
 * quedaría sin su `aria-describedby`, que es lo que el ADR-0008 exige. Por eso
 * las dos describen al control a la vez, y ninguna le quita el sitio a la otra.
 */
@Component({
  selector: 'app-form-field',
  standalone: true,
  imports: [NavIcon],
  templateUrl: './form-field.html',
  styleUrl: './form-field.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: FORM_CONTROL_CONTEXT, useExisting: FormField }],
  host: {
    '[class.app-form-field-host]': 'true',
  },
})
export class FormField implements FormControlContext {
  /**
   * El ícono del campo, a su izquierda. Del set cerrado de `app-nav-icon`.
   *
   * La regla de UI de ALOVIDA pide ícono en todos los campos de un formulario, y
   * la tentación es declararlo `input.required` para que no se pueda olvidar.
   * **No lo es, y a propósito**: requerido obliga a completar los 406 usos del
   * repositorio en una sola pasada, y ese barrido es justo el que rompió los
   * formularios el 05/09/2026 y hubo que revertir entero.
   *
   * Vacío no dibuja nada y no reserva sitio, así que una pantalla todavía sin
   * revisar se ve exactamente como antes. La regla se aplica pantalla por
   * pantalla, verificándola en cada una.
   */
  readonly icon = input<NavIconName | ''>('');

  /**
   * El nombre del ícono ya estrechado, o `null`.
   *
   * `@if (icon())` no estrecha el tipo de una señal en la plantilla —sigue
   * siendo `NavIconName | ''`—, así que sin esto `[name]` no compila. */
  protected readonly iconoNombre = computed<NavIconName | null>(() => this.icon() || null);

  readonly label = input<string>('');
  readonly hint = input<string>('');
  readonly errorMessage = input<string>('');
  readonly required = input<boolean>(false);

  /**
   * La explicación del campo, la que aparece al apuntarlo o al enfocarlo.
   *
   * Vacía —lo normal— no dibuja nada. No sustituye al `hint`: ver la nota de
   * la clase. Se muestra con `:hover` y con `:focus-within` —no sólo con el
   * puntero, que en un teléfono no existe— y viaja siempre en el
   * `aria-describedby` del control, tenga o no puntero quien lo lea.
   */
  readonly description = input<string>('');

  /** Lo baja a `false` un control que no puede ser destino de un `for`. */
  readonly controlLabelable = signal(true);

  /** Base de los tres ids del campo; estable entre servidor y cliente. */
  private readonly baseId = nextControlId('field');

  readonly controlId = computed(() => `${this.baseId}-control`);
  readonly labelId = computed(() => `${this.baseId}-label`);
  protected readonly hintId = computed(() => `${this.baseId}-hint`);
  protected readonly errorId = computed(() => `${this.baseId}-error`);
  protected readonly descriptionId = computed(() => `${this.baseId}-description`);

  /**
   * El error reemplaza al hint, así que solo uno de los dos describe al
   * control. La `description` se suma a lo que quede: es información distinta
   * —qué es este campo— y no compite con «esto está mal» ni con «escribilo
   * así».
   */
  readonly describedBy = computed<string | null>(() => {
    const principal = this.errorMessage()
      ? this.errorId()
      : this.hint()
        ? this.hintId()
        : null;
    const partes = [principal, this.description() ? this.descriptionId() : null].filter(
      (id): id is string => id !== null,
    );
    return partes.length === 0 ? null : partes.join(' ');
  });

  readonly invalid = computed(() => this.errorMessage().length > 0);
}
