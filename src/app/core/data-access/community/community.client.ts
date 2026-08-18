import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';

import { API_BASE_URL, apiUrl } from '../api';
import { maybeDate, sinNulos } from '../wire';
import type {
  BlockListItem,
  BlockPage,
  BlocksQuery,
  BookmarkListItem,
  BookmarkPage,
  BookmarksQuery,
  CommentThreadItem,
  CommentThreadPage,
  ConversationListItem,
  ConversationMessagesQuery,
  ConversationPage,
  ConversationPeer,
  ConversationRead,
  ConversationsQuery,
  DirectMessage,
  DirectMessagePage,
  FeedListItem,
  FeedPage,
  FeedQuery,
  FollowListItem,
  FollowPage,
  FollowsQuery,
  GroupDetail,
  GroupMember,
  GroupMemberChange,
  GroupMemberPage,
  GroupMembersQuery,
  GroupMemberUpdated,
  GroupPage,
  GroupsQuery,
  GroupWallItem,
  GroupWallPage,
  GroupWallQuery,
  ModerationAppealItem,
  ModerationAppealPage,
  ModerationAppealsQuery,
  ModerationDecisionItem,
  ModerationDecisionPage,
  ModerationDecisionsQuery,
  ModerationQueueItem,
  ModerationQueuePage,
  ModerationQueueQuery,
  NewAppeal,
  NewBlock,
  NewBookmark,
  NewGroup,
  NewGroupPost,
  NewComment,
  NewConversation,
  NewDirectMessage,
  NewFollow,
  NewModerationDecision,
  NewReport,
  NewReview,
  NewReviewResponse,
  ResolveAppeal,
  NewReaction,
  NewPost,
  SocialRemoval,
  TopicPage,
  NotificationPage,
  NotificationsQuery,
  OwnPublicProfile,
  PollDetail,
  PostCommentsQuery,
  PostDetail,
  PostListItem,
  PostPage,
  ProfilePostsQuery,
  PublicDirectoryResult,
  PublicProfileDetail,
  ReactionSummary,
  ReviewsQuery,
  ServiceReview,
  ServiceReviewPage,
  SentMessage,
  SocialNotification,
  UpsertOwnPublicProfile,
} from './community.types';

/** El hashtag que distingue un artículo médico del resto de las publicaciones. */
export const MEDICAL_ARTICLE_HASHTAG = 'articulo-medico';

/**
 * Cliente de `community` (M19): la red social médica.
 *
 * ## Lecturas primero, y las escrituras llegan con su pantalla
 *
 * El módulo tiene 17 escrituras en el backend —publicar, comentar, reaccionar,
 * seguir, bloquear, reportar, moderar—; la regla sigue siendo agregar cada una
 * recién cuando existe la pantalla que la dispara, para no adivinar la forma
 * del formulario. La vitrina propia (`getOwnProfile`/`upsertOwnProfile`) y
 * publicar/comentar (`publishPost`/`createComment`) ya tienen pantalla —«Mi
 * perfil» y «Mis artículos médicos»— y por eso están.
 *
 * ## Por qué existe antes que las pantallas
 *
 * Las 16 lecturas ya están en `dev` (PR #62 y #63). Lo que falta para que la
 * red social se vea es que sus endpoints sean públicos (`@Public()` + rate
 * limit por IP) y que haya pantallas. **Ninguna de esas dos cosas cambia la
 * forma de la llamada**: el decorador cambia el guard del servidor, no el
 * cuerpo ni la URL.
 *
 * Así que este cliente se puede escribir y probar hoy, y el día que la
 * superficie pública entre no hay que tocarlo. Es lo mismo que se hace al
 * repartir trabajo entre personas: el contrato va primero para que nadie
 * espere a nadie.
 *
 * ## `actorProfileId` es opcional, y ahí está la superficie pública
 *
 * Seis lecturas aceptan «quién mira». Con actor, la respuesta agrega lo que
 * sólo tiene sentido para esa persona: con qué reaccionaste, qué votaste. Sin
 * actor, la misma lectura devuelve la vista anónima — que es exactamente la que
 * necesita un visitante sin sesión.
 *
 * **No se manda el propio id de sesión por defecto.** Quien llama decide si la
 * lectura es personal o pública; hacerlo automático convertiría toda pantalla
 * pública en una consulta identificada sin que nadie lo pidiera.
 *
 * ## Lo que este cliente no hace
 *
 * `GET /internal/community/feed/pending` no está: es del worker de fan-out, no
 * de una pantalla, y exponerlo desde el navegador no tiene sentido.
 */
@Injectable({
  providedIn: 'root',
})
export class CommunityClient {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  // ─── Vitrina propia ────────────────────────────────────────────────────────

  /**
   * `GET /community/profiles/me` — la vitrina pública propia, o `null` si
   * todavía no se creó ninguna.
   *
   * `null` es un estado normal —el de cualquiera que no publicó nada
   * todavía—, no un error: quien llama no debe tratarlo como un fallo de
   * lectura.
   */
  getOwnProfile(): Observable<OwnPublicProfile | null> {
    return this.http
      .get<WireOwnProfile | null>(this.url('/community/profiles/me'))
      .pipe(map((body) => (body === null ? null : sinNulos(body))));
  }

  /**
   * `PUT /community/profiles/me` — crea o actualiza la vitrina propia.
   * Idempotente: no hace falta saber si ya existía una.
   */
  upsertOwnProfile(datos: UpsertOwnPublicProfile): Observable<OwnPublicProfile> {
    return this.http
      .put<WireOwnProfile>(this.url('/community/profiles/me'), datos)
      .pipe(map((body) => sinNulos(body)));
  }

  // ─── Perfil público ────────────────────────────────────────────────────────

  /**
   * `GET /community/profiles/:profileId` — la ficha pública.
   *
   * @param profileId - El perfil público, no el perfil de paciente ni el de
   *   profesional: son entidades distintas y sólo esta tiene `slug`.
   * @returns La ficha con sus sellos y su prestigio.
   */
  readProfile(profileId: string): Observable<PublicProfileDetail> {
    return this.http
      .get<WireProfile>(
        this.url(`/community/profiles/${encodeURIComponent(profileId)}`),
      )
      .pipe(map(toProfile));
  }

  /**
   * `GET /community/profiles/:profileId/posts` — lo que publicó un perfil.
   *
   * @param profileId - De quién son las publicaciones.
   * @param query - Quién mira, y la paginación.
   * @returns Una página de publicaciones, de la más reciente hacia atrás.
   */
  listProfilePosts(
    profileId: string,
    query: ProfilePostsQuery = {},
  ): Observable<PostPage> {
    return this.http
      .get<WirePostPage>(
        this.url(`/community/profiles/${encodeURIComponent(profileId)}/posts`),
        { params: this.cursorParams(query, this.actorParams(query)) },
      )
      .pipe(map(toPostPage));
  }

  // ─── Publicaciones ─────────────────────────────────────────────────────────

  /**
   * `POST /community/profiles/:profileId/posts` — publica.
   *
   * Si `esArticulo` es verdadero, agrega el hashtag {@link MEDICAL_ARTICLE_HASHTAG}
   * — es la única diferencia entre publicar un artículo médico y cualquier otra
   * publicación: el backend no distingue un tipo de contenido nuevo, sólo un
   * `post` con esa etiqueta.
   *
   * @param profileId - La vitrina que publica.
   * @param datos - El cuerpo y sus opciones.
   * @param esArticulo - Si se etiqueta como artículo médico.
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
      this.url(`/community/profiles/${encodeURIComponent(profileId)}/posts`),
      { ...datos, hashtags },
    );
  }

  /**
   * `GET /community/posts/:postId` — una publicación abierta.
   *
   * @param postId - La publicación.
   * @param query - Quién mira.
   * @returns La publicación con sus medios, etiquetas y menciones.
   */
  readPost(postId: string, query: ProfilePostsQuery = {}): Observable<PostDetail> {
    return this.http
      .get<WirePostDetail>(
        this.url(`/community/posts/${encodeURIComponent(postId)}`),
        { params: this.actorParams(query) },
      )
      .pipe(map(toPostDetail));
  }

  /**
   * `GET /community/posts/:postId/comments` — el hilo de comentarios.
   *
   * Las respuestas vienen anidadas dentro de cada comentario; la paginación es
   * de comentarios **de primer nivel**.
   *
   * @param postId - La publicación.
   * @param query - Quién mira, y la paginación.
   * @returns Una página de hilos.
   */
  listComments(
    postId: string,
    query: PostCommentsQuery = {},
  ): Observable<CommentThreadPage> {
    return this.http
      .get<WireCommentPage>(
        this.url(`/community/posts/${encodeURIComponent(postId)}/comments`),
        { params: this.cursorParams(query, this.actorParams(query)) },
      )
      .pipe(map(toCommentPage));
  }

  /**
   * `POST /community/comments` — comenta, o responde a un comentario si se
   * pasa `parentCommentId`.
   */
  /**
   * `PUT /community/reactions` — reacciona a una publicación o comentario.
   *
   * Es **upsert**, no alta: reaccionar de nuevo con otro tipo cambia la
   * reacción en vez de agregar una segunda. Por eso es `PUT` y por eso el
   * contrato exige `actorProfileId` — es la mitad de la clave, no un dato que
   * el servidor pueda deducir de la sesión.
   *
   * @param reaccion - Quién, a qué y con qué.
   */
  react(reaccion: NewReaction): Observable<{ readonly id: string }> {
    return this.http.put<{ readonly id: string }>(
      this.url('/community/reactions'),
      reaccion,
    );
  }

  createComment(datos: NewComment): Observable<{ readonly id: string }> {
    return this.http.post<{ readonly id: string }>(this.url('/community/comments'), {
      ...datos,
      commentableType: 'POST',
    });
  }

  /**
   * `GET /community/posts/:postId/reactions` — el resumen de reacciones.
   *
   * @param postId - La publicación.
   * @param query - Quién mira. Con actor viene además cuál puso.
   * @returns Los conteos por tipo y el total.
   */
  readReactions(
    postId: string,
    query: ProfilePostsQuery = {},
  ): Observable<ReactionSummary> {
    return this.http
      .get<WireReactionSummary>(
        this.url(`/community/posts/${encodeURIComponent(postId)}/reactions`),
        { params: this.actorParams(query) },
      )
      .pipe(map((body) => sinNulos(body)));
  }

  // ─── Seguimientos, marcadores y bloqueos ───────────────────────────────────

  /**
   * `POST /community/follows` — seguir un perfil, tema, etiqueta o grupo.
   *
   * @param seguimiento - Quién sigue y qué.
   * @returns El identificador del seguimiento.
   */
  follow(seguimiento: NewFollow): Observable<{ readonly id: string }> {
    return this.http.post<{ readonly id: string }>(
      this.url('/community/follows'),
      seguimiento,
    );
  }

  /**
   * `DELETE /community/follows` — dejar de seguir.
   *
   * Va por query y no por el id del vínculo porque la pantalla sabe **a quién**
   * dejó de seguir, no el uuid de la fila; pedirle ese uuid la obligaría a una
   * lectura extra sólo para deshacer lo que acaba de hacer.
   *
   * @param seguimiento - Quién dejaba de seguir y qué.
   * @returns Si esta llamada deshizo el seguimiento. `false` no es un error: el
   *   estado final es el que se pedía.
   */
  unfollow(seguimiento: NewFollow): Observable<SocialRemoval> {
    return this.http.delete<SocialRemoval>(this.url('/community/follows'), {
      params: new HttpParams()
        .set('followerProfileId', seguimiento.followerProfileId)
        .set('followableType', seguimiento.followableType)
        .set('followableRefId', seguimiento.followableRefId),
    });
  }

  /**
   * `POST /community/bookmarks` — guardar contenido en una colección.
   *
   * @param marcador - Quién guarda y qué.
   * @returns El identificador del marcador.
   */
  bookmark(marcador: NewBookmark): Observable<{ readonly id: string }> {
    return this.http.post<{ readonly id: string }>(
      this.url('/community/bookmarks'),
      marcador,
    );
  }

  /**
   * `DELETE /community/bookmarks` — quitar un marcador.
   *
   * @param marcador - Quién guardaba y qué.
   * @returns Si esta llamada quitó el marcador.
   */
  unbookmark(marcador: NewBookmark): Observable<SocialRemoval> {
    let params = new HttpParams()
      .set('profileId', marcador.profileId)
      .set('bookmarkableType', marcador.bookmarkableType)
      .set('bookmarkableRefId', marcador.bookmarkableRefId);
    if (marcador.collectionName !== undefined) {
      params = params.set('collectionName', marcador.collectionName);
    }

    return this.http.delete<SocialRemoval>(this.url('/community/bookmarks'), {
      params,
    });
  }

  /**
   * `POST /community/blocks` — bloquear a alguien.
   *
   * @param bloqueo - Quién bloquea a quién y por qué.
   * @returns El identificador del bloqueo.
   */
  block(bloqueo: NewBlock): Observable<{ readonly id: string }> {
    return this.http.post<{ readonly id: string }>(
      this.url('/community/blocks'),
      bloqueo,
    );
  }

  /**
   * `DELETE /community/blocks` — levantar un bloqueo.
   *
   * Levantar el bloqueo **no devuelve los seguimientos** que el bloqueo cortó:
   * el servidor devuelve el permiso de volver a seguir, no la decisión de
   * seguir. La pantalla no debe prometer lo contrario.
   *
   * @param bloqueo - Quién bloqueaba a quién.
   * @returns Si esta llamada levantó el bloqueo.
   */
  unblock(bloqueo: NewBlock): Observable<SocialRemoval> {
    return this.http.delete<SocialRemoval>(this.url('/community/blocks'), {
      params: new HttpParams()
        .set('blockerProfileId', bloqueo.blockerProfileId)
        .set('blockedProfileId', bloqueo.blockedProfileId),
    });
  }

  /**
   * `GET /community/follows` — a quién sigue un perfil.
   *
   * @param query - Quién sigue (obligatorio) y la paginación.
   * @returns Una página de seguimientos.
   */
  listFollows(query: FollowsQuery): Observable<FollowPage> {
    const params = this.cursorParams(
      query,
      new HttpParams().set('followerProfileId', query.followerProfileId),
    );

    return this.http
      .get<WireFollowPage>(this.url('/community/follows'), { params })
      .pipe(map(toFollowPage));
  }

  /**
   * `GET /community/bookmarks` — lo que un perfil guardó.
   *
   * @param query - De quién (obligatorio), colección opcional y paginación.
   * @returns Una página de marcadores.
   */
  listBookmarks(query: BookmarksQuery): Observable<BookmarkPage> {
    let params = new HttpParams().set('profileId', query.profileId);
    if (query.collectionName !== undefined) {
      params = params.set('collectionName', query.collectionName);
    }

    return this.http
      .get<WireBookmarkPage>(this.url('/community/bookmarks'), {
        params: this.cursorParams(query, params),
      })
      .pipe(map(toBookmarkPage));
  }

  /**
   * `GET /community/blocks` — a quién bloqueó un perfil.
   *
   * @param query - De quién (obligatorio) y la paginación.
   * @returns Una página de bloqueos.
   */
  listBlocks(query: BlocksQuery): Observable<BlockPage> {
    const params = this.cursorParams(
      query,
      new HttpParams().set('profileId', query.profileId),
    );

    return this.http
      .get<WireBlockPage>(this.url('/community/blocks'), { params })
      .pipe(map(toBlockPage));
  }

  // ─── Muro y notificaciones ─────────────────────────────────────────────────

  /**
   * `GET /community/feed` — el muro de un perfil.
   *
   * @param query - De quién es el muro (obligatorio) y la paginación.
   * @returns Una página del muro, con la publicación resuelta cuando la hay.
   */
  listFeed(query: FeedQuery): Observable<FeedPage> {
    const params = this.cursorParams(
      query,
      new HttpParams().set('profileId', query.profileId),
    );

    return this.http
      .get<WireFeedPage>(this.url('/community/feed'), { params })
      .pipe(map(toFeedPage));
  }

  /**
   * `GET /community/notifications` — la bandeja de notificaciones sociales.
   *
   * @param query - De quién (obligatorio) y la paginación.
   * @returns Una página de notificaciones, más el total sin leer para la campana.
   */
  listNotifications(query: NotificationsQuery): Observable<NotificationPage> {
    const params = this.cursorParams(
      query,
      new HttpParams().set('profileId', query.profileId),
    );

    return this.http
      .get<WireNotificationPage>(this.url('/community/notifications'), { params })
      .pipe(map(toNotificationPage));
  }

  // ─── Reseñas ───────────────────────────────────────────────────────────────

  /**
   * `GET /community/profiles/:profileId/reviews` — las reseñas de un perfil.
   *
   * @param profileId - A quién reseñaron.
   * @param query - La paginación.
   * @returns Una página de reseñas con sus dimensiones y sus respuestas.
   */
  listReviews(
    profileId: string,
    query: ReviewsQuery = {},
  ): Observable<ServiceReviewPage> {
    return this.http
      .get<WireReviewPage>(
        this.url(`/community/profiles/${encodeURIComponent(profileId)}/reviews`),
        { params: this.cursorParams(query, new HttpParams()) },
      )
      .pipe(map(toReviewPage));
  }


  // ─── Moderación (UC-19-08/09/10) ───────────────────────────────────────────
  //
  // Las tres lecturas exigen `SECURITY_ADMIN` en el servidor. El cliente no lo
  // comprueba: si lo hiciera, habría dos verdades sobre quién puede leer y la
  // del navegador sería la que se puede saltear.

  /**
   * `GET /community/moderation/queue` — la cola de trabajo.
   *
   * Los filtros van por **código** (`QUEUED`, `HIGH`), no por uuid de concepto:
   * pedirle uuids a la pantalla la ataría a la semilla de terminología de cada
   * ambiente.
   *
   * @param query - Filtros de trabajo y paginación.
   * @returns Una página de la cola, con el reporte que originó cada entrada.
   */
  listModerationQueue(
    query: ModerationQueueQuery = {},
  ): Observable<ModerationQueuePage> {
    let params = this.cursorParams(query, new HttpParams());
    params = this.listaParam(params, 'status', query.status);
    params = this.listaParam(params, 'priority', query.priority);
    params = this.listaParam(params, 'contentType', query.contentType);
    if (query.minAgeHours !== undefined) {
      params = params.set('minAgeHours', String(query.minAgeHours));
    }

    return this.http
      .get<WireModerationQueuePage>(this.url('/community/moderation/queue'), {
        params,
      })
      .pipe(map(toModerationQueuePage));
  }

  /**
   * `GET /community/moderation/decisions` — las decisiones tomadas.
   *
   * @param query - Filtros y paginación.
   * @returns Una página de decisiones, de la más reciente hacia atrás.
   */
  listModerationDecisions(
    query: ModerationDecisionsQuery = {},
  ): Observable<ModerationDecisionPage> {
    let params = this.cursorParams(query, new HttpParams());
    params = this.listaParam(params, 'decision', query.decision);
    if (query.moderationQueueId !== undefined) {
      params = params.set('moderationQueueId', query.moderationQueueId);
    }

    return this.http
      .get<WireModerationDecisionPage>(
        this.url('/community/moderation/decisions'),
        { params },
      )
      .pipe(map(toModerationDecisionPage));
  }

  /**
   * `GET /community/moderation/appeals` — las apelaciones presentadas.
   *
   * @param query - Filtros y paginación.
   * @returns Una página de apelaciones, con la decisión que cada una impugna.
   */
  listModerationAppeals(
    query: ModerationAppealsQuery = {},
  ): Observable<ModerationAppealPage> {
    let params = this.cursorParams(query, new HttpParams());
    params = this.listaParam(params, 'status', query.status);
    if (query.appellantProfileId !== undefined) {
      params = params.set('appellantProfileId', query.appellantProfileId);
    }

    return this.http
      .get<WireModerationAppealPage>(
        this.url('/community/moderation/appeals'),
        { params },
      )
      .pipe(map(toModerationAppealPage));
  }

  /**
   * `POST /community/reports` — reporta contenido y lo encola.
   *
   * @param reporte - Qué se reporta y por qué.
   * @returns El id del reporte y la entrada de cola en la que cayó.
   */
  report(
    reporte: NewReport,
  ): Observable<{ readonly id: string; readonly moderationQueueId: string }> {
    return this.http.post<{
      readonly id: string;
      readonly moderationQueueId: string;
    }>(this.url('/community/reports'), reporte);
  }

  /**
   * `POST /community/moderation/queue/:queueId/decision` — resuelve una entrada.
   *
   * @param queueId - Entrada de cola.
   * @param decision - Decisión y su motivo, que es obligatorio.
   * @returns El id de la decisión y el del strike, si emitió uno.
   */
  decideModeration(
    queueId: string,
    decision: NewModerationDecision,
  ): Observable<ModerationDecisionResult> {
    return this.http.post<ModerationDecisionResult>(
      this.url(
        `/community/moderation/queue/${encodeURIComponent(queueId)}/decision`,
      ),
      decision,
    );
  }

  /**
   * `POST /community/moderation/decisions/:decisionId/appeal` — apela.
   *
   * @param decisionId - Decisión impugnada.
   * @param apelacion - Perfil que apela y motivo.
   * @returns El id de la apelación.
   */
  appealDecision(
    decisionId: string,
    apelacion: NewAppeal,
  ): Observable<{ readonly id: string }> {
    return this.http.post<{ readonly id: string }>(
      this.url(
        `/community/moderation/decisions/${encodeURIComponent(decisionId)}/appeal`,
      ),
      apelacion,
    );
  }

  /**
   * `POST /community/moderation/appeals/:appealId/resolve` — cierra una apelación.
   *
   * @param appealId - Apelación abierta.
   * @param resolucion - Qué se resuelve.
   * @returns El id de la apelación resuelta.
   */
  resolveAppeal(
    appealId: string,
    resolucion: ResolveAppeal,
  ): Observable<{ readonly id: string }> {
    return this.http.post<{ readonly id: string }>(
      this.url(
        `/community/moderation/appeals/${encodeURIComponent(appealId)}/resolve`,
      ),
      resolucion,
    );
  }

  // ─── Reseñas de servicio (UC-19-11) ────────────────────────────────────────

  /**
   * `POST /community/profiles/:profileId/reviews` — califica a un profesional.
   *
   * **Quién califica no viaja en el cuerpo**: lo resuelve el servidor desde la
   * sesión. Lo que sí hay que mandar es la atención que respalda la reseña, y el
   * servidor comprueba que sea de esa persona, con ese profesional, y terminada.
   *
   * @param profileId - Vitrina calificada.
   * @param review - Calificación, atención que la respalda y dimensiones.
   * @returns El id de la reseña y si quedó verificada.
   */
  publishReview(
    profileId: string,
    review: NewReview,
  ): Observable<ReviewCreated> {
    return this.http.post<ReviewCreated>(
      this.url(`/community/profiles/${encodeURIComponent(profileId)}/reviews`),
      review,
    );
  }

  /**
   * `POST /community/profiles/:profileId/reviews/:reviewId/responses` —
   * el profesional contesta una reseña de su propia vitrina.
   *
   * @param profileId - Vitrina calificada, que tiene que ser la propia.
   * @param reviewId - Reseña contestada.
   * @param respuesta - Texto de la respuesta.
   * @returns El id de la respuesta.
   */
  respondToReview(
    profileId: string,
    reviewId: string,
    respuesta: NewReviewResponse,
  ): Observable<{ readonly id: string }> {
    const base = `/community/profiles/${encodeURIComponent(profileId)}`;
    return this.http.post<{ readonly id: string }>(
      this.url(`${base}/reviews/${encodeURIComponent(reviewId)}/responses`),
      respuesta,
    );
  }

  // ─── Grupos ────────────────────────────────────────────────────────────────

  /**
   * `GET /community/groups` — los grupos de una organización.
   *
   * @param query - La organización (obligatoria) y la paginación.
   * @returns Una página de grupos.
   */
  listGroups(query: GroupsQuery): Observable<GroupPage> {
    let base = new HttpParams().set('tenantId', query.tenantId);
    // Parámetro a parámetro y sólo si vinieron: el backend valida con
    // `forbidNonWhitelisted` y un opcional en `undefined` vuelve 400.
    if (query.topicId !== undefined) {
      base = base.set('topicId', query.topicId);
    }
    if (query.q !== undefined && query.q !== '') {
      base = base.set('q', query.q);
    }
    const params = this.cursorParams(query, base);

    return this.http
      .get<GroupPage>(this.url('/community/groups'), { params })
      .pipe(map((body) => ({ ...body, items: body.items.map(sinNulos) })));
  }

  /**
   * `GET /community/groups/:groupId/members` — quiénes integran un grupo.
   *
   * @param groupId - El grupo.
   * @param query - Quién mira, y la paginación.
   * @returns Una página de integrantes.
   */
  listGroupMembers(
    groupId: string,
    query: GroupMembersQuery = {},
  ): Observable<GroupMemberPage> {
    let base = this.actorParams(query);
    if (query.joinStatus !== undefined) {
      base = base.set('joinStatus', query.joinStatus);
    }

    return this.http
      .get<WireGroupMemberPage>(
        this.url(`/community/groups/${encodeURIComponent(groupId)}/members`),
        { params: this.cursorParams(query, base) },
      )
      .pipe(map(toGroupMemberPage));
  }

  /**
   * `GET /community/groups/:groupId` — la ficha del grupo.
   *
   * Trae `viewer`: si quien mira ya es integrante, si puede publicar y si
   * administra. Con eso la pantalla se pinta una sola vez y bien.
   *
   * @param groupId - El grupo.
   * @param query - Con qué perfil mira.
   * @returns La ficha del grupo.
   */
  getGroup(groupId: string, query: GroupWallQuery = {}): Observable<GroupDetail> {
    return this.http
      .get<ConNulos<GroupDetail>>(
        this.url(`/community/groups/${encodeURIComponent(groupId)}`),
        { params: this.actorParams(query) },
      )
      .pipe(map((body) => sinNulos(body) as GroupDetail));
  }

  /**
   * `POST /community/groups` — crea un grupo.
   *
   * La organización no viaja en el cuerpo: sale del contexto de tenant de la
   * sesión, que es el mismo que decide qué directorio se está mirando.
   *
   * @param datos - Nombre, slug, visibilidad y tema.
   * @returns El identificador del grupo creado.
   */
  createGroup(datos: NewGroup): Observable<{ readonly id: string }> {
    return this.http.post<{ readonly id: string }>(
      this.url('/community/groups'),
      datos,
    );
  }

  /**
   * `POST /community/groups/:groupId/members` — unirse a un grupo.
   *
   * En un grupo público la membresía queda activa; en uno privado queda
   * esperando que alguien la apruebe. Cuál de las dos pasó lo dice
   * `joinStatus` de la respuesta, no el código HTTP.
   *
   * @param groupId - El grupo.
   * @param memberProfileId - Qué perfil se une.
   * @returns La membresía y su estado.
   */
  joinGroup(
    groupId: string,
    memberProfileId: string,
  ): Observable<{ readonly id: string; readonly joinStatus: string }> {
    return this.http.post<{ readonly id: string; readonly joinStatus: string }>(
      this.url(`/community/groups/${encodeURIComponent(groupId)}/members`),
      { memberProfileId },
    );
  }

  /**
   * `DELETE /community/groups/:groupId/members/:memberProfileId` — dejar el
   * grupo, o dar de baja a alguien.
   *
   * Lleva el **perfil** y no el id de membresía porque quien se va conoce su
   * perfil, no el uuid de su fila en el padrón.
   *
   * @param groupId - El grupo.
   * @param memberProfileId - Quién deja el grupo.
   * @returns La membresía con su estado final.
   */
  leaveGroup(
    groupId: string,
    memberProfileId: string,
  ): Observable<GroupMemberUpdated> {
    return this.http.delete<GroupMemberUpdated>(
      this.url(
        `/community/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberProfileId)}`,
      ),
    );
  }

  /**
   * `PATCH /community/groups/:groupId/members/:memberId` — resolver un alta o
   * cambiar un rol.
   *
   * @param groupId - El grupo.
   * @param memberId - La membresía.
   * @param cambio - Decisión y/o rol nuevo.
   * @returns La membresía con su rol y estado resultantes.
   */
  updateGroupMember(
    groupId: string,
    memberId: string,
    cambio: GroupMemberChange,
  ): Observable<GroupMemberUpdated> {
    return this.http.patch<GroupMemberUpdated>(
      this.url(
        `/community/groups/${encodeURIComponent(groupId)}/members/${encodeURIComponent(memberId)}`,
      ),
      cambio,
    );
  }

  /**
   * `GET /community/groups/:groupId/posts` — el muro del grupo.
   *
   * @param groupId - El grupo.
   * @param query - Quién mira, y la paginación.
   * @returns Una página de publicaciones con sus respuestas.
   */
  listGroupWall(
    groupId: string,
    query: GroupWallQuery = {},
  ): Observable<GroupWallPage> {
    return this.http
      .get<WireGroupWallPage>(
        this.url(`/community/groups/${encodeURIComponent(groupId)}/posts`),
        { params: this.cursorParams(query, this.actorParams(query)) },
      )
      .pipe(map(toGroupWallPage));
  }

  /**
   * `POST /community/groups/:groupId/posts` — publicar en el muro, o responder.
   *
   * Publicar y responder son la misma llamada: lo único que las distingue es
   * `parentCommentId`.
   *
   * @param groupId - El grupo.
   * @param datos - Autor, cuerpo y publicación padre si es una respuesta.
   * @returns La publicación creada.
   */
  publishGroupPost(
    groupId: string,
    datos: NewGroupPost,
  ): Observable<GroupWallItem> {
    return this.http
      .post<WireGroupWallItem>(
        this.url(`/community/groups/${encodeURIComponent(groupId)}/posts`),
        datos,
      )
      .pipe(map(toGroupWallItem));
  }

  /**
   * `GET /community/topics` — los temas de la comunidad.
   *
   * @returns El árbol de temas activos.
   */
  listTopics(): Observable<TopicPage> {
    return this.http
      .get<TopicPage>(this.url('/community/topics'))
      .pipe(map((body) => ({ ...body, items: body.items.map(sinNulos) })));
  }

  // ─── Mensajería directa ────────────────────────────────────────────────────

  /**
   * `GET /community/conversations` — la bandeja de conversaciones.
   *
   * **Sin cursor**: el contrato de esta lectura sólo acepta `limit`.
   *
   * @param query - De quién es la bandeja (obligatorio) y el tope.
   * @returns Una página de conversaciones con su último mensaje y sus no leídos.
   */
  listConversations(query: ConversationsQuery): Observable<ConversationPage> {
    let params = new HttpParams().set('profileId', query.profileId);
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }

    return this.http
      .get<WireConversationPage>(this.url('/community/conversations'), { params })
      .pipe(map(toConversationPage));
  }

  /**
   * `GET /community/conversations/:conversationId/messages` — los mensajes.
   *
   * @param conversationId - La conversación.
   * @param query - Quién lee (obligatorio: el backend comprueba que participe)
   *   y la paginación.
   * @returns Una página de mensajes.
   */
  listMessages(
    conversationId: string,
    query: ConversationMessagesQuery,
  ): Observable<DirectMessagePage> {
    const params = this.cursorParams(
      query,
      new HttpParams().set('profileId', query.profileId),
    );

    return this.http
      .get<WireMessagePage>(
        this.url(
          `/community/conversations/${encodeURIComponent(conversationId)}/messages`,
        ),
        { params },
      )
      .pipe(map(toMessagePage));
  }

  /**
   * `GET /community/profiles/by-slug/:slug` — la ficha por su slug.
   *
   * Es el puente entre el buscador público —que devuelve `slug` y no uuid— y
   * cualquier acción que necesite el `profileId`, «escribirle» la primera.
   *
   * @param slug - El slug estable del directorio.
   * @returns La ficha, con su identificador.
   */
  readProfileBySlug(slug: string): Observable<PublicProfileDetail> {
    return this.http
      .get<WireProfile>(
        this.url(`/community/profiles/by-slug/${encodeURIComponent(slug)}`),
      )
      .pipe(map(toProfile));
  }

  /**
   * `GET /community/public/search/practitioners` — profesionales del directorio.
   *
   * Devuelve `slug`, no `profileId`: la superficie pública no expone
   * identificadores internos. Para escribirle a alguien, este resultado se
   * resuelve después con {@link readProfileBySlug}.
   *
   * @param q - Texto de búsqueda.
   * @param limit - Tope de resultados.
   * @returns Los profesionales que coinciden.
   */
  searchPractitioners(
    q: string,
    limit = 10,
  ): Observable<readonly PublicDirectoryResult[]> {
    let params = new HttpParams().set('limit', String(limit));
    if (q !== '') {
      params = params.set('q', q);
    }
    return this.http
      .get<{ readonly items: readonly PublicDirectoryResult[] }>(
        this.url('/community/public/search/practitioners'),
        { params },
      )
      .pipe(map((body) => body.items));
  }

  /**
   * `POST /community/conversations` — abre el hilo con alguien.
   *
   * **Devuelve el hilo que ya existe** si lo hay: desde el carril P2 el backend
   * reutiliza la conversación directa entre los mismos dos perfiles. Por eso
   * esta llamada se puede hacer cada vez que alguien pulsa «Escribir al
   * doctor», sin que el cliente tenga que recordar si ya la abrió.
   *
   * @param datos - Los participantes (los dos, el propio incluido).
   * @returns El identificador de la conversación.
   */
  createConversation(datos: NewConversation): Observable<{ readonly id: string }> {
    return this.http.post<{ readonly id: string }>(
      this.url('/community/conversations'),
      datos,
    );
  }

  /**
   * `POST /community/conversations/:id/messages` — envía un mensaje.
   *
   * @param conversationId - El hilo.
   * @param datos - Quién escribe y qué.
   * @returns El mensaje creado, con su marca de envío.
   */
  sendMessage(
    conversationId: string,
    datos: NewDirectMessage,
  ): Observable<SentMessage> {
    return this.http
      .post<ConNulos<{ id: string; conversationId: string; sentAt: string }>>(
        this.url(
          `/community/conversations/${encodeURIComponent(conversationId)}/messages`,
        ),
        datos,
      )
      .pipe(
        map((body) => ({
          id: body.id ?? '',
          conversationId: body.conversationId ?? conversationId,
          ...fecha('sentAt', body.sentAt),
        })),
      );
  }

  /**
   * `POST /community/conversations/:id/read` — marca leído hasta el último.
   *
   * Sin `upToMessageId` el backend usa el mensaje más reciente, que es lo que
   * quiere decir «abrí el hilo y lo leí».
   *
   * @param conversationId - El hilo.
   * @param recipientProfileId - Quién lo leyó.
   * @param upToMessageId - Hasta dónde, si no es hasta el final.
   * @returns Cuántos recibos se asentaron y hasta qué mensaje.
   */
  markConversationRead(
    conversationId: string,
    recipientProfileId: string,
    upToMessageId?: string,
  ): Observable<ConversationRead> {
    return this.http.post<ConversationRead>(
      this.url(
        `/community/conversations/${encodeURIComponent(conversationId)}/read`,
      ),
      upToMessageId === undefined
        ? { recipientProfileId }
        : { recipientProfileId, upToMessageId },
    );
  }

  // ─── Encuestas ─────────────────────────────────────────────────────────────

  /**
   * `GET /community/polls/:pollId` — una encuesta con sus resultados.
   *
   * @param pollId - La encuesta.
   * @param query - Quién mira. Con actor viene además qué votó.
   * @returns La encuesta con el conteo por opción.
   */
  readPoll(pollId: string, query: ProfilePostsQuery = {}): Observable<PollDetail> {
    return this.http
      .get<WirePoll>(this.url(`/community/polls/${encodeURIComponent(pollId)}`), {
        params: this.actorParams(query),
      })
      .pipe(map(toPoll));
  }

  // ─── Interno ───────────────────────────────────────────────────────────────

  private url(path: string): string {
    return apiUrl(this.baseUrl, path);
  }

  /**
   * Agrega `cursor` y `limit` **sólo si vinieron**.
   *
   * Parámetro a parámetro y nunca con un objeto: el backend valida con
   * `forbidNonWhitelisted`, y un opcional en `undefined` viaja como clave
   * declarada y vuelve 400.
   */
  private cursorParams(
    query: { readonly cursor?: string; readonly limit?: number },
    base: HttpParams,
  ): HttpParams {
    let params = base;
    if (query.cursor !== undefined) {
      params = params.set('cursor', query.cursor);
    }
    if (query.limit !== undefined) {
      params = params.set('limit', String(query.limit));
    }
    return params;
  }

  /**
   * Agrega un filtro de lista como valores separados por comas.
   *
   * Es la forma que el servidor acepta además del `?x=a&x=b` de Nest, y la que
   * deja la URL legible cuando alguien la copia de la barra del navegador.
   *
   * Una lista vacía **no se manda**: `?status=` significaría «filtrá por el
   * estado llamado cadena vacía», que no devuelve nada, en vez de «no filtres».
   */
  private listaParam(
    params: HttpParams,
    nombre: string,
    valores: readonly string[] | undefined,
  ): HttpParams {
    return valores === undefined || valores.length === 0
      ? params
      : params.set(nombre, valores.join(','));
  }

  /** Agrega `actorProfileId` sólo si vino. Sin él la lectura es la anónima. */
  private actorParams(query: { readonly actorProfileId?: string }): HttpParams {
    return query.actorProfileId === undefined
      ? new HttpParams()
      : new HttpParams().set('actorProfileId', query.actorProfileId);
  }
}

/* ============================================================================
    La forma del transporte.

    Un `Wire*` es el cuerpo **tal como viaja**: fechas en texto ISO y opcionales
    que pueden llegar en `null`. Los `to*` son la frontera donde eso se
    convierte en el tipo de la vista — ver `wire.ts`.
    ========================================================================== */

type ConNulos<T> = { readonly [K in keyof T]: T[K] | null };

type WireOwnProfile = ConNulos<OwnPublicProfile>;

type WireBadge = Omit<
  ConNulos<PublicProfileDetail['badges'][number]>,
  'validFrom' | 'validTo'
> & {
  readonly validFrom: string | null;
  readonly validTo: string | null;
};

type WirePrestige = Omit<ConNulos<PrestigeLike>, 'calculatedAt'> & {
  readonly calculatedAt: string | null;
};

type PrestigeLike = NonNullable<PublicProfileDetail['prestige']>;

type WireProfile = Omit<ConNulos<PublicProfileDetail>, 'badges' | 'prestige'> & {
  readonly badges: readonly WireBadge[];
  readonly prestige: WirePrestige | null;
};

type WirePost = Omit<
  ConNulos<PostListItem>,
  'publishedAt' | 'editedAt' | 'reactions'
> & {
  readonly publishedAt: string | null;
  readonly editedAt: string | null;
  readonly reactions: WireReactionSummary;
};

type WirePostDetail = WirePost & {
  readonly media: readonly ConNulos<PostDetail['media'][number]>[];
  readonly hashtags: readonly PostDetail['hashtags'][number][];
  readonly mentions: readonly ConNulos<PostDetail['mentions'][number]>[];
};

interface WirePostPage extends Omit<PostPage, 'items'> {
  readonly items: readonly WirePost[];
}

type WireComment = Omit<
  ConNulos<CommentThreadItem>,
  'createdAt' | 'replies'
> & {
  readonly createdAt: string;
  readonly replies: readonly WireComment[];
};

interface WireCommentPage extends Omit<CommentThreadPage, 'items'> {
  readonly items: readonly WireComment[];
}

type WireReactionSummary = ConNulos<ReactionSummary> & {
  readonly tallies: ReactionSummary['tallies'];
  readonly total: number;
};

type WireFollow = Omit<ConNulos<FollowListItem>, 'createdAt'> & {
  readonly createdAt: string;
};

interface WireFollowPage extends Omit<FollowPage, 'items'> {
  readonly items: readonly WireFollow[];
}

type WireBookmark = Omit<ConNulos<BookmarkListItem>, 'createdAt'> & {
  readonly createdAt: string;
};

interface WireBookmarkPage extends Omit<BookmarkPage, 'items'> {
  readonly items: readonly WireBookmark[];
}

type WireBlock = Omit<ConNulos<BlockListItem>, 'createdAt'> & {
  readonly createdAt: string;
};

interface WireBlockPage extends Omit<BlockPage, 'items'> {
  readonly items: readonly WireBlock[];
}

type WireFeedItem = Omit<ConNulos<FeedListItem>, 'createdAt' | 'post'> & {
  readonly createdAt: string;
  readonly post: WirePost | null;
};

interface WireFeedPage extends Omit<FeedPage, 'items'> {
  readonly items: readonly WireFeedItem[];
}

type WireNotification = Omit<
  ConNulos<SocialNotification>,
  'createdAt' | 'readAt' | 'isRead'
> & {
  readonly createdAt: string;
  readonly readAt: string | null;
  readonly isRead: boolean;
};

interface WireNotificationPage extends Omit<NotificationPage, 'items'> {
  readonly items: readonly WireNotification[];
}

type WireReview = Omit<
  ConNulos<ServiceReview>,
  'publishedAt' | 'editedAt' | 'dimensionScores' | 'responses'
> & {
  readonly publishedAt: string | null;
  readonly editedAt: string | null;
  readonly dimensionScores: ServiceReview['dimensionScores'];
  readonly responses: readonly (Omit<
    ConNulos<ReviewResponseLike>,
    'publishedAt'
  > & {
    readonly publishedAt: string | null;
  })[];
};

type ReviewResponseLike = ServiceReview['responses'][number];

interface WireReviewPage extends Omit<ServiceReviewPage, 'items'> {
  readonly items: readonly WireReview[];
}

type WireGroupMember = Omit<ConNulos<GroupMember>, 'joinedAt'> & {
  readonly joinedAt: string | null;
};

interface WireGroupMemberPage extends Omit<GroupMemberPage, 'items'> {
  readonly items: readonly WireGroupMember[];
}

type WireGroupWallItem = Omit<
  ConNulos<GroupWallItem>,
  'createdAt' | 'replies'
> & {
  readonly createdAt: string;
  readonly replies: readonly WireGroupWallItem[] | null;
};

interface WireGroupWallPage extends Omit<GroupWallPage, 'items'> {
  readonly items: readonly WireGroupWallItem[];
}

type WireConversation = Omit<
  ConNulos<ConversationListItem>,
  'lastMessageAt' | 'lastMessage' | 'unreadCount' | 'peers'
> & {
  readonly lastMessageAt: string | null;
  readonly unreadCount: number;
  readonly lastMessage:
    | (Omit<ConNulos<PreviewLike>, 'sentAt'> & { readonly sentAt: string | null })
    | null;
  /** Opcional en el transporte: un backend anterior a P2 no lo manda. */
  readonly peers?: readonly ConNulos<ConversationPeer>[];
};

type PreviewLike = NonNullable<ConversationListItem['lastMessage']>;

interface WireConversationPage extends Omit<ConversationPage, 'items'> {
  readonly items: readonly WireConversation[];
}

type WireMessage = Omit<ConNulos<DirectMessage>, 'sentAt'> & {
  readonly sentAt: string | null;
};

interface WireMessagePage extends Omit<DirectMessagePage, 'items'> {
  readonly items: readonly WireMessage[];
}

type WirePoll = Omit<ConNulos<PollDetail>, 'closesAt' | 'options'> & {
  readonly closesAt: string | null;
  readonly options: PollDetail['options'];
};

function toProfile({ badges, prestige, ...resto }: WireProfile): PublicProfileDetail {
  return {
    ...sinNulos(resto),
    badges: badges.map(({ validFrom, validTo, ...badge }) => ({
      ...sinNulos(badge),
      ...fecha('validFrom', validFrom),
      ...fecha('validTo', validTo),
    })),
    ...(prestige === null
      ? {}
      : {
          prestige: {
            ...sinNulos(omitir(prestige, 'calculatedAt')),
            ...fecha('calculatedAt', prestige.calculatedAt),
          },
        }),
  };
}

// ─── Moderación ──────────────────────────────────────────────────────────────

/**
 * Lo que devuelve decidir una moderación.
 *
 * `strikeId` es `null` cuando la decisión no sancionó a nadie —«desestimada», o
 * una advertencia sin sujeto declarado—, no cuando falló algo.
 */
export interface ModerationDecisionResult {
  readonly id: string;
  readonly strikeId: string | null;
  readonly decision: string;
}

/** Lo que devuelve publicar una reseña. */
export interface ReviewCreated {
  readonly id: string;
  readonly overallRating: number;
  readonly verified: boolean;
  readonly dimensionCount: number;
}

/**
 * El reporte tal como viaja.
 *
 * Sólo `detailText` puede ser nulo —quien reporta puede no escribir nada—; el
 * id, la razón y la fecha siempre vienen, así que declararlos nulables obligaría
 * a la pantalla a defenderse de un caso que el servidor no produce.
 */
interface WireQueueReport {
  readonly id: string;
  readonly reasonConceptId: string;
  readonly detailText: string | null;
  readonly createdAt: string;
}

type WireQueueItem = Omit<
  ConNulos<ModerationQueueItem>,
  'queuedAt' | 'report' | 'reportCount'
> & {
  readonly queuedAt: string | null;
  readonly report: WireQueueReport | null;
  readonly reportCount: number;
};

interface WireModerationQueuePage
  extends Omit<ModerationQueuePage, 'items'> {
  readonly items: readonly WireQueueItem[];
}

type WireDecisionItem = Omit<
  ConNulos<ModerationDecisionItem>,
  'decidedAt'
> & { readonly decidedAt: string | null };

interface WireModerationDecisionPage
  extends Omit<ModerationDecisionPage, 'items'> {
  readonly items: readonly WireDecisionItem[];
}

type WireAppealItem = Omit<
  ConNulos<ModerationAppealItem>,
  'createdAt' | 'resolvedAt' | 'decision'
> & {
  readonly createdAt: string;
  readonly resolvedAt: string | null;
  readonly decision: WireDecisionItem | null;
};

interface WireModerationAppealPage
  extends Omit<ModerationAppealPage, 'items'> {
  readonly items: readonly WireAppealItem[];
}

function toQueueItem({
  queuedAt,
  report,
  ...resto
}: WireQueueItem): ModerationQueueItem {
  return {
    ...sinNulos(resto),
    ...fecha('queuedAt', queuedAt),
    // `report` en `null` significa «esta entrada no nació de un reporte» —la
    // abrió una apelación o un proceso automático—, no que falte el dato.
    ...(report === null
      ? {}
      : {
          report: {
            id: report.id,
            reasonConceptId: report.reasonConceptId,
            createdAt: new Date(report.createdAt),
            ...(report.detailText === null
              ? {}
              : { detailText: report.detailText }),
          },
        }),
  };
}

function toModerationQueuePage(
  body: WireModerationQueuePage,
): ModerationQueuePage {
  return { ...body, items: body.items.map(toQueueItem) };
}

function toDecisionItem({
  decidedAt,
  ...resto
}: WireDecisionItem): ModerationDecisionItem {
  return { ...sinNulos(resto), ...fecha('decidedAt', decidedAt) };
}

function toModerationDecisionPage(
  body: WireModerationDecisionPage,
): ModerationDecisionPage {
  return { ...body, items: body.items.map(toDecisionItem) };
}

function toAppealItem({
  createdAt,
  resolvedAt,
  decision,
  ...resto
}: WireAppealItem): ModerationAppealItem {
  return {
    ...sinNulos(resto),
    createdAt: new Date(createdAt),
    ...fecha('resolvedAt', resolvedAt),
    ...(decision === null ? {} : { decision: toDecisionItem(decision) }),
  };
}

function toModerationAppealPage(
  body: WireModerationAppealPage,
): ModerationAppealPage {
  return { ...body, items: body.items.map(toAppealItem) };
}

function toPost({
  publishedAt,
  editedAt,
  reactions,
  ...resto
}: WirePost): PostListItem {
  return {
    ...sinNulos(resto),
    ...fecha('publishedAt', publishedAt),
    ...fecha('editedAt', editedAt),
    // El resumen anidado se normaliza aparte: `sinNulos` no entra en los
    // objetos hijos, y el servidor manda `actorReactionTypeConceptId: null`
    // para decir «no reaccionó». Para la pantalla los dos casos —no reaccionó y
    // no se preguntó— se pintan igual: botón apagado.
    //
    // El `??` no es defensa contra un contrato incumplido: es que la API y el
    // frontend se despliegan por separado, y una API anterior a este campo haría
    // reventar el muro **entero** por una publicación sin recuento. Un cero es
    // menos falso que una pantalla en blanco.
    reactions: reactions == null ? { tallies: [], total: 0 } : sinNulos(reactions),
    commentCount: resto.commentCount ?? 0,
  };
}

function toPostDetail({
  media,
  hashtags,
  mentions,
  ...resto
}: WirePostDetail): PostDetail {
  return {
    ...toPost(resto),
    media: media.map(sinNulos),
    hashtags: [...hashtags],
    mentions: mentions.map(sinNulos),
  };
}

function toPostPage(body: WirePostPage): PostPage {
  return { ...body, items: body.items.map(toPost) };
}

/**
 * Un comentario y sus respuestas.
 *
 * Recursiva porque el hilo lo es. La profundidad la acota el backend, no acá:
 * poner un tope de recursión del lado del cliente escondería un hilo que el
 * servidor sí devolvió.
 */
function toComment({ createdAt, replies, ...resto }: WireComment): CommentThreadItem {
  return {
    ...sinNulos(resto),
    createdAt: new Date(createdAt),
    replies: replies.map(toComment),
  };
}

function toCommentPage(body: WireCommentPage): CommentThreadPage {
  return { ...body, items: body.items.map(toComment) };
}

function toFollow({ createdAt, ...resto }: WireFollow): FollowListItem {
  return { ...sinNulos(resto), createdAt: new Date(createdAt) };
}

function toFollowPage(body: WireFollowPage): FollowPage {
  return { ...body, items: body.items.map(toFollow) };
}

function toBookmark({ createdAt, ...resto }: WireBookmark): BookmarkListItem {
  return { ...sinNulos(resto), createdAt: new Date(createdAt) };
}

function toBookmarkPage(body: WireBookmarkPage): BookmarkPage {
  return { ...body, items: body.items.map(toBookmark) };
}

function toBlock({ createdAt, ...resto }: WireBlock): BlockListItem {
  return { ...sinNulos(resto), createdAt: new Date(createdAt) };
}

function toBlockPage(body: WireBlockPage): BlockPage {
  return { ...body, items: body.items.map(toBlock) };
}

function toFeedItem({ createdAt, post, ...resto }: WireFeedItem): FeedListItem {
  return {
    ...sinNulos(resto),
    createdAt: new Date(createdAt),
    ...(post === null ? {} : { post: toPost(post) }),
  };
}

function toFeedPage(body: WireFeedPage): FeedPage {
  return { ...body, items: body.items.map(toFeedItem) };
}

function toNotification({
  createdAt,
  readAt,
  isRead,
  ...resto
}: WireNotification): SocialNotification {
  return {
    ...sinNulos(resto),
    isRead,
    createdAt: new Date(createdAt),
    ...fecha('readAt', readAt),
  };
}

function toNotificationPage(body: WireNotificationPage): NotificationPage {
  return { ...body, items: body.items.map(toNotification) };
}

function toReview({
  publishedAt,
  editedAt,
  dimensionScores,
  responses,
  ...resto
}: WireReview): ServiceReview {
  return {
    ...sinNulos(resto),
    ...fecha('publishedAt', publishedAt),
    ...fecha('editedAt', editedAt),
    dimensionScores: [...dimensionScores],
    responses: responses.map(({ publishedAt: respuesta, ...item }) => ({
      ...sinNulos(item),
      ...fecha('publishedAt', respuesta),
    })),
  };
}

function toReviewPage(body: WireReviewPage): ServiceReviewPage {
  return { ...body, items: body.items.map(toReview) };
}

function toGroupMember({ joinedAt, ...resto }: WireGroupMember): GroupMember {
  return { ...sinNulos(resto), ...fecha('joinedAt', joinedAt) };
}

function toGroupWallItem(item: WireGroupWallItem): GroupWallItem {
  const { createdAt, replies, ...resto } = item;
  return {
    ...sinNulos(resto),
    createdAt: new Date(createdAt),
    replies: (replies ?? []).map(toGroupWallItem),
  } as GroupWallItem;
}

/** Una página del muro, ya con sus fechas convertidas. */
function toGroupWallPage(body: WireGroupWallPage): GroupWallPage {
  return { ...body, items: body.items.map(toGroupWallItem) };
}

function toGroupMemberPage(body: WireGroupMemberPage): GroupMemberPage {
  return { ...body, items: body.items.map(toGroupMember) };
}

function toConversation({
  lastMessageAt,
  lastMessage,
  unreadCount,
  peers,
  ...resto
}: WireConversation): ConversationListItem {
  return {
    ...sinNulos(resto),
    unreadCount,
    // `peers` viaja siempre desde el carril P2, pero se defiende igual: un
    // backend anterior devolvería la fila sin la clave, y una bandeja que
    // explota al iterar `undefined` es peor que una sin nombres.
    peers: (peers ?? []).map((peer) => sinNulos(peer)),
    ...fecha('lastMessageAt', lastMessageAt),
    ...(lastMessage === null
      ? {}
      : {
          lastMessage: {
            ...sinNulos(omitir(lastMessage, 'sentAt')),
            ...fecha('sentAt', lastMessage.sentAt),
          },
        }),
  };
}

function toConversationPage(body: WireConversationPage): ConversationPage {
  return { ...body, items: body.items.map(toConversation) };
}

function toMessage({ sentAt, ...resto }: WireMessage): DirectMessage {
  return { ...sinNulos(resto), ...fecha('sentAt', sentAt) };
}

function toMessagePage(body: WireMessagePage): DirectMessagePage {
  return { ...body, items: body.items.map(toMessage) };
}

function toPoll({ closesAt, options, ...resto }: WirePoll): PollDetail {
  return {
    ...sinNulos(resto),
    options: [...options],
    ...fecha('closesAt', closesAt),
  };
}

/**
 * Una fecha opcional, como clave presente o **ausente**.
 *
 * Devuelve `{}` cuando no vino, no `{ clave: undefined }`: es la misma razón
 * por la que `sinNulos` elimina la clave en vez de ponerla en `undefined` —
 * que `'x' in objeto` y `Object.keys()` digan lo mismo que el tipo.
 */
function fecha<K extends string>(
  clave: K,
  valor: string | null,
): Record<K, Date> | Record<string, never> {
  const convertida = maybeDate(valor);
  return convertida === undefined ? {} : ({ [clave]: convertida } as Record<K, Date>);
}

/** Copia sin una clave, para poder tratarla aparte sin mutar el original. */
function omitir<T extends object, K extends keyof T>(objeto: T, clave: K): Omit<T, K> {
  const { [clave]: _descartada, ...resto } = objeto;
  return resto;
}
