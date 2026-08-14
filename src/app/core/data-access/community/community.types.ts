/* ============================================================================
    Tipos de la vista para `community` — vitrina pública, publicaciones y
    comentarios. Se mapean desde los DTOs del backend, no son ellos.
    ========================================================================== */

/** La vitrina pública propia, tal como la ve su titular. */
export interface OwnPublicProfile {
  readonly id: string;
  readonly tenantId: string;
  readonly targetId: string;
  readonly slug: string;
  readonly displayName: string;
  readonly headline: string | null;
  readonly biography: string | null;
  readonly acceptsReviews: boolean | null;
  /** Lo otorga la plataforma; se muestra, no se declara. */
  readonly verificationStatusConceptId: string | null;
  readonly statusConceptId: string;
}

/** Lo que se manda para crear o actualizar la vitrina propia. Es un `PUT`. */
export interface UpsertOwnPublicProfile {
  readonly tenantId: string;
  readonly slug: string;
  readonly displayName: string;
  readonly headline?: string;
  readonly biography?: string;
  readonly acceptsReviews?: boolean;
}

/** La ficha pública de un perfil, con sus sellos. Vista de lectura general. */
export interface PublicProfileDetail {
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

/** Un archivo adjunto a una publicación. */
export interface PostMedia {
  readonly id: string;
  readonly fileId: string;
  readonly mediaRoleConceptId: string;
  readonly altText: string | null;
  readonly ordinal: number | null;
}

/**
 * Una publicación — el vehículo de un artículo médico.
 *
 * No existe un tipo «artículo» separado en el backend: un artículo médico es un
 * `post` de la vitrina propia. Lo que lo distingue en pantalla es el hashtag
 * `articulo-medico`, que el cliente agrega siempre al publicar uno; el resto del
 * contrato —cuerpo, adjuntos, comentarios, reacciones— ya está resuelto.
 */
export interface PublicPost {
  readonly id: string;
  readonly authorPublicProfileId: string;
  readonly postTypeConceptId: string;
  readonly bodyText: string;
  readonly visibilityConceptId: string | null;
  readonly commentsEnabled: boolean | null;
  readonly publishedAt: Date | null;
  readonly editedAt: Date | null;
}

export interface PostDetail extends PublicPost {
  readonly media: readonly PostMedia[];
  readonly hashtags: readonly string[];
}

export interface PostPage {
  readonly items: readonly PublicPost[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

/** Lo que se manda para publicar. */
export interface NewPost {
  readonly bodyText: string;
  readonly visibility?: 'PUBLIC' | 'FOLLOWERS' | 'PRIVATE';
  readonly commentsEnabled?: boolean;
  readonly hashtags?: readonly string[];
}

/** Un comentario dentro del hilo de una publicación. */
export interface Comment {
  readonly id: string;
  readonly authorProfileId: string;
  readonly bodyText: string;
  readonly parentCommentId: string | null;
  readonly threadDepth: number | null;
  readonly replyCount: number | null;
  readonly createdAt: Date;
  readonly replies: readonly Comment[];
}

export interface CommentPage {
  readonly items: readonly Comment[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}

/** Lo que se manda para comentar. */
export interface NewComment {
  readonly authorProfileId: string;
  readonly commentableRefId: string;
  readonly bodyText: string;
  readonly parentCommentId?: string;
}

/** Cuántas reacciones de cada tipo tiene una publicación. */
export interface ReactionSummary {
  readonly tallies: readonly { readonly reactionTypeConceptId: string; readonly count: number }[];
  readonly total: number;
  /** El tipo con el que reaccionó quien consulta, o `null` si no reaccionó. */
  readonly actorReactionTypeConceptId: string | null;
}
