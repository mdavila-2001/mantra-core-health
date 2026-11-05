import type { DayState } from '../day-load';

/** Block kinds that come from the published slots: they say the day has hours. */
const SLOT_KINDS: ReadonlySet<string> = new Set(['cita', 'libre', 'no-disponible', 'sin-cargar']);

/**
 * Whether the day is still waiting for its slots: loading, and nothing drawn
 * that comes from them. Visits and blocks do not count: they say nothing about
 * whether the practitioner works that day. A reload of a day that already has
 * its slots is not "waiting": it keeps drawing them, so it does not flicker.
 */
export function isWaitingForSlots(state: DayState, kinds: readonly string[]): boolean {
  return state === 'loading' && !kinds.some((k) => SLOT_KINDS.has(k));
}

/**
 * The sentence in the day header: how many slots are booked and how many
 * stretches are busy.
 *
 * What the day claims, in priority order: waiting for its slots, then a failed
 * read (`error`), then the rest. An empty day is only "No atiende este día"
 * once everything was read.
 *
 * @param kinds the `tipo` of each block of the day (`cita`, `libre`, `ocupado`...).
 * @param flexibleSchedule the range of a flexible-hours day, or `null`.
 */
export function summarizeDay(
  state: DayState,
  kinds: readonly string[],
  flexibleSchedule: string | null,
): string {
  if (isWaitingForSlots(state, kinds)) return 'Cargando los horarios de este día…';
  if (state === 'error') return 'No se pudieron cargar las citas de este día.';
  const slots = kinds.filter((k) => k === 'cita' || k === 'libre').length;
  const booked = kinds.filter((k) => k === 'cita').length;
  const busy = kinds.filter((k) => k === 'ocupado').length;
  if (slots === 0 && busy === 0) {
    return flexibleSchedule === null
      ? 'No atiende este día.'
      : `Horario flexible de ${flexibleSchedule}: sin citas pedidas todavía.`;
  }
  const parts: string[] = [];
  if (slots > 0) {
    parts.push(
      booked === 0
        ? `${slots} horarios publicados, ninguno reservado`
        : `${booked} de ${slots} horarios reservados`,
    );
  }
  if (busy > 0) parts.push(`${busy} ${busy === 1 ? 'rato ocupado' : 'ratos ocupados'}`);
  return `${parts.join(' · ')}.`;
}
