import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PriorAuthorizationClient } from './prior-authorization.client';
import type {
  PriorAuthorizationDetail,
  PriorAuthorizationSummary,
} from './prior-authorization.types';

const RESUMEN = {
  id: 'pa-1',
  origin: 'PHARMACY',
  status: 'SUBMITTED',
  decision: null,
  patient: { id: 'p-1', displayName: 'Ana', patientCode: 'P-1', memberIdentifier: 'M-1' },
  planName: 'Plan Oro',
  currencyCode: 'BOB',
  itemCount: 2,
  totalRequestedAmount: '100.00',
  submittedAt: '2026-09-20T10:00:00.000Z',
};

describe('PriorAuthorizationClient', () => {
  let client: PriorAuthorizationClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(PriorAuthorizationClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listInbox pega en la bandeja con el filtro y convierte el envío a Date', () => {
    let filas: readonly PriorAuthorizationSummary[] = [];
    client.listInbox('PENDING').subscribe((items) => (filas = items));

    const req = http.expectOne((r) => r.url === '/prior-authorization-requests/inbox');
    expect(req.request.params.get('status')).toBe('PENDING');
    req.flush({ items: [RESUMEN] });

    expect(filas[0]?.submittedAt).toEqual(new Date('2026-09-20T10:00:00.000Z'));
    expect(filas[0]?.totalRequestedAmount).toBe('100.00');
  });

  it('listInbox sin filtro no manda status', () => {
    client.listInbox().subscribe();
    const req = http.expectOne((r) => r.url === '/prior-authorization-requests/inbox');
    expect(req.request.params.has('status')).toBe(false);
    req.flush({ items: [] });
  });

  it('get convierte las fechas de la solicitud y de cada decisión', () => {
    let detalle: PriorAuthorizationDetail | undefined;
    client.get('pa-1').subscribe((d) => (detalle = d));

    http.expectOne('/prior-authorization-requests/pa-1').flush({
      ...RESUMEN,
      status: 'DETERMINED',
      decision: 'PARTIAL',
      decidedAt: '2026-09-21T10:00:00.000Z',
      items: [
        {
          id: 'i-1',
          sequence: 1,
          description: 'Amoxil 500 mg',
          requestedQuantity: '2',
          requestedAmount: '100.00',
          decision: {
            decision: 'DENIED',
            approvedQuantity: null,
            approvedAmount: null,
            policyClauseReference: 'Cláusula 12.3',
            denialRationale: null,
            decidedAt: '2026-09-21T10:00:00.000Z',
          },
        },
      ],
    });

    expect(detalle?.decidedAt).toEqual(new Date('2026-09-21T10:00:00.000Z'));
    expect(detalle?.items[0]?.decision?.decidedAt).toEqual(
      new Date('2026-09-21T10:00:00.000Z'),
    );
    expect(detalle?.items[0]?.decision?.policyClauseReference).toBe('Cláusula 12.3');
  });

  it('decide manda la decisión por ítem, con la cláusula en lo no aprobado', () => {
    client
      .decide('pa-1', [
        { priorAuthorizationItemId: 'i-1', decision: 'APPROVED' },
        {
          priorAuthorizationItemId: 'i-2',
          decision: 'DENIED',
          policyClauseReference: 'Cláusula 12.3',
        },
      ])
      .subscribe();

    const req = http.expectOne('/prior-authorization-requests/pa-1/determinations');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      items: [
        { priorAuthorizationItemId: 'i-1', decision: 'APPROVED' },
        {
          priorAuthorizationItemId: 'i-2',
          decision: 'DENIED',
          policyClauseReference: 'Cláusula 12.3',
        },
      ],
    });
    req.flush({ id: 'det-1' });
  });
});
