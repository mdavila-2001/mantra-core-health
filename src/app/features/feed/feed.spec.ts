import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';

import { AuthService } from '../../core/auth/auth.service';
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

  /**
   * La organización activa.
   *
   * Arranca en `null` —como estaba antes de que existieran las tendencias— para
   * que las pruebas del muro no tengan que contestar una lectura de grupos que
   * no les interesa. Las de la columna derecha la ponen.
   */
  const tenantId = signal<string | null>(null);

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
      reactions: { tallies: [], total: 0, actorReactionTypeConceptId: null },
      commentCount: 0,
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
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: AuthService, useValue: { activeTenantId: tenantId } },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify({ ignoreCancelled: true });
    tenantId.set(null);
  });

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

  /**
   * LAS TRES COLUMNAS — AC-E1-03.
   *
   * Las dos laterales son acompañamiento, y eso tiene tres consecuencias que
   * estas pruebas fijan: no se dibujan cuando no hay qué decir, no interrumpen
   * cuando su lectura falla, y **van después del muro en el DOM**, que es lo
   * que hace que apilarse en teléfono no empuje las publicaciones hacia abajo.
   */
  describe('las tres columnas', () => {
    const grupo = (id: string, name: string, memberCount: number | null) => ({
      id,
      tenantId: 't-1',
      slug: name.toLowerCase(),
      name,
      description: null,
      visibilityConceptId: 'c-publico',
      groupTypeConceptId: 'c-general',
      ownerProfileId: null,
      coverFileId: null,
      memberCount,
      statusConceptId: 'c-activo',
    });

    /** Contesta el muro vacío, que estas pruebas no miran. */
    const responderMuro = (): void => {
      http
        .expectOne((r) => r.url === '/community/feed')
        .flush({ items: [], count: 0, limit: 20, nextCursor: null });
    };

    const responderGrupos = (items: object[]): void => {
      http
        .expectOne((r) => r.url === '/community/groups')
        .flush({ items, count: items.length, limit: 20, nextCursor: null });
      fixture.detectChanges();
    };

    const tendencias = (): HTMLElement[] =>
      Array.from(
        fixture.nativeElement.querySelectorAll('[data-testid="muro-tendencias"] li'),
      );

    it('sin organización elegida no pide los grupos', () => {
      // Adivinarla mostraría las comunidades de otra organización. Y el muro
      // sigue funcionando: la columna simplemente no se dibuja.
      montar();
      responderPerfil(perfilPropio);
      responderMuro();
      fixture.detectChanges();

      http.expectNone((r) => r.url === '/community/groups');
      expect(tendencias()).toHaveLength(0);
    });

    it('ordena las tendencias por integrantes, y las cuenta con esa palabra', () => {
      // El endpoint no ordena, así que el recorte lo hace el cliente. Y el
      // rótulo dice «integrantes» y no un número suelto: el recuento es de
      // gente, no de publicaciones, y ésa es toda la diferencia.
      tenantId.set('t-1');
      montar();
      responderPerfil(perfilPropio);
      responderMuro();
      responderGrupos([
        grupo('g-1', 'Neurología', 4),
        grupo('g-2', 'Cardiología', 120),
        grupo('g-3', 'Pediatría', 37),
      ]);

      expect(tendencias().map((li) => li.querySelector('.muro__tendencia-nombre')?.textContent?.trim())).toEqual([
        'Cardiología',
        'Pediatría',
        'Neurología',
      ]);
      expect(tendencias()[0].textContent).toContain('120 integrantes');
    });

    it('un grupo sin recuento vale cero y va al final, no en cualquier lado', () => {
      // `memberCount` es opcional en el contrato. Ordenar con `undefined` de
      // por medio deja una lista en orden arbitrario, que se lee como si el
      // ranking mintiera.
      tenantId.set('t-1');
      montar();
      responderPerfil(perfilPropio);
      responderMuro();
      responderGrupos([grupo('g-1', 'Sin dato', null), grupo('g-2', 'Cardiología', 1)]);

      const nombres = tendencias().map((li) => li.querySelector('.muro__tendencia-nombre')?.textContent?.trim());
      expect(nombres).toEqual(['Cardiología', 'Sin dato']);
      // Y su renglón dice cero, en singular corregido: «0 integrantes».
      expect(tendencias()[1].textContent).toContain('0 integrantes');
    });

    it('si los grupos no cargan, la columna no se dibuja y el muro sigue entero', () => {
      tenantId.set('t-1');
      montar();
      responderPerfil(perfilPropio);
      responderMuro();
      http
        .expectOne((r) => r.url === '/community/groups')
        .flush({}, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();

      expect(tendencias()).toHaveLength(0);
      // Sin cartel de error encima del muro: es acompañamiento.
      expect(texto()).not.toContain('No pudimos cargar');
      expect(fixture.nativeElement.querySelector('app-composer')).not.toBeNull();
    });

    it('la vitrina propia encabeza la columna izquierda, con el enlace público', () => {
      montar();
      responderPerfil({ ...perfilPropio, headline: 'Cardióloga · La Paz' });
      responderMuro();
      fixture.detectChanges();

      expect(texto()).toContain('Dra. Marisol Quispe');
      expect(texto()).toContain('Cardióloga · La Paz');
      const enlace: HTMLAnchorElement = fixture.nativeElement.querySelector(
        '.muro__perfil-enlace',
      );
      // A la vitrina pública —`/p/:slug`—, que es la que ve el resto.
      expect(enlace.getAttribute('href')).toBe('/p/marisol-quispe');
    });

    it('sin perfil público no dibuja la columna izquierda', () => {
      // Una tarjeta con el nombre en blanco se lee como un dato que no cargó.
      montar();
      responderPerfil(null);
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.muro__perfil')).toBeNull();
      // Y la puerta que sí corresponde sigue estando.
      expect(texto()).toContain('Todavía no tenés perfil público');
    });

    it('el muro va primero en el DOM: apilarse no lo empuja hacia abajo', () => {
      // El orden del DOM es el de lectura en teléfono. Si el perfil fuera
      // primero, en 375 px las publicaciones arrancarían media pantalla más
      // abajo — y leer es lo que se viene a hacer acá.
      tenantId.set('t-1');
      montar();
      responderPerfil(perfilPropio);
      responderMuro();
      responderGrupos([grupo('g-1', 'Cardiología', 9)]);

      const hijos = Array.from(
        (fixture.nativeElement.querySelector('.muro') as HTMLElement).children,
      ).map((n) => n.className.split(' ')[0]);
      expect(hijos).toEqual(['muro__centro', 'muro__perfil', 'muro__tendencias']);
    });
  });
});
