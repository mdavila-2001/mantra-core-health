import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, type Routes } from '@angular/router';
import { context, trace } from '@opentelemetry/api';
import {
  BasicTracerProvider,
  InMemorySpanExporter,
  SimpleSpanProcessor,
  StackContextManager,
} from '@opentelemetry/sdk-trace-web';

import { TELEMETRY_CONFIG } from '../config/telemetry.token';
import type { TelemetryConfig } from '../config/telemetry.types';
import { flushDeferredSpans, resetDeferredSpans } from '../tracing/deferred-spans';
import { RouterTracing } from './router-tracing';

@Component({ template: '' })
class Vacio {}

const RUTAS: Routes = [
  { path: 'auth', component: Vacio },
  { path: 'dashboard', component: Vacio },
  { path: 'pacientes/:pacienteId', component: Vacio },
  { path: 'bloqueada', component: Vacio, canActivate: [() => false] },
  { path: 'redirigida', component: Vacio, canActivate: [() => inyectarUrlTree()] },
  {
    path: 'diferida',
    loadComponent: () => Promise.resolve(Vacio),
  },
  { path: 'rota', loadComponent: () => Promise.reject(new Error('ChunkLoadError')) },
];

function inyectarUrlTree(): ReturnType<Router['createUrlTree']> {
  return TestBed.inject(Router).createUrlTree(['/auth']);
}

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

describe('RouterTracing', () => {
  let exporter: InMemorySpanExporter;
  let provider: BasicTracerProvider;
  let router: Router;

  beforeEach(() => {
    exporter = new InMemorySpanExporter();
    provider = new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
    trace.setGlobalTracerProvider(provider);
    context.setGlobalContextManager(new StackContextManager().enable());
    resetDeferredSpans();
    // El SDK ya está listo: es el caso normal, y el que permite spans vivos.
    flushDeferredSpans();

    TestBed.configureTestingModule({
      providers: [provideRouter(RUTAS), { provide: TELEMETRY_CONFIG, useValue: CONFIG }],
    });

    router = TestBed.inject(Router);
    TestBed.inject(RouterTracing).start();
  });

  afterEach(async () => {
    resetDeferredSpans();
    await provider.shutdown();
    trace.disable();
    context.disable();
  });

  const navegaciones = () =>
    exporter.getFinishedSpans().filter((span) => span.name === 'angular.navigation');

  it('abre un span por navegación y lo cierra al completar', async () => {
    await router.navigateByUrl('/dashboard');

    const [span] = navegaciones();
    expect(span?.attributes['angular.navigation.result']).toBe('completed');
    expect(span?.attributes['app.route.to']).toBe('/dashboard');
  });

  it('registra la plantilla, NUNCA el identificador', async () => {
    await router.navigateByUrl('/pacientes/8437');

    const [span] = navegaciones();
    expect(span?.attributes['app.route.template']).toBe('/pacientes/:pacienteId');
    expect(JSON.stringify(span?.attributes)).not.toContain('8437');
  });

  it('descarta el query string, que es donde viaja el token del correo', async () => {
    await router.navigateByUrl('/dashboard?token=eyJhbGciOi.abc.def');

    expect(JSON.stringify(navegaciones()[0]?.attributes)).not.toContain('eyJhbGci');
  });

  it('marca cancelada —no fallida— la navegación que un guard bloquea', async () => {
    await router.navigateByUrl('/bloqueada');

    const [span] = navegaciones();
    expect(span?.attributes['angular.navigation.result']).toBe('cancelled');
    expect(span?.attributes['angular.navigation.cancellation.code']).toBe('guard_rejected');
    // Una cancelación pasa constantemente y por motivos sanos.
    expect(span?.status.code).not.toBe(2);
  });

  it('distingue una redirección de un bloqueo', async () => {
    await router.navigateByUrl('/redirigida');

    const redirigida = navegaciones()[0];
    expect(redirigida?.attributes['angular.navigation.redirected']).toBe(true);
    expect(redirigida?.attributes['angular.navigation.cancellation.code']).toBe('redirect');
  });

  it('mide la carga del fragmento diferido como span aparte', async () => {
    await router.navigateByUrl('/diferida');

    const carga = exporter
      .getFinishedSpans()
      .find((span) => span.name === 'angular.lazy-route.load');

    expect(carga?.attributes['angular.lazy.result']).toBe('loaded');
    expect(carga?.attributes['app.route.template']).toBe('/diferida');
  });

  it('marca fallida la navegación cuyo fragmento no bajó', async () => {
    await router.navigateByUrl('/rota').catch(() => undefined);

    const [span] = navegaciones();
    expect(span?.attributes['angular.navigation.result']).toBe('failed');
    expect(span?.attributes['error.type']).toBe('Error');
  });

  it('no duplica spans si el inicializador corre dos veces', async () => {
    TestBed.inject(RouterTracing).start();

    await router.navigateByUrl('/dashboard');

    expect(navegaciones()).toHaveLength(1);
  });

  it('cierra los spans abiertos al desecharse la aplicación', async () => {
    const navegacion = router.navigateByUrl('/diferida');
    TestBed.resetTestingModule();
    await navegacion.catch(() => undefined);

    // Un span sin cerrar no se exporta nunca: se queda en memoria hasta que la
    // pestaña muere. Es la fuga clásica de instrumentar el Router a mano.
    for (const span of exporter.getFinishedSpans()) {
      expect(span.ended).toBe(true);
    }
  });
});
