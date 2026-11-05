import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import type { MoneyReport } from '../../../core/data-access/admin-portal/analytics-money.types';
import type { TrafficEndpoint, TrafficEndpointsPage, TrafficOverview } from '../../../core/data-access/admin-portal/ops-traffic.types';
import type { OnboardingFunnelReport, OnboardingHeatmapReport } from '../../../core/onboarding/onboarding-draft.types';
import { Measurement } from './measurement';

const VENTANA = { from: '2026-10-30T00:00:00.000Z', to: '2026-10-30T15:00:00.000Z', interval: 'hour' as const, timezone: 'UTC' as const };
const ERROR_403 = { body: { statusCode: 403, code: 'FORBIDDEN', message: 'x' }, init: { status: 403, statusText: 'Forbidden' } };
const ERROR_422 = { body: { statusCode: 422, code: 'VALIDATION_FAILED', message: 'x' }, init: { status: 422, statusText: 'Unprocessable Entity' } };

function resumen(notMeasured: TrafficOverview['notMeasured'] = [
  { metric: 'rejectedBeforeApi', reason: 'Lo que Traefik contesta antes de llegar a la API no pasa por esta medición.' },
]): TrafficOverview {
  return {
    window: VENTANA,
    measured: {
      requests: 100,
      succeeded: 90,
      failed: { client4xx: 8, server5xx: 2 },
      successRatio: 0.9,
      latencyMs: { avg: 50, p50: 25, p95: 250, max: 900, method: 'histogram-estimate', approximate: false },
      activeUsers: { sessionsActiveNow: 1, usersActiveNow: 1, usersActiveInWindow: 1, definition: 'x' },
      lastDataAt: '2026-10-30T14:59:00.000Z',
    },
    series: [],
    notMeasured,
  };
}

function ep(method: string, route: string, requests: number, failed4xx: number, failed5xx: number, p95: number | null): TrafficEndpoint {
  return {
    method,
    route,
    operationId: null,
    requests,
    succeeded: requests - failed4xx - failed5xx,
    failed4xx,
    failed5xx,
    latencyMs: { avg: 10, p95, max: 1000 },
    firstSeenAt: VENTANA.from,
    lastSeenAt: VENTANA.to,
  };
}

function endpoints(items: readonly TrafficEndpoint[] = [
  ep('GET', '/appointments', 40, 2, 0, 250),
  ep('GET', '/scheduling/bookings', 10, 0, 1, 900),
  ep('GET', '/patients/:id', 30, 4, 0, 100),
  ep('GET', '/ruta-que-nadie-conoce', 5, 0, 0, 20),
  ep('GET', 'UNMATCHED', 5, 5, 0, 5),
], truncated = false): TrafficEndpointsPage {
  return { window: VENTANA, sort: 'requests', items, truncated, note: 'Las rutas son plantillas.' };
}

function dinero(sobrescribir: Partial<MoneyReport> = {}): MoneyReport {
  return {
    window: { from: VENTANA.from, to: VENTANA.to },
    items: [
      { module: 'billing', moduleLabel: 'Facturación (SIMULADO)', kind: 'FACTURADO', currency: 'BOB', operations: 12, amount: '18450.50' },
      { module: 'billing', moduleLabel: 'Facturación (SIMULADO)', kind: 'COBRADO', currency: 'BOB', operations: 9, amount: '9007199254740993.10' },
      { module: 'billing', moduleLabel: 'Facturación (SIMULADO)', kind: 'FACTURADO', currency: 'USD', operations: 2, amount: '310.75' },
    ],
    notMeasured: [{ module: 'laboratory', reason: 'SIMULADO: todavía no registra importes.' }],
    ...sobrescribir,
  };
}

function calor(sobrescribir: Partial<OnboardingHeatmapReport> = {}): OnboardingHeatmapReport {
  return {
    formType: 'patient',
    metric: 'errors',
    totalInteractions: 1000,
    totalErrors: 300,
    totalAbandons: 100,
    fields: [
      { fieldKey: 'nationalId', fieldLabel: 'Cédula de identidad (CI)', stepNumber: 1, stepKey: 'identidad', interactionCount: 980, errorCount: 112, abandonmentCount: 38, averageTimeMs: 5475, thermalScore: 35, thermalLevel: 'low' },
      { fieldKey: 'workEmployerConceptId', fieldLabel: 'Empresa / Empleador', stepNumber: 3, stepKey: 'ocupacion', interactionCount: 800, errorCount: 294, abandonmentCount: 101, averageTimeMs: 10320, thermalScore: 92, thermalLevel: 'critical' },
    ],
    ...sobrescribir,
  };
}

function embudo(): OnboardingFunnelReport {
  return {
    formType: 'patient',
    totalStarted: 1420,
    totalCompleted: 532,
    overallConversion: 0.3746,
    bottleneckStepNumber: 3,
    averageCompletionMinutes: 5.4,
    steps: [],
  };
}

describe('Measurement', () => {
  let fixture: ComponentFixture<Measurement>;
  let http: HttpTestingController;

  const esTrafico = (r: { url: string }) => r.url === '/admin/ops/traffic';
  const esEndpoints = (r: { url: string }) => r.url === '/admin/ops/traffic/endpoints';
  const esDinero = (r: { url: string }) => r.url === '/admin/analytics/money';
  const esCalor = (r: { url: string }) => r.url === '/admin/analytics/onboarding/heatmap';
  const esEmbudo = (r: { url: string }) => r.url === '/admin/analytics/onboarding/funnel';
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
  const q = <T extends Element>(selector: string) => (fixture.nativeElement as HTMLElement).querySelector<T>(selector);
  const qa = <T extends Element>(selector: string) => Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<T>(selector));

  async function montar(queryParams: Record<string, string> = {}): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [Measurement],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Measurement);
    fixture.detectChanges();
  }

  afterEach(() => http.verify({ ignoreCancelled: true }));

  function abrirPestana(indice: number): void {
    (fixture.componentInstance as unknown as { pestana: { set(i: number): void } }).pestana.set(indice);
    fixture.detectChanges();
  }

  function responderTodo(
    opciones: { trafico?: TrafficOverview; endpoints?: TrafficEndpointsPage; dinero?: MoneyReport; calor?: OnboardingHeatmapReport } = {},
  ): void {
    http.expectOne(esTrafico).flush(opciones.trafico ?? resumen());
    http.expectOne(esEndpoints).flush(opciones.endpoints ?? endpoints());
    http.expectOne(esDinero).flush(opciones.dinero ?? dinero());
    http.expectOne(esCalor).flush(opciones.calor ?? calor());
    http.expectOne(esEmbudo).flush(embudo());
    fixture.detectChanges();
  }

  function filasDeUso(): string[][] {
    return qa<HTMLElement>('[data-testid="measurement-usage"] tbody tr').map((tr) =>
      Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent ?? '').trim()),
    );
  }

  describe('pedidos', () => {
    beforeEach(async () => montar());

    it('«Hoy» pide el tráfico sin `from`, los 200 endpoints más pedidos, el dinero con `from` explícito y el mapa de las últimas 24 h', () => {
      const t = http.expectOne(esTrafico);
      expect(t.request.params.has('from')).toBe(false);
      expect(t.request.params.get('interval')).toBe('hour');
      const e = http.expectOne(esEndpoints);
      expect(e.request.params.get('limit')).toBe('200');
      expect(e.request.params.get('sort')).toBe('requests');
      const d = http.expectOne(esDinero);
      expect(d.request.params.get('from')).toBeTruthy();
      expect(d.request.params.get('to')).toBeTruthy();
      expect(new Date(d.request.params.get('from')!).getUTCHours()).toBe(0);
      const c = http.expectOne(esCalor);
      expect(c.request.params.get('range')).toBe('24h');
      expect(c.request.params.get('formType')).toBe('patient');
      expect(c.request.params.get('metric')).toBe('errors');
      for (const r of [t, e, d, c]) r.flush({});
      http.expectOne(esEmbudo).flush({});
    });

    it('«7 días» pide ventana explícita por día y el mapa de calor de 7 días', () => {
      responderTodo();
      (fixture.componentInstance as unknown as { cambiarRango(r: string): void }).cambiarRango('7d');
      const t = http.expectOne(esTrafico);
      expect(t.request.params.get('interval')).toBe('day');
      expect(t.request.params.get('from')).toBeTruthy();
      t.flush(resumen());
      http.expectOne(esEndpoints).flush(endpoints());
      const d = http.expectOne(esDinero);
      expect(Date.parse(d.request.params.get('to')!) - Date.parse(d.request.params.get('from')!)).toBe(7 * 24 * 3_600_000);
      d.flush(dinero());
      const c = http.expectOne(esCalor);
      expect(c.request.params.get('range')).toBe('7d');
      c.flush(calor());
      http.expectOne(esEmbudo).flush(embudo());
    });
  });

  describe('Uso', () => {
    beforeEach(async () => montar());

    it('agrupa los endpoints por funcionalidad y suma solicitudes y fallidas', () => {
      responderTodo();
      const filas = filasDeUso();
      const agenda = filas.find((f) => f[0]!.includes('Agenda y citas'))!;
      expect(agenda[1]).toContain('50');
      expect(agenda[2]).toContain('3 (2 · 1)');
      const personas = filas.find((f) => f[0]!.includes('Pacientes'))!;
      expect(personas[1]).toContain('30');
      expect(q('[data-testid="measurement-usage-totals"]')!.textContent).toContain('90');
    });

    it('el p95 de una funcionalidad es el peor de sus endpoints, no un promedio, y dice cuál es', () => {
      responderTodo();
      const agenda = filasDeUso().find((f) => f[0]!.includes('Agenda y citas'))!;
      expect(agenda.join(' ')).toContain('900');
      expect(agenda.join(' ')).toContain('GET /scheduling/bookings');
      expect(agenda.join(' ')).not.toContain('575');
      expect(q('[data-testid="measurement-method"]')!.textContent).toContain('no se promedia');
    });

    it('lo que ningún prefijo reclama queda en «Otros», visible, y la ruta UNMATCHED también', () => {
      responderTodo();
      const otros = filasDeUso().find((f) => f[0]!.includes('Otros'))!;
      expect(otros[1]).toContain('10');
      abrirPestana(3);
      const tabla = q('[data-testid="measurement-others"]')!.textContent!;
      expect(tabla).toContain('/ruta-que-nadie-conoce');
      expect(tabla).toContain('UNMATCHED');
      expect(tabla).not.toContain('/appointments');
    });

    it('no pinta un total engañoso: la suma de las funcionalidades es la de los endpoints leídos', () => {
      responderTodo();
      const suma = filasDeUso().reduce((s, f) => s + Number(f[1]!.replace(/\D/g, '')), 0);
      expect(suma).toBe(90);
    });

    it('cuando la API trunca la lista avisa que las cifras son un mínimo', () => {
      responderTodo({ endpoints: endpoints(undefined, true) });
      expect(q('[data-testid="measurement-truncated"]')!.textContent).toContain('un mínimo');
    });

    it('con la medición apagada lo dice y no muestra ceros', () => {
      responderTodo({ trafico: resumen([{ metric: 'disabled', reason: 'apagada' }]) });
      expect(q('[data-testid="measurement-usage-totals"]')).toBeNull();
      expect(texto()).toContain('La medición de peticiones está apagada');
    });

    it('sin endpoints dice por qué en vez de pintar una tabla de ceros', () => {
      responderTodo({ endpoints: endpoints([]) });
      expect(q('[data-testid="measurement-usage-totals"]')).toBeNull();
      expect(texto()).toContain('Ninguna funcionalidad recibió peticiones');
    });

    it('ordenar por fallidas reordena en el cliente sin pedir de nuevo', () => {
      responderTodo();
      (fixture.componentInstance as unknown as { ordenar(s: { key: string; direction: string }): void }).ordenar({ key: 'failed', direction: 'desc' });
      fixture.detectChanges();
      http.expectNone(esTrafico);
      expect(filasDeUso()[0]![0]).toContain('Otros');
    });

    it('«No medido» enumera lo que la medición no cubre', () => {
      responderTodo();
      abrirPestana(3);
      expect(q('[data-testid="measurement-not-measured"]')!.textContent).toContain('Rechazado antes de llegar a la API');
    });
  });

  describe('Dinero', () => {
    beforeEach(async () => montar({ pestana: '1' }));

    it('abre en la pestaña pedida por la portada', () => {
      responderTodo();
      expect(q('[data-testid="measurement-money-BOB"]')).not.toBeNull();
    });

    it('cada moneda va en su propia tabla y no se suman monedas ni tipos', () => {
      responderTodo();
      const bob = q('[data-testid="measurement-money-BOB"]')!.textContent!;
      const usd = q('[data-testid="measurement-money-USD"]')!.textContent!;
      expect(bob).toContain('18.450,50');
      expect(bob).not.toContain('310,75');
      expect(usd).toContain('310,75');
      expect(usd).not.toContain('18.450,50');
      expect(qa('[data-testid^="measurement-money-"]').filter((e) => e.tagName === 'SECTION').length).toBe(2);
      expect(q('[data-testid="measurement-money-method"]')!.textContent).toContain('no se convierte ni se suma');
    });

    it('el importe se formatea por cadena: un valor mayor que 2^53 conserva el último centavo', () => {
      responderTodo();
      expect(q('[data-testid="measurement-money-BOB"]')!.textContent).toContain('9.007.199.254.740.993,10');
    });

    it('lo no medido se dice «sin medir» con su razón y no figura como importe cero', () => {
      responderTodo();
      const sinMedir = q('[data-testid="measurement-money-not-measured"]')!.textContent!;
      expect(sinMedir).toContain('laboratory');
      expect(sinMedir).toContain('sin medir');
      expect(sinMedir).toContain('todavía no registra importes');
      expect(q('[data-testid="measurement-money-BOB"]')!.textContent).not.toContain('laboratory');
      expect(texto()).not.toContain('0,00');
    });

    it('sin importes no inventa una moneda con cero: dice que no hay nada medido', () => {
      responderTodo({ dinero: dinero({ items: [] }) });
      expect(q('[data-testid="measurement-money-empty"]')!.textContent).toContain('no significa que se haya movido cero');
      expect(qa('section[data-testid^="measurement-money-"]').length).toBe(0);
      expect(q('[data-testid="measurement-money-not-measured"]')).not.toBeNull();
    });

    it('un 403 del dinero no apaga el uso ni el mapa de calor', () => {
      http.expectOne(esTrafico).flush(resumen());
      http.expectOne(esEndpoints).flush(endpoints());
      http.expectOne(esDinero).flush(ERROR_403.body, ERROR_403.init);
      http.expectOne(esCalor).flush(calor());
      http.expectOne(esEmbudo).flush(embudo());
      fixture.detectChanges();
      expect(q('[data-testid="measurement-money-BOB"]')).toBeNull();
      abrirPestana(0);
      expect(q('[data-testid="measurement-usage-totals"]')).not.toBeNull();
      abrirPestana(2);
      expect(q('[data-testid="measurement-heatmap"]')).not.toBeNull();
    });

    it('un 422 no deja importes viejos en pantalla', () => {
      http.expectOne(esTrafico).flush(resumen());
      http.expectOne(esEndpoints).flush(endpoints());
      http.expectOne(esDinero).flush(ERROR_422.body, ERROR_422.init);
      http.expectOne(esCalor).flush(calor());
      http.expectOne(esEmbudo).flush(embudo());
      fixture.detectChanges();
      expect(q('[data-testid="measurement-money-BOB"]')).toBeNull();
    });
  });

  describe('Mapa de calor', () => {
    beforeEach(async () => montar({ pestana: '2' }));

    it('cada campo dice su nivel con palabras, su valor visible y su texto alternativo', () => {
      responderTodo();
      const celdas = qa<HTMLElement>('[data-testid="measurement-heatmap"] li');
      expect(celdas.length).toBe(2);
      const critica = celdas.find((c) => (c.textContent ?? '').includes('Empleador'))!;
      expect(critica.textContent).toContain('Punto crítico');
      expect(critica.textContent).toContain('92');
      expect(critica.textContent).toContain('294 errores de validación');
      expect(critica.getAttribute('aria-label')).toContain('intensidad 92 de 100');
      expect(critica.getAttribute('aria-label')).toContain('punto crítico');
      expect(critica.getAttribute('tabindex')).toBe('0');
      const barra = critica.querySelector('.medicion__barra')!;
      expect(barra.getAttribute('aria-hidden')).toBe('true');
    });

    it('resume el mapa en un texto equivalente para quien no ve los colores', () => {
      responderTodo();
      const resumenTexto = q('[data-testid="measurement-heatmap-summary"]')!.textContent!;
      expect(resumenTexto).toContain('2 campos medidos, 1 en punto crítico');
      expect(resumenTexto).toContain('Empresa / Empleador');
      expect(q('[data-testid="measurement-heatmap"]')!.getAttribute('aria-describedby')).toBe('medicion-resumen-mapa');
      expect(q('[data-testid="measurement-heatmap-legend"]')!.textContent).toContain('Punto crítico');
    });

    it('muestra el embudo de la misma alta', () => {
      responderTodo();
      const e = q('[data-testid="measurement-funnel"]')!.textContent!;
      expect(e).toContain('1.420');
      expect(e).toContain('Paso 3');
    });

    it('cambiar el tipo de alta o la métrica vuelve a pedir con ese criterio', () => {
      responderTodo();
      const c = fixture.componentInstance as unknown as { cambiarTipoAlta(t: string): void; cambiarMetrica(m: string): void };
      c.cambiarTipoAlta('pharmacy');
      let h = http.expectOne(esCalor);
      expect(h.request.params.get('formType')).toBe('pharmacy');
      h.flush(calor());
      http.expectOne(esEmbudo).flush(embudo());
      c.cambiarMetrica('abandonment');
      h = http.expectOne(esCalor);
      expect(h.request.params.get('metric')).toBe('abandonment');
      h.flush(calor({ metric: 'abandonment' }));
      http.expectOne(esEmbudo).flush(embudo());
      fixture.detectChanges();
      expect(q('[data-testid="measurement-heatmap"]')!.textContent).toContain('101 abandonos en este campo');
    });

    it('sin campos medidos lo dice y no dibuja una grilla vacía', () => {
      responderTodo({ calor: calor({ fields: [] }) });
      expect(q('[data-testid="measurement-heatmap"]')).toBeNull();
      expect(texto()).toContain('Todavía no hay interacciones medidas');
    });

    it('un 403 del mapa no apaga el uso', () => {
      http.expectOne(esTrafico).flush(resumen());
      http.expectOne(esEndpoints).flush(endpoints());
      http.expectOne(esDinero).flush(dinero());
      http.expectOne(esCalor).flush(ERROR_403.body, ERROR_403.init);
      http.expectOne(esEmbudo).flush(ERROR_403.body, ERROR_403.init);
      fixture.detectChanges();
      expect(q('[data-testid="measurement-heatmap"]')).toBeNull();
      abrirPestana(0);
      expect(q('[data-testid="measurement-usage-totals"]')).not.toBeNull();
    });
  });
});
