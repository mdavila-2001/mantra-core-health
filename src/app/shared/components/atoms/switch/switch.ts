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
 * Interruptor binario. Es un `<input type="checkbox">` con `role="switch"`:
 * la plataforma aporta el teclado (Espacio) y el anuncio de estado, y el rol
 * cambia cómo lo lee un lector — «activado» en vez de «marcado».
 *
 * `checked` es un `model`, así que ya emite `checkedChange`. Además implementa
 * `ControlValueAccessor`, así que se enchufa a un `FormControl` sin perder ese
 * uso suelto.
 */
@Component({
  selector: 'app-switch',
  standalone: true,
  templateUrl: './switch.html',
  styleUrl: './switch.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.app-switch-host]': 'true',
    '[class.is-disabled]': 'isDisabled()',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Switch),
      multi: true,
    },
  ],
})
export class Switch implements ControlValueAccessor {
  private readonly field = inject(FORM_CONTROL_CONTEXT, { optional: true });

  /** Puente con el formulario. Vacío e inofensivo si el interruptor va suelto. */
  private readonly formBridge = createValueAccessorBridge<boolean>();

  readonly checked = model<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly label = input<string>('');

  /**
   * Deshabilitado por la plantilla **o** por el formulario: `disabled` es un
   * `input()` de solo lectura y `setDisabledState` no puede escribirlo.
   */
  protected readonly isDisabled = computed(
    () => this.disabled() || this.formBridge.disabledByForm(),
  );

  private readonly ownId = nextControlId('switch');
  protected readonly controlId = computed(() => this.field?.controlId() ?? this.ownId);
  protected readonly describedBy = computed(() => this.field?.describedBy() ?? null);

  // --- ControlValueAccessor --------------------------------------------------

  /**
   * Escribe la señal y **no** avisa al formulario: devolverle el valor que él
   * mismo acaba de mandar es la receta del bucle infinito.
   */
  writeValue(value: boolean | null): void {
    // El formulario puede arrancar en null; un interruptor sólo tiene dos estados.
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
   * Marca tocado en el mismo gesto y no al perder el foco: accionar el
   * interruptor ya es la interacción completa.
   */
  protected handleChange(event: Event): void {
    const next = (event.target as HTMLInputElement).checked;
    this.checked.set(next);
    this.formBridge.emitChange(next);
    this.formBridge.emitTouched();
  }
}
