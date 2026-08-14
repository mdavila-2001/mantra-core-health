import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Feed } from './feed';

/**
 * Lo que estas pruebas fijan.
 *
 * Tres reglas que no se ven leyendo la plantilla: que **el perfil público no es
 * el de la sesión** —hay que preguntárselo al backend, y no tenerlo es un
 * estado legítimo—, que las entradas **sin publicación resuelta se omiten** en
 * vez de pintar tarjetas vacías, y que la paginación es **por cursor**, que es
 * lo único que el contrato del M34 permite.
 */
describe('Feed', () => {
  let fixture: ComponentFixture<Feed>;
  let http: HttpTestingController;

  const texto = (): string => fixture.nativeElement.textContent as string;

  const perfilPropio = {
    id: 'pp-1',
    tenantId: 't-1',
    targetId: 'hp-1',
    slug: 'marisol-quispe',
    displayName: 'Dra. Marisol Quispe',
    headline: null,
    biography: null,
    acceptsReviews: null,
  };

  const publicacion = (id: string) => ({
    id: `f-${id}`,
    itemTypeConceptId: 'c-post',
    sourceTypeConceptId: 'c-social',
    sourceRefId: `p-${id}`,
    originConceptId: 'c-seguido',
    rankScore: null,
    isSeen: null,
    createdAt: '2026-08-14T10:00:00.000Z',
    post: {
      id: `p-${id}`,
      authorPublicProfileId: 'abcdef01-2345-6789-abcd-ef0123456789',
      postTypeConceptId: 'c-tipo',
      bodyText: `Publicación ${id}`,
      visibilityConceptId: null,
      commentsEnabled: null,
      publishedAt: '2026-08-14T09:00:00.000Z',
      editedAt: null,
    },
  });

  const montar = (): void => {
    fixture = TestBed.createComponent(Feed);
    fixture.detectChanges();
  };

  const responderPerfil = (propio: object | null): void => {
    http.expectOne((r) => r.url === '/community/profiles/me').flush(propio);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Feed],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  /**
   * El perfil público de `community` es una entidad aparte del `pid` de la
   * sesión. No tenerlo es un estado legítimo — todavía no lo creó — y la
   * pantalla lo trata como una puerta, no como un error.
   */
  it('sin perfil público invita a crearlo y no pide el muro', () => {
    montar();
    responderPerfil(null);

    expect(texto()).toContain('Todavía no tenés perfil público');
    http.expectNone((r) => r.url === '/community/feed');
  });

  it('con perfil pide el muro acotado a ese perfil', () => {
    montar();
    responderPerfil(perfilPropio);

    const req = http.expectOne((r) => r.url === '/community/feed');
    expect(req.request.params.get('profileId')).toBe('pp-1');
    expect(req.request.params.get('limit')).toBe('20');
    // Primera página: sin cursor. Mandarlo vacío devolvería 400.
    expect(req.request.params.has('cursor')).toBe(false);

    req.flush({ items: [], count: 0, limit: 20, nextCursor: null });
  });

  it('el muro vacío lo dice, no deja la pantalla muda', () => {
    montar();
    responderPerfil(perfilPropio);
    http.expectOne((r) => r.url === '/community/feed').flush({
      items: [],
      count: 0,
      limit: 20,
      nextCursor: null,
    });
    fixture.detectChanges();

    expect(texto()).toContain('Tu muro está vacío');
  });

  /**
   * `FeedListItem.post` viene resuelto sólo cuando la entrada **es** una
   * publicación. Para otros orígenes queda ausente, y pintar una tarjeta vacía
   * es peor que omitir la entrada.
   */
  it('omite las entradas sin publicación resuelta', () => {
    montar();
    responderPerfil(perfilPropio);
    http.expectOne((r) => r.url === '/community/feed').flush({
      items: [
        publicacion('1'),
        {
          id: 'f-otro',
          itemTypeConceptId: 'c-otro',
          sourceTypeConceptId: 'c-otro',
          sourceRefId: 'x-1',
          originConceptId: 'c-sugerido',
          rankScore: null,
          isSeen: null,
          createdAt: '2026-08-14T08:00:00.000Z',
          post: null,
        },
      ],
      count: 2,
      limit: 20,
      nextCursor: null,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('app-post-card').length).toBe(1);
    expect(texto()).toContain('Publicación 1');
  });

  /**
   * Paginación por cursor: «ver más» agrega al final y manda el cursor de la
   * página anterior. No hay números de página porque el contrato no da totales.
   */
  it('«ver más» pide la página siguiente con el cursor y la agrega', () => {
    montar();
    responderPerfil(perfilPropio);
    http.expectOne((r) => r.url === '/community/feed').flush({
      items: [publicacion('1')],
      count: 1,
      limit: 20,
      nextCursor: 'c-2',
    });
    fixture.detectChanges();

    const botones: HTMLButtonElement[] = Array.from(
      fixture.nativeElement.querySelectorAll('button'),
    );
    botones.find((b) => b.textContent!.includes('Ver más'))!.click();

    const segunda = http.expectOne((r) => r.url === '/community/feed');
    expect(segunda.request.params.get('cursor')).toBe('c-2');
    segunda.flush({
      items: [publicacion('2')],
      count: 1,
      limit: 20,
      nextCursor: null,
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('app-post-card').length).toBe(2);
    expect(texto()).toContain('Publicación 1');
    expect(texto()).toContain('Publicación 2');
    // Sin cursor siguiente, el botón desaparece: no se ofrece lo que no hay.
    expect(texto()).not.toContain('Ver más publicaciones');
  });

  it('si el muro falla lo dice', () => {
    montar();
    responderPerfil(perfilPropio);
    http
      .expectOne((r) => r.url === '/community/feed')
      .flush({}, { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    expect(texto()).toContain('No pudimos cargar el muro');
  });
});
