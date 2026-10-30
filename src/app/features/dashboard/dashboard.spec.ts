import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, DeferBlockBehavior, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../core/auth/session.store';
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

    it('ni «Su cuenta», ni el directorio, ni las cifras de sistema', () => {
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
      expect(texto).not.toContain('Su cuenta');
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

    it('a una cuenta administrativa no se le habla de su jornada', () => {
      crear({ sub: 'u-1', roles: ['SECURITY_ADMIN'], tenants: ['t-1'] });
      http
        .expectOne((request) => request.url.includes('/profiles/patients'))
        .flush({ items: [], count: 0, limit: 5, nextCursor: null });

      expect(hayJornada()).toBe(false);
      expect(raiz().textContent).toContain('Las secciones se abren desde el menú');
    });
  });

  /* -- Puertas a bandejas fuera de los menús cerrados (28/10/2026) ---------- */

  describe('franjas de «Mis verificaciones» y de la aseguradora', () => {
    const franja = (id: string) => raiz().querySelector(`[data-testid="${id}"]`);

    it('quien atiende ve «Mis verificaciones» debajo del saludo, no encima', () => {
      crear({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'], hpid: 'hp-1' });
      const enlace = franja('panel-mis-verificaciones');
      const titulo = raiz().querySelector('h1');

      expect(enlace?.querySelector('a')?.getAttribute('href')).toBe('/my-account/verifications');
      expect(
        titulo!.compareDocumentPosition(enlace!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(franja('panel-profesionales-que-piden')).toBeNull();
    });

    it('con perfil profesional pero sin rol de quien atiende, no se ofrece una puerta que la ruta cierra', () => {
      crear({ sub: 'u-1', roles: ['INSURANCE_ANALYST'], tenants: ['t-1'], hpid: 'hp-1' });
      expect(franja('panel-mis-verificaciones')).toBeNull();
    });

    it('la aseguradora activa ve la puerta a los profesionales que piden sumarse', () => {
      crear({
        sub: 'u-1',
        roles: ['INSURANCE_ANALYST'],
        tenants: ['t-1'],
        tenantTypes: { 't-1': 'PAYER' },
      });
      expect(
        franja('panel-profesionales-que-piden')?.querySelector('a')?.getAttribute('href'),
      ).toBe('/administration/insurer-practitioner-requests');
      expect(franja('panel-mis-verificaciones')).toBeNull();
    });

    it('una clínica no la ve: el mismo filtro por tipo de organización que el menú', () => {
      crear({
        sub: 'u-1',
        roles: ['INSURANCE_ANALYST'],
        tenants: ['t-1'],
        tenantTypes: { 't-1': 'HOSPITAL' },
      });
      expect(franja('panel-profesionales-que-piden')).toBeNull();
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

  /* -- 28/10/2026 · «Sus herramientas» se retiró del panel ----------------- */

  describe('Sus herramientas', () => {
    it.each([[['PRACTITIONER', 'CLINICIAN']], [['SECURITY_ADMIN']]])(
      'con %j el panel ya no dibuja el árbol de accesos',
      (roles) => {
        crear({ sub: 'u-1', roles, tenants: ['t-1'] });
        if (roles.includes('SECURITY_ADMIN')) {
          http
            .expectOne((request) => request.url.includes('/profiles/patients'))
            .flush({ items: [], count: 0, limit: 5, nextCursor: null });
        }

        // Repetía el menú lateral con otra forma; el propietario lo mandó sacar.
        expect(raiz().querySelector('[data-testid="panel-accesos"]')).toBeNull();
        expect(raiz().querySelector('[data-testid="panel-zona"]')).toBeNull();
        expect(raiz().textContent).not.toContain('Sus herramientas');
      },
    );
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
      expect(texto).toContain('Complete su perfil');
      expect(texto).toContain('2 de 5');
    });

    it('con el alta completa no hay aviso: no se le recuerda algo que ya hizo', () => {
      crear({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'] });
      responderAlta(5, 'done');

      expect(fixture.nativeElement.textContent).not.toContain('Complete su perfil');
    });

    it('si la lectura falla no inventa un aviso', () => {
      crear({ sub: 'u-1', roles: ['PRACTITIONER'], tenants: ['t-1'] });
      http
        .expectOne((request) => request.url.endsWith('/practitioners/me/onboarding'))
        .flush(null, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();

      // Decirle a alguien que le falta algo sin saberlo es peor que no avisar.
      expect(fixture.nativeElement.textContent).not.toContain('Complete su perfil');
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
