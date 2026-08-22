import type {
  DireccionDePuntos,
  MotivoDePuntos,
} from '../../../core/data-access/loyalty/loyalty.types';

/**
 * Cómo se dice cada movimiento de puntos en la pantalla.
 *
 * Mismo criterio que `pedido-status.ts`: los códigos del value set son la
 * identidad y **jamás se muestran**; acá vive el castellano. Cuando la
 * terminología del backend llegue con sus etiquetas, este archivo se reemplaza
 * por esa lectura y nadie más se entera.
 */

/** Lo que se lee en la fila del movimiento cuando no hay detalle propio. */
const ETIQUETAS: Readonly<Record<MotivoDePuntos, string>> = {
  BIENVENIDA: 'Bienvenida',
  COMPRA: 'Compra',
  CANJE: 'Canje',
  VENCIMIENTO: 'Puntos vencidos',
  AJUSTE: 'Ajuste',
};

export function etiquetaDeMotivo(motivo: MotivoDePuntos): string {
  return ETIQUETAS[motivo];
}

/**
 * El tono del badge sale de la **dirección**, no del motivo.
 *
 * Por dos razones. Una: un `AJUSTE` puede sumar o restar, así que el motivo no
 * alcanza para saber de qué lado está. Otra: el único tono que distinguiría a
 * `VENCIMIENTO` del resto es el ámbar, y el sistema lo reserva para el punto de
 * acción único de la pantalla —acá, canjear—: una lista con cinco ámbares se lo
 * comería. Y no hace falta, porque el badge dice «Puntos vencidos» con todas
 * las letras, que es más claro que un color.
 */
export function tonoDeMovimiento(direccion: DireccionDePuntos): 'success' | 'secondary' {
  return direccion === 'CREDITO' ? 'success' : 'secondary';
}

/**
 * El signo delante de la cifra.
 *
 * El color no alcanza para decir si sumaste o restaste —la regla del sistema es
 * que el color nunca sea el único portador de significado— así que el signo va
 * en el texto.
 */
export function signoDe(direccion: DireccionDePuntos): string {
  return direccion === 'CREDITO' ? '+' : '−';
}

/**
 * Cómo se anuncia el movimiento a un lector de pantalla.
 *
 * «+45 puntos» dicho por un lector puede sonar ambiguo; esto lo dice con
 * palabras, que es lo que se escucha bien.
 */
export function movimientoEnPalabras(
  direccion: DireccionDePuntos,
  puntos: string,
  motivo: MotivoDePuntos,
): string {
  const verbo = direccion === 'CREDITO' ? 'Sumaste' : 'Restaste';
  return `${verbo} ${puntos} puntos — ${etiquetaDeMotivo(motivo).toLowerCase()}`;
}
