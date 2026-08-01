import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

import {
  FORM_CONTROL_CONTEXT,
  nextControlId,
  type FormControlContext,
} from '../../form-control/form-control.context';

/**
 * Campo de formulario: label, hint, error y obligatoriedad alrededor de
 * cualquier control de entrada.
 *
 * Es **quien genera el `id`** del control y la lista de `aria-describedby`, y
 * los publica por DI (`FORM_CONTROL_CONTEXT`). El control que se le proyecte
 * adentro los toma solo: no hay que pasar `for` ni `id` a mano.
 *
 * ```html
 * <app-form-field label="Nombre" hint="Como figura en el CI" [required]="true">
 *   <app-input type="text" [(value)]="nombre" />
 * </app-form-field>
 * ```
 */
@Component({
  selector: 'app-form-field',
  standalone: true,
  templateUrl: './form-field.html',
  styleUrl: './form-field.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: FORM_CONTROL_CONTEXT, useExisting: FormField }],
  host: {
    '[class.app-form-field-host]': 'true',
  },
})
export class FormField implements FormControlContext {
  readonly label = input<string>('');
  readonly hint = input<string>('');
  readonly errorMessage = input<string>('');
  readonly required = input<boolean>(false);

  /** Lo baja a `false` un control que no puede ser destino de un `for`. */
  readonly controlLabelable = signal(true);

  /** Base de los tres ids del campo; estable entre servidor y cliente. */
  private readonly baseId = nextControlId('field');

  readonly controlId = computed(() => `${this.baseId}-control`);
  readonly labelId = computed(() => `${this.baseId}-label`);
  protected readonly hintId = computed(() => `${this.baseId}-hint`);
  protected readonly errorId = computed(() => `${this.baseId}-error`);

  /** El error reemplaza al hint, así que solo uno de los dos describe al control. */
  readonly describedBy = computed<string | null>(() => {
    if (this.errorMessage()) {
      return this.errorId();
    }
    return this.hint() ? this.hintId() : null;
  });

  readonly invalid = computed(() => this.errorMessage().length > 0);
}
