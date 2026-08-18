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
 * El resumen propio es la única pantalla de este lote que **no** pide rol: pide
 * identidad verificada. Por eso lo que más importa acá es el 403 — que tiene
 * que llegar como una puerta con salida, no como un muro.
 */
const ESTADO = '22222222-2222-4222-8222-222222222222';

const RESUMEN = {
  personId: 'p-1',
  patientProfileId: 'pp-1',
  patientCode: 'PAC-1',
  displayName: 'Ana Salas',
  birthDate: '1985-03-14',
  personStatus: ESTADO,
};

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

    // El historial de verificación se pide **en paralelo** al resumen, no
    // encadenado: el resumen falla con 403 cuando falta verificar la identidad,
    // que es justo cuando el historial tiene algo que decir. Se responde acá
    // para que cada prueba hable de lo suyo.
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
    http.expectOne((r) => r.url === '/terminology/concepts').flush({
      items: [{ conceptId: ESTADO, code: 'ACTIVE', display: 'Activa', codeSystemVersionId: 'c-1' }],
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
    http.expectOne('/profiles/patients/me/summary').flush(
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
    http.expectOne((r) => r.url === '/terminology/concepts').flush({
      items: [],
      count: 0,
      limit: 50,
    });
    fixture.detectChanges();
  }

  it('«Tu acceso» nombra el rol en palabras, con el código sólo en data-role', () => {
    // La sesión se abre después de crear la pantalla: las insignias derivan de
    // una señal, así que reaccionan igual.
    TestBed.inject(SessionStore).start({
      accessToken: jwt({ sub: 'u-1', roles: ['USER', 'PATIENT'], tenants: ['t-1'] }),
      refreshToken: 'r-1',
    });
    responderResumen();

    const insignias = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.mi-perfil__roles app-badge'),
    ];
    expect(insignias.map((i) => i.textContent?.trim())).toEqual(['Paciente']);
    expect(insignias.map((i) => i.getAttribute('data-role'))).toEqual(['PATIENT']);
  });

  it('los identificadores del perfil y la persona ya no se muestran', () => {
    responderResumen();

    const raiz = fixture.nativeElement as HTMLElement;
    expect(raiz.querySelector('.mi-perfil__ids')).toBeNull();
    expect(raiz.textContent).not.toContain(RESUMEN.patientProfileId);
    // El código de paciente sí: es la referencia que la persona puede dar.
    expect(raiz.textContent).toContain(RESUMEN.patientCode);
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
