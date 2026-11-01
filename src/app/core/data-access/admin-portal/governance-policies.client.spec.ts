import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { GovernancePoliciesClient } from './governance-policies.client';
import type {
  ChangeLogPage,
  PiiColumnsPage,
  PolicyDetail,
  PolicyPage,
} from './governance-policies.types';

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
    client
      .listPolicies({ type: 'WRITE', q: '', limit: 50, sort: 'updatedAt', order: 'desc' })
      .subscribe();
    const req = http.expectOne((r) => r.url === '/admin/governance/policies');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('type')).toBe('WRITE');
    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.params.get('sort')).toBe('updatedAt');
    expect(req.request.params.get('order')).toBe('desc');
    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.has('cursor')).toBe(false);
    req.flush({ items: [], nextCursor: null, limit: 50, sort: 'updatedAt', order: 'desc' });
  });

  it('convierte updatedAt a Date y conserva null como ausencia, no como 1970', () => {
    let page: PolicyPage | undefined;
    client.listPolicies().subscribe((p) => (page = p));
    http
      .expectOne((r) => r.url === '/admin/governance/policies')
      .flush({
        items: [
          {
            policyType: 'WRITE',
            id: 'a',
            code: 'A',
            name: null,
            state: 'ACTIVE',
            version: 3,
            updatedAt: '2026-10-01T10:00:00.000Z',
          },
          {
            policyType: 'RETENTION',
            id: 'b',
            code: 'B',
            name: null,
            state: null,
            version: 1,
            updatedAt: null,
          },
        ],
        nextCursor: 'c1',
        limit: 50,
        sort: 'code',
        order: 'asc',
      });
    expect(page!.items[0]!.updatedAt).toEqual(new Date('2026-10-01T10:00:00.000Z'));
    expect('updatedAt' in page!.items[1]!).toBe(false);
    expect(page!.items[0]!.version).toBe(3);
    expect(page!.nextCursor).toBe('c1');
  });

  it('pide el detalle por tipo e id escapados y convierte las fechas', () => {
    let detail: PolicyDetail | undefined;
    client.getPolicy('ANONYMIZATION', 'a/b').subscribe((d) => (detail = d));
    http.expectOne('/admin/governance/policies/ANONYMIZATION/a%2Fb').flush({
      policyType: 'ANONYMIZATION',
      id: 'a/b',
      code: 'ANON',
      name: null,
      state: null,
      version: 2,
      createdAt: '2026-09-01T00:00:00.000Z',
      updatedAt: null,
      createdByUserId: 'u1',
      updatedByUserId: null,
      settings: { technique: 'HASH', parameterKeys: ['salt'] },
      appliedTo: {
        total: 1,
        items: [{ schemaName: 'a', tableName: 'b', columnName: 'c' }],
        truncated: false,
      },
    });
    expect(detail!.createdAt).toEqual(new Date('2026-09-01T00:00:00.000Z'));
    expect('updatedAt' in detail!).toBe(false);
    expect(detail!.settings).toEqual({ technique: 'HASH', parameterKeys: ['salt'] });
    expect(detail!.appliedTo.items[0]!.columnName).toBe('c');
  });

  it('la bitácora manda los filtros y convierte recordedAt a Date', () => {
    let page: ChangeLogPage | undefined;
    client
      .listChangeLog({ targetId: 'p1', from: '2026-01-01T00:00:00.000Z', limit: 20 })
      .subscribe((p) => (page = p));
    const req = http.expectOne((r) => r.url === '/admin/governance/change-log');
    expect(req.request.params.get('targetId')).toBe('p1');
    expect(req.request.params.get('from')).toBe('2026-01-01T00:00:00.000Z');
    expect(req.request.params.get('limit')).toBe('20');
    req.flush({
      items: [
        {
          id: 'h',
          targetType: 'write_policies',
          targetId: 'p1',
          action: 'CREATED',
          changedByUserId: 'u',
          reason: null,
          recordedAt: '2026-10-02T00:00:00.000Z',
        },
      ],
      nextCursor: null,
      limit: 20,
      order: 'recorded_at desc, id desc',
    });
    expect(page!.items[0]!.recordedAt).toEqual(new Date('2026-10-02T00:00:00.000Z'));
    expect(page!.items[0]!.reason).toBeNull();
  });

  it('las columnas personales salen del catálogo de datos, con los filtros que tienen valor', () => {
    let page: PiiColumnsPage | undefined;
    client
      .listPiiColumns({
        minSensitivity: 'PHI_IDENTIFIER',
        schema: 'iam',
        q: '',
        sort: 'sensitivity',
      })
      .subscribe((p) => (page = p));
    const req = http.expectOne((r) => r.url === '/admin/catalog/pii/columns');
    expect(req.request.params.get('minSensitivity')).toBe('PHI_IDENTIFIER');
    expect(req.request.params.get('schema')).toBe('iam');
    expect(req.request.params.get('sort')).toBe('sensitivity');
    expect(req.request.params.has('q')).toBe(false);
    req.flush({ items: [], nextCursor: null, limit: 50, sort: 'sensitivity' });
    expect(page!.sort).toBe('sensitivity');
  });

  it('el resumen y la conciliación entregan el cuerpo tal cual', () => {
    let personal = -1;
    client.piiSummary().subscribe((s) => (personal = s.personalColumns));
    http.expectOne('/admin/catalog/pii/summary').flush({
      source: 'catalog_annotations',
      observedColumns: 10,
      classifiedColumns: 4,
      personalColumns: 3,
      objectsWithPersonalColumns: 2,
      bySensitivity: [],
      declaredRegistry: { entities: 0, entitiesPersonal: 0, fields: 0, fieldsPersonal: 0 },
      notMeasured: [],
    });
    expect(personal).toBe(3);

    let total = -1;
    client
      .piiReconciliation({ kind: 'MISSING_IN_REGISTRY', schema: 'iam' })
      .subscribe((p) => (total = p.summary.total));
    const req = http.expectOne((r) => r.url === '/admin/catalog/pii/reconciliation');
    expect(req.request.params.get('kind')).toBe('MISSING_IN_REGISTRY');
    expect(req.request.params.get('schema')).toBe('iam');
    req.flush({
      summary: {
        approvedPersonalColumns: 3,
        declaredFields: 0,
        registryEmpty: true,
        byKind: { MISSING_IN_REGISTRY: 3, REGISTRY_DISAGREES: 0, ORPHAN_IN_REGISTRY: 0 },
        total: 3,
      },
      items: [],
      nextCursor: null,
      limit: 50,
      order: 'schema_name, object_name, column_name, kind',
      notMeasured: [],
    });
    expect(total).toBe(3);
  });
});
