import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import { PostCard } from './post-card';
import type { PostListItem } from '../../../core/data-access/community/community.types';

/**
 * Lo que estas pruebas fijan.
 *
 * Dos cosas que no se ven leyendo: que **sin perfil público no se puede
 * reaccionar** —el contrato exige el perfil y no lo deduce de la sesión— y que
 * la reacción es **optimista con reversión**. Lo segundo importa: si el
 * servidor falla y el conteo se queda subido, la pantalla miente.
 */
describe('PostCard', () => {
  let fixture: ComponentFixture<PostCard>;
  let http: HttpTestingController;

  const texto = (): string => fixture.nativeElement.textContent as string;

  const post = (extra: Partial<PostListItem> = {}): PostListItem => ({
    id: 'p-1',
    authorPublicProfileId: 'abcdef01-2345-6789-abcd-ef0123456789',
    postTypeConceptId: 'c-tipo',
    bodyText: 'Un hallazgo de la consulta de hoy.',
    publishedAt: new Date('2026-08-14T09:00:00.000Z'),
    reactions: { tallies: [], total: 0 },
    commentCount: 0,
    ...extra,
  });

  const montar = (
    actorProfileId: string | null,
    publicacion: PostListItem = post(),
  ): void => {
    fixture = TestBed.createComponent(PostCard);
    fixture.componentRef.setInput('post', publicacion);
    fixture.componentRef.setInput('actorProfileId', actorProfileId);
    fixture.detectChanges();
  };

  const pulsar = (etiqueta: string): void => {
    const botones: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    botones.find((b) => b.textContent!.includes(etiqueta))!.click();
    fixture.detectChanges();
  };

  /**
   * Pulsa por texto **exacto**. Hace falta porque «Comentar» está contenido en
   * «Comentarios (0)», y buscar por inclusión abría el hilo en vez de enviar.
   */
  const pulsarExacto = (etiqueta: string): void => {
    const botones: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    botones.find((b) => b.textContent!.trim() === etiqueta)!.click();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PostCard],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  it('pinta el cuerpo de la publicación', () => {
    montar('pp-1');
    expect(texto()).toContain('Un hallazgo de la consulta de hoy.');
  });

  /**
   * Sin perfil público el contrato no acepta la reacción: `actorProfileId` es
   * obligatorio y es la mitad de la clave del upsert. Se dice, no se ofrece un
   * botón que va a fallar.
   */
  it('sin perfil público no ofrece escribir: lo explica', () => {
    montar(null);

    expect(texto()).toContain('Creá tu perfil público para reaccionar');
    // Queda el botón de abrir comentarios —leer no exige perfil—, pero ninguno
    // de los que escriben.
    const etiquetas: string[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    ).map((b) => (b as HTMLButtonElement).textContent ?? '');
    expect(etiquetas.some((t) => t.includes('Me sirve'))).toBe(false);
    expect(etiquetas.some((t) => t.includes('Guardar'))).toBe(false);
  });

  it('reaccionar manda el upsert con los cuatro campos', () => {
    montar('pp-1');
    pulsar('Me sirve');

    const req = http.expectOne((r) => r.url === '/community/reactions');
    // PUT y no POST: reaccionar de nuevo cambia la reacción, no agrega otra.
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({
      actorProfileId: 'pp-1',
      reactableType: 'POST',
      reactableRefId: 'p-1',
      reactionType: 'LIKE',
    });

    req.flush({ id: 'r-1' });
  });

  it('el conteo sube antes de que el servidor conteste', () => {
    montar('pp-1');
    pulsar('Me sirve');

    // Todavía sin respuesta: el gesto ya se siente.
    expect(texto()).toContain('1 reacción');

    http.expectOne((r) => r.url === '/community/reactions').flush({ id: 'r-1' });
  });

  /**
   * El hueco que cierra el carril: el contador arrancaba en cero y sólo subía
   * con el gesto del momento, así que al recargar una publicación con doce
   * reacciones mostraba cero y el botón propio aparecía apagado aunque la
   * reacción estuviera guardada.
   */
  it('parte del recuento que trajo la lectura, no de cero', () => {
    montar(
      'pp-1',
      post({
        reactions: {
          tallies: [{ reactionTypeConceptId: 'c-like', reactionType: 'LIKE', count: 12 }],
          total: 12,
          actorReactionType: 'INSIGHTFUL',
        },
        commentCount: 3,
      }),
    );

    expect(texto()).toContain('12 reacciones');
    expect(texto()).toContain('Comentarios (3)');

    const botones: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    const pensar = botones.find((b) => b.textContent!.includes('Me hizo pensar'))!;
    // El botón queda marcado sin ningún gesto en esta sesión: lo dijo el servidor.
    expect(pensar.getAttribute('aria-pressed')).toBe('true');
  });

  /**
   * Cambiar de reacción no agrega una segunda: el backend hace upsert sobre
   * `(actor, objeto)`, así que el total no puede subir dos veces.
   */
  it('cambiar la reacción propia no vuelve a sumar al total', () => {
    montar(
      'pp-1',
      post({
        reactions: {
          tallies: [{ reactionTypeConceptId: 'c-like', reactionType: 'LIKE', count: 4 }],
          total: 4,
          actorReactionType: 'LIKE',
        },
      }),
    );

    pulsar('Me hizo pensar');

    expect(texto()).toContain('4 reacciones');
    http.expectOne((r) => r.url === '/community/reactions').flush({ id: 'r-1' });
  });

  it('guardar manda el marcador y quitarlo lo borra', () => {
    montar('pp-1');
    pulsar('Guardar');

    const alta = http.expectOne((r) => r.url === '/community/bookmarks');
    expect(alta.request.method).toBe('POST');
    expect(alta.request.body).toEqual({
      profileId: 'pp-1',
      bookmarkableType: 'POST',
      bookmarkableRefId: 'p-1',
    });
    alta.flush({ id: 'b-1' });

    fixture.componentRef.setInput('guardado', true);
    fixture.detectChanges();
    pulsar('Guardada');

    const baja = http.expectOne((r) => r.url.startsWith('/community/bookmarks'));
    expect(baja.request.method).toBe('DELETE');
    baja.flush({ removed: true });
  });

  it('abrir el hilo lo relee, no muestra una copia vieja', () => {
    montar('pp-1');
    pulsar('Comentarios');

    http
      .expectOne((r) => r.url === '/community/posts/p-1/comments')
      .flush({ items: [], count: 0, limit: 20, nextCursor: null });
    fixture.detectChanges();

    expect(texto()).toContain('Todavía no hay comentarios');

    // Volver a abrirlo pide de nuevo: quien lo abre quiere saber si contestaron,
    // y una copia guardada le mostraría la conversación de hace diez minutos.
    pulsar('Ocultar');
    pulsar('Comentarios');

    http
      .expectOne((r) => r.url === '/community/posts/p-1/comments')
      .flush({
        items: [
          {
            id: 'c-1',
            authorProfileId: 'ffffffff-0000-0000-0000-000000000000',
            bodyText: 'Coincido con el hallazgo.',
            parentCommentId: null,
            threadDepth: 0,
            replyCount: 0,
            createdAt: '2026-08-14T11:00:00.000Z',
            replies: [],
          },
        ],
        count: 1,
        limit: 20,
        nextCursor: null,
      });
    fixture.detectChanges();

    expect(texto()).toContain('Coincido con el hallazgo.');
  });

  it('comentar manda el cuerpo y relee el hilo', () => {
    montar('pp-1');
    pulsar('Comentarios');
    http
      .expectOne((r) => r.url === '/community/posts/p-1/comments')
      .flush({ items: [], count: 0, limit: 20, nextCursor: null });
    fixture.detectChanges();

    const area: HTMLTextAreaElement =
      fixture.nativeElement.querySelector('textarea');
    area.value = 'Gracias por compartirlo.';
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    pulsarExacto('Comentar');

    const alta = http.expectOne((r) => r.url === '/community/comments');
    expect(alta.request.body).toEqual({
      authorProfileId: 'pp-1',
      commentableRefId: 'p-1',
      bodyText: 'Gracias por compartirlo.',
      commentableType: 'POST',
    });
    alta.flush({ id: 'c-9' });
    fixture.detectChanges();

    // El hilo se relee en vez de insertarse a mano: el servidor decide la
    // profundidad, el orden y el `rootCommentId`.
    http
      .expectOne((r) => r.url === '/community/posts/p-1/comments')
      .flush({ items: [], count: 0, limit: 20, nextCursor: null });
    fixture.detectChanges();

    // El hilo quedó abierto, así que el botón dice «Ocultar»; lo que importa es
    // que el contador subió a 1 y no se quedó en el que trajo la lectura.
    expect(texto()).toContain('Ocultar (1)');
  });

  /**
   * Lo que hace honesto al optimismo. Si el servidor falla y el conteo se queda
   * subido, la pantalla afirma algo que no ocurrió.
   */
  it('si el servidor falla, el conteo vuelve atrás y se avisa', () => {
    montar('pp-1');
    pulsar('Me sirve');

    http
      .expectOne((r) => r.url === '/community/reactions')
      .flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(texto()).toContain('No pudimos guardar tu reacción');
    // El conteo volvió a cero: no queda un «1» que nadie guardó.
    const conteo = fixture.nativeElement.querySelector('.publicacion__conteo');
    expect(conteo).toBeNull();
  });

  /**
   * FND-01/FND-02. `app-file-preview-image` es lo que pinta el adjunto de un
   * comentario en esta tarjeta con sesión, y tiene que pedirlo por la ruta
   * autorizada por «puedo ver el post» (`CommunityClient.commentMediaDataUrl`)
   * y no por `/common/files/:id/content` (que sólo deja pasar a quien subió
   * el archivo, y era exactamente el 403 que dejaba el ícono roto para
   * cualquiera que no fuera esa persona — el autor del post incluido).
   */
  it('un comentario con adjunto lo pide por la ruta de comentarios, no la de archivos propios', () => {
    montar('pp-1');
    pulsar('Comentarios');
    http
      .expectOne((r) => r.url === '/community/posts/p-1/comments')
      .flush({
        items: [
          {
            id: 'c-1',
            authorProfileId: 'ffffffff-0000-0000-0000-000000000000',
            bodyText: 'Miren esta radiografía.',
            parentCommentId: null,
            threadDepth: 0,
            replyCount: 0,
            createdAt: '2026-08-14T11:00:00.000Z',
            replies: [],
            media: [
              { id: 'cm-1', fileId: 'f-1', mediaRoleConceptId: 'c-img', altText: 'Radiografía' },
            ],
          },
        ],
        count: 1,
        limit: 20,
        nextCursor: null,
      });
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="post-comment-media"]'),
    ).not.toBeNull();

    const peticion = http.expectOne('/community/comments/media/f-1/content');
    expect(peticion.request.method).toBe('GET');
    peticion.flush(new Blob(['bytes'], { type: 'image/png' }));
  });

  it('marca cuál reacción es la propia', () => {
    montar('pp-1');
    pulsar('Me hizo pensar');

    const botones: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    const pensar = botones.find((b) => b.textContent!.includes('Me hizo pensar'))!;
    const sirve = botones.find((b) => b.textContent!.includes('Me sirve'))!;

    expect(pensar.getAttribute('aria-pressed')).toBe('true');
    expect(sirve.getAttribute('aria-pressed')).toBe('false');

    http.expectOne((r) => r.url === '/community/reactions').flush({ id: 'r-1' });
  });
});
