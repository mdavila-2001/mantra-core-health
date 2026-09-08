import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../core/auth/session.store';
import { MAXIMO_DE_ZONAS } from '../../core/navigation/access-tree';
import { resolverEstadosDeCaso } from '../../../testing/case-status';
import { Dashboard } from './dashboard';

/**
 * El panel concentra **cuatro reglas de producto** que nada más fija, y son las
 * que un refactor rompería en silencio:
 *
 * 1. **Vacío gana sobre atrasado.** Una proyección sin registros no tiene nada
 *    que mostrar, así que anunciar su antigüedad sería decirle a la persona
 *    cuán viejo es un dato que no está viendo.
 * 2. **Sin `refreshedAt` es `ready`, no `stale`.** La vista nunca se refrescó,
 *    así que no hay antigüedad que declarar — y S7 exige una. Inventar
 *    `new Date()` sería afirmar que se calculó recién.
 * 3. **El listado de pacientes se pide sólo con el rol que lo permite.** Sin
 *    `SECURITY_ADMIN` la API responde 403, así que pedirlo sería provocar un
 *    error para después esconderlo.
 * 4. **El total sale de `count`, no de las filas traídas.** El panel muestra
 *    cinco y el total es de la organización entera; contar `items` diría cinco
 *    para siempre.
 */

/** base64url **sobre UTF-8**, como el token real. */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

describe('Dashboard', () => {
  let fixture: ComponentFixture<Dashboard>;
  let component: Dashboard;
  let http: HttpTestingController;
  let session: SessionStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
      // El aviso de puesta en marcha cuelga de un `@defer (on immediate)`, y con
      // el comportamiento por defecto —`Playthrough`— su carga es un `import()`
      // real: según cuánto tarde, la petición que hace al construirse cae
      // adentro o afuera de la prueba. Local resolvía tarde y no se notaba; en
      // CI, con la máquina cargada, resolvía a tiempo y volteaba la primera
      // prueba del bloque con un `timeout` de 5 s.
      //
      // `Manual` no es esquivar el problema: estas pruebas hablan del panel, no
      // del aviso, cuya conducta fijan sus propias pruebas en `setup-notice`.
      deferBlockBehavior: DeferBlockBehavior.Manual,
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
  });

  afterEach(() => {
    // TJ-1 · el aviso del alta consulta el avance del profesional. Es
    // accesorio: si no responde, el panel se pinta igual y el banner no
    // aparece. Se descarta acá para que cada prueba siga hablando de lo suyo,
    // y no de una lectura que no le importa. Su propia conducta la fijan las
    // pruebas del banner, más abajo.
    for (const pedido of http.match((request) =>
      request.url.endsWith('/practitioners/me/onboarding'),
    )) {
      pedido.flush(null, { status: 422, statusText: 'Unprocessable Entity' });
    }
    http.verify();
  });

  /**
   * Construye el panel **después** de fijar la sesión.
   *
   * El orden no es un detalle: el panel decide en su constructor si puede pedir
   * el listado de pacientes, y esa decisión sale de los roles del token. Crear
   * el componente antes de abrir la sesión mediría siempre el caso sin rol.
   */
  function crear(claims: Record<string, unknown> | null = null): void {
    if (claims !== null) {
      session.start({ accessToken: jwt(claims), refreshToken: 'r-1' });
    }
    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;

    // El historial de verificación se pide siempre, con o sin rol. Se responde
    // acá para que cada prueba hable de lo suyo y no de esta petición.
    http.expectOne((request) => request.url.endsWith('/identity/me/verification-cases')).flush([]);
    // Y el sello de ese trámite sale de terminología, por el mismo motivo.
    resolverEstadosDeCaso(http);
  }

  /** Acceso al estado protegido sin abrirlo en el componente. */
  function estado() {
    return (component as unknown as { directory: () => { status: string } }).directory();
  }

  function responder(records: unknown[], refreshedAt: string | null) {
    http
      .expectOne((request) => request.url.endsWith('/public/directory'))
      .flush({
        slug: 'directory',
        records,
        refreshedAt,
        generatedAt: '2026-08-01T12:00:00.000Z',
      });
  }

  it('pide el directorio al construirse y arranca en S2', () => {
    crear();

    expect(estado().status).toBe('loading');
    responder([], null);
  });

  it('sin registros muestra S3 vacío, aunque la proyección declare antigüedad', () => {
    crear();
    // El caso que distingue las dos reglas: hay `refreshedAt`, y aun así gana
    // el vacío. Si el orden se invirtiera, esto pasaría a `stale`.
    responder([], '2026-07-31T00:00:00.000Z');

    expect(estado().status).toBe('empty');
  });

  it('con registros y antigüedad declarada muestra S7', () => {
    crear();
    responder([{ nombre: 'Clínica' }], '2026-07-31T00:00:00.000Z');

    const state = estado() as { status: string; asOf?: Date };
    expect(state.status).toBe('stale');
    expect(state.asOf).toEqual(new Date('2026-07-31T00:00:00.000Z'));
  });

  it('con registros y sin antigüedad muestra el camino feliz, no S7', () => {
    crear();
    // `refreshedAt: null` es «nunca se refrescó», que NO es «se refrescó
    // recién». Resolverlo como `stale` obligaría a inventar una fecha.
    responder([{ nombre: 'Clínica' }], null);

    expect(estado().status).toBe('ready');
  });

  it('un fallo de red se traduce a S8, no a una excepción', () => {
    crear();
    http
      .expectOne((request) => request.url.endsWith('/public/directory'))
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(estado().status).toBe('offline');
  });

  it('cuenta los registros solo cuando el estado transporta datos', () => {
    crear();
    responder([{ a: 1 }, { a: 2 }], null);

    const conteo = (component as unknown as { recordCount: () => number | null }).recordCount();
    expect(conteo).toBe(2);
  });

  it('sin rol de administración NO pide el listado de pacientes', () => {
    crear({ sub: 'u-1', roles: ['PATIENT'], tenants: ['t-1'] });
    responder([], null);

    // `verify()` en el afterEach es el que ata esto: si el panel hubiera pedido
    // el listado, quedaría una petición abierta y la prueba fallaría.
    http.expectNone((request) => request.url.includes('/profiles/patients'));
  });

  it('con SECURITY_ADMIN pide el listado y toma el total de `count`, no de las filas', () => {
    crear({ sub: 'u-1', roles: ['SECURITY_ADMIN'], tenants: ['t-1'] });
    responder([], null);

    http
      .expectOne((request) => request.url.includes('/profiles/patients'))
      .flush({
        // Dos filas traídas y ciento cuarenta en la organización: si el total
        // saliera de `items`, esto diría 2.
        items: [
          { profileId: 'p-1', personId: 'per-1', patientCode: 'PAC-1', deceased: false },
          { profileId: 'p-2', personId: 'per-2', patientCode: 'PAC-2', deceased: false },
        ],
        count: 140,
        limit: 5,
        nextCursor: null,
      });

    const total = (
      component as unknown as { totalPacientes: () => number | null }
    ).totalPacientes();
    expect(total).toBe(140);
  });

  it('el listado vacío es S3, no una lista de cero filas', () => {
    crear({ sub: 'u-1', roles: ['SECURITY_ADMIN'], tenants: ['t-1'] });
    responder([], null);

    http
      .expectOne((request) => request.url.includes('/profiles/patients'))
      .flush({ items: [], count: 0, limit: 5, nextCursor: null });

    const pacientes = (component as unknown as { pacientes: () => { status: string } }).pacientes();
    expect(pacientes.status).toBe('empty');
  });

  /* -- Carril 02 · «Tus accesos» dejó de ser una lista y pasó a ser un árbol -- */

  describe('Tus accesos', () => {
    function abrirPanel(roles: readonly string[]): void {
      crear({ sub: 'u-1', roles, tenants: ['t-1'] });
      responder([], null);
    }

    function raiz(): HTMLElement {
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    function zonas(): readonly HTMLButtonElement[] {
      return [...raiz().querySelectorAll<HTMLButtonElement>('[data-testid="panel-zona"]')];
    }

    function accesos(): readonly HTMLAnchorElement[] {
      return [...raiz().querySelectorAll<HTMLAnchorElement>('[data-testid="panel-acceso"]')];
    }

    function abrirZona(id: string): void {
      zonas()
        .find((zona) => zona.dataset['zona'] === id)
        ?.click();
      fixture.detectChanges();
    }

    function volver(): void {
      raiz().querySelector<HTMLButtonElement>('[data-testid="panel-zona-volver"]')?.click();
      fixture.detectChanges();
    }

    /** Todas las rutas del árbol, zona por zona. */
    function todasLasRutas(): readonly string[] {
      const rutas: string[] = [];
      for (const id of zonas().map((zona) => zona.dataset['zona'] ?? '')) {
        abrirZona(id);
        rutas.push(...accesos().map((acceso) => acceso.dataset['ruta'] ?? ''));
        volver();
      }
      return rutas;
    }

    it('la doctora ve cinco puertas, no las treinta y dos secciones de un tirón', () => {
      // Un rol de trabajo: desde J6 el paciente tiene su propio panel y éste no
      // lo ve. Lo que se prueba acá es la forma del acceso, no el rol.
      abrirPanel(['PRACTITIONER']);

      expect(zonas().length).toBeGreaterThan(0);
      expect(zonas().length).toBeLessThanOrEqual(MAXIMO_DE_ZONAS);
      // Y ni un acceso a la vista antes de abrir una: ése era todo el problema.
      expect(accesos()).toHaveLength(0);
    });

    it('adentro de una zona están las secciones, con su ícono y su ruta real', () => {
      abrirPanel(['PRACTITIONER']);
      abrirZona('consulta');

      const primero = accesos()[0];
      expect(primero.querySelector('app-nav-icon svg')).not.toBeNull();
      expect(primero.getAttribute('href')).toBe(primero.dataset['ruta']);
      expect(accesos().map((a) => a.dataset['ruta'])).toContain('/progress-notes');
    });

    it('el árbol sigue saliendo del registro: no pierde ninguna sección por el camino', () => {
      // Ésta es la garantía que el escalón nuevo podía romper en silencio. El
      // panel y el guard salen del mismo registro; si el reparto se olvidara de
      // una sección, acá se vería como una ruta que falta y no como un error.
      abrirPanel(['PRACTITIONER']);

      const rutas = todasLasRutas();
      expect(rutas).toContain('/schedule');
      expect(rutas).toContain('/glossary');
      expect(rutas).toContain('/tutorials');
      // El panel dentro del panel no: es un enlace a la pantalla en la que ya
      // estás, y ocupaba un lugar de los treinta y dos.
      expect(rutas).not.toContain('/dashboard');
    });

    it('la Guía de profesionales no está en ninguna zona de la doctora', () => {
      // Corrección #2. El panel sale de `NavigationService`, el mismo origen
      // que el menú, así que esto también fija que no se puedan desincronizar.
      abrirPanel(['PRACTITIONER', 'CLINICIAN']);

      expect(todasLasRutas()).not.toContain('/directory');
    });
  });

  /* -- H-07: la tarjeta «Tu cuenta» no filtra vocabulario de sistema --------- */

  describe('Tu cuenta', () => {
    const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

    function tarjeta(): HTMLElement {
      fixture.detectChanges();
      const raiz = fixture.nativeElement as HTMLElement;
      return raiz.querySelector<HTMLElement>('[data-testid="panel-sesion"]') as HTMLElement;
    }

    it('nombra el rol en palabras y no muestra ningún identificador ni habla del token', () => {
      crear({
        sub: '11111111-1111-4111-8111-111111111111',
        roles: ['USER', 'PRACTITIONER'],
        tenants: ['22222222-2222-4222-8222-222222222222'],
        tenantNames: { '22222222-2222-4222-8222-222222222222': 'Clínica Norte' },
      });
      responder([], null);

      const texto = tarjeta().textContent ?? '';
      expect(texto).not.toMatch(UUID);
      expect(texto).not.toMatch(/token/i);
      expect(texto).not.toContain('PRACTITIONER');
      expect(texto).not.toContain('USER');
      expect(texto).toContain('Clínica Norte');

      // El código sigue disponible para las pruebas de extremo a extremo, pero
      // fuera del texto: en `data-role`.
      const insignias = [...tarjeta().querySelectorAll('[data-testid="panel-roles"] app-badge')];
      expect(insignias.map((i) => i.textContent?.trim())).toEqual(['Profesional sanitario']);
      expect(insignias.map((i) => i.getAttribute('data-role'))).toEqual(['PRACTITIONER']);
    });

    it('sin roles sigue diciendo que no hay ninguno', () => {
      crear({ sub: 'u-1', roles: [], tenants: ['t-1'] });
      responder([], null);

      expect(tarjeta().querySelectorAll('app-badge')).toHaveLength(0);
      expect(tarjeta().querySelector('[data-testid="panel-roles"] .panel__vacio')).not.toBeNull();
    });
  });

  it('si el historial de verificación falla, el panel sigue en pie', () => {
    // Es información de contexto: romper el panel entero porque el módulo de
    // identidad no contestó sería peor que un panel sin ese dato.
    session.start({
      accessToken: jwt({ sub: 'u-1', roles: [], tenants: [] }),
      refreshToken: 'r-1',
    });
    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;

    http
      .expectOne((request) => request.url.endsWith('/identity/me/verification-cases'))
      .error(new ProgressEvent('error'), { status: 500, statusText: 'Server Error' });
    resolverEstadosDeCaso(http);
    responder([{ a: 1 }], null);

    expect(estado().status).toBe('ready');
    const sello = (component as unknown as { selloDeIdentidad: () => unknown }).selloDeIdentidad();
    expect(sello).toBeNull();
  });

  describe('el aviso del alta incompleta (TJ-1)', () => {
    /** Responde el avance del alta con las etapas cumplidas que se pidan. */
    function responderAlta(cumplidas: number, firstIncomplete: string): void {
      const claves = ['professional-data', 'photo', 'organizations', 'schedule', 'review'];
      http
        .expectOne((request) => request.url.endsWith('/practitioners/me/onboarding'))
        .flush({
          practitionerProfileId: 'hp-1',
          steps: claves.map((key, indice) => ({
            key,
            complete: indice < cumplidas,
            missing: indice < cumplidas ? [] : ['algo'],
          })),
          firstIncomplete,
        });
      fixture.detectChanges();
    }

    it('un profesional con el alta a medias ve el aviso, con cuánto le falta', () => {
      crear({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'] });
      responder([], null);
      responderAlta(2, 'organizations');

      const texto: string = fixture.nativeElement.textContent;
      expect(texto).toContain('Completá tu perfil');
      expect(texto).toContain('2 de 5');
    });

    it('con el alta completa no hay aviso: no se le recuerda algo que ya hizo', () => {
      crear({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'] });
      responder([], null);
      responderAlta(5, 'done');

      expect(fixture.nativeElement.textContent).not.toContain('Completá tu perfil');
    });

    it('si la lectura falla no inventa un aviso', () => {
      crear({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'] });
      responder([], null);
      http
        .expectOne((request) => request.url.endsWith('/practitioners/me/onboarding'))
        .flush(null, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();

      // Decirle a alguien que le falta algo sin saberlo es peor que no avisar.
      expect(fixture.nativeElement.textContent).not.toContain('Completá tu perfil');
    });

    it('a quien no atiende no se le pregunta siquiera', () => {
      crear({ sub: 'u-1', roles: ['SECURITY_ADMIN'], tenants: ['t-1'] });
      responder([], null);
      // Este rol sí lista pacientes; se responde para que el `verify()` del
      // teardown hable sólo de lo que esta prueba mira.
      http
        .expectOne((request) => request.url.includes('/profiles/patients'))
        .flush({ items: [], count: 0, limit: 5, nextCursor: null });

      http.expectNone((request) => request.url.endsWith('/practitioners/me/onboarding'));
    });
  });
});
