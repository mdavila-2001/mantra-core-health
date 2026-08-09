import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { context, propagation, trace } from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  StackContextManager,
} from '@opentelemetry/sdk-trace-web';

import { API_BASE_URL } from '../../data-access/api';
import { TELEMETRY_CONFIG } from '../config/telemetry.token';
import type { TelemetryConfig } from '../config/telemetry.types';
import { tracingInterceptor } from './tracing.interceptor';

const CONFIG: TelemetryConfig = {
  enabled: true,
  serviceName: 'mantra-angular-web',
  namespace: 'mantra',
  environment: 'test',
  tracesEndpoint: '/otel/v1/traces',
  sampleRatio: 1,
  version: '0.0.0-test',
  buildId: 'test',
  renderingMode: 'csr',
};

describe('tracingInterceptor', () => {
  let exporter: InMemorySpanExporter;
  let provider: BasicTracerProvider;
  let http: HttpClient;
  let httpMock: HttpTestingController;

  function montar(config: Partial<TelemetryConfig> = {}, apiBaseUrl = ''): void {
    exporter = new InMemorySpanExporter();
    provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
    trace.setGlobalTracerProvider(provider);
    context.setGlobalContextManager(new StackContextManager().enable());
    // Lo que en producción instala `provider.register({ propagator })`. Sin él,
    // `propagation.inject` no escribe nada y el traceparent no sale.
    propagation.setGlobalPropagator(new W3CTraceContextPropagator());

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([tracingInterceptor])),
        provideHttpClientTesting(),
        { provide: TELEMETRY_CONFIG, useValue: { ...CONFIG, ...config } },
        { provide: API_BASE_URL, useValue: apiBaseUrl },
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  }

  afterEach(async () => {
    httpMock.verify();
    await provider.shutdown();
    trace.disable();
    context.disable();
    propagation.disable();
  });

  it('abre un span por petición y lo cierra con el código de estado', () => {
    montar();

    http.get('/iam/auth/session').subscribe();
    httpMock.expectOne('/iam/auth/session').flush({});

    const [span] = exporter.getFinishedSpans();
    expect(span?.name).toBe('angular.http.request');
    expect(span?.attributes['http.request.method']).toBe('GET');
    expect(span?.attributes['http.response.status_code']).toBe(200);
    expect(span?.attributes['url.path']).toBe('/iam/auth/session');
  });

  it('NO abre span si nadie se suscribe: esa petición nunca salió', () => {
    montar();

    http.get('/iam/auth/session');

    expect(exporter.getFinishedSpans()).toHaveLength(0);
  });

  it('propaga traceparent a la API', () => {
    montar();

    http.get('/iam/auth/session').subscribe();
    const pedida = httpMock.expectOne('/iam/auth/session');

    expect(pedida.request.headers.get('traceparent')).toMatch(
      /^00-[0-9a-f]{32}-[0-9a-f]{16}-0[01]$/,
    );
    pedida.flush({});
  });

  it('NO propaga a un destino que no es la API', () => {
    montar();

    http.get('https://cdn.terceros.example/analytics.js').subscribe();
    const pedida = httpMock.expectOne('https://cdn.terceros.example/analytics.js');

    // Una cabecera desconocida a otro origen dispara preflight y lo rompe.
    expect(pedida.request.headers.has('traceparent')).toBe(false);
    pedida.flush({});
  });

  it('NUNCA registra el query string: ahí viaja el token del correo', () => {
    montar();

    http.get('/iam/auth/verify-email?token=eyJhbGciOiJIUzI1NiJ9.abc.def').subscribe();
    httpMock.expectOne((r) => r.url.startsWith('/iam/auth/verify-email')).flush({});

    const atributos = JSON.stringify(exporter.getFinishedSpans()[0]?.attributes);
    expect(atributos).not.toContain('token=');
    expect(atributos).not.toContain('eyJhbGci');
  });

  it('agrupa por plantilla de ruta, no por identificador', () => {
    montar();

    http.get('/profiles/3f2504e0-4f89-11d3-9a0c-0305e82c3301').subscribe();
    httpMock.expectOne('/profiles/3f2504e0-4f89-11d3-9a0c-0305e82c3301').flush({});

    expect(exporter.getFinishedSpans()[0]?.attributes['app.api.route.template']).toBe(
      '/profiles/:id',
    );
  });

  it.each([
    [500, 'server_error'],
    [422, 'client_error'],
    [0, 'network_error'],
  ])('clasifica el fallo %i como %s', (status, esperado) => {
    montar();

    http.get('/iam/auth/session').subscribe({ error: () => undefined });
    httpMock
      .expectOne('/iam/auth/session')
      .flush({ message: 'el correo ana@ejemplo.com ya existe' }, { status, statusText: 'x' });

    const [span] = exporter.getFinishedSpans();
    expect(span?.attributes['error.type']).toBe(esperado);
    expect(span?.status.code).toBe(2);
  });

  it('NO registra el cuerpo del error: puede citar el valor rechazado', () => {
    montar();

    http.post('/iam/auth/register-patient', {}).subscribe({ error: () => undefined });
    httpMock
      .expectOne('/iam/auth/register-patient')
      .flush({ message: 'ana.perez@clinica.example ya existe' }, { status: 422, statusText: 'x' });

    const [span] = exporter.getFinishedSpans();
    const expuesto = [
      JSON.stringify(span?.attributes),
      span?.status.message ?? '',
      JSON.stringify(span?.events),
    ].join(' ');

    expect(expuesto).not.toContain('ana.perez');
    expect(expuesto).not.toContain('ya existe');
  });

  it('marca cancelado —no error— cuando se abandona la petición', () => {
    montar();

    const suscripcion = http.get('/iam/auth/session').subscribe();
    // `expectOne` la da por vista; darse de baja la cancela del lado del doble,
    // que es exactamente lo que pasa cuando un `switchMap` descarta la anterior.
    httpMock.expectOne('/iam/auth/session');
    suscripcion.unsubscribe();

    const [span] = exporter.getFinishedSpans();
    expect(span?.attributes['ui.result']).toBe('cancelled');
    // Cancelar no es fallar: marcarlo en rojo llenaría el panel de falsos.
    expect(span?.status.code).not.toBe(2);
  });

  it('con la telemetría apagada no toca nada: ni span ni cabecera', () => {
    montar({ enabled: false });

    http.get('/iam/auth/session').subscribe();
    const pedida = httpMock.expectOne('/iam/auth/session');

    expect(pedida.request.headers.has('traceparent')).toBe(false);
    pedida.flush({});
    expect(exporter.getFinishedSpans()).toHaveLength(0);
  });

  it('propaga a la raíz absoluta cuando la API vive en otro dominio', () => {
    montar({}, 'https://api.ejemplo.com');

    http.get('https://api.ejemplo.com/iam/auth/session').subscribe();
    const pedida = httpMock.expectOne('https://api.ejemplo.com/iam/auth/session');

    expect(pedida.request.headers.has('traceparent')).toBe(true);
    expect(exporter.getFinishedSpans()).toHaveLength(0);
    pedida.flush({});

    expect(exporter.getFinishedSpans()[0]?.attributes['server.address']).toBe('api.ejemplo.com');
  });
});
