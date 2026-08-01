import { ChangeDetectionStrategy, Component, input, model } from '@angular/core';

import { injectFormControl } from '@shared/forms/inject-form-control';

/**
 * Interruptor binario. Es un `<input type="checkbox">` con `role="switch"`:
 * la plataforma aporta el teclado (Espacio) y el anuncio de estado, y el rol
 * cambia cómo lo lee un lector — «activado» en vez de «marcado».
 */
@Component({
  selector: 'app-switch',
  templateUrl: './switch.html',
  styleUrl: './switch.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.app-switch-host]': 'true',
    '[class.is-disabled]': 'disabled()',
  },
})
export class SwitchComponent {
  readonly checked = model<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly label = input<string>('');

  private readonly form = injectFormControl('switch');

  protected readonly controlId = this.form.controlId;
  protected readonly describedBy = this.form.describedBy;

  protected handleChange(event: Event): void {
    this.checked.set((event.target as HTMLInputElement).checked);
  }
}
