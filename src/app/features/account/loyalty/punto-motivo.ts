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

/**
 * Lo que se lee en la fila del movimiento cuando la lectura no trae detalle.
 *
 * Las claves son los códigos del catálogo del backend; el castellano vive acá y
 * sólo acá. Un motivo que la API no reconoció llega como `null` y se dice de la
 * forma más neutra posible, sin adivinar.
 */
const ETIQUETAS: Readonly<Record<MotivoDePuntos, string>> = {
  REASON_SIGNUP: 'Bienvenida',
  REASON_EVENT: 'Actividad en la app',
  REASON_REDEMPTION: 'Canje',
  REASON_EXPIRY: 'Puntos vencidos',
  REASON_REFERRAL: 'Referido',
  REASON_MANUAL: 'Ajuste',
};

export function etiquetaDeMotivo(motivo: MotivoDePuntos | null): string {
  return motivo === null ? 'Movimiento' : ETIQUETAS[motivo];
}

/**
 * El tono del badge sale de la **dirección**, no del motivo.
 *
 * Por dos razones. Una: un ajuste puede sumar o restar, así que el motivo no
 * alcanza para saber de qué lado está. Otra: el único tono que distinguiría al
 * vencimiento del resto es el ámbar, y el sistema lo reserva para el punto de
 * acción único de la pantalla —acá, canjear—: una lista con cinco ámbares se lo
 * comería. Y no hace falta, porque el badge dice «Puntos vencidos» con todas
 * las letras, que es más claro que un color.
 */
export function tonoDeMovimiento(
  direccion: DireccionDePuntos | null,
): 'success' | 'secondary' {
  return direccion === 'POINTS_EARN' ? 'success' : 'secondary';
}

/**
 * El signo delante de la cifra.
 *
 * El color no alcanza para decir si sumaste o restaste —la regla del sistema es
 * que el color nunca sea el único portador de significado— así que el signo va
 * en el texto. Un ajuste no lleva signo: la dirección del catálogo no dice
 * hacia dónde movió, y ponerle uno sería inventarlo.
 */
export function signoDe(direccion: DireccionDePuntos | null): string {
  if (direccion === 'POINTS_EARN') {
    return '+';
  }
  if (direccion === 'POINTS_REDEEM' || direccion === 'POINTS_EXPIRE') {
    return '−';
  }
  return '';
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
  direccion: DireccionDePuntos | null,
  puntos: string,
  motivo: MotivoDePuntos | null,
): string {
  const cola = etiquetaDeMotivo(motivo).toLowerCase();
  if (direccion === 'POINTS_EARN') {
    return `Sumaste ${puntosEnPalabras(puntos)} — ${cola}`;
  }
  if (direccion === 'POINTS_REDEEM' || direccion === 'POINTS_EXPIRE') {
    return `Restaste ${puntosEnPalabras(puntos)} — ${cola}`;
  }
  // Sin dirección conocida no se afirma el sentido del movimiento.
  return `Movimiento de ${puntosEnPalabras(puntos)} — ${cola}`;
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
