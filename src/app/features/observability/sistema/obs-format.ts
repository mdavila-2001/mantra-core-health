import { formatearValor, NO_DATA } from '@core/data-access/reporting/reporting-format';
import type { ObsInterval, Percentile } from '@core/data-access/observability/observability.types';

/** Zonas que ofrece el conmutador: la de la operación (La Paz) y UTC (la de los registros del servidor). */
export type ZonaHoraria = 'America/La_Paz' | 'UTC';

export const ZONA_ETIQUETA: Readonly<Record<ZonaHoraria, string>> = {
  'America/La_Paz': 'La Paz (UTC−4)',
  UTC: 'UTC',
};

function partes(fecha: Date, zona: string): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const p of new Intl.DateTimeFormat('es-BO', {
    timeZone: zona,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(fecha)) {
    salida[p.type] = p.value;
  }
  return salida;
}

/** «31/10 14:32» en la zona pedida. `null` y fechas inválidas dicen «Sin dato», nunca 1970. */
export function fechaHora(iso: string | null | undefined, zona: string): string {
  if (iso === null || iso === undefined) return NO_DATA;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NO_DATA;
  const p = partes(d, zona);
  return `${p['day']}/${p['month']} ${p['hour']}:${p['minute']}`;
}

/** «31/10/2026 14:32:05» para el detalle de un evento (con año y segundos). */
export function fechaHoraCompleta(iso: string | null | undefined, zona: string): string {
  if (iso === null || iso === undefined) return NO_DATA;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return NO_DATA;
  const base = new Intl.DateTimeFormat('es-BO', {
    timeZone: zona,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(d);
  return base.replace(',', '');
}

/** «hace 3 min», «hace 2 h», «hace 4 d»; menos de 10 s es «ahora». */
export function hace(iso: string | null | undefined, ahora: Date): string {
  if (iso === null || iso === undefined) return NO_DATA;
  const seg = Math.round((ahora.getTime() - new Date(iso).getTime()) / 1000);
  if (Number.isNaN(seg)) return NO_DATA;
  if (seg < 10) return 'ahora';
  if (seg < 60) return `hace ${seg} s`;
  if (seg < 3600) return `hace ${Math.round(seg / 60)} min`;
  if (seg < 86_400) return `hace ${Math.round(seg / 3600)} h`;
  return `hace ${Math.round(seg / 86_400)} d`;
}

/** El inicio del cubo `interval` (en la zona) que contiene a `fecha`. Sólo zonas sin horario de verano (UTC, La Paz). */
export function inicioDeCubo(fecha: Date, intervalo: ObsInterval, zona: string): Date {
  const minuto = 60_000;
  if (intervalo === 'minute') return new Date(Math.floor(fecha.getTime() / minuto) * minuto);
  if (intervalo === 'hour') return new Date(Math.floor(fecha.getTime() / 3_600_000) * 3_600_000);
  const p = partes(fecha, zona);
  const localComoUtc = Date.UTC(Number(p['year']), Number(p['month']) - 1, Number(p['day']), Number(p['hour']), Number(p['minute']));
  const desfase = localComoUtc - Math.floor(fecha.getTime() / minuto) * minuto;
  return new Date(Date.UTC(Number(p['year']), Number(p['month']) - 1, Number(p['day'])) - desfase);
}

const PASO: Readonly<Record<ObsInterval, number>> = { minute: 60_000, hour: 3_600_000, day: 86_400_000 };

/** Todos los cubos de la ventana, en orden: un cubo sin fila en la API es «sin dato», y el eje lo muestra como hueco. */
export function rejillaDeCubos(desde: string, hasta: string, intervalo: ObsInterval, zona: string): Date[] {
  const fin = new Date(hasta).getTime();
  const salida: Date[] = [];
  let t = inicioDeCubo(new Date(desde), intervalo, zona).getTime();
  // Tope defensivo: ningún intervalo legal de la API produce más de ~1500 cubos.
  while (t < fin && salida.length < 2000) {
    salida.push(new Date(t));
    t += PASO[intervalo];
  }
  return salida;
}

/**
 * Nombre de un cubo para el eje: por día, la fecha local ISO (el gráfico la lee «31 oct»); por hora o minuto,
 * «31/10 14:00». Nunca se repite dentro de una ventana, que es lo que exige un eje de categorías.
 */
export function etiquetaDeCubo(inicio: Date, intervalo: ObsInterval, zona: string): string {
  const p = partes(inicio, zona);
  return intervalo === 'day' ? `${p['year']}-${p['month']}-${p['day']}` : `${p['day']}/${p['month']} ${p['hour']}:${p['minute']}`;
}

/** Un percentil como texto: `≥` cuando cayó en el último corte del histograma, «Sin dato» si es null. */
export function textoPercentil(p: Percentile | undefined): string {
  if (p === undefined || p.value === null) return NO_DATA;
  return `${p.atLeast === true ? '≥ ' : ''}${formatearValor(p.value, { tipo: 'duracion' })}`;
}

export function textoDuracion(ms: number | null | undefined): string {
  return ms === null || ms === undefined ? NO_DATA : formatearValor(ms, { tipo: 'duracion' });
}

export function textoEntero(n: number | null | undefined): string {
  return formatearValor(n, { tipo: 'numero' });
}

/** Una proporción 0–1 como «1,9 %». */
export function textoProporcion(r: number | null | undefined): string {
  return r === null || r === undefined ? NO_DATA : formatearValor(r * 100, { tipo: 'porcentaje' });
}
