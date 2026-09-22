import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';

import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { QaPlanDetail } from './qa-plan-detail';

const PLAN = {
  id: 'p1',
  runId: 'r1',
  suiteId: 's1',
  environmentId: 'e1',
  planHash: 'a'.repeat(64),
  status: 'PENDING_APPROVAL',
  requiresApproval: true,
  approvalReasons: ['PRIVATE_NETWORK_TARGET'],
  requestedByUserId: 'u',
  createdAt: null,
  finishedAt: null,
  counters: { requestsSent: 0, casesPassed: 0, casesFailed: 0, casesNotRun: 0 },
  error: null,
  steps: [],
  limits: { maxRequests: 300, maxDurationSeconds: 60, requestTimeoutMs: 10000, minIntervalMs: 200 },
  approvals: [],
  events: [{ seq: 1, kind: 'PLAN_CREATED', caseId: null, detail: null, at: null }],
};

describe('QaPlanDetail', () => {
  let fixture: ComponentFixture<QaPlanDetail>;
  let http: HttpTestingController;
  const dialogs = { confirm: vi.fn(), confirmWithReason: vi.fn() };

  beforeEach(async () => {
    vi.useFakeTimers();
    await TestBed.configureTestingModule({
      imports: [QaPlanDetail],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DialogService, useValue: dialogs },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ planId: 'p1' }) } },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(QaPlanDetail);
    fixture.detectChanges();
    http.expectOne('/admin/qa/plans/p1').flush(PLAN);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    vi.useRealTimers();
    http.verify({ ignoreCancelled: true });
  });

  it('aprueba sobre el hash del plan y explica el 403 de segregación', async () => {
    dialogs.confirmWithReason.mockResolvedValue('Revisado: sólo lecturas a staging');
    await (fixture.componentInstance as unknown as { decidir(d: string): Promise<void> }).decidir('APPROVED');
    const req = http.expectOne('/admin/qa/plans/p1/approvals');
    expect(req.request.body).toEqual({
      decision: 'APPROVED',
      planHash: 'a'.repeat(64),
      reason: 'Revisado: sólo lecturas a staging',
    });
    req.flush(
      { code: 'FORBIDDEN', message: 'x', details: { violations: [{ reason: 'SELF_APPROVAL', message: 'x' }] } },
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Quien pidió el plan no puede aprobarlo',
    );
  });

  it('un 403 sin violación de segregación se explica como falta de rol', async () => {
    dialogs.confirmWithReason.mockResolvedValue('Revisado: sólo lecturas a staging');
    await (fixture.componentInstance as unknown as { decidir(d: string): Promise<void> }).decidir('APPROVED');
    http
      .expectOne('/admin/qa/plans/p1/approvals')
      .flush({ code: 'FORBIDDEN', message: 'x' }, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Tu rol no permite aprobar planes de ejecución.');
    expect(texto).not.toContain('Quien pidió el plan');
  });

  it('mientras el plan está vivo se relee solo, y deja de hacerlo al terminar', () => {
    vi.advanceTimersByTime(3000);
    http.expectOne('/admin/qa/plans/p1').flush({ ...PLAN, status: 'PASSED' });
    vi.advanceTimersByTime(10_000);
    http.expectNone('/admin/qa/plans/p1');
  });
});
