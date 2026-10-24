/**
 * Dónde está parado el calendario de la agenda, escrito en la URL.
 *
 * ## Por qué existe (propietario, 2026-10-03)
 *
 * El día abierto vivía sólo en memoria. Quien se iba a otra fecha, abría una
 * cita y volvía —con el «Volver» del encabezado o el atrás del navegador—
 * caía otra vez en hoy, y tenía que buscar de nuevo el día en el que estaba.
 * Con el día en la URL, volver es volver a la misma entrada del historial, y
 * esa entrada ya dice qué día y qué vista mirar.
 *
 * ## Lo de siempre no se escribe
 *
 * Hoy en vista de día es como arranca la agenda, así que no deja rastro: la
 * dirección de quien entra y no se mueve sigue siendo `/schedule` a secas.
 */

/** El día mirado, como `AAAA-MM-DD` en hora local. */
export const CALENDAR_DAY_PARAM = 'day';

/** Qué vista del calendario se mira. Ausente es la del día. */
export const CALENDAR_VIEW_PARAM = 'calendar';

export type CalendarView = 'day' | 'week' | 'month';

const VISTAS: ReadonlySet<string> = new Set<CalendarView>(['day', 'week', 'month']);

const FORMATO_DEL_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** El día en hora local como `AAAA-MM-DD`: lo que se lee en la barra de direcciones. */
export function formatCalendarDay(fecha: Date): string {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${fecha.getFullYear()}-${mes}-${dia}`;
}

/**
 * El día que pide la URL, a medianoche local, o `null` si no pide ninguno.
 *
 * Un valor mal formado o imposible (`2026-02-31`) es `null` y no un día
 * corrido: un enlace roto abre hoy, no una fecha que nadie pidió.
 */
export function parseCalendarDay(valor: string | null): Date | null {
  const partes = valor === null ? null : FORMATO_DEL_DIA.exec(valor);
  if (partes === null) return null;

  const [anio, mes, dia] = [Number(partes[1]), Number(partes[2]) - 1, Number(partes[3])];
  const fecha = new Date(anio, mes, dia);
  const existe = fecha.getFullYear() === anio && fecha.getMonth() === mes && fecha.getDate() === dia;
  return existe ? fecha : null;
}

/** La vista que pide la URL, o `null` si no pide una que exista. */
export function parseCalendarView(valor: string | null): CalendarView | null {
  return valor !== null && VISTAS.has(valor) ? (valor as CalendarView) : null;
}
