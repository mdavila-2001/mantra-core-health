import {
  comentarios,
  CONCEPTO,
  conversaciones,
  encuestaDePublicacion,
  grupos,
  mensajes,
  miembrosDeGrupo,
  muroDeGrupo,
  publicaciones,
  resenas,
  SOPORTE_ID,
  TEMAS,
  TIPO_VITRINA,
  VITRINA_MEDICA,
  vitrinaDe,
  vitrinaPorSlug,
  vitrinas,
  type ComentarioSimulado,
  type MensajeSimulado,
  type PublicacionSimulada,
  type VitrinaSimulada,
} from '../fixtures/comunidad';
import { ESTADO } from '../fixtures/conceptos';
import { conflict, forbidden, notFound, validation, type MockRequest, type MockRouter } from '../mock-router';
// La ventana de edición es una sola regla: la maqueta la aplica con la misma
// constante que la pantalla, para que no puedan separarse.
import { VENTANA_DE_EDICION_MS } from '../../messaging/chat.store';
import { ahora, contiene, cuerpo, iso, nuevoId, paginar, texto, uuid } from '../mock-store';

/* ============================================================================
    Red social con sesión: vitrina propia, perfiles, publicaciones,
    comentarios, reacciones, seguimientos, muro, notificaciones sociales,
    reseñas, grupos, temas, mensajería y moderación.
    ========================================================================== */

type Reaccion = 'LIKE' | 'LOVE' | 'INSIGHTFUL' | 'CELEBRATE' | 'SUPPORT';

const seguimientos = new Map<string, Set<string>>();
const marcadores = new Map<string, Set<string>>();
const bloqueos = new Map<string, Set<string>>();

function conjunto(mapa: Map<string, Set<string>>, clave: string): Set<string> {
  let s = mapa.get(clave);
  if (s === undefined) {
    s = new Set();
    mapa.set(clave, s);
  }
  return s;
}

// La médica sigue a algunos colegas y la paciente a su médica.
for (const v of vitrinas.todos().slice(1, 6)) conjunto(seguimientos, VITRINA_MEDICA.id).add(v.id);
conjunto(seguimientos, vitrinaDe(uuid('pid-paciente'))?.id ?? '').add(VITRINA_MEDICA.id);
conjunto(seguimientos, vitrinaDe(uuid('pid-paciente'))?.id ?? '').add(vitrinas.todos()[1]!.id);
conjunto(marcadores, vitrinaDe(uuid('pid-paciente'))?.id ?? '').add(publicaciones.todos()[0]!.id);
conjunto(marcadores, vitrinaDe(uuid('pid-paciente'))?.id ?? '').add(publicaciones.todos()[6]!.id);

/**
 * `true` si quien usa la maqueta encendió la respuesta automática.
 *
 * Se lee del mismo lugar donde la guarda la pantalla. Es la única manera de
 * que la maqueta pueda demostrar la regla: hace falta que **alguien escriba**
 * para que se dispare, y en una maqueta de una sola sesión no hay nadie del
 * otro lado. Fuera de la maqueta esto no existe: el mensaje entrante lo manda
 * una persona de verdad.
 */
function respuestaAutomaticaEncendida(): boolean {
  try {
    const crudo = globalThis.localStorage?.getItem('alovida.chat-respuesta-automatica');
    return crudo !== null && crudo !== undefined && JSON.parse(crudo).activa === true;
  } catch {
    return false;
  }
}

function vitrinaDeSesion(request: MockRequest): VitrinaSimulada | undefined {
  const user = request.user;
  if (user === null) return undefined;
  return vitrinaDe(user.practitionerProfileId ?? user.patientProfileId ?? user.id) ?? vitrinaDe(user.id);
}

function perfilPublico(v: VitrinaSimulada) {
  return {
    id: v.id,
    tenantId: v.tenantId,
    targetTypeConceptId: TIPO_VITRINA[v.kind],
    // La vertical en claro, además del concepto. `targetTypeConceptId` es un
    // uuid de terminología que el cliente no puede interpretar sin su tabla, y
    // sin esto el panel de contacto del chat no sabe si la ficha tiene URL
    // pública (`/p`, `/o`…) o es la de un paciente, que no la tiene. Pedido a
    // la API real; hasta entonces llega `undefined` y el panel degrada.
    kind: v.kind,
    slug: v.slug,
    displayName: v.displayName,
    headline: v.headline,
    biography: v.biography,
    avatarFileId: v.avatarFileId,
    coverFileId: v.coverFileId,
    verificationStatusConceptId: v.verified ? ESTADO['ST-VERIFIED']! : ESTADO['ST-UNVERIFIED']!,
    acceptsReviews: v.acceptsReviews,
    statusConceptId: ESTADO['ST-ACTIVE']!,
    badges: v.verified ? [{ id: uuid(`badge-${v.id}`), badgeTypeConceptId: CONCEPTO.badgeVerified, verificationMethodConceptId: CONCEPTO.badgeMethod, validFrom: iso(-300), validTo: null }] : [],
    prestige: v.kind === 'PRACTITIONER' ? { totalPoints: String(120 + v.seguidores * 3), levelConceptId: CONCEPTO.prestigeLevel, rankPosition: 1 + (v.seguidores % 40), calculatedAt: iso(-1) } : null,
  };
}

function vitrinaPropia(v: VitrinaSimulada) {
  return {
    id: v.id,
    tenantId: v.tenantId,
    targetId: v.targetId,
    slug: v.slug,
    displayName: v.displayName,
    headline: v.headline,
    biography: v.biography,
    acceptsReviews: v.acceptsReviews,
    visibility: v.visibility,
    avatarFileId: v.avatarFileId,
    coverFileId: v.coverFileId,
    verificationStatusConceptId: v.verified ? ESTADO['ST-VERIFIED']! : ESTADO['ST-UNVERIFIED']!,
    statusConceptId: ESTADO['ST-ACTIVE']!,
  };
}

function resumenDeReacciones(p: PublicacionSimulada, actor: string | null) {
  const tallies = (Object.entries(p.reacciones) as [Reaccion, number][])
    .filter(([, count]) => count > 0)
    .map(([reactionType, count]) => ({ reactionTypeConceptId: CONCEPTO.reaction[reactionType], reactionType, count }));
  const propia = actor === null ? undefined : p.reaccionDelActor[actor];
  return {
    tallies,
    total: tallies.reduce((s, t) => s + t.count, 0),
    actorReactionTypeConceptId: propia === undefined ? null : CONCEPTO.reaction[propia],
    actorReactionType: propia ?? null,
  };
}

function publicacion(p: PublicacionSimulada, actor: string | null) {
  return {
    id: p.id,
    authorPublicProfileId: p.authorPublicProfileId,
    postTypeConceptId: p.postTypeConceptId,
    bodyText: p.bodyText,
    visibilityConceptId: p.visibilityConceptId,
    commentsEnabled: p.commentsEnabled,
    publishedAt: p.publishedAt,
    editedAt: p.editedAt,
    reactions: resumenDeReacciones(p, actor),
    commentCount: comentarios.filtrar((c) => c.postId === p.id).length,
  };
}

function detalleDePublicacion(p: PublicacionSimulada, actor: string | null) {
  return {
    ...publicacion(p, actor),
    media: p.mediaUrls.map((_url, i) => ({ id: uuid(`media-${p.id}-${i}`), fileId: uuid(`file-media-${p.id}-${i}`), mediaRoleConceptId: CONCEPTO.mediaImage, altText: 'Imagen de la publicación', ordinal: i + 1 })),
    hashtags: p.hashtags.map((tag) => ({ id: uuid(`hashtag-${p.id}-${tag}`), tag })),
    mentions: [],
  };
}

function hiloDeComentarios(postId: string) {
  const todos = comentarios.filtrar((c) => c.postId === postId);
  const armar = (c: ComentarioSimulado): unknown => ({
    id: c.id,
    authorProfileId: c.authorProfileId,
    bodyText: c.bodyText,
    parentCommentId: c.parentCommentId,
    threadDepth: c.parentCommentId === null ? 0 : 1,
    replyCount: todos.filter((r) => r.parentCommentId === c.id).length,
    createdAt: c.createdAt,
    replies: todos.filter((r) => r.parentCommentId === c.id).map(armar),
    media: c.mediaUrl === undefined ? [] : [{ id: uuid(`cmedia-${c.id}`), fileId: uuid(`cfile-${c.id}`), mediaRoleConceptId: CONCEPTO.mediaImage, altText: 'Imagen del comentario', ordinal: 1 }],
  });
  return todos.filter((c) => c.parentCommentId === null).map(armar);
}

function conversacion(c: { id: string; conversationTypeConceptId: string; groupId: string | null; participantes: readonly string[]; noLeidosPor: Record<string, number> }, yo: string) {
  const delHilo = mensajes.filtrar((m) => m.conversationId === c.id).sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  const ultimo = delHilo.at(-1);
  return {
    id: c.id,
    conversationTypeConceptId: c.conversationTypeConceptId,
    groupId: c.groupId,
    lastMessageAt: ultimo?.sentAt ?? null,
    messageCount: delHilo.length,
    lastMessage: ultimo === undefined ? null : { id: ultimo.id, senderProfileId: ultimo.senderProfileId, bodyText: ultimo.bodyText, attachmentFileId: ultimo.attachmentFileId, sentAt: ultimo.sentAt },
    unreadCount: c.noLeidosPor[yo] ?? 0,
    peers: c.participantes
      .filter((p) => p !== yo)
      .map((p) => {
        if (p === SOPORTE_ID) return { profileId: p, displayName: 'Soporte AloVida', avatarUrl: null };
        const v = vitrinas.get(p);
        return { profileId: p, displayName: v?.displayName ?? 'Participante', avatarUrl: v?.avatarUrl ?? null };
      }),
  };
}

export function registrarComunidad(router: MockRouter): void {
  /* ---- vitrina propia ------------------------------------------------------ */

  router.get('/community/profiles/me', (request) => {
    const v = vitrinaDeSesion(request);
    return v === undefined ? null : vitrinaPropia(v);
  });

  router.put('/community/profiles/me', (request) => {
    const datos = cuerpo<{ tenantId: string; slug: string; displayName: string; headline?: string; biography?: string; acceptsReviews?: boolean; visibility?: 'PUBLIC' | 'PRIVATE'; avatarFileId?: string | null; coverFileId?: string | null }>(request);
    const existente = vitrinaDeSesion(request);
    const user = request.user;
    if (user === null) return forbidden();
    const base: VitrinaSimulada = existente ?? {
      id: nuevoId('public-profile'),
      tenantId: datos.tenantId ?? user.tenants[0] ?? '',
      targetId: user.practitionerProfileId ?? user.patientProfileId ?? user.id,
      kind: user.practitionerProfileId !== undefined ? 'PRACTITIONER' : 'PATIENT',
      slug: datos.slug ?? user.key,
      displayName: datos.displayName ?? user.displayName,
      headline: '',
      biography: '',
      avatarUrl: '',
      coverUrl: '',
      avatarFileId: '',
      coverFileId: '',
      verified: false,
      acceptsReviews: false,
      visibility: 'PUBLIC',
      city: 'Santa Cruz de la Sierra',
      address: '',
      lat: -17.78,
      lng: -63.18,
      specialties: [],
      ratingAverage: null,
      ratingCount: 0,
      hasPublishedAgenda: false,
      seguidores: 0,
    };
    const actualizada: VitrinaSimulada = {
      ...base,
      slug: datos.slug ?? base.slug,
      displayName: datos.displayName ?? base.displayName,
      headline: datos.headline ?? base.headline,
      biography: datos.biography ?? base.biography,
      acceptsReviews: datos.acceptsReviews ?? base.acceptsReviews,
      visibility: datos.visibility ?? base.visibility,
      avatarFileId: datos.avatarFileId === null ? '' : (datos.avatarFileId ?? base.avatarFileId),
      coverFileId: datos.coverFileId === null ? '' : (datos.coverFileId ?? base.coverFileId),
    };
    vitrinas.agregar(actualizada);
    return vitrinaPropia(actualizada);
  });

  router.get('/community/profiles/by-slug/:slug', ({ params }) => {
    const v = vitrinaPorSlug(params['slug']!);
    return v === undefined ? notFound('Perfil no encontrado') : perfilPublico(v);
  });

  router.get('/community/profiles/:id', ({ params }) => {
    const v = vitrinas.get(params['id']!) ?? vitrinaDe(params['id']!);
    return v === undefined ? notFound('Perfil no encontrado') : perfilPublico(v);
  });

  /* ---- publicaciones -------------------------------------------------------- */

  router.get('/community/profiles/:id/posts', ({ params, query }) => {
    const actor = texto(query, 'actorProfileId');
    const todas = publicaciones
      .filtrar((p) => p.authorPublicProfileId === params['id'])
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .map((p) => publicacion(p, actor));
    return paginar(todas, query, 10);
  });

  router.post('/community/profiles/:id/posts', (request) => {
    const datos = cuerpo<{ bodyText: string; visibility?: string; commentsEnabled?: boolean; hashtags?: string[] }>(request);
    const nueva: PublicacionSimulada = {
      id: nuevoId('post'),
      authorPublicProfileId: request.params['id']!,
      postTypeConceptId: (datos.hashtags ?? []).includes('articulomedico') ? CONCEPTO.postArticle : CONCEPTO.postText,
      bodyText: datos.bodyText ?? '',
      visibilityConceptId: datos.visibility === 'FOLLOWERS' ? CONCEPTO.visibilityFollowers : CONCEPTO.visibilityPublic,
      commentsEnabled: datos.commentsEnabled ?? true,
      publishedAt: ahora(),
      editedAt: null,
      mediaUrls: [],
      hashtags: datos.hashtags ?? [],
      reacciones: { LIKE: 0, LOVE: 0, INSIGHTFUL: 0, CELEBRATE: 0, SUPPORT: 0 },
      reaccionDelActor: {},
    };
    publicaciones.agregar(nueva);
    return { status: 201, body: { id: nueva.id } };
  });

  router.get('/community/posts/:id', ({ params, query }) => {
    const p = publicaciones.get(params['id']!);
    return p === undefined ? notFound('Publicación no encontrada') : detalleDePublicacion(p, texto(query, 'actorProfileId'));
  });

  router.get('/community/posts/:id/comments', ({ params, query }) => paginar(hiloDeComentarios(params['id']!), query, 20));

  router.get('/community/posts/:id/reactions', ({ params, query }) => {
    const p = publicaciones.get(params['id']!);
    return p === undefined ? notFound() : resumenDeReacciones(p, texto(query, 'actorProfileId'));
  });

  router.post('/community/reactions', (request) => {
    const datos = cuerpo<{ actorProfileId: string; reactableType: string; reactableRefId: string; reactionType: Reaccion }>(request);
    const p = publicaciones.get(datos.reactableRefId ?? '');
    if (p !== undefined && datos.actorProfileId !== undefined && datos.reactionType !== undefined) {
      const previa = p.reaccionDelActor[datos.actorProfileId];
      const reacciones = { ...p.reacciones };
      if (previa !== undefined) reacciones[previa] = Math.max(0, reacciones[previa] - 1);
      const reaccionDelActor = { ...p.reaccionDelActor };
      if (previa === datos.reactionType) {
        delete reaccionDelActor[datos.actorProfileId];
      } else {
        reacciones[datos.reactionType] += 1;
        reaccionDelActor[datos.actorProfileId] = datos.reactionType;
      }
      publicaciones.actualizar(p.id, { reacciones, reaccionDelActor });
    }
    return { status: 201, body: { id: nuevoId('reaction') } };
  });

  router.post('/community/comments', (request) => {
    const datos = cuerpo<{ authorProfileId: string; commentableRefId: string; bodyText: string; parentCommentId?: string; media?: { fileId: string }[] }>(request);
    const nuevo = comentarios.agregar({
      id: nuevoId('comment'),
      postId: datos.commentableRefId ?? '',
      authorProfileId: datos.authorProfileId ?? '',
      bodyText: datos.bodyText ?? '',
      parentCommentId: datos.parentCommentId ?? null,
      createdAt: ahora(),
      ...(datos.media?.[0] === undefined ? {} : { mediaUrl: `mock-file:${datos.media[0].fileId}` }),
    });
    return { status: 201, body: { id: nuevo.id } };
  });

  router.get('/community/comments/media/:id/content', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="#fef3c7"/><text x="160" y="135" font-size="64" text-anchor="middle">🙌</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  });

  /* ---- seguir, guardar, bloquear ------------------------------------------- */

  router.post('/community/follows', (request) => {
    const datos = cuerpo<{ followerProfileId: string; followableRefId: string }>(request);
    conjunto(seguimientos, datos.followerProfileId ?? '').add(datos.followableRefId ?? '');
    return { status: 201, body: { id: nuevoId('follow') } };
  });
  router.delete('/community/follows', (request) => {
    const datos = cuerpo<{ followerProfileId: string; followableRefId: string }>(request);
    const removed = conjunto(seguimientos, datos.followerProfileId ?? '').delete(datos.followableRefId ?? '');
    return { removed };
  });
  router.get('/community/follows', ({ query }) => {
    const follower = texto(query, 'followerProfileId') ?? '';
    const items = [...conjunto(seguimientos, follower)].map((ref, i) => ({ id: uuid(`follow-${follower}-${ref}`), followerProfileId: follower, followableTypeConceptId: CONCEPTO.followProfile, followableRefId: ref, notificationLevelConceptId: null, createdAt: iso(-30 - i) }));
    return paginar(items, query, 20);
  });

  router.post('/community/bookmarks', (request) => {
    const datos = cuerpo<{ profileId: string; bookmarkableRefId: string }>(request);
    conjunto(marcadores, datos.profileId ?? '').add(datos.bookmarkableRefId ?? '');
    return { status: 201, body: { id: nuevoId('bookmark') } };
  });
  router.delete('/community/bookmarks', (request) => {
    const datos = cuerpo<{ profileId: string; bookmarkableRefId: string }>(request);
    return { removed: conjunto(marcadores, datos.profileId ?? '').delete(datos.bookmarkableRefId ?? '') };
  });
  router.get('/community/bookmarks', ({ query }) => {
    const profileId = texto(query, 'profileId') ?? '';
    const items = [...conjunto(marcadores, profileId)].map((ref, i) => ({ id: uuid(`bookmark-${profileId}-${ref}`), bookmarkableTypeConceptId: CONCEPTO.bookmarkPost, bookmarkableRefId: ref, collectionName: 'Guardados', createdAt: iso(-10 - i) }));
    return paginar(items, query, 20);
  });

  router.post('/community/blocks', (request) => {
    const datos = cuerpo<{ blockerProfileId: string; blockedProfileId: string }>(request);
    conjunto(bloqueos, datos.blockerProfileId ?? '').add(datos.blockedProfileId ?? '');
    return { status: 201, body: { id: nuevoId('block') } };
  });
  router.delete('/community/blocks', (request) => {
    const datos = cuerpo<{ blockerProfileId: string; blockedProfileId: string }>(request);
    return { removed: conjunto(bloqueos, datos.blockerProfileId ?? '').delete(datos.blockedProfileId ?? '') };
  });
  router.get('/community/blocks', ({ query }) => {
    const profileId = texto(query, 'profileId') ?? '';
    const items = [...conjunto(bloqueos, profileId)].map((ref, i) => ({ id: uuid(`block-${profileId}-${ref}`), blockedProfileId: ref, reasonConceptId: null, createdAt: iso(-5 - i) }));
    return paginar(items, query, 20);
  });

  /* ---- muro y notificaciones sociales -------------------------------------- */

  router.get('/community/feed', ({ query }) => {
    const profileId = texto(query, 'profileId') ?? '';
    const seguidos = conjunto(seguimientos, profileId);
    const items = publicaciones
      .todos()
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .map((p) => ({
        id: uuid(`feed-${profileId}-${p.id}`),
        itemTypeConceptId: CONCEPTO.feedPost,
        sourceTypeConceptId: CONCEPTO.sourcePost,
        sourceRefId: p.id,
        originConceptId: seguidos.has(p.authorPublicProfileId) ? CONCEPTO.feedOriginFollow : CONCEPTO.feedOriginRecommended,
        rankScore: String((100 - publicaciones.todos().indexOf(p)).toFixed(2)),
        isSeen: false,
        createdAt: p.publishedAt,
        post: publicacion(p, profileId),
      }));
    return paginar(items, query, 10);
  });

  router.get('/community/notifications', ({ query }) => {
    const profileId = texto(query, 'profileId') ?? '';
    const propias = publicaciones.filtrar((p) => p.authorPublicProfileId === profileId).slice(0, 3);
    const items = [
      ...propias.flatMap((p, i) => [
        { id: uuid(`snotif-r-${p.id}`), notificationTypeConceptId: CONCEPTO.notifReaction, actorProfileId: vitrinas.todos()[(i + 1) % 5]!.id, sourceTypeConceptId: CONCEPTO.sourcePost, sourceRefId: p.id, previewText: `Le gustó tu publicación «${p.bodyText.slice(0, 40)}…»`, isRead: i > 0, readAt: i > 0 ? iso(-i) : null, createdAt: iso(-i, 8) },
        { id: uuid(`snotif-c-${p.id}`), notificationTypeConceptId: CONCEPTO.notifComment, actorProfileId: vitrinas.todos()[(i + 2) % 5]!.id, sourceTypeConceptId: CONCEPTO.sourceComment, sourceRefId: p.id, previewText: 'Comentó: «Excelente explicación, gracias por compartir.»', isRead: i > 1, readAt: i > 1 ? iso(-i) : null, createdAt: iso(-i, 12) },
      ]),
      { id: uuid(`snotif-f-${profileId}`), notificationTypeConceptId: CONCEPTO.notifFollow, actorProfileId: vitrinas.todos()[3]!.id, sourceTypeConceptId: CONCEPTO.sourcePost, sourceRefId: profileId, previewText: 'Empezó a seguirte', isRead: false, readAt: null, createdAt: iso(-1, 19) },
    ];
    return { ...paginar(items, query, 20), unreadCount: items.filter((n) => !n.isRead).length };
  });

  /* ---- reseñas -------------------------------------------------------------- */

  router.get('/community/profiles/:id/reviews', ({ params, query }) => {
    const items = resenas
      .filtrar((r) => r.targetPublicProfileId === params['id'])
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .map(({ reviewerProfileId: _r, ...resto }) => ({ ...resto, editedAt: null }));
    return paginar(items, query, 10);
  });

  router.post('/community/profiles/:id/reviews', (request) => {
    const datos = cuerpo<{ verifiedEncounterId: string; overallRating: number; reviewText?: string; displayMode?: string; dimensions?: { dimension: keyof typeof CONCEPTO.reviewDim; score: number }[] }>(request);
    const actor = vitrinaDeSesion(request);
    if (resenas.filtrar((r) => r.targetPublicProfileId === request.params['id'] && r.reviewerProfileId === actor?.id && r.id.startsWith('n')).length > 0) {
      return conflict('Ya publicaste una reseña de esta atención');
    }
    const nueva = resenas.agregar({
      id: nuevoId('review'),
      targetPublicProfileId: request.params['id']!,
      reviewerProfileId: actor?.id ?? '',
      overallRating: datos.overallRating ?? 5,
      reviewText: datos.reviewText ?? '',
      reviewerDisplayModeConceptId: datos.displayMode === 'ANONYMOUS' ? CONCEPTO.reviewDisplayAnon : CONCEPTO.reviewDisplayReal,
      verificationStatusConceptId: ESTADO['ST-VERIFIED']!,
      publishedAt: ahora(),
      dimensionScores: (datos.dimensions ?? []).map((d) => ({ dimensionConceptId: CONCEPTO.reviewDim[d.dimension] ?? CONCEPTO.reviewDim.OUTCOME, score: d.score })),
      responses: [],
    });
    return { status: 201, body: { id: nueva.id, overallRating: nueva.overallRating, verified: true, dimensionCount: nueva.dimensionScores.length } };
  });

  router.post('/community/profiles/:id/reviews/:reviewId/responses', (request) => {
    const r = resenas.get(request.params['reviewId']!);
    if (r === undefined) return notFound('Reseña no encontrada');
    const datos = cuerpo<{ responseText: string }>(request);
    const respuesta = { id: nuevoId('review-response'), responderPublicProfileId: request.params['id']!, responseText: datos.responseText ?? '', publishedAt: ahora() };
    resenas.actualizar(r.id, { responses: [...r.responses, respuesta] });
    return { status: 201, body: respuesta };
  });

  /* ---- grupos y temas ------------------------------------------------------- */

  router.get('/community/topics', () => ({ items: TEMAS, count: TEMAS.length, limit: 50 }));

  router.get('/community/groups', ({ query }) => {
    const q = texto(query, 'q');
    const topicId = texto(query, 'topicId');
    const items = grupos
      .todos()
      .filter((g) => contiene(g.name, q) || contiene(g.description, q))
      .filter((g) => topicId === null || g.topicId === topicId)
      .map(({ postCount: _p, pendingCount: _q, ...g }) => g);
    return paginar(items, query, 20);
  });

  router.post('/community/groups', (request) => {
    const datos = cuerpo<{ slug: string; name: string; description?: string; visibility?: string; groupType?: string; topicId?: string; ownerProfileId?: string }>(request);
    const owner = datos.ownerProfileId ?? vitrinaDeSesion(request)?.id ?? VITRINA_MEDICA.id;
    const nuevo = grupos.agregar({
      id: nuevoId('group'),
      tenantId: request.user?.tenants[0] ?? '',
      slug: datos.slug ?? 'grupo-nuevo',
      name: datos.name ?? 'Grupo nuevo',
      description: datos.description ?? '',
      visibilityConceptId: datos.visibility === 'PRIVATE' || datos.visibility === 'SECRET' ? CONCEPTO.groupPrivate : CONCEPTO.groupPublic,
      groupTypeConceptId: datos.groupType === 'SUPPORT' ? CONCEPTO.groupSupport : CONCEPTO.groupGeneral,
      ...(datos.topicId === undefined ? {} : { topicId: datos.topicId }),
      ownerProfileId: owner,
      coverFileId: '',
      memberCount: 1,
      postCount: 0,
      pendingCount: 0,
      statusConceptId: ESTADO['ST-ACTIVE']!,
    });
    miembrosDeGrupo.agregar({ id: nuevoId('member'), groupId: nuevo.id, memberProfileId: owner, memberRoleConceptId: CONCEPTO.memberRole.ADMIN, joinStatusConceptId: CONCEPTO.joinStatus.ACTIVE, joinedAt: ahora(), invitedByProfileId: null });
    return { status: 201, body: { id: nuevo.id } };
  });

  router.get('/community/groups/:id', ({ params, query }) => {
    const g = grupos.get(params['id']!);
    if (g === undefined) return notFound('Grupo no encontrado');
    const actor = texto(query, 'actorProfileId');
    const membresia = actor === null ? undefined : miembrosDeGrupo.filtrar((m) => m.groupId === g.id && m.memberProfileId === actor)[0];
    const activa = membresia?.joinStatusConceptId === CONCEPTO.joinStatus.ACTIVE;
    const admin = activa && membresia?.memberRoleConceptId !== CONCEPTO.memberRole.MEMBER;
    return {
      ...g,
      viewer: {
        isMember: activa,
        canAdminister: admin,
        canPost: activa,
        membershipId: membresia?.id ?? null,
        memberRoleConceptId: membresia?.memberRoleConceptId ?? null,
        joinStatusConceptId: membresia?.joinStatusConceptId ?? null,
      },
    };
  });

  router.get('/community/groups/:id/members', ({ params, query }) => {
    const estado = texto(query, 'joinStatus');
    const items = miembrosDeGrupo
      .filtrar((m) => m.groupId === params['id'])
      .filter((m) => estado === null || m.joinStatusConceptId === CONCEPTO.joinStatus[estado as keyof typeof CONCEPTO.joinStatus])
      .map(({ groupId: _g, ...m }) => m);
    return paginar(items, query, 20);
  });

  router.post('/community/groups/:id/members', (request) => {
    const g = grupos.get(request.params['id']!);
    if (g === undefined) return notFound();
    const datos = cuerpo<{ memberProfileId?: string; actorProfileId?: string }>(request);
    const perfil = datos.memberProfileId ?? datos.actorProfileId ?? vitrinaDeSesion(request)?.id ?? '';
    const privado = g.visibilityConceptId === CONCEPTO.groupPrivate;
    const nuevo = miembrosDeGrupo.agregar({ id: nuevoId('member'), groupId: g.id, memberProfileId: perfil, memberRoleConceptId: CONCEPTO.memberRole.MEMBER, joinStatusConceptId: privado ? CONCEPTO.joinStatus.PENDING : CONCEPTO.joinStatus.ACTIVE, joinedAt: privado ? null : ahora(), invitedByProfileId: null });
    grupos.actualizar(g.id, privado ? { pendingCount: g.pendingCount + 1 } : { memberCount: g.memberCount + 1 });
    return { status: 201, body: { id: nuevo.id, memberRoleConceptId: nuevo.memberRoleConceptId, joinStatusConceptId: nuevo.joinStatusConceptId } };
  });

  router.delete('/community/groups/:id/members/:memberId', ({ params }) => {
    const m = miembrosDeGrupo.get(params['memberId']!);
    if (m !== undefined) miembrosDeGrupo.actualizar(m.id, { joinStatusConceptId: CONCEPTO.joinStatus.LEFT });
    return { removed: m !== undefined };
  });

  router.patch('/community/groups/:id/members/:memberId', (request) => {
    const m = miembrosDeGrupo.get(request.params['memberId']!);
    if (m === undefined) return notFound();
    const datos = cuerpo<{ role?: 'MEMBER' | 'MODERATOR' | 'ADMIN'; decision?: 'APPROVE' | 'REJECT' }>(request);
    const actualizado = miembrosDeGrupo.actualizar(m.id, {
      ...(datos.role === undefined ? {} : { memberRoleConceptId: CONCEPTO.memberRole[datos.role] }),
      ...(datos.decision === undefined ? {} : { joinStatusConceptId: datos.decision === 'APPROVE' ? CONCEPTO.joinStatus.ACTIVE : CONCEPTO.joinStatus.REJECTED, joinedAt: datos.decision === 'APPROVE' ? ahora() : null }),
    })!;
    return { id: actualizado.id, memberRoleConceptId: actualizado.memberRoleConceptId, joinStatusConceptId: actualizado.joinStatusConceptId };
  });

  router.get('/community/groups/:id/posts', ({ params, query }) => {
    const todos = muroDeGrupo.filtrar((m) => m.groupId === params['id']);
    const armar = (m: (typeof todos)[number]): unknown => ({
      id: m.id,
      authorProfileId: m.authorProfileId,
      bodyText: m.bodyText,
      parentCommentId: m.parentCommentId,
      threadDepth: m.parentCommentId === null ? 0 : 1,
      replyCount: todos.filter((r) => r.parentCommentId === m.id).length,
      createdAt: m.createdAt,
      replies: todos.filter((r) => r.parentCommentId === m.id).map(armar),
    });
    return paginar(todos.filter((m) => m.parentCommentId === null).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(armar), query, 20);
  });

  router.post('/community/groups/:id/posts', (request) => {
    const datos = cuerpo<{ authorProfileId: string; bodyText: string; parentCommentId?: string }>(request);
    const nuevo = muroDeGrupo.agregar({ id: nuevoId('wall'), groupId: request.params['id']!, authorProfileId: datos.authorProfileId ?? '', bodyText: datos.bodyText ?? '', parentCommentId: datos.parentCommentId ?? null, createdAt: ahora() });
    return { status: 201, body: { id: nuevo.id } };
  });

  /* ---- mensajería ----------------------------------------------------------- */

  router.get('/community/conversations', ({ query }) => {
    const yo = texto(query, 'profileId') ?? '';
    const items = conversaciones
      .filtrar((c) => c.participantes.includes(yo))
      .map((c) => conversacion(c, yo))
      .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
    return { items, count: items.length, limit: Number(query.get('limit') ?? 20) || 20, nextCursor: null };
  });

  router.post('/community/conversations', (request) => {
    const datos = cuerpo<{ participantProfileIds: string[]; conversationType?: string; groupId?: string }>(request);
    const participantes = [...new Set([...(datos.participantProfileIds ?? []), vitrinaDeSesion(request)?.id ?? ''])].filter((p) => p !== '');
    const existente = conversaciones.filtrar((c) => c.participantes.length === participantes.length && participantes.every((p) => c.participantes.includes(p)))[0];
    if (existente !== undefined) return { status: 201, body: { id: existente.id } };
    const nueva = conversaciones.agregar({ id: nuevoId('conv'), conversationTypeConceptId: datos.conversationType === 'GROUP' ? CONCEPTO.conversationGroup : CONCEPTO.conversationDirect, groupId: datos.groupId ?? null, participantes, noLeidosPor: {} });
    return { status: 201, body: { id: nueva.id } };
  });

  router.get('/community/conversations/:id/messages', ({ params, query }) => {
    const items = mensajes
      .filtrar((m) => m.conversationId === params['id'])
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    const pagina = paginar(items, query, 30);
    return { ...pagina, peerReadUpTo: items.length > 1 ? items[1]!.sentAt : null };
  });

  router.post('/community/conversations/:id/messages', (request) => {
    const c = conversaciones.get(request.params['id']!);
    if (c === undefined) return notFound('Conversación no encontrada');
    const datos = cuerpo<{
      senderProfileId: string;
      bodyText: string;
      replyToMessageId?: string;
      contentType?: 'TEXT' | 'MEDIA';
      attachmentFileId?: string;
    }>(request);
    const nuevo: MensajeSimulado = {
      id: nuevoId('msg'),
      conversationId: c.id,
      senderProfileId: datos.senderProfileId ?? '',
      replyToMessageId: datos.replyToMessageId ?? null,
      // El adjunto se conserva: la maqueta descartaba `contentType` y
      // `attachmentFileId`, así que mandar una foto se veía como un mensaje de
      // texto vacío. El contrato real los acepta desde siempre.
      contentTypeConceptId:
        datos.contentType === 'MEDIA' ? CONCEPTO.messageMedia : CONCEPTO.messageText,
      bodyText: datos.bodyText ?? '',
      attachmentFileId: datos.attachmentFileId ?? null,
      isEdited: false,
      sentAt: ahora(),
    };
    mensajes.agregar(nuevo);
    const noLeidos = { ...c.noLeidosPor };
    for (const p of c.participantes) if (p !== nuevo.senderProfileId) noLeidos[p] = (noLeidos[p] ?? 0) + 1;
    conversaciones.actualizar(c.id, { noLeidosPor: noLeidos });
    // Soporte responde solo, para que el chat se sienta vivo.
    if (c.participantes.includes(SOPORTE_ID) && nuevo.senderProfileId !== SOPORTE_ID) {
      setTimeout(() => {
        mensajes.agregar({ ...nuevo, id: nuevoId('msg-soporte'), senderProfileId: SOPORTE_ID, bodyText: 'Gracias por escribirnos. Un agente va a responderte en breve.', sentAt: ahora() });
      }, 1500);
    }
    // El otro lado también contesta, para poder ver la respuesta automática
    // sin dos navegadores: en la maqueta no hay nadie del otro lado que
    // escriba, y sin un mensaje entrante la regla no se dispara nunca. Sólo
    // con la respuesta automática encendida, y una sola vez por mensaje.
    else if (respuestaAutomaticaEncendida()) {
      const otro = c.participantes.find((p) => p !== nuevo.senderProfileId);
      if (otro !== undefined) {
        setTimeout(() => {
          mensajes.agregar({
            ...nuevo,
            id: nuevoId('msg-eco'),
            senderProfileId: otro,
            bodyText: 'Hola, ¿estás por ahí?',
            attachmentFileId: null,
            contentTypeConceptId: CONCEPTO.messageText,
            sentAt: ahora(),
          });
        }, 2000);
      }
    }
    return { status: 201, body: { id: nuevo.id, conversationId: c.id, sentAt: nuevo.sentAt } };
  });

  /**
   * Editar un mensaje propio, con la ventana de cinco minutos (F4.5).
   *
   * La ventana se comprueba **acá y no sólo en la pantalla**: ocultar el botón
   * no es la regla, es la comodidad. Fuera de la ventana responde 422, que es
   * lo que responde la API del proyecto ante una precondición incumplida.
   */
  router.patch('/community/conversations/:id/messages/:messageId', (request) => {
    const m = mensajes.get(request.params['messageId']!);
    if (m === undefined || m.conversationId !== request.params['id']) {
      return notFound('Mensaje no encontrado');
    }
    const datos = cuerpo<{ senderProfileId?: string; bodyText?: string }>(request);
    const yo = datos.senderProfileId ?? vitrinaDeSesion(request)?.id ?? '';
    if (m.senderProfileId !== yo) {
      return validation('Sólo el autor puede editar su mensaje');
    }
    const texto = (datos.bodyText ?? '').trim();
    if (texto === '') {
      return validation('El mensaje no puede quedar vacío');
    }
    if (Date.now() - new Date(m.sentAt).getTime() > VENTANA_DE_EDICION_MS) {
      return validation('Pasaron más de 5 minutos: el mensaje ya no se puede editar');
    }
    return mensajes.actualizar(m.id, { bodyText: texto, isEdited: true });
  });

  router.post('/community/conversations/:id/read', (request) => {
    const c = conversaciones.get(request.params['id']!);
    if (c === undefined) return notFound();
    const datos = cuerpo<{ profileId?: string; readerProfileId?: string }>(request);
    const yo = datos.profileId ?? datos.readerProfileId ?? vitrinaDeSesion(request)?.id ?? '';
    conversaciones.actualizar(c.id, { noLeidosPor: { ...c.noLeidosPor, [yo]: 0 } });
    const ultimo = mensajes.filtrar((m) => m.conversationId === c.id).sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0];
    return { receiptsRecorded: 1, lastReadMessageId: ultimo?.id ?? null };
  });

  router.get('/community/polls/:id', ({ params, query }) => {
    if (params['id'] !== encuestaDePublicacion.id) return notFound('Encuesta no encontrada');
    const actor = texto(query, 'actorProfileId');
    return { ...encuestaDePublicacion, actorVotedOptionIds: actor === null ? [] : [] };
  });

  /* ---- moderación ------------------------------------------------------------ */

  const cola = [
    { id: uuid('mod-q-1'), contentTypeConceptId: CONCEPTO.moderation.contentPost, contentRefId: publicaciones.todos()[4]!.id, sourceConceptId: CONCEPTO.moderation.sourceReport, priorityConceptId: CONCEPTO.moderation.priorityHigh, statusConceptId: CONCEPTO.moderation.queued, assignedToUserId: null, queuedAt: iso(-1, 10), reportCount: 3, report: { id: uuid('report-1'), reasonConceptId: CONCEPTO.moderation.reasonMisinfo, detailText: 'Afirma que el protector solar causa deficiencia de vitamina D sin evidencia.', createdAt: iso(-1, 9) } },
    { id: uuid('mod-q-2'), contentTypeConceptId: CONCEPTO.moderation.contentComment, contentRefId: comentarios.todos()[3]!.id, sourceConceptId: CONCEPTO.moderation.sourceAuto, priorityConceptId: CONCEPTO.moderation.priorityNormal, statusConceptId: CONCEPTO.moderation.inReview, assignedToUserId: uuid('user-admin'), queuedAt: iso(-3, 15), reportCount: 1, report: { id: uuid('report-2'), reasonConceptId: CONCEPTO.moderation.reasonSpam, detailText: 'Enlace repetido a una tienda externa.', createdAt: iso(-3, 14) } },
    { id: uuid('mod-q-3'), contentTypeConceptId: CONCEPTO.moderation.contentReview, contentRefId: resenas.todos()[3]!.id, sourceConceptId: CONCEPTO.moderation.sourceReport, priorityConceptId: CONCEPTO.moderation.priorityHigh, statusConceptId: CONCEPTO.moderation.resolved, assignedToUserId: uuid('user-admin'), queuedAt: iso(-10, 11), reportCount: 2, report: { id: uuid('report-3'), reasonConceptId: CONCEPTO.moderation.reasonPhi, detailText: 'La reseña menciona el diagnóstico de otra persona.', createdAt: iso(-10, 10) } },
  ];
  const decisiones = [
    { id: uuid('mod-d-1'), moderationQueueId: uuid('mod-q-3'), decisionConceptId: CONCEPTO.moderation.decisionRemoved, policyConceptId: CONCEPTO.moderation.policy, rationaleText: 'Expone información clínica de un tercero.', actionTakenConceptId: CONCEPTO.moderation.actionHide, decidedByUserId: uuid('user-admin'), decidedAt: iso(-9, 9) },
  ];
  const apelaciones = [
    { id: uuid('mod-a-1'), moderationDecisionId: uuid('mod-d-1'), appellantProfileId: vitrinas.todos()[4]!.id, reasonText: 'No menciono a nadie por su nombre; hablo de mi propia experiencia.', statusConceptId: CONCEPTO.moderation.appealOpen, resolutionConceptId: null, reviewedByUserId: null, resolvedAt: null, createdAt: iso(-8, 16), decision: decisiones[0]! },
  ];

  router.get('/community/moderation/queue', ({ query }) => paginar(cola, query, 20));
  router.get('/community/moderation/decisions', ({ query }) => {
    const queueId = texto(query, 'moderationQueueId');
    return paginar(decisiones.filter((d) => queueId === null || d.moderationQueueId === queueId), query, 20);
  });
  router.get('/community/moderation/appeals', ({ query }) => paginar(apelaciones, query, 20));

  router.post('/community/reports', () => ({ status: 201, body: { id: nuevoId('report'), queued: true } }));

  router.post('/community/moderation/queue/:id/decision', (request) => {
    const datos = cuerpo<{ decision: string; rationaleText: string }>(request);
    const item = cola.find((q) => q.id === request.params['id']);
    if (item !== undefined) (item as { statusConceptId: string }).statusConceptId = CONCEPTO.moderation.resolved;
    const nueva = { id: nuevoId('mod-d'), moderationQueueId: request.params['id']!, decisionConceptId: datos.decision === 'REMOVED' ? CONCEPTO.moderation.decisionRemoved : datos.decision === 'WARNED' ? CONCEPTO.moderation.decisionWarned : CONCEPTO.moderation.decisionDismissed, policyConceptId: CONCEPTO.moderation.policy, rationaleText: datos.rationaleText ?? '', actionTakenConceptId: CONCEPTO.moderation.actionHide, decidedByUserId: request.user?.id ?? '', decidedAt: ahora() };
    decisiones.push(nueva);
    return { status: 201, body: { id: nueva.id, strikeId: datos.decision === 'REMOVED' ? nuevoId('strike') : null, decision: datos.decision ?? 'DISMISSED' } };
  });

  router.post('/community/moderation/decisions/:id/appeal', (request) => {
    const datos = cuerpo<{ appellantProfileId: string; reasonText: string }>(request);
    const decision = decisiones.find((d) => d.id === request.params['id']);
    const nueva = { id: nuevoId('mod-a'), moderationDecisionId: request.params['id']!, appellantProfileId: datos.appellantProfileId ?? '', reasonText: datos.reasonText ?? '', statusConceptId: CONCEPTO.moderation.appealOpen, resolutionConceptId: null, reviewedByUserId: null, resolvedAt: null, createdAt: ahora(), decision: decision ?? decisiones[0]! };
    apelaciones.push(nueva);
    return { status: 201, body: { id: nueva.id } };
  });

  router.post('/community/moderation/appeals/:id/resolve', (request) => {
    const datos = cuerpo<{ resolution: 'UPHELD' | 'OVERTURNED' | 'PARTIAL' }>(request);
    const a = apelaciones.find((x) => x.id === request.params['id']);
    if (a === undefined) return notFound();
    const mutable = a as { statusConceptId: string; resolutionConceptId: string | null; reviewedByUserId: string | null; resolvedAt: string | null };
    mutable.statusConceptId = datos.resolution === 'OVERTURNED' ? CONCEPTO.moderation.appealOverturned : CONCEPTO.moderation.appealUpheld;
    mutable.resolutionConceptId = mutable.statusConceptId;
    mutable.reviewedByUserId = request.user?.id ?? '';
    mutable.resolvedAt = ahora();
    return { id: a.id, resolution: datos.resolution ?? 'UPHELD' };
  });
}
