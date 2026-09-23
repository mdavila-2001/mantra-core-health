import { HttpHeaders } from '@angular/common/http';

import { MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario, type MockUser } from '../mock-session';
import { registrarAnaliticaDeSeguros } from './insurance-analytics.handlers';
import { registrarSeguros } from './insurance.handlers';

interface DashboardWire {
  readonly kpis: {
    readonly totalClaimsCount: number;
    readonly lossRatioPercent: string | null;
    readonly coveragesWithoutPremiumCount: number;
  };
  readonly monthlyTrends: readonly { readonly period: string }[];
}

/**
 * El tablero de siniestralidad simulado (subtarea 3.1): sólo se prueba lo que
 * lo distingue de una tabla estática — que el rango recorte la serie y que
 * los KPIs se deriven de ese recorte, no de los doce meses completos.
 */
describe('handlers de analítica de seguros', () => {
  const router = new MockRouter();
  const owner = buscarUsuario('aseguradora')!;
  const medica = buscarUsuario('medica')!;

  registrarSeguros(router);
  registrarAnaliticaDeSeguros(router);

  function call<T>(
    method: MockMethod,
    path: string,
    query: Record<string, string>,
    user: MockUser | null,
  ): T {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    return match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(query),
      body: null,
      headers: new HttpHeaders(),
      user,
    }) as T;
  }

  it('sin tenant de la aseguradora, responde prohibido', () => {
    const response = call<MockReply>('GET', '/insurance/analytics/loss-ratio', {}, medica);
    expect(response.status).toBe(403);
  });

  it('el rango de 30 días trae menos meses que el de un año, y los totales bajan con él', () => {
    const unAnio = call<DashboardWire>(
      'GET',
      '/insurance/analytics/loss-ratio',
      { startDate: '2025-09-14', endDate: '2026-09-14' },
      owner,
    );
    const unMes = call<DashboardWire>(
      'GET',
      '/insurance/analytics/loss-ratio',
      { startDate: '2026-08-15', endDate: '2026-09-14' },
      owner,
    );

    expect(unAnio.monthlyTrends.length).toBe(12);
    expect(unMes.monthlyTrends.length).toBe(1);
    // Derivado, no repetido: menos meses de siniestros es menos reclamos totales.
    expect(unMes.kpis.totalClaimsCount).toBeLessThan(unAnio.kpis.totalClaimsCount);
  });

  it('con las primas de fábrica del catálogo, el loss ratio ya viene calculado', () => {
    // Los tres planes ANDINA-* nacen con prima en el catálogo simulado
    // (`PRIMAS` de `insurance.handlers.ts`) — a diferencia de la API real
    // (donde nace `null`), acá el semáforo se ve poblado sin pasos previos.
    const dashboard = call<DashboardWire>(
      'GET',
      '/insurance/analytics/loss-ratio',
      { startDate: '2025-09-14', endDate: '2026-09-14' },
      owner,
    );

    expect(dashboard.kpis.lossRatioPercent).not.toBeNull();
    expect(dashboard.kpis.coveragesWithoutPremiumCount).toBe(0);
  });

  it('quitar la prima de un plan (null) hace que el loss ratio de ESE plan sea null', () => {
    const directory = call<{ items: readonly { id: string }[] }>(
      'GET',
      '/insurance-carriers',
      {},
      owner,
    );
    const detail = call<{
      products: readonly { plans: readonly { id: string; planCode: string }[] }[];
    }>('GET', `/insurance-carriers/${directory.items[0]!.id}`, {}, owner);
    const plan = detail.products[0]!.plans[0]!;

    // `call()` no manda cuerpo (es `GET`-céntrico): el `PUT` de la prima se
    // dispara directo contra el router, como hace el propio helper por dentro.
    const match = router.match('PUT', `/insurance-plans/${plan.id}/premium`)!;
    match.handler({
      method: 'PUT',
      path: `/insurance-plans/${plan.id}/premium`,
      params: match.params,
      query: new URLSearchParams(),
      body: { monthlyPremiumAmount: null },
      headers: new HttpHeaders(),
      user: owner,
    });

    const dashboard = call<DashboardWire>(
      'GET',
      '/insurance/analytics/loss-ratio',
      { startDate: '2025-09-14', endDate: '2026-09-14', planId: plan.id },
      owner,
    );
    expect(dashboard.kpis.lossRatioPercent).toBeNull();
    expect(dashboard.kpis.coveragesWithoutPremiumCount).toBe(1);
  });

  it('un planId que no es de la aseguradora administrable responde 404', () => {
    const response = call<MockReply>(
      'GET',
      '/insurance/analytics/loss-ratio',
      { planId: '00000000-0000-4000-8000-000000000000' },
      owner,
    );
    expect(response.status).toBe(404);
  });
});
