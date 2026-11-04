import { HttpHeaders } from '@angular/common/http';
import { describe, expect, it } from 'vitest';

import type { CenterBookingPage } from '../../data-access/diagnostic-units/center-schedule.types';
import { MockRouter } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { registerCenterBookings } from './center-bookings.handlers';

describe('GET /diagnostic-units/me/bookings (simulador)', () => {
  const router = new MockRouter();
  registerCenterBookings(router);

  function call(email: string, query: URLSearchParams): { status?: number; body?: unknown } & Partial<CenterBookingPage> {
    const match = router.match('GET', '/diagnostic-units/me/bookings');
    if (match === null) throw new Error('route not registered');
    return match.handler({
      method: 'GET',
      path: '/diagnostic-units/me/bookings',
      params: match.params,
      query,
      body: {},
      headers: new HttpHeaders(),
      user: buscarUsuario(email)!,
    }) as { status?: number } & Partial<CenterBookingPage>;
  }

  const today = (): URLSearchParams => {
    const from = new Date();
    from.setHours(0, 0, 0, 0);
    const to = new Date(from.getTime() + 86_400_000);
    return new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  };

  it('el laboratorio ve sus turnos de hoy, ordenados y con la forma del contrato', () => {
    const page = call('laboratorio@alovida.mock', today());
    expect(page.count).toBeGreaterThan(0);
    expect(page.items).toHaveLength(page.count!);
    const starts = page.items!.map((b) => b.startsAt);
    expect([...starts].sort()).toEqual(starts);
    expect(Object.keys(page.items![0]!).sort()).toEqual(
      ['bookingId', 'endsAt', 'orderId', 'patientName', 'siteName', 'startsAt', 'status', 'studyName'].sort(),
    );
  });

  it('fuera del rango no devuelve nada', () => {
    const query = new URLSearchParams({ from: '2001-01-01T00:00:00.000Z', to: '2001-01-02T00:00:00.000Z' });
    expect(call('laboratorio@alovida.mock', query).count).toBe(0);
  });

  it('sin rango válido responde 400', () => {
    expect(call('laboratorio@alovida.mock', new URLSearchParams()).status).toBe(400);
  });

  it('quien no es de un centro de diagnóstico recibe 404', () => {
    expect(call('paciente', today()).status).toBe(404);
  });
});
