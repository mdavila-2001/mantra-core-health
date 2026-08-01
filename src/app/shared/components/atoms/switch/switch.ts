import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';

import {
  FORM_CONTROL_CONTEXT,
  nextControlId,
} from '../../form-control/form-control.context';

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
export class Switch {
  private readonly field = inject(FORM_CONTROL_CONTEXT, { optional: true });

  readonly checked = model<boolean>(false);
  readonly disabled = input<boolean>(false);
  readonly label = input<string>('');

  private readonly ownId = nextControlId('switch');
  protected readonly controlId = computed(() => this.field?.controlId() ?? this.ownId);
  protected readonly describedBy = computed(() => this.field?.describedBy() ?? null);

  protected handleChange(event: Event): void {
    this.checked.set((event.target as HTMLInputElement).checked);
  }
}
