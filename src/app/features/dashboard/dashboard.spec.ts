import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../core/auth/session.store';
import { MAXIMO_DE_ZONAS } from '../../core/navigation/access-tree';
import { Dashboard } from './dashboard';

/**
 * El panel concentra **cuatro reglas de producto** que nada más fija, y son las
 * que un refactor rompería en silencio:
 *
 * 1. **El panel abre con el trabajo, no con el sistema.** El 19/09/2026 el
 *    propietario mandó sacar del inicio de sesión del médico «Tu cuenta», el
 *    conteo del directorio público y las cifras de secciones y organizaciones.
 *    Ninguno volvió a colarse: acá se comprueba por el texto y por el
 *    identificador de prueba, que es lo único que sobrevive a un renombre de
 *    clase.
 * 2. **La jornada es de quien atiende.** Se dibuja con el perfil profesional
 *    del token, no con el rol: una cuenta con `PRACTITIONER` y sin perfil no
 *    tiene agenda que buscar y se quedaría mirando un hueco.
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
      // El aviso de puesta en marcha y la jornada cuelgan de sendos
      // `@defer (on immediate)`, y con el comportamiento por defecto
      // —`Playthrough`— su carga es un `import()` real: según cuánto tarde, la
      // petición que hacen al construirse cae adentro o afuera de la prueba.
      // Local resolvía tarde y no se notaba; en CI, con la máquina cargada,
      // resolvía a tiempo y volteaba la primera prueba del bloque con un
      // `timeout` de 5 s.
      //
      // `Manual` no es esquivar el problema: estas pruebas hablan del panel, no
      // de lo diferido, cuya conducta fijan sus propias pruebas —las de
      // `setup-notice` y las de `agenda-de-hoy`—.
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
  }

  function raiz(): HTMLElement {
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  /* -- 1 · lo que el propietario mandó sacar (19/09/2026) -------------------- */

  describe('el panel abre con el trabajo, no con el sistema', () => {
    /**
     * Los cuatro bloques retirados, por su identificador de prueba.
     *
     * Por `data-testid` y no sólo por el texto: el texto se puede reescribir
     * sin que el bloque desaparezca, y al revés —un bloque que vuelva con otro
     * título seguiría siendo el mismo bloque—. Se comprueban los dos.
     */
    const RETIRADOS: readonly string[] = [
      'panel-sesion',
      'panel-directorio',
      'panel-cifra-secciones',
      'panel-cifra-organizaciones',
      'panel-cifra-identidad',
    ];

    it('ni «Tu cuenta», ni el directorio, ni las cifras de sistema', () => {
      crear({
        sub: '11111111-1111-4111-8111-111111111111',
        roles: ['PRACTITIONER', 'CLINICIAN'],
        tenants: ['22222222-2222-4222-8222-222222222222'],
        tenantNames: { '22222222-2222-4222-8222-222222222222': 'Clínica Norte' },
      });

      const panel = raiz();
      for (const testid of RETIRADOS) {
        expect(panel.querySelector(`[data-testid="${testid}"]`), testid).toBeNull();
      }

      const texto = panel.textContent ?? '';
      expect(texto).not.toContain('Tu cuenta');
      expect(texto).not.toContain('Directorio público');
      expect(texto).not.toContain('Secciones disponibles');
      expect(texto).not.toContain('Organizaciones');
    });

    it('y tampoco pide el directorio: una tarjeta que no se dibuja no gasta una lectura', () => {
      crear({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'] });
      raiz();

      // El `verify()` del teardown es el que ata esto: una petición de más
      // dejaría la prueba en rojo.
      http.expectNone((request) => request.url.endsWith('/public/directory'));
      http.expectNone((request) => request.url.endsWith('/identity/me/verification-cases'));
    });
  });

  /* -- 2 · la jornada es de quien atiende ----------------------------------- */

  describe('la franja de hoy', () => {
    function hayJornada(): boolean {
      return (component as unknown as { atiendePacientes: () => boolean }).atiendePacientes();
    }

    it('con perfil profesional en el token, el panel monta la jornada', () => {
      crear({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'], hpid: 'hp-1' });
      raiz();

      expect(hayJornada()).toBe(true);
      // Diferida: el bloque existe aunque su contenido todavía no se haya
      // cargado, que es lo que `DeferBlockBehavior.Manual` deja ver.
      expect(fixture.getDeferBlocks()).resolves.not.toHaveLength(0);
    });

    it('sin perfil profesional no hay jornada, aunque el rol diga que atiende', () => {
      // El caso que separa las dos preguntas: el rol está, el perfil no. Buscar
      // la agenda por rol dejaría a esta cuenta mirando una franja vacía para
      // siempre.
      crear({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'] });
      raiz();

      expect(hayJornada()).toBe(false);
    });

    it('a una cuenta administrativa se le habla de sus accesos, no de su jornada', () => {
      crear({ sub: 'u-1', roles: ['SECURITY_ADMIN'], tenants: ['t-1'] });
      http
        .expectOne((request) => request.url.includes('/profiles/patients'))
        .flush({ items: [], count: 0, limit: 5, nextCursor: null });

      expect(hayJornada()).toBe(false);
      expect(raiz().textContent).toContain('Todo lo que tu cuenta habilita');
    });
  });

  /* -- 3 y 4 · los pacientes de la organización ----------------------------- */

  it('sin rol de administración NO pide el listado de pacientes', () => {
    crear({ sub: 'u-1', roles: ['PATIENT'], tenants: ['t-1'] });

    // `verify()` en el afterEach es el que ata esto: si el panel hubiera pedido
    // el listado, quedaría una petición abierta y la prueba fallaría.
    http.expectNone((request) => request.url.includes('/profiles/patients'));
  });

  it('con SECURITY_ADMIN pide el listado y toma el total de `count`, no de las filas', () => {
    crear({ sub: 'u-1', roles: ['SECURITY_ADMIN'], tenants: ['t-1'] });

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

    // Y el total se dice al lado del título, que es donde quedó al desaparecer
    // la tarjeta de cifra: si sólo viviera en la señal, nadie lo vería.
    expect(raiz().querySelector('[data-testid="panel-total-pacientes"]')?.textContent).toContain(
      '140',
    );
  });

  it('el listado vacío es S3, no una lista de cero filas', () => {
    crear({ sub: 'u-1', roles: ['SECURITY_ADMIN'], tenants: ['t-1'] });

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
      expect(rutas).toContain('/medical-records');
      // «Mi cuenta» y los tutoriales no (19/09/2026): los abre el perfil y
      // la pantalla que cada tutorial explica.
      expect(rutas).not.toContain('/tutorials');
      expect(rutas).not.toContain('/my-account');
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

    it('el atajo a la agenda ya no vive acá: la jornada trae el suyo', () => {
      // ALV-018 puso un «Ver mi agenda de hoy» dentro de esta tarjeta. Con la
      // franja de hoy encabezando el panel —y su botón a la agenda completa—,
      // dos puertas a lo mismo en la misma pantalla se leen como dos destinos.
      abrirPanel(['PRACTITIONER', 'CLINICIAN']);

      expect(raiz().querySelector('[data-testid="panel-agenda-directa"]')).toBeNull();
    });
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
      responderAlta(2, 'organizations');

      const texto: string = fixture.nativeElement.textContent;
      expect(texto).toContain('Completá tu perfil');
      expect(texto).toContain('2 de 5');
    });

    it('con el alta completa no hay aviso: no se le recuerda algo que ya hizo', () => {
      crear({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'] });
      responderAlta(5, 'done');

      expect(fixture.nativeElement.textContent).not.toContain('Completá tu perfil');
    });

    it('si la lectura falla no inventa un aviso', () => {
      crear({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'] });
      http
        .expectOne((request) => request.url.endsWith('/practitioners/me/onboarding'))
        .flush(null, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();

      // Decirle a alguien que le falta algo sin saberlo es peor que no avisar.
      expect(fixture.nativeElement.textContent).not.toContain('Completá tu perfil');
    });

    it('a quien no atiende no se le pregunta siquiera', () => {
      crear({ sub: 'u-1', roles: ['SECURITY_ADMIN'], tenants: ['t-1'] });
      // Este rol sí lista pacientes; se responde para que el `verify()` del
      // teardown hable sólo de lo que esta prueba mira.
      http
        .expectOne((request) => request.url.includes('/profiles/patients'))
        .flush({ items: [], count: 0, limit: 5, nextCursor: null });

      http.expectNone((request) => request.url.endsWith('/practitioners/me/onboarding'));
    });
  });
});
