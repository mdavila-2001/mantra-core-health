import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  model,
} from '@angular/core';
import { NG_VALUE_ACCESSOR, type ControlValueAccessor } from '@angular/forms';

import { createValueAccessorBridge } from '@shared/forms/value-accessor';
import { DatePicker } from './date-picker';

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `AAAA-MM-DD` → fecha local a mediodía (no se corre de día por el huso). `null` si no existe. */
export function isoDayToDate(value: string | null | undefined): Date | null {
  const match = ISO_DAY.exec((value ?? '').trim());
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
    ? date
    : null;
}

/** Fecha local → `AAAA-MM-DD` con sus componentes locales (pasar por UTC correría el día). */
export function dateToIsoDay(date: Date | null): string {
  if (!date || Number.isNaN(date.getTime())) return '';
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Selector de día con valor de texto `AAAA-MM-DD`.
 *
 * Reemplaza al `<input type="date">` del navegador, que se dibuja distinto en
 * cada navegador y sistema. Es el mismo `app-date-picker` del sistema (máscara
 * DD/MM/AAAA, teclado y calendario propio) con el contrato que ya tenían los
 * formularios de fecha como texto: sin fecha, cadena vacía.
 */
@Component({
  selector: 'app-date-string-picker',
  standalone: true,
  imports: [DatePicker],
  template: `
    <app-date-picker
      [value]="date()"
      [disabled]="disabled() || bridge.disabledByForm()"
      [hasError]="hasError()"
      [minDate]="minDate()"
      [maxDate]="maxDate()"
      [placeholder]="placeholder()"
      [ariaLabel]="ariaLabel()"
      [testId]="testId()"
      (valueChange)="pick($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.app-date-string-picker-host]': 'true' },
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateStringPicker),
      multi: true,
    },
  ],
})
export class DateStringPicker implements ControlValueAccessor {
  protected readonly bridge = createValueAccessorBridge<string>();

  /** `AAAA-MM-DD`, o cadena vacía sin fecha. */
  readonly value = model<string | number | null>('');
  readonly disabled = input<boolean>(false);
  readonly hasError = input<boolean>(false);
  readonly placeholder = input<string>('DD/MM/AAAA');
  readonly ariaLabel = input<string>('');
  readonly testId = input<string | null>(null);
  /** `AAAA-MM-DD` o `'today'`. */
  readonly min = input<string | null>(null);
  /** `AAAA-MM-DD` o `'today'`. */
  readonly max = input<string | null>(null);

  protected readonly date = computed(() => isoDayToDate(String(this.value() ?? '')));
  protected readonly minDate = computed(() => this.limit(this.min()));
  protected readonly maxDate = computed(() => this.limit(this.max()));

  private limit(value: string | null): Date | 'today' | null {
    if (value === 'today') return 'today';
    return isoDayToDate(value);
  }

  protected pick(date: Date | null): void {
    const iso = dateToIsoDay(date);
    if (iso === String(this.value() ?? '')) return;
    this.value.set(iso);
    this.bridge.emitChange(iso);
    this.bridge.emitTouched();
  }

  writeValue(value: string | number | null): void {
    this.value.set(value ?? '');
  }
  registerOnChange(fn: (value: string) => void): void {
    this.bridge.registerOnChange(fn);
  }
  registerOnTouched(fn: () => void): void {
    this.bridge.registerOnTouched(fn);
  }
  setDisabledState(isDisabled: boolean): void {
    this.bridge.setDisabledState(isDisabled);
  }
}
