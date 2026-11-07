import type { PublishedRule } from '@core/data-access/scheduling/scheduling.types';
import {
  duracionDeFranja,
  enMinutos,
} from '../../../../core/data-access/diagnostic-units/center-schedule.rules';
import type {
  ScheduleBlock,
  ScheduleWindow,
} from '../../../../core/data-access/diagnostic-units/center-schedule.types';
import type { ScheduleDayValue } from '../../../agenda/agenda-create/schedule-day-row/schedule-day';

/* ============================================================================
    A center's schedule seen as the practitioner's week: one row per day
    (`ScheduleDayRow`) plus one lunch break for the whole week. The center
    keeps its contract (`ScheduleBlock`); these pure functions translate both
    ways, so the screen edits with the same table the practitioner uses.
    ========================================================================== */

/** Monday first, as the practitioner's table; ISO weekday 1…7. */
export const WEEK = [
  { iso: 1, label: 'Lunes' },
  { iso: 2, label: 'Martes' },
  { iso: 3, label: 'Miércoles' },
  { iso: 4, label: 'Jueves' },
  { iso: 5, label: 'Viernes' },
  { iso: 6, label: 'Sábado' },
  { iso: 7, label: 'Domingo' },
] as const;

export interface Lunch {
  readonly from: string;
  readonly to: string;
}

export interface CenterWeek {
  /** Seven rows, Monday to Sunday. */
  readonly days: readonly ScheduleDayValue[];
  readonly lunch: Lunch | null;
}

function day(
  activo: boolean,
  desde: string,
  hasta: string,
  duracion: number,
  respiro: number,
): ScheduleDayValue {
  return {
    activo,
    desde,
    hasta,
    duracion,
    respiro,
    modo: 'CONSULTATIONS',
    telemedicina: false,
    flexible: false,
  };
}

/** The block as seven rows. Two windows with the same hole on every day read back as the lunch. */
export function blockToWeek(block: ScheduleBlock, previous: CenterWeek | null = null): CenterWeek {
  const byDay = WEEK.map((d) =>
    block.windows
      .filter((w) => w.dayOfWeek === d.iso)
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
  );
  const days = byDay.map((ws, i) => {
    const first = ws[0];
    if (first === undefined) {
      // An inactive row keeps what it had, so switching a day off and on loses nothing.
      const before = previous?.days[i];
      return before
        ? { ...before, activo: false }
        : day(false, '08:00', '12:00', block.slotMinutes, 0);
    }
    const { cita, descanso } = duracionDeFranja(block, first);
    return day(true, first.startTime, ws[ws.length - 1]!.endTime, cita, descanso);
  });
  const active = byDay.filter((ws) => ws.length > 0);
  const hole = (ws: readonly ScheduleWindow[]): string => `${ws[0]!.endTime}-${ws[1]!.startTime}`;
  // Only a hole every active day shares is a lunch; anything else reads as one span per day.
  const lunch =
    active.length > 0 && active.every((ws) => ws.length === 2 && hole(ws) === hole(active[0]!))
      ? { from: active[0]![0]!.endTime, to: active[0]![1]!.startTime }
      : null;
  return { days, lunch };
}

/** The week back as the center's block: a day crossed by the lunch is two windows. */
export function weekToBlock(week: CenterWeek, fallbackSlot: number): ScheduleBlock {
  const active = week.days.filter((d) => d.activo);
  const slotMinutes = mostCommon(active.map((d) => d.duracion)) ?? fallbackSlot;
  const windows = week.days.flatMap((d, i): ScheduleWindow[] => {
    if (!d.activo) return [];
    const timing = {
      ...(d.duracion !== slotMinutes ? { slotMinutes: d.duracion } : {}),
      ...(d.respiro > 0 ? { gapMinutes: d.respiro } : {}),
    };
    const iso = WEEK[i]!.iso;
    return spans(d.desde, d.hasta, week.lunch).map(([startTime, endTime]) => ({
      dayOfWeek: iso,
      startTime,
      endTime,
      ...timing,
    }));
  });
  return { windows, slotMinutes };
}

/** The appointments of that day as [start, end] minutes: whole ones, each followed by its rest (the API rule). */
export function appointmentsOfDay(d: ScheduleDayValue, lunch: Lunch | null): readonly (readonly [number, number])[] {
  if (!d.activo || d.duracion <= 0) return [];
  return spans(d.desde, d.hasta, lunch).flatMap(([a, b]) => {
    const from = enMinutos(a);
    const to = enMinutos(b);
    const out: (readonly [number, number])[] = [];
    if (from === null || to === null) return out;
    for (let t = from; t + d.duracion <= to; t += d.duracion + d.respiro) out.push([t, t + d.duracion]);
    return out;
  });
}

/** How many appointments fit that day. */
export function slotsOfDay(d: ScheduleDayValue, lunch: Lunch | null): number {
  return appointmentsOfDay(d, lunch).length;
}

/** The block as the rules `ScheduleGrid` draws (Sunday is 0 there). */
export function toPublishedRules(block: ScheduleBlock): readonly PublishedRule[] {
  return block.windows.map((w) => {
    const { cita, descanso } = duracionDeFranja(block, w);
    return {
      dayOfWeek: w.dayOfWeek % 7,
      startTime: w.startTime,
      endTime: w.endTime,
      slotMinutes: cita,
      ...(descanso > 0 ? { gapMinutes: descanso } : {}),
    };
  });
}

function spans(desde: string, hasta: string, lunch: Lunch | null): (readonly [string, string])[] {
  if (lunch === null || !(lunch.from > desde && lunch.to < hasta && lunch.from < lunch.to)) {
    return [[desde, hasta]];
  }
  return [
    [desde, lunch.from],
    [lunch.to, hasta],
  ];
}

function mostCommon(values: readonly number[]): number | null {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best: number | null = null;
  for (const [v, n] of counts) if (best === null || n > counts.get(best)!) best = v;
  return best;
}
