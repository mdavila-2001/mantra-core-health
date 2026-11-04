import { HttpHeaders, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { CatalogFit } from '../../../../../core/data-access/admin-portal/catalog-fit.types';
import { registrarSondaCatalogo } from '../../../../../core/mock/handlers/catalog-fit.handlers';
import { MockRouter } from '../../../../../core/mock/mock-router';
import { buscarUsuario } from '../../../../../core/mock/mock-session';
import { CatalogFitPage, INTERVALO_DE_ESPERA_MS, estadoDe } from './catalog-fit-page';
import { PORTAL_CATALOG_FIT_ROUTES } from './catalog-fit.routes';

const SCREEN = '/superadmin/portal/catalog/fit';

/** La respuesta del simulador declarado (SIMULADO): cifras sintéticas con la forma exacta del DTO. */
function simulada(): CatalogFit {
  const router = new MockRouter();
  registrarSondaCatalogo(router);
  const match = router.match('GET', '/admin/catalog/fit')!;
  return match.handler({
    method: 'GET',
    path: '/admin/catalog/fit',
    params: match.params,
    query: new URLSearchParams(),
    body: null,
    headers: new HttpHeaders(),
    user: buscarUsuario('superadmin')!,
  }) as CatalogFit;
}

const SIN_RESULTADO: CatalogFit = {
  ...simulada(),
  state: 'SIN_RESULTADO',
  noResultReason: 'NUNCA_EJECUTADA',
  ageSeconds: null,
  running: null,
  lastRun: null,
  report: null,
  history: [],
};

describe('estadoDe', () => {
  it('sin informe y sin corrida en vuelo es S3: vacío, con la próxima acción y el porqué', () => {
    const s = estadoDe(SIN_RESULTADO);
    expect(s.status).toBe('empty');
    if (s.status === 'empty') {
      expect(s.nextAction.label).toBe('Ejecutar la sonda');
      expect(s.message).toContain('todavía no corrió');
    }
  });

  it('un resultado vencido lo dice distinto a uno que nunca corrió', () => {
    const s = estadoDe({ ...SIN_RESULTADO, noResultReason: 'EXPIRADO' });
    expect(s.status === 'empty' && s.message).toContain('venció');
  });

  it('sin informe pero con la primera corrida en vuelo es S2: cargando, no un vacío', () => {
    const corrida = simulada().lastRun!;
    expect(
      estadoDe({
        ...SIN_RESULTADO,
        running: { ...corrida, status: 'EN_CURSO', finishedAt: null, durationMs: null },
      }).status,
    ).toBe('loading');
  });

  it('un informe vigente es ready y uno atrasado es S7 con su antigüedad (asOf)', () => {
    const vigente = simulada();
    expect(estadoDe(vigente).status).toBe('ready');
    const s = estadoDe({ ...vigente, state: 'ATRASADO' });
    expect(s.status).toBe('stale');
    if (s.status === 'stale') expect(s.asOf.toISOString()).toBe(vigente.report!.evaluatedAt);
  });
});

describe('PORTAL_CATALOG_FIT_ROUTES', () => {
  it('declara una sola pantalla en catalog/fit con título y componente', async () => {
    expect(PORTAL_CATALOG_FIT_ROUTES.map((r) => r.path)).toEqual(['catalog/fit']);
    const ruta = PORTAL_CATALOG_FIT_ROUTES[0]!;
    expect(ruta.title).toBeTruthy();
    expect(typeof (await (ruta.loadComponent as () => Promise<unknown>)())).toBe('function');
  });
});

describe('CatalogFitPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  async function open(): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'superadmin/portal/catalog/fit', component: CatalogFitPage }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(SCREEN, CatalogFitPage);
  }

  const el = () => harness.routeNativeElement as HTMLElement;
  const text = () => el().textContent ?? '';
  const q = (testid: string) =>
    el().querySelector(`[data-testid="${testid}"]`) as HTMLElement | null;

  async function conResultado(r: CatalogFit = simulada()): Promise<void> {
    await open();
    http.expectOne('/admin/catalog/fit').flush(r);
    harness.detectChanges();
  }

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  it('muestra el veredicto, la antigüedad y el puntaje de cada dimensión con su numerador y denominador', async () => {
    await conResultado();
    expect(q('catalog-fit-verdict')!.textContent).toContain('Desajustada');
    expect(q('catalog-fit-verdict')!.textContent).toContain('hace');
    const rutas = q('catalog-fit-dimension-ROUTES')!.textContent ?? '';
    expect(rutas).toContain('Rutas');
    expect(rutas).toMatch(/\d+(,\d+)? %/);
    expect(rutas).toMatch(/de [\d.]+ ítems/);
    expect(q('catalog-fit-fingerprints')!.textContent).toContain('aaaa111122223333');
  });

  it('null no es cero: la mutabilidad sin taxonomía dice «No declarado», no 0 %', async () => {
    await conResultado();
    const mutabilidad = q('catalog-fit-dimension-MUTABILITY')!.textContent ?? '';
    expect(mutabilidad).toContain('No declarado');
    expect(mutabilidad).not.toContain('0 %');
    expect(mutabilidad).toContain('sin medir');
  });

  it('avisa los puntos ciegos con sus ids: no saber no es estar bien', async () => {
    await conResultado();
    const aviso = q('catalog-fit-blind-spots')!.textContent ?? '';
    expect(aviso).toContain('FIT-MOD-006');
    expect(aviso).toContain('FIT-MUT-001');
  });

  it('Hallazgos lista primero las que fallan; elegir una muestra su evidencia, cómo corregirla y sus hallazgos', async () => {
    await conResultado();
    const tabs = Array.from(el().querySelectorAll('[role="tab"]')) as HTMLElement[];
    tabs.find((t) => t.textContent?.includes('Hallazgos'))!.click();
    harness.detectChanges();
    const tabla = q('catalog-fit-checks')!;
    expect(tabla.textContent).toContain('FIT-RUT-001');
    expect(tabla.textContent).not.toContain('FIT-MUT-001');
    expect(q('catalog-fit-detail')).toBeNull();

    q('catalog-fit-open-FIT-RUT-001')!.click();
    harness.detectChanges();
    const detalle = q('catalog-fit-detail')!.textContent ?? '';
    expect(detalle).toContain('FIT-RUT-001');
    expect(detalle).toContain('Cómo corregirlo');
    expect(detalle).toContain('Regenerar el inventario');
    expect(q('catalog-fit-findings')!.textContent).toContain('Simulado:');
  });

  it('el filtro de puntos ciegos muestra las que no pudieron medir, con su razón', async () => {
    await conResultado();
    (Array.from(el().querySelectorAll('[role="tab"]')) as HTMLElement[])
      .find((t) => t.textContent?.includes('Hallazgos'))!
      .click();
    harness.detectChanges();
    (Array.from(el().querySelectorAll('button, [role="radio"]')) as HTMLElement[])
      .find((b) => b.textContent?.trim() === 'Puntos ciegos')!
      .click();
    harness.detectChanges();
    const tabla = q('catalog-fit-checks')!.textContent ?? '';
    expect(tabla).toContain('FIT-MUT-001');
    expect(tabla).toContain('FIT-MOD-006');
    expect(tabla).not.toContain('FIT-RUT-001');
    q('catalog-fit-open-FIT-MUT-001')!.click();
    harness.detectChanges();
    expect(q('catalog-fit-reason')!.textContent).toContain('taxonomía');
  });

  it('Historial lista las corridas, de la más reciente a la más antigua, y declara dónde viven', async () => {
    await conResultado();
    (Array.from(el().querySelectorAll('[role="tab"]')) as HTMLElement[])
      .find((t) => t.textContent?.includes('Historial'))!
      .click();
    harness.detectChanges();
    expect(q('catalog-fit-retention')!.textContent).toContain('memoria');
    const filas = q('catalog-fit-history')!.querySelectorAll('[data-testid="tabla-fila"]');
    expect(filas.length).toBe(simulada().history.length);
    expect(q('catalog-fit-history')!.textContent).toContain('Automática (worker)');
  });

  it('un resultado atrasado (S7) muestra el aviso con la antigüedad del dato', async () => {
    await conResultado({ ...simulada(), state: 'ATRASADO', ageSeconds: 1_200 });
    expect(text()).toContain('Atrasada');
    expect(text()).toContain('hace 20 min');
  });

  it('sin resultado ofrece ejecutar la sonda; ejecutar pide la corrida con Idempotency-Key y vuelve a leer', async () => {
    await conResultado(SIN_RESULTADO);
    expect(q('catalog-fit-empty')!.textContent).toContain('todavía no corrió');
    (q('catalog-fit-empty')!.querySelector('button') as HTMLButtonElement).click();
    const post = http.expectOne('/admin/catalog/fit/run');
    expect(post.request.method).toBe('POST');
    expect(post.request.headers.get('Idempotency-Key')).toBeTruthy();
    post.flush(
      {
        runId: 'r',
        status: 'EN_CURSO',
        created: true,
        acceptedAt: '2026-10-31T12:00:00.000Z',
        statusUrl: '/admin/catalog/fit',
      },
      { status: 202, statusText: 'Accepted' },
    );
    http.expectOne('/admin/catalog/fit').flush(simulada());
    harness.detectChanges();
    expect(q('catalog-fit-verdict')).not.toBeNull();
  });

  it('mientras la corrida está en vuelo vuelve a leer hasta que termina (y el botón queda bloqueado)', async () => {
    await open();
    vi.useFakeTimers();
    const corrida = simulada().lastRun!;
    const enVuelo: CatalogFit = {
      ...simulada(),
      running: { ...corrida, status: 'EN_CURSO', finishedAt: null, durationMs: null },
    };
    http.expectOne('/admin/catalog/fit').flush(enVuelo);
    harness.detectChanges();
    expect(q('catalog-fit-run')!.getAttribute('aria-disabled')).toBe('true');
    await vi.advanceTimersByTimeAsync(INTERVALO_DE_ESPERA_MS + 10);
    http.expectOne('/admin/catalog/fit').flush(simulada());
    harness.detectChanges();
    expect(q('catalog-fit-run')!.getAttribute('aria-disabled')).toBe('false');
    await vi.advanceTimersByTimeAsync(INTERVALO_DE_ESPERA_MS * 3);
    http.expectNone('/admin/catalog/fit');
  });

  it('un 403 al ejecutar lo explica sin tapar el resultado que ya había', async () => {
    await conResultado();
    (q('catalog-fit-run') as HTMLButtonElement).click();
    http
      .expectOne('/admin/catalog/fit/run')
      .flush(
        { statusCode: 403, code: 'FORBIDDEN', message: 'x', timestamp: '', path: '' },
        { status: 403, statusText: 'Forbidden', headers: { 'x-request-id': 'req-9' } },
      );
    harness.detectChanges();
    expect(q('catalog-fit-run-error')!.textContent).toContain('rol de escritura');
    expect(q('catalog-fit-verdict')).not.toBeNull();
    expect(q('catalog-fit-run')!.getAttribute('aria-disabled')).toBe('false');
  });

  it('si la última corrida falló después del informe que se muestra, lo dice', async () => {
    const r = simulada();
    const falla = {
      ...r.lastRun!,
      status: 'FALLIDA' as const,
      finishedAt: new Date(Date.parse(r.report!.evaluatedAt) + 60_000).toISOString(),
      errorCode: 'RangeError',
    };
    await conResultado({ ...r, lastFailure: falla });
    expect(q('catalog-fit-last-failure')!.textContent).toContain('RangeError');
  });

  it('un fallo de la API ofrece reintentar y vuelve a pedir', async () => {
    await open();
    http
      .expectOne('/admin/catalog/fit')
      .flush(
        { code: 'INTERNAL', message: 'x', timestamp: '', path: '' },
        { status: 500, statusText: 'Server Error', headers: { 'x-request-id': 'req-1' } },
      );
    harness.detectChanges();
    expect(text()).toContain('req-1');
    (harness.routeDebugElement!.componentInstance as unknown as { cargar(): void }).cargar();
    http.expectOne('/admin/catalog/fit').flush(simulada());
    harness.detectChanges();
    expect(q('catalog-fit-verdict')).not.toBeNull();
  });
});
