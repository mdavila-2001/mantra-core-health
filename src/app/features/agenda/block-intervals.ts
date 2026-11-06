import { aMedianoche, conHora, type BloqueoPedido } from './my-agenda/block-form/block-form';

/** One exception to create: the instants sent as `startAt` / `endAt`. */
export interface BlockInterval {
  readonly startAt: Date;
  readonly endAt: Date;
}

/**
 * The exceptions a block request becomes. Whole days are ONE exception, from
 * the first midnight to the one after the last day. A time range is ONE PER DAY:
 * a single «10th 14:00 → 24th 18:00» exception would also close every night and
 * morning in between, the opposite of «the afternoons of those two weeks».
 *
 * Every screen that creates blocks goes through here (via
 * `BlockCancellations.createBlock`); /schedule/blocks used to send the range as
 * one exception while «Mi agenda» split it, and the two drifted apart.
 */
export function intervalosDelPedido(pedido: BloqueoPedido): readonly BlockInterval[] {
  return pedido.franjaHoraria ? franjasPorDia(pedido) : [{ startAt: pedido.desde, endAt: pedido.hasta }];
}

/**
 * One time range per day of the request. `desde` / `hasta` already carry the
 * start and end time. Walks by local date, not by adding 24 h: on a DST change
 * a day lasts 23 or 25 h and the range would drift an hour from there on.
 */
export function franjasPorDia(pedido: BloqueoPedido): readonly BlockInterval[] {
  const horaDesde = hhmm(pedido.desde);
  const horaHasta = hhmm(pedido.hasta);
  const intervalos: BlockInterval[] = [];
  const ultimo = aMedianoche(pedido.hasta);
  for (let dia = aMedianoche(pedido.desde); dia <= ultimo; dia = siguienteDia(dia)) {
    intervalos.push({ startAt: conHora(dia, horaDesde), endAt: conHora(dia, horaHasta) });
  }
  return intervalos;
}

function siguienteDia(fecha: Date): Date {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate() + 1);
}

function hhmm(fecha: Date): string {
  return `${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
}
