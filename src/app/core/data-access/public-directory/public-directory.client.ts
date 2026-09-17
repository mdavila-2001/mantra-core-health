import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { PUBLIC_PROFILE_PREFIX } from './public-directory.types';
import type {
  PublicComment,
  PublicFeedPost,
  PublicNearbyQuery,
  PublicNearbyResult,
  PublicPage,
  PublicPostReaction,
  PublicPostSummary,
  PublicPractitionerQuery,
  PublicPracticeSite,
  PublicProfileDetail,
  PublicProfileReviewsPage,
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

type WireComment = Omit<PublicComment, 'createdAt'> & {
  readonly createdAt: string;
};

type WireFeedPost = Omit<PublicFeedPost, 'publishedAt'> & {
  readonly publishedAt: string;
};

type WireProfile = Omit<PublicProfileDetail, 'posts' | 'updatedAt' | 'practiceSites'> & {
  readonly posts: readonly WirePost[];
  readonly updatedAt: string;
  /**
   * **Opcional en el cable y obligatorio en la vista.** La API todavía no lo
   * manda (P16 de `PENDIENTES-BACKEND.md`); el simulador sí. Que el contrato de
   * la pantalla prometa siempre un arreglo es lo que evita que cada consumidor
   * tenga que acordarse de que puede faltar — {@link toProfile} lo garantiza.
   */
  readonly practiceSites?: readonly PublicPracticeSite[];
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

  /**
   * `GET /public/posts` — lo último de **todas** las vitrinas, mezclado.
   *
   * Es el feed de la portada. A diferencia de las publicaciones de una ficha,
   * cada una trae a su autor: en un feed mezclado es lo único que distingue
   * una tarjeta de la siguiente.
   */
  feedPublico(opciones: { cursor?: string; limit?: number } = {}): Observable<
    PublicPage<PublicFeedPost>
  > {
    let params = new HttpParams();
    if (opciones.cursor) params = params.set('cursor', opciones.cursor);
    if (opciones.limit !== undefined) params = params.set('limit', String(opciones.limit));
    return this.http
      .get<WirePage<WireFeedPost>>(this.url('/public/posts'), { params })
      .pipe(
        map((body) => ({
          ...toPage(body),
          items: body.items.map((post) => ({
            ...post,
            publishedAt: new Date(post.publishedAt),
          })),
        })),
      );
  }

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
   * La ficha pública por slug.
   *
   * ## Por qué pide `/public/profiles/:prefijo/:slug` y no `/p/:slug`
   *
   * Porque `/p/:slug` es **también la URL de esta pantalla**, y las dos no
   * pueden convivir del lado del navegador. El proxy del servidor de
   * desarrollo enruta comparando el comienzo de la ruta: mandar `/p` a la API
   * se come la ruta del router —abrir la ficha devolvería JSON en vez de la
   * pantalla— y no mandarla deja esta llamada pidiéndole `/p/:slug` al
   * servidor de Angular, que responde el `index.html` con **200**; el cliente
   * recibe HTML donde espera JSON y el fallo sale como «error inesperado».
   * `check-client-prefixes.mjs` denuncia exactamente ese caso.
   *
   * Las cinco rutas cortas de la API siguen existiendo y sirviendo lo mismo:
   * son el contrato público que alguien puede llamar directo. Esta cuelga de
   * `/public`, que ya está enrutado, y no es ambigua.
   *
   * @param kind - Qué clase de sujeto se espera. Fija el prefijo, y un slug de
   *   otra clase da 404 en vez de redirigir.
   * @param slug - El slug tal como aparece en la URL.
   */
  getProfile(
    kind: PublicProfileDetail['kind'],
    slug: string,
  ): Observable<PublicProfileDetail> {
    const prefijo = PUBLIC_PROFILE_PREFIX[kind];
    return this.http
      .get<WireProfile>(
        this.url(`/public/profiles/${prefijo}/${encodeURIComponent(slug)}`),
      )
      .pipe(map(toProfile));
  }

  /**
   * `GET /public/profiles/:prefijo/:slug/reviews` — las opiniones de la ficha
   * y el promedio del perfil (P31).
   *
   * Cuelga del mismo `/public/profiles/...` que {@link getProfile} y por el
   * mismo motivo: `/p/:slug` es también la URL de esta pantalla, y mandarla a
   * la API se comería la ruta del router.
   *
   * El promedio viaja con la lista y no se pide aparte porque la cabecera de
   * opiniones y la lista se dibujan juntas: en dos peticiones, la pantalla
   * queda con «4,6 de 5» arriba y un hueco abajo.
   *
   * @param kind - Qué clase de sujeto se espera. Fija el prefijo; un slug de
   *   otra clase da 404 en vez de redirigir.
   * @param slug - El slug tal como aparece en la URL.
   * @param opciones - Cursor de continuación y tope de filas.
   * @returns La página de opiniones y las dos cifras de la cabecera.
   */
  profileReviews(
    kind: PublicProfileDetail['kind'],
    slug: string,
    opciones: { cursor?: string; limit?: number } = {},
  ): Observable<PublicProfileReviewsPage> {
    const prefijo = PUBLIC_PROFILE_PREFIX[kind];
    return this.http
      .get<WireReviewsPage>(
        this.url(
          `/public/profiles/${prefijo}/${encodeURIComponent(slug)}/reviews`,
        ),
        { params: this.paginaParams(opciones) },
      )
      .pipe(map(toReviewsPage));
  }

  /* ---- las tres lecturas sociales públicas (TAREA 01 §5.1) --------------- */

  /**
   * `GET /public/posts/:postId/reactions` — **quiénes** reaccionaron (AC-01-9).
   *
   * No lo confundas con `CommunityClient.readReactions`, que devuelve recuentos
   * por tipo y exige sesión. Ésta lista personas, sin sesión, y por eso su
   * respuesta trae sólo el perfil público de cada una: nunca `profileId`,
   * `userId` ni el uuid del concepto de reacción.
   */
  postReactions(
    postId: string,
    opciones: { cursor?: string; limit?: number } = {},
  ): Observable<PublicPage<PublicPostReaction>> {
    return this.getPage<PublicPostReaction>(
      `/public/posts/${encodeURIComponent(postId)}/reactions`,
      this.paginaParams(opciones),
    );
  }

  /** `GET /public/posts/:postId/comments` — el hilo raíz, sin sesión (AC-01-11). */
  postComments(
    postId: string,
    opciones: { cursor?: string; limit?: number } = {},
  ): Observable<PublicPage<PublicComment>> {
    return this.getComments(
      `/public/posts/${encodeURIComponent(postId)}/comments`,
      opciones,
    );
  }

  /**
   * `GET /public/comments/:commentId/replies` — las respuestas de UN comentario
   * (AC-01-12, «Ver N respuestas»).
   *
   * Ruta propia y no un parámetro de la anterior: así cada hilo abierto tiene su
   * propio cursor y abrir dos no hace que sus páginas se pisen.
   */
  commentReplies(
    commentId: string,
    opciones: { cursor?: string; limit?: number } = {},
  ): Observable<PublicPage<PublicComment>> {
    return this.getComments(
      `/public/comments/${encodeURIComponent(commentId)}/replies`,
      opciones,
    );
  }

  private getComments(
    path: string,
    opciones: { cursor?: string; limit?: number },
  ): Observable<PublicPage<PublicComment>> {
    return this.http
      .get<WirePage<WireComment>>(this.url(path), { params: this.paginaParams(opciones) })
      .pipe(
        map((body) => ({
          ...toPage(body),
          items: body.items.map((comentario) => ({
            ...comentario,
            createdAt: new Date(comentario.createdAt),
            // REQ-01-011: mismo motivo que `community.client.ts#toComment` —
            // un servidor todavía sin desplegar el campo no lo manda.
            media: comentario.media ?? [],
          })),
        })),
      );
  }

  /** Cursor y tamaño, que es todo lo que aceptan las lecturas paginadas. */
  private paginaParams(opciones: { cursor?: string; limit?: number }): HttpParams {
    let params = new HttpParams();
    if (opciones.cursor !== undefined && opciones.cursor !== '') {
      params = params.set('cursor', opciones.cursor);
    }
    if (opciones.limit !== undefined) {
      params = params.set('limit', String(opciones.limit));
    }
    return params;
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
    // Sin sedes en la respuesta, la ficha cae a `city`/`address`, que es el
    // comportamiento que ya tenía. Ver la nota de `WireProfile`.
    practiceSites: body.practiceSites ?? [],
    posts: body.posts.map((post) => ({
      ...post,
      publishedAt: new Date(post.publishedAt),
    })),
    updatedAt: new Date(body.updatedAt),
  };
}

/** La página de opiniones tal como llega por el cable. */
interface WireReviewsPage {
  readonly items: readonly WireReview[];
  readonly nextCursor: string | null;
  readonly ratingAverage: number | null;
  readonly ratingCount: number;
}

/** Una opinión tal como llega por el cable, con las fechas en texto. */
interface WireReview {
  readonly id: string;
  readonly overallRating: number;
  readonly reviewText: string | null;
  readonly reviewerDisplayName?: string | null;
  readonly publishedAt: string | null;
  readonly editedAt: string | null;
  readonly responses: readonly {
    readonly id: string;
    readonly responseText: string;
    readonly publishedAt: string | null;
  }[];
}

/**
 * Las opiniones, con las fechas convertidas.
 *
 * `reviewerDisplayName` se normaliza a `null` cuando no viene: el campo es
 * opcional en el contrato, y `undefined` en la vista obligaría a cada plantilla
 * a distinguir dos ausencias que significan lo mismo — «esta opinión no lleva
 * nombre» —.
 */
function toReviewsPage(body: WireReviewsPage): PublicProfileReviewsPage {
  return {
    items: body.items.map((review) => ({
      id: review.id,
      overallRating: review.overallRating,
      reviewText: review.reviewText,
      reviewerDisplayName: review.reviewerDisplayName ?? null,
      publishedAt: review.publishedAt === null ? null : new Date(review.publishedAt),
      editedAt: review.editedAt === null ? null : new Date(review.editedAt),
      responses: review.responses.map((response) => ({
        id: response.id,
        responseText: response.responseText,
        publishedAt:
          response.publishedAt === null ? null : new Date(response.publishedAt),
      })),
    })),
    nextCursor: body.nextCursor,
    ratingAverage: body.ratingAverage,
    ratingCount: body.ratingCount,
  };
}
