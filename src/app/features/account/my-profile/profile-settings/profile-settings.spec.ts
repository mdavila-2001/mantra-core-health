import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../../../core/auth/session.store';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../../shared/components/molecules/toast/toast.service';
import { resolverEstadosDeCaso } from '../../../../../testing/case-status';
import { ProfileSettings } from './profile-settings';

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

const ESTADO = '22222222-2222-4222-8222-222222222222';

const RESUMEN = {
  personId: 'p-1',
  patientProfileId: 'pp-1',
  patientCode: 'PAC-1',
  displayName: 'Ana Salas',
  birthDate: '1985-03-14',
  personStatus: ESTADO,
};

const PERFIL_PRO = {
  profileId: 'hp-1',
  personId: 'p-2',
  practitionerCode: 'PRO-7',
  displayName: 'Dra. Salas',
  professionalTitle: 'Médica cardióloga',
  professionalBio: 'Diez años en cardiología clínica.',
  practitionerCategoryConceptId: ESTADO,
  verificationStatusConceptId: ESTADO,
  practiceStatusConceptId: ESTADO,
  acceptsNewPatients: true,
  telehealthAvailable: false,
  specialties: [],
  credentials: [],
  licenses: [],
  languages: [],
  affiliations: [],
  activity: { encounters: 0, medicationRequests: 0, clinicalNotes: 0, documents: 0 },
  createdAt: '2020-01-01T00:00:00.000Z',
};

/**
 * **Configurar mi Perfil** — la ficha del perfil dentro de `/my-account`.
 *
 * La mayor parte de estas pruebas vivía en `my-profile.spec.ts`: eran del
 * componente que pedía el resumen, y ese trabajo se mudó acá cuando `MyProfile`
 * pasó a ser una cáscara de dos pestañas. Se mudan con su razón de ser intacta
 * —el 403 que es puerta y no muro, el historial que sobrevive a ese 403, el
 * uuid que nunca se pinta— porque lo que fijan sigue siendo cierto: cambió
 * quién lo hace, no qué tiene que pasar.
 *
 * Lo nuevo es el modo lectura/edición: el lápiz, la X y el modal que los dos
 * botones tienen que atravesar.
 */
describe('ProfileSettings · paciente', () => {
  let fixture: ComponentFixture<ProfileSettings>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileSettings],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileSettings);
    http = TestBed.inject(HttpTestingController);
    // Los sellos de verificación salen de terminología: sin responder esa
    // búsqueda quedan en neutro y `verify()` protesta.
    resolverEstadosDeCaso(http);
    fixture.detectChanges();

    // El historial de verificación se pide **en paralelo** al resumen, no
    // encadenado: el resumen falla con 403 cuando falta verificar la identidad,
    // que es justo cuando el historial tiene algo que decir.
    http.expectOne('/identity/me/verification-cases').flush([]);
  });

  afterEach(() => http.verify());

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
    http.expectOne((r) => r.url === '/terminology/concepts').flush({
      items: [],
      count: 0,
      limit: 50,
    });
  });

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
    http.expectOne((r) => r.url === '/terminology/concepts').flush({
      items: [{ conceptId: ESTADO, code: 'ACTIVE', display: 'Activa', codeSystemVersionId: 'c-1' }],
      count: 1,
      limit: 50,
    });
    fixture.detectChanges();

    expect(interno<() => string>('estadoPersona')()).toBe('Activa');
  });

  it('si el catálogo falla, el resumen se muestra igual y sin uuid a la vista', () => {
    http.expectOne('/profiles/patients/me/summary').flush(RESUMEN);
    http
      .expectOne((r) => r.url === '/terminology/concepts')
      .error(new ProgressEvent('error'), { status: 500 });
    fixture.detectChanges();

    expect(estado().status).toBe('ready');
    expect(interno<() => string>('estadoPersona')()).toBe('Sin determinar');
  });

  it('el historial sobrevive al 403 del resumen', () => {
    http.expectOne('/profiles/patients/me/summary').flush(
      { code: 'IDENTITY_VERIFICATION_REQUIRED', message: 'Verificá tu identidad.' },
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();

    expect(estado().status).toBe('forbidden');
    // El historial se respondió en el beforeEach: llegó y no lo tumbó el 403.
    expect(interno<() => readonly unknown[]>('casosOrdenados')()).toEqual([]);
  });

  function responderResumen(): void {
    http.expectOne('/profiles/patients/me/summary').flush(RESUMEN);
    http.expectOne((r) => r.url === '/terminology/concepts').flush({
      items: [],
      count: 0,
      limit: 50,
    });
    fixture.detectChanges();
  }

  it('los identificadores del perfil y la persona ya no se muestran', () => {
    responderResumen();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.textContent).not.toContain(RESUMEN.patientProfileId);
    // El código de paciente sí: es la referencia que la persona puede dar.
    expect(raiz.textContent).toContain(RESUMEN.patientCode);
  });

  /**
   * A quien se atiende no se le ofrece el lápiz: el backend no expone ningún
   * campo suyo que esta pantalla pueda escribir, y un botón de editar que no
   * puede guardar nada es una promesa falsa.
   */
  it('un paciente no ve el lápiz: no hay nada que pueda editar acá', () => {
    responderResumen();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[data-testid="perfil-editar"]'),
    ).toBeNull();
  });

  function alertaDeDatos(): HTMLElement | null {
    return (fixture.nativeElement as HTMLElement).querySelector('app-view-state-host app-alert');
  }

  it('sin identidad verificada, «Tus datos» lo dice en neutro y con la salida a mano', () => {
    // Todo paciente recién registrado pasa por acá: pintarlo como «No tenés
    // acceso» en rojo lee como que algo se rompió, y el mensaje crudo del
    // backend habla de usted (feedback de la analista, barrido del 18/08/2026).
    http.expectOne('/profiles/patients/me/summary').flush(
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
});

/**
 * El orden del historial decide cuál se muestra como vigente, y el backend no lo
 * garantiza. Va en su propio `describe` porque necesita responder el historial
 * con datos, y el `beforeEach` de arriba ya lo respondió vacío.
 */
describe('ProfileSettings · orden del historial', () => {
  let fixture: ComponentFixture<ProfileSettings>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileSettings],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileSettings);
    http = TestBed.inject(HttpTestingController);
    resolverEstadosDeCaso(http);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('el caso vigente es el más reciente, y el cierre manda sobre la apertura', () => {
    http.expectOne('/identity/me/verification-cases').flush([
      // Abierto después, pero sin resolver.
      { id: 'c-viejo', status: 'PENDING', openedAt: '2026-01-10T10:00:00.000Z' },
      // Abierto antes y resuelto **después**: es el más reciente de los dos.
      {
        id: 'c-nuevo',
        status: 'APPROVED',
        openedAt: '2026-01-05T10:00:00.000Z',
        completedAt: '2026-02-01T10:00:00.000Z',
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
 * El modo lectura/edición, que es lo que este componente agrega.
 *
 * La sesión se abre **antes** de crear el componente: `esProfesional()` sale del
 * claim `hpid` y decide qué endpoint se pide, así que llega tarde si se abre
 * después.
 */
describe('ProfileSettings · el lápiz, la X y el modal', () => {
  let fixture: ComponentFixture<ProfileSettings>;
  let http: HttpTestingController;
  let confirmaciones: { confirmado: boolean; mensajes: string[] };

  beforeEach(async () => {
    confirmaciones = { confirmado: true, mensajes: [] };

    await TestBed.configureTestingModule({
      imports: [ProfileSettings],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          // El diálogo real monta un `<dialog>` en el body y espera a que
          // alguien lo cierre: acá lo que se prueba es que se PREGUNTE, y con
          // qué texto.
          provide: DialogService,
          useValue: {
            confirm: (config: { message: string }) => {
              confirmaciones.mensajes.push(config.message);
              return Promise.resolve(confirmaciones.confirmado);
            },
          },
        },
      ],
    }).compileComponents();

    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', hpid: 'hp-1', roles: ['PRACTITIONER'], tenants: ['t-1'] }),
      refreshToken: 'r-1',
    });

    fixture = TestBed.createComponent(ProfileSettings);
    http = TestBed.inject(HttpTestingController);
    resolverEstadosDeCaso(http);
    fixture.detectChanges();

    http.expectOne('/identity/me/verification-cases').flush([]);
    http.expectOne('/profiles/practitioners/me/summary').flush(PERFIL_PRO);
    // La tabla del historial laboral (`app-work-history-table`, enchufada en el
    // SLOT del final de la pestaña) lee sus afiliaciones al montarse. Es de
    // otro componente, pero se monta con éste: si no se responde, el `verify()`
    // del cierre la cuenta como petición colgada y tumba TODO el bloque.
    http.expectOne('/profiles/practitioners/me/affiliations').flush({ items: [], count: 0 });
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  function interno<T>(nombre: string): T {
    const valor = (fixture.componentInstance as unknown as Record<string, unknown>)[nombre];
    return (typeof valor === 'function' ? valor.bind(fixture.componentInstance) : valor) as T;
  }

  /**
   * Una señal escribible del componente, SIN pasar por `interno`.
   *
   * `interno` liga las funciones al componente para poder invocar sus métodos,
   * y una señal ES una función: ligarla devuelve una copia sin `.set`. Por eso
   * los dos accesos son distintos y no uno solo con maña.
   */
  function senal<T>(nombre: string): WritableSignal<T> {
    return (fixture.componentInstance as unknown as Record<string, WritableSignal<T>>)[nombre];
  }

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  /** A un profesional no se le pide el resumen de paciente: le responde 404. */
  it('no pide el resumen de paciente cuando la sesión es profesional', () => {
    http.expectNone('/profiles/patients/me/summary');
  });

  it('arranca en lectura: hay lápiz, y no hay guardar ni descartar', () => {
    expect(raiz().querySelector('[data-testid="perfil-editar"]')).not.toBeNull();
    expect(raiz().querySelector('[data-testid="perfil-guardar"]')).toBeNull();
    expect(raiz().querySelector('[data-testid="perfil-cancelar"]')).toBeNull();
  });

  it('el lápiz lleva el rótulo EDITAR, en el tooltip y como nombre accesible', () => {
    const lapiz = raiz().querySelector('[data-testid="perfil-editar"]');
    expect(lapiz?.getAttribute('appTooltip') ?? lapiz?.getAttribute('ng-reflect-app-tooltip')).toBe(
      'EDITAR',
    );
    expect(lapiz?.getAttribute('aria-label')).toBe('EDITAR');
  });

  it('el lápiz abre la edición y saca los campos de sólo lectura', () => {
    interno<() => void>('empezarAEditar')();
    fixture.detectChanges();

    expect(interno<() => boolean>('editando')()).toBe(true);
    expect(raiz().querySelector('[data-testid="perfil-guardar"]')).not.toBeNull();
    expect(raiz().querySelector('[data-testid="perfil-cancelar"]')).not.toBeNull();
    expect(raiz().querySelector('input[readonly]')).toBeNull();
  });

  it('guardar pregunta primero y sólo entonces manda el PATCH', async () => {
    interno<() => void>('empezarAEditar')();
    senal<string>('titulo').set('Médica cardióloga infantil');

    const guardado = interno<() => Promise<void>>('guardar')();
    await Promise.resolve();

    expect(confirmaciones.mensajes).toEqual(['¿Estás seguro de aplicar estos cambios?']);

    const req = http.expectOne('/profiles/practitioners/me');
    expect(req.request.method).toBe('PATCH');
    // Sólo viaja lo que cambió: mandar el registro entero pisaría con valores
    // viejos cualquier campo que otro haya tocado mientras tanto.
    expect(req.request.body).toEqual({ professionalTitle: 'Médica cardióloga infantil' });
    req.flush({ ...PERFIL_PRO, professionalTitle: 'Médica cardióloga infantil' });
    await guardado;
    fixture.detectChanges();

    expect(interno<() => boolean>('editando')()).toBe(false);
  });

  it('si no se confirma, no se manda nada y el formulario sigue abierto', async () => {
    confirmaciones.confirmado = false;
    interno<() => void>('empezarAEditar')();
    senal<string>('titulo').set('Otro título');

    await interno<() => Promise<void>>('guardar')();

    http.expectNone('/profiles/practitioners/me');
    expect(interno<() => boolean>('editando')()).toBe(true);
  });

  it('al guardar bien sale un aviso de éxito', async () => {
    const toasts = TestBed.inject(ToastService);
    interno<() => void>('empezarAEditar')();
    senal<boolean>('telemedicina').set(true);

    const guardado = interno<() => Promise<void>>('guardar')();
    await Promise.resolve();
    http.expectOne('/profiles/practitioners/me').flush({ ...PERFIL_PRO, telehealthAvailable: true });
    await guardado;

    expect(toasts.toasts().map((t) => t.type)).toContain('success');
  });

  /**
   * Descartar también pregunta: la X borra lo escrito, y hacerlo sin avisar es
   * la forma más barata de perder diez minutos de trabajo.
   */
  it('la X pregunta antes de descartar, y al confirmar devuelve lo guardado', async () => {
    interno<() => void>('empezarAEditar')();
    senal<string>('titulo').set('Un título a medio escribir');

    await interno<() => Promise<void>>('cancelar')();

    expect(confirmaciones.mensajes).toEqual(['¿Estás seguro de aplicar estos cambios?']);
    expect(interno<() => string>('titulo')()).toBe(PERFIL_PRO.professionalTitle);
    expect(interno<() => boolean>('editando')()).toBe(false);
  });

  /**
   * Sin cambios no hay nada que perder. Un modal en ese caso enseña a apretar
   * «sí» sin leer, que es lo que lo vuelve inútil cuando de verdad importa.
   */
  it('la X no pregunta nada si no se tocó ningún campo', async () => {
    interno<() => void>('empezarAEditar')();

    await interno<() => Promise<void>>('cancelar')();

    expect(confirmaciones.mensajes).toEqual([]);
    expect(interno<() => boolean>('editando')()).toBe(false);
  });

  it('guardar sin cambios no manda un PATCH vacío', async () => {
    interno<() => void>('empezarAEditar')();

    await interno<() => Promise<void>>('guardar')();

    expect(confirmaciones.mensajes).toEqual([]);
    http.expectNone('/profiles/practitioners/me');
    expect(interno<() => boolean>('editando')()).toBe(false);
  });

  it('si el PATCH falla, el formulario queda abierto con lo escrito', async () => {
    interno<() => void>('empezarAEditar')();
    senal<string>('bio').set('Una bio nueva.');

    const guardado = interno<() => Promise<void>>('guardar')();
    await Promise.resolve();
    http
      .expectOne('/profiles/practitioners/me')
      .error(new ProgressEvent('error'), { status: 500 });
    await guardado;

    expect(interno<() => boolean>('editando')()).toBe(true);
    expect(interno<() => string>('bio')()).toBe('Una bio nueva.');
  });
});
