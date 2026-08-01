import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { nextControlId } from '@shared/forms/form-control.context';
import { RadioGroupComponent } from '../radio-group/radio-group';

/**
 * Opción de un `app-radio-group`. **No guarda estado propio**: su `checked`
 * se deriva del `value` del grupo, así dos radios no pueden quedar marcados a
 * la vez ni aunque el DOM y las señales se desincronicen.
 *
 * Exige estar dentro de un grupo — un radio suelto no significa nada.
 */
@Component({
  selector: 'app-radio',
  templateUrl: './radio.html',
  styleUrl: './radio.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.app-radio-host]': 'true',
    '[class.is-disabled]': 'isDisabled()',
  },
})
export class RadioComponent {
  private readonly group = inject(RadioGroupComponent);

  readonly value = input.required<unknown>();
  readonly label = input<string>('');
  readonly disabled = input<boolean>(false);

  protected readonly inputId = nextControlId('radio');

  /** Único origen de verdad: lo dice el grupo. */
  protected readonly checked = computed(() => this.group.isSelected(this.value()));

  /** El grupo entero puede estar deshabilitado, o solo esta opción. */
  protected readonly isDisabled = computed(() => this.disabled() || this.group.disabled());

  protected readonly name = computed(() => this.group.name());

  protected select(): void {
    if (this.isDisabled()) {
      return;
    }
    this.group.select(this.value());
  }
}
