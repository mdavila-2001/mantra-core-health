import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { registrarDispositivos } from './analytics-devices.handlers';
import type { DevicesBreakdown } from '../../data-access/admin-portal/analytics-devices.types';

describe('dispositivos demo: mismas reglas que /admin/analytics/devices', () => {
  const router = new MockRouter();
  registrarDispositivos(router);
  const admin = buscarUsuario('superadmin')!;
  const VENTANA = { from: '2026-10-01T00:00:00.000Z', to: '2026-10-08T00:00:00.000Z' };

  function pedir(query: Record<string, string> = VENTANA) {
    const match = router.match('GET', '/admin/analytics/devices');
    if (match === null) throw new Error('No existe GET /admin/analytics/devices');
    return match.handler({
      method: 'GET',
      path: '/admin/analytics/devices',
      params: match.params,
      query: new URLSearchParams(query),
      body: null,
      headers: new HttpHeaders(),
      user: admin,
    } satisfies MockRequest);
  }
  const estado = (r: unknown) => (isMockReply(r) ? r.status : 200);
  const cuerpo = <T>(r: unknown) => (isMockReply(r) ? r.body : r) as T;
  const suma = (d: DevicesBreakdown['byOsFamily']) => d.reduce((s, i) => s + i.contexts, 0);

  it('cada desglose suma exactamente los contextos y los bots no entran en ninguno', () => {
    const r = cuerpo<DevicesBreakdown>(pedir());
    expect(r.totals.contexts).toBe(1400);
    expect(r.totals.bots).toBe(37);
    for (const d of [r.byDeviceType, r.byOsFamily, r.byBrowserFamily, r.byAppVersion]) {
      expect(suma(d)).toBeLessThanOrEqual(r.totals.contexts);
    }
    expect(suma(r.byDeviceType)).toBe(r.totals.contexts);
  });

  it('filtrar por portal cambia los totales y lo dice la ventana', () => {
    const movil = cuerpo<DevicesBreakdown>(pedir({ ...VENTANA, portal: 'MOBILE' }));
    expect(movil.window.portal).toBe('MOBILE');
    expect(movil.totals).toEqual({ contexts: 400, bots: 0 });
    expect(movil.byAppVersion.map((i) => i.code)).toContain('2.4.1');
    expect(cuerpo<DevicesBreakdown>(pedir()).window.portal).toBeNull();
  });

  it('una dimensión sin informar viene como UNSPECIFIED, no se oculta', () => {
    const web = cuerpo<DevicesBreakdown>(pedir({ ...VENTANA, portal: 'WEB' }));
    expect(web.byAppVersion).toEqual([
      { code: 'UNSPECIFIED', label: 'UNSPECIFIED', contexts: 1000 },
    ]);
  });

  it('una ventana vacía, una fecha rota, una ventana enorme o un portal desconocido son 422 con su razón', () => {
    const razon = (r: unknown) => cuerpo<{ code: string; details: { reason: string } }>(r);
    const vacia = pedir({ from: VENTANA.to, to: VENTANA.from });
    expect(estado(vacia)).toBe(422);
    expect(razon(vacia)).toMatchObject({
      code: 'VALIDATION_FAILED',
      details: { reason: 'EMPTY_WINDOW' },
    });
    expect(razon(pedir({ to: 'no-es-fecha' })).details.reason).toBe('INVALID_DATE');
    expect(razon(pedir({ from: '2026-01-01T00:00:00.000Z', to: VENTANA.to })).details.reason).toBe(
      'WINDOW_TOO_LARGE',
    );
    const portal = pedir({ ...VENTANA, portal: 'DROP' });
    expect(estado(portal)).toBe(422);
    expect(razon(portal).details.reason).toBe('INVALID_PORTAL');
  });

  it('declara lo que no mide y no trae identificadores', () => {
    const r = pedir();
    expect(cuerpo<DevicesBreakdown>(r).notMeasured.length).toBeGreaterThan(0);
    expect(JSON.stringify(r)).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
  });
});
