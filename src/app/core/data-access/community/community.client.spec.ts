import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { CommunityClient } from './community.client';
import type {
  CommentThreadPage,
  ConversationPage,
  DirectMessagePage,
  FeedPage,
  GroupDetail,
  GroupWallPage,
  NotificationPage,
  PollDetail,
  PostDetail,
  PublicProfileDetail,
  ReactionSummary,
  ServiceReviewPage,
} from './community.types';

/**
 * Lo que estas pruebas fijan, y por qué cada una existe.
 *
 * No comprueban «que el cliente llame a la URL»: comprueban las dos cosas que
 * ya rompieron pantallas en este repo —**opcionales que viajan como clave
 * declarada** y **`null` que se cuela como si fuera un valor**— y una tercera
 * que sólo aparece en este módulo: el hilo de comentarios es recursivo.
 *
 * Los cuerpos de respuesta se escriben **con la forma que el servidor manda de
 * verdad** (fechas en texto, opcionales en `null`), no con la forma que declara
 * el tipo de la vista. Fabricarlos ya convertidos haría que la prueba pase
 * mientras la conversión está rota, que es exactamente el defecto que `wire.ts`
 * documenta.
 */
describe('CommunityClient', () => {
  let client: CommunityClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(CommunityClient);
    http = TestBed.inject(HttpTestingController);
  });

  it('descarga el adjunto por conversación y perfil, no por common/files', async () => {
    const result = firstValueFrom(
      client.conversationAttachmentDataUrl('conv-1', 'profile-1', 'file-1'),
    );
    const req = http.expectOne(
      (request) =>
        request.url ===
        '/community/conversations/conv-1/attachments/file-1/content',
    );
    expect(req.request.params.get('profileId')).toBe('profile-1');
    expect(req.request.responseType).toBe('blob');
    req.flush(new Blob(['contenido'], { type: 'text/plain' }));

    await expect(result).resolves.toMatch(/^data:text\/plain;base64,/);
    http.expectNone((request) => request.url.includes('/common/files/'));
  });

  afterEach(() => http.verify());

  const paginaVacia = { items: [], count: 0, limit: 20, nextCursor: null };

  // ─── Los opcionales no viajan si no vinieron ───────────────────────────────

  /**
   * El backend valida con `forbidNonWhitelisted`: un opcional presente en
   * `undefined` viaja como clave declarada y la petición vuelve con 400. Es el
   * defecto más fácil de introducir y el más difícil de ver en una captura.
   */
  it('listProfilePosts no manda cursor, limit ni actor cuando no vinieron', () => {
    client.listProfilePosts('p-1').subscribe();

    const req = http.expectOne((r) => r.url === '/community/profiles/p-1/posts');
    expect(req.request.params.has('cursor')).toBe(false);
    expect(req.request.params.has('limit')).toBe(false);
    expect(req.request.params.has('actorProfileId')).toBe(false);

    req.flush(paginaVacia);
  });

  it('listProfilePosts manda los tres cuando vinieron', () => {
    client
      .listProfilePosts('p-1', { cursor: 'c-9', limit: 5, actorProfileId: 'a-1' })
      .subscribe();

    const req = http.expectOne((r) => r.url === '/community/profiles/p-1/posts');
    expect(req.request.params.get('cursor')).toBe('c-9');
    expect(req.request.params.get('limit')).toBe('5');
    expect(req.request.params.get('actorProfileId')).toBe('a-1');

    req.flush(paginaVacia);
  });

  /**
   * La superficie pública es esta llamada **sin actor**. Que el id de sesión no
   * se agregue solo es lo que permite que un visitante sin cuenta lea lo mismo
   * que un usuario, sin que la lectura quede identificada sin que nadie lo
   * pidiera.
   */
  it('readPost sin actor no identifica a nadie', () => {
    client.readPost('post-1').subscribe();

    const req = http.expectOne((r) => r.url === '/community/posts/post-1');
    expect(req.request.params.has('actorProfileId')).toBe(false);

    req.flush({
      id: 'post-1',
      authorPublicProfileId: 'p-1',
      postTypeConceptId: 'c-tipo',
      bodyText: 'hola',
      visibilityConceptId: null,
      commentsEnabled: null,
      publishedAt: null,
      editedAt: null,
      media: [],
      hashtags: [],
      mentions: [],
    });
  });

  it('los identificadores con caracteres raros van escapados en la URL', () => {
    client.readProfile('a/b?c').subscribe();

    const req = http.expectOne((r) => r.url === '/community/profiles/a%2Fb%3Fc');
    req.flush({
      id: 'a/b?c',
      tenantId: 't-1',
      targetTypeConceptId: 'c-1',
      slug: 's',
      displayName: 'X',
      headline: null,
      biography: null,
      avatarFileId: null,
      coverFileId: null,
      verificationStatusConceptId: null,
      acceptsReviews: null,
      statusConceptId: 'c-2',
      badges: [],
      prestige: null,
    });
  });

  // ─── El `null` no se cuela ─────────────────────────────────────────────────

  /**
   * `campo !== undefined` es **`true`** cuando el campo vale `null`. Una ficha
   * de perfil que trate así a `biography` pinta una biografía vacía en vez de
   * omitir la sección.
   */
  it('readProfile elimina las claves que llegaron en null', () => {
    let perfil: PublicProfileDetail | undefined;
    client.readProfile('p-1').subscribe((p) => (perfil = p));

    http.expectOne((r) => r.url === '/community/profiles/p-1').flush({
      id: 'p-1',
      tenantId: 't-1',
      targetTypeConceptId: 'c-tipo',
      slug: 'marisol-quispe',
      displayName: 'Marisol Quispe',
      headline: null,
      biography: null,
      avatarFileId: 'f-1',
      coverFileId: null,
      verificationStatusConceptId: null,
      acceptsReviews: true,
      statusConceptId: 'c-activo',
      badges: [],
      prestige: null,
    });

    expect(perfil).toBeDefined();
    expect('headline' in perfil!).toBe(false);
    expect('biography' in perfil!).toBe(false);
    expect('prestige' in perfil!).toBe(false);
    expect(perfil!.avatarFileId).toBe('f-1');
    expect(perfil!.acceptsReviews).toBe(true);
  });

  /**
   * `new Date(null)` es **1970-01-01**, no `Invalid Date`. Una publicación sin
   * fecha de edición se mostraría como editada en 1970.
   */
  it('readPost convierte las fechas y omite las que no vinieron', () => {
    let post: PostDetail | undefined;
    client.readPost('post-1').subscribe((p) => (post = p));

    http.expectOne((r) => r.url === '/community/posts/post-1').flush({
      id: 'post-1',
      authorPublicProfileId: 'p-1',
      postTypeConceptId: 'c-tipo',
      bodyText: 'hola',
      visibilityConceptId: 'c-publica',
      commentsEnabled: true,
      publishedAt: '2026-08-13T10:00:00.000Z',
      editedAt: null,
      media: [{ id: 'm-1', fileId: 'f-1', mediaRoleConceptId: 'c-img', altText: null, ordinal: 0 }],
      hashtags: [{ id: 'h-1', tag: 'cardiologia' }],
      mentions: [],
    });

    expect(post!.publishedAt).toEqual(new Date('2026-08-13T10:00:00.000Z'));
    expect('editedAt' in post!).toBe(false);
    expect(post!.media[0]!.fileId).toBe('f-1');
    expect('altText' in post!.media[0]!).toBe(false);
    expect(post!.hashtags[0]!.tag).toBe('cardiologia');
  });

  it('listFeed convierte createdAt y la publicación embebida', () => {
    let feed: FeedPage | undefined;
    client.listFeed({ profileId: 'p-1' }).subscribe((f) => (feed = f));

    http.expectOne((r) => r.url === '/community/feed').flush({
      items: [
        {
          id: 'f-1',
          itemTypeConceptId: 'c-post',
          sourceTypeConceptId: 'c-social',
          sourceRefId: 'post-1',
          originConceptId: 'c-seguido',
          rankScore: '1234.5678',
          isSeen: false,
          createdAt: '2026-08-13T11:00:00.000Z',
          post: {
            id: 'post-1',
            authorPublicProfileId: 'p-2',
            postTypeConceptId: 'c-tipo',
            bodyText: 'texto',
            visibilityConceptId: null,
            commentsEnabled: null,
            publishedAt: '2026-08-13T10:00:00.000Z',
            editedAt: null,
          },
        },
        {
          id: 'f-2',
          itemTypeConceptId: 'c-otro',
          sourceTypeConceptId: 'c-otro',
          sourceRefId: 'x-1',
          originConceptId: 'c-sugerido',
          rankScore: null,
          isSeen: null,
          createdAt: '2026-08-13T09:00:00.000Z',
          post: null,
        },
      ],
      count: 2,
      limit: 20,
      nextCursor: 'c-siguiente',
    });

    expect(feed!.items[0]!.createdAt).toEqual(new Date('2026-08-13T11:00:00.000Z'));
    expect(feed!.items[0]!.post!.publishedAt).toEqual(new Date('2026-08-13T10:00:00.000Z'));
    // El puntaje se conserva como texto: es numérico de precisión arbitraria en
    // el modelo y pasarlo a `number` lo redondearía en silencio.
    expect(feed!.items[0]!.rankScore).toBe('1234.5678');
    expect('post' in feed!.items[1]!).toBe(false);
    expect('rankScore' in feed!.items[1]!).toBe(false);
    expect(feed!.nextCursor).toBe('c-siguiente');
  });

  // ─── El hilo es recursivo ──────────────────────────────────────────────────

  /**
   * Las respuestas vienen anidadas y sin tope conocido. Si la conversión sólo
   * tocara el primer nivel, un comentario de segundo nivel llegaría con
   * `createdAt` en texto y la plantilla lo pintaría como `[object String]` o
   * peor: lo ordenaría alfabéticamente.
   */
  it('listComments convierte las fechas en TODOS los niveles del hilo', () => {
    let hilos: CommentThreadPage | undefined;
    client.listComments('post-1').subscribe((h) => (hilos = h));

    http.expectOne((r) => r.url === '/community/posts/post-1/comments').flush({
      items: [
        {
          id: 'c-1',
          authorProfileId: 'p-1',
          bodyText: 'raíz',
          parentCommentId: null,
          threadDepth: 0,
          replyCount: 1,
          createdAt: '2026-08-13T10:00:00.000Z',
          replies: [
            {
              id: 'c-2',
              authorProfileId: 'p-2',
              bodyText: 'respuesta',
              parentCommentId: 'c-1',
              threadDepth: 1,
              replyCount: 1,
              createdAt: '2026-08-13T10:05:00.000Z',
              replies: [
                {
                  id: 'c-3',
                  authorProfileId: 'p-3',
                  bodyText: 'respuesta de la respuesta',
                  parentCommentId: 'c-2',
                  threadDepth: 2,
                  replyCount: 0,
                  createdAt: '2026-08-13T10:10:00.000Z',
                  replies: [],
                },
              ],
            },
          ],
        },
      ],
      count: 1,
      limit: 20,
      nextCursor: null,
    });

    const raiz = hilos!.items[0]!;
    const segundo = raiz.replies[0]!;
    const tercero = segundo.replies[0]!;

    expect(raiz.createdAt).toEqual(new Date('2026-08-13T10:00:00.000Z'));
    expect(segundo.createdAt).toEqual(new Date('2026-08-13T10:05:00.000Z'));
    expect(tercero.createdAt).toEqual(new Date('2026-08-13T10:10:00.000Z'));
    expect('parentCommentId' in raiz).toBe(false);
    expect(segundo.parentCommentId).toBe('c-1');
  });

  // ─── Lo propio de cada lectura ─────────────────────────────────────────────

  it('readReactions omite la reacción propia cuando no hay actor', () => {
    let resumen: ReactionSummary | undefined;
    client.readReactions('post-1').subscribe((r) => (resumen = r));

    http.expectOne((r) => r.url === '/community/posts/post-1/reactions').flush({
      tallies: [{ reactionTypeConceptId: 'c-util', count: 3 }],
      total: 3,
      actorReactionTypeConceptId: null,
    });

    expect(resumen!.total).toBe(3);
    expect('actorReactionTypeConceptId' in resumen!).toBe(false);
  });

  it('listNotifications conserva unreadCount, que no es el total de la página', () => {
    let bandeja: NotificationPage | undefined;
    client.listNotifications({ profileId: 'p-1' }).subscribe((b) => (bandeja = b));

    const req = http.expectOne((r) => r.url === '/community/notifications');
    expect(req.request.params.get('profileId')).toBe('p-1');

    req.flush({
      items: [
        {
          id: 'n-1',
          notificationTypeConceptId: 'c-comento',
          actorProfileId: 'p-2',
          sourceTypeConceptId: 'c-post',
          sourceRefId: 'post-1',
          previewText: null,
          isRead: false,
          readAt: null,
          createdAt: '2026-08-13T12:00:00.000Z',
        },
      ],
      count: 1,
      limit: 20,
      nextCursor: null,
      unreadCount: 47,
    });

    expect(bandeja!.count).toBe(1);
    expect(bandeja!.unreadCount).toBe(47);
    expect(bandeja!.items[0]!.isRead).toBe(false);
    expect('readAt' in bandeja!.items[0]!).toBe(false);
  });

  /**
   * `isRead: false` es un booleano legítimo, no una ausencia. Si la conversión
   * lo tratara como los opcionales, desaparecería la clave y la campana no
   * podría distinguir «leída» de «no vino el dato».
   */
  it('listNotifications conserva isRead aunque sea false', () => {
    let bandeja: NotificationPage | undefined;
    client.listNotifications({ profileId: 'p-1' }).subscribe((b) => (bandeja = b));

    http.expectOne((r) => r.url === '/community/notifications').flush({
      items: [
        {
          id: 'n-1',
          notificationTypeConceptId: 'c-1',
          actorProfileId: null,
          sourceTypeConceptId: 'c-2',
          sourceRefId: 'x',
          previewText: null,
          isRead: false,
          readAt: null,
          createdAt: '2026-08-13T12:00:00.000Z',
        },
      ],
      count: 1,
      limit: 20,
      nextCursor: null,
      unreadCount: 1,
    });

    expect('isRead' in bandeja!.items[0]!).toBe(true);
    expect(bandeja!.items[0]!.isRead).toBe(false);
  });

  it('listConversations no manda cursor: el contrato no lo acepta', () => {
    let bandeja: ConversationPage | undefined;
    client.listConversations({ profileId: 'p-1', limit: 10 }).subscribe((b) => (bandeja = b));

    const req = http.expectOne((r) => r.url === '/community/conversations');
    expect(req.request.params.get('profileId')).toBe('p-1');
    expect(req.request.params.get('limit')).toBe('10');
    expect(req.request.params.has('cursor')).toBe(false);

    req.flush({
      items: [
        {
          id: 'conv-1',
          conversationTypeConceptId: 'c-directa',
          groupId: null,
          lastMessageAt: '2026-08-13T13:00:00.000Z',
          messageCount: 4,
          unreadCount: 0,
          lastMessage: {
            id: 'm-9',
            senderProfileId: 'p-2',
            bodyText: 'nos vemos',
            sentAt: '2026-08-13T13:00:00.000Z',
          },
        },
      ],
      count: 1,
      limit: 10,
      nextCursor: null,
    });

    expect(bandeja!.items[0]!.lastMessageAt).toEqual(new Date('2026-08-13T13:00:00.000Z'));
    expect(bandeja!.items[0]!.lastMessage!.sentAt).toEqual(
      new Date('2026-08-13T13:00:00.000Z'),
    );
    expect('groupId' in bandeja!.items[0]!).toBe(false);
    // Cero no leídos es un dato, no una ausencia.
    expect(bandeja!.items[0]!.unreadCount).toBe(0);
  });

  it('listMessages exige profileId: es quién dice ser el que lee', () => {
    client.listMessages('conv-1', { profileId: 'p-1', cursor: 'c-2' }).subscribe();

    const req = http.expectOne((r) => r.url === '/community/conversations/conv-1/messages');
    expect(req.request.params.get('profileId')).toBe('p-1');
    expect(req.request.params.get('cursor')).toBe('c-2');

    req.flush(paginaVacia);
  });

  it('AG-20: un mensaje borrado trae deletedAt como Date, y uno vivo no trae la clave', () => {
    let pagina: DirectMessagePage | undefined;
    client.listMessages('conv-1', { profileId: 'p-1' }).subscribe((p) => (pagina = p));

    http.expectOne((r) => r.url === '/community/conversations/conv-1/messages').flush({
      items: [
        {
          id: 'm-1',
          conversationId: 'conv-1',
          senderProfileId: 'p-1',
          contentTypeConceptId: 'c-text',
          bodyText: null,
          attachmentFileId: null,
          isEdited: false,
          sentAt: '2026-08-13T13:00:00.000Z',
          deletedAt: '2026-08-13T13:05:00.000Z',
        },
        {
          id: 'm-2',
          conversationId: 'conv-1',
          senderProfileId: 'p-1',
          contentTypeConceptId: 'c-text',
          bodyText: 'sigue vivo',
          attachmentFileId: null,
          isEdited: false,
          sentAt: '2026-08-13T13:01:00.000Z',
          deletedAt: null,
        },
      ],
      count: 2,
      limit: 20,
      nextCursor: null,
    });

    const [borrado, vivo] = pagina!.items;
    expect(borrado!.deletedAt).toEqual(new Date('2026-08-13T13:05:00.000Z'));
    expect('deletedAt' in vivo!).toBe(false);
  });

  it('listReviews conserva las dimensiones y las respuestas', () => {
    let resenas: ServiceReviewPage | undefined;
    client.listReviews('p-1').subscribe((r) => (resenas = r));

    http.expectOne((r) => r.url === '/community/profiles/p-1/reviews').flush({
      items: [
        {
          id: 'r-1',
          targetPublicProfileId: 'p-1',
          overallRating: 5,
          reviewText: 'excelente',
          reviewerDisplayModeConceptId: 'c-anonima',
          verificationStatusConceptId: 'c-verificada',
          publishedAt: '2026-08-10T08:00:00.000Z',
          editedAt: null,
          dimensionScores: [{ dimensionConceptId: 'c-trato', score: 5 }],
          responses: [
            {
              id: 'resp-1',
              responderPublicProfileId: 'p-1',
              responseText: 'gracias',
              publishedAt: null,
            },
          ],
        },
      ],
      count: 1,
      limit: 20,
      nextCursor: null,
    });

    const resena = resenas!.items[0]!;
    expect(resena.publishedAt).toEqual(new Date('2026-08-10T08:00:00.000Z'));
    expect('editedAt' in resena).toBe(false);
    expect(resena.dimensionScores[0]!.score).toBe(5);
    expect('publishedAt' in resena.responses[0]!).toBe(false);
  });

  it('readPoll trae los votos propios sólo si hubo actor', () => {
    let encuesta: PollDetail | undefined;
    client.readPoll('poll-1', { actorProfileId: 'a-1' }).subscribe((p) => (encuesta = p));

    const req = http.expectOne((r) => r.url === '/community/polls/poll-1');
    expect(req.request.params.get('actorProfileId')).toBe('a-1');

    req.flush({
      id: 'poll-1',
      postId: 'post-1',
      question: '¿Cuál preferís?',
      allowsMultiple: false,
      closesAt: null,
      statusConceptId: 'c-abierta',
      options: [{ id: 'o-1', label: 'A', ordinal: 0, voteCount: 7 }],
      totalVotes: 7,
      actorVotedOptionIds: ['o-1'],
    });

    expect('closesAt' in encuesta!).toBe(false);
    expect(encuesta!.options[0]!.voteCount).toBe(7);
    expect(encuesta!.actorVotedOptionIds).toEqual(['o-1']);
  });

  it('listFollows y listBlocks exigen su perfil y convierten createdAt', () => {
    client.listFollows({ followerProfileId: 'p-1' }).subscribe();
    const follows = http.expectOne((r) => r.url === '/community/follows');
    expect(follows.request.params.get('followerProfileId')).toBe('p-1');
    follows.flush(paginaVacia);

    client.listBlocks({ profileId: 'p-1' }).subscribe();
    const blocks = http.expectOne((r) => r.url === '/community/blocks');
    expect(blocks.request.params.get('profileId')).toBe('p-1');
    blocks.flush(paginaVacia);
  });

  it('listBookmarks manda collectionName sólo cuando se filtra', () => {
    client.listBookmarks({ profileId: 'p-1' }).subscribe();
    const sinFiltro = http.expectOne((r) => r.url === '/community/bookmarks');
    expect(sinFiltro.request.params.has('collectionName')).toBe(false);
    sinFiltro.flush(paginaVacia);

    client.listBookmarks({ profileId: 'p-1', collectionName: 'leer luego' }).subscribe();
    const conFiltro = http.expectOne((r) => r.url === '/community/bookmarks');
    expect(conFiltro.request.params.get('collectionName')).toBe('leer luego');
    conFiltro.flush(paginaVacia);
  });

  it('listGroups exige tenantId y listGroupMembers acepta actor', () => {
    client.listGroups({ tenantId: 't-1' }).subscribe();
    const grupos = http.expectOne((r) => r.url === '/community/groups');
    expect(grupos.request.params.get('tenantId')).toBe('t-1');
    grupos.flush(paginaVacia);

    client.listGroupMembers('g-1', { actorProfileId: 'a-1' }).subscribe();
    const miembros = http.expectOne((r) => r.url === '/community/groups/g-1/members');
    expect(miembros.request.params.get('actorProfileId')).toBe('a-1');
    miembros.flush(paginaVacia);
  });

  /**
   * Las tres caras inversas van por query, no por el id de la fila: la pantalla
   * sabe a quién dejó de seguir, no el uuid del vínculo.
   */
  it('unfollow, unbookmark y unblock identifican el vínculo por query', () => {
    client
      .unfollow({
        followerProfileId: 'p-1',
        followableType: 'PROFILE',
        followableRefId: 'p-2',
      })
      .subscribe();
    const unfollow = http.expectOne((r) => r.url === '/community/follows');
    expect(unfollow.request.method).toBe('DELETE');
    expect(unfollow.request.params.get('followerProfileId')).toBe('p-1');
    expect(unfollow.request.params.get('followableType')).toBe('PROFILE');
    expect(unfollow.request.params.get('followableRefId')).toBe('p-2');
    unfollow.flush({ removed: true });

    client
      .unbookmark({
        profileId: 'p-1',
        bookmarkableType: 'POST',
        bookmarkableRefId: 'post-1',
      })
      .subscribe();
    const unbookmark = http.expectOne((r) => r.url === '/community/bookmarks');
    expect(unbookmark.request.method).toBe('DELETE');
    // Sin colección declarada no se manda el parámetro: mandarlo vacío acotaría
    // el borrado a «la colección llamada cadena vacía».
    expect(unbookmark.request.params.has('collectionName')).toBe(false);
    unbookmark.flush({ removed: false });

    client
      .unblock({ blockerProfileId: 'p-1', blockedProfileId: 'p-2' })
      .subscribe();
    const unblock = http.expectOne((r) => r.url === '/community/blocks');
    expect(unblock.request.method).toBe('DELETE');
    expect(unblock.request.params.get('blockedProfileId')).toBe('p-2');
    unblock.flush({ removed: true });
  });

  it('follow, bookmark y block mandan el cuerpo tal cual', () => {
    client
      .follow({
        followerProfileId: 'p-1',
        followableType: 'PROFILE',
        followableRefId: 'p-2',
      })
      .subscribe();
    const follow = http.expectOne(
      (r) => r.url === '/community/follows' && r.method === 'POST',
    );
    expect(follow.request.body).toEqual({
      followerProfileId: 'p-1',
      followableType: 'PROFILE',
      followableRefId: 'p-2',
    });
    follow.flush({ id: 'f-1' });

    client
      .bookmark({
        profileId: 'p-1',
        bookmarkableType: 'POST',
        bookmarkableRefId: 'post-1',
      })
      .subscribe();
    http
      .expectOne((r) => r.url === '/community/bookmarks' && r.method === 'POST')
      .flush({ id: 'b-1' });

    client
      .block({ blockerProfileId: 'p-1', blockedProfileId: 'p-2', reason: 'SPAM' })
      .subscribe();
    const block = http.expectOne(
      (r) => r.url === '/community/blocks' && r.method === 'POST',
    );
    expect(block.request.body.reason).toBe('SPAM');
    block.flush({ id: 'blk-1' });
  });

  // ─── Grupos (P7) ───────────────────────────────────────────────────────────

  /**
   * Los filtros nuevos del directorio son opcionales y el backend valida con
   * `forbidNonWhitelisted`: si viajaran en `undefined` —o el buscador vacío
   * mandara `q=`— la búsqueda volvería 400 justo al abrir la pantalla.
   */
  it('listGroups no manda topicId ni q cuando no vinieron', () => {
    client.listGroups({ tenantId: 't-1' }).subscribe();

    const req = http.expectOne((r) => r.url === '/community/groups');
    expect(req.request.params.has('topicId')).toBe(false);
    expect(req.request.params.has('q')).toBe(false);
    req.flush(paginaVacia);
  });

  it('listGroups manda los filtros cuando vinieron, y omite la búsqueda vacía', () => {
    client.listGroups({ tenantId: 't-1', topicId: 'top-1', q: 'cardio' }).subscribe();
    const conFiltros = http.expectOne((r) => r.url === '/community/groups');
    expect(conFiltros.request.params.get('topicId')).toBe('top-1');
    expect(conFiltros.request.params.get('q')).toBe('cardio');
    conFiltros.flush(paginaVacia);

    client.listGroups({ tenantId: 't-1', q: '' }).subscribe();
    const sinTexto = http.expectOne((r) => r.url === '/community/groups');
    expect(sinTexto.request.params.has('q')).toBe(false);
    sinTexto.flush(paginaVacia);
  });

  it('listGroupMembers acota por estado de membresía', () => {
    client.listGroupMembers('g-1', { joinStatus: 'PENDING' }).subscribe();

    const req = http.expectOne((r) => r.url === '/community/groups/g-1/members');
    expect(req.request.params.get('joinStatus')).toBe('PENDING');
    req.flush(paginaVacia);
  });

  /**
   * La ficha llega con opcionales en `null`: si se colaran tal cual, la
   * pantalla pintaría «null» donde no hay descripción.
   */
  it('getGroup limpia los nulos y conserva la posición del lector', () => {
    let ficha: GroupDetail | undefined;
    client.getGroup('g-1', { actorProfileId: 'a-1' }).subscribe((r) => (ficha = r));

    const req = http.expectOne((r) => r.url === '/community/groups/g-1');
    expect(req.request.params.get('actorProfileId')).toBe('a-1');
    req.flush({
      id: 'g-1',
      tenantId: 't-1',
      slug: 'cardio',
      name: 'Cardiología',
      description: null,
      visibilityConceptId: 'v-1',
      groupTypeConceptId: 'gt-1',
      topicId: null,
      ownerProfileId: 'p-1',
      coverFileId: null,
      memberCount: 3,
      postCount: 2,
      pendingCount: null,
      statusConceptId: 's-1',
      viewer: {
        isMember: true,
        canAdminister: false,
        canPost: true,
        membershipId: 'm-1',
        memberRoleConceptId: 'r-1',
        joinStatusConceptId: 'j-1',
      },
    });

    expect(ficha?.description).toBeUndefined();
    expect(ficha?.topicId).toBeUndefined();
    expect(ficha?.viewer.canPost).toBe(true);
  });

  /**
   * El muro es recursivo igual que el hilo de comentarios: si la conversión se
   * quedara en el primer nivel, las respuestas llegarían con la fecha en texto
   * y `toLocaleDateString` fallaría recién al pintarlas.
   */
  it('listGroupWall convierte las fechas de todo el hilo, no sólo de la raíz', () => {
    let pagina: GroupWallPage | undefined;
    client.listGroupWall('g-1').subscribe((r) => (pagina = r));

    const req = http.expectOne((r) => r.url === '/community/groups/g-1/posts');
    req.flush({
      items: [
        {
          id: 'c-1',
          authorProfileId: 'p-1',
          bodyText: 'hola',
          parentCommentId: null,
          threadDepth: 0,
          replyCount: 1,
          createdAt: '2026-08-18T10:00:00.000Z',
          replies: [
            {
              id: 'c-2',
              authorProfileId: 'p-2',
              bodyText: 'respondo',
              parentCommentId: 'c-1',
              threadDepth: 1,
              replyCount: 0,
              createdAt: '2026-08-18T11:00:00.000Z',
              replies: null,
            },
          ],
        },
      ],
      count: 1,
      limit: 20,
      nextCursor: null,
    });

    expect(pagina?.items[0].createdAt).toBeInstanceOf(Date);
    expect(pagina?.items[0].replies[0].createdAt).toBeInstanceOf(Date);
    // `replies: null` es una hoja del hilo, no un fallo de conversión.
    expect(pagina?.items[0].replies[0].replies).toEqual([]);
    expect(pagina?.items[0].parentCommentId).toBeUndefined();
  });

  it('publishGroupPost manda el cuerpo al muro del grupo', () => {
    client
      .publishGroupPost('g-1', { authorProfileId: 'p-1', bodyText: 'hola' })
      .subscribe();

    const req = http.expectOne((r) => r.url === '/community/groups/g-1/posts');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ authorProfileId: 'p-1', bodyText: 'hola' });
    req.flush({
      id: 'c-1',
      authorProfileId: 'p-1',
      bodyText: 'hola',
      parentCommentId: null,
      threadDepth: 0,
      replyCount: 0,
      createdAt: '2026-08-18T10:00:00.000Z',
      replies: null,
    });
  });

  it('las escrituras de membresía usan su verbo y su ruta', () => {
    client.joinGroup('g-1', 'p-1').subscribe();
    const alta = http.expectOne((r) => r.url === '/community/groups/g-1/members');
    expect(alta.request.method).toBe('POST');
    expect(alta.request.body).toEqual({ memberProfileId: 'p-1' });
    alta.flush({ id: 'm-1', joinStatus: 'j-1' });

    client.leaveGroup('g-1', 'p-1').subscribe();
    const baja = http.expectOne((r) => r.url === '/community/groups/g-1/members/p-1');
    expect(baja.request.method).toBe('DELETE');
    baja.flush({ id: 'm-1', memberRoleConceptId: 'r-1', joinStatusConceptId: 'j-2' });

    client.updateGroupMember('g-1', 'm-2', { decision: 'APPROVE' }).subscribe();
    const cambio = http.expectOne((r) => r.url === '/community/groups/g-1/members/m-2');
    expect(cambio.request.method).toBe('PATCH');
    expect(cambio.request.body).toEqual({ decision: 'APPROVE' });
    cambio.flush({ id: 'm-2', memberRoleConceptId: 'r-1', joinStatusConceptId: 'j-1' });
  });

  it('listTopics lee el árbol de temas', () => {
    client.listTopics().subscribe();

    const req = http.expectOne((r) => r.url === '/community/topics');
    req.flush({ items: [], count: 0, limit: 200 });
  });
});
