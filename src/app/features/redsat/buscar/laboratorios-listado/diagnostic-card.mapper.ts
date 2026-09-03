/* ============================================================================
    De una fila de `GET /public/search/diagnostic-units` a la tarjeta de un
    laboratorio o centro de imagen.

    Identificadores en inglés, prosa en castellano (TAREA 29).
    ========================================================================== */

import type { PublicSearchResult } from '@core/data-access/public-directory/public-directory.types';
import type { CardDetailRow } from '@shared/components/molecules/card-detail-panel/card-detail-panel.types';

import type { CentroAtributo } from '../centro-card/centro-card.types';
import {
  addRow,
  commonRows,
  type DirectoryCard,
} from '../centro-card/directory-card.mapper';
import { aCentro, rutaDeFicha } from '../public-result.mapper';

/** Un laboratorio o centro de imagen, con su tarjeta y su desplegable. */
export type DiagnosticCard = DirectoryCard;

/**
 * Los atributos de la fila inferior de un laboratorio.
 *
 * Distintos de los de un hospital en lo que se puede: acá **el turno es el
 * dato**. A un centro de diagnóstico no se va a preguntar, se va con una orden
 * y una fecha, así que «con agenda publicada» decide más que la calificación y
 * por eso encabeza la fila.
 *
 * Lo que AC-06-4 pide además —qué estudios ofrece cada centro, como lista— la
 * API pública **no lo sirve**: `toResult` de `community-public.service.ts`
 * proyecta una lista blanca de nueve claves y `headline` es todo lo que hay
 * sobre la oferta del centro. Se pinta esa línea como titular y no se inventa
 * un catálogo de estudios que nadie cargó.
 */
function diagnosticAttributes(base: readonly CentroAtributo[]): CentroAtributo[] {
  const shift = base.filter((attribute) => attribute.clave === 'turno');
  const rest = base.filter((attribute) => attribute.clave !== 'turno');
  return [...shift, ...rest];
}

function diagnosticRows(result: PublicSearchResult, shiftText: string | undefined): CardDetailRow[] {
  const rows: CardDetailRow[] = [];
  addRow(rows, 'Qué ofrece', result.headline);
  addRow(rows, 'Turnos', shiftText);
  rows.push(...commonRows(result));
  return rows;
}

/** Traduce una fila del directorio a la tarjeta de un centro de diagnóstico. */
export function toDiagnosticCard(result: PublicSearchResult): DiagnosticCard {
  const base = aCentro(result);
  const shift = base.atributos.find((attribute) => attribute.clave === 'turno');
  return {
    id: base.id,
    name: result.displayName,
    card: { ...base, atributos: diagnosticAttributes(base.atributos) },
    details: diagnosticRows(result, shift?.texto),
    // `/l/:slug`.
    profileLink: rutaDeFicha(result),
  };
}
