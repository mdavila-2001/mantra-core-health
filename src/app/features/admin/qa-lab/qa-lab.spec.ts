import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { NewPlanDialog } from './new-plan-dialog';
import { QaLab } from './qa-lab';

const PLAN = {
  id: 'p1',
  runId: 'r1',
  suiteId: 's1',
  environmentId: 'e1',
  planHash: 'h'.repeat(64),
  status: 'FAILED',
  requiresApproval: false,
  approvalReasons: [],
  requestedByUserId: 'u',
  createdAt: '2026-09-18T10:00:00.000Z',
  finishedAt: null,
  counters: { requestsSent: 3, casesPassed: 2, casesFailed: 1, casesNotRun: 0 },
  error: null,
};

describe('QaLab', () => {
  let fixture: ComponentFixture<QaLab>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [QaLab],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(QaLab);
    fixture.detectChanges();
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  it('lista los planes con su resultado y el entorno legible', () => {
    http.expectOne('/admin/qa/plans').flush([PLAN]);
    http.expectOne('/admin/qa/suites').flush([]);
    http.expectOne('/admin/qa/runs').flush([]);
    http.expectOne('/admin/qa/defects').flush([]);
    http.expectOne('/admin/qa/targets').flush([]);
    http
      .expectOne('/admin/qa/environments')
      .flush([{ id: 'e1', code: 'STAGING', name: 'Staging', kind: 'ENV_STAGING', baseUrl: null, state: 'ACTIVE' }]);
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Con fallos');
    expect(texto).toContain('2 pasaron · 1 fallaron');
    expect(texto).toContain('STAGING');
  });
});

describe('NewPlanDialog', () => {
  let http: HttpTestingController;

  const PREFLIGHT = {
    executable: true,
    steps: [{ caseId: 'c1', code: 'C1', method: 'GET', url: 'https://x/api/a', mutating: false }],
    limits: { maxRequests: 300, maxDurationSeconds: 60, requestTimeoutMs: 10000, minIntervalMs: 200 },
    hash: 'h'.repeat(64),
    requiresApproval: true,
    approvalReasons: ['PRIVATE_NETWORK_TARGET'],
    violations: [],
    clamped: [],
    loadTesting: 'NOT_SUPPORTED',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NewPlanDialog],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  function abrir() {
    const fixture = TestBed.createComponent(NewPlanDialog);
    fixture.componentRef.setInput('suites', [
      { id: 's1', code: 'SMOKE', name: 'Humo', version: 1, state: null, ownerTeam: null, cases: 1, activeCases: 1, lastRun: null },
    ]);
    fixture.componentRef.setInput('environments', [
      { id: 'e1', code: 'STG', name: 'Staging', kind: null, baseUrl: null, state: null },
    ]);
    fixture.detectChanges();
    const c = fixture.componentInstance as unknown as {
      elegir(campo: string, valor: string): void;
      revisar(): void;
      pedir(): void;
    };
    c.elegir('suite', 's1');
    c.elegir('entorno', 'e1');
    return { fixture, c };
  }

  it('primero revisa (preflight) y recién después pide, con clave de idempotencia', () => {
    const { fixture, c } = abrir();
    c.revisar();
    const pre = http.expectOne('/admin/qa/plans/preflight');
    expect(pre.request.body).toEqual({ suiteId: 's1', environmentId: 'e1' });
    pre.flush(PREFLIGHT);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Necesita aprobación de otra persona');
    c.pedir();
    const post = http.expectOne('/admin/qa/plans');
    expect(post.request.headers.get('Idempotency-Key')).toMatch(/^plan-/);
    post.flush({ ...PLAN, status: 'PENDING_APPROVAL', steps: [], limits: PREFLIGHT.limits, approvals: [], events: [], created: true });
  });

  it('un plan no ejecutable no se puede pedir', () => {
    const { fixture, c } = abrir();
    c.revisar();
    http.expectOne('/admin/qa/plans/preflight').flush({
      ...PREFLIGHT,
      executable: false,
      violations: [{ code: 'PATH_NOT_ALLOWED', message: 'Ruta fuera', caseCode: 'C1' }],
    });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('El plan no es ejecutable');
    c.pedir();
    http.expectNone('/admin/qa/plans');
  });
});
