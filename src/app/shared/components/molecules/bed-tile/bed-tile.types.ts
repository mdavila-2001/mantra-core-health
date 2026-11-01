/** El tono de una cama: el del estado resumido, nunca el único canal (va con texto). */
export type BedTileTone = 'free' | 'occupied' | 'reserved' | 'pending' | 'isolation' | 'contaminated' | 'unavailable';

/**
 * Lo que una celda del tablero muestra, ya escrito. La molécula no conoce el
 * dominio: el tablero arma esto desde la celda de la API.
 */
export interface BedTileView {
  readonly code: string;
  /** La letra del resumen (HL7 v2-0116 o la extensión local). */
  readonly statusCode: string;
  /** El resumen en palabras: «Libre», «Ocupada», «No disponible»… */
  readonly statusLabel: string;
  readonly tone: BedTileTone;
  /** Motivo de la no disponibilidad, si la hay. */
  readonly reason?: string | null;
  /** «hasta 30/10 18:00», si hay fecha estimada. */
  readonly until?: string | null;
  /** «Aislamiento de contacto», si lo hay. */
  readonly isolation?: string | null;
  /** «JMC · M · 67 a», sólo para quien puede verlo. */
  readonly patient?: string | null;
  /** Higiene, cuando no es la de una cama lista. */
  readonly hygiene?: string | null;
  /** «hace 12 min»: antigüedad del último evento de la cama. */
  readonly age?: string | null;
}
