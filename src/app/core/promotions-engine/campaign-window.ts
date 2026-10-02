import type { CampaignConditions } from './promotion-mechanics.types';

/** Dónde está una campaña respecto de su vigencia. `ENDED` es terminal. */
export type WindowStatus = 'SCHEDULED' | 'LIVE' | 'ENDED';

/**
 * Dónde está una ventana de fechas respecto de `now`.
 *
 * La ventana se mide en **días completos**, no en instantes, y los dos extremos
 * son inclusivos: una campaña «del 1 al 30» vale desde el primer minuto del 1
 * hasta el último del 30.
 *
 * No es un adorno. Quien crea la campaña elige los dos días en un calendario, y
 * el calendario devuelve un `Date` con hora: el mediodía (`date-picker.ts`,
 * `SAFE_HOUR`). Comparando instantes, una campaña que termina «el 30» moría a
 * las 12:00:01 del 30 —la mitad de su último día—, y una que empieza «el 10»
 * todavía no valía a las nueve de la mañana del 10. El formulario promete lo
 * contrario: «el último día cuenta».
 *
 * Los días son los de quien mira, no UTC: el paciente que lee «hasta el 30» en
 * su pantalla espera que valga todo su 30.
 */
export function windowStatus(from: Date, to: Date, now: Date): WindowStatus {
  const instant = now.getTime();
  if (instant < startOfDay(from)) {
    return 'SCHEDULED';
  }
  if (instant > endOfDay(to)) {
    return 'ENDED';
  }
  return 'LIVE';
}

/** Las 00:00:00.000 del día de esa fecha, en la zona horaria local. */
function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * El último milisegundo del día de esa fecha, en la zona horaria local.
 *
 * Se calcula como «el arranque del día siguiente, menos uno» y no fijando
 * 23:59:59.999: en un día con cambio de horario el día no dura 24 horas, y el
 * arranque del siguiente sí es siempre el borde correcto.
 */
function endOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime() - 1;
}

/**
 * ¿Cae `now` dentro de los días de la semana y la franja horaria de la
 * campaña? Sin restricciones, siempre.
 *
 * La franja es `[fromTime, toTime)`: a las 18:00 en punto una franja «hasta
 * 18:00» ya terminó, que es como se lee en un cartel de mostrador.
 */
export function isInsideSchedule(
  conditions: Pick<CampaignConditions, 'weekdays' | 'fromTime' | 'toTime'>,
  now: Date,
): boolean {
  if (conditions.weekdays.length > 0 && !conditions.weekdays.includes(now.getDay())) {
    return false;
  }
  if (conditions.fromTime === null || conditions.toTime === null) {
    return true;
  }
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes >= toMinutes(conditions.fromTime) && minutes < toMinutes(conditions.toTime);
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}
