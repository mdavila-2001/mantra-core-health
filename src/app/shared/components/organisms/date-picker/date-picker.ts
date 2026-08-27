import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';

import { AppButton } from '../../atoms/button/button';
import {
  type DatePickerMode,
  MIN_DEFAULT_YEAR,
  MAX_DEFAULT_YEAR,
} from './date-picker.types';
import {
  FORM_CONTROL_CONTEXT,
  nextControlId,
} from '../../../forms/form-control.context';

export interface CalendarDay {
  readonly date: Date;
  readonly dayNumber: number;
  readonly isCurrentMonth: boolean;
  readonly isToday: boolean;
  readonly isSelected: boolean;
  readonly isDisabled: boolean;
}

/** Locale del producto: Bolivia. Un solo lugar, no repetido por llamada. */
const LOCALE = 'es-BO';

const DAYS_PER_WEEK = 7;
const MINUTE_STEP = 5;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

/** Mediodía: evita que un cambio de huso corra la fecha al día anterior. */
const SAFE_HOUR = 12;

const MONTH_FORMAT: Intl.DateTimeFormatOptions = { month: 'long' };
const WEEKDAY_FORMAT: Intl.DateTimeFormatOptions = { weekday: 'short' };
const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
};
const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  ...DATE_FORMAT,
  hour: '2-digit',
  minute: '2-digit',
};
const FULL_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
};

const MASK_TEMPLATE = 'DD/MM/AAAA';

/** Formatea una fecha local a DD/MM/AAAA. */
function formatDateOnly(date: Date): string {
  const dia = String(date.getDate()).padStart(2, '0');
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const anio = date.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

/** Parsea una cadena de texto DD/MM/AAAA o similar a Date local a SAFE_HOUR. */
function parseDateOnly(text: string): Date | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed === MASK_TEMPLATE || /[DMA]/.test(trimmed)) return null;
  const match = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(trimmed);
  if (!match) return null;
  const day = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const year = Number.parseInt(match[3], 10);
  if (month < 1 || month > 12 || year < 1000 || year > 9999 || day < 1) {
    return null;
  }
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) {
    return null;
  }
  return new Date(year, month - 1, day, SAFE_HOUR, 0, 0, 0);
}

/** Nombres desde `Intl`: no se duplican a mano ni quedan pegados a un idioma. */
function buildMonthNames(): readonly string[] {
  const format = new Intl.DateTimeFormat(LOCALE, MONTH_FORMAT);
  return Array.from({ length: 12 }, (_, month) => format.format(new Date(2024, month, 1)));
}

/** Semana que empieza en lunes, como el calendario local. */
function buildWeekDayNames(): readonly string[] {
  const format = new Intl.DateTimeFormat(LOCALE, WEEKDAY_FORMAT);
  // 2024-01-01 fue lunes.
  return Array.from({ length: DAYS_PER_WEEK }, (_, offset) =>
    format.format(new Date(2024, 0, 1 + offset)),
  );
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Selector de fecha con ingreso por teclado y diálogo modal.
 *
 * El modal gestiona el foco de verdad: lo mueve adentro al abrir, lo devuelve
 * al disparador al cerrar, lo atrapa con Tab y cierra con Escape. Sin eso un
 * `role="dialog"` es solo una etiqueta.
 */
@Component({
  selector: 'app-date-picker',
  standalone: true,
  imports: [AppButton],
  templateUrl: './date-picker.html',
  styleUrl: './date-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.app-date-picker-host]': 'true',
    '[class.is-disabled]': 'disabled()',
  },
})
export class DatePicker {
  private readonly field = inject(FORM_CONTROL_CONTEXT, { optional: true });

  readonly value = model<Date | null>(null);
  readonly mode = input<DatePickerMode>('date-only');
  readonly disabled = input<boolean>(false);
  readonly placeholder = input<string>('DD/MM/AAAA');
  readonly hasError = input<boolean>(false);
  readonly minDate = input<Date | string | null>(null);
  readonly maxDate = input<Date | string | null>(null);
  readonly allowKeyboard = input<boolean>(true);

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');

  protected readonly isOpen = signal(false);

  /** Texto mostrado en el input editable. */
  protected readonly inputText = signal<string>('');
  protected readonly parseError = signal<boolean>(false);

  /** Fecha en edición mientras el modal está abierto; se descarta al cancelar. */
  protected readonly draft = signal<Date | null>(null);
  protected readonly viewMonth = signal<Date>(startOfMonth(new Date(MAX_DEFAULT_YEAR, 0, 1)));

  protected readonly monthNames = buildMonthNames();
  protected readonly weekDayNames = buildWeekDayNames();
  protected readonly hourOptions = Array.from({ length: HOURS_PER_DAY }, (_, hour) => hour);
  protected readonly minuteOptions = Array.from(
    { length: MINUTES_PER_HOUR / MINUTE_STEP },
    (_, index) => index * MINUTE_STEP,
  );

  private readonly ownId = nextControlId('date');
  protected readonly controlId = computed(() => this.field?.controlId() ?? this.ownId);
  protected readonly describedBy = computed(() => this.field?.describedBy() ?? null);
  protected readonly invalid = computed(
    () => this.hasError() || this.field?.invalid() === true || this.parseError(),
  );

  protected readonly normalizedMinDate = computed<Date | null>(() => {
    const min = this.minDate();
    if (!min) return null;
    if (min instanceof Date) return min;
    if (min === 'today') {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    }
    const d = new Date(min);
    return Number.isNaN(d.getTime()) ? null : d;
  });

  protected readonly normalizedMaxDate = computed<Date | null>(() => {
    const max = this.maxDate();
    if (!max) return null;
    if (max instanceof Date) return max;
    if (max === 'today') {
      const d = new Date();
      d.setHours(23, 59, 59, 999);
      return d;
    }
    const d = new Date(max);
    return Number.isNaN(d.getTime()) ? null : d;
  });

  protected readonly years = computed<number[]>(() => {
    const min = this.normalizedMinDate()?.getFullYear() ?? MIN_DEFAULT_YEAR;
    const viewYear = this.viewMonth().getFullYear();
    const valYear = this.value()?.getFullYear() ?? 0;
    const maxLimit = this.normalizedMaxDate()?.getFullYear();

    const maxYear = maxLimit ?? Math.max(MAX_DEFAULT_YEAR, viewYear, valYear);
    const minYear = Math.min(min, maxYear);

    const list: number[] = [];
    for (let y = maxYear; y >= minYear; y--) {
      list.push(y);
    }
    return list;
  });

  protected readonly displayValue = computed(() => {
    const current = this.value();
    if (!current) {
      return '';
    }
    const options = this.mode() === 'date-time' ? DATE_TIME_FORMAT : DATE_FORMAT;
    return new Intl.DateTimeFormat(LOCALE, options).format(current);
  });

  protected readonly draftHours = computed(() => this.draft()?.getHours() ?? SAFE_HOUR);
  protected readonly draftMinutes = computed(() => this.draft()?.getMinutes() ?? 0);

  protected readonly viewLabel = computed(() => {
    const month = this.viewMonth();
    return `${this.monthNames[month.getMonth()]} ${month.getFullYear()}`;
  });

  /**
   * Grilla del mes en vista, siempre en semanas completas de lunes a domingo.
   * Deshabilita los días fuera del rango permitido por `minDate` y `maxDate`.
   */
  protected readonly calendarDays = computed<CalendarDay[]>(() => {
    const view = this.viewMonth();
    const year = view.getFullYear();
    const month = view.getMonth();
    const today = new Date();
    const selected = this.draft();

    const min = this.normalizedMinDate();
    const max = this.normalizedMaxDate();
    const minTime = min
      ? new Date(min.getFullYear(), min.getMonth(), min.getDate()).getTime()
      : null;
    const maxTime = max
      ? new Date(max.getFullYear(), max.getMonth(), max.getDate()).getTime()
      : null;

    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % DAYS_PER_WEEK;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells =
      Math.ceil((firstWeekday + daysInMonth) / DAYS_PER_WEEK) * DAYS_PER_WEEK;

    return Array.from({ length: totalCells }, (_, cell) => {
      const date = new Date(year, month, cell - firstWeekday + 1);
      const dayTime = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const isDisabled =
        (minTime !== null && dayTime < minTime) ||
        (maxTime !== null && dayTime > maxTime);

      return {
        date,
        dayNumber: date.getDate(),
        isCurrentMonth: date.getMonth() === month,
        isToday: isSameDay(date, today),
        isSelected: selected !== null && isSameDay(date, selected),
        isDisabled,
      };
    });
  });

  constructor() {
    // Sincronizar el texto del input cuando el valor del modelo cambia
    effect(() => {
      const val = this.value();
      if (val) {
        this.inputText.set(formatDateOnly(val));
        this.parseError.set(false);
      } else if (!this.parseError()) {
        this.inputText.set('');
      }
    });

    // El diálogo se abre y el foco entra recién cuando el @if lo pintó
    effect(() => {
      const dialog = this.dialog()?.nativeElement;
      if (!dialog) {
        return;
      }
      this.showModal(dialog);
      dialog.focus();
    });
  }

  private showModal(dialog: HTMLDialogElement): void {
    if (dialog.open) {
      return;
    }
    if (typeof dialog.showModal === 'function') {
      dialog.showModal();
      return;
    }
    dialog.setAttribute('open', '');
  }

  protected dayLabel(day: CalendarDay): string {
    return new Intl.DateTimeFormat(LOCALE, FULL_DATE_FORMAT).format(day.date);
  }

  protected handleFocus(): void {
    const input = this.inputEl()?.nativeElement;
    const current = input ? input.value : this.inputText();
    if (!current || current === '') {
      this.inputText.set(MASK_TEMPLATE);
      if (input) {
        input.value = MASK_TEMPLATE;
        input.setSelectionRange(0, 0);
      }
    }
  }

  protected handleInputKeydown(event: KeyboardEvent): void {
    const input = event.target as HTMLInputElement;

    // Permitir atajos con teclas modificadoras y teclas especiales de navegación
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.key === 'Tab' ||
      event.key === 'Escape' ||
      event.key === 'ArrowLeft' ||
      event.key === 'ArrowRight' ||
      event.key === 'ArrowUp' ||
      event.key === 'ArrowDown' ||
      event.key === 'Home' ||
      event.key === 'End'
    ) {
      return;
    }

    if (event.key === 'Enter') {
      this.handleTextBlur();
      return;
    }

    if (event.key === '/') {
      this.handleSlashKey(input);
      event.preventDefault();
      return;
    }

    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      this.handleDigitKey(input, event.key);
      return;
    }

    if (event.key === 'Backspace') {
      event.preventDefault();
      this.handleBackspaceKey(input);
      return;
    }

    if (event.key === 'Delete') {
      event.preventDefault();
      this.handleDeleteKey(input);
      return;
    }

    // Bloquear cualquier otro carácter no deseado
    if (event.key.length === 1) {
      event.preventDefault();
    }
  }

  private handleSlashKey(input: HTMLInputElement): void {
    const pos = input.selectionStart ?? 0;
    if (pos <= 2) {
      input.setSelectionRange(3, 3);
    } else if (pos <= 5) {
      input.setSelectionRange(6, 6);
    }
  }

  private handleDigitKey(input: HTMLInputElement, digit: string): void {
    let pos = input.selectionStart ?? 0;
    const current = input.value.length === 10 ? input.value : MASK_TEMPLATE;
    const chars = current.split('');

    if (pos === 2 || pos === 5) {
      pos++;
    }
    if (pos > 9) return;

    chars[pos] = digit;
    chars[2] = '/';
    chars[5] = '/';

    const nextText = chars.join('');
    this.inputText.set(nextText);
    input.value = nextText;

    let nextPos = pos + 1;
    if (nextPos === 2 || nextPos === 5) {
      nextPos++;
    }
    input.setSelectionRange(nextPos, nextPos);
    this.checkCompleteMask(nextText);
  }

  private handleBackspaceKey(input: HTMLInputElement): void {
    const pos = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? pos;
    const current = input.value.length === 10 ? input.value : MASK_TEMPLATE;
    const chars = current.split('');

    if (end > pos) {
      for (let i = pos; i < end; i++) {
        if (i !== 2 && i !== 5) {
          chars[i] = MASK_TEMPLATE[i];
        }
      }
      chars[2] = '/';
      chars[5] = '/';
      const nextText = chars.join('');
      this.inputText.set(nextText);
      input.value = nextText;
      input.setSelectionRange(pos, pos);
      this.checkCompleteMask(nextText);
      return;
    }

    if (pos === 0) return;
    let targetPos = pos - 1;
    if (targetPos === 2 || targetPos === 5) {
      targetPos--;
    }
    if (targetPos < 0) return;

    chars[targetPos] = MASK_TEMPLATE[targetPos];
    chars[2] = '/';
    chars[5] = '/';

    const nextText = chars.join('');
    this.inputText.set(nextText);
    input.value = nextText;
    input.setSelectionRange(targetPos, targetPos);
    this.checkCompleteMask(nextText);
  }

  private handleDeleteKey(input: HTMLInputElement): void {
    let pos = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? pos;
    const current = input.value.length === 10 ? input.value : MASK_TEMPLATE;
    const chars = current.split('');

    if (end > pos) {
      for (let i = pos; i < end; i++) {
        if (i !== 2 && i !== 5) {
          chars[i] = MASK_TEMPLATE[i];
        }
      }
      chars[2] = '/';
      chars[5] = '/';
      const nextText = chars.join('');
      this.inputText.set(nextText);
      input.value = nextText;
      input.setSelectionRange(pos, pos);
      this.checkCompleteMask(nextText);
      return;
    }

    if (pos === 2 || pos === 5) {
      pos++;
    }
    if (pos > 9) return;

    chars[pos] = MASK_TEMPLATE[pos];
    chars[2] = '/';
    chars[5] = '/';

    const nextText = chars.join('');
    this.inputText.set(nextText);
    input.value = nextText;
    let nextPos = pos + 1;
    if (nextPos === 2 || nextPos === 5) {
      nextPos++;
    }
    input.setSelectionRange(nextPos, nextPos);
    this.checkCompleteMask(nextText);
  }

  protected handlePaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text') ?? '';
    const digits = pasted.replace(/\D/g, '');
    if (digits.length >= 8) {
      let day: string;
      let month: string;
      let year: string;

      if (pasted.includes('-') && pasted.length === 10) {
        const parts = pasted.split('-');
        [year, month, day] = parts;
      } else {
        day = digits.slice(0, 2);
        month = digits.slice(2, 4);
        year = digits.slice(4, 8);
      }
      const formatted = `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
      this.inputText.set(formatted);
      const input = this.inputEl()?.nativeElement;
      if (input) input.value = formatted;
      this.checkCompleteMask(formatted);
    }
  }

  protected handleTextInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    if (raw === '' || raw === MASK_TEMPLATE) {
      this.inputText.set(raw);
      this.checkCompleteMask(raw);
      return;
    }
    // Si viene texto formateado o pegado vía autofill
    if (raw.length === 10 && !/[DMA]/.test(raw)) {
      this.inputText.set(raw);
      this.checkCompleteMask(raw);
    }
  }

  private checkCompleteMask(text: string): void {
    if (text === '' || text === MASK_TEMPLATE) {
      this.parseError.set(false);
      this.value.set(null);
      return;
    }

    if (text.length === 10 && !/[DMA]/.test(text)) {
      const parsed = parseDateOnly(text);
      if (parsed) {
        if (this.isOutOfRange(parsed)) {
          this.parseError.set(true);
        } else {
          this.parseError.set(false);
          this.value.set(parsed);
        }
      } else {
        this.parseError.set(true);
      }
    }
  }

  protected handleTextBlur(): void {
    const input = this.inputEl()?.nativeElement;
    const raw = input ? input.value : this.inputText();
    const text = raw.trim();

    if (!text || text === MASK_TEMPLATE) {
      this.inputText.set('');
      if (input) input.value = '';
      this.parseError.set(false);
      this.value.set(null);
      return;
    }
    if (/[DMA]/.test(text)) {
      this.parseError.set(true);
      return;
    }
    const parsed = parseDateOnly(text);
    if (!parsed || this.isOutOfRange(parsed)) {
      this.parseError.set(true);
    } else {
      this.parseError.set(false);
      this.value.set(parsed);
      const formatted = formatDateOnly(parsed);
      this.inputText.set(formatted);
      if (input) input.value = formatted;
    }
  }

  private isOutOfRange(date: Date): boolean {
    const time = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const min = this.normalizedMinDate();
    if (min) {
      const minTime = new Date(min.getFullYear(), min.getMonth(), min.getDate()).getTime();
      if (time < minTime) return true;
    }
    const max = this.normalizedMaxDate();
    if (max) {
      const maxTime = new Date(max.getFullYear(), max.getMonth(), max.getDate()).getTime();
      if (time > maxTime) return true;
    }
    return false;
  }

  protected open(): void {
    if (this.disabled()) {
      return;
    }
    const defaultYear = Math.min(
      this.normalizedMaxDate()?.getFullYear() ?? MAX_DEFAULT_YEAR,
      MAX_DEFAULT_YEAR,
    );
    const start = this.value() ?? this.withSafeHour(new Date(defaultYear, 0, 1));
    this.draft.set(start);
    this.viewMonth.set(startOfMonth(start));
    this.isOpen.set(true);
  }

  protected close(): void {
    if (!this.isOpen()) {
      return;
    }
    const dialog = this.dialog()?.nativeElement;
    if (dialog?.open && typeof dialog.close === 'function') {
      dialog.close();
    }
    this.isOpen.set(false);
    const el = this.inputEl()?.nativeElement ?? this.trigger()?.nativeElement;
    el?.focus();
  }

  protected handleBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog()?.nativeElement) {
      this.close();
    }
  }

  protected confirm(): void {
    const draft = this.draft();
    if (draft && !this.isOutOfRange(draft)) {
      this.value.set(draft);
      this.parseError.set(false);
    }
    this.close();
  }

  protected selectDay(day: CalendarDay): void {
    if (day.isDisabled) {
      return;
    }
    const draft = this.draft();
    const next = new Date(day.date);
    next.setHours(draft?.getHours() ?? SAFE_HOUR, draft?.getMinutes() ?? 0, 0, 0);
    this.draft.set(next);
  }

  protected shiftMonth(offset: number): void {
    const view = this.viewMonth();
    this.viewMonth.set(new Date(view.getFullYear(), view.getMonth() + offset, 1));
  }

  protected shiftYear(offset: number): void {
    const view = this.viewMonth();
    this.viewMonth.set(new Date(view.getFullYear() + offset, view.getMonth(), 1));
  }

  protected setMonth(event: Event): void {
    const month = Number((event.target as HTMLSelectElement).value);
    const view = this.viewMonth();
    this.viewMonth.set(new Date(view.getFullYear(), month, 1));
  }

  protected setYear(event: Event): void {
    const year = Number((event.target as HTMLSelectElement).value);
    const view = this.viewMonth();
    this.viewMonth.set(new Date(year, view.getMonth(), 1));
  }

  protected updateHours(event: Event): void {
    this.patchDraftTime(Number((event.target as HTMLSelectElement).value), null);
  }

  protected updateMinutes(event: Event): void {
    this.patchDraftTime(null, Number((event.target as HTMLSelectElement).value));
  }

  protected handleDialogKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key === 'Tab') {
      this.keepFocusInside(event);
    }
  }

  private patchDraftTime(hours: number | null, minutes: number | null): void {
    const base = this.draft() ?? this.withSafeHour(new Date());
    const next = new Date(base);
    next.setHours(hours ?? base.getHours(), minutes ?? base.getMinutes(), 0, 0);
    this.draft.set(next);
  }

  private withSafeHour(date: Date): Date {
    const copy = new Date(date);
    copy.setHours(SAFE_HOUR, 0, 0, 0);
    return copy;
  }

  private keepFocusInside(event: KeyboardEvent): void {
    const host = this.dialog()?.nativeElement;
    if (!host) {
      return;
    }
    const focusables = host.querySelectorAll<HTMLElement>(
      'button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) {
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = host.ownerDocument.activeElement;

    if (event.shiftKey && (active === first || active === host)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }
}

