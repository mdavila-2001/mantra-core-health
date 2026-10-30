/* ============================================================================
    Aritmética de importes del carril de promociones (FAR-I7).

    La implementación vive en el motor compartido
    (`core/promotions-engine/promotion-money.ts`): cualquier organización que
    promocione algo necesita la misma regla de redondeo. Este archivo conserva
    los nombres en castellano con que ya la importa el resto del carril.
    ========================================================================== */

import {
  PERCENT_MAX,
  PERCENT_MIN,
  fromCents,
  normalizeAmount,
  priceAfterPercent,
  savingPercent,
  sumLines,
  toCents,
} from '../../promotions-engine/promotion-money';

/** El porcentaje que la farmacia puede escribir, ambos extremos incluidos. */
export const PORCENTAJE_MINIMO = PERCENT_MIN;
export const PORCENTAJE_MAXIMO = PERCENT_MAX;

/** Un importe en texto a centavos enteros, o `null` si el texto no es un importe. */
export const aCentavos = toCents;

/** Centavos enteros al texto exacto con dos decimales. */
export const aTexto = fromCents;

/** El mismo importe, siempre con dos decimales, o `null` si no es un importe. */
export const normalizado = normalizeAmount;

/**
 * Aplica un porcentaje de descuento a un precio. Redondea el precio resultante
 * **hacia abajo**: quien lee «33 %» nunca paga peor.
 */
export const conDescuento = priceAfterPercent;

/** El porcentaje de ahorro entre dos precios, derivado y no guardado. */
export const porcentajeDeAhorro = savingPercent;

/** Suma `precio × cantidad`, o `null` si algún renglón no es un importe. */
export function totalDeRenglones(
  renglones: readonly { readonly precio: string; readonly cantidad: number }[],
): string | null {
  return sumLines(renglones.map((renglon) => ({ price: renglon.precio, quantity: renglon.cantidad })));
}
