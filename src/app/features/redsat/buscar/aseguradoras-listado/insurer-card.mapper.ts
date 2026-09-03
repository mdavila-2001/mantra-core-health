/* ============================================================================
    De una fila de `GET /public/search/insurers` a la tarjeta de una
    aseguradora.

    Identificadores en inglés, prosa en castellano (TAREA 29).
    ========================================================================== */

import type { PublicSearchResult } from '@core/data-access/public-directory/public-directory.types';
import type { CardDetailRow } from '@shared/components/molecules/card-detail-panel/card-detail-panel.types';

import type { CentroAtributo, CentroTarjeta } from '../centro-card/centro-card.types';
import {
  addRow,
  commonRows,
  ratingText,
  type DirectoryCard,
} from '../centro-card/directory-card.mapper';
import { dondeQueda, inicialesDe, puntuacionDe, rutaDeFicha } from '../public-result.mapper';

/** Una aseguradora, con su tarjeta y su desplegable. */
export type InsurerCard = DirectoryCard;

/**
 * Los atributos de la fila inferior de una aseguradora.
 *
 * **Sin turno, y es la diferencia de fondo con los otros dos verticales.** Una
 * aseguradora no da citas: pintar «con agenda publicada» en su tarjeta —aunque
 * el campo llegue— diría que se puede sacar hora con la aseguradora, que no es
 * cierto. Lo que se muestra es el ramo, cuando la ficha lo publicó, y la
 * calificación cuando hay reseñas.
 *
 * Lo que AC-06-4 pide además —ramo y si ofrece salud, como campos— vive en
 * `insurance.insurance_carriers` y en `bolivia-insurance.catalog.ts`
 * (`razonSocial`, `sigla`, `nit`, `direccion`, `ramo`, `ofreceSalud`), **no**
 * en el índice del buscador público: `GET /public/search/insurers` proyecta
 * `community.public_profiles`, donde lo más cercano al ramo es `headline`. Se
 * pinta esa línea y no se inventa el campo.
 */
function insurerAttributes(result: PublicSearchResult): CentroAtributo[] {
  const attributes: CentroAtributo[] = [];

  if (result.headline !== null && result.headline.trim() !== '') {
    attributes.push({ clave: 'ramo', texto: result.headline });
  }

  const rating = puntuacionDe(result);
  const label = ratingText(result);
  if (rating !== null && label !== null) {
    attributes.push({
      clave: 'puntuacion',
      texto: `${rating} (${result.ratingCount})`,
      etiqueta: label,
    });
  }

  return attributes;
}

function insurerRows(result: PublicSearchResult): CardDetailRow[] {
  const rows: CardDetailRow[] = [];
  addRow(rows, 'Qué cubre', result.headline);
  rows.push(...commonRows(result));
  return rows;
}

/**
 * Traduce una fila del directorio a la tarjeta de una aseguradora.
 *
 * Se arma a mano y no con `aCentro` porque `aCentro` agrega el atributo de
 * turno, que en este vertical miente. Lo que sí se comparte —dónde queda, las
 * iniciales, la ruta de la ficha— sale de las mismas funciones.
 */
export function toInsurerCard(result: PublicSearchResult): InsurerCard {
  const card: CentroTarjeta = {
    id: `${result.kind}:${result.slug}`,
    nombre: result.displayName,
    // `/s/:slug`.
    link: rutaDeFicha(result),
    titular: result.headline === '' ? null : result.headline,
    donde: dondeQueda(result),
    // Ni `insurance-carriers.dataset.json` ni `insurance.insurance_carriers`
    // tienen logo o imagen, así que esto llega `null` siempre y la tarjeta
    // degrada al degradado del tema con las iniciales. Un logo corporativo
    // tiene dueño: de dónde salen es P-06-2, y no se resuelve poniendo una
    // imagen de archivo (AC-06-3).
    portada: result.coverUrl,
    logo: result.avatarUrl,
    iniciales: inicialesDe(result.displayName),
    sellos: [
      result.verified
        ? { texto: 'Verificada', tono: 'ok' as const }
        : { texto: 'Declarada', tono: 'neutro' as const },
    ],
    atributos: insurerAttributes(result),
  };

  return {
    id: card.id,
    name: result.displayName,
    card,
    details: insurerRows(result),
    profileLink: rutaDeFicha(result),
  };
}
