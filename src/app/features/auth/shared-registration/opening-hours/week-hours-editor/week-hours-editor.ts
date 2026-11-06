import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { AppButton } from '../../../../../shared/components/atoms/button/button';
import { Input } from '../../../../../shared/components/atoms/input/input';
import { Switch } from '../../../../../shared/components/atoms/switch/switch';
import { SegmentedControl } from '../../../../../shared/components/molecules/segmented-control/segmented-control';
import type { SegmentedOption } from '../../../../../shared/components/molecules/segmented-control/segmented-control.types';
import {
  AFTERNOON_SHIFT,
  MAX_SHIFTS_PER_DAY,
  WEEKDAYS,
  dayProblem,
  type DayHours,
  type Shift,
  type WeekHours,
} from '../opening-hours';

const OPEN_CLOSED: readonly SegmentedOption<'open' | 'closed'>[] = [
  { value: 'open', label: 'Abierto' },
  { value: 'closed', label: 'Cerrado' },
];

/**
 * Presentational editor of one site's week: «24 h» shortcut, open/closed per
 * day and up to two shifts. It never owns state: every edit emits a new week.
 */
@Component({
  selector: 'app-week-hours-editor',
  imports: [AppButton, Input, Switch, SegmentedControl],
  templateUrl: './week-hours-editor.html',
  styleUrl: './week-hours-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WeekHoursEditor {
  readonly value = input.required<WeekHours>();
  /** Prefix of every `data-testid`, unique per site. */
  readonly testId = input.required<string>();
  /** Site name for the accessible labels («de la central», «de Sucursal Norte»). */
  readonly siteLabel = input.required<string>();
  readonly valueChange = output<WeekHours>();

  protected readonly weekdays = WEEKDAYS;
  protected readonly openClosed = OPEN_CLOSED;
  protected readonly maxShifts = MAX_SHIFTS_PER_DAY;
  /** Five-minute steps, like the agenda. */
  protected readonly timeStep = 300;
  protected readonly problem = dayProblem;

  protected setAllDay(allDay: boolean): void {
    this.valueChange.emit({ ...this.value(), allDay });
  }

  protected setOpen(index: number, state: 'open' | 'closed'): void {
    this.updateDay(index, (day) => ({ ...day, open: state === 'open' }));
  }

  protected setTime(index: number, shift: number, field: keyof Shift, time: string | number | null): void {
    this.updateDay(index, (day) => ({
      ...day,
      shifts: day.shifts.map((s, i) => (i === shift ? { ...s, [field]: String(time ?? '') } : s)),
    }));
  }

  protected addShift(index: number): void {
    this.updateDay(index, (day) => ({ ...day, shifts: [...day.shifts, AFTERNOON_SHIFT] }));
  }

  protected removeShift(index: number, shift: number): void {
    this.updateDay(index, (day) => ({ ...day, shifts: day.shifts.filter((_, i) => i !== shift) }));
  }

  /** Same hours on every open day: the row the person just filled, copied down. */
  protected copyToOpenDays(index: number): void {
    const source = this.value().days[index];
    this.valueChange.emit({
      ...this.value(),
      days: this.value().days.map((day) => (day.open ? { ...day, shifts: source.shifts } : day)),
    });
  }

  private updateDay(index: number, change: (day: DayHours) => DayHours): void {
    this.valueChange.emit({
      ...this.value(),
      days: this.value().days.map((day, i) => (i === index ? change(day) : day)),
    });
  }
}
