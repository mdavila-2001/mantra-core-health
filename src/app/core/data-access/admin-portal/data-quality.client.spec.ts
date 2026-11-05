import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DataQualityClient } from './data-quality.client';

const ISSUE = {
  id: 'i1',
  ruleId: 'r1',
  ruleCode: 'PAT-001',
  ruleName: 'Documento sin dígito verificador',
  severity: 'ERROR',
  status: 'OPEN',
  fieldPath: 'identifier[0].value',
  resourceId: null,
  assignedUserId: null,
  tenantId: 't1',
  runId: 'run1',
  createdAt: '2026-10-30T10:00:00.000Z',
  resolvedAt: null,
  resolutionText: null,
};

describe('DataQualityClient', () => {
  let client: DataQualityClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(DataQualityClient);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lista incidencias sin mandar filtros vacíos y convierte las fechas', () => {
    let page: Awaited<ReturnType<() => unknown>> | undefined;
    client.listIssues({ status: 'OPEN', q: '', cursor: undefined }).subscribe((p) => (page = p));
    const req = http.expectOne((r) => r.url.endsWith('/admin/governance/data-quality/issues'));
    expect(req.request.params.get('status')).toBe('OPEN');
    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.has('cursor')).toBe(false);
    req.flush({ items: [ISSUE], nextCursor: null, limit: 25, total: 1 });
    const first = (page as { items: { createdAt: Date; resolvedAt?: Date }[] }).items[0]!;
    expect(first.createdAt).toBeInstanceOf(Date);
    // «sin fecha» es una clave ausente, no el 1 de enero de 1970
    expect('resolvedAt' in first).toBe(false);
  });

  it('resolver manda la acción y el motivo, y entrega si ya estaba aplicada', () => {
    let result: { alreadyApplied: boolean; issue: { status: string | null } } | undefined;
    client
      .resolveIssue('i1', { action: 'RESOLVE', note: 'Corregido en origen' })
      .subscribe((r) => (result = r));
    const req = http.expectOne((r) => r.url.endsWith('/issues/i1/resolution'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ action: 'RESOLVE', note: 'Corregido en origen' });
    req.flush({ issue: { ...ISSUE, status: 'RESOLVED', resolvedAt: '2026-10-31T09:00:00.000Z' }, alreadyApplied: true });
    expect(result?.alreadyApplied).toBe(true);
    expect(result?.issue.status).toBe('RESOLVED');
  });

  it('el detalle de una regla convierte también las fechas de sus corridas', () => {
    let detail: { recentRuns: readonly { startedAt: Date; completedAt?: Date }[] } | undefined;
    client.getRule('r 1').subscribe((d) => (detail = d));
    const req = http.expectOne((r) => r.url.endsWith('/rules/r%201'));
    req.flush({
      id: 'r 1',
      ruleCode: 'PAT-001',
      name: 'x',
      severity: null,
      state: { code: null, display: null },
      dimension: { code: null, display: null },
      ruleSet: { id: 's', code: 'S', name: 'Set', version: '1' },
      openIssues: 0,
      totalIssues: 0,
      updatedAt: '2026-10-30T10:00:00.000Z',
      ruleExpression: '$.a exists',
      expressionLanguage: null,
      remediationGuidance: null,
      issuesByStatus: { OPEN: 0, RESOLVED: 0, DISMISSED: 0, other: 0 },
      recentRuns: [
        {
          id: 'run1',
          startedAt: '2026-10-30T09:00:00.000Z',
          completedAt: null,
          result: { code: 'QUAL_PASS', display: 'Quality run passed' },
          recordsEvaluated: null,
          issuesDetected: 0,
        },
      ],
    });
    expect(detail?.recentRuns[0]?.startedAt).toBeInstanceOf(Date);
    expect(detail?.recentRuns[0]?.completedAt).toBeUndefined();
  });
});
