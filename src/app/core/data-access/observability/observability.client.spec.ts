import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ObservabilityClient } from './observability.client';
import type { ErrorGroup, ObsSummary } from './observability.types';

describe('ObservabilityClient', () => {
  let client: ObservabilityClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(ObservabilityClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide el resumen con la ventana y la zona, sin claves vacías (la API rechaza lo que no conoce)', () => {
    let recibido: ObsSummary | undefined;
    client.summary({ from: '2026-10-31T04:00:00.000Z', tz: 'America/La_Paz', interval: undefined, to: '' }).subscribe((r) => (recibido = r));
    const req = http.expectOne((r) => r.url.endsWith('/admin/observability/summary'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().sort()).toEqual(['from', 'tz']);
    expect(req.request.params.get('tz')).toBe('America/La_Paz');
    expect(req.request.headers.has('X-Tenant-Id')).toBe(false);
    const cuerpo = { kpis: { requests: { value: null, reason: 'NO_INSTANCE_REPORTED_IN_WINDOW' } } } as unknown as ObsSummary;
    req.flush(cuerpo);
    // null no es cero: el cliente no toca el cuerpo.
    expect(recibido?.kpis.requests).toEqual({ value: null, reason: 'NO_INSTANCE_REPORTED_IN_WINDOW' });
  });

  it('serie: envía métrica y agrupación', () => {
    client.timeseries({ metric: 'requests', groupBy: 'status_class', interval: 'hour' }).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/admin/observability/timeseries'));
    expect(req.request.params.get('metric')).toBe('requests');
    expect(req.request.params.get('groupBy')).toBe('status_class');
    req.flush({ series: [] });
  });

  it('endpoints y grupos de errores: orden, filtros, cursor y límite', () => {
    client.endpoints({ sort: 'p99', module: 'iam', limit: 20, cursor: 'abc' }).subscribe();
    const e = http.expectOne((r) => r.url.endsWith('/admin/observability/endpoints'));
    expect(e.request.params.get('sort')).toBe('p99');
    expect(e.request.params.get('limit')).toBe('20');
    expect(e.request.params.get('cursor')).toBe('abc');
    e.flush({ items: [] });

    client.errorGroups({ state: 'NEW', source: 'api', code: 'INTERNAL' }).subscribe();
    const g = http.expectOne((r) => r.url.endsWith('/admin/observability/errors/groups'));
    expect(g.request.params.get('state')).toBe('NEW');
    g.flush({ items: [] });
  });

  it('cambiar el estado manda el motivo y la versión leída, por PATCH', () => {
    let grupo: ErrorGroup | undefined;
    client.changeErrorGroupState('11111111-1111-4111-8111-111111111111', { state: 'RESOLVED', note: 'Corregido en v4.2', expectedVersion: 3 }).subscribe((g) => (grupo = g));
    const req = http.expectOne((r) => r.url.endsWith('/admin/observability/errors/groups/11111111-1111-4111-8111-111111111111'));
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ state: 'RESOLVED', note: 'Corregido en v4.2', expectedVersion: 3 });
    req.flush({ id: 'x', state: 'RESOLVED', rowVersion: 4 });
    expect(grupo?.rowVersion).toBe(4);
  });

  it('un 409 por versión vieja llega al llamador tal cual para que diga «recargue»', () => {
    let error: unknown;
    client.changeErrorGroupState('g', { state: 'SEEN', expectedVersion: 1 }).subscribe({ error: (e: unknown) => (error = e) });
    http.expectOne((r) => r.url.endsWith('/errors/groups/g')).flush({ code: 'CONCURRENCY_CONFLICT' }, { status: 409, statusText: 'Conflict' });
    expect((error as HttpErrorResponse).status).toBe(409);
  });

  it('el requestId viaja codificado en la ruta (nunca como parte de otra ruta)', () => {
    client.request('a/b?c').subscribe();
    const req = http.expectOne((r) => r.url.includes('/admin/observability/requests/'));
    expect(req.request.url).toContain('/requests/a%2Fb%3Fc');
    req.flush({ found: false });
  });

  it('SQL: lista por coste y detalle por huella', () => {
    client.sqlStatements({ sort: 'total_ms' }).subscribe();
    http.expectOne((r) => r.url.endsWith('/admin/observability/sql/statements')).flush({ items: [] });
    client.sqlStatement('abcdef012345').subscribe();
    http.expectOne((r) => r.url.endsWith('/admin/observability/sql/statements/abcdef012345')).flush({});
    client.sqlSlow({ limit: 10 }).subscribe();
    http.expectOne((r) => r.url.endsWith('/admin/observability/sql/slow')).flush({ items: [] });
  });

  it('un 403 (rol sin lectura) se propaga: la pantalla lo muestra como «sin permiso», no como vacío', () => {
    let status = 0;
    client.coverage({}).subscribe({ error: (e: HttpErrorResponse) => (status = e.status) });
    http.expectOne((r) => r.url.endsWith('/admin/observability/coverage')).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(status).toBe(403);
  });
});
