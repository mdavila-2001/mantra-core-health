import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionStore } from '@core/auth/session.store';
import type { ErrorGroupDetail } from '@core/data-access/observability/observability.types';
import { ObsErrorDetalle } from './error-detalle';

const ID = '11111111-1111-4111-8111-111111111111';

function detalle(parcial: Partial<ErrorGroupDetail> = {}): ErrorGroupDetail {
  return {
    window: { from: '2026-10-31T00:00:00.000Z', to: '2026-10-31T12:00:00.000Z', interval: 'hour', timezone: 'UTC' },
    freshness: { lastFlushAt: '2026-10-31T11:59:30.000Z', lagSeconds: 10, droppedFlushes: 0 },
    notMeasured: [],
    generatedAt: '2026-10-31T12:00:00.000Z',
    id: ID,
    title: 'GET /pacientes/:id → 404 NOT_FOUND',
    source: 'api',
    httpStatus: 404,
    code: 'NOT_FOUND',
    reason: null,
    exceptionType: null,
    moduleCode: 'iam',
    operationKey: 'X_get',
    method: 'GET',
    route: '/pacientes/:id',
    state: 'NEW',
    firstSeenAt: '2026-10-31T09:00:00.000Z',
    lastSeenAt: '2026-10-31T11:00:00.000Z',
    occurrencesTotal: 7,
    occurrences24h: 7,
    affectedActors24h: null,
    affectedActors24hReason: 'ACTOR_HASH_NOT_AVAILABLE',
    sparkline: [],
    lastRequestId: 'req-7',
    rowVersion: 3,
    regressedAt: null,
    resolvedAt: null,
    resolutionNote: null,
    sampleMessage: null,
    sampleFrames: [],
    series: [{ bucket: '2026-10-31T09:00:00.000Z', count: 7 }],
    byModule: [{ moduleCode: 'iam', events: 7 }],
    recentEvents: [
      { id: 'e1', occurredAt: '2026-10-31T11:00:00.000Z', requestId: 'req-7', traceId: null, httpStatus: 404, instanceId: 'aaaaaaaa-0000', durationMs: 12 },
    ],
    ...parcial,
  };
}

describe('ObsErrorDetalle', () => {
  let http: HttpTestingController;

  async function montar(roles: readonly string[]) {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SessionStore, useValue: { roles: signal(roles) } },
      ],
    });
    vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn(); });
    http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ObsErrorDetalle);
    fixture.componentRef.setInput('id', ID);
    await fixture.whenStable();
    http.expectOne((r) => r.url.endsWith(`/admin/observability/errors/groups/${ID}`)).flush(detalle());
    await fixture.whenStable();
    return fixture;
  }

  beforeEach(() => undefined);
  afterEach(() => {
    http.verify();
    vi.unstubAllGlobals();
  });

  const q = (f: { nativeElement: unknown }, id: string) => (f.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${id}"]`);

  it('muestra las ocurrencias, el requestId de cada evento y las personas afectadas como «No se mide» (no 0)', async () => {
    const f = await montar(['PLATFORM_ADMIN']);
    expect(q(f, 'obs-error-ocurrencias')?.textContent?.trim()).toBe('7');
    expect(q(f, 'obs-error-request-id')?.textContent?.trim()).toBe('req-7');
    expect((f.nativeElement as HTMLElement).textContent).toContain('No se mide');
  });

  it('un rol de sólo lectura no ve el formulario de cambio de estado (la API igual lo negaría)', async () => {
    const f = await montar(['SECURITY_ADMIN']);
    expect(q(f, 'obs-error-form')).toBeNull();
    expect(q(f, 'obs-error-solo-lectura')).not.toBeNull();
  });

  it('resolver sin motivo no se puede enviar; con motivo manda el estado, el motivo y la versión leída', async () => {
    const f = await montar(['PLATFORM_ADMIN']);
    const c = f.componentInstance as unknown as { destino: { set(v: string): void }; nota: { set(v: string): void }; puedeEnviar(): boolean; guardar(): void };
    c.destino.set('RESOLVED');
    expect(c.puedeEnviar()).toBe(false);
    c.nota.set('Corregido en la versión 4.2');
    expect(c.puedeEnviar()).toBe(true);
    c.guardar();
    const patch = http.expectOne((r) => r.method === 'PATCH');
    expect(patch.request.body).toEqual({ state: 'RESOLVED', note: 'Corregido en la versión 4.2', expectedVersion: 3 });
    patch.flush(detalle({ state: 'RESOLVED', rowVersion: 4 }));
    // Tras escribir se vuelve a LEER el grupo: el aviso no prueba nada, la lectura sí.
    http.expectOne((r) => r.method === 'GET' && r.url.endsWith(`/errors/groups/${ID}`)).flush(detalle({ state: 'RESOLVED', rowVersion: 4 }));
    await f.whenStable();
    expect(q(f, 'obs-error-estado')?.textContent).toContain('Resuelto');
    expect(q(f, 'obs-error-resultado')?.textContent).toContain('Resuelto');
  });

  it('un 409 por versión vieja pide recargar y no pisa el cambio del otro', async () => {
    const f = await montar(['SRE']);
    const c = f.componentInstance as unknown as { destino: { set(v: string): void }; guardar(): void };
    c.destino.set('SEEN');
    c.guardar();
    http.expectOne((r) => r.method === 'PATCH').flush({ code: 'CONCURRENCY_CONFLICT', message: 'cambió', correlationId: 'req-409' }, { status: 409, statusText: 'Conflict' });
    await f.whenStable();
    const aviso = q(f, 'obs-error-resultado')?.textContent ?? '';
    expect(aviso).toContain('cambió desde que lo abrió');
    expect(aviso).toContain('req-409');
  });
});
