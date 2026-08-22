/**
 * El único generador de códigos que una persona lee en voz alta.
 *
 * Nació como el código de retiro del pedido de farmacia (FAR-I2) y lo reusa el
 * comprobante de canje de puntos (FAR-I6): mismo problema —alguien dicta el
 * código en un mostrador y del otro lado lo tipean— y por lo tanto un solo
 * mecanismo, como con `dibujarQr`.
 *
 * La unicidad no es asunto de acá: la dará el backend cuando exista. Esto sólo
 * produce algo legible.
 *
 * Vive en `core/` y no junto a `dibujarQr` en `shared/utils/` porque quienes lo
 * usan son los dos clientes de `core/data-access/`, y las capas van en una sola
 * dirección: `features → shared → core`. `dibujarQr` sí está en `shared/`
 * porque lo consumen pantallas.
 */

/**
 * Sin `O/0`, `I/1` ni `B/8`: son los pares que se confunden dictados en voz
 * alta y leídos en una pantalla chica.
 */
const ALFABETO_LEGIBLE = 'ACDEFHJKLMNPRTUVWXY34679';

/**
 * Un código de `largo` caracteres del alfabeto legible.
 *
 * @param largo Cuántos caracteres. Menor que 1 devuelve cadena vacía: pedir un
 *   código de cero caracteres es un error de quien llama, no algo que corregir
 *   en silencio inventando un largo.
 */
export function generarCodigoLegible(largo: number): string {
  let codigo = '';
  for (let i = 0; i < largo; i += 1) {
    codigo += ALFABETO_LEGIBLE[Math.floor(Math.random() * ALFABETO_LEGIBLE.length)];
  }
  return codigo;
}

/** Los caracteres que el generador puede emitir. Lo usan los tests. */
export const CARACTERES_LEGIBLES = ALFABETO_LEGIBLE;
