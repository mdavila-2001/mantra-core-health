import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { NavigationService } from '../../../core/navigation/navigation.service';
import type { InstanceLiveness } from '../../../core/data-access/admin-portal/ops-liveness.types';
import type { OpsTools } from '../../../core/data-access/admin-portal/ops-tools.types';
import { PlatformHome } from './platform-home';

const SONDA: InstanceLiveness = {
  modelVersion: 'instance-liveness/v1',
  evaluatedAt: '2026-10-31T12:00:00.000Z',
  overall: 'CRITICO',
  summary: { VIVA: 12, DEGRADADA: 2, CAIDA: 1, SIN_DATO: 3, total: 18 },
  heartbeatStore: { status: 'up', reason: null },
  thresholds: { workerHeartbeatIntervalSeconds: 15, degradedAfterSeconds: 30, downAfterSeconds: 60, dependencyLatencyDegradedMs: 1000, dependencyProbeTimeoutMs: 3000, clockToleranceSeconds: 5 },
  instances: [],
  notMeasured: [],
};

const HERRAMIENTAS: OpsTools = {
  modelVersion: 'ops-tools/v1',
  evaluatedAt: '2026-10-31T12:00:00.000Z',
  summary: { total: 15, healthy: 8, down: 2, noProbe: 2, notApplicable: 3, critical: 6 },
  tools: [],
};

/**
 * La portada del perfil de gestión. Lo que fija: cada bloque de estado se pide
 * por su cuenta (que uno falle no apaga a los demás), y la tarjeta de
 * instancias dice el veredicto de la sonda con texto y manda a la pantalla
 * completa.
 */
describe('PlatformHome', () => {
  let fixture: ComponentFixture<PlatformHome>;
  let http: HttpTestingController;

  const q = <T extends Element>(selector: string) => (fixture.nativeElement as HTMLElement).querySelector<T>(selector);
  const texto = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlatformHome],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: NavigationService,
          useValue: {
            visibleSections: () => [
              { path: 'superadmin/observability' },
              { path: 'superadmin/instances' },
              { path: 'superadmin/operations' },
              { path: 'administration/users' },
            ],
          },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PlatformHome);
    fixture.detectChanges();
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  /** Responde todo lo que la portada pide al abrir, salvo lo que se le indique. */
  function responderResto(): void {
    http.expectOne((r) => r.url === '/admin/ops/traffic').flush({}, { status: 500, statusText: 'x' });
    http.expectOne((r) => r.url === '/admin/ops/readiness').flush({}, { status: 500, statusText: 'x' });
    http.expectOne((r) => r.url.startsWith('/admin/ops/incidents')).flush({}, { status: 500, statusText: 'x' });
    http.expectOne((r) => r.url.startsWith('/admin/ops/deployments')).flush({}, { status: 500, statusText: 'x' });
    http.expectOne((r) => r.url.startsWith('/admin/ops/backups')).flush({}, { status: 500, statusText: 'x' });
    http.expectOne((r) => r.url.startsWith('/admin/qa/runs')).flush({}, { status: 500, statusText: 'x' });
  }

  it('pide la sonda y las herramientas junto con los demás bloques, cada uno por su cuenta', () => {
    const sonda = http.expectOne((r) => r.url === '/admin/ops/instances/liveness');
    const herramientas = http.expectOne((r) => r.url === '/admin/ops/tools');
    expect(sonda.request.method).toBe('GET');
    expect(herramientas.request.method).toBe('GET');
    sonda.flush(SONDA);
    herramientas.flush(HERRAMIENTAS);
    responderResto();
    fixture.detectChanges();
    // Que el resto haya fallado no apaga la tarjeta de instancias.
    expect(q('[data-testid="centro-instancias-overall"]')!.textContent).toContain('Crítico');
    expect(q('[data-testid="centro-instancias-vivas"]')!.textContent).toContain('12');
    expect(q('[data-testid="centro-instancias-caidas"]')!.textContent).toContain('1');
    expect(q('[data-testid="centro-herramientas-caidas"]')!.textContent).toContain('2');
    expect(texto()).toContain('6 de 15');
  });

  it('si la API responde las herramientas sin `summary` lo dice y el resto de la portada sigue (no se rompe ni inventa 0)', () => {
    http.expectOne((r) => r.url === '/admin/ops/instances/liveness').flush(SONDA);
    http.expectOne((r) => r.url === '/admin/ops/tools').flush({ evaluatedAt: '2026-10-31T12:00:00.000Z', items: [] });
    responderResto();
    fixture.detectChanges();
    expect(q('[data-testid="centro-herramientas-sin-resumen"]')).not.toBeNull();
    expect(q('[data-testid="centro-herramientas-caidas"]')).toBeNull();
    expect(q('[data-testid="centro-instancias-overall"]')!.textContent).toContain('Crítico');
  });

  it('la segunda puerta se llama «Observabilidad y gobierno» y lleva a /superadmin/observability; ya no hay «Portal de reportería»', () => {
    http.expectOne((r) => r.url === '/admin/ops/instances/liveness').flush(SONDA);
    http.expectOne((r) => r.url === '/admin/ops/tools').flush(HERRAMIENTAS);
    responderResto();
    fixture.detectChanges();
    const puerta = q<HTMLAnchorElement>('[data-testid="portal-observabilidad"]');
    expect(puerta?.textContent?.trim()).toBe('Observabilidad y gobierno');
    expect(puerta?.getAttribute('href')).toBe('/superadmin/observability');
    expect(q('[data-testid="platform-home-portales"]')!.textContent).not.toContain('reportería');
    expect(texto()).not.toContain('Portal de reportería');
  });

  it('la tarjeta enlaza a la pantalla completa y el portal de reportería la lista como destino', () => {
    http.expectOne((r) => r.url === '/admin/ops/instances/liveness').flush(SONDA);
    http.expectOne((r) => r.url === '/admin/ops/tools').flush(HERRAMIENTAS);
    responderResto();
    fixture.detectChanges();
    const enlaces = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a[href="/superadmin/instances"]'));
    expect(enlaces.length).toBeGreaterThanOrEqual(2);
    expect(q('[data-testid="platform-home-portales"]')!.textContent).toContain('Instancias y herramientas');
  });

  it('con el almacén de latidos caído lo dice en la tarjeta', () => {
    http.expectOne((r) => r.url === '/admin/ops/instances/liveness').flush({ ...SONDA, overall: 'SIN_DATO', heartbeatStore: { status: 'down', reason: 'STORE_UNAVAILABLE' } });
    http.expectOne((r) => r.url === '/admin/ops/tools').flush(HERRAMIENTAS);
    responderResto();
    fixture.detectChanges();
    expect(q('[data-testid="centro-instancias-overall"]')!.textContent).toContain('Sin dato');
    expect(texto()).toContain('«sin dato» no es «caída»');
  });

  it('si la sonda falla, la tarjeta muestra el error y las herramientas siguen', () => {
    http.expectOne((r) => r.url === '/admin/ops/instances/liveness').flush({ code: 'INTERNAL' }, { status: 500, statusText: 'Internal Server Error' });
    http.expectOne((r) => r.url === '/admin/ops/tools').flush(HERRAMIENTAS);
    responderResto();
    fixture.detectChanges();
    expect(q('[data-testid="centro-instancias-overall"]')).toBeNull();
    expect(q('[data-testid="centro-herramientas-caidas"]')!.textContent).toContain('2');
  });
});
