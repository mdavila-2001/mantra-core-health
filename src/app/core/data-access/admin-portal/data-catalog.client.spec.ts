import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { queryParams } from './admin-portal.wire';
import { DataCatalogClient } from './data-catalog.client';

describe('DataCatalogClient', () => {
  let client: DataCatalogClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(DataCatalogClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('una fecha null queda ausente, nunca como 1970', () => {
    let resultado: unknown;
    client.listObjects().subscribe((page) => (resultado = page.items[0]));
    http.expectOne((r) => r.url === '/admin/catalog/objects').flush({
      items: [
        {
          id: 'o1',
          schemaName: 's',
          objectName: 't',
          objectKind: 'TABLE',
          observationStatus: 'OBSERVED',
          columnCount: 1,
          statistics: { estimatedRows: null, totalBytes: null, isEstimate: true, observedAt: null },
          lastSeenAt: '2026-09-18T10:00:00.000Z',
          annotation: null,
        },
      ],
      nextCursor: null,
      limit: 50,
    });
    const item = resultado as { lastSeenAt: Date; statistics: Record<string, unknown> };
    expect(item.lastSeenAt).toBeInstanceOf(Date);
    expect('observedAt' in item.statistics).toBe(false);
  });

  it('solicitar escaneo envía la clave de idempotencia', () => {
    client.requestScan('scan-abc').subscribe();
    const req = http.expectOne('/admin/catalog/scans');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toBe('scan-abc');
    req.flush({ scanId: 'x', status: 'QUEUED', created: true });
  });

  it('los parámetros de consulta omiten las claves vacías', () => {
    expect(queryParams({ a: 'x', b: undefined, c: null, d: '', e: 0 })).toEqual({ a: 'x', e: '0' });
  });
});

describe('DataCatalogClient · deriva de permisos', () => {
  let client: DataCatalogClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(DataCatalogClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide la deriva y convierte la fecha de cálculo; las listas pasan tal cual', () => {
    let drift: unknown;
    client.permissionDrift().subscribe((d) => (drift = d));
    const req = http.expectOne('/admin/catalog/permission-drift');
    expect(req.request.method).toBe('GET');
    req.flush({
      generatedAt: '2026-10-24T12:00:00.000Z',
      routes: { total: 10, public: 1, withRoles: 7, withoutRoles: 2 },
      usedNotSeeded: [{ role: 'AUDITOR', routeCount: 2, inDatabase: null, sample: [] }],
      seededNotUsed: ['LEGACY'],
      routesWithoutRoles: [],
      routesWithoutRolesTruncated: false,
    });
    const view = drift as { generatedAt: Date; usedNotSeeded: { inDatabase: boolean | null }[] };
    expect(view.generatedAt).toBeInstanceOf(Date);
    expect(view.usedNotSeeded[0]!.inDatabase).toBeNull();
  });
});
