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
