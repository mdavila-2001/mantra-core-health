import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PrivacyRequestsClient } from './privacy-requests.client';

const REQUEST = {
  id: 'd1',
  subjectUserId: 'u1',
  type: 'ACCESS',
  status: 'RECEIVED',
  jurisdiction: null,
  requestedAt: '2026-10-01T10:00:00.000Z',
  completedAt: null,
  resultFileId: null,
  updatedAt: '2026-10-01T10:00:00.000Z',
  rowVersion: 1,
  allowedTransitions: ['IN_PROGRESS', 'COMPLETED', 'REJECTED'],
};

describe('PrivacyRequestsClient', () => {
  let client: PrivacyRequestsClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(PrivacyRequestsClient);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lista con los filtros y conserva el conteo por estado que manda la API', () => {
    let page: { statusCounts: { RECEIVED: number }; items: readonly { requestedAt: Date }[] } | undefined;
    client.list({ status: 'RECEIVED', type: undefined }).subscribe((p) => (page = p));
    const req = http.expectOne((r) => r.url.endsWith('/admin/governance/privacy-requests'));
    expect(req.request.params.get('status')).toBe('RECEIVED');
    expect(req.request.params.has('type')).toBe(false);
    req.flush({
      items: [REQUEST],
      nextCursor: null,
      limit: 25,
      total: 1,
      statusCounts: { RECEIVED: 1, IN_PROGRESS: 0, COMPLETED: 0, REJECTED: 0, other: 0 },
    });
    expect(page?.statusCounts.RECEIVED).toBe(1);
    expect(page?.items[0]?.requestedAt).toBeInstanceOf(Date);
  });

  it('la transición usa la ruta que escribe (PATCH /privacy/dsar/:id) y sólo manda el estado', () => {
    let done = false;
    client.transition('d1', 'IN_PROGRESS').subscribe(() => (done = true));
    const req = http.expectOne((r) => r.url.endsWith('/privacy/dsar/d1'));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'IN_PROGRESS' });
    req.flush({ id: 'd1', status: 'concepto' });
    expect(done).toBe(true);
  });
});
