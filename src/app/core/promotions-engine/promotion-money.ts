/* ============================================================================
    Aritmética de importes del motor de promociones.

    Todo entra y sale como texto, y por dentro se trabaja en **centavos
    enteros**. Un `number` con decimales no puede representar 0.10 exacto, y un
    precio promocional que sale 44.999999999999996 no es un detalle de formato:
    es un precio distinto del que la organización escribió.

    Vive en el motor y no en el dominio de farmacia porque cualquier
    organización que promocione algo —un servicio, un estudio, un plan— necesita
    la misma regla de redondeo.
    ========================================================================== */

/** Cuántos centavos tiene una unidad. Dos decimales, como el resto del repo. */
const CENTS_PER_UNIT = 100;

/** El porcentaje que se puede escribir, ambos extremos incluidos. */
export const PERCENT_MIN = 1;
export const PERCENT_MAX = 99;

/**
 * Un importe en texto a centavos enteros, o `null` si el texto no es un
 * importe.
 *
 * Rechaza el negativo y el vacío. `Number('')` es `0`, así que sin este corte
 * un campo en blanco pasaría como precio cero.
 */
export function toCents(amount: string): number | null {
  const clean = amount.trim();
  if (clean === '' || !/^\d+(\.\d{1,2})?$/.test(clean)) {
    return null;
  }
  // El texto ya está validado a dos decimales como mucho: multiplicar y
  // redondear no puede desviarse más de la mitad de un centavo.
  return Math.round(Number(clean) * CENTS_PER_UNIT);
}

/** Centavos enteros al texto exacto con dos decimales. */
export function fromCents(cents: number): string {
  return (cents / CENTS_PER_UNIT).toFixed(2);
}

/**
 * El mismo importe, siempre con dos decimales, o `null` si no es un importe.
 *
 * Los dos precios de un producto se leen juntos —«antes 15 · ahora 12.00» es un
 * descuido a la vista—, y ningún origen garantiza el formato. Se normaliza al
 * construir, no al pintar, para que el dato guardado sea uno solo.
 */
export function normalizeAmount(amount: string): string | null {
  const cents = toCents(amount);
  return cents === null ? null : fromCents(cents);
}

/** `true` si el número es un porcentaje entero que el motor acepta. */
export function isValidPercent(percent: number): boolean {
  return Number.isInteger(percent) && percent >= PERCENT_MIN && percent <= PERCENT_MAX;
}

/**
 * Cuántos centavos se descuentan al aplicar un porcentaje a un importe.
 *
 * El **precio resultante** se redondea hacia abajo y el descuento es lo que
 * queda: el ahorro nunca es menor que el que anuncia el cartel. 33 % de 10.01
 * son 670,67 centavos; al más cercano daría 6.71 —un ahorro del 32,97 %,
 * menos del prometido—. Hacia abajo da 6.70 y el ahorro es el 33,07 %. Quien
 * lee «33 %» nunca paga peor.
 */
export function percentOffCents(cents: number, percent: number): number {
  return cents - Math.floor((cents * (100 - percent)) / 100);
}

/**
 * Aplica un porcentaje de descuento a un precio, o `null` si el precio no es un
 * importe o el porcentaje está fuera de rango.
 */
export function priceAfterPercent(price: string, percent: number): string | null {
  const cents = toCents(price);
  if (cents === null || !isValidPercent(percent)) {
    return null;
  }
  return fromCents(cents - percentOffCents(cents, percent));
}

/**
 * El porcentaje de ahorro entre dos precios, redondeado al entero más cercano,
 * o `null` si alguno no es un importe o el promocional no es menor.
 *
 * Se **deriva** y no se guarda: lo que se fijó son los dos precios, y un
 * porcentaje almacenado aparte se desincroniza en cuanto alguno cambia.
 */
export function savingPercent(normalPrice: string, promoPrice: string): number | null {
  const normal = toCents(normalPrice);
  const promo = toCents(promoPrice);
  if (normal === null || promo === null || normal <= 0 || promo >= normal) {
    return null;
  }
  return Math.round(((normal - promo) / normal) * 100);
}

/**
 * Suma `precio × cantidad` sobre varios renglones, o `null` si alguno no es un
 * importe.
 *
 * Devuelve `null` en vez de saltearse el renglón malo: un total al que le falta
 * un producto es peor que un total que dice que no se puede calcular.
 */
export function sumLines(
  lines: readonly { readonly price: string; readonly quantity: number }[],
): string | null {
  let total = 0;
  for (const line of lines) {
    const cents = toCents(line.price);
    if (cents === null || !Number.isInteger(line.quantity) || line.quantity < 0) {
      return null;
    }
    total += cents * line.quantity;
  }
  return fromCents(total);
}
