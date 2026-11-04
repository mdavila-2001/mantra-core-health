import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { rejectionReason } from '../authz-admin/authz-admin.client';
import { AuthzModulesCatalogClient } from './authz-modules-catalog.client';
import type { ModulesCatalog } from './authz-modules-catalog.types';

const BODY = {
  generatedAt: '2026-10-31T10:00:00.000Z',
  canonicalActions: ['read'],
  notes: ['SIMULADO'],
  truncated: false,
  availableModules: ['billing'],
  summary: {
    modules: 1,
    permissions: 0,
    routes: 0,
    roleOnlyRoutes: 0,
    undeclaredAuthRoutes: 0,
    gaps: 0,
    modulesWithoutFinePermissions: 0,
  },
  roles: [],
  modules: [],
};

describe('AuthzModulesCatalogClient', () => {
  let client: AuthzModulesCatalogClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(AuthzModulesCatalogClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide GET /authz/catalog/modules y convierte la fecha de generación', () => {
    let result: ModulesCatalog | undefined;
    client.modules().subscribe((c) => (result = c));
    const req = http.expectOne('/authz/catalog/modules');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush(BODY);
    expect(result?.generatedAt).toBeInstanceOf(Date);
    expect(result?.generatedAt.toISOString()).toBe('2026-10-31T10:00:00.000Z');
  });

  it('manda el filtro de módulo y omite uno vacío', () => {
    client.modules({ module: 'pharma_lab' }).subscribe();
    const filtered = http.expectOne((r) => r.url === '/authz/catalog/modules');
    expect(filtered.request.params.get('module')).toBe('pharma_lab');
    filtered.flush(BODY);

    client.modules({ module: '' }).subscribe();
    const empty = http.expectOne((r) => r.url === '/authz/catalog/modules');
    expect(empty.request.params.has('module')).toBe(false);
    empty.flush(BODY);
  });

  it('un 403 llega como error con su estado (la pantalla lo traduce a «sin permiso»)', () => {
    let failure: unknown;
    client.modules().subscribe({ error: (e: unknown) => (failure = e) });
    http
      .expectOne('/authz/catalog/modules')
      .flush(
        { statusCode: 403, code: 'FORBIDDEN', message: 'x', reason: 'ROLE_INSUFFICIENT' },
        { status: 403, statusText: 'Forbidden' },
      );
    expect(failure).toBeInstanceOf(HttpErrorResponse);
    expect((failure as HttpErrorResponse).status).toBe(403);
    expect(rejectionReason(failure)).toBe('ROLE_INSUFFICIENT');
  });
});
