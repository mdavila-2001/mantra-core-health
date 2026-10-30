import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuditClient } from './audit.client';
import type { AuditLogEntry, AuditPage, DataAccessEntry } from './audit.types';

describe('AuditClient', () => {
  let client: AuditClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(AuditClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide la bitácora con los filtros dados y sin claves vacías', () => {
    client
      .log({ result: 'FAILURE', method: 'DELETE', action: '', userId: undefined, limit: 25, cursor: 'c1' })
      .subscribe();
    const req = http.expectOne((r) => r.url === '/audit/log');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('result')).toBe('FAILURE');
    expect(req.request.params.get('method')).toBe('DELETE');
    expect(req.request.params.get('limit')).toBe('25');
    expect(req.request.params.get('cursor')).toBe('c1');
    expect(req.request.params.has('action')).toBe(false);
    expect(req.request.params.has('userId')).toBe(false);
    req.flush({ items: [], nextCursor: null, limit: 25 });
  });

  it('convierte la fecha del sello y deja el riesgo tal como lo deriva la API', () => {
    let page: AuditPage<AuditLogEntry> | undefined;
    client.log().subscribe((p) => (page = p));
    http.expectOne('/audit/log').flush({
      items: [
        {
          id: 'a1',
          userId: 'u1',
          tenantId: null,
          action: 'ROLE_ASSIGNED',
          entity: 'user_role_assignment',
          entityId: null,
          result: 'SUCCESS',
          ip: null,
          method: 'POST',
          route: '/authz/users/:userId/role-assignments',
          healthRisk: 'CRITICAL',
          recordedAt: '2026-10-24T20:01:00.992000Z',
        },
      ],
      nextCursor: 'next',
      limit: 50,
    });
    expect(page!.items[0]!.recordedAt).toBeInstanceOf(Date);
    expect(page!.items[0]!.recordedAt.toISOString()).toBe('2026-10-24T20:01:00.992Z');
    expect(page!.items[0]!.healthRisk).toBe('CRITICAL');
    expect(page!.nextCursor).toBe('next');
  });

  it('lee los accesos a datos sensibles con sus propios filtros', () => {
    let page: AuditPage<DataAccessEntry> | undefined;
    client.dataAccess({ operation: 'EXPORT', resourceType: 'PATIENT_CHART' }).subscribe((p) => (page = p));
    const req = http.expectOne((r) => r.url === '/audit/data-access');
    expect(req.request.params.get('operation')).toBe('EXPORT');
    expect(req.request.params.get('resourceType')).toBe('PATIENT_CHART');
    req.flush({
      items: [
        {
          id: 'd1',
          userId: 'u1',
          tenantId: null,
          patientProfileId: 'p1',
          operation: 'EXPORT',
          resourceType: 'PATIENT_CHART',
          resourceId: null,
          purpose: 'SECURITY_OVERSIGHT',
          healthRisk: 'CRITICAL',
          recordedAt: '2026-10-20T10:00:00.000Z',
        },
      ],
      nextCursor: null,
      limit: 50,
    });
    expect(page!.items[0]!.recordedAt).toBeInstanceOf(Date);
    expect(page!.items[0]!.operation).toBe('EXPORT');
  });
});
