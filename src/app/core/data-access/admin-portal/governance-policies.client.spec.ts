import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { GovernancePoliciesClient } from './governance-policies.client';
import type { PolicyDetail, PolicyPage } from './governance-policies.types';

describe('GovernancePoliciesClient', () => {
  let http: HttpTestingController;
  let client: GovernancePoliciesClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(GovernancePoliciesClient);
  });

  afterEach(() => http.verify());

  it('lista políticas con sólo los filtros que tienen valor (la API rechaza las claves vacías)', () => {
    client.listPolicies({ type: 'WRITE', q: '', limit: 50 }).subscribe();
    const req = http.expectOne((r) => r.url === '/admin/governance/policies');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('type')).toBe('WRITE');
    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.has('cursor')).toBe(false);
    req.flush({ items: [], nextCursor: null, limit: 50, total: 0, byType: [] });
  });

  it('convierte updatedAt a Date y conserva null como ausencia, no como 1970', () => {
    let page: PolicyPage | undefined;
    client.listPolicies().subscribe((p) => (page = p));
    http
      .expectOne((r) => r.url === '/admin/governance/policies')
      .flush({
        items: [
          {
            id: 'a',
            type: 'WRITE',
            code: 'A',
            name: null,
            stateCode: null,
            stateLabel: null,
            attributes: {},
            updatedAt: '2026-10-01T10:00:00.000Z',
          },
          {
            id: 'b',
            type: 'RETENTION',
            code: 'B',
            name: null,
            stateCode: null,
            stateLabel: null,
            attributes: {},
            updatedAt: null,
          },
        ],
        nextCursor: 'c1',
        limit: 50,
        total: 2,
        byType: [{ type: 'WRITE', total: 1 }],
      });
    expect(page!.items[0]!.updatedAt).toEqual(new Date('2026-10-01T10:00:00.000Z'));
    expect('updatedAt' in page!.items[1]!).toBe(false);
    expect(page!.nextCursor).toBe('c1');
    expect(page!.byType).toEqual([{ type: 'WRITE', total: 1 }]);
  });

  it('pide el detalle por id escapado y convierte las fechas del historial', () => {
    let detail: PolicyDetail | undefined;
    client.getPolicy('a/b').subscribe((d) => (detail = d));
    http.expectOne('/admin/governance/policies/a%2Fb').flush({
      id: 'a/b',
      type: 'ANONYMIZATION',
      code: 'ANON',
      name: null,
      stateCode: null,
      stateLabel: null,
      attributes: { technique: 'Hash' },
      updatedAt: null,
      configuration: { salt: '[oculto]' },
      appliesTo: [{ kind: 'FIELD', total: 1, items: ['a.b.c'], truncated: false }],
      history: [
        {
          id: 'h',
          action: 'Alta',
          changedByUserId: 'u',
          reason: null,
          recordedAt: '2026-10-02T00:00:00.000Z',
        },
      ],
    });
    expect(detail!.history[0]!.recordedAt).toEqual(new Date('2026-10-02T00:00:00.000Z'));
    expect(detail!.configuration).toEqual({ salt: '[oculto]' });
    expect(detail!.appliesTo[0]!.items).toEqual(['a.b.c']);
    expect(detail!.attributes).toEqual({ technique: 'Hash' });
  });

  it('el inventario de campos manda los filtros y entrega el cuerpo tal cual', () => {
    let total = -1;
    client
      .listPiiFields({ sensitivity: 'PERSONAL', schema: 'iam', source: 'BOTH', q: 'doc' })
      .subscribe((p) => (total = p.total));
    const req = http.expectOne((r) => r.url === '/admin/governance/pii-fields');
    expect(req.request.params.get('sensitivity')).toBe('PERSONAL');
    expect(req.request.params.get('schema')).toBe('iam');
    expect(req.request.params.get('source')).toBe('BOTH');
    expect(req.request.params.get('q')).toBe('doc');
    req.flush({
      items: [],
      nextCursor: null,
      limit: 50,
      total: 0,
      summary: {
        fields: 0,
        tables: 0,
        approved: 0,
        withoutProtection: 0,
        bySensitivity: {},
        bySource: {},
      },
      sources: { catalogColumns: 0, registryFields: 0 },
    });
    expect(total).toBe(0);
  });
});
