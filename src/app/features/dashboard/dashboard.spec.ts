import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { SessionStore } from '../../core/auth/session.store';
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
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
  });

  afterEach(() => {
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
    http
      .expectOne((request) => request.url.endsWith('/identity/me/verification-cases'))
      .flush([]);
    // Y el sello de ese trámite sale de terminología, por el mismo motivo.
    resolverEstadosDeCaso(http);
  }

  /** Acceso al estado protegido sin abrirlo en el componente. */
  function estado() {
    return (component as unknown as { directory: () => { status: string } }).directory();
  }

  function responder(records: unknown[], refreshedAt: string | null) {
    http.expectOne((request) => request.url.endsWith('/public/directory')).flush({
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

    http.expectOne((request) => request.url.includes('/profiles/patients')).flush({
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

    const total = (component as unknown as { totalPacientes: () => number | null })
      .totalPacientes();
    expect(total).toBe(140);
  });

  it('el listado vacío es S3, no una lista de cero filas', () => {
    crear({ sub: 'u-1', roles: ['SECURITY_ADMIN'], tenants: ['t-1'] });
    responder([], null);

    http
      .expectOne((request) => request.url.includes('/profiles/patients'))
      .flush({ items: [], count: 0, limit: 5, nextCursor: null });

    const pacientes = (component as unknown as { pacientes: () => { status: string } })
      .pacientes();
    expect(pacientes.status).toBe('empty');
  });

  it('si el historial de verificación falla, el panel sigue en pie', () => {
    // Es información de contexto: romper el panel entero porque el módulo de
    // identidad no contestó sería peor que un panel sin ese dato.
    session.start({ accessToken: jwt({ sub: 'u-1', roles: [], tenants: [] }), refreshToken: 'r-1' });
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
});
