import { formatDate } from '@angular/common';

import type { SegmentedOption } from '@shared/components/molecules/segmented-control/segmented-control.types';

/**
 * Pure helpers of the block form: time-of-day parsing, the quick time-range
 * presets and the live summary sentence. Kept out of the component so they can
 * be tested without mounting it and so `block-form.ts` stays under its line cap.
 */

/** A valid time of day, `HH:MM` (24 h). */
export const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Time picker granularity, in seconds. Same 5-minute step as the weekly
 * schedule (`TIME_STEP_SECONDS`): a block that does not line up with the slot
 * grid leaves half-slots behind.
 */
export const PASO_DE_HORA_SEGUNDOS = 300;

export type Alcance = 'dias' | 'franja';

/** Same labels as the old radios: the e2e specs look them up by name. */
export const OPCIONES_DE_ALCANCE: readonly SegmentedOption<Alcance>[] = [
  { value: 'dias', label: 'Los días enteros' },
  { value: 'franja', label: 'Sólo una franja de cada día' },
];

export interface AtajoDeFranja {
  readonly rotulo: string;
  readonly desde: string;
  readonly hasta: string;
}

/** The ranges people ask for most, one tap away. */
export const ATAJOS_DE_FRANJA: readonly AtajoDeFranja[] = [
  { rotulo: 'Mañana', desde: '08:00', hasta: '12:00' },
  { rotulo: 'Mediodía', desde: '12:00', hasta: '14:00' },
  { rotulo: 'Tarde', desde: '14:00', hasta: '18:00' },
  { rotulo: 'Noche', desde: '18:00', hasta: '21:00' },
];

/** Label of the preset matching the current range, to mark it as pressed. */
export function atajoActivo(desde: string, hasta: string): string | null {
  return ATAJOS_DE_FRANJA.find((a) => a.desde === desde && a.hasta === hasta)?.rotulo ?? null;
}

export interface ResumenDeBloqueo {
  readonly cuando: string;
  readonly cuanto: string;
}

/** Local midnight of that date. */
export function aMedianoche(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

/** That date with the `HH:MM` time set, in local time. */
export function conHora(fecha: Date, hora: string): Date {
  const [h, m] = hora.split(':').map(Number);
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), h ?? 0, m ?? 0);
}

/** `HH:MM` of a date, to preload the range when editing. */
export function comoHora(valor: Date): string {
  return `${String(valor.getHours()).padStart(2, '0')}:${String(valor.getMinutes()).padStart(2, '0')}`;
}

/** Days covered by the range, both ends included; 0 when it is empty or inverted. */
export function diasDelRango(desde: Date | null, hasta: Date | null): number {
  if (desde === null || hasta === null) return 0;
  const diferencia = aMedianoche(hasta).getTime() - aMedianoche(desde).getTime();
  return diferencia < 0 ? 0 : Math.round(diferencia / 86_400_000) + 1;
}

/** Length of the daily range («4 h 30 min»), or `null` when it does not close. */
export function duracionDeFranja(desde: string, hasta: string): string | null {
  if (!HORA.test(desde) || !HORA.test(hasta) || hasta <= desde) return null;
  const minutos = enMinutos(hasta) - enMinutos(desde);
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `${resto} min`;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

/**
 * What the block will close, in one sentence, shown before confirming: dates
 * with their weekday (what people check against their calendar), how many days
 * and which part of each day.
 */
export function resumenDeBloqueo(
  desde: Date | null,
  hasta: Date | null,
  franja: { readonly desde: string; readonly hasta: string } | null,
  idioma: string,
): ResumenDeBloqueo | null {
  const dias = diasDelRango(desde, hasta);
  if (desde === null || hasta === null || dias === 0) return null;

  const largo = (v: Date): string => formatDate(v, "EEEE d 'de' MMMM", idioma);
  const cuando = dias === 1 ? `El ${largo(desde)}` : `Del ${largo(desde)} al ${largo(hasta)}`;
  const cuentaDias = dias === 1 ? '1 día' : `${dias} días, los dos extremos incluidos`;
  if (franja === null) return { cuando, cuanto: `${cuentaDias} · el día entero` };

  const duracion = duracionDeFranja(franja.desde, franja.hasta);
  const parte =
    duracion === null
      ? 'falta completar la franja'
      : `de ${franja.desde} a ${franja.hasta} (${duracion}) ${dias === 1 ? 'ese día' : 'en cada uno'}`;
  return { cuando, cuanto: `${cuentaDias} · ${parte}` };
}

/**
 * Field error of a time input. A missing or partial time is only an error after
 * the first submit; an end time not after `inicio` is an error right away.
 */
export function errorDeHora(
  hora: string,
  inicio: string | null,
  intentado: boolean,
): string | null {
  if (!HORA.test(hora)) return intentado ? 'Elija una hora, por ejemplo 14:00.' : null;
  if (inicio !== null && HORA.test(inicio) && hora <= inicio) {
    return 'Tiene que ser posterior a la hora de inicio.';
  }
  return null;
}

/** An input value as text; `null` becomes an empty string. */
export function comoTexto(valor: string | number | null): string {
  return valor === null ? '' : String(valor);
}

function enMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
