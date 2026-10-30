import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MedicalArticles } from './medical-articles';

/**
 * Mis artículos médicos: publicar, listar los propios y ver sus comentarios.
 *
 * Lo que estas pruebas fijan:
 *
 * 1. **Sin vitrina no se pide nada.** El backend no tiene dónde publicar sin
 *    ella, así que la pantalla ni siquiera intenta listar.
 * 2. **Un artículo se distingue por su hashtag**, resuelto contra el detalle de
 *    cada publicación — el listado no lo trae.
 * 3. **Publicar un artículo desde acá siempre lleva el hashtag.**
 * 4. **Los comentarios se piden al abrir, no al listar.**
 */

const PERFIL = {
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
};

function postItem(id: string) {
  return {
    id,
    authorPublicProfileId: 'pp-1',
    postTypeConceptId: 'ct-1',
    bodyText: `Cuerpo de ${id}`,
    visibilityConceptId: null,
    commentsEnabled: true,
    publishedAt: '2026-01-01T00:00:00.000Z',
    editedAt: null,
  };
}

function postDetail(id: string, esArticulo: boolean, bodyText?: string) {
  return {
    ...postItem(id),
    bodyText: bodyText ?? `Cuerpo de ${id}`,
    media: [],
    hashtags: esArticulo ? [{ id: `h-${id}`, tag: 'articulo-medico' }] : [],
    mentions: [],
  };
}

describe('MedicalArticles', () => {
  let componente: MedicalArticles;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function montar(): void {
    componente = TestBed.createComponent(MedicalArticles).componentInstance;
  }

  function interno<T>(nombre: string): T {
    const valor = (componente as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(componente) : valor) as T;
  }

  function señal<T>(nombre: string): WritableSignal<T> {
    return (componente as unknown as Record<string, WritableSignal<T>>)[nombre];
  }

  /** Deja la pantalla lista con una vitrina y N publicaciones. */
  function montarConVitrina(items: readonly { id: string; esArticulo: boolean }[]): void {
    montar();
    http.expectOne('/community/profiles/me').flush(PERFIL);
    http
      .expectOne((r) => r.url === '/community/profiles/pp-1/posts')
      .flush({ items: items.map((i) => postItem(i.id)), count: items.length, limit: 50, nextCursor: null });
    for (const item of items) {
      http.expectOne(`/community/posts/${item.id}`).flush(postDetail(item.id, item.esArticulo));
    }
  }

  it('sin vitrina no pide el listado de publicaciones', () => {
    montar();
    http.expectOne('/community/profiles/me').flush(null as never);

    expect(interno<() => boolean>('sinVitrinaTodavia')()).toBe(true);
    http.verify();
  });

  it('con vitrina y sin publicaciones, no hace ninguna lectura de detalle', () => {
    montar();
    http.expectOne('/community/profiles/me').flush(PERFIL);
    http
      .expectOne((r) => r.url === '/community/profiles/pp-1/posts')
      .flush({ items: [], count: 0, limit: 50, nextCursor: null });

    expect(interno<() => { status: string; data?: unknown[] }>('articulos')()).toEqual({
      status: 'ready',
      data: [],
    });
  });

  /** El listado no trae hashtags: distinguir un artículo exige el detalle. */
  it('filtra sólo las publicaciones con el hashtag de artículo médico', () => {
    montarConVitrina([
      { id: 'post-articulo', esArticulo: true },
      { id: 'post-comun', esArticulo: false },
    ]);

    const articulos = interno<() => { data: readonly { post: { id: string } }[] }>('articulos')();
    expect(articulos.data.map((a) => a.post.id)).toEqual(['post-articulo']);
  });

  it('recorta el cuerpo largo para la tarjeta', () => {
    montar();
    http.expectOne('/community/profiles/me').flush(PERFIL);
    http
      .expectOne((r) => r.url === '/community/profiles/pp-1/posts')
      .flush({ items: [postItem('post-1')], count: 1, limit: 50, nextCursor: null });
    http
      .expectOne('/community/posts/post-1')
      .flush(postDetail('post-1', true, 'x'.repeat(400)));

    const [articulo] = interno<() => { data: readonly { resumen: string; recortado: boolean }[] }>(
      'articulos',
    )().data;
    expect(articulo.recortado).toBe(true);
    expect(articulo.resumen.endsWith('…')).toBe(true);
    expect(articulo.resumen.length).toBeLessThan(400);
  });

  /** Recarga completa tras publicar. */
  function recargaTrasPublicar(): void {
    http.expectOne('/community/profiles/me').flush(PERFIL);
    http
      .expectOne((r) => r.url === '/community/profiles/pp-1/posts')
      .flush({ items: [], count: 0, limit: 50, nextCursor: null });
  }

  function imagen(nombre: string): File {
    return new File([new Uint8Array(4)], nombre, { type: 'image/png' });
  }

  /** Es la única diferencia entre publicar un artículo y cualquier otra publicación. */
  it('publicar manda siempre el hashtag de artículo médico', () => {
    montarConVitrina([]);

    interno<(b: unknown) => void>('publicar')({ bodyText: 'Un artículo nuevo', images: [] });

    const req = http.expectOne('/community/profiles/pp-1/posts');
    expect(req.request.body.hashtags).toEqual(['articulo-medico']);
    expect(req.request.body.bodyText).toBe('Un artículo nuevo');
    expect(req.request.body.media).toEqual([]);
    req.flush({ id: 'post-nuevo' });
    recargaTrasPublicar();
  });

  it('sube las imágenes en orden y publica con su posición y descripción', () => {
    montarConVitrina([]);

    interno<(b: unknown) => void>('publicar')({
      bodyText: '## Uno\n\n![A](imagen:0)\n\n![B](imagen:1)',
      images: [
        { file: imagen('a.png'), alt: 'A' },
        { file: imagen('b.png'), alt: 'B' },
      ],
    });

    // En serie: la segunda no sale hasta que la primera volvió.
    const primera = http.expectOne('/common/files/upload');
    expect((primera.request.body as FormData).get('category')).toBe('IMAGE');
    primera.flush({ id: 'f-a' });
    http.expectOne('/common/files/upload').flush({ id: 'f-b' });

    const req = http.expectOne('/community/profiles/pp-1/posts');
    expect(req.request.body.media).toEqual([
      { fileId: 'f-a', mediaRole: 'IMAGE', altText: 'A', ordinal: 0 },
      { fileId: 'f-b', mediaRole: 'IMAGE', altText: 'B', ordinal: 1 },
    ]);
    req.flush({ id: 'post-nuevo' });
    recargaTrasPublicar();
  });

  it('si una imagen no sube, no publica nada', () => {
    montarConVitrina([]);

    interno<(b: unknown) => void>('publicar')({
      bodyText: '![A](imagen:0)',
      images: [{ file: imagen('a.png'), alt: 'A' }],
    });
    http.expectOne('/common/files/upload').flush('falla', { status: 500, statusText: 'Error' });

    http.expectNone((r) => r.url === '/community/profiles/pp-1/posts' && r.method === 'POST');
    expect(señal<boolean>('publicando')()).toBe(false);
  });

  it('sin texto, publicar no manda nada', () => {
    montarConVitrina([]);

    interno<(b: unknown) => void>('publicar')({ bodyText: '   ', images: [] });

    http.expectNone((r) => r.url === '/community/profiles/pp-1/posts' && r.method === 'POST');
  });

  it('el resumen de la tarjeta sale sin marcas del formato', () => {
    montar();
    http.expectOne('/community/profiles/me').flush(PERFIL);
    http
      .expectOne((r) => r.url === '/community/profiles/pp-1/posts')
      .flush({ items: [postItem('post-1')], count: 1, limit: 50, nextCursor: null });
    http
      .expectOne('/community/posts/post-1')
      .flush(postDetail('post-1', true, '## Síntomas\n- **fiebre**\n![Foto](imagen:0)'));

    const [articulo] = interno<() => { data: readonly { resumen: string }[] }>('articulos')().data;
    expect(articulo!.resumen).toBe('Síntomas fiebre');
  });

  it('leer un artículo pide sus imágenes propias, en el orden del texto', () => {
    montar();
    http.expectOne('/community/profiles/me').flush(PERFIL);
    http
      .expectOne((r) => r.url === '/community/profiles/pp-1/posts')
      .flush({ items: [postItem('post-1')], count: 1, limit: 50, nextCursor: null });
    http.expectOne('/community/posts/post-1').flush({
      ...postDetail('post-1', true, '![B](imagen:1)'),
      media: [
        { id: 'm-2', fileId: 'f-b', mediaRoleConceptId: 'c', ordinal: 1 },
        { id: 'm-1', fileId: 'f-a', mediaRoleConceptId: 'c', ordinal: 0 },
      ],
    });

    const [articulo] = interno<() => { data: readonly unknown[] }>('articulos')().data;
    interno<(a: unknown) => void>('alternarLectura')(articulo);

    const pedidos = http.match((r) => r.url.startsWith('/common/files/'));
    expect(pedidos.map((r) => r.request.url)).toEqual([
      expect.stringContaining('f-a'),
      expect.stringContaining('f-b'),
    ]);
    pedidos.forEach((r) => r.flush(new Blob(['x'], { type: 'image/png' }), { headers: { 'Content-Type': 'image/png' } }));
    expect(señal<string | null>('leyendo')()).toBe('post-1');
  });

  /* ---- comentarios: al abrir, no al listar --------------------------------- */

  it('abrir un artículo pide su hilo de comentarios', () => {
    montarConVitrina([{ id: 'post-1', esArticulo: true }]);

    interno<(id: string) => void>('alternarComentarios')('post-1');

    const req = http.expectOne((r) => r.url === '/community/posts/post-1/comments');
    req.flush({
      items: [
        {
          id: 'c-1',
          authorProfileId: 'pp-2',
          bodyText: 'Buen artículo',
          parentCommentId: null,
          threadDepth: 0,
          replyCount: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
          replies: [],
        },
      ],
      count: 1,
      limit: 50,
      nextCursor: null,
    });

    expect(interno<() => { status: string }>('comentarios')().status).toBe('ready');
    expect(interno<() => string | null>('abierto')()).toBe('post-1');
  });

  it('abrir el mismo artículo dos veces lo cierra, sin pedir de nuevo', () => {
    montarConVitrina([{ id: 'post-1', esArticulo: true }]);

    interno<(id: string) => void>('alternarComentarios')('post-1');
    http.expectOne((r) => r.url === '/community/posts/post-1/comments').flush({
      items: [],
      count: 0,
      limit: 50,
      nextCursor: null,
    });

    interno<(id: string) => void>('alternarComentarios')('post-1');

    expect(interno<() => string | null>('abierto')()).toBeNull();
    http.verify();
  });

  it('comentar publica y vuelve a pedir el hilo', () => {
    montarConVitrina([{ id: 'post-1', esArticulo: true }]);

    interno<(id: string) => void>('alternarComentarios')('post-1');
    http
      .expectOne((r) => r.url === '/community/posts/post-1/comments')
      .flush({ items: [], count: 0, limit: 50, nextCursor: null });

    señal<string>('nuevoComentario').set('Muy claro, gracias');
    interno<() => void>('comentar')();

    const req = http.expectOne('/community/comments');
    expect(req.request.body).toEqual({
      authorProfileId: 'pp-1',
      commentableRefId: 'post-1',
      bodyText: 'Muy claro, gracias',
      commentableType: 'POST',
    });
    req.flush({ id: 'c-nuevo' });

    // Se cierra y se reabre: el hilo se vuelve a pedir con lo nuevo adentro.
    http
      .expectOne((r) => r.url === '/community/posts/post-1/comments')
      .flush({ items: [], count: 0, limit: 50, nextCursor: null });
  });
});
