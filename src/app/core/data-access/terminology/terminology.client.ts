import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { expand, map, of, reduce, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  ConceptLabels,
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

  /**
   * `GET /terminology/concepts?ids=…` — traduce identificadores a etiqueta.
   *
   * Es el camino inverso al del selector, y el que necesita **cualquier
   * pantalla que muestre lo que el contrato devuelve**: estados, ciclos de vida
   * y clasificaciones viajan siempre como `*ConceptId` en uuid, y un uuid en
   * pantalla no le dice nada a nadie.
   *
   * La lectura no exige rol de administración —el catálogo es metadato
   * compartido, sin datos de paciente— y el backend no recorta por el tope de
   * la búsqueda por texto: quien manda 120 ids recibe los 120.
   *
   * Devuelve un mapa y no una lista porque el uso siempre es «dame la etiqueta
   * de este id»; buscar en un array en cada celda sería cuadrático sin motivo.
   * Los ids que el catálogo no conozca sencillamente no aparecen: la ausencia
   * la resuelve quien muestra, que es el único que sabe qué poner en su lugar.
   *
   * @param conceptIds - Identificadores a resolver. Vacío no llama a la API.
   * @returns Las etiquetas encontradas, indexadas por identificador.
   */
  readConceptLabels(conceptIds: readonly string[]): Observable<ConceptLabels> {
    const sinRepetir = [...new Set(conceptIds)];
    if (sinRepetir.length === 0) {
      return of(new Map<string, ValueSetOption>());
    }

    // El backend los espera separados por coma, no repitiendo la clave.
    const params = new HttpParams().set('ids', sinRepetir.join(','));

    return this.http
      .get<ConceptSearchPage>(this.url('/terminology/concepts'), { params })
      .pipe(map((page) => new Map(page.items.map((item) => [item.conceptId, item]))));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/** Respuesta de la búsqueda de conceptos. Sin cursor: la acota `limit`. */
interface ConceptSearchPage {
  readonly items: readonly ValueSetOption[];
  readonly count: number;
  readonly limit: number;
}
