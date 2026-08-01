import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Dashboard } from './dashboard';

/**
 * El panel concentra **dos reglas de producto** que hasta ahora nada fijaba, y
 * son las dos que un refactor rompería en silencio:
 *
 * 1. **Vacío gana sobre atrasado.** Una proyección sin registros no tiene nada
 *    que mostrar, así que anunciar su antigüedad sería decirle a la persona
 *    cuán viejo es un dato que no está viendo.
 * 2. **Sin `refreshedAt` es `ready`, no `stale`.** La vista nunca se refrescó,
 *    así que no hay antigüedad que declarar — y S7 exige una. Inventar
 *    `new Date()` sería afirmar que se calculó recién.
 */
describe('Dashboard', () => {
  let fixture: ComponentFixture<Dashboard>;
  let component: Dashboard;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Dashboard);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

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
    expect(estado().status).toBe('loading');
    responder([], null);
  });

  it('sin registros muestra S3 vacío, aunque la proyección declare antigüedad', () => {
    // El caso que distingue las dos reglas: hay `refreshedAt`, y aun así gana
    // el vacío. Si el orden se invirtiera, esto pasaría a `stale`.
    responder([], '2026-07-31T00:00:00.000Z');

    expect(estado().status).toBe('empty');
  });

  it('con registros y antigüedad declarada muestra S7', () => {
    responder([{ nombre: 'Clínica' }], '2026-07-31T00:00:00.000Z');

    const state = estado() as { status: string; asOf?: Date };
    expect(state.status).toBe('stale');
    expect(state.asOf).toEqual(new Date('2026-07-31T00:00:00.000Z'));
  });

  it('con registros y sin antigüedad muestra el camino feliz, no S7', () => {
    // `refreshedAt: null` es «nunca se refrescó», que NO es «se refrescó
    // recién». Resolverlo como `stale` obligaría a inventar una fecha.
    responder([{ nombre: 'Clínica' }], null);

    expect(estado().status).toBe('ready');
  });

  it('un fallo de red se traduce a S8, no a una excepción', () => {
    http
      .expectOne((request) => request.url.endsWith('/public/directory'))
      .error(new ProgressEvent('error'), { status: 0, statusText: 'Unknown Error' });

    expect(estado().status).toBe('offline');
  });

  it('cuenta los registros solo cuando el estado transporta datos', () => {
    responder([{ a: 1 }, { a: 2 }], null);

    const conteo = (component as unknown as { recordCount: () => number | null }).recordCount();
    expect(conteo).toBe(2);
  });
});
