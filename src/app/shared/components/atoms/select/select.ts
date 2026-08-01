import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';

import { injectFormControl } from '@shared/forms/inject-form-control';
import type { SelectOption } from './select.types';

/** Valor del `<option>` que representa «nada elegido». */
const NO_SELECTION = '';

/**
 * Desplegable sobre `<select>` nativo (teclado y accesibilidad de plataforma
 * gratis) con la flecha del sistema apagada y la del spec dibujada aparte.
 *
 * El `<option>` lleva el **índice**, no el valor: el DOM convierte todo a
 * string, así que un value numérico o un objeto volvería corrompido. Con el
 * índice, el valor emitido es literalmente el que entró en `options`.
 */
@Component({
  selector: 'app-select',
  templateUrl: './select.html',
  styleUrl: './select.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.app-select-host]': 'true',
    '[class.is-disabled]': 'disabled()',
  },
})
export class SelectComponent<T> {
  readonly value = model<T | null>(null);
  readonly options = input<readonly SelectOption<T>[]>([]);
  readonly disabled = input<boolean>(false);
  readonly placeholder = input<string>('Seleccionar opción');
  readonly hasError = input<boolean>(false);

  readonly focused = output<FocusEvent>();
  readonly blurred = output<FocusEvent>();

  protected readonly isFocused = signal(false);

  private readonly form = injectFormControl('select', this.hasError);

  protected readonly controlId = this.form.controlId;
  protected readonly describedBy = this.form.describedBy;
  protected readonly required = this.form.required;
  protected readonly invalid = this.form.invalid;

  /** El `<select>` se posiciona por índice; `''` cuando no hay selección. */
  protected readonly selectedIndex = computed(() => {
    const index = this.options().findIndex((option) => option.value === this.value());
    return index >= 0 ? String(index) : NO_SELECTION;
  });

  protected readonly wrapperClasses = computed(() => {
    const classes = ['select-wrapper'];
    if (this.invalid()) {
      classes.push('status-error');
    }
    if (this.isFocused()) {
      classes.push('is-focused');
    }
    if (this.disabled()) {
      classes.push('is-disabled');
    }
    return classes.join(' ');
  });

  protected handleChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    if (target.value === NO_SELECTION) {
      this.value.set(null);
      return;
    }
    const option = this.options()[Number(target.value)];
    this.value.set(option ? option.value : null);
  }

  protected handleFocus(event: FocusEvent): void {
    this.isFocused.set(true);
    this.focused.emit(event);
  }

  protected handleBlur(event: FocusEvent): void {
    this.isFocused.set(false);
    this.blurred.emit(event);
  }
}
