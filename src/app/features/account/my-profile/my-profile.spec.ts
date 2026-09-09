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
      return textoDeTodasLasPestanas();
    }

    /**
     * El texto de la tarjeta con cada pestaña abierta, una tras otra.
     *
     * La ficha es UNA tarjeta con pestañas (pedido del 09/09/2026) y
     * `app-tab` no dibuja el panel que no está abierto: el NIT vive en
     * «Facturación» y los seguros en «Seguros y tutores», así que el texto de
     * la pantalla sin recorrerlas sólo tendría «Datos personales». Se recorren
     * pulsando la tira, que es como lo hace la persona.
     */
    function textoDeTodasLasPestanas(): string {
      const raiz = fixture.nativeElement as HTMLElement;
      const pestanas = [...raiz.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
      if (pestanas.length === 0) {
        return raiz.textContent ?? '';
      }
      const textos: string[] = [];
      for (const pestana of pestanas) {
        pestana.click();
        fixture.detectChanges();
        textos.push(raiz.textContent ?? '');
      }
      pestanas[0].click();
      fixture.detectChanges();
      return textos.join('\n');
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

    /**
     * **Lo que falta también se dibuja — en la ficha PROPIA.**
     *
     * Antes cada dato aparecía sólo si existía, con el argumento de que «una
     * lista de Sin registrar no informa». En la ficha de otro es cierto. Acá no:
     * quien mira es el dueño del dato, y ocultarle el renglón le impide
     * distinguir «no lo tengo cargado» de «la app no me lo muestra». Con el
     * perfil real de Justin se veían **cinco campos de doce**, y siete de los
     * que faltaban estaban en la base.
     *
     * Las SECCIONES enteras sí siguen ocultándose cuando no hay nada: una tarjeta
     * «Tus seguros» vacía es ruido, no un dato pendiente que el dueño pueda
     * completar desde ahí.
     */
    it('en la ficha propia, lo no declarado se dibuja como «Sin registrar»', () => {
      const texto = conPerfil({});

      expect(texto).toContain('Documento de identidad');
      expect(texto).toContain('NIT');
      expect(texto).toContain('Sin registrar');
    });

    it('pero una sección entera sin contenido no aparece', () => {
      const texto = conPerfil({});

      expect(texto).not.toContain('Tus seguros');
      expect(texto).not.toContain('Contactos y tutores');
    });

    /**
     * La API lo devolvía desde siempre y la ficha no lo dibujaba. Y cuando se
     * dibujó, salía **el renglón vacío**: viaja como código (`'FEMALE'`), no
     * como concepto, así que `etiquetaDe` —que resuelve uuids— devolvía ''. Se
     * vio en pantalla antes de que existiera esta prueba.
     */
    it('el sexo al nacer se muestra EN PALABRAS, no como código', () => {
      const texto = conPerfil({ sexAtBirth: 'FEMALE' });

      expect(texto).toContain('Sexo al nacer');
      expect(texto).toContain('Femenino');
      expect(texto).not.toContain('FEMALE');
    });

    /**
     * El registro de procesos pide la ubicación GPS del domicilio (§1.9) y del
     * trabajo (§1.11). `common.addresses` guarda latitud y longitud desde
     * siempre y `OwnAddressDto` ya las devolvía: faltaba dibujarlas.
     */
    it('una dirección con coordenadas ofrece el enlace al mapa', () => {
      const texto = conPerfil({
        homeAddress: {
          lines: 'Av. Beni 5100',
          latitude: '-17.78',
          longitude: '-63.18',
        } as never,
      });

      expect(texto).toContain('Ver en el mapa');
    });

    it('y una sin coordenadas no lo ofrece: no habría adónde llevar', () => {
      const texto = conPerfil({
        homeAddress: { lines: 'Av. Beni 5100' } as never,
      });

      expect(texto).toContain('Av. Beni 5100');
      expect(texto).not.toContain('Ver en el mapa');
    });

    /**
     * El caso que se vio en pantalla: la API comparaba las coordenadas contra
     * `undefined` y la columna es nullable, así que emitía `Number(null)` — o
     * sea **0** — y la ficha enlazaba al golfo de Guinea. La API ya está
     * corregida; este guardia queda igual porque una dirección de Santa Cruz no
     * está en el meridiano de Greenwich.
     */
    it('las coordenadas 0,0 no son una ubicación: no ofrece el mapa', () => {
      const texto = conPerfil({
        homeAddress: { lines: 'Calle Ayacucho 241', latitude: 0, longitude: 0 } as never,
      });

      expect(texto).toContain('Calle Ayacucho 241');
      expect(texto).not.toContain('Ver en el mapa');
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

  /**
   * FT-11-R03/R04. El perfil entra en sólo lectura y «Editar» habilita los
   * campos **acá mismo**, sin cambiar de pantalla: era un enlace a
   * `/my-account/profile/edit`, que es lo que el pedido del cliente corrige.
   *
   * La ruta propia del editor sigue existiendo —puede estar en un favorito— y
   * su prueba vive en `patient-profile-edit.spec.ts`.
   */
  it('la paciente entra en sólo lectura y «Editar» abre el formulario acá mismo', () => {
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

    const raiz = fixture.nativeElement as HTMLElement;
    // Sólo lectura: la lista de datos está, el formulario no.
    expect(raiz.querySelector('[data-testid="mi-perfil-editor"]')).toBeNull();

    const boton = enlaceDeEdicion();
    // Es un botón de lápiz (pedido del 09/09/2026): el nombre va en
    // `aria-label`, no en el texto, y el dibujo es el glifo `edit` del set.
    expect(boton?.getAttribute('aria-label')).toBe('Editar');
    expect(boton?.querySelector('svg')).not.toBeNull();
    // Un botón, no un enlace: no lleva a ninguna parte.
    expect(boton?.tagName).toBe('BUTTON');
    expect(boton?.getAttribute('href')).toBeNull();
  });

  /**
   * FT-11-R07/R08. La contraseña no es un campo del formulario: cambiarla exige
   * verificar quién es la persona, y un campo suelto en el perfil dejaría la
   * credencial a merced de cualquiera que encuentre la sesión abierta.
   */
  it('ofrece cambiar la contraseña por su propio flujo, fuera del formulario', () => {
    montar({ sub: 'u-1', roles: ['USER', 'PATIENT'], tenants: ['t-1'] });
    http.expectOne('/profiles/patients/me/summary').flush(RESUMEN);
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .flush({ items: [], count: 0, limit: 50 });
    fixture.detectChanges();

    const boton = (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>(
      '[data-testid="mi-perfil-cambiar-contrasena"]',
    );
    expect(boton?.textContent?.trim()).toBe('Cambiar contraseña');
    expect(boton?.getAttribute('href')).toBe('/auth/forgot-password');
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

/**
 * La foto de perfil de la persona (`profiles.persons.photo_file_id`).
 *
 * Va en su propio `describe`, con su propio montaje, porque necesita
 * controlar qué trae `GET /profiles/patients/me` en cada prueba —
 * `resolverPerfilCompleto` del arnés compartido siempre responde sin foto.
 */
describe('MyProfile · foto de perfil', () => {
  let fixture: ComponentFixture<MyProfile>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyProfile],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['USER', 'PATIENT'], tenants: ['t-1'] }),
      refreshToken: 'r-1',
    });
    fixture = TestBed.createComponent(MyProfile);
    http = TestBed.inject(HttpTestingController);
    resolverEstadosDeCaso(http);
    fixture.detectChanges();

    // El resumen no importa para estas pruebas: se responde con lo mínimo y
    // se saca de en medio.
    http.expectOne('/profiles/patients/me/summary').flush(RESUMEN_SIN_VERIFICAR);
    http.expectOne((r) => r.url === '/terminology/concepts').flush({ items: [], count: 0 });
  });

  afterEach(() => http.verify());

  /** Fabrica un evento `change` de `<input type="file">` con un solo archivo. */
  function eventoDeArchivo(archivo: File): Event {
    return { target: { files: [archivo], value: '' } } as unknown as Event;
  }

  /** El perfil propio, con lo mínimo obligatorio y lo que se le pase encima. */
  function perfilCon(extra: Record<string, unknown>): Record<string, unknown> {
    return {
      personId: 'per-1',
      patientProfileId: 'pp-1',
      identityVerified: false,
      coverages: [],
      guardians: [],
      ...extra,
    };
  }

  it('sin foto declarada, no pide ninguna URL de descarga', () => {
    http.expectOne('/profiles/patients/me').flush(perfilCon({}));
    fixture.detectChanges();

    http.verify();
  });

  it('con foto ya guardada, baja la imagen y la pinta como data: URL', async () => {
    http.expectOne('/profiles/patients/me').flush(perfilCon({ photoFileId: 'f-1' }));

    // Por `/content` y no por `download-url`: esa firma apunta a
    // `file://local/<sha>` y ningún `<img>` la carga. Era el defecto por el
    // que la foto se guardaba bien y el avatar seguía en iniciales.
    http.expectOne('/common/files/f-1/content').flush(pngFalso());
    await esperarLaFoto(() => fotoDelPerfil(fixture) !== null);
    fixture.detectChanges();

    expect(fotoDelPerfil(fixture)).toMatch(/^data:image\/png;base64,/);
  });

  it('si la imagen no se puede leer, degrada a null sin romper la pantalla', () => {
    http.expectOne('/profiles/patients/me').flush(perfilCon({ photoFileId: 'f-1' }));

    http.expectOne('/common/files/f-1/content').error(new ProgressEvent('error'), { status: 500 });
    fixture.detectChanges();

    expect(fotoDelPerfil(fixture)).toBeNull();
  });

  it('sube la foto elegida, la fija y la pinta', async () => {
    http.expectOne('/profiles/patients/me').flush(perfilCon({}));
    fixture.detectChanges();

    const alElegirFoto = (
      fixture.componentInstance as unknown as { alElegirFoto: (e: Event) => void }
    ).alElegirFoto.bind(fixture.componentInstance);
    alElegirFoto(eventoDeArchivo(new File(['x'], 'foto.png', { type: 'image/png' })));

    const subida = http.expectOne('/common/files/upload');
    expect(subida.request.method).toBe('POST');
    subida.flush({ id: 'f-2' });

    const puesta = http.expectOne('/profiles/patients/me/photo');
    expect(puesta.request.method).toBe('PUT');
    expect(puesta.request.body).toEqual({ fileId: 'f-2' });
    puesta.flush(perfilCon({ photoFileId: 'f-2' }));

    http.expectOne('/common/files/f-2/content').flush(pngFalso());
    await esperarLaFoto(() => fotoDelPerfil(fixture) !== null);
    fixture.detectChanges();

    expect(fotoDelPerfil(fixture)).toMatch(/^data:image\/png;base64,/);
  });

  it('un profesional no ve el control: la tarjeta de paciente no se carga para él', () => {
    // El montaje del `beforeEach` deja `/profiles/patients/me` pendiente:
    // hay que cerrarlo antes de resetear el módulo, o `http.verify()` de
    // ESE arnés protesta por una petición que ya nadie va a responder.
    http.expectOne('/profiles/patients/me').flush(perfilCon({}));

    // Sesión distinta, montaje propio: `esProfesional()` decide en el
    // constructor y una sesión abierta después ya no cambia esa decisión.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [MyProfile],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-2', hpid: 'hp-1', roles: ['USER', 'PRACTITIONER'], tenants: ['t-1'] }),
      refreshToken: 'r-1',
    });
    const otroFixture = TestBed.createComponent(MyProfile);
    const otroHttp = TestBed.inject(HttpTestingController);
    resolverEstadosDeCaso(otroHttp);
    otroFixture.detectChanges();
    otroHttp
      .expectOne('/profiles/practitioners/me/summary')
      .error(new ProgressEvent('error'), { status: 500 });
    otroFixture.detectChanges();

    expect(
      (otroFixture.nativeElement as HTMLElement).querySelector('[data-testid="mi-perfil-foto"]'),
    ).toBeNull();
    otroHttp.verify();
  });
});

/** Lo que la tarjeta tiene hoy como foto. `null` es el avatar de iniciales. */
function fotoDelPerfil(fixture: ComponentFixture<MyProfile>): string | null {
  return (fixture.componentInstance as unknown as { fotoUrl: () => string | null }).fotoUrl();
}

/**
 * Un PNG mínimo, como Blob.
 *
 * La foto se resuelve bajando los bytes por `/content` y codificándolos a
 * `data:`: importa que el Blob traiga tipo, no qué contiene.
 */
function pngFalso(): Blob {
  return new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
}

/**
 * Espera a que `FileReader` termine de codificar.
 *
 * Es asíncrono y **no** pasa por los temporizadores de `fakeAsync`, así que se
 * sondea en vez de ceder un turno fijo, que resultaba intermitente.
 */
async function esperarLaFoto(hayFoto: () => boolean): Promise<void> {
  for (let intento = 0; intento < 50 && !hayFoto(); intento++) {
    await new Promise((sigue) => setTimeout(sigue, 0));
  }
}

/**
 * Las etiquetas del catálogo llegan por dos caminos que corren en paralelo: el
 * resumen pide la del estado, el perfil completo pide las suyas —ocupación,
 * municipio, departamento—. El resumen las guardaba con `set`, y cuando el
 * perfil respondía primero (la maqueta responde en el acto), lo pisaba: la
 * ficha mostraba «Ocupación» en blanco y el municipio «Sin registrar» con los
 * dos datos cargados. Se vio en la captura del 09/09/2026.
 */
describe('MyProfile · las etiquetas del perfil sobreviven a las del resumen', () => {
  const OCUPACION = '33333333-3333-4333-8333-333333333333';
  const MUNICIPIO = '44444444-4444-4444-8444-444444444444';

  let fixture: ComponentFixture<MyProfile>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyProfile],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(MyProfile);
    http = TestBed.inject(HttpTestingController);
    resolverEstadosDeCaso(http);
    fixture.detectChanges();
    http.expectNone('/identity/me/verification-cases');
  });

  afterEach(() => http.verify());

  /** La petición de etiquetas que pide exactamente estos ids. */
  function etiquetasPara(ids: readonly string[]) {
    return http.expectOne(
      (r) => r.url === '/terminology/concepts' && r.params.get('ids') === ids.join(','),
    );
  }

  it('la ocupación y el municipio se ven aunque sus etiquetas lleguen antes que la del estado', () => {
    // 1 · El perfil completo responde primero, y con él sus etiquetas.
    resolverPerfilCompleto(http, {
      occupationConceptId: OCUPACION,
      residenceMunicipalityConceptId: MUNICIPIO,
    });
    etiquetasPara([MUNICIPIO, OCUPACION]).flush({
      items: [
        { conceptId: OCUPACION, code: 'ACC', display: 'Contador/a', codeSystemVersionId: 'c-1' },
        {
          conceptId: MUNICIPIO,
          code: 'SCZ',
          display: 'Santa Cruz de la Sierra',
          codeSystemVersionId: 'c-1',
        },
      ],
      count: 2,
      limit: 50,
    });

    // 2 · Después llega el resumen, con la sola etiqueta del estado.
    http.expectOne('/profiles/patients/me/summary').flush(RESUMEN);
    etiquetasPara([ESTADO]).flush({
      items: [{ conceptId: ESTADO, code: 'ACTIVE', display: 'Activa', codeSystemVersionId: 'c-1' }],
      count: 1,
      limit: 50,
    });
    fixture.detectChanges();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.textContent).toContain('Activa');
    expect(raiz.textContent).toContain('Contador/a');

    // El municipio vive en «Contacto».
    const pestanas = raiz.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    pestanas[1].click();
    fixture.detectChanges();
    expect(
      raiz.querySelector('[data-testid="mi-perfil-municipio"]')?.textContent?.trim(),
    ).toBe('Santa Cruz de la Sierra');
  });
});
