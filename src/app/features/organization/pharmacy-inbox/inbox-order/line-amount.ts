import { displayCurrency } from '../../../../core/money/display-currency';

/**
 * El importe de un renglón del pedido. El precio que llega es el unitario
 * (`unitPriceAmount`): con más de una unidad, «35.00 Bs» al lado de
 * «Cantidad: 2» se leía como el subtotal y el total no cerraba a la vista. Se
 * dice «c/u» y se suma el subtotal.
 */
export function lineAmount(linea: {
  readonly precio: string | null;
  readonly cantidad: number;
  readonly moneda: string | null;
}): string {
  const moneda = displayCurrency(linea.moneda);
  if (linea.precio === null) return '';
  const unitario = Number(linea.precio);
  if (linea.cantidad <= 1 || !Number.isFinite(unitario)) return `${linea.precio} ${moneda}`;
  const subtotal = (unitario * linea.cantidad).toFixed(2);
  return `${linea.precio} ${moneda} c/u · ${subtotal} ${moneda}`;
}
