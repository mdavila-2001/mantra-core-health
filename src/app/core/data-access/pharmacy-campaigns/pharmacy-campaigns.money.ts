/* ============================================================================
    Aritmética de importes del carril de promociones (FAR-I7).

    Todo entra y sale como texto, y por dentro se trabaja en **centavos
    enteros**. Un `number` con decimales no puede representar 0.10 exacto, y un
    precio promocional que sale 44.999999999999996 no es un detalle de formato:
    es un precio distinto del que la farmacia escribió.
    ========================================================================== */

/** Cuántos centavos tiene una unidad. Dos decimales, como el resto del repo. */
const CENTAVOS_POR_UNIDAD = 100;

/** El porcentaje que la farmacia puede escribir, ambos extremos excluidos. */
export const PORCENTAJE_MINIMO = 1;
export const PORCENTAJE_MAXIMO = 99;

/**
 * Un importe en texto a centavos enteros, o `null` si el texto no es un
 * importe.
 *
 * Rechaza el negativo y el vacío. `Number('')` es `0`, así que sin este corte
 * un campo en blanco pasaría como precio cero.
 */
export function aCentavos(importe: string): number | null {
  const limpio = importe.trim();
  if (limpio === '' || !/^\d+(\.\d{1,2})?$/.test(limpio)) {
    return null;
  }
  // El texto ya está validado a dos decimales como mucho: multiplicar y
  // redondear no puede desviarse más de la mitad de un centavo.
  return Math.round(Number(limpio) * CENTAVOS_POR_UNIDAD);
}

/** Centavos enteros al texto exacto con dos decimales. */
export function aTexto(centavos: number): string {
  return (centavos / CENTAVOS_POR_UNIDAD).toFixed(2);
}

/**
 * El mismo importe, siempre con dos decimales, o `null` si no es un importe.
 *
 * Los dos precios de un producto se leen juntos —«antes 15 · ahora 12.00» es
 * un descuido a la vista—, y ninguno de los dos orígenes garantiza el formato:
 * la farmacia escribe `15` a mano y `GET /pharmacy-inventory/availability`
 * devuelve `"15"` y `"22.5"`. Se normaliza al construir el producto, no al
 * pintarlo, para que el dato guardado sea uno solo.
 */
export function normalizado(importe: string): string | null {
  const centavos = aCentavos(importe);
  return centavos === null ? null : aTexto(centavos);
}

/**
 * Aplica un porcentaje de descuento a un precio, o `null` si el precio no es
 * un importe.
 *
 * Redondea al centavo **hacia abajo** para que el ahorro nunca quede por
 * debajo del que anuncia el cartel: 33 % de 10.01 son 670,67 centavos, y al
 * más cercano daría 6.71 —un ahorro del 32,97 %, menos del que se prometió—.
 * Hacia abajo da 6.70, que es 33,07 %. Quien lee «33 %» nunca paga peor.
 */
export function conDescuento(precio: string, porcentaje: number): string | null {
  const centavos = aCentavos(precio);
  if (centavos === null || !Number.isInteger(porcentaje)) {
    return null;
  }
  if (porcentaje < PORCENTAJE_MINIMO || porcentaje > PORCENTAJE_MAXIMO) {
    return null;
  }
  return aTexto(Math.floor((centavos * (100 - porcentaje)) / 100));
}

/**
 * El porcentaje de ahorro entre dos precios, redondeado al entero más cercano,
 * o `null` si alguno no es un importe o el promocional no es menor.
 *
 * Se **deriva** y no se guarda: lo que la farmacia fijó son los dos precios, y
 * un porcentaje almacenado aparte se desincroniza en cuanto alguno cambia.
 */
export function porcentajeDeAhorro(precioNormal: string, precioPromocional: string): number | null {
  const normal = aCentavos(precioNormal);
  const promocional = aCentavos(precioPromocional);
  if (normal === null || promocional === null || normal <= 0 || promocional >= normal) {
    return null;
  }
  return Math.round(((normal - promocional) / normal) * 100);
}

/**
 * Suma `precio × cantidad` sobre varios renglones, o `null` si alguno no es un
 * importe.
 *
 * Devuelve `null` en vez de saltearse el renglón malo: un total al que le
 * falta un producto es peor que un total que dice que no se puede calcular
 * —el mismo criterio que `totalDe()` en el cliente de pedidos—.
 */
export function totalDeRenglones(
  renglones: readonly { readonly precio: string; readonly cantidad: number }[],
): string | null {
  let total = 0;
  for (const renglon of renglones) {
    const centavos = aCentavos(renglon.precio);
    if (centavos === null || !Number.isInteger(renglon.cantidad) || renglon.cantidad < 0) {
      return null;
    }
    total += centavos * renglon.cantidad;
  }
  return aTexto(total);
}
