import { of, switchMap, type Observable } from 'rxjs';

import type {
  PublicPage,
  PublicSearchQuery,
  PublicSearchResult,
} from '@core/data-access/public-directory/public-directory.types';
import { normalizePlace } from '@shared/geo/city-department';

/**
 * La lógica de los directorios de lugares de la red social, en **un** lugar
 * (carril 18, REQ-18-003/004).
 *
 * El directorio público de hospitales (`/search/hospitals`) y los directorios
 * del panel con sesión (`/clinics-directory`, `/pharmacies-directory`) hacen
 * lo mismo con los mismos datos: traen el directorio entero recorriendo el
 * cursor de `GET /public/search/*` y lo acotan en memoria por departamento,
 * ciudad y categoría. Hasta este carril eso estaba escrito dos veces, y las dos
 * copias ya se habían separado: la del panel comparaba la ciudad sin
 * normalizar, así que «La Paz» y «la paz» no eran la misma ciudad.
 *
 * Acá queda sólo lo que no depende de cómo se dibuja: la pantalla pública
 * pinta tarjetas de lugar con mapa y la del panel usa `app-directory-page`,
 * pero el contexto —con sesión o sin ella— sólo cambia la pintura y adónde
 * lleva la ficha, nunca qué resultados se ven.
 */

/** Tope por página que acepta el contrato público (`limit` se recorta a 50). */
export const PUBLIC_PAGE_LIMIT = 50;

/**
 * Cuántas páginas se recorren como máximo.
 *
 * Un directorio se hojea entero, y el tope existe para que un catálogo que
 * crezca sin control no encadene peticiones indefinidamente. Cuando se llega,
 * la pantalla **lo dice** en vez de seguir pidiendo en silencio.
 */
export const PUBLIC_MAX_PAGES = 10;

/** Lo que devuelve el recorrido: las filas y si se cortó por el techo. */
export interface WholeDirectory {
  readonly rows: readonly PublicSearchResult[];
  readonly truncated: boolean;
}

/**
 * Recorre el cursor hasta agotarlo, o hasta el techo de páginas.
 *
 * Recursivo y no un bucle porque cada página depende del cursor de la
 * anterior: no se pueden pedir en paralelo.
 */
export function readWholeDirectory(
  search: (query: PublicSearchQuery) => Observable<PublicPage<PublicSearchResult>>,
  query: PublicSearchQuery,
  accumulated: readonly PublicSearchResult[] = [],
  cursor?: string,
  page = 0,
): Observable<WholeDirectory> {
  return search({ ...query, limit: PUBLIC_PAGE_LIMIT, ...(cursor ? { cursor } : {}) }).pipe(
    switchMap((response) => {
      const rows = [...accumulated, ...response.items];
      if (response.nextCursor === null) {
        return of({ rows, truncated: false });
      }
      if (page + 1 >= PUBLIC_MAX_PAGES) {
        return of({ rows, truncated: true });
      }
      return readWholeDirectory(search, query, rows, response.nextCursor, page + 1);
    }),
  );
}

/** Las filas de una categoría; `null` no acota. */
export function byCategory(
  rows: readonly PublicSearchResult[],
  category: string | null,
): readonly PublicSearchResult[] {
  return category === null ? rows : rows.filter((row) => row.category?.code === category);
}

/** Las filas cuya ciudad cae en el departamento; `null` no acota. */
export function byDepartment(
  rows: readonly PublicSearchResult[],
  department: string | null,
  cityToDepartment: ReadonlyMap<string, string>,
): readonly PublicSearchResult[] {
  if (department === null) {
    return rows;
  }
  return rows.filter(
    (row) => row.city !== null && cityToDepartment.get(normalizePlace(row.city)) === department,
  );
}

/** Las filas de una ciudad, sin importar mayúsculas ni tildes; `null` no acota. */
export function byCity(
  rows: readonly PublicSearchResult[],
  city: string | null,
): readonly PublicSearchResult[] {
  if (city === null) {
    return rows;
  }
  const wanted = normalizePlace(city);
  return rows.filter((row) => row.city !== null && normalizePlace(row.city) === wanted);
}

/**
 * Cuántas filas tiene cada departamento.
 *
 * Se llama con los **otros** cortes puestos pero no con el del propio mapa:
 * contar con el mapa aplicado dejaría a los departamentos no elegidos en cero.
 */
export function countByDepartment(
  rows: readonly PublicSearchResult[],
  cityToDepartment: ReadonlyMap<string, string>,
): ReadonlyMap<string, number> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const conceptId = row.city === null ? undefined : cityToDepartment.get(normalizePlace(row.city));
    if (conceptId === undefined) continue;
    counts.set(conceptId, (counts.get(conceptId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Las ciudades que de verdad tienen algo publicado, la que más tiene primero y
 * a igualdad por nombre. Salen de los resultados y no del catálogo: un chip que
 * siempre devuelve cero es peor que no tenerlo.
 */
export function publishedCities(rows: readonly PublicSearchResult[]): readonly string[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (row.city !== null && row.city !== '') {
      counts.set(row.city, (counts.get(row.city) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b, 'es'))
    .map(([city]) => city);
}

/**
 * Las categorías que de verdad hay, de la que más filas tiene a la que menos y
 * a igualdad por nombre. Una fila sin categoría no inventa una «Otras».
 */
export function publishedCategories(
  rows: readonly PublicSearchResult[],
): readonly { readonly code: string; readonly label: string }[] {
  const counts = new Map<string, { label: string; total: number }>();
  for (const row of rows) {
    const category = row.category;
    if (category === null) continue;
    const previous = counts.get(category.code);
    counts.set(category.code, { label: category.label, total: (previous?.total ?? 0) + 1 });
  }
  return [...counts.entries()]
    .sort(([, a], [, b]) => b.total - a.total || a.label.localeCompare(b.label, 'es'))
    .map(([code, { label }]) => ({ code, label }));
}
