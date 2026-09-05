/* ============================================================================
    De una fila de `GET /public/search/organizations` a la tarjeta de un
    establecimiento.

    Identificadores en inglés, prosa en castellano (TAREA 29).
    ========================================================================== */

import type {
  PublicLocation,
  PublicSearchResult,
} from '@core/data-access/public-directory/public-directory.types';
import type { CardDetailRow } from '@shared/components/molecules/card-detail-panel/card-detail-panel.types';

import {
  addRow,
  commonRows,
  unlocatedNote,
  type DirectoryCard,
} from '../centro-card/directory-card.mapper';
import { aCentro, rutaDeFicha } from '../public-result.mapper';

/** Un establecimiento, con lo que su tarjeta y sus botones necesitan. */
export interface FacilityCard extends DirectoryCard {
  /**
   * El punto del establecimiento, o `null`.
   *
   * Sin él **no se dibuja «Cómo llegar»**: un botón que abre un mapa sin
   * destino es peor que no tenerlo. El padrón de 642 establecimientos trae
   * dirección y municipio, no coordenadas (P-06-4), así que hoy esto llega
   * `null` casi siempre y la tarjeta lo dice en su desplegable.
   */
  readonly location: PublicLocation | null;
  /** La dirección, para encabezar el diálogo de «Cómo llegar». */
  readonly address: string | null;
}

/**
 * Qué muestra el desplegable de un establecimiento.
 *
 * Los datos por vertical que pide AC-06-4 —tipo, nivel, municipio— viven en
 * `VS_BO_HEALTH_FACILITY` (`bolivia-facilities.catalog.ts`), **no** en
 * `PublicSearchResult`: `toResult` de `community-public.service.ts` proyecta
 * una lista blanca de nueve claves y hay una prueba que falla si aparece una
 * más. Servirlos es agregar campos al DTO, del lado de la API. Hasta que eso
 * pase, acá se muestra lo que la API sí sirve y nada más: rellenar «Nivel: 2»
 * con un valor de muestra sería inventar la categoría de un hospital real.
 */
function facilityRows(result: PublicSearchResult, card: DirectoryCard['card']): CardDetailRow[] {
  const rows: CardDetailRow[] = [];
  addRow(rows, 'Qué es', result.headline);
  rows.push(...commonRows(result));

  // El texto de la agenda ya lo formateó `aCentro`; volver a derivarlo acá
  // daría dos formas de escribir la misma fecha y una de las dos se
  // desactualizaría.
  const shift = card.atributos.find((attribute) => attribute.clave === 'turno');
  addRow(rows, 'Agenda', shift?.texto);

  addRow(rows, 'Ubicación', unlocatedNote(result));
  return rows;
}

/** Traduce una fila del directorio a la tarjeta de un establecimiento. */
export function toFacilityCard(result: PublicSearchResult): FacilityCard {
  const card = aCentro(result);
  return {
    id: card.id,
    name: result.displayName,
    card,
    details: facilityRows(result, card),
    // `/o/:slug`, la ficha pública real (`features/public-profile/`), no la
    // maqueta portada de `perfil-organizacion-detalle`.
    profileLink: rutaDeFicha(result),
    location: result.location,
    address: result.address,
  };
}
