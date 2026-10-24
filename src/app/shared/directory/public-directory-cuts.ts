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
export const POR_PETICION_PUBLICA = 50;

/**
 * Cuántas páginas se recorren como máximo.
 *
 * Un directorio se hojea entero, y el tope existe para que un catálogo que
 * crezca sin control no encadene peticiones indefinidamente. Cuando se llega,
 * la pantalla **lo dice** en vez de seguir pidiendo en silencio.
 */
export const MAX_PAGINAS_PUBLICAS = 10;

/** Lo que devuelve el recorrido: las filas y si se cortó por el techo. */
export interface DirectorioEntero {
  readonly filas: readonly PublicSearchResult[];
  readonly recortado: boolean;
}

/**
 * Recorre el cursor hasta agotarlo, o hasta el techo de páginas.
 *
 * Recursivo y no un bucle porque cada página depende del cursor de la
 * anterior: no se pueden pedir en paralelo.
 */
export function leerDirectorioEntero(
  buscar: (consulta: PublicSearchQuery) => Observable<PublicPage<PublicSearchResult>>,
  consulta: PublicSearchQuery,
  acumulado: readonly PublicSearchResult[] = [],
  cursor?: string,
  pagina = 0,
): Observable<DirectorioEntero> {
  return buscar({ ...consulta, limit: POR_PETICION_PUBLICA, ...(cursor ? { cursor } : {}) }).pipe(
    switchMap((respuesta) => {
      const filas = [...acumulado, ...respuesta.items];
      if (respuesta.nextCursor === null) {
        return of({ filas, recortado: false });
      }
      if (pagina + 1 >= MAX_PAGINAS_PUBLICAS) {
        return of({ filas, recortado: true });
      }
      return leerDirectorioEntero(buscar, consulta, filas, respuesta.nextCursor, pagina + 1);
    }),
  );
}

/** Las filas de una categoría; `null` no acota. */
export function deLaCategoria(
  filas: readonly PublicSearchResult[],
  categoria: string | null,
): readonly PublicSearchResult[] {
  return categoria === null ? filas : filas.filter((fila) => fila.category?.code === categoria);
}

/** Las filas cuya ciudad cae en el departamento; `null` no acota. */
export function delDepartamento(
  filas: readonly PublicSearchResult[],
  departamento: string | null,
  porCiudad: ReadonlyMap<string, string>,
): readonly PublicSearchResult[] {
  if (departamento === null) {
    return filas;
  }
  return filas.filter(
    (fila) => fila.city !== null && porCiudad.get(normalizePlace(fila.city)) === departamento,
  );
}

/** Las filas de una ciudad, sin importar mayúsculas ni tildes; `null` no acota. */
export function deLaCiudad(
  filas: readonly PublicSearchResult[],
  ciudad: string | null,
): readonly PublicSearchResult[] {
  if (ciudad === null) {
    return filas;
  }
  const buscada = normalizePlace(ciudad);
  return filas.filter((fila) => fila.city !== null && normalizePlace(fila.city) === buscada);
}

/**
 * Cuántas filas tiene cada departamento.
 *
 * Se llama con los **otros** cortes puestos pero no con el del propio mapa:
 * contar con el mapa aplicado dejaría a los departamentos no elegidos en cero.
 */
export function cuentaPorDepartamento(
  filas: readonly PublicSearchResult[],
  porCiudad: ReadonlyMap<string, string>,
): ReadonlyMap<string, number> {
  const cuenta = new Map<string, number>();
  for (const fila of filas) {
    const conceptId = fila.city === null ? undefined : porCiudad.get(normalizePlace(fila.city));
    if (conceptId === undefined) continue;
    cuenta.set(conceptId, (cuenta.get(conceptId) ?? 0) + 1);
  }
  return cuenta;
}

/**
 * Las ciudades que de verdad tienen algo publicado, la que más tiene primero y
 * a igualdad por nombre. Salen de los resultados y no del catálogo: un chip que
 * siempre devuelve cero es peor que no tenerlo.
 */
export function ciudadesPublicadas(filas: readonly PublicSearchResult[]): readonly string[] {
  const cuenta = new Map<string, number>();
  for (const fila of filas) {
    if (fila.city !== null && fila.city !== '') {
      cuenta.set(fila.city, (cuenta.get(fila.city) ?? 0) + 1);
    }
  }
  return [...cuenta.entries()]
    .sort(([a, cuentaA], [b, cuentaB]) => cuentaB - cuentaA || a.localeCompare(b, 'es'))
    .map(([ciudad]) => ciudad);
}

/**
 * Las categorías que de verdad hay, de la que más filas tiene a la que menos y
 * a igualdad por nombre. Una fila sin categoría no inventa una «Otras».
 */
export function categoriasPublicadas(
  filas: readonly PublicSearchResult[],
): readonly { readonly code: string; readonly label: string }[] {
  const cuenta = new Map<string, { label: string; total: number }>();
  for (const fila of filas) {
    const categoria = fila.category;
    if (categoria === null) continue;
    const anterior = cuenta.get(categoria.code);
    cuenta.set(categoria.code, { label: categoria.label, total: (anterior?.total ?? 0) + 1 });
  }
  return [...cuenta.entries()]
    .sort(([, a], [, b]) => b.total - a.total || a.label.localeCompare(b.label, 'es'))
    .map(([code, { label }]) => ({ code, label }));
}
