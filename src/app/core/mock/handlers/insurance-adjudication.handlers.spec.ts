import { HttpHeaders } from '@angular/common/http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario } from '../mock-session';

interface ClaimDetail {
  readonly header: { readonly id: string; readonly status: { readonly code: string }; readonly approvedTotal: { readonly amount: string } | null };
  readonly lines: readonly { readonly id: string; readonly billedAmount: { readonly amount: string }; readonly approvedAmount: { readonly amount: string } | null; readonly patientResponsibilityAmount: { readonly amount: string } | null; readonly policyClauseReference: string | null }[];
  readonly adjudication: { readonly dispositionText: string } | null;
  readonly settlement: { readonly availability: string; readonly totalPatientAmount: string | null; readonly totalDeniedAmount: string | null; readonly exclusions: readonly { readonly policyClauseReference: string }[] };
  readonly eob: { readonly id: string } | null;
}

describe('dictamen y EOB del simulador de seguros', () => {
  let router: MockRouter;
  let previousClaims: string | null;
  const insurer = buscarUsuario('aseguradora')!;

  beforeAll(async () => {
    previousClaims = sessionStorage.getItem('mock.insurance.solicitudes');
    sessionStorage.removeItem('mock.insurance.solicitudes');
    vi.resetModules();
    router = new MockRouter();
    const { registrarSeguros } = await import('./insurance.handlers');
    registrarSeguros(router);
  });

  afterAll(() => {
    if (previousClaims === null) sessionStorage.removeItem('mock.insurance.solicitudes');
    else sessionStorage.setItem('mock.insurance.solicitudes', previousClaims);
    vi.resetModules();
  });

  function call<T>(method: MockMethod, path: string, body: unknown = null): { status: number; body: T } {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const response = match.handler({ method, path, params: match.params, query: new URLSearchParams(), body, headers: new HttpHeaders(), user: insurer });
    if (response !== null && typeof response === 'object' && 'status' in response && 'body' in response) {
      return response as MockReply as { status: number; body: T };
    }
    return { status: 200, body: response as T };
  }

  function createClaim(amounts: readonly string[]): ClaimDetail {
    const created = call<{ id: string }>('POST', '/insurance-claims', {
      lines: amounts.map((billedAmount, index) => ({ service: `Servicio ${index + 1}`, billedAmount })),
    });
    expect(created.status).toBe(201);
    return call<ClaimDetail>('GET', `/insurance-claims/${created.body.id}`).body;
  }

  it('aprueba todas las líneas y publica la EOB en una operación separada', () => {
    const claim = createClaim(['100.00', '50.00']);
    const path = `/insurance-claims/${claim.header.id}`;
    expect(call('POST', `${path}/eob`, {}).status).toBe(422);

    const adjudicated = call<{ id: string }>('POST', `${path}/adjudications`, {
      outcome: 'APPROVED',
      dispositionText: 'Cobertura completa según póliza.',
      totalApprovedAmount: '150.00',
      totalPatientAmount: '0.00',
      totalDeniedAmount: '0.00',
      lineAdjudications: claim.lines.map((line) => ({ insuranceClaimLineId: line.id, decision: 'APPROVED', approvedAmount: line.billedAmount.amount, patientAmount: '0.00', deniedAmount: '0.00' })),
    });
    expect(adjudicated.status).toBe(201);
    const beforePublication = call<ClaimDetail>('GET', path).body;
    expect(beforePublication.header.status.code).toBe('APPROVED');
    expect(beforePublication.header.approvedTotal?.amount).toBe('150.00');
    expect(beforePublication.adjudication?.dispositionText).toBe('Cobertura completa según póliza.');
    expect(beforePublication.eob).toBeNull();
    expect(beforePublication.settlement.availability).toBe('PENDING_PUBLICATION');

    const published = call<{ id: string }>('POST', `${path}/eob`, {});
    expect(published.status).toBe(201);
    const settled = call<ClaimDetail>('GET', path).body;
    expect(settled.eob?.id).toBe(published.body.id);
    expect(settled.settlement.availability).toBe('AVAILABLE');
    expect(settled.settlement.totalPatientAmount).toBe('0.00');
    expect(call('POST', `${path}/eob`, {}).status).toBe(409);
  });

  it('un rechazo conserva la cláusula y no carga al paciente el importe denegado', () => {
    const claim = createClaim(['80.00']);
    const path = `/insurance-claims/${claim.header.id}`;
    expect(call('POST', `${path}/adjudications`, {
      outcome: 'DENIED',
      totalApprovedAmount: '0.00',
      totalPatientAmount: '0.00',
      totalDeniedAmount: '80.00',
      lineAdjudications: [{ insuranceClaimLineId: claim.lines[0]!.id, decision: 'DENIED', approvedAmount: '0.00', patientAmount: '0.00', deniedAmount: '80.00', policyClauseReference: 'Cláusula 4.1', denialRationale: 'Prestación excluida' }],
    }).status).toBe(201);
    expect(call('POST', `${path}/eob`, {}).status).toBe(201);
    const detail = call<ClaimDetail>('GET', path).body;
    expect(detail.header.status.code).toBe('REJECTED');
    expect(detail.lines[0]?.patientResponsibilityAmount?.amount).toBe('0.00');
    expect(detail.lines[0]?.policyClauseReference).toBe('Cláusula 4.1');
    expect(detail.settlement.totalDeniedAmount).toBe('80.00');
    expect(detail.settlement.exclusions[0]?.policyClauseReference).toBe('Cláusula 4.1');
  });

  it('rechaza identificadores e importes inválidos sin cambiar la solicitud', () => {
    const claim = createClaim(['40.00']);
    const path = `/insurance-claims/${claim.header.id}`;
    expect(call('POST', '/insurance-claims/no-existe/adjudications', {}).status).toBe(404);
    expect(call('POST', `${path}/adjudications`, {
      outcome: 'APPROVED',
      lineAdjudications: [{ insuranceClaimLineId: claim.lines[0]!.id, decision: 'APPROVED', approvedAmount: '41.00', patientAmount: '0.00', deniedAmount: '0.00' }],
    }).status).toBe(400);
    expect(call('POST', `${path}/adjudications`, {
      outcome: 'APPROVED',
      lineAdjudications: [{ insuranceClaimLineId: 'línea-ajena', decision: 'APPROVED', approvedAmount: '40.00', patientAmount: '0.00', deniedAmount: '0.00' }],
    }).status).toBe(400);
    const unchanged = call<ClaimDetail>('GET', path).body;
    expect(unchanged.header.status.code).toBe('SUBMITTED');
    expect(unchanged.header.approvedTotal).toBeNull();
    expect(unchanged.lines[0]?.approvedAmount).toBeNull();
  });
});
