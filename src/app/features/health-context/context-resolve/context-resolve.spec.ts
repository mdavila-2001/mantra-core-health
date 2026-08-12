import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { ViewState } from '../../../core/view-state/view-state.types';
import { ContextResolve } from './context-resolve';

const PAIS = '11111111-1111-4111-8111-111111111111';
const DOMINIO = '22222222-2222-4222-8222-222222222222';

const RESUELTO = {
  contextId: 'ctx-1',
  versionId: 'ver-1',
  versionNumber: 3,
  contextPayloadJson: { cobertura: 'universal' },
  observedAt: '2026-07-01T00:00:00.000Z',
  expiresAt: '2026-12-31T00:00:00.000Z',
  stale: false,
  facts: [
    {
      id: 'f-1',
      factKey: 'poblacion.total',
      valueType: 'number',
      valueJson: 47000000,
      metricConceptId: null,
      unitConceptId: null,
      confidenceScore: '0.98',
      evidenceObservationIds: ['obs-1', 'obs-2'],
    },
  ],
};

/**
 * V44-03: la única lectura del M44, y **la primera pantalla del producto que
 * produce un S7 de verdad**.
 *
 * Lo que fijan estas pruebas:
 *
 * 1. La consulta no sale sin los tres parámetros, y sale con exactamente esos.
 * 2. `stale: true` es S7 con `asOf`, no un error ni un `ready` disfrazado.
 * 3. El 404 lleva a crear el contexto: un S6 sin salida es un callejón.
 * 4. El 422 —contexto sin versión publicada— es S4 y muestra el motivo del
 *    backend, que acá es la información útil.
 * 5. La escotilla de identificadores pegados funciona **y valida el formato**;
 *    existe solo porque esto es una consulta.
 */
describe('ContextResolve', () => {
  let fixture: ComponentFixture<ContextResolve>;
  let componente: ContextResolve;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ContextResolve],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(ContextResolve);
    componente = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
  });

  afterEach(() => {
    // Los dos selectores de catálogo piden su enumeración al montarse. Hoy el
    // backend no tiene bindings sembrados para `health_context`, pero la
    // petición sale igual y hay que atenderla o `verify()` la denuncia.
    for (const pedido of http.match((r) => r.url === '/system-context/dynamic-enums')) {
      pedido.flush({}, { status: 404, statusText: 'Not Found' });
    }
    http.verify();
  });

  /** El componente expone lo suyo como `protected`; las pruebas leen por índice. */
  function interno<T>(nombre: string): T {
    return (componente as unknown as Record<string, T>)[nombre] as T;
  }

  function estado(): ViewState<unknown> {
    return interno<() => ViewState<unknown>>('state')();
  }

  function consultar(): void {
    interno<() => void>('consultar').call(componente);
  }

  /** Deja la pantalla lista para consultar, por la escotilla de identificadores. */
  function completarConIdentificadores(key = 'cobertura.publica'): void {
    interno<{ set: (v: boolean) => void }>('pegarIdentificadores').set(true);
    const form = interno<{
      controls: Record<string, { setValue: (v: string) => void }>;
    }>('form');
    form.controls['countryId']?.setValue(PAIS);
    form.controls['domainId']?.setValue(DOMINIO);
    form.controls['key']?.setValue(key);
  }

  function esperarConsulta() {
    return http.expectOne((r) => r.url === '/health-context/contexts/resolve');
  }

  it('arranca en vacío con acción, sin pedir nada', () => {
    const inicial = estado();
    expect(inicial.status).toBe('empty');
    if (inicial.status !== 'empty') return;
    expect(inicial.nextAction.route).toBe('/administration/health-context/contexts/new');
  });

  it('no consulta mientras falte alguno de los tres parámetros', () => {
    completarConIdentificadores('');
    consultar();

    // Sin la clave no sale ninguna petición: `verify()` lo comprueba.
    expect(estado().status).toBe('empty');
  });

  it('rechaza un identificador que no tiene forma de UUID', () => {
    interno<{ set: (v: boolean) => void }>('pegarIdentificadores').set(true);
    const form = interno<{
      controls: Record<string, { setValue: (v: string) => void }>;
    }>('form');
    form.controls['countryId']?.setValue('no-es-un-uuid');
    form.controls['domainId']?.setValue(DOMINIO);
    form.controls['key']?.setValue('k');

    consultar();

    expect(estado().status).toBe('empty');
  });

  it('manda exactamente country, domain y key', () => {
    completarConIdentificadores();
    consultar();

    const req = esperarConsulta();
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().sort((a, b) => a.localeCompare(b))).toEqual([
      'country',
      'domain',
      'key',
    ]);
    expect(req.request.params.get('key')).toBe('cobertura.publica');
    req.flush(RESUELTO);

    expect(estado().status).toBe('ready');
  });

  it('una versión caducada es S7 con la fecha de observación, no un error', () => {
    completarConIdentificadores();
    consultar();
    esperarConsulta().flush({ ...RESUELTO, stale: true });

    const viejo = estado();
    expect(viejo.status).toBe('stale');
    if (viejo.status !== 'stale') return;
    // El `asOf` que el M34 exige es cuándo se observó el dato, no cuándo se pidió.
    expect(viejo.asOf.toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });

  it('caducada y sin fecha de observación cae a la de caducidad antes que mentir', () => {
    completarConIdentificadores();
    consultar();
    esperarConsulta().flush({ ...RESUELTO, stale: true, observedAt: null });

    const viejo = estado();
    expect(viejo.status).toBe('stale');
    if (viejo.status !== 'stale') return;
    expect(viejo.asOf.toISOString()).toBe('2026-12-31T00:00:00.000Z');
  });

  it('sin ninguna de las dos fechas no inventa una antigüedad', () => {
    completarConIdentificadores();
    consultar();
    esperarConsulta().flush({ ...RESUELTO, stale: true, observedAt: null, expiresAt: null });

    // Decir «actualizado ahora» sobre un dato caducado sería peor que no decirlo.
    expect(estado().status).toBe('ready');
  });

  it('el 404 ofrece crear el contexto', () => {
    completarConIdentificadores();
    consultar();
    esperarConsulta().flush(
      { code: 'NOT_FOUND', message: 'Contexto no encontrado', timestamp: 't', path: '/p' },
      { status: 404, statusText: 'Not Found' },
    );

    const noEncontrado = estado();
    expect(noEncontrado.status).toBe('not-found');
    if (noEncontrado.status !== 'not-found') return;
    expect(noEncontrado.nextAction?.route).toBe('/administration/health-context/contexts/new');
  });

  it('un contexto sin versión publicada es S4 y muestra el motivo del backend', () => {
    completarConIdentificadores();
    consultar();
    esperarConsulta().flush(
      {
        code: 'PRECONDITION_FAILED',
        message: 'El contexto no tiene versión vigente',
        timestamp: 't',
        path: '/p',
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    fixture.detectChanges();

    const invalido = estado();
    expect(invalido.status).toBe('validation');
    if (invalido.status !== 'validation') return;
    expect(invalido.issues[0]?.message).toContain('versión vigente');
  });

  it('los hechos se aplanan a texto y cuentan sus evidencias', () => {
    completarConIdentificadores();
    consultar();
    esperarConsulta().flush(RESUELTO);

    const filas = interno<() => ViewState<readonly Record<string, unknown>[]>>('hechos')();
    expect(filas.status).toBe('ready');
    if (filas.status !== 'ready') return;

    expect(filas.data[0]).toMatchObject({
      factKey: 'poblacion.total',
      valor: '47000000',
      // Texto por contrato: convertirlo perdería precisión.
      confianza: '0.98',
      evidencias: 2,
    });
  });

  it('un hecho sin puntaje ni evidencias no rompe la tabla', () => {
    completarConIdentificadores();
    consultar();
    esperarConsulta().flush({
      ...RESUELTO,
      facts: [
        {
          id: 'f-2',
          factKey: 'nota',
          valueType: 'object',
          valueJson: { a: 1 },
          confidenceScore: null,
          evidenceObservationIds: [],
        },
      ],
    });

    const filas = interno<() => ViewState<readonly Record<string, unknown>[]>>('hechos')();
    if (filas.status !== 'ready') {
      throw new Error('se esperaba ready');
    }
    expect(filas.data[0]).toMatchObject({ valor: '{"a":1}', confianza: '—', evidencias: 0 });
  });
});
