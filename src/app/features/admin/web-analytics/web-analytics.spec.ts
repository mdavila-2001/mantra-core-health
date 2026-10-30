import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { WebAnalytics } from './web-analytics';

const W = { from: 'a', to: 'b', interval: 'day', timezone: 'UTC', portal: null };

describe('WebAnalytics', () => {
  let fixture: ComponentFixture<WebAnalytics>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WebAnalytics],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(WebAnalytics);
    fixture.detectChanges();
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  const url = (u: string) => (r: { url: string }) => r.url === u;

  function responder(conEmbudos = true): void {
    if (conEmbudos) http.expectOne('/admin/analytics/funnels').flush([]);
    http.expectOne(url('/admin/analytics/overview')).flush({
      window: W,
      totals: { events: 1500, sessions: 30, pseudonymousSubjects: 12, pageViews: 800, lastEventAt: null },
      definitions: { sessions: 'session_id distintos', pseudonymousSubjects: 'no usuarios únicos' },
      topRoutes: [{ route: '/search', events: 900, sessions: 20 }],
      topEvents: [{ eventName: 'page_view', events: 800, sessions: 30 }],
    });
    http.expectOne(url('/admin/analytics/timeseries')).flush({ window: W, points: [{ bucket: '2026-09-18T00:00:00.000Z', events: 10, sessions: 2 }], note: 'n' });
    http.expectOne(url('/admin/analytics/web-vitals')).flush({ window: W, method: 'percentile_cont', metrics: [] });
    http.expectOne(url('/admin/analytics/pipeline-health')).flush({
      window: W,
      measured: { accepted: 1500, lastReceivedAt: null, freshnessSeconds: null, ingestLagSeconds: { p50: null, p95: null }, clockSkewFuture: 0, lateOver24h: 0, withoutSession: 0, clientContexts: 0, bots: 0, botUnknown: 0 },
      notMeasured: [{ metric: 'duplicates', reason: 'No se persisten.' }],
    });
    http.expectOne(url('/admin/analytics/sessions')).flush({ window: W, items: [], nextCursor: null, limit: 50 });
    http.expectOne((r) => r.url === '/admin/analytics/onboarding/funnel').flush({
      formType: 'patient',
      totalStarted: 1420,
      totalCompleted: 532,
      overallConversion: 0.3746,
      bottleneckStepNumber: 3,
      averageCompletionMinutes: 5.4,
      steps: [
        {
          stepNumber: 1,
          stepKey: 'identidad',
          stepTitle: 'Identidad personal',
          reachedCount: 1420,
          conversionFromStart: 1,
          conversionFromPrevious: null,
          droppedFromPrevious: null,
          averageDwellSeconds: 45,
        },
      ],
    });
    http.expectOne((r) => r.url === '/admin/analytics/onboarding/heatmap').flush({
      formType: 'patient',
      metric: 'errors',
      totalInteractions: 500,
      totalErrors: 40,
      totalAbandons: 10,
      fields: [
        {
          fieldKey: 'nationalId',
          fieldLabel: 'Cédula de identidad (CI)',
          stepNumber: 1,
          stepKey: 'identidad',
          interactionCount: 500,
          errorCount: 40,
          abandonmentCount: 10,
          averageTimeMs: 2500,
          thermalScore: 35,
          thermalLevel: 'low',
        },
      ],
    });
    fixture.detectChanges();
  }

  it('pide todas las lecturas con ventana explícita y sin portal si no se eligió', () => {
    http.expectOne('/admin/analytics/funnels').flush([]);
    const req = http.expectOne(url('/admin/analytics/overview'));
    expect(req.request.params.get('from')).toBeTruthy();
    expect(req.request.params.get('interval')).toBe('day');
    expect(req.request.params.has('portal')).toBe(false);
    req.flush({ window: W, totals: { events: 0, sessions: 0, pseudonymousSubjects: 0, pageViews: 0, lastEventAt: null }, definitions: {}, topRoutes: [], topEvents: [] });
    http.expectOne(url('/admin/analytics/timeseries')).flush({ window: W, points: [], note: '' });
    http.expectOne(url('/admin/analytics/web-vitals')).flush({ window: W, method: '', metrics: [] });
    http.expectOne(url('/admin/analytics/pipeline-health')).flush({
      window: W,
      measured: { accepted: 0, lastReceivedAt: null, freshnessSeconds: null, ingestLagSeconds: { p50: null, p95: null }, clockSkewFuture: 0, lateOver24h: 0, withoutSession: 0, clientContexts: 0, bots: 0, botUnknown: 0 },
      notMeasured: [],
    });
    http.expectOne(url('/admin/analytics/sessions')).flush({ window: W, items: [], nextCursor: null, limit: 50 });
    http.expectOne((r) => r.url === '/admin/analytics/onboarding/funnel').flush({
      formType: 'patient',
      totalStarted: 0,
      totalCompleted: 0,
      overallConversion: 0,
      bottleneckStepNumber: 1,
      averageCompletionMinutes: 0,
      steps: [],
    });
    http.expectOne((r) => r.url === '/admin/analytics/onboarding/heatmap').flush({
      formType: 'patient',
      metric: 'errors',
      totalInteractions: 0,
      totalErrors: 0,
      totalAbandons: 0,
      fields: [],
    });
  });

  it('muestra los totales con la definición del servidor', () => {
    responder();
    const texto = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="analytics-totals"]')!.textContent!;
    expect(texto).toContain('1500'.replace(/(\d)(?=(\d{3})+$)/g, '$1.'));
    expect(texto).toContain('no usuarios únicos');
  });

  it('el filtro del embudo de altas no ofrece «medical-center»: ni el simulador ni la API tienen su embudo y caería al de paciente', () => {
    responder();
    const opciones = (
      fixture.componentInstance as unknown as { opcionesTipoAlta: readonly { value: string }[] }
    ).opcionesTipoAlta;

    expect(opciones.map((o) => o.value)).toEqual([
      'patient',
      'practitioner',
      'organization',
      'laboratory',
      'imaging-center',
      'pharmacy',
    ]);
  });

  it('elegir 24 h pide intervalo por hora', () => {
    responder();
    (fixture.componentInstance as unknown as { cambiarRango(r: string): void }).cambiarRango('24h');
    const req = http.expectOne((r) => r.url === '/admin/analytics/timeseries');
    expect(req.request.params.get('interval')).toBe('hour');
    req.flush({ window: W, points: [], note: '' });
    http.expectOne(url('/admin/analytics/overview')).flush({
      window: W,
      totals: { events: 0, sessions: 0, pseudonymousSubjects: 0, pageViews: 0, lastEventAt: null },
      definitions: {},
      topRoutes: [],
      topEvents: [],
    });
    http.expectOne(url('/admin/analytics/web-vitals')).flush({ window: W, method: '', metrics: [] });
    http.expectOne(url('/admin/analytics/pipeline-health')).flush({
      window: W,
      measured: { accepted: 0, lastReceivedAt: null, freshnessSeconds: null, ingestLagSeconds: { p50: null, p95: null }, clockSkewFuture: 0, lateOver24h: 0, withoutSession: 0, clientContexts: 0, bots: 0, botUnknown: 0 },
      notMeasured: [],
    });
    http.expectOne(url('/admin/analytics/sessions')).flush({ window: W, items: [], nextCursor: null, limit: 50 });
    http.expectOne((r) => r.url === '/admin/analytics/onboarding/funnel').flush({
      formType: 'patient',
      totalStarted: 0,
      totalCompleted: 0,
      overallConversion: 0,
      bottleneckStepNumber: 1,
      averageCompletionMinutes: 0,
      steps: [],
    });
    http.expectOne((r) => r.url === '/admin/analytics/onboarding/heatmap').flush({
      formType: 'patient',
      metric: 'errors',
      totalInteractions: 0,
      totalErrors: 0,
      totalAbandons: 0,
      fields: [],
    });
  });

  it('renderiza la sección de Altas y Deserción con embudo y mapa de calor', () => {
    responder();
    const nat = fixture.nativeElement as HTMLElement;
    const tabButtons = Array.from(nat.querySelectorAll<HTMLButtonElement>('button[role="tab"]'));
    const altasTab = tabButtons.find((btn) => btn.textContent?.includes('Altas y Deserción'));
    altasTab?.click();
    fixture.detectChanges();

    expect(nat.querySelector('[data-testid="analytics-onboarding-toolbar"]')).not.toBeNull();
    expect(nat.querySelector('[data-testid="onboarding-kpi-totals"]')).not.toBeNull();
    expect(nat.querySelector('[data-testid="onboarding-funnel-steps"]')).not.toBeNull();
    expect(nat.querySelector('[data-testid="onboarding-heatmap-grid"]')).not.toBeNull();
  });
});
