import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { registrarTrafico } from './ops-traffic.handlers';
import type { TrafficEndpointsPage, TrafficOverview } from '../../data-access/admin-portal/ops-traffic.types';

describe('tráfico HTTP demo: mismas reglas que /admin/ops/traffic*', () => {
  const router = new MockRouter();
  registrarTrafico(router);
  const admin = buscarUsuario('superadmin')!;

  function pedir(path: string, query: Record<string, string> = {}) {
    const match = router.match('GET', path);
    if (match === null) throw new Error(`No existe GET ${path}`);
    return match.handler({
      method: 'GET',
      path,
      params: match.params,
      query: new URLSearchParams(query),
      body: null,
      headers: new HttpHeaders(),
      user: admin,
    } satisfies MockRequest);
  }

  const estado = (r: unknown) => (isMockReply(r) ? r.status : 200);
  const cuerpo = <T>(r: unknown) => (isMockReply(r) ? r.body : r) as T;

  it('el total es la suma de los endpoints y la serie suma el total', () => {
    const resumen = cuerpo<TrafficOverview>(pedir('/admin/ops/traffic', { from: '2026-10-17T00:00:00.000Z', to: '2026-10-17T15:00:00.000Z' }));
    const endpoints = cuerpo<TrafficEndpointsPage>(pedir('/admin/ops/traffic/endpoints', { from: '2026-10-17T00:00:00.000Z', to: '2026-10-17T15:00:00.000Z' }));
    const suma = (f: (e: TrafficEndpointsPage['items'][number]) => number) => endpoints.items.reduce((s, e) => s + f(e), 0);
    expect(resumen.measured.requests).toBe(suma((e) => e.requests));
    expect(resumen.measured.failed.client4xx).toBe(suma((e) => e.failed4xx));
    expect(resumen.measured.failed.server5xx).toBe(suma((e) => e.failed5xx));
    expect(resumen.measured.succeeded + resumen.measured.failed.client4xx + resumen.measured.failed.server5xx).toBe(resumen.measured.requests);
    expect(resumen.series.reduce((s, b) => s + b.requests, 0)).toBe(resumen.measured.requests);
    expect(resumen.series).toHaveLength(15);
  });

  it('por defecto la ventana arranca a medianoche UTC del día de `to`', () => {
    const resumen = cuerpo<TrafficOverview>(pedir('/admin/ops/traffic', { to: '2026-10-17T15:30:00.000Z' }));
    expect(resumen.window.from).toBe('2026-10-17T00:00:00.000Z');
    expect(resumen.window.timezone).toBe('UTC');
    // `to` exactamente a medianoche: se mira el día anterior, no una ventana vacía.
    const medianoche = cuerpo<TrafficOverview>(pedir('/admin/ops/traffic', { to: '2026-10-17T00:00:00.000Z' }));
    expect(medianoche.window.from).toBe('2026-10-16T00:00:00.000Z');
  });

  it('una ventana vacía o una fecha rota es 422 con su razón', () => {
    const vacia = pedir('/admin/ops/traffic', { from: '2026-10-18T00:00:00.000Z', to: '2026-10-17T00:00:00.000Z' });
    expect(estado(vacia)).toBe(422);
    expect(cuerpo<{ code: string; details: { reason: string } }>(vacia)).toMatchObject({ code: 'VALIDATION_FAILED', details: { reason: 'EMPTY_WINDOW' } });
    const rota = pedir('/admin/ops/traffic/endpoints', { to: 'no-es-fecha' });
    expect(estado(rota)).toBe(422);
    expect(cuerpo<{ details: { reason: string } }>(rota).details.reason).toBe('INVALID_DATE');
  });

  it('ordena, corta y declara el corte', () => {
    const porFallos = cuerpo<TrafficEndpointsPage>(pedir('/admin/ops/traffic/endpoints', { sort: 'failed', limit: '2' }));
    expect(porFallos.items).toHaveLength(2);
    expect(porFallos.truncated).toBe(true);
    const fallos = porFallos.items.map((e) => e.failed4xx + e.failed5xx);
    expect(fallos[0]).toBeGreaterThanOrEqual(fallos[1]!);
    const porLatencia = cuerpo<TrafficEndpointsPage>(pedir('/admin/ops/traffic/endpoints', { sort: 'p95' }));
    expect(porLatencia.items[0]!.route).toBe('/payments/qr');
    // Un criterio desconocido cae al de siempre, no se interpreta.
    expect(cuerpo<TrafficEndpointsPage>(pedir('/admin/ops/traffic/endpoints', { sort: 'DROP' })).sort).toBe('requests');
  });

  it('nunca trae un identificador y las rutas son plantillas', () => {
    const texto = JSON.stringify([pedir('/admin/ops/traffic'), pedir('/admin/ops/traffic/endpoints')]);
    expect(texto).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    const rutas = cuerpo<TrafficEndpointsPage>(pedir('/admin/ops/traffic/endpoints')).items.map((e) => e.route);
    expect(rutas).toContain('UNMATCHED');
    expect(rutas.filter((r) => r !== 'UNMATCHED').every((r) => r.startsWith('/'))).toBe(true);
  });
});
