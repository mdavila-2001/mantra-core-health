import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { ConNulos, sinNulos } from '../wire';
import type {
  Comment,
  CommentPage,
  NewComment,
  NewPost,
  OwnPublicProfile,
  PostDetail,
  PostPage,
  PublicPost,
  PublicProfileDetail,
  ReactionSummary,
  UpsertOwnPublicProfile,
} from './community.types';

/** El hashtag que distingue un artículo médico del resto de las publicaciones. */
export const MEDICAL_ARTICLE_HASHTAG = 'articulo-medico';

/** Tope de página por defecto, igual que el resto del contrato. */
const DEFAULT_LIMIT = 50;

/* ---- lo que de verdad llega por el cable ---------------------------------- */

interface WireOwnProfile {
  readonly id: string;
  readonly tenantId: string;
  readonly targetId: string;
  readonly slug: string;
  readonly displayName: string;
  readonly headline: string | null;
  readonly biography: string | null;
  readonly acceptsReviews: boolean | null;
  readonly verificationStatusConceptId: string | null;
  readonly statusConceptId: string;
}

interface WirePublicProfileDetail {
  readonly id: string;
  readonly tenantId: string;
  readonly targetTypeConceptId: string;
  readonly slug: string;
  readonly displayName: string;
  readonly headline: string | null;
  readonly biography: string | null;
  readonly avatarFileId: string | null;
  readonly coverFileId: string | null;
  readonly verificationStatusConceptId: string | null;
  readonly acceptsReviews: boolean | null;
  readonly statusConceptId: string;
}

interface WirePostListItem {
  readonly id: string;
  readonly authorPublicProfileId: string;
  readonly postTypeConceptId: string;
  readonly bodyText: string;
  readonly visibilityConceptId: string | null;
  readonly commentsEnabled: boolean | null;
  readonly publishedAt: string | null;
  readonly editedAt: string | null;
}

interface WirePostPage {
  readonly items: readonly WirePostListItem[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

interface WirePostDetail extends WirePostListItem {
  readonly media: readonly {
    readonly id: string;
    readonly fileId: string;
    readonly mediaRoleConceptId: string;
    readonly altText: string | null;
    readonly ordinal: number | null;
  }[];
  readonly hashtags: readonly { readonly id: string; readonly tag: string }[];
}

interface WireComment {
  readonly id: string;
  readonly authorProfileId: string;
  readonly bodyText: string;
  readonly parentCommentId: string | null;
  readonly threadDepth: number | null;
  readonly replyCount: number | null;
  readonly createdAt: string;
  readonly replies: readonly WireComment[];
}

interface WireCommentPage {
  readonly items: readonly WireComment[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

/**
 * Cliente de `community`: la vitrina pública propia, sus publicaciones y los
 * comentarios de cada una.
 *
 * ## Los artículos médicos no tienen endpoint propio
 *
 * El backend no distingue un «artículo» de cualquier otra publicación: los dos
 * son un `post`. Lo que este cliente hace por lo que la pantalla llama
 * «artículo médico» es **etiquetarlo siempre** con `articulo-medico` al
 * publicar, y filtrar por esa etiqueta al listar «Mis artículos». No hay
 * concepto nuevo que sembrar ni ruta nueva que exponer: el contrato ya alcanza.
 */
@Injectable({ providedIn: 'root' })
export class CommunityClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /**
   * La vitrina pública propia, o `null` si todavía no se creó ninguna.
   *
   * `null` es un estado normal —el de cualquiera que no publicó nada todavía—,
   * no un error: la pantalla que llama esto no debe tratarlo como un fallo de
   * lectura.
   */
  getOwnProfile(): Observable<OwnPublicProfile | null> {
    return this.http
      .get<ConNulos<WireOwnProfile> | null>(this.url('/community/profiles/me'))
      .pipe(map((body) => (body === null ? null : sinNulos<WireOwnProfile>(body))));
  }

  /**
   * Crea o actualiza la vitrina propia. Idempotente: no hace falta saber si ya
   * existía una.
   */
  upsertOwnProfile(datos: UpsertOwnPublicProfile): Observable<OwnPublicProfile> {
    return this.http
      .put<ConNulos<WireOwnProfile>>(this.url('/community/profiles/me'), datos)
      .pipe(map((body) => sinNulos<WireOwnProfile>(body)));
  }

  /** La ficha pública de un perfil, para la vista previa de «así te ven». */
  getProfile(profileId: string): Observable<PublicProfileDetail> {
    return this.http
      .get<ConNulos<WirePublicProfileDetail>>(this.url(`/community/profiles/${profileId}`))
      .pipe(map((body) => sinNulos<WirePublicProfileDetail>(body)));
  }

  /**
   * Las publicaciones de un perfil, más recientes primero.
   *
   * **No trae hashtags** — es una limitación real del listado, no una omisión
   * de este cliente: `PostListItemDto` no los incluye, sólo `getPost` (el
   * detalle) los trae. Distinguir «esto es un artículo médico» a partir de esta
   * página no es posible sin pedir el detalle de cada fila; la pantalla que
   * necesita esa distinción lo hace explícitamente con `getPost`.
   *
   * @param profileId - El perfil dueño del muro.
   * @param opciones - `cursor` continúa una página anterior.
   */
  listProfilePosts(
    profileId: string,
    opciones: { cursor?: string; limit?: number } = {},
  ): Observable<PostPage> {
    let params = new HttpParams().set('limit', String(opciones.limit ?? DEFAULT_LIMIT));
    if (opciones.cursor !== undefined) {
      params = params.set('cursor', opciones.cursor);
    }
    return this.http
      .get<WirePostPage>(this.url(`/community/profiles/${profileId}/posts`), { params })
      .pipe(map((pagina) => ({ ...pagina, items: pagina.items.map(desdeItem) })));
  }

  /**
   * Publica. Si `esArticulo` es verdadero, agrega el hashtag que distingue un
   * artículo médico del resto — es la única diferencia entre publicar una cosa
   * u otra.
   */
  publishPost(
    profileId: string,
    datos: NewPost,
    esArticulo = false,
  ): Observable<{ readonly id: string }> {
    const hashtags = esArticulo
      ? [...new Set([...(datos.hashtags ?? []), MEDICAL_ARTICLE_HASHTAG])]
      : datos.hashtags;
    return this.http.post<{ readonly id: string }>(
      this.url(`/community/profiles/${profileId}/posts`),
      { ...datos, hashtags },
    );
  }

  /** Una publicación con sus adjuntos y etiquetas — la vista de detalle de un artículo. */
  getPost(postId: string): Observable<PostDetail> {
    return this.http.get<WirePostDetail>(this.url(`/community/posts/${postId}`)).pipe(
      map((body) => ({
        ...desdeItem(body),
        media: body.media,
        hashtags: body.hashtags.map((h) => h.tag),
      })),
    );
  }

  /** El hilo de comentarios de una publicación. */
  listPostComments(
    postId: string,
    opciones: { cursor?: string; limit?: number } = {},
  ): Observable<CommentPage> {
    let params = new HttpParams().set('limit', String(opciones.limit ?? DEFAULT_LIMIT));
    if (opciones.cursor !== undefined) {
      params = params.set('cursor', opciones.cursor);
    }
    return this.http
      .get<WireCommentPage>(this.url(`/community/posts/${postId}/comments`), { params })
      .pipe(map((pagina) => ({ ...pagina, items: pagina.items.map(desdeComentario) })));
  }

  /** Comenta sobre un post, o responde a un comentario si se pasa `parentCommentId`. */
  createComment(datos: NewComment): Observable<{ readonly id: string }> {
    return this.http.post<{ readonly id: string }>(this.url('/community/comments'), {
      ...datos,
      commentableType: 'POST',
    });
  }

  /** Resumen de reacciones de una publicación. */
  getPostReactions(postId: string): Observable<ReactionSummary> {
    return this.http
      .get<ConNulos<ReactionSummary>>(this.url(`/community/posts/${postId}/reactions`))
      .pipe(map((body) => sinNulos<ReactionSummary>(body)));
  }

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }
}

function desdeItem(item: WirePostListItem): PublicPost {
  return {
    id: item.id,
    authorPublicProfileId: item.authorPublicProfileId,
    postTypeConceptId: item.postTypeConceptId,
    bodyText: item.bodyText,
    visibilityConceptId: item.visibilityConceptId,
    commentsEnabled: item.commentsEnabled,
    publishedAt: item.publishedAt === null ? null : new Date(item.publishedAt),
    editedAt: item.editedAt === null ? null : new Date(item.editedAt),
  };
}

function desdeComentario(comentario: WireComment): Comment {
  return {
    id: comentario.id,
    authorProfileId: comentario.authorProfileId,
    bodyText: comentario.bodyText,
    parentCommentId: comentario.parentCommentId,
    threadDepth: comentario.threadDepth,
    replyCount: comentario.replyCount,
    createdAt: new Date(comentario.createdAt),
    replies: comentario.replies.map(desdeComentario),
  };
}
