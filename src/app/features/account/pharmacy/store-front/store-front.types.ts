/* Types of the store front, moved out of the component (frozen at its size). */

import type { SearchOrigin } from '../../../nearby-places/search-origin-picker/search-origin-picker.types';
import type {
  ProductHit,
  SearchMode,
  SearchResult,
  SearchSort,
  StoreHit,
} from '../search/pharmacy-search.types';

/** Lo que la búsqueda en curso le pide al servicio. */
export interface Consulta {
  readonly termino: string;
  /** `true` busca lo escrito tal cual, sin que la API corrija el tipeo. */
  readonly exacto: boolean;
  readonly modo: SearchMode;
  readonly orden: SearchSort;
  readonly origen: SearchOrigin | null;
  readonly abiertas: boolean;
  readonly intento: number;
}

/** Una búsqueda que no llegó a consultar nada. */
export const NADA = { items: [], sinOrigen: false } as const;

/**
 * Lo que la lectura devuelve, en los dos modos.
 *
 * Es una unión y no un genérico porque el estado del anfitrión es **uno** y
 * tiene que poder llevar cualquiera de los dos: la pantalla separa las filas
 * en `StoreFront.filasDeProducto` y `StoreFront.filasDeSede`, que es donde el
 * modo ya se conoce.
 */
export type Resultado = SearchResult<ProductHit> | SearchResult<StoreHit>;
