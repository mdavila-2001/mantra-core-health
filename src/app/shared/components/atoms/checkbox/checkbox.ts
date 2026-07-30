import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';

import {
  FORM_CONTROL_CONTEXT,
  nextControlId,
} from '../../form-control/form-control.context';

/**
 * Casilla sobre `<input type="checkbox">` nativo: teclado, foco y anuncio del
 * estado son de la plataforma. La caja del spec se dibuja aparte y el input
 * queda invisible pero presente.
 *
 * `checked` es un `model`, así que ya emite `checkedChange`: no hay un segundo
 * evento propio que pueda contradecirlo.
 */
@Component({
  selector: 'app-checkbox',
  templateUrl: './checkbox.html',
  styleUrl: './checkbox.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.app-checkbox-host]': 'true',
    '[class.is-disabled]': 'disabled()',
  },
})
export class CheckboxComponent {
  private readonly field = inject(FORM_CONTROL_CONTEXT, { optional: true });

  readonly checked = model<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly label = input<string>('');
  readonly hasError = input<boolean>(false);

  private readonly ownId = nextControlId('checkbox');
  protected readonly controlId = computed(() => this.field?.controlId() ?? this.ownId);
  protected readonly describedBy = computed(() => this.field?.describedBy() ?? null);
  protected readonly required = computed(() => this.field?.required() === true);
  protected readonly invalid = computed(
    () => this.hasError() || this.field?.invalid() === true,
  );

  /** El `change` nativo ya trae el estado nuevo: se toma de ahí, sin invertir. */
  protected handleChange(event: Event): void {
    this.checked.set((event.target as HTMLInputElement).checked);
  }
}
