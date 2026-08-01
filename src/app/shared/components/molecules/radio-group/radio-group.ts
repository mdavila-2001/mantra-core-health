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
 * Grupo de radios. **El grupo es el control**, no cada radio: acá vive el
 * `value` y de él se deriva cuál está marcado, así la exclusión mutua es
 * estructural en vez de depender de que cada radio se desmarque solo.
 *
 * Por eso el `ControlValueAccessor` va acá y no en `app-radio`: el formulario
 * ve un solo control con un solo valor, que es lo que la persona percibe.
 *
 * ```html
 * <app-form-field label="Tipo de usuario">
 *   <app-radio-group formControlName="tipoUsuario">
 *     <app-radio value="paciente" label="Paciente" />
 *     <app-radio value="medico" label="Médico" />
 *   </app-radio-group>
 * </app-form-field>
 * ```
 */
@Component({
  selector: 'app-radio-group',
  standalone: true,
  templateUrl: './radio-group.html',
  styleUrl: './radio-group.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    role: 'radiogroup',
    '[attr.aria-labelledby]': 'labelledBy()',
    '[attr.aria-invalid]': 'invalid()',
    '[attr.aria-required]': 'required() || null',
    '[attr.aria-disabled]': 'isDisabled()',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => RadioGroup),
      multi: true,
    },
  ],
})
export class RadioGroup<T = unknown> implements ControlValueAccessor {
  private readonly field = inject(FORM_CONTROL_CONTEXT, { optional: true });

  /** Puente con el formulario. Vacío e inofensivo si el grupo va suelto. */
  private readonly formBridge = createValueAccessorBridge<T | null>();

  readonly value = model<T | null>(null);
  readonly disabled = input<boolean>(false);
  readonly hasError = input<boolean>(false);

  /** Agrupa los `<input type="radio">` nativos; se autogenera si no se pasa. */
  readonly name = input<string>(nextControlId('radio-group'));

  /**
   * Deshabilitado por la plantilla **o** por el formulario: `disabled` es un
   * `input()` de solo lectura y `setDisabledState` no puede escribirlo.
   *
   * Es público porque cada `app-radio` hijo lo consulta: si mirara el `input()`
   * a secas, un `FormControl.disable()` sobre el grupo dejaría los radios
   * clicables.
   */
  readonly isDisabled = computed(() => this.disabled() || this.formBridge.disabledByForm());

  /** Un grupo no se etiqueta con `for`: apunta al label del campo. */
  protected readonly labelledBy = computed(() => this.field?.labelId() ?? null);

  protected readonly invalid = computed(
    () => this.hasError() || this.field?.invalid() === true,
  );

  protected readonly required = computed(() => this.field?.required() === true);

  constructor() {
    // Un grupo no es «etiquetable»: el `for` del label no puede apuntarle, así
    // que se lo avisa al campo — el nombre ya viaja por `aria-labelledby`.
    this.field?.controlLabelable.set(false);
  }

  // --- ControlValueAccessor --------------------------------------------------

  /**
   * Escribe la señal y **no** avisa al formulario: devolverle el valor que él
   * mismo acaba de mandar es la receta del bucle infinito.
   */
  writeValue(value: T | null): void {
    this.value.set(value ?? null);
  }

  registerOnChange(fn: (value: T | null) => void): void {
    this.formBridge.registerOnChange(fn);
  }

  registerOnTouched(fn: () => void): void {
    this.formBridge.registerOnTouched(fn);
  }

  setDisabledState(isDisabled: boolean): void {
    this.formBridge.setDisabledState(isDisabled);
  }

  /**
   * Lo llama cada radio hijo al ser elegido.
   *
   * Marca tocado en el mismo gesto y no al perder el foco: elegir una opción ya
   * es la interacción completa, y esperar al blur retrasaría el mensaje de un
   * grupo obligatorio sin responder.
   */
  select(next: T): void {
    if (this.isDisabled()) {
      return;
    }

    this.value.set(next);
    this.formBridge.emitChange(next);
    this.formBridge.emitTouched();
  }

  isSelected(candidate: T): boolean {
    return this.value() === candidate;
  }
}
