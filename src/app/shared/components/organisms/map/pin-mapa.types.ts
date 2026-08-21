import type { NeutralTone, Tone } from '../../tone/tone.types';

/** Un punto sobre la tierra, en grados decimales. */
export interface PuntoGeo {
  readonly lat: number;
  readonly lng: number;
}

/** El estado de un lugar, siempre en palabras: el tono solo lo colorea. */
export interface EstadoDePin {
  readonly etiqueta: string;
  readonly tono: Tone | NeutralTone;
}

/**
 * Lo que el mapa necesita para dibujar y anunciar un lugar.
 *
 * `id` es la referencia con la que la pantalla y el mapa hablan del mismo
 * lugar (la selección cruzada y `pinElegido` viajan con él): usá el código
 * corto de la lista, nunca un uuid — nada del mapa debe poder filtrar
 * identificadores.
 */
export interface PinMapa extends PuntoGeo {
  readonly id: string;
  /** La letra o código corto que la cara del pin muestra (el mismo de la lista). */
  readonly codigo?: string;
  readonly titulo: string;
  /** P. ej. «1,2 km en línea recta · Av. Busch 500». */
  readonly subtitulo?: string;
  readonly estado?: EstadoDePin;
  /** Texto del botón del popup; al activarlo el mapa emite `pinElegido`. */
  readonly ctaEtiqueta?: string;
}
