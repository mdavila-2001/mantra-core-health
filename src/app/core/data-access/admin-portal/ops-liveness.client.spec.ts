import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { OpsLivenessClient } from './ops-liveness.client';
import type { InstancesLiveness } from './ops-liveness.types';

describe('OpsLivenessClient', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lee GET /admin/ops/instances/liveness sin parámetros y entrega el cuerpo tal cual', () => {
    const cuerpo: InstancesLiveness = {
      evaluatedAt: '2026-10-30T12:00:00.000Z',
      thresholds: { heartbeatIntervalSeconds: 15, liveSeconds: 30, degradedSeconds: 60 },
      overall: 'SIN_DATO',
      instances: [],
      notMeasured: [{ id: 'minio', reason: 'No se sondea.' }],
    };
    let recibido: InstancesLiveness | undefined;
    TestBed.inject(OpsLivenessClient)
      .liveness()
      .subscribe((r) => (recibido = r));
    const req = http.expectOne('/admin/ops/instances/liveness');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush(cuerpo);
    expect(recibido).toEqual(cuerpo);
  });

  it('propaga el error de la API sin convertirlo en un dato', () => {
    let status = 0;
    TestBed.inject(OpsLivenessClient)
      .liveness()
      .subscribe({ error: (e: { status: number }) => (status = e.status) });
    http
      .expectOne('/admin/ops/instances/liveness')
      .flush({ code: 'FORBIDDEN' }, { status: 403, statusText: 'Forbidden' });
    expect(status).toBe(403);
  });
});
