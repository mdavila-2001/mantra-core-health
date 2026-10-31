import { HttpHeaders } from '@angular/common/http';

import type { MoneyReport } from '../../data-access/admin-portal/analytics-money.types';
import { MockRouter, isMockReply, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { registrarDinero } from './analytics-money.handlers';

describe('dinero simulado: mismas reglas que /admin/analytics/money', () => {
  const router = new MockRouter();
  registrarDinero(router);
  const admin = buscarUsuario('superadmin')!;
  const UN_DIA = { from: '2026-10-01T00:00:00.000Z', to: '2026-10-02T00:00:00.000Z' };
  const UNA_SEMANA = { from: '2026-10-01T00:00:00.000Z', to: '2026-10-08T00:00:00.000Z' };

  function pedir(query: Record<string, string> = UN_DIA) {
    const match = router.match('GET', '/admin/analytics/money');
    if (match === null) throw new Error('No existe GET /admin/analytics/money');
    return match.handler({
      method: 'GET',
      path: '/admin/analytics/money',
      params: match.params,
      query: new URLSearchParams(query),
      body: null,
      headers: new HttpHeaders(),
      user: admin,
    } satisfies MockRequest);
  }
  const estado = (r: unknown) => (isMockReply(r) ? r.status : 200);
  const cuerpo = <T>(r: unknown) => (isMockReply(r) ? r.body : r) as T;

  it('correcto: todo importe es una cadena decimal y toda fila lleva una sola moneda', () => {
    const r = cuerpo<MoneyReport>(pedir());
    expect(r.items.length).toBeGreaterThan(0);
    for (const item of r.items) {
      expect(typeof item.amount).toBe('string');
      expect(item.amount).toMatch(/^\d+\.\d{2}$/);
      expect(item.currency).toMatch(/^[A-Z]{3}$/);
    }
    expect(new Set(r.items.map((i) => i.currency)).size).toBeGreaterThan(1);
  });

  it('todo dato sintético se declara SIMULADO', () => {
    const r = cuerpo<MoneyReport>(pedir());
    expect(r.items.every((i) => i.moduleLabel.includes('SIMULADO'))).toBe(true);
    expect(r.notMeasured.every((n) => n.reason.includes('SIMULADO'))).toBe(true);
  });

  it('lo no medido viene aparte con su razón y no aparece como fila con importe', () => {
    const r = cuerpo<MoneyReport>(pedir());
    expect(r.notMeasured.length).toBeGreaterThan(0);
    for (const n of r.notMeasured) {
      expect(n.reason.length).toBeGreaterThan(0);
      expect(r.items.some((i) => i.module === n.module)).toBe(false);
    }
  });

  it('límite: una ventana de siete días escala por suma de cadenas, sin perder centavos', () => {
    const dia = cuerpo<MoneyReport>(pedir(UN_DIA)).items.find((i) => i.module === 'billing' && i.kind === 'FACTURADO' && i.currency === 'BOB')!;
    const semana = cuerpo<MoneyReport>(pedir(UNA_SEMANA)).items.find((i) => i.module === 'billing' && i.kind === 'FACTURADO' && i.currency === 'BOB')!;
    expect(dia.amount).toBe('18450.50');
    expect(semana.amount).toBe('129153.50');
    expect(semana.operations).toBe(dia.operations * 7);
  });

  it('límite: la ventana se topa en 31 días', () => {
    const r = cuerpo<MoneyReport>(pedir({ from: '2026-01-01T00:00:00.000Z', to: '2026-10-01T00:00:00.000Z' }));
    const fila = r.items.find((i) => i.module === 'payments')!;
    expect(fila.amount).toBe('1395.00');
  });

  it('sin parámetros usa la ventana de hoy (de la medianoche UTC a ahora)', () => {
    const r = cuerpo<MoneyReport>(pedir({}));
    expect(new Date(r.window.from).getTime()).toBeLessThan(new Date(r.window.to).getTime());
  });

  it('inválido: from posterior a to es 422 VALIDATION_FAILED', () => {
    const r = pedir({ from: UN_DIA.to, to: UN_DIA.from });
    expect(estado(r)).toBe(422);
    expect((cuerpo<{ code: string }>(r)).code).toBe('VALIDATION_FAILED');
  });

  it('inválido: una fecha ilegible es 422', () => {
    expect(estado(pedir({ from: 'ayer', to: UN_DIA.to }))).toBe(422);
    expect(estado(pedir({ to: 'mañana' }))).toBe(422);
  });
});
