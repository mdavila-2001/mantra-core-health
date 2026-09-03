import type { Money } from '../../core/data-access/insurance/insurance.types';

/**
 * Texto con el que se muestra la ausencia de un importe.
 *
 * **No es `'0.00'`.** «Todavía no hay dictamen» y «el dictamen aprobó cero» son
 * cosas distintas, y pintarlas igual es un error contable que nadie puede
 * detectar mirando la pantalla.
 */
export const SIN_IMPORTE = 'Sin dictaminar';

/**
 * Da formato a un importe con su moneda.
 *
 * **El número no se recalcula ni se redondea**: llega como cadena decimal desde
 * la base y se muestra tal cual. Sólo se le agrega la moneda, que viene del
 * `currency_concept_id` de la solicitud y nunca de un símbolo escrito en la
 * plantilla — un producto boliviano que dibuja «$» a mano miente sobre cuánto
 * cuesta algo.
 *
 * Cuando la solicitud no declaró moneda se muestra sólo el número: inventarle
 * una es peor que no tenerla.
 *
 * @param money - El importe con su moneda, o `null` si no hay.
 * @returns El texto a mostrar.
 */
export function formatMoney(money: Money | null): string {
  if (money === null) return SIN_IMPORTE;
  const codigo = money.currency?.display ?? null;
  return codigo === null ? money.amount : `${money.amount} ${codigo}`;
}

/**
 * Sólo el importe, sin la moneda.
 *
 * Para tablas donde la moneda es la misma en toda la columna: repetirla en
 * cada celda son seis «Boliviano» por fila que no aportan nada y empujan la
 * tabla fuera de la pantalla. La moneda se declara **una vez**, en el
 * encabezado de la columna, con {@link currencySuffix}.
 *
 * @param money - El importe, o `null` si no hay.
 * @returns El número, o el texto de la ausencia.
 */
export function formatAmount(money: Money | null): string {
  return money === null ? SIN_IMPORTE : money.amount;
}

/**
 * Sufijo de moneda para un encabezado de columna.
 *
 * Devuelve cadena vacía cuando no hay moneda declarada: inventarle una a un
 * importe es peor que mostrarlo sin unidad.
 *
 * @param money - Un importe de la columna, del que se toma la moneda.
 * @returns `' · Boliviano'`, o cadena vacía.
 */
export function currencySuffix(money: Money | null): string {
  const display = money?.currency?.display;
  return display ? ` · ${display}` : '';
}
