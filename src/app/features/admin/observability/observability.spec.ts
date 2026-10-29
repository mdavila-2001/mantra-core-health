import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { TrafficEndpointsPage, TrafficOverview } from '../../../core/data-access/admin-portal/ops-traffic.types';
import { Observability } from './observability';

const VENTANA = { from: '2026-10-17T00:00:00.000Z', to: '2026-10-17T15:00:00.000Z', interval: 'hour' as const, timezone: 'UTC' as const };

function resumen(sobrescribir: Partial<TrafficOverview['measured']> = {}, notMeasured: TrafficOverview['notMeasured'] = [
  { metric: 'rejectedBeforeApi', reason: 'Lo que Traefik contesta antes de llegar a la API no pasa por esta medición.' },
]): TrafficOverview {
  return {
    window: VENTANA,
    measured: {
      requests: 20,
      succeeded: 17,
      failed: { client4xx: 3, server5xx: 0 },
      successRatio: 0.85,
      latencyMs: { avg: 50, p50: 25, p95: 250, max: 900, method: 'histogram-estimate', approximate: false },
      activeUsers: {
        sessionsActiveNow: 4,
        usersActiveNow: 3,
        usersActiveInWindow: 5,
        definition: 'Ahora: sesiones de IAM en estado ACTIVE y no vencidas.',
      },
      lastDataAt: '2026-10-17T14:59:00.000Z',
      ...sobrescribir,
    },
    series: [
      { bucket: '2026-10-17T10:00:00.000Z', requests: 12, failed4xx: 1, failed5xx: 0, p95Ms: 100 },
      { bucket: '2026-10-17T11:00:00.000Z', requests: 8, failed4xx: 2, failed5xx: 0, p95Ms: 250 },
    ],
    notMeasured,
  };
}

function endpoints(items: TrafficEndpointsPage['items'] = [
  {
    method: 'GET',
    route: '/patients/:id',
    operationId: 'PatientsController_get',
    requests: 19,
    succeeded: 17,
    failed4xx: 2,
    failed5xx: 0,
    latencyMs: { avg: 30, p95: 100, max: 400 },
    firstSeenAt: '2026-10-17T10:00:00.000Z',
    lastSeenAt: '2026-10-17T11:00:00.000Z',
  },
  {
    method: 'GET',
    route: 'UNMATCHED',
    operationId: null,
    requests: 1,
    succeeded: 0,
    failed4xx: 1,
    failed5xx: 0,
    latencyMs: { avg: 2, p95: 5, max: 2 },
    firstSeenAt: '2026-10-17T10:01:00.000Z',
    lastSeenAt: '2026-10-17T10:01:00.000Z',
  },
]): TrafficEndpointsPage {
  return { window: VENTANA, sort: 'requests', items, truncated: false, note: 'Las rutas son plantillas (/patients/:id), nunca la dirección real.' };
}

describe('Observability', () => {
  let fixture: ComponentFixture<Observability>;
  let http: HttpTestingController;

  const traffic = (r: { url: string }) => r.url === '/admin/ops/traffic';
  const porEndpoint = (r: { url: string }) => r.url === '/admin/ops/traffic/endpoints';
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const q = <T extends Element>(selector: string) => (fixture.nativeElement as HTMLElement).querySelector<T>(selector);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Observability],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Observability);
    fixture.detectChanges();
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  function abrirPestana(indice: number): void {
    (fixture.componentInstance as unknown as { pestana: { set(i: number): void } }).pestana.set(indice);
    fixture.detectChanges();
  }

  function responder(r: TrafficOverview = resumen(), e: TrafficEndpointsPage = endpoints()): void {
    http.expectOne(traffic).flush(r);
    http.expectOne(porEndpoint).flush(e);
    fixture.detectChanges();
  }

  it('«Hoy» pide la ventana sin `from` (la API arranca a las 00:00 UTC) y por hora', () => {
    const t = http.expectOne(traffic);
    expect(t.request.params.has('from')).toBe(false);
    expect(t.request.params.get('to')).toBeTruthy();
    expect(t.request.params.get('interval')).toBe('hour');
    const e = http.expectOne(porEndpoint);
    expect(e.request.params.has('from')).toBe(false);
    expect(e.request.params.get('sort')).toBe('requests');
    t.flush(resumen());
    e.flush(endpoints());
  });

  it('muestra los cinco indicadores del servidor con su definición', () => {
    responder();
    expect(q('[data-testid="observability-requests"]')!.textContent).toContain('20');
    expect(q('[data-testid="observability-succeeded"]')!.textContent).toContain('17');
    expect(q('[data-testid="observability-failed"]')!.textContent).toContain('3');
    expect(q('[data-testid="observability-p95"]')!.textContent).toContain('250');
    expect(q('[data-testid="observability-active"]')!.textContent).toContain('3');
    const totales = q('[data-testid="observability-totals"]')!.textContent!;
    expect(totales).toContain('3 del cliente (4xx)');
    expect(totales).toContain('Estimada desde un histograma');
  });

  it('una latencia que cayó en el último corte se marca como cota inferior', () => {
    responder(resumen({ latencyMs: { avg: 9000, p50: 9000, p95: 10000, max: 20000, method: 'histogram-estimate', approximate: true } }));
    expect(q('[data-testid="observability-p95"]')!.textContent).toContain('≥');
  });

  it('sin peticiones dice por qué en vez de pintar ceros', () => {
    responder(resumen({ requests: 0, succeeded: 0, failed: { client4xx: 0, server5xx: 0 }, successRatio: null, lastDataAt: null }));
    expect(q('[data-testid="observability-totals"]')).toBeNull();
    expect(texto()).toContain('Todavía no hay peticiones medidas en esta ventana.');
  });

  it('con la medición apagada lo dice y no muestra números', () => {
    responder(
      resumen({}, [{ metric: 'disabled', reason: 'La medición de peticiones HTTP está apagada (OBSERVABILITY_HTTP_SLI_ENABLED). No hay datos que mostrar.' }]),
    );
    expect(q('[data-testid="observability-totals"]')).toBeNull();
    expect(texto()).toContain('La medición de peticiones está apagada');
  });

  it('la tabla de endpoints muestra plantillas, nunca una dirección real', () => {
    responder();
    abrirPestana(1);
    const tabla = q('[data-testid="observability-endpoints"]')!.textContent!;
    expect(tabla).toContain('/patients/:id');
    expect(tabla).toContain('UNMATCHED');
    expect(texto()).toContain('nunca la dirección real');
  });

  it('ordenar por fallos vuelve a pedir con ese criterio', () => {
    responder();
    (fixture.componentInstance as unknown as { ordenar(s: { key: string; direction: string }): void }).ordenar({ key: 'failed', direction: 'desc' });
    http.expectOne(traffic).flush(resumen());
    const e = http.expectOne(porEndpoint);
    expect(e.request.params.get('sort')).toBe('failed');
    e.flush(endpoints());
  });

  it('un criterio de orden desconocido no hace ninguna petición', () => {
    responder();
    (fixture.componentInstance as unknown as { ordenar(s: { key: string; direction: string }): void }).ordenar({ key: 'DROP', direction: 'asc' });
    http.expectNone(traffic);
    http.expectNone(porEndpoint);
  });

  it('«Últimas 24 h» y «7 días» piden ventana explícita con el intervalo que acepta la API', () => {
    responder();
    const c = fixture.componentInstance as unknown as { cambiarRango(r: string): void };
    c.cambiarRango('24h');
    let t = http.expectOne(traffic);
    expect(t.request.params.get('interval')).toBe('hour');
    expect(t.request.params.get('from')).toBeTruthy();
    t.flush(resumen());
    http.expectOne(porEndpoint).flush(endpoints());
    c.cambiarRango('7d');
    t = http.expectOne(traffic);
    expect(t.request.params.get('interval')).toBe('day');
    t.flush(resumen());
    http.expectOne(porEndpoint).flush(endpoints());
  });

  it('un 422 de la API no deja números viejos en pantalla', () => {
    http.expectOne(traffic).flush({ statusCode: 422, code: 'VALIDATION_FAILED', message: '"from" debe ser anterior a "to"' }, { status: 422, statusText: 'Unprocessable Entity' });
    http.expectOne(porEndpoint).flush({ statusCode: 422, code: 'VALIDATION_FAILED', message: 'x' }, { status: 422, statusText: 'Unprocessable Entity' });
    fixture.detectChanges();
    expect(q('[data-testid="observability-totals"]')).toBeNull();
  });

  it('la pestaña «No medido» enumera lo que la medición no cubre', () => {
    responder();
    abrirPestana(3);
    expect(q('[data-testid="observability-not-measured"]')!.textContent).toContain('Rechazado antes de llegar a la API');
  });
});
