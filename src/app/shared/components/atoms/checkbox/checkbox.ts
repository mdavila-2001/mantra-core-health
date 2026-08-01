import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  model,
} from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';

import {
  FORM_CONTROL_CONTEXT,
  nextControlId,
} from '@shared/forms/form-control.context';
import { createValueAccessorBridge } from '@shared/forms/value-accessor';

/**
 * Casilla sobre `<input type="checkbox">` nativo: teclado, foco y anuncio del
 * estado son de la plataforma. La caja del spec se dibuja aparte y el input
 * queda invisible pero presente.
 *
 * `checked` es un `model`, así que ya emite `checkedChange`: no hay un segundo
 * evento propio que pueda contradecirlo. Además implementa
 * `ControlValueAccessor`, así que se enchufa a un `FormControl` sin perder ese
 * uso suelto.
 */
@Component({
  selector: 'app-checkbox',
  standalone: true,
  templateUrl: './checkbox.html',
  styleUrl: './checkbox.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.app-checkbox-host]': 'true',
    '[class.is-disabled]': 'isDisabled()',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Checkbox),
      multi: true,
    },
  ],
})
export class Checkbox implements ControlValueAccessor {
  private readonly field = inject(FORM_CONTROL_CONTEXT, { optional: true });

  /** Puente con el formulario. Vacío e inofensivo si la casilla va suelta. */
  private readonly formBridge = createValueAccessorBridge<boolean>();

  readonly checked = model<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly label = input<string>('');
  readonly hasError = input<boolean>(false);

  /**
   * Estado parcial: ni tildada ni vacía. Lo necesita el «seleccionar todo» de
   * una tabla cuando solo algunas filas están marcadas. Es una propiedad del
   * DOM, no un atributo: sin bindearla, la casilla miente sobre su estado.
   */
  readonly indeterminate = input<boolean>(false);

  /**
   * Oculta el texto de la etiqueta a la vista **sin quitarlo**: sigue siendo
   * el nombre accesible. Es lo que necesita una casilla dentro de una celda,
   * donde el rótulo lo da el encabezado de la columna.
   */
  readonly hideLabel = input<boolean>(false);

  /**
   * Deshabilitada por la plantilla **o** por el formulario: `disabled` es un
   * `input()` de solo lectura y `setDisabledState` no puede escribirlo.
   */
  protected readonly isDisabled = computed(
    () => this.disabled() || this.formBridge.disabledByForm(),
  );

  private readonly ownId = nextControlId('checkbox');
  protected readonly controlId = computed(() => this.field?.controlId() ?? this.ownId);
  protected readonly describedBy = computed(() => this.field?.describedBy() ?? null);
  protected readonly required = computed(() => this.field?.required() === true);
  protected readonly invalid = computed(
    () => this.hasError() || this.field?.invalid() === true,
  );

  // --- ControlValueAccessor ------------------------------------------------

  writeValue(value: boolean | null): void {
    // El formulario puede arrancar en null; una casilla sólo tiene dos estados.
    this.checked.set(value === true);
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.formBridge.registerOnChange(fn);
  }

  registerOnTouched(fn: () => void): void {
    this.formBridge.registerOnTouched(fn);
  }

  setDisabledState(isDisabled: boolean): void {
    this.formBridge.setDisabledState(isDisabled);
  }

  /**
   * El `change` nativo ya trae el estado nuevo: se toma de ahí, sin invertir.
   *
   * Marca tocado en el mismo gesto y no al perder el foco: marcar una casilla
   * ya es la interacción completa, y esperar al blur retrasaría el mensaje de
   * error de un «acepto los términos» sin aceptar.
   */
  protected handleChange(event: Event): void {
    const nuevo = (event.target as HTMLInputElement).checked;
    this.checked.set(nuevo);
    this.formBridge.emitChange(nuevo);
    this.formBridge.emitTouched();
  }
}
