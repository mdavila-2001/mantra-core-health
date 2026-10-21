import type { FeedListItem, PostVisibility, ReactionType } from '@core/data-access/community/community.types';
import type { PublicFeedPost, PublicPostSummary } from '@core/data-access/public-directory/public-directory.types';
import type { ResumenDePerfil } from '@core/social/profile-summary.store';
import { inicialesDe } from '@shared/text/iniciales';

/**
 * Una publicación lista para dibujar con `app-public-post-card`, venga de donde
 * venga.
 *
 * El inicio de la red social tiene **dos fuentes** con formas distintas:
 *
 * - **Recientes** (`GET /public/posts`): todo lo público, con el autor adentro
 *   (nombre, titular, foto, `slug`) y las imágenes ya resueltas a URL. No
 *   conoce a quien lee.
 * - **Siguiendo** (`GET /community/feed`): lo de a quién sigue la persona, con
 *   el desglose de reacciones y quién reaccionó. Trae **sólo el id** del autor
 *   y no trae las imágenes.
 *
 * La tarjeta no tiene por qué saber de cuál salió: esta forma es lo único que
 * conoce. Los dos mapeos son funciones puras para poder probarlas sin montar
 * nada.
 */
export interface PostVista {
  readonly post: PublicPostSummary;
  readonly slug: string;
  readonly nombre: string;
  readonly headline: string | null;
  readonly avatar: string | null;
  readonly iniciales: string;
  /** El id de perfil del autor, si la fuente lo trae (el feed público no). */
  readonly perfilId: string | null;
  /** `null` = no se sabe: no se dibuja ícono de visibilidad (no se inventa 🌐). */
  readonly visibilidad: PostVisibility | null;
  /** El desglose por tipo, si la fuente lo trae. */
  readonly reaccionesPorTipo: Readonly<Partial<Record<ReactionType, number>>> | null;
}

/** Una publicación del feed público: ya trae todo lo que la tarjeta necesita. */
export function deRecientes(post: PublicFeedPost): PostVista {
  return {
    post,
    slug: post.authorSlug,
    nombre: post.authorDisplayName,
    headline: post.authorHeadline,
    avatar: post.authorAvatarUrl,
    iniciales: inicialesDe(post.authorDisplayName),
    perfilId: null,
    // El feed público sólo sirve publicaciones públicas.
    visibilidad: 'PUBLIC',
    reaccionesPorTipo: null,
  };
}

/** Cómo se arma la URL de una imagen de publicación a partir de su `fileId`. */
export function urlDeImagenDePublicacion(fileId: string): string {
  return `/public/media/${fileId}`;
}

/**
 * Una entrada del feed personal.
 *
 * @param entrada - La fila del feed.
 * @param autor - Quién es el autor (resuelto aparte: el feed sólo trae su id), o
 *   `undefined`/`null` mientras no se sabe. Sin él la tarjeta se dibuja igual,
 *   con un nombre provisional, y se completa cuando llega.
 * @param imagenes - Los `fileId` de sus imágenes si ya se leyó el detalle.
 * @returns La vista, o `null` si la entrada no trae publicación resuelta (una
 *   tarjeta vacía es peor que una entrada que no está).
 */
export function deSiguiendo(
  entrada: FeedListItem,
  autor: ResumenDePerfil | null | undefined,
  imagenes: readonly string[] | undefined,
): PostVista | null {
  const p = entrada.post;
  if (p === undefined) return null;

  const desglose: Partial<Record<ReactionType, number>> = {};
  for (const t of p.reactions.tallies) {
    if (t.reactionType !== undefined) desglose[t.reactionType] = t.count;
  }

  return {
    post: {
      id: p.id,
      bodyText: p.bodyText,
      publishedAt: p.publishedAt ?? entrada.createdAt,
      mediaUrls: (imagenes ?? []).map(urlDeImagenDePublicacion),
      reactionCount: p.reactions.total,
      commentCount: p.commentCount,
    },
    slug: autor?.slug ?? '',
    nombre: autor?.displayName ?? '…',
    headline: autor?.headline ?? null,
    avatar: autor?.avatarUrl ?? null,
    iniciales: autor === null || autor === undefined ? '' : inicialesDe(autor.displayName),
    perfilId: p.authorPublicProfileId,
    // La lectura trae la visibilidad como concept id y el cliente no la traduce.
    visibilidad: null,
    reaccionesPorTipo: Object.keys(desglose).length > 0 ? desglose : null,
  };
}
