import { provideHttpClient } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { ReviewPage } from './review-page';
import { MIN_REJECTION_LENGTH, reviewFailure } from './review.model';

const RUTA = '/superadmin/portal/systems/review';

const RESUMEN = {
  id: 'o1',
  schemaName: 'scheduling',
  objectName: 'appointments',
  objectKind: 'TABLE',
  observationStatus: 'OBSERVED',
  columnCount: 7,
  statistics: { estimatedRows: '10', totalBytes: null, isEstimate: true, observedAt: null },
  lastSeenAt: null,
  annotation: {
    id: 'a1',
    businessName: 'Cita',
    reviewStatus: 'NEEDS_REVIEW',
    hasPurpose: true,
    hasExistenceRationale: false,
    hasRowGrain: false,
    owner: 'Admisión',
    sensitivity: 'UNKNOWN',
  },
};

function objeto(evidenceCount: number) {
  return {
    id: 'o1',
    technical: {
      schemaName: 'scheduling',
      objectName: 'appointments',
      objectKind: 'TABLE',
      comment: null,
      columnCount: 7,
      primaryKey: ['id'],
      statistics: { estimatedRows: '10', totalBytes: null, isEstimate: true, observedAt: null, method: 'reltuples' },
    },
    observation: { status: 'OBSERVED', lastSeenAt: null, notObservedSince: null, lastScanEngineVersion: '18' },
    annotation: {
      id: 'a1',
      targetKind: 'OBJECT',
      version: 3,
      reviewStatus: 'NEEDS_REVIEW',
      origin: 'MANUAL',
      currentRevisionNo: 2,
      approvedRevisionNo: null,
      approvedAt: null,
      approvalIsCurrent: false,
      updatedAt: null,
      content: {
        businessName: 'Cita',
        definition: null,
        purpose: 'Registrar las citas',
        existenceRationale: null,
        rowGrain: null,
        alternativesRationale: null,
        processSupported: null,
        sourceOfTruth: null,
        producers: [],
        consumers: [],
        deletionImpact: null,
        businessOwner: 'Admisión',
        dataSteward: null,
        technicalOwner: null,
        unit: null,
        valueDomain: null,
        nullSemantics: null,
        sensitivity: 'UNKNOWN',
        openQuestions: [],
      },
    },
    coverage: {
      technical: 'COMPLETE',
      semantic: 'MISSING',
      ownership: 'COMPLETE',
      sensitivity: 'UNKNOWN',
      review: 'NOT_APPROVED',
      missingFields: ['existenceRationale'],
    },
    governance: null,
    evidenceCount,
  };
}

const tick = () => new Promise<void>((listo) => setTimeout(listo, 0));

describe('ReviewPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  const dialogs = { confirm: vi.fn(), confirmWithReason: vi.fn() };

  async function abrir(query = ''): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'superadmin/portal/systems/review', component: ReviewPage }]),
        { provide: DialogService, useValue: dialogs },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`${RUTA}${query}`, ReviewPage);
    http.expectOne('/admin/catalog/schemas').flush([]);
  }

  function cola() {
    return http.expectOne((r) => r.url === '/admin/catalog/objects');
  }

  function documento(): HTMLElement {
    return harness.fixture.nativeElement as HTMLElement;
  }

  function boton(testId: string): HTMLButtonElement {
    return documento().querySelector<HTMLButtonElement>(`button[data-testid="${testId}"]`)!;
  }

  beforeEach(() => {
    dialogs.confirm.mockReset();
    dialogs.confirmWithReason.mockReset();
  });

  afterEach(() => http.verify());

  it('pide sólo las fichas en revisión y las lista', async () => {
    await abrir();
    const req = cola();
    expect(req.request.params.get('reviewStatus')).toBe('NEEDS_REVIEW');
    expect(req.request.params.get('limit')).toBe('25');
    req.flush({ items: [RESUMEN], nextCursor: null, limit: 25 });
    harness.detectChanges();
    const tabla = documento().querySelector('[data-testid="portal-review-table"]')!;
    expect(tabla.textContent).toContain('scheduling.appointments');
    expect(tabla.textContent).toContain('Admisión');
  });

  it('sin evidencia no ofrece aprobar y explica por qué', async () => {
    await abrir('?ficha=o1');
    cola().flush({ items: [RESUMEN], nextCursor: null, limit: 25 });
    http.expectOne('/admin/catalog/objects/o1').flush(objeto(0));
    harness.detectChanges();
    // `app-button` deshabilita con `aria-disabled` (sigue enfocable) y corta el clic.
    expect(boton('portal-review-approve').getAttribute('aria-disabled')).toBe('true');
    boton('portal-review-approve').click();
    await tick();
    expect(dialogs.confirm).not.toHaveBeenCalled();
    expect(documento().querySelector('[data-testid="portal-review-needs-evidence"]')).not.toBeNull();
    expect(documento().textContent).toContain('Le falta: por qué existe.');
  });

  it('rechazar pide el motivo y lo manda con la revisión vigente', async () => {
    dialogs.confirmWithReason.mockResolvedValue('Falta el grano de fila');
    await abrir('?ficha=o1');
    cola().flush({ items: [RESUMEN], nextCursor: null, limit: 25 });
    http.expectOne('/admin/catalog/objects/o1').flush(objeto(0));
    harness.detectChanges();

    boton('portal-review-reject').click();
    await tick();
    expect(dialogs.confirmWithReason.mock.calls[0]![1]).toMatchObject({ minLength: MIN_REJECTION_LENGTH });
    const req = http.expectOne('/admin/catalog/annotations/a1/review');
    expect(req.request.body).toEqual({
      decision: 'REJECTED',
      expectedRevisionNo: 2,
      comment: 'Falta el grano de fila',
    });
    req.flush({ ...objeto(0).annotation, reviewStatus: 'REJECTED' });
    await tick();
    harness.detectChanges();

    expect(documento().querySelector('[data-testid="portal-review-notice"]')?.textContent).toContain('rechazada');
    expect(TestBed.inject(Router).url).toBe(RUTA);
    cola().flush({ items: [], nextCursor: null, limit: 25 });
  });

  it('arrepentirse en el diálogo no manda nada', async () => {
    dialogs.confirm.mockResolvedValue(false);
    await abrir('?ficha=o1');
    cola().flush({ items: [RESUMEN], nextCursor: null, limit: 25 });
    http.expectOne('/admin/catalog/objects/o1').flush(objeto(1));
    harness.detectChanges();
    boton('portal-review-approve').click();
    await tick();
    http.expectNone('/admin/catalog/annotations/a1/review');
  });

  it('si quien decide es quien escribió, lo dice con esas palabras', async () => {
    dialogs.confirm.mockResolvedValue(true);
    await abrir('?ficha=o1');
    cola().flush({ items: [RESUMEN], nextCursor: null, limit: 25 });
    http.expectOne('/admin/catalog/objects/o1').flush(objeto(1));
    harness.detectChanges();
    boton('portal-review-approve').click();
    await tick();
    const req = http.expectOne('/admin/catalog/annotations/a1/review');
    expect(req.request.body).toEqual({ decision: 'APPROVED', expectedRevisionNo: 2 });
    req.flush(
      { code: 'FORBIDDEN', message: 'x', details: { violations: [{ field: 'reviewer', reason: 'SELF_REVIEW' }] } },
      { status: 403, statusText: 'Forbidden' },
    );
    harness.detectChanges();
    expect(documento().querySelector('[data-testid="portal-review-error"]')?.textContent).toContain(
      'tiene que hacerlo otra persona',
    );
  });
});

describe('review.model: por qué no se registró la decisión', () => {
  const error = (status: number, details: object) =>
    new HttpErrorResponse({ status, error: { code: 'PRECONDITION_FAILED', message: 'x', details } });

  it('la aprobación sin evidencia recarga la ficha para que se vea el recuento real', () => {
    expect(reviewFailure(error(412, { reason: 'APPROVAL_NEEDS_EVIDENCE' }))).toEqual({
      message: 'No se aprueba una ficha sin al menos una evidencia enlazada.',
      reload: true,
    });
  });

  it('un conflicto de versión pide revisar la vigente', () => {
    expect(reviewFailure(new HttpErrorResponse({ status: 409, error: { code: 'CONCURRENCY_CONFLICT' } })).reload).toBe(true);
  });
});
