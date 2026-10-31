import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { OpsLivenessClient } from './ops-liveness.client';
import type { InstanceLiveness } from './ops-liveness.types';

const RESPUESTA: InstanceLiveness = {
  modelVersion: 'instance-liveness/v1',
  evaluatedAt: '2026-10-30T12:05:20.000Z',
  overall: 'OK',
  summary: { VIVA: 1, DEGRADADA: 0, CAIDA: 0, SIN_DATO: 0, total: 1 },
  heartbeatStore: { status: 'up', reason: null },
  thresholds: {
    workerHeartbeatIntervalSeconds: 15,
    degradedAfterSeconds: 30,
    downAfterSeconds: 60,
    dependencyLatencyDegradedMs: 1000,
    dependencyProbeTimeoutMs: 3000,
    clockToleranceSeconds: 5,
  },
  instances: [
    {
      id: 'api',
      label: 'API',
      type: 'API',
      required: true,
      state: 'VIVA',
      lastHeartbeatAt: '2026-10-30T12:05:20.000Z',
      ageSeconds: 0,
      thresholdSeconds: 60,
      cause: 'OK',
      causeDetail: 'La API respondió.',
      evidence: { source: 'self', reportedStatus: 'running', startedAt: '2026-10-30T08:00:00.000Z', latencyMs: null },
    },
  ],
  notMeasured: ['replicasOfApi'],
};

describe('OpsLivenessClient', () => {
  let client: OpsLivenessClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(OpsLivenessClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide la sonda con GET, sin parámetros, y devuelve el cuerpo tal cual', () => {
    let recibido: InstanceLiveness | undefined;
    client.liveness().subscribe((r) => (recibido = r));
    const req = http.expectOne((r) => r.url.endsWith('/admin/ops/instances/liveness'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toHaveLength(0);
    req.flush(RESPUESTA);
    expect(recibido).toEqual(RESPUESTA);
    expect(recibido?.instances[0]?.state).toBe('VIVA');
  });

  it('un error de la API llega al suscriptor sin traducirse', () => {
    let status = 0;
    client.liveness().subscribe({ error: (e: { status: number }) => (status = e.status) });
    http
      .expectOne((r) => r.url.endsWith('/admin/ops/instances/liveness'))
      .flush({ code: 'FORBIDDEN' }, { status: 403, statusText: 'Forbidden' });
    expect(status).toBe(403);
  });
});
