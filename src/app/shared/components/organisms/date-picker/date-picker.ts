import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  model,
  signal,
  viewChild,
} from '@angular/core';

import { AppButton } from '../../atoms/button/button';
import { type DatePickerMode, MAX_DEFAULT_YEAR } from './date-picker.types';
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

/** Celda de la grilla de años: uno de los treinta que muestra la página. */
export interface YearCell {
  readonly year: number;
  readonly isSelected: boolean;
  readonly isDisabled: boolean;
}

/** Celda de la grilla de meses del año en vista. */
export interface MonthCell {
  readonly month: number;
  readonly name: string;
  readonly isSelected: boolean;
  readonly isDisabled: boolean;
}

/** Nivel visible del diálogo: días del mes, meses del año o años de la página. */
type PickerPanel = 'days' | 'months' | 'years';

/** Locale del producto: Bolivia. Un solo lugar, no repetido por llamada. */
const LOCALE = 'es-BO';

const DAYS_PER_WEEK = 7;
const MONTHS_PER_YEAR = 12;
const MINUTE_STEP = 5;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;

const YEARS_PER_DECADE = 10;

/** La página de años abarca tres décadas: la del año en vista y las dos previas. */
const DECADES_PER_YEAR_PAGE = 3;

/** Treinta años por página, en cinco columnas por seis filas. */
const YEARS_PER_PAGE = YEARS_PER_DECADE * DECADES_PER_YEAR_PAGE;

/** Cinco columnas de años: las seis filas igualan el alto de la grilla de días. */
const YEAR_GRID_COLUMNS = 5;

/** Los doce meses entran en cuatro columnas por tres filas. */
const MONTH_GRID_COLUMNS = 4;

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
  return Array.from({ length: MONTHS_PER_YEAR }, (_, month) =>
    format.format(new Date(2024, month, 1)),
  );
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

/** Primer año de la década que contiene a `year`: 1985 → 1980. */
function startOfDecade(year: number): number {
  return Math.floor(year / YEARS_PER_DECADE) * YEARS_PER_DECADE;
}

/**
 * Primer año de la página que contiene a `year` en su última década: 1985 →
 * 1960, 2000 → 1980. Mirar hacia atrás es lo que acerca los años de nacimiento,
 * que es lo que se busca en un calendario clínico.
 */
function startOfYearPage(year: number): number {
  return startOfDecade(year) - (DECADES_PER_YEAR_PAGE - 1) * YEARS_PER_DECADE;
}

/** Medianoche local: compara fechas por día, sin que la hora corra el límite. */
function dayTime(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Primera celda utilizable a partir de la preferida: el foco nunca queda sobre
 * una celda fuera de rango, que no se puede elegir ni enfocar.
 */
function usableCell(
  cells: readonly { readonly isDisabled: boolean }[],
  preferred: number,
): number {
  const clamped = Math.min(Math.max(preferred, 0), cells.length - 1);
  if (!cells[clamped].isDisabled) {
    return clamped;
  }
  const utilizable = cells.findIndex((cell) => !cell.isDisabled);
  return utilizable >= 0 ? utilizable : clamped;
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

  private readonly injector = inject(Injector);

  private readonly dialog = viewChild<ElementRef<HTMLDialogElement>>('dialog');
  private readonly trigger = viewChild<ElementRef<HTMLButtonElement>>('trigger');
  private readonly inputEl = viewChild<ElementRef<HTMLInputElement>>('inputEl');
  private readonly viewSwitch = viewChild<ElementRef<HTMLButtonElement>>('viewSwitch');

  protected readonly isOpen = signal(false);

  /** Nivel visible del diálogo. El encabezado sube y baja entre los tres. */
  protected readonly panel = signal<PickerPanel>('days');

  /** Primer año de los treinta que muestra la grilla de años. */
  protected readonly yearPageStart = signal<number>(startOfYearPage(MAX_DEFAULT_YEAR));

  /** Roving tabindex: la única celda tabulable de la grilla vigente. */
  protected readonly activeCell = signal<number>(0);

  /** Texto mostrado en el input editable. */
  protected readonly inputText = signal<string>('');
  protected readonly parseError = signal<boolean>(false);

  /** Fecha en edición mientras el modal está abierto; se descarta al cancelar. */
  protected readonly draft = signal<Date | null>(null);

  /**
   * Si hay una fecha **elegida**, y no sólo un calendario parado en algún mes.
   *
   * Son dos cosas distintas y hasta ahora se confundían: al abrir sin valor,
   * `open()` sembraba el borrador con el 1 de enero del año por defecto —lo
   * necesita para saber qué mes dibujar— y «Confirmar» aceptaba **esa** fecha,
   * que nadie eligió. El síntoma es una fecha de nacimiento 01/01/2000 en el
   * perfil de alguien que sólo tocó el botón.
   *
   * Nace en `true` cuando el campo ya traía valor: ahí sí hay día, mes y año, y
   * confirmar sin tocar nada es legítimo —es aceptar lo que ya estaba—.
   */
  private readonly dayChosen = signal(false);

  /**
   * No se confirma sin día, mes y año.
   *
   * El año y el mes vienen implícitos en el día: el calendario sólo ofrece días
   * del mes que está mostrando, así que elegir uno fija los tres a la vez. Lo
   * que faltaba era exigir ese clic.
   */
  protected readonly canConfirm = computed(() => {
    const draft = this.draft();
    return this.dayChosen() && draft !== null && !this.isOutOfRange(draft);
  });
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

  /**
   * Los treinta años consecutivos de la página en vista: cinco columnas por
   * seis filas, todos elegibles de un toque y sin vecinos atenuados.
   */
  protected readonly yearCells = computed<YearCell[]>(() => {
    const start = this.yearPageStart();
    const viewYear = this.viewMonth().getFullYear();

    return Array.from({ length: YEARS_PER_PAGE }, (_, index) => {
      const year = start + index;
      return {
        year,
        isSelected: year === viewYear,
        isDisabled: this.isYearOutOfRange(year),
      };
    });
  });

  /** Los doce meses del año en vista, sin los que quedan fuera del rango. */
  protected readonly monthCells = computed<MonthCell[]>(() => {
    const view = this.viewMonth();
    const year = view.getFullYear();

    return this.monthNames.map((name, month) => ({
      month,
      name,
      isSelected: month === view.getMonth(),
      isDisabled: this.isMonthOutOfRange(year, month),
    }));
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
   * Texto de la región viva del diálogo. Cambiar de panel o de mes no mueve el
   * foco, así que sin esto el cambio no llega a quien usa lector de pantalla.
   */
  protected readonly panelAnnouncement = computed(() => {
    const view = this.viewMonth();

    switch (this.panel()) {
      case 'years': {
        const start = this.yearPageStart();
        return `Años ${start} a ${start + YEARS_PER_PAGE - 1}`;
      }
      case 'months':
        return `Meses de ${view.getFullYear()}`;
      default:
        return `${this.monthNames[view.getMonth()]} de ${view.getFullYear()}`;
    }
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
    const minTime = min ? dayTime(min) : null;
    const maxTime = max ? dayTime(max) : null;

    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % DAYS_PER_WEEK;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells =
      Math.ceil((firstWeekday + daysInMonth) / DAYS_PER_WEEK) * DAYS_PER_WEEK;

    return Array.from({ length: totalCells }, (_, cell) => {
      const date = new Date(year, month, cell - firstWeekday + 1);
      const cellTime = dayTime(date);
      const isDisabled =
        (minTime !== null && cellTime < minTime) ||
        (maxTime !== null && cellTime > maxTime);

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
    return this.hasNoDayInRange(date, date);
  }

  /** Un año se ofrece solo si alguno de sus días cae dentro del rango. */
  private isYearOutOfRange(year: number): boolean {
    return this.hasNoDayInRange(
      new Date(year, 0, 1),
      new Date(year, MONTHS_PER_YEAR, 0),
    );
  }

  /** Ídem para un mes: el rango puede empezar o terminar dentro de él. */
  private isMonthOutOfRange(year: number, month: number): boolean {
    return this.hasNoDayInRange(new Date(year, month, 1), new Date(year, month + 1, 0));
  }

  /**
   * Verdadero cuando ningún día entre `from` y `to` entra en `minDate`/`maxDate`.
   * Compara por día, el mismo criterio que la grilla del mes.
   */
  private hasNoDayInRange(from: Date, to: Date): boolean {
    const min = this.normalizedMinDate();
    if (min && dayTime(to) < dayTime(min)) {
      return true;
    }
    const max = this.normalizedMaxDate();
    if (max && dayTime(from) > dayTime(max)) {
      return true;
    }
    return false;
  }

  /**
   * En qué mes se para el calendario cuando el campo viene vacío.
   *
   * Lo decide **el rango del campo**, que es la única señal honesta que hay.
   * Antes lo decidía una constante: se abría siempre en enero de
   * `MAX_DEFAULT_YEAR` —enero de 2000—, una heurística de fecha de nacimiento
   * metida dentro de un componente de uso general. De los veinticinco
   * `app-date-picker` de la aplicación sólo tres piden un nacimiento, y los
   * tres se declaran con `maxDate="today"`. Los otros veintidós son fechas
   * operativas cerca de hoy —vigencia de un precio, rango de un bloqueo de
   * agenda, día de una cita, validez de una receta— y ninguno acota nada:
   * todos abrían a veintiséis años de distancia del día que se buscaba.
   *
   * De ahí las dos ramas: un campo cerrado al pasado conserva el enero de
   * siempre —es lo que deja la página de años en 1980-2009 y un nacimiento
   * típico a un toque—; cualquier otro abre en hoy, recortado contra el rango
   * para no pararse en un mes con todos los días apagados.
   *
   * No elige nada: sólo decide qué dibujar. Confirmar sigue exigiendo un clic
   * en un día, que es lo que cuida `dayChosen`.
   */
  private mesPorDefecto(): Date {
    const hoy = this.withSafeHour(new Date());
    const min = this.normalizedMinDate();
    const max = this.normalizedMaxDate();

    // Campo cerrado al pasado: es una fecha de nacimiento. Se conserva el
    // comportamiento anterior —enero del año por defecto— porque es lo que
    // deja la página de años en 1980-2009 y pone un año de nacimiento típico
    // a un toque, sin paginar.
    if (max && dayTime(max) <= dayTime(hoy)) {
      const anio = Math.min(max.getFullYear(), MAX_DEFAULT_YEAR);
      const enero = this.withSafeHour(new Date(anio, 0, 1));
      return min && dayTime(enero) < dayTime(min) ? min : enero;
    }

    if (min && dayTime(hoy) < dayTime(min)) {
      return min;
    }
    if (max && dayTime(hoy) > dayTime(max)) {
      return max;
    }
    return hoy;
  }

  protected open(): void {
    if (this.disabled()) {
      return;
    }
    const actual = this.value();
    // `start` sólo decide QUÉ MES dibujar; no es una elección. Por eso el
    // borrador se siembra con el valor real —que puede ser `null`— y no con él.
    const start = actual ?? this.mesPorDefecto();
    this.draft.set(actual);
    this.dayChosen.set(actual !== null);
    this.viewMonth.set(startOfMonth(start));
    this.panel.set('days');
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
    // Guarda además del `[disabled]` del botón: el diálogo también se confirma
    // con Enter, y un camino que no pasa por el botón no ve su estado.
    if (!this.canConfirm()) {
      return;
    }
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
    this.dayChosen.set(true);
  }

  protected shiftMonth(offset: number): void {
    if (!this.canShiftMonth(offset)) {
      return;
    }
    const view = this.viewMonth();
    this.viewMonth.set(new Date(view.getFullYear(), view.getMonth() + offset, 1));
  }

  protected shiftYear(offset: number): void {
    if (!this.canShiftYear(offset)) {
      return;
    }
    const view = this.viewMonth();
    this.viewMonth.set(new Date(view.getFullYear() + offset, view.getMonth(), 1));
  }

  /** Una flecha que lleva a un mes entero fuera de rango se apaga. */
  protected canShiftMonth(offset: number): boolean {
    const view = this.viewMonth();
    const target = new Date(view.getFullYear(), view.getMonth() + offset, 1);
    return !this.isMonthOutOfRange(target.getFullYear(), target.getMonth());
  }

  protected canShiftYear(offset: number): boolean {
    const view = this.viewMonth();
    return !this.isMonthOutOfRange(view.getFullYear() + offset, view.getMonth());
  }

  /** Ídem con la página vecina de treinta años de la grilla. */
  protected canShiftYearPage(offset: number): boolean {
    const start = this.yearPageStart() + offset * YEARS_PER_PAGE;
    return !this.hasNoDayInRange(
      new Date(start, 0, 1),
      new Date(start + YEARS_PER_PAGE - 1, MONTHS_PER_YEAR, 0),
    );
  }

  /** El foco se queda en la misma posición de la grilla: el año equivalente. */
  protected shiftYearPage(offset: number): void {
    if (!this.canShiftYearPage(offset)) {
      return;
    }
    this.yearPageStart.update((start) => start + offset * YEARS_PER_PAGE);
    this.activeCell.set(usableCell(this.yearCells(), this.activeCell()));
  }

  /**
   * El encabezado sube al panel de años y vuelve a los días. Los tres niveles
   * son el mismo gesto conocido: año → mes → día.
   */
  protected toggleYearPanel(): void {
    if (this.panel() === 'days') {
      this.showYears();
      return;
    }
    this.showDays();
  }

  protected selectYear(cell: YearCell): void {
    if (cell.isDisabled) {
      return;
    }
    const view = this.viewMonth();
    this.viewMonth.set(new Date(cell.year, view.getMonth(), 1));
    this.showMonths();
  }

  protected selectMonth(cell: MonthCell): void {
    if (cell.isDisabled) {
      return;
    }
    this.viewMonth.set(new Date(this.viewMonth().getFullYear(), cell.month, 1));
    this.showDays();
  }

  protected monthLabel(cell: MonthCell): string {
    return `${cell.name} de ${this.viewMonth().getFullYear()}`;
  }

  private showYears(): void {
    const viewYear = this.viewMonth().getFullYear();
    const start = startOfYearPage(viewYear);
    this.yearPageStart.set(start);
    this.panel.set('years');
    this.activeCell.set(usableCell(this.yearCells(), viewYear - start));
    this.focusAfterRender(() => this.focusActiveCell());
  }

  private showMonths(): void {
    this.panel.set('months');
    this.activeCell.set(usableCell(this.monthCells(), this.viewMonth().getMonth()));
    this.focusAfterRender(() => this.focusActiveCell());
  }

  private showDays(): void {
    if (this.panel() === 'days') {
      return;
    }
    this.panel.set('days');
    // Las celdas que tenían el foco dejan de existir: vuelve al encabezado.
    this.focusAfterRender(() => this.viewSwitch()?.nativeElement.focus());
  }

  /**
   * Teclado de las grillas de años y meses: las flechas mueven el foco entre
   * celdas utilizables, Inicio y Fin van a los bordes, Re Pág y Av Pág cambian
   * de página de años, y Enter o Espacio eligen la celda enfocada.
   */
  protected handleGridKeydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      if (this.panel() !== 'years') {
        return;
      }
      event.preventDefault();
      this.shiftYearPage(event.key === 'PageUp' ? -1 : 1);
      this.focusAfterRender(() => this.focusActiveCell());
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectCell(index);
      return;
    }

    const cells = this.currentCells();
    const target = this.nextCellIndex(cells, index, event.key);
    if (target === null) {
      return;
    }
    event.preventDefault();
    this.activeCell.set(target);
    this.focusActiveCell();
  }

  private selectCell(index: number): void {
    if (this.panel() === 'years') {
      this.selectYear(this.yearCells()[index]);
      return;
    }
    this.selectMonth(this.monthCells()[index]);
  }

  private currentCells(): readonly { readonly isDisabled: boolean }[] {
    return this.panel() === 'years' ? this.yearCells() : this.monthCells();
  }

  /** Una fila de la grilla vigente: los años y los meses no tienen el mismo ancho. */
  private gridColumns(): number {
    return this.panel() === 'years' ? YEAR_GRID_COLUMNS : MONTH_GRID_COLUMNS;
  }

  private nextCellIndex(
    cells: readonly { readonly isDisabled: boolean }[],
    from: number,
    key: string,
  ): number | null {
    const columns = this.gridColumns();

    switch (key) {
      case 'ArrowRight':
        return this.stepCell(cells, from, 1);
      case 'ArrowLeft':
        return this.stepCell(cells, from, -1);
      case 'ArrowDown':
        return this.stepCell(cells, from, columns);
      case 'ArrowUp':
        return this.stepCell(cells, from, -columns);
      case 'Home':
        return usableCell(cells, 0);
      case 'End':
        return this.lastUsableCell(cells);
      default:
        return null;
    }
  }

  /** Avanza en la dirección pedida hasta la primera celda utilizable. */
  private stepCell(
    cells: readonly { readonly isDisabled: boolean }[],
    from: number,
    offset: number,
  ): number {
    const direction = offset > 0 ? 1 : -1;
    for (let next = from + offset; next >= 0 && next < cells.length; next += direction) {
      if (!cells[next].isDisabled) {
        return next;
      }
    }
    return from;
  }

  private lastUsableCell(cells: readonly { readonly isDisabled: boolean }[]): number {
    for (let index = cells.length - 1; index >= 0; index--) {
      if (!cells[index].isDisabled) {
        return index;
      }
    }
    return cells.length - 1;
  }

  private focusActiveCell(): void {
    const cells = this.dialog()?.nativeElement.querySelectorAll<HTMLButtonElement>(
      '.calendar-unit-btn',
    );
    const cell = cells?.[this.activeCell()];
    if (cell && !cell.disabled) {
      cell.focus();
    }
  }

  /** El foco se mueve recién cuando el panel nuevo está en el DOM. */
  private focusAfterRender(move: () => void): void {
    afterNextRender(move, { injector: this.injector });
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
      // Escape cierra de a un nivel: primero el panel abierto, después el diálogo.
      if (this.panel() !== 'days') {
        this.showDays();
        return;
      }
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

