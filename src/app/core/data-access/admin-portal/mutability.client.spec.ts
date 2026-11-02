import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { MutabilityClient } from './mutability.client';
import type { MutabilityDetail, MutabilityPage, MutabilitySummary } from './mutability.types';

describe('MutabilityClient', () => {
  let http: HttpTestingController;
  let client: MutabilityClient;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(MutabilityClient);
  });

  afterEach(() => http.verify());

  it('lista con los filtros y descarta los vacíos (la API rechaza claves no declaradas)', () => {
    client
      .list({
        writeMode: 'APPEND_ONLY',
        evidence: 'ENFORCED_DB',
        q: '',
        schema: undefined,
        limit: 50,
      })
      .subscribe();
    const req = http.expectOne((r) => r.url === '/admin/governance/mutability');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('writeMode')).toBe('APPEND_ONLY');
    expect(req.request.params.get('evidence')).toBe('ENFORCED_DB');
    expect(req.request.params.get('limit')).toBe('50');
    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.has('schema')).toBe(false);
    req.flush({ items: [], nextCursor: null, limit: 50, total: 0 } satisfies MutabilityPage);
  });

  it('sin consulta no manda ninguna clave', () => {
    client.list().subscribe();
    const req = http.expectOne((r) => r.url === '/admin/governance/mutability');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ items: [], nextCursor: null, limit: 50, total: 0 });
  });

  it('el resumen va a /summary', () => {
    let got: MutabilitySummary | undefined;
    client.summary().subscribe((s) => (got = s));
    const req = http.expectOne('/admin/governance/mutability/summary');
    req.flush({ totalTables: 3 } as MutabilitySummary);
    expect(got?.totalTables).toBe(3);
  });

  it('el detalle codifica schema y tabla en la ruta', () => {
    let got: MutabilityDetail | undefined;
    client.detail('audit', 'audit_log').subscribe((d) => (got = d));
    const req = http.expectOne('/admin/governance/mutability/audit/audit_log');
    req.flush({
      schema: 'audit',
      table: 'audit_log',
      evidence: [],
      findings: [],
    } as unknown as MutabilityDetail);
    expect(got?.table).toBe('audit_log');
    client.detail('a b', 'c/d').subscribe();
    http.expectOne('/admin/governance/mutability/a%20b/c%2Fd').flush({});
  });
});
