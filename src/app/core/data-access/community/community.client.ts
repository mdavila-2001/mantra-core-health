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
  ConversationsQuery,
  DirectMessage,
  DirectMessagePage,
  FeedListItem,
  FeedPage,
  FeedQuery,
  FollowListItem,
  FollowPage,
  FollowsQuery,
  GroupMember,
  GroupMemberPage,
  GroupMembersQuery,
  GroupPage,
  GroupsQuery,
  NotificationPage,
  NotificationsQuery,
  PollDetail,
  PostCommentsQuery,
  PostDetail,
  PostListItem,
  PostPage,
  ProfilePostsQuery,
  PublicProfileDetail,
  ReactionSummary,
  ReviewsQuery,
  ServiceReview,
  ServiceReviewPage,
  SocialNotification,
} from './community.types';

/**
 * Cliente de `community` (M19): la red social médica.
 *
 * ## Sólo lecturas, y a propósito
 *
 * El módulo tiene 17 escrituras en el backend —publicar, comentar, reaccionar,
 * seguir, bloquear, reportar, moderar— y ninguna está acá. No es un olvido: las
 * escrituras llegan con la pantalla que las dispara, y la pantalla necesita
 * antes poder **leer**. Agregar una escritura sin su pantalla es adivinar la
 * forma del formulario.
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

  // ─── Grupos ────────────────────────────────────────────────────────────────

  /**
   * `GET /community/groups` — los grupos de una organización.
   *
   * @param query - La organización (obligatoria) y la paginación.
   * @returns Una página de grupos.
   */
  listGroups(query: GroupsQuery): Observable<GroupPage> {
    const params = this.cursorParams(
      query,
      new HttpParams().set('tenantId', query.tenantId),
    );

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
    return this.http
      .get<WireGroupMemberPage>(
        this.url(`/community/groups/${encodeURIComponent(groupId)}/members`),
        { params: this.cursorParams(query, this.actorParams(query)) },
      )
      .pipe(map(toGroupMemberPage));
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

type WirePost = Omit<ConNulos<PostListItem>, 'publishedAt' | 'editedAt'> & {
  readonly publishedAt: string | null;
  readonly editedAt: string | null;
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

type WireConversation = Omit<
  ConNulos<ConversationListItem>,
  'lastMessageAt' | 'lastMessage' | 'unreadCount'
> & {
  readonly lastMessageAt: string | null;
  readonly unreadCount: number;
  readonly lastMessage:
    | (Omit<ConNulos<PreviewLike>, 'sentAt'> & { readonly sentAt: string | null })
    | null;
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

function toPost({ publishedAt, editedAt, ...resto }: WirePost): PostListItem {
  return {
    ...sinNulos(resto),
    ...fecha('publishedAt', publishedAt),
    ...fecha('editedAt', editedAt),
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

function toGroupMemberPage(body: WireGroupMemberPage): GroupMemberPage {
  return { ...body, items: body.items.map(toGroupMember) };
}

function toConversation({
  lastMessageAt,
  lastMessage,
  unreadCount,
  ...resto
}: WireConversation): ConversationListItem {
  return {
    ...sinNulos(resto),
    unreadCount,
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
