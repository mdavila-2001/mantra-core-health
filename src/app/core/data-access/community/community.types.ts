/* ============================================================================
    Tipos de la vista para `community` (M19): la red social médica.

    Se mapean desde los DTOs del backend, **no son ellos**: las fechas llegan
    como texto ISO y acá salen como `Date`, y los campos que el contrato declara
    opcionales se normalizan a `undefined` en vez de dejar `null` conviviendo
    con la ausencia. El porqué está en `wire.ts`.

    ## Todo estado es un uuid de concepto, y no se ramifica por él

    `visibilityConceptId`, `reactionTypeConceptId`, `statusConceptId` y compañía
    viajan como uuid porque así los emite el modelo: los estados son datos de
    catálogo, no un enum del código. Quien los muestre los traduce con
    `TerminologyClient.readConceptLabels`. Escribir un `if` contra un uuid
    literal es la forma más rápida de que una pantalla mienta el día que
    terminología agregue un valor.

    ## Los conteos son `number`; los puntajes de prestigio, `string`

    No es un descuido del backend: `prestige_scores.total_points` y
    `feed_items.rank_score` son numéricos de precisión arbitraria en el modelo,
    y serializarlos como `number` los redondearía en silencio. Llegan como texto
    y acá se conservan como texto — quien los ordene, que los compare como
    números; quien los muestre, que los muestre tal cual.

    ## Paginación por cursor, sin total

    Ninguna página trae «cuántas hay en total»: traen `count` —cuántas vinieron
    en ESTA página— y `nextCursor`. Es la regla del M34 y es deliberada: contar
    el total de un feed obliga a recorrerlo entero. Una pantalla que necesite
    «página 3 de 47» está pidiendo algo que este contrato no da.
    ========================================================================== */

// ─── Perfil público ──────────────────────────────────────────────────────────

/** Un sello de verificación sobre un perfil público. */
export interface VerifiedBadge {
  readonly id: string;
  readonly badgeTypeConceptId: string;
  readonly verificationMethodConceptId: string;
  readonly validFrom?: Date;
  readonly validTo?: Date;
}

/**
 * El prestigio acumulado de un perfil.
 *
 * `totalPoints` es texto a propósito — ver la cabecera de este archivo.
 */
export interface PrestigeScore {
  readonly totalPoints: string;
  readonly levelConceptId?: string;
  readonly rankPosition?: number;
  readonly calculatedAt?: Date;
}

/** La ficha pública de una persona u organización. */
export interface PublicProfileDetail {
  readonly id: string;
  readonly tenantId: string;
  /** A qué apunta el perfil: profesional, organización, farmacia… */
  readonly targetTypeConceptId: string;
  /** Identificador legible de la URL pública, p. ej. `marisol-quispe-ticona`. */
  readonly slug: string;
  readonly displayName: string;
  readonly headline?: string;
  readonly biography?: string;
  readonly avatarFileId?: string;
  readonly coverFileId?: string;
  readonly verificationStatusConceptId?: string;
  readonly acceptsReviews?: boolean;
  readonly statusConceptId: string;
  readonly badges: readonly VerifiedBadge[];
  readonly prestige?: PrestigeScore;
}

// ─── Vitrina propia ──────────────────────────────────────────────────────────

/** La vitrina pública propia, tal como la ve su titular. */
export interface OwnPublicProfile {
  readonly id: string;
  readonly tenantId: string;
  /** El sujeto que representa: el perfil profesional, o la cuenta. */
  readonly targetId: string;
  readonly slug: string;
  readonly displayName: string;
  readonly headline?: string;
  readonly biography?: string;
  readonly acceptsReviews?: boolean;
  /** Lo otorga la plataforma; se muestra, no se declara. */
  readonly verificationStatusConceptId?: string;
  readonly statusConceptId: string;
}

/**
 * Lo que se manda a `PUT /community/profiles/me` para crear o actualizar la
 * vitrina propia. Idempotente: no hace falta saber si ya existía una.
 */
export interface UpsertOwnPublicProfile {
  readonly tenantId: string;
  readonly slug: string;
  readonly displayName: string;
  readonly headline?: string;
  readonly biography?: string;
  readonly acceptsReviews?: boolean;
}

// ─── Publicaciones ───────────────────────────────────────────────────────────

/** Una pieza de medios adjunta a una publicación. */
export interface PostMedia {
  readonly id: string;
  readonly fileId: string;
  readonly mediaRoleConceptId: string;
  readonly altText?: string;
  readonly ordinal?: number;
}

/** Una etiqueta de una publicación. */
export interface PostHashtag {
  readonly id: string;
  readonly tag: string;
}

/** Una mención dentro del cuerpo de una publicación, con su tramo de texto. */
export interface PostMention {
  readonly id: string;
  readonly mentionedProfileId: string;
  readonly offsetStart?: number;
  readonly offsetEnd?: number;
}

/** Una publicación tal como aparece en un listado. */
export interface PostListItem {
  readonly id: string;
  readonly authorPublicProfileId: string;
  readonly postTypeConceptId: string;
  readonly bodyText: string;
  readonly visibilityConceptId?: string;
  readonly commentsEnabled?: boolean;
  readonly publishedAt?: Date;
  readonly editedAt?: Date;
  /**
   * Reacciones de la publicación, con la propia del lector si tiene perfil.
   *
   * **Viene con la fila.** Antes había que pedir
   * `GET /posts/:id/reactions` una vez por tarjeta, así que en la práctica no se
   * pedía y el contador de la pantalla era el del gesto que el usuario acababa
   * de hacer: al recargar volvía a cero aunque la reacción estuviera guardada.
   */
  readonly reactions: ReactionSummary;
  /** Comentarios vigentes del hilo completo, raíces y respuestas. */
  readonly commentCount: number;
}

/** Una publicación abierta, con sus medios, etiquetas y menciones. */
export interface PostDetail extends PostListItem {
  readonly media: readonly PostMedia[];
  readonly hashtags: readonly PostHashtag[];
  readonly mentions: readonly PostMention[];
}

/** Una página de publicaciones. */
export interface PostPage {
  readonly items: readonly PostListItem[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

/**
 * Quién puede leer una publicación.
 *
 * Los tres códigos son los del enum del DTO del servidor; omitir el campo
 * equivale a `PUBLIC`, que es como se leen las publicaciones anteriores a que el
 * campo existiera.
 */
export type PostVisibility = 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';

/** Lo que se manda a `POST /community/profiles/:profileId/posts` para publicar. */
export interface NewPost {
  readonly bodyText: string;
  readonly visibility?: PostVisibility;
  readonly commentsEnabled?: boolean;
  readonly hashtags?: readonly string[];
}

// ─── Comentarios ─────────────────────────────────────────────────────────────

/**
 * Un comentario con sus respuestas anidadas.
 *
 * El tipo es recursivo porque el hilo lo es: `replies` trae el nivel siguiente
 * ya resuelto, y `replyCount` dice cuántas hay en total — que puede ser más que
 * las que vinieron.
 */
export interface CommentThreadItem {
  readonly id: string;
  readonly authorProfileId: string;
  readonly bodyText: string;
  readonly parentCommentId?: string;
  readonly threadDepth?: number;
  readonly replyCount?: number;
  readonly createdAt: Date;
  readonly replies: readonly CommentThreadItem[];
}

/** Una página de hilos de comentarios. */
export interface CommentThreadPage {
  readonly items: readonly CommentThreadItem[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

/**
 * Lo que se manda a `POST /community/comments` para comentar, o responder si
 * se pasa `parentCommentId`.
 */
export interface NewComment {
  readonly authorProfileId: string;
  readonly commentableRefId: string;
  readonly bodyText: string;
  readonly parentCommentId?: string;
}

// ─── Reacciones ──────────────────────────────────────────────────────────────

/** Cuántas reacciones de un tipo tiene una publicación. */
export interface ReactionTally {
  readonly reactionTypeConceptId: string;
  /**
   * El código del tipo, el mismo con el que se escribe.
   *
   * Ausente sólo si la fila guarda un concepto que no está en el enum del
   * módulo: en ese caso no se pudo resolver, y la pantalla no debe inventarlo.
   */
  readonly reactionType?: ReactionType;
  readonly count: number;
}

/**
 * El resumen de reacciones de una publicación.
 *
 * `actorReactionTypeConceptId` sólo viene si la llamada declaró un actor: es
 * «con cuál reaccionaste vos», y es lo que permite pintar el botón activo sin
 * una segunda consulta.
 */
export interface ReactionSummary {
  readonly tallies: readonly ReactionTally[];
  readonly total: number;
  readonly actorReactionTypeConceptId?: string;
  /**
   * El código de la reacción propia, resuelto del concepto por el servidor.
   *
   * Es lo que permite pintar activo el botón correcto **después de recargar**,
   * sin resolver terminología en cada render.
   */
  readonly actorReactionType?: ReactionType;
}

// ─── Seguimientos, marcadores y bloqueos ─────────────────────────────────────

/** Un seguimiento. Lo seguido puede ser un perfil, un tema o un grupo. */
export interface FollowListItem {
  readonly id: string;
  readonly followerProfileId: string;
  readonly followableTypeConceptId: string;
  readonly followableRefId: string;
  readonly notificationLevelConceptId?: string;
  readonly createdAt: Date;
}

/** Una página de seguimientos. */
export interface FollowPage {
  readonly items: readonly FollowListItem[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

/** Algo guardado por una persona, opcionalmente dentro de una colección. */
export interface BookmarkListItem {
  readonly id: string;
  readonly bookmarkableTypeConceptId: string;
  readonly bookmarkableRefId: string;
  readonly collectionName?: string;
  readonly createdAt: Date;
}

/** Una página de marcadores. */
export interface BookmarkPage {
  readonly items: readonly BookmarkListItem[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

/** Un bloqueo entre perfiles. */
export interface BlockListItem {
  readonly id: string;
  readonly blockedProfileId: string;
  readonly reasonConceptId?: string;
  readonly createdAt: Date;
}

/** Una página de bloqueos. */
export interface BlockPage {
  readonly items: readonly BlockListItem[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

// ─── Muro y notificaciones ───────────────────────────────────────────────────

/**
 * Una entrada del muro.
 *
 * `post` viene resuelto cuando la entrada es una publicación; para los otros
 * tipos de origen queda ausente y hay que resolverlo por `sourceRefId`.
 * `rankScore` es texto — ver la cabecera de este archivo.
 */
export interface FeedListItem {
  readonly id: string;
  readonly itemTypeConceptId: string;
  readonly sourceTypeConceptId: string;
  readonly sourceRefId: string;
  readonly originConceptId: string;
  readonly rankScore?: string;
  readonly isSeen?: boolean;
  readonly createdAt: Date;
  readonly post?: PostListItem;
}

/** Una página del muro. */
export interface FeedPage {
  readonly items: readonly FeedListItem[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

/** Una notificación social: te comentaron, te mencionaron, te siguieron. */
export interface SocialNotification {
  readonly id: string;
  readonly notificationTypeConceptId: string;
  readonly actorProfileId?: string;
  readonly sourceTypeConceptId: string;
  readonly sourceRefId: string;
  readonly previewText?: string;
  readonly isRead: boolean;
  readonly readAt?: Date;
  readonly createdAt: Date;
}

/**
 * Una página de notificaciones.
 *
 * Trae `unreadCount`, que es el único total del módulo y **no** es el total de
 * la página: es cuántas sin leer tiene la persona en total, y es lo que va en
 * la campana.
 */
export interface NotificationPage {
  readonly items: readonly SocialNotification[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
  readonly unreadCount: number;
}

// ─── Reseñas ─────────────────────────────────────────────────────────────────

/** El puntaje de una dimensión concreta de una reseña. */
export interface ReviewDimensionScore {
  readonly dimensionConceptId: string;
  readonly score: number;
}

/** La respuesta del profesional u organización a una reseña. */
export interface ReviewResponseItem {
  readonly id: string;
  readonly responderPublicProfileId: string;
  readonly responseText: string;
  readonly publishedAt?: Date;
}

/**
 * Una reseña de servicio.
 *
 * `reviewerDisplayModeConceptId` gobierna cómo se muestra a quien la escribió
 * —con nombre, con iniciales o anónima—: es una decisión de quien reseñó, no de
 * la pantalla, y no se puede sobrescribir al pintar.
 */
export interface ServiceReview {
  readonly id: string;
  readonly targetPublicProfileId: string;
  readonly overallRating: number;
  readonly reviewText?: string;
  readonly reviewerDisplayModeConceptId?: string;
  readonly verificationStatusConceptId: string;
  readonly publishedAt?: Date;
  readonly editedAt?: Date;
  readonly dimensionScores: readonly ReviewDimensionScore[];
  readonly responses: readonly ReviewResponseItem[];
}

/** Una página de reseñas. */
export interface ServiceReviewPage {
  readonly items: readonly ServiceReview[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

// ─── Grupos ──────────────────────────────────────────────────────────────────

/** Un grupo tal como aparece en un listado. */
export interface GroupListItem {
  readonly id: string;
  readonly tenantId?: string;
  readonly slug: string;
  readonly name: string;
  readonly description?: string;
  readonly visibilityConceptId: string;
  readonly groupTypeConceptId: string;
  readonly ownerProfileId?: string;
  readonly coverFileId?: string;
  readonly memberCount?: number;
  readonly statusConceptId: string;
}

/** Una página de grupos. */
export interface GroupPage {
  readonly items: readonly GroupListItem[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

/** La pertenencia de un perfil a un grupo. */
export interface GroupMember {
  readonly id: string;
  readonly memberProfileId: string;
  readonly memberRoleConceptId: string;
  readonly joinStatusConceptId: string;
  readonly joinedAt?: Date;
  readonly invitedByProfileId?: string;
}

/** Una página de integrantes de un grupo. */
export interface GroupMemberPage {
  readonly items: readonly GroupMember[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

// ─── Mensajería directa ──────────────────────────────────────────────────────

/** El último mensaje de una conversación, para pintar la lista. */
export interface ConversationPreviewMessage {
  readonly id: string;
  readonly senderProfileId: string;
  readonly bodyText?: string;
  readonly sentAt?: Date;
}

/** Una conversación en la lista de la bandeja. */
export interface ConversationListItem {
  readonly id: string;
  readonly conversationTypeConceptId: string;
  readonly groupId?: string;
  readonly lastMessageAt?: Date;
  readonly messageCount?: number;
  readonly lastMessage?: ConversationPreviewMessage;
  readonly unreadCount: number;
}

/** Una página de conversaciones. */
export interface ConversationPage {
  readonly items: readonly ConversationListItem[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

/** Un mensaje directo. */
export interface DirectMessage {
  readonly id: string;
  readonly conversationId: string;
  readonly senderProfileId: string;
  readonly replyToMessageId?: string;
  readonly contentTypeConceptId: string;
  readonly bodyText?: string;
  readonly attachmentFileId?: string;
  readonly isEdited?: boolean;
  readonly sentAt?: Date;
}

/** Una página de mensajes de una conversación. */
export interface DirectMessagePage {
  readonly items: readonly DirectMessage[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

// ─── Encuestas ───────────────────────────────────────────────────────────────

/** Una opción de encuesta con su conteo de votos. */
export interface PollOptionResult {
  readonly id: string;
  readonly label: string;
  readonly ordinal?: number;
  readonly voteCount: number;
}

/**
 * Una encuesta con sus resultados.
 *
 * `actorVotedOptionIds` sólo viene si la llamada declaró un actor, y puede
 * traer más de una opción cuando `allowsMultiple` es verdadero.
 */
export interface PollDetail {
  readonly id: string;
  readonly postId: string;
  readonly question: string;
  readonly allowsMultiple: boolean;
  readonly closesAt?: Date;
  readonly statusConceptId: string;
  readonly options: readonly PollOptionResult[];
  readonly totalVotes: number;
  readonly actorVotedOptionIds?: readonly string[];
}

// ─── Filtros de las lecturas ─────────────────────────────────────────────────

/**
 * Lo que comparten todas las lecturas paginadas.
 *
 * `cursor` sale del `nextCursor` de la página anterior y no se construye a
 * mano; `limit` es un tope, no un tamaño garantizado.
 */
export interface CursorQuery {
  readonly cursor?: string;
  readonly limit?: number;
}

/**
 * El perfil que mira, cuando la respuesta cambia según quién pregunta.
 *
 * Es opcional en el contrato: sin él la lectura sigue funcionando y devuelve la
 * vista anónima —sin «tu reacción», sin «tu voto»—, que es exactamente lo que
 * necesita la superficie pública.
 */
export interface ActorQuery {
  readonly actorProfileId?: string;
}

/** Filtros de `GET /community/profiles/:profileId/posts`. */
export interface ProfilePostsQuery extends CursorQuery, ActorQuery {}

/** Filtros de `GET /community/posts/:postId/comments`. */
export interface PostCommentsQuery extends CursorQuery, ActorQuery {}

/** Filtros de `GET /community/follows`. `followerProfileId` es obligatorio. */
export interface FollowsQuery extends CursorQuery {
  readonly followerProfileId: string;
}

/** Filtros de `GET /community/bookmarks`. `profileId` es obligatorio. */
export interface BookmarksQuery extends CursorQuery {
  readonly profileId: string;
  readonly collectionName?: string;
}

/** Filtros de `GET /community/blocks`. `profileId` es obligatorio. */
export interface BlocksQuery extends CursorQuery {
  readonly profileId: string;
}

/** Filtros de `GET /community/feed`. `profileId` es obligatorio. */
export interface FeedQuery extends CursorQuery {
  readonly profileId: string;
}

/** Filtros de `GET /community/notifications`. `profileId` es obligatorio. */
export interface NotificationsQuery extends CursorQuery {
  readonly profileId: string;
}

/** Filtros de `GET /community/profiles/:profileId/reviews`. */
export type ReviewsQuery = CursorQuery;

/** Filtros de `GET /community/groups`. `tenantId` es obligatorio. */
export interface GroupsQuery extends CursorQuery {
  readonly tenantId: string;
}

/** Filtros de `GET /community/groups/:groupId/members`. */
export interface GroupMembersQuery extends CursorQuery, ActorQuery {}

/**
 * Filtros de `GET /community/conversations`. `profileId` es obligatorio.
 *
 * **No lleva `cursor`**: el contrato de esta lectura sólo acepta `limit`. La
 * respuesta trae `nextCursor` igual, pero hoy no hay forma de pedir la página
 * siguiente — anotado, no inventado.
 */
export interface ConversationsQuery {
  readonly profileId: string;
  readonly limit?: number;
}

/**
 * Filtros de `GET /community/conversations/:id/messages`.
 *
 * `profileId` es obligatorio y **no es decorativo**: es quién dice ser el que
 * lee, y el backend lo usa para comprobar que participa de la conversación.
 */
export interface ConversationMessagesQuery extends CursorQuery {
  readonly profileId: string;
}

// ─── Reaccionar ──────────────────────────────────────────────────────────────

/** A qué se puede reaccionar. */
export const REACTABLE_TYPES = ['POST', 'COMMENT', 'REVIEW'] as const;

/** El tipo de objeto al que se reacciona. */
export type ReactableType = (typeof REACTABLE_TYPES)[number];

/**
 * Los cinco tipos de reacción del modelo.
 *
 * Son un enum cerrado del contrato y **no** conceptos de terminología —al revés
 * que `reactionTypeConceptId`, que es lo que devuelven las lecturas—. Es una
 * asimetría real del backend: se escribe con la palabra y se lee con el uuid.
 */
export const REACTION_TYPES = [
  'LIKE',
  'LOVE',
  'INSIGHTFUL',
  'CELEBRATE',
  'SUPPORT',
] as const;

/** Una reacción. */
export type ReactionType = (typeof REACTION_TYPES)[number];

/**
 * Lo que hace falta para reaccionar.
 *
 * El backend hace *upsert*: reaccionar dos veces con tipos distintos cambia la
 * reacción, no agrega una segunda. Por eso `actorProfileId` es obligatorio —es
 * la mitad de la clave— y no se toma de la sesión.
 */
/** Lo que se manda a `POST /community/follows` y a su `DELETE`. */
export interface NewFollow {
  readonly followerProfileId: string;
  readonly followableType: 'PROFILE' | 'TOPIC' | 'HASHTAG' | 'GROUP';
  readonly followableRefId: string;
  readonly notificationLevel?: 'ALL' | 'HIGHLIGHTS' | 'NONE';
}

/** Lo que se manda a `POST /community/bookmarks` y a su `DELETE`. */
export interface NewBookmark {
  readonly profileId: string;
  readonly bookmarkableType: 'POST' | 'COMMENT' | 'REVIEW';
  readonly bookmarkableRefId: string;
  readonly collectionName?: string;
}

/** Lo que se manda a `POST /community/blocks` y a su `DELETE`. */
export interface NewBlock {
  readonly blockerProfileId: string;
  readonly blockedProfileId: string;
  readonly reason?: 'HARASSMENT' | 'SPAM' | 'OTHER';
}

/**
 * Lo que contestan los `DELETE` del grafo social.
 *
 * `removed: false` no es un error: dejar de seguir, quitar un marcador y
 * desbloquear son conmutadores, y si el vínculo ya no estaba, el estado final es
 * el que se pedía. Se distingue igual para no anunciar «dejaste de seguir»
 * cuando no seguía.
 */
export interface SocialRemoval {
  readonly removed: boolean;
}

export interface NewReaction {
  readonly actorProfileId: string;
  readonly reactableType: ReactableType;
  readonly reactableRefId: string;
  readonly reactionType: ReactionType;
}

// ─── Moderación (UC-19-08/09/10) ─────────────────────────────────────────────

/** Estados de la cola de moderación, tal como los filtra la pantalla. */
export type ModerationQueueStatus = 'QUEUED' | 'IN_REVIEW' | 'RESOLVED';

/** Prioridades de la cola. */
export type ModerationPriority = 'LOW' | 'NORMAL' | 'HIGH';

/** Tipos de contenido moderable. */
export type ModerableContentType =
  | 'POST'
  | 'COMMENT'
  | 'PROFILE'
  | 'MESSAGE'
  | 'REVIEW';

/** Las cuatro decisiones que un moderador puede tomar. */
export type ModerationDecisionCode =
  | 'REMOVED'
  | 'RESTRICTED'
  | 'WARNED'
  | 'DISMISSED';

/** Estados de una apelación. `OPEN` no es una resolución. */
export type AppealStatus = 'OPEN' | 'UPHELD' | 'OVERTURNED' | 'PARTIAL';

/** Las tres resoluciones posibles de una apelación. */
export type AppealResolution = 'UPHELD' | 'OVERTURNED' | 'PARTIAL';

/** El reporte que originó una entrada de cola, como contexto del moderador. */
export interface QueueReportContext {
  readonly id: string;
  readonly reasonConceptId: string;
  /** Texto libre de quien reportó. Puede mencionar a terceros. */
  readonly detailText?: string;
  readonly createdAt: Date;
}

/** Una entrada de la cola de moderación. */
export interface ModerationQueueItem {
  readonly id: string;
  readonly contentTypeConceptId: string;
  readonly contentRefId: string;
  readonly sourceConceptId: string;
  readonly priorityConceptId?: string;
  readonly statusConceptId: string;
  readonly assignedToUserId?: string;
  readonly queuedAt?: Date;
  /**
   * Cuántos reportes acumula el contenido.
   *
   * La cola deduplica por contenido: sin este número, una entrada reportada por
   * diez personas se ve igual que una reportada por una.
   */
  readonly reportCount: number;
  readonly report?: QueueReportContext;
}

/** Una página de la cola. */
export interface ModerationQueuePage {
  readonly items: readonly ModerationQueueItem[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

/** Una decisión ya tomada. */
export interface ModerationDecisionItem {
  readonly id: string;
  readonly moderationQueueId: string;
  readonly decisionConceptId: string;
  readonly policyConceptId: string;
  readonly rationaleText?: string;
  readonly actionTakenConceptId?: string;
  readonly decidedByUserId: string;
  readonly decidedAt?: Date;
}

/** Una página de decisiones. */
export interface ModerationDecisionPage {
  readonly items: readonly ModerationDecisionItem[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

/** Una apelación, con la decisión que impugna resuelta. */
export interface ModerationAppealItem {
  readonly id: string;
  readonly moderationDecisionId: string;
  readonly appellantProfileId: string;
  readonly reasonText: string;
  readonly statusConceptId: string;
  readonly resolutionConceptId?: string;
  readonly reviewedByUserId?: string;
  readonly resolvedAt?: Date;
  readonly createdAt: Date;
  readonly decision?: ModerationDecisionItem;
}

/** Una página de apelaciones. */
export interface ModerationAppealPage {
  readonly items: readonly ModerationAppealItem[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

/** Filtros de la cola de moderación. */
export interface ModerationQueueQuery {
  readonly status?: readonly ModerationQueueStatus[];
  readonly priority?: readonly ModerationPriority[];
  readonly contentType?: readonly ModerableContentType[];
  /** Antigüedad mínima en horas: «qué lleva más de N horas sin decisión». */
  readonly minAgeHours?: number;
  readonly cursor?: string;
  readonly limit?: number;
}

/** Filtros del historial de decisiones. */
export interface ModerationDecisionsQuery {
  readonly moderationQueueId?: string;
  readonly decision?: readonly ModerationDecisionCode[];
  readonly cursor?: string;
  readonly limit?: number;
}

/** Filtros de las apelaciones. */
export interface ModerationAppealsQuery {
  readonly status?: readonly AppealStatus[];
  readonly appellantProfileId?: string;
  readonly cursor?: string;
  readonly limit?: number;
}

/**
 * Los cinco motivos de reporte del contrato.
 *
 * Son el enum del DTO del servidor, no etiquetas inventadas para la pantalla:
 * cualquier otro valor es un 400.
 */
export const REPORT_REASONS = [
  'SPAM',
  'ABUSE',
  'MISINFORMATION',
  'PHI',
  'OTHER',
] as const;

/** Un motivo de reporte. */
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Lo que se manda a `POST /community/reports`. */
export interface NewReport {
  readonly targetType: ModerableContentType;
  readonly targetId: string;
  readonly reason: ReportReason;
  readonly detailText?: string;
}

/**
 * Lo que se manda a `POST /community/moderation/queue/:id/decision`.
 *
 * `rationaleText` es **obligatorio**: una decisión sin motivo deja al sancionado
 * sin nada que leer cuando apela y al equipo sin nada que auditar.
 */
export interface NewModerationDecision {
  readonly decision: ModerationDecisionCode;
  readonly rationaleText: string;
  readonly subjectProfileId?: string;
  readonly strikeSeverity?: 'LOW' | 'MEDIUM' | 'HIGH';
}

/** Lo que se manda a `POST /community/moderation/decisions/:id/appeal`. */
export interface NewAppeal {
  readonly appellantProfileId: string;
  readonly reasonText: string;
}

/**
 * Lo que se manda a `POST /community/moderation/appeals/:id/resolve`.
 *
 * Sin motivo, y no por olvido: `moderation_appeals` no tiene columna donde
 * guardarlo. Está declarado como bloqueo de esquema en el carril P6.
 */
export interface ResolveAppeal {
  readonly resolution: AppealResolution;
}

/** Lo que se manda a `POST /community/profiles/:id/reviews`. */
export interface NewReview {
  /**
   * La atención que respalda la reseña. **Obligatoria.**
   *
   * El servidor comprueba que sea de quien reseña, con quien se califica, y que
   * esté terminada. Quién reseña **no** viaja en el cuerpo: sale del token.
   */
  readonly verifiedEncounterId: string;
  readonly overallRating: number;
  readonly reviewText?: string;
  readonly displayMode?: 'REAL_NAME' | 'ANONYMOUS';
  readonly dimensions?: readonly {
    readonly dimension:
      | 'COMMUNICATION'
      | 'PUNCTUALITY'
      | 'CLEANLINESS'
      | 'OUTCOME';
    readonly score: number;
  }[];
}

/** Lo que se manda al responder una reseña. */
export interface NewReviewResponse {
  readonly responseText: string;
}
