import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { registrarSondaDeVida, sondaDeVidaSimulada } from './ops-liveness.handlers';
import type { InstanceLiveness } from '../../data-access/admin-portal/ops-liveness.types';

describe('sonda de vida simulada: mismo contrato que /admin/ops/instances/liveness', () => {
  const router = new MockRouter();
  registrarSondaDeVida(router);
  const admin = buscarUsuario('superadmin')!;

  function pedir(): InstanceLiveness {
    const path = '/admin/ops/instances/liveness';
    const match = router.match('GET', path);
    if (match === null) throw new Error(`No existe GET ${path}`);
    const r = match.handler({ method: 'GET', path, params: match.params, query: new URLSearchParams(), body: null, headers: new HttpHeaders(), user: admin } satisfies MockRequest);
    expect(isMockReply(r)).toBe(false);
    return r as InstanceLiveness;
  }

  it('responde el contrato v1 con los cuatro estados y el total que cierra', () => {
    const r = pedir();
    expect(r.modelVersion).toBe('instance-liveness/v1');
    expect(r.heartbeatStore).toEqual({ status: 'up', reason: null });
    const { VIVA, DEGRADADA, CAIDA, SIN_DATO, total } = r.summary;
    expect(VIVA + DEGRADADA + CAIDA + SIN_DATO).toBe(total);
    expect(total).toBe(r.instances.length);
    for (const estado of ['VIVA', 'DEGRADADA', 'CAIDA', 'SIN_DATO'] as const) {
      expect(r.instances.some((i) => i.state === estado)).toBe(true);
    }
  });

  it('con una obligatoria caída el veredicto es CRÍTICO', () => {
    const r = pedir();
    expect(r.instances.some((i) => i.required && i.state === 'CAIDA')).toBe(true);
    expect(r.overall).toBe('CRITICO');
  });

  it('las fechas salen del reloj y la edad coincide con el último latido', () => {
    const ahora = Date.UTC(2026, 9, 31, 12, 0, 0);
    const r = sondaDeVidaSimulada(ahora);
    expect(r.evaluatedAt).toBe('2026-10-31T12:00:00.000Z');
    for (const i of r.instances) {
      if (i.ageSeconds === null) {
        expect(i.lastHeartbeatAt).toBeNull();
      } else {
        expect(new Date(i.lastHeartbeatAt!).getTime()).toBe(ahora - i.ageSeconds * 1000);
      }
    }
  });

  it('está marcado como simulado y declara lo que no mide', () => {
    const r = pedir();
    expect(r.instances.every((i) => i.causeDetail.startsWith('Simulado:'))).toBe(true);
    expect(r.notMeasured).toContain('replicasOfApi');
  });
});
