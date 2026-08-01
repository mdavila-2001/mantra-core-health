import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';

import {
  FORM_CONTROL_CONTEXT,
  nextControlId,
} from '../../form-control/form-control.context';

/**
 * Grupo de radios. **El grupo es el control**, no cada radio: acá vive el
 * `value` y de él se deriva cuál está marcado, así la exclusión mutua es
 * estructural en vez de depender de que cada radio se desmarque solo.
 *
 * ```html
 * <app-form-field label="Tipo de usuario">
 *   <app-radio-group [(value)]="tipoUsuario">
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
    '[attr.aria-disabled]': 'disabled()',
  },
})
export class RadioGroup<T = unknown> {
  private readonly field = inject(FORM_CONTROL_CONTEXT, { optional: true });

  readonly value = model<T | null>(null);
  readonly disabled = input<boolean>(false);
  readonly hasError = input<boolean>(false);

  /** Agrupa los `<input type="radio">` nativos; se autogenera si no se pasa. */
  readonly name = input<string>(nextControlId('radio-group'));

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

  /** Lo llama cada radio hijo al ser elegido. */
  select(next: T): void {
    if (this.disabled()) {
      return;
    }
    this.value.set(next);
  }

  isSelected(candidate: T): boolean {
    return this.value() === candidate;
  }
}
