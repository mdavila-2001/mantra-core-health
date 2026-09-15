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
 * La cifra con su sustantivo concordado.
 *
 * Un solo punto es «1 punto», no «1 puntos». Vive acá y no en cada plantilla
 * porque el mismo texto se arma en tres lugares —la fila, el comprobante y el
 * anuncio para lector de pantalla— y tres copias es garantía de que una quede
 * mal.
 */
export function puntosEnPalabras(puntos: string): string {
  return `${puntos} ${unidadDePuntos(puntos)}`;
}

/**
 * Sólo el sustantivo, para cuando la cifra va destacada aparte y no puede
 * viajar dentro del mismo nodo de texto.
 */
export function unidadDePuntos(puntos: string): string {
  return puntos.trim() === '1' ? 'punto' : 'puntos';
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
  return `${verbo} ${puntosEnPalabras(puntos)} — ${etiquetaDeMotivo(motivo).toLowerCase()}`;
}

/**
 * Cómo se dice un multiplicador de promoción: «x2», «x3» (F4.5).
 *
 * **No es el del nivel.** `NivelDeMembresia.multiplicador` escala toda la
 * acumulación de un nivel y hoy vale «1» o «1.25»; éste lo pone una promoción,
 * dura hasta una fecha y no tiene contrato. Vive acá, con el resto de cómo se
 * dicen los puntos, para que el chip de «Mis puntos» y la tarjeta de promoción
 * de T-E7 («Puntos x2») salgan del mismo lugar y no de dos copias.
 */
export function etiquetaDeMultiplicador(factor: string): string {
  return `x${factor.trim()}`;
}
