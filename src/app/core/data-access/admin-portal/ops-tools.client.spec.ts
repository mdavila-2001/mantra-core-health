import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { OpsToolsClient } from './ops-tools.client';
import type { OpsTools } from './ops-tools.types';

const RESPUESTA: OpsTools = {
  modelVersion: 'ops-tools/v1',
  evaluatedAt: '2026-10-30T12:05:20.000Z',
  summary: { total: 1, healthy: 1, down: 0, noProbe: 0, notApplicable: 0, critical: 1 },
  tools: [
    {
      code: 'postgresql',
      name: 'PostgreSQL',
      kind: 'DATABASE',
      provider: 'PostgreSQL',
      purpose: 'Base de datos principal.',
      isCritical: true,
      status: 'ACTIVE',
      binding: 'real',
      isConfigured: true,
      missingEnvVars: [],
      requiredEnvVars: ['DATABASE_URL'],
      checkType: 'LIVE',
      isHealthy: true,
      healthMessage: 'SELECT 1 respondió en 4 ms.',
      latencyMs: 4,
      checkedAt: '2026-10-30T12:05:19.000Z',
      ownerTeam: 'plataforma',
      failureImpact: 'Nada funciona.',
      fallback: 'Ninguno.',
    },
  ],
};

describe('OpsToolsClient', () => {
  let client: OpsToolsClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(OpsToolsClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide la lista completa con GET, sin parámetros, y devuelve el cuerpo tal cual', () => {
    let recibido: OpsTools | undefined;
    client.tools().subscribe((r) => (recibido = r));
    const req = http.expectOne((r) => r.url.endsWith('/admin/ops/tools'));
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toHaveLength(0);
    req.flush(RESPUESTA);
    expect(recibido).toEqual(RESPUESTA);
    expect(recibido?.summary.critical).toBe(1);
  });

  it('un error de la API llega al suscriptor sin traducirse', () => {
    let status = 0;
    client.tools().subscribe({ error: (e: { status: number }) => (status = e.status) });
    http
      .expectOne((r) => r.url.endsWith('/admin/ops/tools'))
      .flush({ code: 'INTERNAL' }, { status: 500, statusText: 'Internal Server Error' });
    expect(status).toBe(500);
  });
});
