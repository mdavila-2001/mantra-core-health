import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { estadoGeneral, registrarVidaDeInstancias, vidaSimulada } from './ops-liveness.handlers';
import type {
  InstancesLiveness,
  LivenessState,
} from '../../data-access/admin-portal/ops-liveness.types';

describe('sonda de vida demo: mismas reglas que /admin/ops/instances/liveness', () => {
  const router = new MockRouter();
  registrarVidaDeInstancias(router);
  const admin = buscarUsuario('superadmin')!;

  function pedir(): InstancesLiveness {
    const match = router.match('GET', '/admin/ops/instances/liveness');
    if (match === null) throw new Error('No existe GET /admin/ops/instances/liveness');
    const r = match.handler({
      method: 'GET',
      path: '/admin/ops/instances/liveness',
      params: match.params,
      query: new URLSearchParams(),
      body: null,
      headers: new HttpHeaders(),
      user: admin,
    } satisfies MockRequest);
    return (isMockReply(r) ? r.body : r) as InstancesLiveness;
  }

  it('cubre los cuatro estados y cada dato sintético se declara como simulado', () => {
    const vida = pedir();
    const estados = new Set(vida.instances.map((i) => i.state));
    expect([...estados].sort()).toEqual(['CAIDA', 'DEGRADADA', 'SIN_DATO', 'VIVA']);
    expect(vida.instances.every((i) => i.evidence.startsWith('SIMULADO'))).toBe(true);
    expect(vida.notMeasured.length).toBeGreaterThan(0);
  });

  it('el estado de un worker sale de su edad y de los umbrales declarados', () => {
    const vida = vidaSimulada(new Date('2026-10-30T12:00:00.000Z'));
    const { liveSeconds, degradedSeconds } = vida.thresholds;
    for (const i of vida.instances.filter((x) => x.type === 'worker')) {
      if (i.ageSeconds === null) {
        // Sin latido: nunca VIVA ni CAIDA.
        expect(i.state).toBe('SIN_DATO');
        expect(i.lastHeartbeatAt).toBeNull();
        expect(i.cause).toBe('NEVER_SEEN');
      } else {
        expect(i.state).toBe(
          i.ageSeconds <= liveSeconds
            ? 'VIVA'
            : i.ageSeconds <= degradedSeconds
              ? 'DEGRADADA'
              : 'CAIDA',
        );
        expect(new Date(vida.evaluatedAt).getTime() - new Date(i.lastHeartbeatAt!).getTime()).toBe(
          i.ageSeconds * 1000,
        );
      }
    }
  });

  it('el estado general sale de las requeridas: con una caída es CAIDA y la opcional sin dato no pesa', () => {
    const vida = pedir();
    expect(vida.overall).toBe('CAIDA');
    expect(vida.overall).toBe(estadoGeneral(vida.instances));
    const opcional = vida.instances.find((i) => !i.required)!;
    expect(opcional.state).toBe('SIN_DATO');
    expect(estadoGeneral(vida.instances.filter((i) => i.state === 'VIVA' || !i.required))).toBe(
      'VIVA',
    );
  });

  describe('estadoGeneral (nunca VIVA sin evidencia)', () => {
    const req = (state: LivenessState) => ({ required: true, state });
    it.each([
      [[req('VIVA'), req('VIVA')], 'VIVA'],
      [[req('VIVA'), req('DEGRADADA')], 'DEGRADADA'],
      [[req('VIVA'), req('CAIDA'), req('DEGRADADA')], 'CAIDA'],
      [[req('SIN_DATO'), req('SIN_DATO')], 'SIN_DATO'],
      [[req('VIVA'), req('SIN_DATO')], 'DEGRADADA'],
      // Límite: ninguna requerida (o lista vacía) no es VIVA, es no saber.
      [[], 'SIN_DATO'],
      [[{ required: false, state: 'VIVA' as LivenessState }], 'SIN_DATO'],
    ] as const)('%j → %s', (instancias, esperado) => {
      expect(estadoGeneral(instancias)).toBe(esperado);
    });
  });
});
