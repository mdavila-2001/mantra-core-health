/* ============================================================================
    The clinical day: when two records are «the same day».

    The single source for the clinical network (columns, `inferido-mismo-dia`,
    a card's own date, the interval between columns, the date filter) and the
    guided tour (steps, «Ese mismo día»), so all of them agree. The values
    grouped are instants (an encounter's start, a record's creation), so the
    day is read in the product's time zone (`DEFAULT_TIME_ZONE`,
    `America/La_Paz`), not in UTC —21:00 in La Paz is already tomorrow in
    UTC— nor in the browser's zone, which would make the grouping depend on
    the machine.
    ========================================================================== */

import { DEFAULT_TIME_ZONE } from '../../../inpatient/inpatient-presentation';

const DIA_MS = 86_400_000;
const FORMATOS = new Map<string, Intl.DateTimeFormat>();

function formato(zona: string): Intl.DateTimeFormat {
  let f = FORMATOS.get(zona);
  if (f === undefined) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: zona, year: 'numeric', month: 'numeric', day: 'numeric' });
    FORMATOS.set(zona, f);
  }
  return f;
}

const clave = (anio: number, mes: number, dia: number): string =>
  `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;

/** Year, month (1-12) and day of an instant in the clinical time zone. */
export function partesDelDia(fecha: Date, zona = DEFAULT_TIME_ZONE): { anio: number; mes: number; dia: number } {
  const partes = formato(zona).formatToParts(fecha);
  const de = (tipo: Intl.DateTimeFormatPartTypes) => Number(partes.find((p) => p.type === tipo)?.value);
  return { anio: de('year'), mes: de('month'), dia: de('day') };
}

/** `aaaa-mm-dd` of the clinical day: the key that says «the same day». */
export function diaClinico(fecha: Date, zona = DEFAULT_TIME_ZONE): string {
  const { anio, mes, dia } = partesDelDia(fecha, zona);
  return clave(anio, mes, dia);
}

/** Whether two instants fall on the same clinical day. */
export function mismoDiaClinico(a: Date, b: Date, zona = DEFAULT_TIME_ZONE): boolean {
  return diaClinico(a, zona) === diaClinico(b, zona);
}

/** Calendar days between two clinical days (not 24 h spans): 20:30 and 10:00 the next day are 1. */
export function diasClinicosEntre(antes: Date, despues: Date, zona = DEFAULT_TIME_ZONE): number {
  const a = partesDelDia(antes, zona);
  const d = partesDelDia(despues, zona);
  return Math.round((Date.UTC(d.anio, d.mes - 1, d.dia) - Date.UTC(a.anio, a.mes - 1, a.dia)) / DIA_MS);
}

/**
 * `aaaa-mm-dd` of a day **picked** by the person (the date picker builds it
 * from local components). It is a calendar date, not an instant: it is read
 * as written and compared against {@link diaClinico} of the records.
 */
export function diaDelCalendario(fecha: Date): string {
  return clave(fecha.getFullYear(), fecha.getMonth() + 1, fecha.getDate());
}
