import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RuntimePiecesClient } from './runtime-pieces.client';
import type { DiscoveryReport } from './runtime-pieces.types';

const INFORME: DiscoveryReport = {
  dryRun: true,
  discoveredAt: '2026-10-31',
  scanned: 3,
  created: 1,
  updated: 0,
  unchanged: 2,
  orphans: 0,
  conflicts: 0,
  createdIds: ['rtp.job.a'],
  updatedIds: [],
  orphanIds: [],
  conflictIds: [],
  warnings: [],
};

describe('RuntimePiecesClient', () => {
  let client: RuntimePiecesClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(RuntimePiecesClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista con GET y manda sólo los filtros que tienen valor', () => {
    client
      .list({
        page: 2,
        pageSize: 25,
        state: 'SIN_LATIDO',
        kind: undefined,
        q: '',
        withFindings: false,
        host: 'worker-messaging',
      })
      .subscribe();
    const req = http.expectOne((r) => r.url === '/admin/ops/runtime-pieces');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys().sort()).toEqual(['host', 'page', 'pageSize', 'state']);
    expect(req.request.params.get('state')).toBe('SIN_LATIDO');
    req.flush({});
  });

  it('withFindings=true viaja; sin filtros no hay parámetros', () => {
    client.list({ withFindings: true }).subscribe();
    const conFiltro = http.expectOne((r) => r.url === '/admin/ops/runtime-pieces');
    expect(conFiltro.request.params.get('withFindings')).toBe('true');
    conFiltro.flush({});
    client.list().subscribe();
    const sinFiltro = http.expectOne((r) => r.url === '/admin/ops/runtime-pieces');
    expect(sinFiltro.request.params.keys()).toEqual([]);
    sinFiltro.flush({});
  });

  it('la ficha codifica el id (lleva puntos y puede llevar caracteres de ruta)', () => {
    client.get('rtp.http.post.internal-jobs-id/complete').subscribe();
    const req = http.expectOne(
      '/admin/ops/runtime-pieces/rtp.http.post.internal-jobs-id%2Fcomplete',
    );
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('descubrir es un POST con dryRun explícito; por omisión escribe', () => {
    client.discover({ dryRun: true }).subscribe((r) => expect(r).toEqual(INFORME));
    const simulacion = http.expectOne('/admin/ops/runtime-pieces/discover');
    expect(simulacion.request.method).toBe('POST');
    expect(simulacion.request.body).toEqual({ dryRun: true });
    simulacion.flush(INFORME);

    client.discover().subscribe();
    const real = http.expectOne('/admin/ops/runtime-pieces/discover');
    expect(real.request.body).toEqual({ dryRun: false });
    real.flush({ ...INFORME, dryRun: false });
  });
});
