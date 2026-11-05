import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PrivacyRequestsClient, toPrivacyRequest } from './privacy-requests.client';
import { allowedTransitions, type PrivacyRequestsResult } from './privacy-requests.types';

const REQUEST = {
  id: 'd1',
  subjectUserId: 'u1',
  type: 'ACCESS',
  status: 'RECEIVED',
  jurisdiction: 'JURISDICTION_PE',
  requestedAt: '2026-10-01T10:00:00.000Z',
  completedAt: null,
  dueAt: '2026-10-31T10:00:00.000Z',
  overdue: false,
  hasResultFile: false,
  version: 1,
  createdAt: '2026-10-01T10:00:00.000Z',
  updatedAt: '2026-10-01T10:00:00.000Z',
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

  it('lista con GET /privacy/dsar, manda sólo los filtros con valor y convierte los ítems', () => {
    let page: PrivacyRequestsResult | undefined;
    client.list({ status: 'RECEIVED', type: undefined }).subscribe((p) => (page = p));
    const req = http.expectOne((r) => r.url.endsWith('/privacy/dsar'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('status')).toBe('RECEIVED');
    expect(req.request.params.has('type')).toBe(false);
    req.flush({
      items: [REQUEST],
      nextCursor: 'abc',
      limit: 25,
      order: 'requested_at desc, id desc',
      notMeasured: [{ field: 'slaPolicy', reason: 'plazo fijo' }],
    });
    expect(page?.nextCursor).toBe('abc');
    expect(page?.notMeasured[0]?.field).toBe('slaPolicy');
    expect(page?.items[0]?.requestedAt).toBeInstanceOf(Date);
    expect(page?.items[0]?.rowVersion).toBe(1);
    expect(page?.items[0]?.jurisdiction).toBe('PE');
  });

  it('el detalle usa GET /privacy/dsar/:id', () => {
    let got: { id: string } | undefined;
    client.get('d1').subscribe((r) => (got = r));
    const req = http.expectOne((r) => r.url.endsWith('/privacy/dsar/d1'));
    expect(req.request.method).toBe('GET');
    req.flush(REQUEST);
    expect(got?.id).toBe('d1');
  });

  it('la transición usa PATCH /privacy/dsar/:id y sólo manda el estado', () => {
    let done = false;
    client.transition('d1', 'IN_PROGRESS').subscribe(() => (done = true));
    const req = http.expectOne((r) => r.url.endsWith('/privacy/dsar/d1'));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ status: 'IN_PROGRESS' });
    req.flush({ id: 'd1', status: 'concepto' });
    expect(done).toBe(true);
  });
});

describe('toPrivacyRequest', () => {
  it('un código que la API no reconoce llega como null, no se adivina', () => {
    const r = toPrivacyRequest({ ...REQUEST, type: 'OTRO', status: 'RARO', jurisdiction: 'JURISDICTION_XX' });
    expect(r.type).toBeNull();
    expect(r.status).toBeNull();
    expect(r.jurisdiction).toBeNull();
    expect(r.allowedTransitions).toEqual([]);
  });

  it('sin jurisdicción declarada (null) queda null; con el prefijo del módulo también se reconoce', () => {
    expect(toPrivacyRequest({ ...REQUEST, jurisdiction: null }).jurisdiction).toBeNull();
    expect(toPrivacyRequest({ ...REQUEST, jurisdiction: 'AUDIT_JURISDICTION_EU' }).jurisdiction).toBe('EU');
  });

  it('completedAt null queda ausente (no el 1 de enero de 1970)', () => {
    expect('completedAt' in toPrivacyRequest(REQUEST)).toBe(false);
    expect(toPrivacyRequest({ ...REQUEST, completedAt: '2026-10-10T10:00:00.000Z' }).completedAt).toBeInstanceOf(Date);
  });
});

describe('allowedTransitions', () => {
  it('recibida admite los tres cambios; en curso, completar o rechazar', () => {
    expect(allowedTransitions('RECEIVED')).toEqual(['IN_PROGRESS', 'COMPLETED', 'REJECTED']);
    expect(allowedTransitions('IN_PROGRESS')).toEqual(['COMPLETED', 'REJECTED']);
  });

  it('un estado terminal o desconocido no admite ninguno', () => {
    expect(allowedTransitions('COMPLETED')).toEqual([]);
    expect(allowedTransitions('REJECTED')).toEqual([]);
    expect(allowedTransitions(null)).toEqual([]);
  });
});
