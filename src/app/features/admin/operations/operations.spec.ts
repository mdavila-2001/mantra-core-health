import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Operations } from './operations';

describe('Operations', () => {
  it('muestra el veredicto del servidor, los bloqueos por falta de evidencia y la evidencia de cada control', async () => {
    await TestBed.configureTestingModule({
      imports: [Operations],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(Operations);
    fixture.detectChanges();
    http.expectOne('/admin/ops/readiness').flush({
      modelVersion: 'release-readiness/v1',
      evaluatedAt: '2026-09-18T10:00:00.000Z',
      status: 'BLOCKED_BY_UNKNOWN',
      blockingFailures: [],
      blockingUnknown: ['SLO_ATTAINED'],
      controls: [
        {
          code: 'SLO_ATTAINED',
          title: 'SLO medidos',
          blocking: true,
          status: 'UNKNOWN',
          reason: 'No hay SLO activos',
          evidence: [],
          observedAt: null,
          staleAfterDays: 7,
        },
        {
          code: 'RESTORE_TESTED',
          title: 'Restauración probada',
          blocking: true,
          status: 'PASS',
          reason: 'ok',
          evidence: [{ ref: 'system_ops.restore_test_runs/1', detail: 'dentro de objetivo', at: null }],
          observedAt: null,
          staleAfterDays: 90,
        },
      ],
      notImplemented: [],
    });
    http.expectOne((r) => r.url === '/admin/ops/incidents').flush([]);
    http.expectOne('/admin/ops/deployments').flush([]);
    http.expectOne('/admin/ops/slos').flush([]);
    http.expectOne('/admin/ops/backups').flush([]);
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Bloqueada por falta de evidencia');
    expect(texto).toContain('No saber no es lo mismo que estar bien');
    expect(texto).toContain('system_ops.restore_test_runs/1');
    http.verify();
  });
});
