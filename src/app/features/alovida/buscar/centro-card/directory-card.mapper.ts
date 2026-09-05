/* ============================================================================
    Lo que los cuatro directorios públicos comparten al armar una tarjeta.

    Hospitales, laboratorios y aseguradoras salen de la **misma** fila
    (`PublicSearchResult`, `GET /public/search/*`), así que sus datos comunes
    —dónde queda, si la identidad está verificada, cómo la calificaron— se
    traducen una sola vez. Lo que cambia por vertical vive en el mapeador de
    cada pantalla; medicamentos no pasa por acá porque no viene del buscador
    sino de la vitrina de farmacia.

    Identificadores en inglés y prosa en castellano (TAREA 29).

    ## La regla que gobierna todo este archivo

    **Si el campo no viene, la fila no se construye** (AC-06-19). No hay
    «Sin dirección», no hay «—», no hay valor de relleno: un renglón que dice
    que falta un dato ocupa el mismo lugar que el que lo trae, y en una grilla
    de veinte tarjetas eso es veinte veces el mismo aviso inútil. Peor, en un
    directorio de salud un valor de muestra es un dato falso.
    ========================================================================== */

import type { PublicSearchResult } from '@core/data-access/public-directory/public-directory.types';
import type { CardDetailRow } from '@shared/components/molecules/card-detail-panel/card-detail-panel.types';

import type { CentroTarjeta } from './centro-card.types';

/** Una tarjeta de directorio con su desplegable y su ficha. */
export interface DirectoryCard {
  /** Clave estable de la lista. */
  readonly id: string;
  /** El nombre, suelto: encabeza el desplegable y nombra los diálogos. */
  readonly name: string;
  /** Lo que dibuja `CentroCard`. */
  readonly card: CentroTarjeta;
  /** El resto de los datos, para el panel «Ver más información». */
  readonly details: readonly CardDetailRow[];
  /** La ficha pública (`/o/:slug`, `/l/:slug`, `/s/:slug`). */
  readonly profileLink: string;
}

/**
 * Agrega una fila **sólo si hay valor**.
 *
 * Centralizarlo evita el error que se comete una vez por vertical: interpolar
 * el campo igual y que en pantalla quede «Dirección: null».
 */
export function addRow(
  rows: CardDetailRow[],
  label: string,
  value: string | null | undefined,
): void {
  if (value === null || value === undefined) {
    return;
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return;
  }
  rows.push({ label, value: trimmed });
}

/**
 * Cómo se rotula la identidad de una ficha pública.
 *
 * Siempre hay fila: lo declarado se muestra **rotulado** como declarado, nunca
 * escondido. Una ficha sin nada dicho sobre su verificación se leería como
 * verificada por omisión, que es exactamente lo que no puede pasar en un
 * directorio de salud.
 */
export function identityText(result: PublicSearchResult): string {
  return result.verified
    ? 'Verificada por AloVida'
    : 'Declarada por la propia organización, sin verificar';
}

/**
 * La calificación en palabras, o `null` cuando todavía no hay reseñas.
 *
 * `ratingCount: 0` con `ratingAverage: null` es el estado normal de un
 * directorio recién poblado, y escribir «0,0 de 5» diría que la atención se
 * calificó mal cuando nadie la calificó todavía.
 */
export function ratingText(result: PublicSearchResult): string | null {
  if (result.ratingAverage === null || result.ratingCount === 0) {
    return null;
  }
  const average = result.ratingAverage.toFixed(1).replace('.', ',');
  const noun = result.ratingCount === 1 ? 'reseña' : 'reseñas';
  return `${average} de 5, sobre ${result.ratingCount} ${noun}`;
}

/**
 * Las filas que las tres fichas de `PublicSearchResult` comparten.
 *
 * El orden importa: primero dónde queda —que es lo que se busca cuando se abre
 * el panel—, después qué tan confiable es el dato.
 */
export function commonRows(result: PublicSearchResult): CardDetailRow[] {
  const rows: CardDetailRow[] = [];
  addRow(rows, 'Dirección', result.address);
  addRow(rows, 'Ciudad', result.city);
  addRow(rows, 'Identidad', identityText(result));
  addRow(rows, 'Calificación', ratingText(result));
  return rows;
}

/**
 * El aviso de que la ficha no se puede ubicar en un mapa, o `null` si sí.
 *
 * `location` llega `null` para casi todo el padrón: el dataset de
 * establecimientos trae dirección y municipio, no coordenadas (P-06-4). Decir
 * que no está ubicada es un dato cierto y útil —explica por qué esa tarjeta no
 * ofrece «Cómo llegar»—; inventarle un punto sería mandar a alguien a una
 * esquina equivocada.
 */
export function unlocatedNote(result: PublicSearchResult): string | null {
  return result.location === null
    ? 'Esta ficha todavía no publicó su ubicación en el mapa'
    : null;
}
