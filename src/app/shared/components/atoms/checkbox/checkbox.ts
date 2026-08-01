import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

import { injectFormControl } from '@shared/forms/inject-form-control';

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
  readonly checked = model<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly label = input<string>('');
  readonly hasError = input<boolean>(false);

  private readonly form = injectFormControl('checkbox', this.hasError);

  protected readonly controlId = this.form.controlId;
  protected readonly describedBy = this.form.describedBy;
  protected readonly required = this.form.required;
  protected readonly invalid = this.form.invalid;

  /** El `change` nativo ya trae el estado nuevo: se toma de ahí, sin invertir. */
  protected handleChange(event: Event): void {
    this.checked.set((event.target as HTMLInputElement).checked);
  }
}
