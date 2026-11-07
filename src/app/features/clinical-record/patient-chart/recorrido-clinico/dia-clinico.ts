/* ============================================================================
    The clinical day: when two records are «the same day».

    One helper for the clinical network (columns, `inferido-mismo-dia`) and the
    guided tour (steps, «Ese mismo día»), so both agree. The values grouped are
    instants (an encounter's start, a record's creation), so the day is read in
    the product's time zone (`America/La_Paz`, the `DEFAULT_TIME_ZONE` of the
    rest of the front), not in UTC —21:00 in La Paz is already tomorrow in
    UTC— nor in the browser's zone, which would make the grouping depend on
    the machine.
    ========================================================================== */

/** The product's clinical time zone. */
export const ZONA_CLINICA = 'America/La_Paz';

const FORMATOS = new Map<string, Intl.DateTimeFormat>();

function formato(zona: string): Intl.DateTimeFormat {
  let f = FORMATOS.get(zona);
  if (f === undefined) {
    f = new Intl.DateTimeFormat('en-US', { timeZone: zona, year: 'numeric', month: 'numeric', day: 'numeric' });
    FORMATOS.set(zona, f);
  }
  return f;
}

/** Year, month (1-12) and day of an instant in the clinical time zone. */
export function partesDelDia(fecha: Date, zona = ZONA_CLINICA): { anio: number; mes: number; dia: number } {
  const partes = formato(zona).formatToParts(fecha);
  const de = (tipo: Intl.DateTimeFormatPartTypes) => Number(partes.find((p) => p.type === tipo)?.value);
  return { anio: de('year'), mes: de('month'), dia: de('day') };
}

/** `aaaa-mm-dd` of the clinical day: the key that says «the same day». */
export function diaClinico(fecha: Date, zona = ZONA_CLINICA): string {
  const { anio, mes, dia } = partesDelDia(fecha, zona);
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}
