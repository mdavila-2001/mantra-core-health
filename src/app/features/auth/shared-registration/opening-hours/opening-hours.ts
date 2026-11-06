import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

import type { OpeningHoursShift } from '../../../../core/data-access/iam/organization-branches.types';

/** One opening shift, `HH:MM`. `24:00` only comes from «Abierto las 24 h». */
export interface Shift {
  readonly opensAt: string;
  readonly closesAt: string;
}

/** One weekday: closed, or open with one or two shifts (midday closing). */
export interface DayHours {
  readonly open: boolean;
  readonly shifts: readonly Shift[];
}

/** A site's week, Monday first. `allDay` overrides the days. */
export interface WeekHours {
  readonly allDay: boolean;
  readonly days: readonly DayHours[];
}

/** Headquarters hours and, per branch id, its own week (`null` = same as headquarters). */
export interface RegistrationHours {
  readonly headquarters: WeekHours;
  readonly branches: Readonly<Record<string, WeekHours | null>>;
}


export const WEEKDAYS = [
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
  'Domingo',
] as const;

export const MAX_SHIFTS_PER_DAY = 2;
/** The second shift starts where the usual midday break ends. */
export const AFTERNOON_SHIFT: Shift = { opensAt: '14:30', closesAt: '19:00' };

/** The template most organizations already have: Mon–Fri 08–18, Sat 08–12. */
export function defaultWeekHours(): WeekHours {
  return {
    allDay: false,
    days: WEEKDAYS.map((_, i) => ({
      open: i < 6,
      shifts: [{ opensAt: '08:00', closesAt: i === 5 ? '12:00' : '18:00' }],
    })),
  };
}

export function defaultRegistrationHours(): RegistrationHours {
  return { headquarters: defaultWeekHours(), branches: {} };
}

/** Why a day is wrong, in the words of whoever fills it, or `null`. */
export function dayProblem(day: DayHours): string | null {
  if (!day.open) return null;
  if (day.shifts.length === 0) return 'Indique al menos un horario.';
  if (day.shifts.some((s) => !s.opensAt || !s.closesAt)) return 'Complete la hora de apertura y la de cierre.';
  if (day.shifts.some((s) => s.closesAt <= s.opensAt)) return 'La hora de cierre tiene que ser posterior a la de apertura.';
  const [first, second] = day.shifts;
  if (second && second.opensAt < first.closesAt) return 'El segundo turno tiene que empezar después de que termine el primero.';
  return null;
}

/** Why a week is wrong, or `null`. A week needs at least one open day. */
export function weekProblem(week: WeekHours): string | null {
  if (week.allDay) return null;
  if (!week.days.some((d) => d.open)) return 'Marque al menos un día de atención.';
  const index = week.days.findIndex((d) => dayProblem(d) !== null);
  return index < 0 ? null : `${WEEKDAYS[index]}: ${dayProblem(week.days[index])}`;
}

/** Validator of the whole sign-up hours: headquarters and every branch of its own. */
export const registrationHoursValidator: ValidatorFn = (
  control: AbstractControl,
): ValidationErrors | null => {
  const value = control.value as RegistrationHours | null;
  if (!value) return { openingHours: 'Indique el horario de atención.' };
  const problem =
    weekProblem(value.headquarters) ??
    Object.values(value.branches)
      .map((week) => (week ? weekProblem(week) : null))
      .find((p) => p !== null) ??
    null;
  return problem === null ? null : { openingHours: problem };
};

/** The week as the API expects it: one entry per shift, ISO weekday. */
export function toShifts(week: WeekHours): OpeningHoursShift[] {
  if (week.allDay) {
    return WEEKDAYS.map((_, i) => ({ dayOfWeek: i + 1, opensAt: '00:00', closesAt: '24:00' }));
  }
  return week.days.flatMap((day, i) =>
    day.open ? day.shifts.map((s) => ({ dayOfWeek: i + 1, ...s })) : [],
  );
}

/** A branch's shifts: its own week, or the headquarters' when it has none. */
export function branchShifts(hours: RegistrationHours, branchId: string): OpeningHoursShift[] {
  return toShifts(hours.branches[branchId] ?? hours.headquarters);
}
