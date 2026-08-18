import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { expand, forkJoin, map, of, reduce, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import type {
  ConceptDetail,
  ConceptLabels,
  ConceptSearchPage,
  ConceptSearchQuery,
  GlossaryQuery,
  GlossaryTagPage,
  GlossaryTagQuery,
  GlossaryTermDetail,
  GlossaryTermPage,
  ValueSetExpansionPage,
  ValueSetExpansionQuery,
  ValueSetOption,
} from './terminology.types';

/**
 * Idioma en el que se pide el catálogo.
 *
 * Constante y no configurable: es el idioma del producto. El día que haya que
 * elegirlo, sale de la sesión y no de aquí — pero mientras no exista esa
 * elección, un parámetro que nadie cambia es una pregunta sin dueño.
 *
 * Lo usan el glosario y {@link TerminologyClient.readConceptLabels}, que es por
 * donde piden sus etiquetas las diecisiete pantallas que muestran conceptos.
 */
const IDIOMA_DEL_CATALOGO = 'ES';

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
      reduce((all: ValueSetOption[], page: ValueSetExpansionPage) => [...all, ...page.items], []),
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
  /**
   * `GET /terminology/concepts?q=…` — busca conceptos por texto (UC-03-13).
   *
   * Es la **otra mitad** del endpoint que este cliente ya usaba. `readConceptLabels`
   * recorre el camino id → etiqueta, que es el que necesita cualquier pantalla
   * que muestre lo que el contrato devuelve. Éste recorre el inverso —texto →
   * concepto— y es el que hace falta para *elegir* un valor, o sencillamente
   * para poder mirar el catálogo, que hasta ahora no se podía desde ningún lado.
   *
   * No exige rol de administración: el catálogo es metadato compartido, sin
   * datos de paciente, y cualquier cliente autenticado necesita resolverlo para
   * poder crear recursos.
   *
   * @param query - Texto, versión del sistema de códigos y tope, todos opcionales.
   * @returns La página de resultados; sin cursor, la acota `limit`.
   */
  searchConcepts(query: ConceptSearchQuery = {}): Observable<ConceptSearchPage> {
    // Parámetro a parámetro y no con un objeto: el backend valida con
    // `forbidNonWhitelisted`, así que un opcional presente en `undefined`
    // viajaría como clave declarada y la petición volvería con 400.
    //
    // `lang` va siempre, por lo mismo que en `readConceptLabels`: sin él la
    // respuesta trae el rótulo del sistema de codificación, que está en inglés
    // a propósito porque es el catálogo. Los cinco consumidores de esta
    // búsqueda son elecciones de una persona —el buscador de medicamentos de la
    // receta, el catálogo de terminología, los selectores de formularios
    // clínicos y de alta de organización, la consulta por prefijo de
    // verificación—, o sea interfaz, no catálogo.
    //
    // **No acota el conjunto de resultados**, que es la duda razonable acá:
    // `lang` solo elige de qué designación sale el texto y degrada al rótulo
    // original cuando falta la traducción. Quien scopea es `includeValueSets`,
    // que es otro parámetro y no se manda. Por eso el buscador de medicamentos
    // sigue encontrando el vademécum entero.
    let params = new HttpParams().set('lang', IDIOMA_DEL_CATALOGO);
    if (query.query !== undefined && query.query !== '') {
      params = params.set('q', query.query);
    }
    if (query.codeSystemVersionId !== undefined) {
      params = params.set('codeSystemVersionId', query.codeSystemVersionId);
    }
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }

    return this.http.get<ConceptSearchPage>(this.url('/terminology/concepts'), { params });
  }

  /**
   * `GET /terminology/concepts/:conceptId` — la ficha del concepto elegido.
   *
   * Es el paso siguiente a {@link searchConcepts}: la búsqueda alcanza para
   * *elegir* —código y denominación—, pero no trae lo que cada sistema de
   * codificación declara de suyo. El vademécum publica ahí `dose_forms`,
   * `strengths` y `routes`, que es lo que la receta necesita para ofrecer
   * presentación y concentración en lugar de pedirlas tecleadas.
   *
   * **Sin `lang`**, a diferencia de {@link readGlossaryTerm}: pedirlo scopea la
   * lectura al value set paraguas del glosario y un medicamento no está ahí. Son
   * dos contratos sobre la misma URL — ver el comentario de arriba.
   *
   * @param conceptId - Concepto a leer.
   * @returns La ficha con sus propiedades declaradas.
   */
  readConceptDetail(conceptId: string): Observable<ConceptDetail> {
    return this.http.get<ConceptDetail>(
      this.url(`/terminology/concepts/${encodeURIComponent(conceptId)}`),
    );
  }

  readConceptLabels(conceptIds: readonly string[]): Observable<ConceptLabels> {
    const sinRepetir = [...new Set(conceptIds)];
    if (sinRepetir.length === 0) {
      return of(new Map<string, ValueSetOption>());
    }

    // Se parte en tandas porque el endpoint declara un tope de 200 ids y una
    // pantalla grande —un expediente clínico con sus cinco bloques— lo pasa sin
    // esfuerzo. Sin esto la petición vuelve con 400 y la pantalla entera se
    // queda sin etiquetas por culpa del id doscientos uno.
    const tandas = trocear(sinRepetir, MAX_IDS_POR_LECTURA).map((tanda) =>
      this.http.get<ConceptSearchPage>(this.url('/terminology/concepts'), {
        params: new HttpParams()
          // El backend los espera separados por coma, no repitiendo la clave.
          .set('ids', tanda.join(','))
          // Sin `lang`, esta lectura devuelve el rótulo del **sistema de
          // codificación**, que está en inglés a propósito: es el catálogo, no
          // la interfaz. Con él, devuelve la designación en castellano cuando el
          // concepto la tiene, y si no la tiene degrada al rótulo original en
          // vez de venir vacía.
          //
          // Faltaba, y es lo que la analista funcional vio en el perfil del
          // profesional: «Academic degree credential», «National jurisdiction»,
          // «Specialty verification pending». Las tres estaban traducidas en el
          // catálogo desde siempre —«Título académico», «Jurisdicción nacional»,
          // «Especialidad pendiente de verificación»— y nadie las pedía.
          .set('lang', IDIOMA_DEL_CATALOGO),
      }),
    );

    return forkJoin(tandas).pipe(
      map(
        (paginas) =>
          new Map(paginas.flatMap((pagina) => pagina.items.map((item) => [item.conceptId, item]))),
      ),
    );
  }

  /* -------------------------------------------------------------------------
     El glosario. Tres métodos nuevos, agregados **al final**: los cuatro de
     arriba no se tocan (`terminology.client.ts` es archivo compartido, ver el
     README de carriles).

     Son métodos aparte y no parámetros nuevos de `searchConcepts` a propósito.
     `searchConcepts` la usa el catálogo de administración, que quiere el
     catálogo crudo: identificadores, códigos y el rótulo del sistema de
     codificación. El glosario quiere lo contrario —castellano, etiquetas, sin
     un uuid a la vista— y son dos lecturas de la misma URL con dos contratos
     distintos. Mezclarlas obligaría a cada llamador a acordarse de pedir lo
     suyo, que es exactamente el tipo de olvido que deja una pantalla en inglés.
     ------------------------------------------------------------------------- */

  /**
   * `GET /terminology/value-sets` — las **etiquetas** del glosario.
   *
   * Un conjunto de valores es la categoría bajo la cual un término tiene
   * sentido: «Diagnóstico», «Severidad», «Vía de administración». Existían en el
   * modelo desde siempre; lo que faltaba era pedirlas desde acá.
   *
   * Cada una trae su conteo de términos, así que la pantalla puede ofrecerlas
   * sin expandir ninguna: sin el conteo, saber si una categoría tiene algo
   * dentro cuesta un clic y una espera.
   *
   * No exige rol de administración — misma razón que el resto de la lectura del
   * catálogo: es metadato compartido, sin datos de paciente.
   *
   * @param query - Código exacto, texto libre, cursor y tope, todos opcionales.
   * @returns La página de etiquetas con su cursor de continuación.
   */
  listValueSets(query: GlossaryTagQuery = {}): Observable<GlossaryTagPage> {
    // Parámetro a parámetro, igual que el resto del cliente: el backend valida
    // con `forbidNonWhitelisted` y un opcional presente en `undefined` viajaría
    // como clave declarada y volvería 400.
    let params = new HttpParams();
    if (query.code !== undefined) {
      params = params.set('code', query.code);
    }
    if (query.query !== undefined && query.query !== '') {
      params = params.set('q', query.query);
    }
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor);
    }
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }

    return this.http.get<GlossaryTagPage>(this.url('/terminology/value-sets'), {
      params,
    });
  }

  /**
   * `GET /terminology/concepts?lang=ES&includeValueSets=true` — los términos del
   * glosario, en castellano y con sus etiquetas.
   *
   * Es la **misma** lectura tanto si se llegó buscando texto como si se llegó
   * haciendo clic en una categoría: `valueSetId` acota, `query` acota, y las dos
   * cosas se combinan. Que sea una sola lectura no es una economía — es lo que
   * hace que las dos formas de llegar se vean igual.
   *
   * Deliberadamente **no** usa `readExpansion`: la expansión devuelve los
   * miembros crudos del conjunto, sin traducir y sin sus otras etiquetas.
   *
   * @param query - Texto, categoría y tope, todos opcionales.
   * @returns La página de términos, ya ordenada alfabéticamente por el backend.
   */
  searchGlossary(query: GlossaryQuery = {}): Observable<GlossaryTermPage> {
    let params = new HttpParams().set('lang', IDIOMA_DEL_CATALOGO).set('includeValueSets', 'true');
    if (query.query !== undefined && query.query !== '') {
      params = params.set('q', query.query);
    }
    if (query.valueSetId !== undefined) {
      params = params.set('valueSetId', query.valueSetId);
    }
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }

    return this.http.get<GlossaryTermPage>(this.url('/terminology/concepts'), {
      params,
    });
  }

  /**
   * `GET /terminology/concepts/:conceptId?lang=ES` — la ficha de un término.
   *
   * Trae lo que la entrada de la lista no puede mostrar sin volverse ilegible:
   * la definición completa, todas sus etiquetas y sus otras denominaciones.
   *
   * @param conceptId - Término a abrir.
   * @returns La ficha completa.
   */
  readGlossaryTerm(conceptId: string): Observable<GlossaryTermDetail> {
    return this.http.get<GlossaryTermDetail>(
      this.url(`/terminology/concepts/${encodeURIComponent(conceptId)}`),
      { params: new HttpParams().set('lang', IDIOMA_DEL_CATALOGO) },
    );
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/* La forma de la respuesta vivía acá como interfaz privada, porque el único
   consumidor era `readConceptLabels` y nadie más necesitaba nombrarla. Con la
   búsqueda por texto expuesta, la pantalla del catálogo sí la necesita: se
   mudó a `terminology.types.ts` como `ConceptSearchPage`, junto al resto de los
   tipos de la vista. */

/**
 * Ids por lectura en `readConceptLabels`.
 *
 * Lo fija el backend, que documenta «máx. 200» en el parámetro `ids`. Está acá
 * como constante y no como número suelto para que el día que el backend lo
 * mueva haya un solo lugar que corregir.
 */
const MAX_IDS_POR_LECTURA = 200;

/** Parte una lista en tandas del tamaño dado. La última puede venir corta. */
function trocear<T>(items: readonly T[], tamano: number): readonly (readonly T[])[] {
  const tandas: T[][] = [];
  for (let desde = 0; desde < items.length; desde += tamano) {
    tandas.push(items.slice(desde, desde + tamano));
  }
  return tandas;
}
