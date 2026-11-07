/* ============================================================================
    The clinical network's plane: fixed measures and the shapes `ubicarRed`
    returns (`red-clinica.geometria.ts`).
    ========================================================================== */

import type { MotivoDelVinculo, RegistroDeLaRed } from './red-clinica.model';
import type { EpisodioClinico, HitoDelEpisodio } from './red-clinica.episodio';

/** Measures in CSS pixels. Fixed: the routing depends on them. */
export const MEDIDAS_DE_LA_RED = {
  anchoAncha: 248,
  anchoAngosta: 76,
  altoEje: 76,
  altoCabeceraHilo: 48,
  altoPista: 32,
  altoNodo: 86,
  altoCompacto: 40,
  altoGrupo: 56,
  separacionNodos: 16,
  rellenoHilo: 14,
  separacionHilos: 10,
  huecoAncho: 64,
  huecoAngosto: 14,
} as const;

/** Where the lane closest to a card starts in its aisle: more than an arrowhead. */
export const INICIO_DEL_PASILLO = 18;

/**
 * The distance between two parallel lanes: with the 6 px halo of each line,
 * 10 px leave 4 px of background between two neighbours, so a bundle reads
 * as separate lines (at 7 px the halos touched).
 */
export const PASO_DE_CARRIL = 10;

/**
 * The distance between two lanes of a thread's channel. Wider than an aisle's:
 * a channel's lines run side by side across several columns, and at 10 px a
 * bundle of seven read as one thick band.
 */
export const PASO_DEL_CANAL = 14;

/**
 * How far below the card's middle an inferred link leaves. A recorded and an
 * inferred link of one source never share their exit: on a shared stretch the
 * solid line covered the dotted one, and «inferido» fell on a recorded stretch.
 */
export const DESVIO_DE_LO_INFERIDO = 12;

/** Where a link leaves its source, in y: the middle, or below it if inferred. */
export function ySalida(desde: { readonly y: number; readonly alto: number }, inferido: boolean): number {
  return desde.y + desde.alto / 2 + (inferido ? DESVIO_DE_LO_INFERIDO : 0);
}

/** Room between the outermost lane and the next column's trunk. */
export const AIRE_CON_EL_TRONCO = 12;

/** How far from its column's left edge the encounter's trunk runs. */
export const DISTANCIA_DEL_TRONCO = 24;

/** Room between the channel and what is above and below it. */
export const MARGEN_DEL_CANAL = 8;

/** What is open. Everything not listed is collapsed. */
export interface EstadoDeLaRed {
  /** The expanded episodes (level 2). */
  readonly desplegados: ReadonlySet<string>;
  /**
   * What is open inside an episode: the ruled-out diagnoses (by id) and the
   * detail groups (by the key of their «+N»).
   */
  readonly abiertos: ReadonlySet<string>;
  /** If present, only these records are drawn. Empty or absent: all of them. */
  readonly visibles?: ReadonlySet<string> | null;
}

export type FormaDelNodo = 'tarjeta' | 'descartado' | 'plegar' | 'grupo';

export interface NodoDeLaRed {
  /** The real record's id; for the controls, `grupo:…` or `plegar:…`. */
  readonly id: string;
  readonly forma: FormaDelNodo;
  /** The record it stands for; absent in a group. */
  readonly registro?: RegistroDeLaRed;
  readonly episodio: string;
  readonly columna: number;
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly alto: number;
  /** Groups only: what it opens or closes. */
  readonly grupo?: {
    readonly accion: 'expandir' | 'contraer';
    readonly clave: string;
    readonly ocultos: readonly RegistroDeLaRed[];
  };
}

export interface ColumnaDeLaRed {
  readonly clave: string;
  readonly x: number;
  readonly ancho: number;
  readonly ancha: boolean;
  readonly fecha: Date | null;
  readonly encuentroId: string | null;
  /** As in the previous tour: encounter in view, day with a hidden encounter, or no encounter. */
  readonly contexto: 'atencion' | 'dia' | 'sin-atencion';
  readonly intervalo: string;
  readonly hueco: number;
}

export interface HitoUbicado {
  readonly x: number;
  readonly y: number;
  readonly columna: number;
  readonly tipo: HitoDelEpisodio['tipo'];
  readonly titulos: readonly string[];
}

export interface HiloDeLaRed {
  readonly episodio: EpisodioClinico;
  readonly y: number;
  readonly alto: number;
  readonly desplegado: boolean;
  /** Collapsed: the summary strip. */
  readonly hitos: readonly HitoUbicado[];
  readonly yPista: number;
  /** Expanded: where the channel runs. */
  readonly yCanal: number;
  readonly altoCanal: number;
  /**
   * Expanded but with none of its records in view: it measures what a
   * collapsed thread does, and says how many records are left and right of
   * the view. Set by `ajustarALaVentana`.
   */
  readonly fueraDeLaVentana?: { readonly antes: number; readonly despues: number };
}

export type Punto = readonly [number, number];

export interface AristaDeLaRed {
  readonly clave: string;
  readonly desde: string;
  readonly hasta: string;
  readonly motivo: MotivoDelVinculo;
  readonly inferido: boolean;
  /** `tronco`: from an encounter to what was entered in its column. `enlace`: with an arrow. */
  readonly familia: 'tronco' | 'enlace';
  readonly trazo: string;
  readonly puntos: readonly Punto[];
  /** Where the word «inferido» goes, if it is inferred. */
  readonly etiqueta?: { readonly x: number; readonly y: number; readonly vertical: boolean };
  /**
   * What is drawn of it inside the view, set by `ajustarALaVentana`: each
   * piece says whether it was cut at the view's edge (and gets a marker there).
   */
  readonly piezas?: readonly PiezaDeArista[];
}

export interface PiezaDeArista {
  readonly trazo: string;
  readonly puntos: readonly Punto[];
  readonly cortaInicio: boolean;
  readonly cortaFin: boolean;
}

/** The stretch of the plane in view, in canvas pixels. */
export interface VentanaDeLaRed {
  readonly desde: number;
  readonly hasta: number;
}

export interface PlanoDeLaRed {
  readonly ancho: number;
  readonly alto: number;
  readonly columnas: readonly ColumnaDeLaRed[];
  readonly hilos: readonly HiloDeLaRed[];
  readonly nodos: readonly NodoDeLaRed[];
  readonly aristas: readonly AristaDeLaRed[];
}

/** The key of a thread's detail group in a column. */
export function claveDeGrupo(episodio: string, columna: string): string {
  return `${episodio}|${columna}`;
}
