import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { expand, map, reduce, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  ValueSetExpansionPage,
  ValueSetExpansionQuery,
  ValueSetOption,
} from './terminology.types';

/**
 * Tope de páginas que `readAllOptions` recorre.
 *
 * Un conjunto de valores que necesite más de 20 páginas de 200 no es una lista
 * para un desplegable, y seguir pidiendo sería colgar la pantalla en vez de
 * admitirlo. El corte es explícito y no silencioso: ver `readAllOptions`.
 */
const MAX_PAGES = 20;

/** Miembros por página cuando se recorre la expansión entera. */
const BULK_PAGE_SIZE = 200;

/**
 * Cliente de `terminology`: lectura de las opciones de un conjunto de valores.
 *
 * Sólo cubre la lectura. Las operaciones que **materializan** la expansión
 * (`POST ValueSet/:id/$expand`) y el alta de conjuntos exigen `SECURITY_ADMIN` y
 * no tienen consumidor en esta aplicación: no se envuelven para no publicar una
 * API que nadie puede ejercer.
 */
@Injectable({
  providedIn: 'root',
})
export class TerminologyClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * `GET /terminology/value-sets/:id/$expand` — una página de la expansión.
   *
   * @param valueSetId - Conjunto de valores a leer.
   * @param query - Versión, cursor y tope de página, todos opcionales.
   * @returns La página con su cursor de continuación.
   */
  readExpansion(
    valueSetId: string,
    query: ValueSetExpansionQuery = {},
  ): Observable<ValueSetExpansionPage> {
    let params = new HttpParams();
    // Se arma parámetro a parámetro y no con un objeto porque el backend valida
    // con `forbidNonWhitelisted`: un opcional presente en `undefined` viajaría
    // como clave declarada y la petición volvería con 400.
    if (query.valueSetVersionId !== undefined) {
      params = params.set('valueSetVersionId', query.valueSetVersionId);
    }
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor);
    }
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }

    return this.http.get<ValueSetExpansionPage>(
      // El `$` va **literal**, no como `%24`. Express enruta sobre el path sin
      // decodificar, así que `%24expand` no casa con la ruta `:id/$expand` y
      // vuelve 404 — verificado contra la API viva. El `$` es un sub-delimitador
      // legal en un segmento de path, no hace falta escaparlo.
      this.url(`/terminology/value-sets/${encodeURIComponent(valueSetId)}/$expand`),
      { params },
    );
  }

  /**
   * Recorre la expansión entera siguiendo los cursores y devuelve las opciones
   * en una sola emisión.
   *
   * Es lo que necesita un `<select>`: la lista completa, una sola vez. Para una
   * lista larga que se pagine en pantalla, usar `readExpansion` y guardar el
   * cursor.
   *
   * Corta a las {@link MAX_PAGES} páginas. El corte devuelve lo recorrido en vez
   * de lanzar —una lista incompleta sigue siendo utilizable— pero deja el aviso
   * en consola, porque una lista truncada en silencio es indistinguible de una
   * lista que de verdad terminó ahí.
   *
   * @param valueSetId - Conjunto de valores a leer.
   * @param valueSetVersionId - Versión concreta; por defecto, la vigente.
   * @returns Todas las opciones, en el orden de la expansión.
   */
  readAllOptions(
    valueSetId: string,
    valueSetVersionId?: string,
  ): Observable<readonly ValueSetOption[]> {
    let pages = 0;

    return this.readExpansion(valueSetId, {
      valueSetVersionId,
      limit: BULK_PAGE_SIZE,
    }).pipe(
      expand((page) => {
        pages += 1;
        if (page.nextCursor === null) return [];
        if (pages >= MAX_PAGES) {
          console.warn(
            `[terminology] El conjunto ${valueSetId} tiene más de ${MAX_PAGES * BULK_PAGE_SIZE} ` +
              'opciones: se devuelven las recorridas hasta acá.',
          );
          return [];
        }
        return this.readExpansion(valueSetId, {
          valueSetVersionId,
          cursor: page.nextCursor,
          limit: BULK_PAGE_SIZE,
        });
      }),
      reduce(
        (all: ValueSetOption[], page: ValueSetExpansionPage) => [...all, ...page.items],
        [],
      ),
      map((all) => all as readonly ValueSetOption[]),
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}
