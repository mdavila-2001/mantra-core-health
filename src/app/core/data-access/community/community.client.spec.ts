import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { CommunityClient, MEDICAL_ARTICLE_HASHTAG } from './community.client';

/**
 * `CommunityClient`: la vitrina pública propia, sus publicaciones y comentarios.
 *
 * Lo que estas pruebas fijan:
 *
 * 1. **`getOwnProfile` distingue «no tenés vitrina» de un error.** El backend
 *    responde `null`, no un 404; el cliente lo deja pasar tal cual.
 * 2. **Publicar un artículo agrega el hashtag, sin duplicarlo.**
 * 3. **`getPost` traduce los hashtags a texto plano.** El backend los envuelve
 *    en objetos con id; la pantalla sólo necesita el texto.
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

  afterEach(() => http.verify());

  /* ---- la vitrina propia --------------------------------------------------- */

  it('getOwnProfile deja pasar null: no tener vitrina no es un error', () => {
    let perfil: unknown = 'sin-resolver';
    client.getOwnProfile().subscribe((p) => (perfil = p));

    http.expectOne('/community/profiles/me').flush(null as never);

    expect(perfil).toBeNull();
  });

  it('getOwnProfile traduce la vitrina cuando existe', () => {
    let perfil: { slug?: string } | null | undefined;
    client.getOwnProfile().subscribe((p) => (perfil = p));

    http.expectOne('/community/profiles/me').flush({
      id: 'pp-1',
      tenantId: 't-1',
      targetId: 'hp-1',
      slug: 'dra-salas',
      displayName: 'Dra. Salas',
      headline: null,
      biography: null,
      acceptsReviews: true,
      verificationStatusConceptId: null,
      statusConceptId: 'st-activo',
    });

    expect(perfil?.slug).toBe('dra-salas');
  });

  it('upsertOwnProfile manda un PUT con los datos de la vitrina', () => {
    client
      .upsertOwnProfile({ tenantId: 't-1', slug: 'dra-salas', displayName: 'Dra. Salas' })
      .subscribe();

    const req = http.expectOne('/community/profiles/me');
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      tenantId: 't-1',
      slug: 'dra-salas',
      displayName: 'Dra. Salas',
    });
    req.flush({
      id: 'pp-1',
      tenantId: 't-1',
      targetId: 'hp-1',
      slug: 'dra-salas',
      displayName: 'Dra. Salas',
      headline: null,
      biography: null,
      acceptsReviews: null,
      verificationStatusConceptId: null,
      statusConceptId: 'st-activo',
    });
  });

  /* ---- publicar ------------------------------------------------------------ */

  it('publishPost sin marcarlo como artículo no agrega ningún hashtag', () => {
    client.publishPost('pp-1', { bodyText: 'Hola' }).subscribe();

    const req = http.expectOne('/community/profiles/pp-1/posts');
    expect(req.request.body.hashtags).toBeUndefined();
    req.flush({ id: 'post-1' });
  });

  /** Es la única diferencia entre publicar un artículo médico y cualquier otra cosa. */
  it('publishPost como artículo agrega el hashtag del artículo médico', () => {
    client.publishPost('pp-1', { bodyText: 'Un artículo' }, true).subscribe();

    const req = http.expectOne('/community/profiles/pp-1/posts');
    expect(req.request.body.hashtags).toEqual([MEDICAL_ARTICLE_HASHTAG]);
    req.flush({ id: 'post-1' });
  });

  it('publishPost como artículo no duplica el hashtag si ya venía puesto', () => {
    client
      .publishPost('pp-1', { bodyText: 'x', hashtags: [MEDICAL_ARTICLE_HASHTAG, 'otro'] }, true)
      .subscribe();

    const req = http.expectOne('/community/profiles/pp-1/posts');
    expect(req.request.body.hashtags).toEqual([MEDICAL_ARTICLE_HASHTAG, 'otro']);
    req.flush({ id: 'post-1' });
  });

  /* ---- lectura --------------------------------------------------------------- */

  it('listProfilePosts pide la página con el tope por defecto', () => {
    client.listProfilePosts('pp-1').subscribe();

    const req = http.expectOne((r) => r.url === '/community/profiles/pp-1/posts');
    expect(req.request.params.get('limit')).toBe('50');
    req.flush({ items: [], count: 0, limit: 50, nextCursor: null });
  });

  /** Los hashtags llegan como `{id, tag}[]`; la pantalla sólo necesita el texto. */
  it('getPost aplana los hashtags a texto plano', () => {
    let detalle: { hashtags: readonly string[] } | undefined;
    client.getPost('post-1').subscribe((d) => (detalle = d));

    http.expectOne('/community/posts/post-1').flush({
      id: 'post-1',
      authorPublicProfileId: 'pp-1',
      postTypeConceptId: 'ct-1',
      bodyText: 'Cuerpo',
      visibilityConceptId: null,
      commentsEnabled: true,
      publishedAt: '2026-01-01T00:00:00.000Z',
      editedAt: null,
      media: [],
      hashtags: [{ id: 'h-1', tag: MEDICAL_ARTICLE_HASHTAG }],
    });

    expect(detalle?.hashtags).toEqual([MEDICAL_ARTICLE_HASHTAG]);
  });

  it('listPostComments arma el árbol de respuestas', () => {
    let pagina: { items: readonly { replies: readonly unknown[] }[] } | undefined;
    client.listPostComments('post-1').subscribe((p) => (pagina = p));

    http.expectOne((r) => r.url === '/community/posts/post-1/comments').flush({
      items: [
        {
          id: 'c-1',
          authorProfileId: 'pp-2',
          bodyText: 'Comentario',
          parentCommentId: null,
          threadDepth: 0,
          replyCount: 1,
          createdAt: '2026-01-01T00:00:00.000Z',
          replies: [
            {
              id: 'c-2',
              authorProfileId: 'pp-3',
              bodyText: 'Respuesta',
              parentCommentId: 'c-1',
              threadDepth: 1,
              replyCount: 0,
              createdAt: '2026-01-01T01:00:00.000Z',
              replies: [],
            },
          ],
        },
      ],
      count: 1,
      limit: 50,
      nextCursor: null,
    });

    expect(pagina?.items[0].replies).toHaveLength(1);
  });

  it('createComment manda commentableType POST', () => {
    client
      .createComment({ authorProfileId: 'pp-1', commentableRefId: 'post-1', bodyText: 'Hola' })
      .subscribe();

    const req = http.expectOne('/community/comments');
    expect(req.request.body).toEqual({
      authorProfileId: 'pp-1',
      commentableRefId: 'post-1',
      bodyText: 'Hola',
      commentableType: 'POST',
    });
    req.flush({ id: 'c-1' });
  });

  it('getPostReactions lee el resumen', () => {
    let resumen: { total?: number } | undefined;
    client.getPostReactions('post-1').subscribe((r) => (resumen = r));

    http
      .expectOne('/community/posts/post-1/reactions')
      .flush({ tallies: [], total: 0, actorReactionTypeConceptId: null });

    expect(resumen?.total).toBe(0);
  });
});
