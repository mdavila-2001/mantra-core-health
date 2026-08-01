import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';

import {
  FORM_CONTROL_CONTEXT,
  nextControlId,
} from '../../form-control/form-control.context';
import { createValueAccessorBridge } from '../../form-control/value-accessor';
import type { InputType } from './input.types';

@Component({
  selector: 'app-input',
  templateUrl: './input.html',
  styleUrl: './input.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.app-input-host]': 'true',
    '[class.is-disabled]': 'isDisabled()',
  },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => Input),
      multi: true,
    },
  ],
})
export class Input implements ControlValueAccessor {
  private readonly field = inject(FORM_CONTROL_CONTEXT, { optional: true });

  /** Puente con el formulario. Vacío e inofensivo si el control va suelto. */
  private readonly formBridge = createValueAccessorBridge<string | number | null>();

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

  /**
   * Deshabilitado por la plantilla **o** por el formulario. Son dos fuentes
   * independientes y basta con que una lo pida; `disabled` es un `input()` de
   * solo lectura, así que `setDisabledState` no puede escribirlo.
   */
  protected readonly isDisabled = computed(
    () => this.disabled() || this.formBridge.disabledByForm(),
  );

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
    if (this.isDisabled()) {
      classes.push('is-disabled');
    }
    if (this.type() === 'number') {
      classes.push('tabular-nums');
    }
    return classes.join(' ');
  });

  // --- ControlValueAccessor ------------------------------------------------
  // Sólo se avisa al formulario de los cambios que hace la persona. `writeValue`
  // escribe la señal y NO llama a `emitChange`: hacerlo devolvería al formulario
  // el valor que él mismo acaba de mandar.

  writeValue(value: string | number | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string | number | null) => void): void {
    this.formBridge.registerOnChange(fn);
  }

  registerOnTouched(fn: () => void): void {
    this.formBridge.registerOnTouched(fn);
  }

  setDisabledState(isDisabled: boolean): void {
    this.formBridge.setDisabledState(isDisabled);
  }

  /**
   * Único punto por donde entra un valor puesto por la persona: escribe la
   * señal y avisa al formulario. Tenerlo en un solo lugar es lo que evita que
   * un camino nuevo se olvide de avisar.
   */
  private commit(value: string | number | null): void {
    this.value.set(value);
    this.formBridge.emitChange(value);
  }

  protected handleInput(event: Event): void {
    const target = event.target as HTMLInputElement;

    if (this.type() !== 'number') {
      this.commit(target.value);
      return;
    }

    // `valueAsNumber` es NaN con el campo vacío — y **0 es un valor válido**,
    // así que no se puede usar `||` para elegir: en clínica el 0 es un dato.
    const asNumber = target.valueAsNumber;
    this.commit(Number.isNaN(asNumber) ? null : asNumber);
  }

  protected handleFocus(event: FocusEvent): void {
    this.isFocused.set(true);
    this.focused.emit(event);
  }

  protected handleBlur(event: FocusEvent): void {
    this.isFocused.set(false);
    this.normalizeValue();
    // Se marca tocado después de normalizar, para que el formulario valide el
    // valor ya limpio y no el que la persona dejó a medias.
    this.formBridge.emitTouched();
    this.blurred.emit(event);
  }

  protected togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  protected clearSearch(): void {
    this.commit('');
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
        this.commit(withoutSpaces);
      }
      return;
    }

    if (this.type() === 'url') {
      const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
      if (withScheme !== raw) {
        this.commit(withScheme);
      }
      return;
    }

    if (trimmed !== raw) {
      this.commit(trimmed);
    }
  }
}
