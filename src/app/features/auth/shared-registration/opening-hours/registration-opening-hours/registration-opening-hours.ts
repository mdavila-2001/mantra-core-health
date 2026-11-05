import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { Switch } from '../../../../../shared/components/atoms/switch/switch';
import type { RegistrationHours, WeekHours } from '../opening-hours';
import { WeekHoursEditor } from '../week-hours-editor/week-hours-editor';

/** A branch row as every sign-up keeps it: only its id and name matter here. */
export interface HoursBranch {
  readonly id: string;
  readonly nombre: string;
}

/**
 * The «Horario de atención» step of every organization sign-up: the
 * headquarters week and, for each declared branch, «same as headquarters» or
 * its own week. Presentational: the screen owns the form control.
 */
@Component({
  selector: 'app-registration-opening-hours',
  imports: [Switch, WeekHoursEditor],
  templateUrl: './registration-opening-hours.html',
  styleUrl: './registration-opening-hours.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistrationOpeningHours {
  readonly value = input.required<RegistrationHours>();
  readonly branches = input<readonly HoursBranch[]>([]);
  /** Prefix of every `data-testid`, per screen. */
  readonly testId = input.required<string>();
  readonly valueChange = output<RegistrationHours>();

  /** An unnamed row is not a branch yet: it gets no hours of its own. */
  protected readonly named = computed(() =>
    this.branches().filter((branch) => branch.nombre.trim() !== ''),
  );

  protected own(branchId: string): WeekHours | null {
    return this.value().branches[branchId] ?? null;
  }

  protected setHeadquarters(week: WeekHours): void {
    this.valueChange.emit({ ...this.value(), headquarters: week });
  }

  /** «Same as headquarters» off starts from a copy of it, not from zero. */
  protected setSameAsHeadquarters(branchId: string, same: boolean): void {
    this.setBranch(branchId, same ? null : this.value().headquarters);
  }

  protected setBranch(branchId: string, week: WeekHours | null): void {
    this.valueChange.emit({
      ...this.value(),
      branches: { ...this.value().branches, [branchId]: week },
    });
  }
}
