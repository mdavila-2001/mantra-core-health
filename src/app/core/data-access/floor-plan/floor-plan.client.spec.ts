import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { API_BASE_URL } from '../api';
import { readPlanFailure } from './floor-plan.failure';
import { FloorPlanClient } from './floor-plan.client';

describe('FloorPlanClient (CONTRATO-PLANO §3)', () => {
  let client: FloorPlanClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: '' }],
    });
    client = TestBed.inject(FloorPlanClient);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('lista los lienzos de una sede', () => {
    client.listPlans('site-1').subscribe();
    http.expectOne('/sites/site-1/floor-plans').flush([]);
  });

  it('pide el layout con ventana, detalle, foco y paginación en la query', () => {
    client.getLayout('p1', { bbox: [0, 0, 10, 10], detail: 'lite', limit: 500, cursor: '500', focusSpaceId: 's1', unitMode: 'flag' }).subscribe();
    const req = http.expectOne((r) => r.url === '/floor-plans/p1/layout');
    expect(req.request.params.get('bbox')).toBe('0,0,10,10');
    expect(req.request.params.get('detail')).toBe('lite');
    expect(req.request.params.get('include')).toBe('spaces,elements');
    expect(req.request.params.get('limit')).toBe('500');
    expect(req.request.params.get('cursor')).toBe('500');
    expect(req.request.params.get('focusSpaceId')).toBe('s1');
    expect(req.request.params.get('unitMode')).toBe('flag');
    req.flush({});
  });

  it('guarda con PATCH, If-Match = layoutVersion y dryRun cuando se pide', () => {
    client.patchLayout('p1', { remove: { spaceIds: ['a'] } }, 7, true).subscribe();
    const req = http.expectOne((r) => r.url === '/floor-plans/p1/layout');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.headers.get('If-Match')).toBe('7');
    expect(req.request.params.get('dryRun')).toBe('true');
    req.flush({});
  });

  it('el estado, la tarjeta del paciente y la localización usan las rutas del contrato', () => {
    client.getState('p1', { unitId: 'u1' }).subscribe();
    expect(http.expectOne((r) => r.url === '/floor-plans/p1/state').request.params.get('unitId')).toBe('u1');
    client.getPlanCard('s 1').subscribe();
    http.expectOne('/care-spaces/s%201/plan-card').flush({});
    client.getPlanLocation('s1').subscribe();
    http.expectOne('/care-spaces/s1/plan-location').flush({});
  });

  it('busca y enfoca por sede', () => {
    client.search('site-1', 'quirófano', 5).subscribe();
    const search = http.expectOne((r) => r.url === '/sites/site-1/plan-search');
    expect(search.request.params.get('q')).toBe('quirófano');
    expect(search.request.params.get('limit')).toBe('5');
    search.flush([]);
    client.getFocus('site-1', { unitId: 'u1' }).subscribe();
    expect(http.expectOne((r) => r.url === '/sites/site-1/plan-focus').request.params.get('unitId')).toBe('u1');
  });
});

describe('readPlanFailure', () => {
  it('lee reason, requestId y los errores por elemento de un 422', () => {
    const failure = readPlanFailure(
      new HttpErrorResponse({
        status: 422,
        error: { reason: 'PLAN_LAYOUT_INVALID', requestId: 'abc123', message: 'x', errors: [{ kind: 'SPACE', id: 's1', code: 'PLAN_SIBLING_OVERLAP', message: 'm' }, { nope: 1 }] },
      }),
    );
    expect(failure).toMatchObject({ status: 422, reason: 'PLAN_LAYOUT_INVALID', requestId: 'abc123' });
    expect(failure.errors).toHaveLength(1);
  });

  it('lee la versión vigente de un 412 y los roles requeridos de un 403', () => {
    expect(readPlanFailure(new HttpErrorResponse({ status: 412, error: { reason: 'PLAN_VERSION_MISMATCH', currentVersion: 9 } })).currentVersion).toBe(9);
    expect(readPlanFailure(new HttpErrorResponse({ status: 403, error: { reason: 'INFRA_ACTION_NOT_ALLOWED', details: { requiredRoles: ['SA', 'AO'] } } })).requiredRoles).toEqual(['SA', 'AO']);
  });

  it('un cuerpo que no es JSON (un proxy) no inventa una razón', () => {
    const failure = readPlanFailure(new HttpErrorResponse({ status: 502, error: '<html>' }));
    expect(failure.reason).toBeNull();
    expect(failure.requestId).toBeNull();
  });

  it('lo que no es un HttpErrorResponse da status -1', () => {
    expect(readPlanFailure(new Error('x')).status).toBe(-1);
  });
});
