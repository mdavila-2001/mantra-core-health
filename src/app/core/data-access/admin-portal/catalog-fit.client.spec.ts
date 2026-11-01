import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CatalogFitClient } from './catalog-fit.client';
import type { CatalogFit, FitRunAccepted } from './catalog-fit.types';

const SIN_RESULTADO: CatalogFit = {
  modelVersion: 'catalog-fit/v1',
  state: 'SIN_RESULTADO',
  noResultReason: 'NUNCA_EJECUTADA',
  ageSeconds: null,
  running: null,
  lastRun: null,
  lastFailure: null,
  report: null,
  history: [],
  retention: {
    kind: 'MEMORIA_DEL_PROCESO',
    ttlSeconds: 86_400,
    historySize: 48,
    tickIntervalSeconds: 300,
    staleAfterSeconds: 900,
    note: 'Los resultados viven en la memoria de este proceso.',
  },
};

const ACEPTADA: FitRunAccepted = {
  runId: '11111111-1111-4111-8111-111111111111',
  status: 'EN_CURSO',
  created: true,
  acceptedAt: '2026-10-31T12:00:00.000Z',
  statusUrl: '/admin/catalog/fit',
};

describe('CatalogFitClient', () => {
  let client: CatalogFitClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(CatalogFitClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('latest() lee GET /admin/catalog/fit y conserva los null: «sin resultado» no es un cero', () => {
    let recibido: CatalogFit | undefined;
    client.latest().subscribe((r) => (recibido = r));
    const req = http.expectOne('/admin/catalog/fit');
    expect(req.request.method).toBe('GET');
    req.flush(SIN_RESULTADO);
    expect(recibido?.state).toBe('SIN_RESULTADO');
    expect(recibido?.report).toBeNull();
    expect(recibido?.ageSeconds).toBeNull();
  });

  it('run() hace POST /admin/catalog/fit/run con Idempotency-Key y recibe la corrida aceptada', () => {
    let recibido: FitRunAccepted | undefined;
    client.run().subscribe((r) => (recibido = r));
    const req = http.expectOne('/admin/catalog/fit/run');
    expect(req.request.method).toBe('POST');
    expect(req.request.headers.get('Idempotency-Key')).toMatch(/^[A-Za-z0-9._:-]{8,128}$/);
    req.flush(ACEPTADA, { status: 202, statusText: 'Accepted' });
    expect(recibido).toEqual(ACEPTADA);
  });

  it('reintentar tras un fallo repite la clave; tras un éxito, el siguiente clic lleva otra', () => {
    client.run().subscribe({ error: () => undefined });
    const primera = http.expectOne('/admin/catalog/fit/run');
    const clave = primera.request.headers.get('Idempotency-Key');
    primera.flush({ message: 'x' }, { status: 503, statusText: 'Service Unavailable' });

    client.run().subscribe();
    const reintento = http.expectOne('/admin/catalog/fit/run');
    expect(reintento.request.headers.get('Idempotency-Key')).toBe(clave);
    reintento.flush(ACEPTADA, { status: 202, statusText: 'Accepted' });

    client.run().subscribe();
    const siguiente = http.expectOne('/admin/catalog/fit/run');
    expect(siguiente.request.headers.get('Idempotency-Key')).not.toBe(clave);
    siguiente.flush(ACEPTADA, { status: 202, statusText: 'Accepted' });
  });
});
