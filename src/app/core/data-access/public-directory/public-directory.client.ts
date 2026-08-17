import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { PUBLIC_PROFILE_PREFIX } from './public-directory.types';
import type {
  PublicNearbyQuery,
  PublicNearbyResult,
  PublicPage,
  PublicPostSummary,
  PublicPractitionerQuery,
  PublicProfileDetail,
  PublicSearchQuery,
  PublicSearchResult,
} from './public-directory.types';

/* ============================================================================
    Cómo viaja cada cosa: fechas de texto y opcionales en `null`.
    ========================================================================== */

interface WirePage<T> {
  readonly items: readonly T[];
  readonly nextCursor: string | null;
  readonly totalHint: number | null;
  readonly generatedAt: string;
}

type WireSearchResult = PublicSearchResult;

type WireNearbyResult = PublicNearbyResult;

type WirePost = Omit<PublicPostSummary, 'publishedAt'> & {
  readonly publishedAt: string;
};

type WireProfile = Omit<PublicProfileDetail, 'posts' | 'updatedAt'> & {
  readonly posts: readonly WirePost[];
  readonly updatedAt: string;
};

/**
 * Cliente del directorio público — las nueve lecturas **sin sesión**.
 *
 * Contrato: `openapi/CONTRATO-PUBLICO.md` en el repositorio de la API,
 * verificado contra la API viva el 2026-08-17.
 *
 * ## Por qué es un cliente aparte de `CommunityClient`
 *
 * Porque es otra superficie, no otra ruta de la misma. `CommunityClient` habla
 * con la red social **con sesión**: sus respuestas traen `tenantId`, ids de
 * concepto y de archivo, y sus llamadas pasan por el interceptor de auth con
 * su refresco de token. Ésta es anónima: el servidor arma cada respuesta con
 * una lista blanca de campos, y una petición de acá **no debe llevar
 * `Authorization` ni disparar un refresco**.
 *
 * Mezclarlas en un cliente daría un objeto que a veces devuelve campos internos
 * y a veces no, según con qué sesión se lo llame. Separadas, cada tipo dice
 * exactamente qué llega.
 *
 * ## Nada de acá exige sesión, y por eso nada de acá la pide
 *
 * `authInterceptor` ya trata `/public/` como público, así que un 401 no
 * dispararía un refresco. Las cinco rutas de ficha (`/p/`, `/o/`, `/f/`, `/l/`,
 * `/s/`) **no** llevan ese prefijo: son rutas cortas por diseño, porque son las
 * que se copian y se pegan en un mensaje. En esta superficie no hay 401 ni 403
 * —un 403 confirmaría que el recurso existe—, así que no hay nada que refrescar
 * de todos modos.
 *
 * ## Un 404 no distingue «no existe» de «no está publicado»
 *
 * Es deliberado y quien llama no debe intentar deshacerlo: mostrar «este perfil
 * existe pero es privado» reintroduciría por la pantalla la filtración que el
 * servidor evita devolviendo siempre el mismo cuerpo.
 */
@Injectable({
  providedIn: 'root',
})
export class PublicDirectoryClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** `GET /public/search` — la búsqueda unificada sobre los seis verticales. */
  search(filtros: PublicSearchQuery = {}): Observable<PublicPage<PublicSearchResult>> {
    return this.getPage<WireSearchResult>('/public/search', this.searchParams(filtros));
  }

  /**
   * `GET /public/search/practitioners`.
   *
   * `verified` omitido trae **todos**, con los verificados primero; sólo
   * `true` acota. Es la mitad de la decisión de producto: excluir a los no
   * verificados dejaría el directorio vacío, pero ninguno se muestra como
   * verificado sin serlo.
   */
  searchPractitioners(
    filtros: PublicPractitionerQuery = {},
  ): Observable<PublicPage<PublicSearchResult>> {
    let params = this.searchParams(filtros);
    if (filtros.specialty !== undefined && filtros.specialty !== '') {
      params = params.set('specialty', filtros.specialty);
    }
    if (filtros.verified !== undefined) {
      params = params.set('verified', String(filtros.verified));
    }
    return this.getPage<WireSearchResult>('/public/search/practitioners', params);
  }

  /** `GET /public/search/organizations` — hospitales, clínicas y centros. */
  searchOrganizations(
    filtros: PublicSearchQuery = {},
  ): Observable<PublicPage<PublicSearchResult>> {
    return this.getPage<WireSearchResult>(
      '/public/search/organizations',
      this.searchParams(filtros),
    );
  }

  /** `GET /public/search/diagnostic-units` — laboratorios e imagenología. */
  searchDiagnosticUnits(
    filtros: PublicSearchQuery = {},
  ): Observable<PublicPage<PublicSearchResult>> {
    return this.getPage<WireSearchResult>(
      '/public/search/diagnostic-units',
      this.searchParams(filtros),
    );
  }

  /** `GET /public/search/insurers`. */
  searchInsurers(filtros: PublicSearchQuery = {}): Observable<PublicPage<PublicSearchResult>> {
    return this.getPage<WireSearchResult>('/public/search/insurers', this.searchParams(filtros));
  }

  /** `GET /public/search/pharmacies`. */
  searchPharmacies(filtros: PublicSearchQuery = {}): Observable<PublicPage<PublicSearchResult>> {
    return this.getPage<WireSearchResult>('/public/search/pharmacies', this.searchParams(filtros));
  }

  /** `GET /public/search/medications` — medicamentos ofertados. */
  searchMedications(filtros: PublicSearchQuery = {}): Observable<PublicPage<PublicSearchResult>> {
    return this.getPage<WireSearchResult>(
      '/public/search/medications',
      this.searchParams(filtros),
    );
  }

  /**
   * `GET /public/nearby` — lo más cercano a un punto, en línea recta.
   *
   * `lat`/`lng` son obligatorias en la firma y no opcionales con un valor por
   * omisión: la API devuelve **400** sin ellas, y un centro inventado del lado
   * del cliente daría una lista de resultados que parecen cercanos a algo que
   * la persona nunca eligió.
   */
  nearby(consulta: PublicNearbyQuery): Observable<PublicPage<PublicNearbyResult>> {
    let params = new HttpParams()
      .set('lat', String(consulta.lat))
      .set('lng', String(consulta.lng));
    if (consulta.radiusKm !== undefined) {
      params = params.set('radiusKm', String(consulta.radiusKm));
    }
    if (consulta.kind !== undefined) {
      params = params.set('kind', consulta.kind);
    }
    if (consulta.limit !== undefined) {
      params = params.set('limit', String(consulta.limit));
    }
    return this.getPage<WireNearbyResult>('/public/nearby', params);
  }

  /**
   * La ficha pública por slug: `GET /p/:slug` y sus cuatro hermanas.
   *
   * @param kind - Qué clase de sujeto se espera. Fija el prefijo de la ruta, y
   *   un slug de otra clase da 404 en vez de redirigir.
   * @param slug - El slug tal como aparece en la URL.
   */
  getProfile(
    kind: PublicProfileDetail['kind'],
    slug: string,
  ): Observable<PublicProfileDetail> {
    const prefijo = PUBLIC_PROFILE_PREFIX[kind];
    return this.http
      .get<WireProfile>(this.url(`/${prefijo}/${encodeURIComponent(slug)}`))
      .pipe(map(toProfile));
  }

  /** Los filtros que comparten las siete búsquedas. */
  private searchParams(filtros: PublicSearchQuery): HttpParams {
    let params = new HttpParams();
    // Vacío se omite en vez de mandarse: `?q=` filtraría por la cadena vacía en
    // vez de no filtrar, y en un buscador esa diferencia es toda la pantalla.
    if (filtros.q !== undefined && filtros.q !== '') {
      params = params.set('q', filtros.q);
    }
    if (filtros.city !== undefined && filtros.city !== '') {
      params = params.set('city', filtros.city);
    }
    if (filtros.cursor !== undefined && filtros.cursor !== '') {
      params = params.set('cursor', filtros.cursor);
    }
    if (filtros.limit !== undefined) {
      params = params.set('limit', String(filtros.limit));
    }
    return params;
  }

  private getPage<T>(path: string, params: HttpParams): Observable<PublicPage<T>> {
    return this.http
      .get<WirePage<T>>(this.url(path), { params })
      .pipe(map((body) => toPage(body)));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

/** La envoltura de página, con su instante convertido. */
function toPage<T>(body: WirePage<T>): PublicPage<T> {
  return {
    items: body.items,
    nextCursor: body.nextCursor,
    totalHint: body.totalHint,
    generatedAt: new Date(body.generatedAt),
  };
}

/** La ficha, con las fechas convertidas y nada más tocado. */
function toProfile(body: WireProfile): PublicProfileDetail {
  return {
    ...body,
    posts: body.posts.map((post) => ({
      ...post,
      publishedAt: new Date(post.publishedAt),
    })),
    updatedAt: new Date(body.updatedAt),
  };
}
