import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../../core/auth/session.store';
import { resolverEstadosDeCaso } from '../../../../testing/case-status';
import { MyProfile } from './my-profile';

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

/**
 * El resumen propio no pide rol y, desde F-34, tampoco identidad verificada: el
 * backend responde 200 a todo paciente y omite el código de quien no verificó.
 * Lo que más importa acá son dos cosas — que sin verificar la persona vea sus
 * datos con el código como fila pendiente, y que el 403 de la API anterior siga
 * llegando como una puerta con salida y no como un muro.
 */
const ESTADO = '22222222-2222-4222-8222-222222222222';

const RESUMEN = {
  personId: 'p-1',
  patientProfileId: 'pp-1',
  patientCode: 'PAC-1',
  displayName: 'Ana Salas',
  birthDate: '1985-03-14',
  personStatus: ESTADO,
  identityVerified: true,
};

/** El mismo resumen de quien todavía no verificó: sin código, como lo manda la API. */
const RESUMEN_SIN_VERIFICAR = {
  personId: 'p-1',
  patientProfileId: 'pp-1',
  displayName: 'Ana Salas',
  birthDate: '1985-03-14',
  personStatus: ESTADO,
  identityVerified: false,
};


/**
 * Atiende la lectura del perfil completo, que la tarjeta pide junto al resumen.
 *
 * Va como ayuda y no dentro de cada prueba porque **ninguna de las 19 la
 * afirma**: sostienen el resumen, los roles y la verificación. Sin responderla,
 * `verify()` protesta por una petición abierta en todas.
 *
 * Por defecto responde un perfil vacío: quien quiera probar los bloques nuevos
 * le pasa lo suyo.
 */
function resolverPerfilCompleto(
  http: HttpTestingController,
  perfil: Record<string, unknown> = {},
): void {
  const pendientes = http.match('/profiles/patients/me');
  for (const req of pendientes) {
    req.flush({
      personId: 'per-1',
      patientProfileId: 'pp-1',
      identityVerified: false,
      coverages: [],
      guardians: [],
      ...perfil,
    });
  }
}

describe('MyProfile', () => {
  let fixture: ComponentFixture<MyProfile>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyProfile],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MyProfile);
    http = TestBed.inject(HttpTestingController);
    // Los sellos de verificación salen de terminología: sin responder esa
    // búsqueda quedan en neutro y `verify()` protesta.
    resolverEstadosDeCaso(http);
    fixture.detectChanges();
    resolverPerfilCompleto(http);

    // El historial de verificación **ya no se pide**: la ficha está apagada
    // mientras `VERIFICACION_DE_IDENTIDAD_OFRECIDA` sea `false`, y una lectura
    // para una ficha que no se dibuja es una petición para nadie. Se afirma acá
    // —y no en una prueba suelta— porque es lo que sostiene el `verify()` de
    // todas las demás.
    http.expectNone('/identity/me/verification-cases');
  });

  afterEach(() => http.verify());

  /**
   * La ficha muestra TODO lo que la persona declaró.
   *
   * Mostraba tres campos de quince: el documento, el correo, las direcciones,
   * los seguros y el tutor ya viajaban en `GET /profiles/patients/me` y no se
   * pintaban. Lo que estas pruebas fijan es que se vean, y que lo que no
   * declaró **no ocupe lugar**: una lista de «Sin registrar» no informa.
   */
  describe('los datos completos', () => {
    /**
     * Pone el perfil y devuelve el texto de la pantalla.
     *
     * Se escribe la señal en vez de responder la petición porque el arnés ya la
     * atendió en su `beforeEach` —y volver a responderla rompe las 19 pruebas
     * que sostienen el resto—. Lo que estas pruebas miran es la PLANTILLA: qué
     * se dibuja con qué datos.
     */
    function conPerfil(perfil: Record<string, unknown>): string {
      http.expectOne('/profiles/patients/me/summary').flush(RESUMEN);
      // El resumen dispara la lectura del catálogo para traducir el estado.
      http.expectOne((r) => r.url === '/terminology/concepts').flush({
        items: [],
        count: 0,
      });
      // La señal se toma del componente SIN pasar por `interno`: ése liga las
      // funciones al componente, y una señal ES una función — ligada, pierde
      // `.set`.
      const señal = (fixture.componentInstance as unknown as Record<string, { set: (v: unknown) => void }>)[
        'perfil'
      ];
      señal.set({
        personId: 'per-1',
        patientProfileId: 'pp-1',
        identityVerified: false,
        coverages: [],
        guardians: [],
        ...perfil,
      });
      fixture.detectChanges();
      return fixture.nativeElement.textContent as string;
    }

    it('muestra documento, correo, NIT y las dos direcciones', () => {
      const texto = conPerfil({
        nationalId: '7678614',
        email: 'ana@example.test',
        taxId: '1234567890',
        homeAddress: { lines: 'Av. Banzer #1234', city: 'Santa Cruz' },
        workAddress: { lines: 'Calle Warnes #45', city: 'Santa Cruz' },
      });

      expect(texto).toContain('7678614');
      expect(texto).toContain('ana@example.test');
      expect(texto).toContain('1234567890');
      expect(texto).toContain('Av. Banzer #1234');
      expect(texto).toContain('Calle Warnes #45');
    });

    it('los seguros se ven con su aseguradora, su plan y si son públicos', () => {
      const texto = conPerfil({
        coverages: [
          {
            carrierName: 'Alianza Vida Seguros',
            planName: 'AFI Gold',
            isPublic: false,
            verified: false,
          },
          { carrierName: 'Caja Nacional de Salud', isPublic: true, verified: false },
        ],
      });

      expect(texto).toContain('Alianza Vida Seguros');
      expect(texto).toContain('AFI Gold');
      expect(texto).toContain('Caja Nacional de Salud');
      expect(texto).toContain('Público');
      // Lo declarado al registrarse no está confirmado con la aseguradora, y
      // decirlo evita que alguien lo dé por hecho.
      expect(texto).toContain('Sin verificar');
    });

    it('el tutor se ve con su teléfono: es el dato por el que existe', () => {
      const texto = conPerfil({
        guardians: [
          {
            displayName: 'Carlos Mamani',
            phone: '+591 70055443',
            isEmergencyContact: true,
            isLegalGuardian: true,
          },
        ],
      });

      expect(texto).toContain('Carlos Mamani');
      expect(texto).toContain('+591 70055443');
      expect(texto).toContain('Tutor legal');
    });

    it('lo que no declaró NO se dibuja: nada de listas de «Sin registrar»', () => {
      const texto = conPerfil({});

      expect(texto).not.toContain('Documento de identidad');
      expect(texto).not.toContain('NIT');
      expect(texto).not.toContain('Tus seguros');
      expect(texto).not.toContain('Contactos y tutores');
    });

    it('la edad se calcula de la fecha, no se pide al servidor', () => {
      // El registro del cliente la pide «de manera automática».
      const nacimiento = new Date();
      nacimiento.setFullYear(nacimiento.getFullYear() - 34);
      const texto = conPerfil({ birthDate: nacimiento });

      expect(texto).toContain('34 años');
    });
  });

  function interno<T>(nombre: string): T {
    const valor = (fixture.componentInstance as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(fixture.componentInstance) : valor) as T;
  }

  function estado() {
    return interno<() => { status: string; nextAction?: { route?: string; label: string } }>(
      'resumen',
    )();
  }

  it('no manda ningún identificador: el sujeto lo resuelve la sesión', () => {
    const req = http.expectOne('/profiles/patients/me/summary');

    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);

    req.flush(RESUMEN);
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .flush({
        items: [],
        count: 0,
        limit: 50,
      });
  });

  /**
   * La ficha del vault lo pide con estas palabras: «la vista debe ofrecer el
   * camino para verificarse, no un error seco». La pantalla no escribe una sola
   * línea sobre este caso — lo resuelve la traducción de errores, y esta prueba
   * es la que verifica que de verdad llega.
   */
  it('sin identidad verificada, el 403 llega con la puerta a verificarse', () => {
    http.expectOne('/profiles/patients/me/summary').flush(
      {
        code: 'IDENTITY_VERIFICATION_REQUIRED',
        message: 'Necesitás verificar tu identidad para continuar.',
      },
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();

    const actual = estado();
    expect(actual.status).toBe('forbidden');
    expect(actual.nextAction?.route).toBe('/my-account/identity/verify');
  });

  it('un 403 corriente NO ofrece salida: no hay nada que la persona pueda hacer', () => {
    http
      .expectOne('/profiles/patients/me/summary')
      .flush(
        { code: 'FORBIDDEN', message: 'No tenés acceso a este recurso.' },
        { status: 403, statusText: 'Forbidden' },
      );
    fixture.detectChanges();

    const actual = estado();
    expect(actual.status).toBe('forbidden');
    // Inventar una acción sería mandarla a un lugar donde tampoco va a poder.
    expect(actual.nextAction).toBeUndefined();
  });

  it('traduce el estado de la persona a palabras', () => {
    http.expectOne('/profiles/patients/me/summary').flush(RESUMEN);
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .flush({
        items: [
          { conceptId: ESTADO, code: 'ACTIVE', display: 'Activa', codeSystemVersionId: 'c-1' },
        ],
        count: 1,
        limit: 50,
      });
    fixture.detectChanges();

    expect(interno<() => string>('estado')()).toBe('Activa');
  });

  it('si el catálogo falla, el resumen se muestra igual y sin uuid a la vista', () => {
    http.expectOne('/profiles/patients/me/summary').flush(RESUMEN);
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .error(new ProgressEvent('error'), { status: 500 });
    fixture.detectChanges();

    expect(estado().status).toBe('ready');
    expect(interno<() => string>('estado')()).toBe('Sin determinar');
  });

  /**
   * El historial de verificación es una petición aparte **a propósito**.
   *
   * Encadenarlo al resumen lo dejaría fuera justo en el caso en que más importa:
   * el 403 que pide verificar la identidad. Quien cae ahí necesita ver si su
   * trámite ya está en curso, y con las peticiones encadenadas no vería nada.
   */
  it('el historial sobrevive al 403 del resumen', () => {
    http
      .expectOne('/profiles/patients/me/summary')
      .flush(
        { code: 'IDENTITY_VERIFICATION_REQUIRED', message: 'Verificá tu identidad.' },
        { status: 403, statusText: 'Forbidden' },
      );
    fixture.detectChanges();

    expect(estado().status).toBe('forbidden');
    // El historial se respondió en el beforeEach: llegó y no lo tumbó el 403.
    expect(interno<() => readonly unknown[]>('casosOrdenados')()).toEqual([]);
  });

  /* -- H-07: la pantalla no filtra vocabulario de sistema ni ids internos ---- */

  function responderResumen(): void {
    http.expectOne('/profiles/patients/me/summary').flush(RESUMEN);
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .flush({
        items: [],
        count: 0,
        limit: 50,
      });
    fixture.detectChanges();
  }

  it('«Tu acceso» nombra el rol en palabras, con el código sólo en data-role', () => {
    // La sesión se abre después de crear la pantalla: las insignias derivan de
    // una señal, así que reaccionan igual. Con un rol de trabajo, porque desde
    // F-22 la tarjeta no se le muestra a un paciente.
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['USER', 'PRACTITIONER'], tenants: ['t-1'] }),
      refreshToken: 'r-1',
    });
    responderResumen();

    const insignias = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.mi-perfil__roles app-badge'),
    ];
    expect(insignias.map((i) => i.textContent?.trim())).toEqual(['Profesional sanitario']);
    expect(insignias.map((i) => i.getAttribute('data-role'))).toEqual(['PRACTITIONER']);
  });

  /**
   * F-22. «Organización: Care Default Tenant» y «Roles: Paciente» responden a
   * «¿por qué no veo tal cosa?», una pregunta de quien trabaja acá. Un paciente
   * no tiene secciones que le falten: tiene lo suyo.
   */
  it('a un paciente no se le muestra «Tu acceso» ni su organización', () => {
    TestBed.inject(SessionStore).start({
      accessToken: jwt({
        sub: 'u-1',
        roles: ['USER', 'PATIENT'],
        tenants: ['t-1'],
        tenantNames: { 't-1': 'Care Default Tenant' },
      }),
      refreshToken: 'r-1',
    });
    responderResumen();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('[data-testid="mi-perfil-acceso"]')).toBeNull();
    expect(raiz.textContent).not.toContain('Tu acceso');
    expect(raiz.textContent).not.toContain('Care Default Tenant');
    expect(raiz.textContent).not.toContain('Organización');
  });

  /** Quien atiende y además es paciente entra a trabajar: la tarjeta le sirve. */
  it('a quien atiende sí se le muestra, aunque además sea paciente', () => {
    TestBed.inject(SessionStore).start({
      accessToken: jwt({
        sub: 'u-1',
        roles: ['PATIENT', 'PRACTITIONER'],
        tenants: ['t-1'],
      }),
      refreshToken: 'r-1',
    });
    responderResumen();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="mi-perfil-acceso"]'),
    ).not.toBeNull();
  });

  it('los identificadores del perfil y la persona ya no se muestran', () => {
    responderResumen();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('.mi-perfil__ids')).toBeNull();
    expect(raiz.textContent).not.toContain(RESUMEN.patientProfileId);
    // El código de paciente sí: es la referencia que la persona puede dar.
    expect(raiz.textContent).toContain(RESUMEN.patientCode);
  });

  /* -- I-D (F-18): el 403 por identidad es el estado normal, no un error ---- */

  function alertaDeDatos(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(
      '.mi-perfil__bloque app-view-state-host app-alert',
    );
  }

  it('sin identidad verificada, «Tus datos» lo dice en neutro y con la salida a mano', () => {
    // Todo paciente recién registrado pasa por acá: pintarlo como «No tenés
    // acceso» en rojo lee como que algo se rompió, y el mensaje crudo del
    // backend habla de usted (feedback de la analista, barrido del 18/08/2026).
    http
      .expectOne('/profiles/patients/me/summary')
      .flush(
        { code: 'IDENTITY_VERIFICATION_REQUIRED', message: 'Verifique su identidad.' },
        { status: 403, statusText: 'Forbidden' },
      );
    fixture.detectChanges();

    const alerta = alertaDeDatos();
    expect(alerta?.classList.contains('alert--info')).toBe(true);
    expect(alerta?.textContent).toContain('cuando tu identidad esté verificada');
    expect(alerta?.textContent).not.toContain('No tenés acceso');
    expect(alerta?.textContent).not.toContain('Verifique su identidad');
    expect(alerta?.querySelector('a[href="/my-account/identity/verify"]')).not.toBeNull();
  });

  it('un 403 corriente sigue siendo un muro, y se pinta como tal', () => {
    http
      .expectOne('/profiles/patients/me/summary')
      .flush(
        { code: 'FORBIDDEN', message: 'No tenés acceso a este recurso.' },
        { status: 403, statusText: 'Forbidden' },
      );
    fixture.detectChanges();

    const alerta = alertaDeDatos();
    expect(alerta?.classList.contains('alert--error')).toBe(true);
    expect(alerta?.textContent).toContain('No tenés acceso a esta sección');
    // El motivo que dio el backend se conserva, como lo haría el host de estados.
    expect(alerta?.textContent).toContain('No tenés acceso a este recurso.');
    expect(alerta?.querySelector('a')).toBeNull();
  });

  /* -- F-34: el perfil no depende de verificarse ---------------------------- */

  /**
   * La invitación del pie de la lista. Se busca acotada a la columna principal
   * porque `mi-perfil__nota` también rotula los enlaces del lateral, y el 403
   * pinta su propio enlace dentro de la alerta: sin acotar, las tres cosas se
   * confundirían entre sí.
   */
  function invitacionAVerificar(): HTMLAnchorElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      '.mi-perfil__principal p.mi-perfil__nota a',
    );
  }

  /** La lista de datos de «Tus datos» — no la de «Tu acceso», que comparte clase. */
  function listaDeDatos(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector(
      '.mi-perfil__principal .mi-perfil__datos',
    );
  }

  /**
   * Con la verificación apagada, quien no la tiene ve **sus datos y nada más**.
   *
   * Ni la insignia «Pendiente de verificación» ni la invitación: las dos nombran
   * un trámite que el producto hoy no ofrece, y anunciar que falta algo que no
   * se puede hacer deja a la persona buscando una puerta que no está. Lo que la
   * tarjeta vacía tapaba —nombre, nacimiento y estado— sigue en pie, que es lo
   * que F-34 vino a resolver.
   */
  it('sin verificar, la persona ve sus datos y no se le nombra un trámite que no se ofrece', () => {
    http.expectOne('/profiles/patients/me/summary').flush(RESUMEN_SIN_VERIFICAR);
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .flush({
        items: [
          { conceptId: ESTADO, code: 'ACTIVE', display: 'Activa', codeSystemVersionId: 'c-1' },
        ],
        count: 1,
        limit: 50,
      });
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    const texto = raiz.textContent ?? '';
    expect(texto).toContain('Ana Salas');
    expect(texto).toContain('14/03/1985');
    expect(texto).toContain('Activa');
    // Sin código no se inventa uno, y tampoco se deja el renglón anunciando
    // que falta un trámite: la fila entera no se dibuja.
    expect(raiz.querySelector('[data-testid="mi-perfil-codigo"]')).toBeNull();
    expect(texto).not.toContain('Código de paciente');
    expect(texto).not.toContain('Pendiente de verificación');
    expect(texto).not.toContain('PAC-');
    expect(texto).not.toContain('cuando tu identidad esté verificada');
    expect(invitacionAVerificar()).toBeNull();
  });

  it('verificada, ve su código y ya no se le invita a verificarse', () => {
    responderResumen();

    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain(RESUMEN.patientCode);
    expect(texto).not.toContain('Pendiente de verificación');
    expect(invitacionAVerificar()).toBeNull();
  });

  /**
   * Compatibilidad: mientras la API anterior siga desplegada, el 403 tiene que
   * pintar exactamente la tarjeta neutra de antes — ni la lista de datos ni la
   * invitación se cuelan por ese camino.
   */
  it('con el 403 de la API anterior no se cuelan ni la lista ni la invitación', () => {
    http
      .expectOne('/profiles/patients/me/summary')
      .flush(
        { code: 'IDENTITY_VERIFICATION_REQUIRED', message: 'Verificá tu identidad.' },
        { status: 403, statusText: 'Forbidden' },
      );
    fixture.detectChanges();

    expect(alertaDeDatos()?.textContent).toContain('cuando tu identidad esté verificada');
    expect(listaDeDatos()).toBeNull();
    expect(invitacionAVerificar()).toBeNull();
  });
});

/**
 * El orden del historial es lo que decide cuál se muestra como vigente, y el
 * backend no lo garantiza. Va en su propio `describe` porque necesita responder
 * el historial con datos, y el `beforeEach` de arriba ya lo respondió vacío.
 */
describe('MyProfile · orden del historial', () => {
  let fixture: ComponentFixture<MyProfile>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyProfile],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MyProfile);
    http = TestBed.inject(HttpTestingController);
    // Los sellos de verificación salen de terminología: sin responder esa
    // búsqueda quedan en neutro y `verify()` protesta.
    resolverEstadosDeCaso(http);
    fixture.detectChanges();
    resolverPerfilCompleto(http);
  });

  afterEach(() => http.verify());

  /**
   * Se escriben los casos **a mano** en vez de responderlos por la red: con la
   * verificación apagada la pantalla ya no los pide, y la regla de cuál es el
   * vigente sigue siendo suya. Probarla acá es lo que hace que volver a
   * encender la ficha no estrene un orden distinto del que tenía.
   */
  it('el caso vigente es el más reciente, y el cierre manda sobre la apertura', () => {
    const casos = (
      fixture.componentInstance as unknown as {
        casos: { set: (valor: readonly unknown[]) => void };
      }
    ).casos;
    // Fechas ya como `Date`, que es lo que el cliente entrega: el componente las
    // ordena por `getTime()`, no por la cadena de la API.
    casos.set([
      // Abierto después, pero sin resolver.
      { id: 'c-viejo', status: 'PENDING', openedAt: new Date('2026-01-10T10:00:00.000Z') },
      // Abierto antes y resuelto **después**: es el más reciente de los dos.
      {
        id: 'c-nuevo',
        status: 'APPROVED',
        openedAt: new Date('2026-01-05T10:00:00.000Z'),
        completedAt: new Date('2026-02-01T10:00:00.000Z'),
      },
    ]);
    http
      .expectOne('/profiles/patients/me/summary')
      .error(new ProgressEvent('error'), { status: 500 });
    fixture.detectChanges();

    const vigente = (
      fixture.componentInstance as unknown as { casoVigente: () => { id: string } | null }
    ).casoVigente();
    expect(vigente?.id).toBe('c-nuevo');
  });
});

/**
 * La salida a corregir los datos propios.
 *
 * Va en su propio `describe` porque hace falta abrir la sesión **antes** de
 * crear la pantalla: `esProfesional()` decide en el constructor qué resumen se
 * pide, y una sesión abierta después ya no cambia esa decisión.
 */
describe('MyProfile · el enlace a editar los datos propios', () => {
  let fixture: ComponentFixture<MyProfile>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyProfile],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** Abre la sesión con los claims que se le pasen y monta la pantalla. */
  function montar(claims: Record<string, unknown>): void {
    TestBed.inject(SessionStore).start({ accessToken: jwt(claims), refreshToken: 'r-1' });
    fixture = TestBed.createComponent(MyProfile);
    resolverEstadosDeCaso(http);
    fixture.detectChanges();
    resolverPerfilCompleto(http);
    // El historial ya no se pide: la ficha está apagada. Ver el `beforeEach` del
    // primer describe, que lo afirma con `expectNone`.
    http.expectNone('/identity/me/verification-cases');
  }

  function enlaceDeEdicion(): HTMLAnchorElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      '[data-testid="mi-perfil-editar"]',
    );
  }

  it('la paciente ve la salida a corregir sus datos, con su destino real', () => {
    montar({ sub: 'u-1', roles: ['USER', 'PATIENT'], tenants: ['t-1'] });
    http.expectOne('/profiles/patients/me/summary').flush(RESUMEN);
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .flush({
        items: [],
        count: 0,
        limit: 50,
      });
    fixture.detectChanges();

    const enlace = enlaceDeEdicion();
    expect(enlace?.textContent?.trim()).toBe('Editar tus datos');
    expect(enlace?.getAttribute('href')).toBe('/my-account/profile/edit');
  });

  /**
   * A quien atiende no se le ofrece: el editor lee `GET /profiles/patients/me`,
   * y a un profesional le responde `404` porque no tiene perfil de paciente.
   */
  it('a quien atiende no se le ofrece: no tiene perfil de paciente que editar', () => {
    montar({ sub: 'u-1', hpid: 'hp-1', roles: ['USER', 'PRACTITIONER'], tenants: ['t-1'] });
    http
      .expectOne('/profiles/practitioners/me/summary')
      .error(new ProgressEvent('error'), { status: 500 });
    fixture.detectChanges();

    expect(enlaceDeEdicion()).toBeNull();
  });

  /** Mientras el resumen no llegó no hay nada que editar todavía. */
  it('mientras carga el resumen todavía no se ofrece editar', () => {
    montar({ sub: 'u-1', roles: ['USER', 'PATIENT'], tenants: ['t-1'] });

    expect(enlaceDeEdicion()).toBeNull();

    http.expectOne('/profiles/patients/me/summary').flush(RESUMEN);
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .flush({
        items: [],
        count: 0,
        limit: 50,
      });
    fixture.detectChanges();

    expect(enlaceDeEdicion()).not.toBeNull();
  });
});
