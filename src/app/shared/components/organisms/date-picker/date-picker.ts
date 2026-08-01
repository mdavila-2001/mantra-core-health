import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  model,
  signal,
} from '@angular/core';

import { AppButtonComponent } from '../../atoms/button/button';
import { DialogComponent } from '../dialog/dialog';
import { injectFormControl } from '@shared/forms/inject-form-control';
import type { CalendarDay, DatePickerMode } from './date-picker.types';

export type { CalendarDay, DatePickerMode } from './date-picker.types';

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
 * Selector de fecha con diálogo modal.
 *
 * El modal gestiona el foco de verdad: lo mueve adentro al abrir, lo devuelve
 * al disparador al cerrar, lo atrapa con Tab y cierra con Escape. Sin eso un
 * `role="dialog"` es solo una etiqueta.
 */
@Component({
  selector: 'app-date-picker',
  imports: [AppButtonComponent, DialogComponent],
  templateUrl: './date-picker.html',
  styleUrl: './date-picker.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.app-date-picker-host]': 'true',
    '[class.is-disabled]': 'disabled()',
  },
})
export class DatePickerComponent {
  readonly value = model<Date | null>(null);
  readonly mode = input<DatePickerMode>('date-only');
  readonly disabled = input<boolean>(false);
  readonly placeholder = input<string>('Seleccionar fecha');
  readonly hasError = input<boolean>(false);

  protected readonly isOpen = signal(false);

  /** Fecha en edición mientras el modal está abierto; se descarta al cancelar. */
  protected readonly draft = signal<Date | null>(null);
  protected readonly viewMonth = signal<Date>(startOfMonth(new Date()));

  protected readonly monthNames = buildMonthNames();
  protected readonly weekDayNames = buildWeekDayNames();
  protected readonly hourOptions = Array.from({ length: HOURS_PER_DAY }, (_, hour) => hour);
  protected readonly minuteOptions = Array.from(
    { length: MINUTES_PER_HOUR / MINUTE_STEP },
    (_, index) => index * MINUTE_STEP,
  );

  private readonly form = injectFormControl('date', this.hasError);

  protected readonly controlId = this.form.controlId;
  protected readonly describedBy = this.form.describedBy;
  protected readonly invalid = this.form.invalid;

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
   * `today` sale del mes en vista y no de `new Date()` en cada recálculo, así
   * la señal no depende del reloj mientras el usuario navega.
   */
  protected readonly calendarDays = computed<CalendarDay[]>(() => {
    const view = this.viewMonth();
    const year = view.getFullYear();
    const month = view.getMonth();
    const today = new Date();
    const selected = this.draft();

    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % DAYS_PER_WEEK;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells =
      Math.ceil((firstWeekday + daysInMonth) / DAYS_PER_WEEK) * DAYS_PER_WEEK;

    return Array.from({ length: totalCells }, (_, cell) => {
      const date = new Date(year, month, cell - firstWeekday + 1);
      return {
        date,
        dayNumber: date.getDate(),
        isCurrentMonth: date.getMonth() === month,
        isToday: isSameDay(date, today),
        isSelected: selected !== null && isSameDay(date, selected),
      };
    });
  });

  protected dayLabel(day: CalendarDay): string {
    return new Intl.DateTimeFormat(LOCALE, FULL_DATE_FORMAT).format(day.date);
  }

  protected open(): void {
    if (this.disabled()) {
      return;
    }
    const start = this.value() ?? this.withSafeHour(new Date());
    this.draft.set(start);
    this.viewMonth.set(startOfMonth(start));
    this.isOpen.set(true);
  }

  protected close(): void {
    if (!this.isOpen()) {
      return;
    }
    // El foco vuelve al disparador por `restoreFocusTo` del `app-dialog`.
    this.isOpen.set(false);
  }

  protected confirm(): void {
    const draft = this.draft();
    if (draft) {
      this.value.set(draft);
    }
    this.close();
  }

  protected selectDay(day: CalendarDay): void {
    const draft = this.draft();
    const next = new Date(day.date);
    next.setHours(draft?.getHours() ?? SAFE_HOUR, draft?.getMinutes() ?? 0, 0, 0);
    this.draft.set(next);
  }

  protected shiftMonth(offset: number): void {
    const view = this.viewMonth();
    this.viewMonth.set(new Date(view.getFullYear(), view.getMonth() + offset, 1));
  }

  protected updateHours(event: Event): void {
    this.patchDraftTime(Number((event.target as HTMLSelectElement).value), null);
  }

  protected updateMinutes(event: Event): void {
    this.patchDraftTime(null, Number((event.target as HTMLSelectElement).value));
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

}
