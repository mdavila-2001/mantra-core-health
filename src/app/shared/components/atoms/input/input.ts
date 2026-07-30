import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';

import {
  FORM_CONTROL_CONTEXT,
  nextControlId,
} from '../../form-control/form-control.context';
import type { InputType } from './input.types';

@Component({
  selector: 'app-input',
  templateUrl: './input.html',
  styleUrl: './input.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.app-input-host]': 'true',
    '[class.is-disabled]': 'disabled()',
  },
})
export class InputComponent {
  private readonly field = inject(FORM_CONTROL_CONTEXT, { optional: true });

  readonly type = input<InputType>('text');
  readonly placeholder = input<string>('');
  readonly value = model<string | number | null>('');
  readonly disabled = input<boolean>(false);
  readonly readonly = input<boolean>(false);
  readonly hasError = input<boolean>(false);
  readonly hasSuccess = input<boolean>(false);

  readonly focused = output<FocusEvent>();
  readonly blurred = output<FocusEvent>();

  protected readonly isFocused = signal(false);
  protected readonly passwordVisible = signal(false);

  /** Id propio si el input vive suelto; el del campo si está envuelto. */
  private readonly ownId = nextControlId('input');
  protected readonly controlId = computed(() => this.field?.controlId() ?? this.ownId);
  protected readonly describedBy = computed(() => this.field?.describedBy() ?? null);
  protected readonly required = computed(() => this.field?.required() === true);

  /** El error puede venir del propio control o del campo que lo envuelve. */
  protected readonly invalid = computed(
    () => this.hasError() || this.field?.invalid() === true,
  );

  /** El tipo real del `<input>`: `password` alterna a `text` al revelarse. */
  protected readonly effectiveType = computed(() => {
    if (this.type() === 'password' && this.passwordVisible()) {
      return 'text';
    }
    return this.type();
  });

  protected readonly wrapperClasses = computed(() => {
    const classes = ['input-wrapper'];
    if (this.invalid()) {
      classes.push('status-error');
    } else if (this.hasSuccess()) {
      classes.push('status-success');
    }
    if (this.isFocused()) {
      classes.push('is-focused');
    }
    if (this.disabled()) {
      classes.push('is-disabled');
    }
    if (this.type() === 'number') {
      classes.push('tabular-nums');
    }
    return classes.join(' ');
  });

  protected handleInput(event: Event): void {
    const target = event.target as HTMLInputElement;

    if (this.type() !== 'number') {
      this.value.set(target.value);
      return;
    }

    // `valueAsNumber` es NaN con el campo vacío — y **0 es un valor válido**,
    // así que no se puede usar `||` para elegir: en clínica el 0 es un dato.
    const asNumber = target.valueAsNumber;
    this.value.set(Number.isNaN(asNumber) ? null : asNumber);
  }

  protected handleFocus(event: FocusEvent): void {
    this.isFocused.set(true);
    this.focused.emit(event);
  }

  protected handleBlur(event: FocusEvent): void {
    this.isFocused.set(false);
    this.normalizeValue();
    this.blurred.emit(event);
  }

  protected togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  protected clearSearch(): void {
    this.value.set('');
  }

  /**
   * Normaliza al perder el foco lo que el usuario suele escribir de más.
   *
   * NO se pasa el correo a minúsculas: la parte local de una dirección es
   * sensible a mayúsculas (RFC 5321) y con correos reales de pacientes eso es
   * un riesgo de entrega. Solo se quitan espacios, que nunca son válidos.
   */
  private normalizeValue(): void {
    const raw = this.value();
    if (typeof raw !== 'string') {
      return;
    }
    const trimmed = raw.trim();
    if (!trimmed) {
      return;
    }

    if (this.type() === 'email') {
      const withoutSpaces = trimmed.replace(/\s+/g, '');
      if (withoutSpaces !== raw) {
        this.value.set(withoutSpaces);
      }
      return;
    }

    if (this.type() === 'url') {
      const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      if (withScheme !== raw) {
        this.value.set(withScheme);
      }
      return;
    }

    if (trimmed !== raw) {
      this.value.set(trimmed);
    }
  }
}
