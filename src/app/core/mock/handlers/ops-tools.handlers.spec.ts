import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { registrarHerramientas } from './ops-tools.handlers';
import type { OpsToolsOverview } from '../../data-access/admin-portal/ops-tools.types';

describe('herramientas demo: mismo contrato que /admin/ops/tools', () => {
  const router = new MockRouter();
  registrarHerramientas(router);
  const admin = buscarUsuario('superadmin')!;

  function pedir(): OpsToolsOverview {
    const match = router.match('GET', '/admin/ops/tools');
    if (match === null) throw new Error('No existe GET /admin/ops/tools');
    const r = match.handler({
      method: 'GET',
      path: '/admin/ops/tools',
      params: match.params,
      query: new URLSearchParams(),
      body: null,
      headers: new HttpHeaders(),
      user: admin,
    } satisfies MockRequest);
    return (isMockReply(r) ? r.body : r) as OpsToolsOverview;
  }

  it('trae críticas y no críticas, y los tres estados de salud con su tipo de comprobación', () => {
    const { items } = pedir();
    expect(items.some((t) => t.isCritical)).toBe(true);
    expect(items.some((t) => !t.isCritical)).toBe(true);
    expect(new Set(items.map((t) => t.health.state))).toEqual(
      new Set(['OK', 'FAIL', 'NOT_PROBED']),
    );
    expect(new Set(items.map((t) => t.health.checkType))).toEqual(
      new Set(['LIVE', 'CONFIGURATION', 'NOT_APPLICABLE']),
    );
    expect(new Set(items.map((t) => t.status))).toEqual(
      new Set(['ACTIVE', 'PLANNED', 'DEPRECATED', 'DISABLED']),
    );
  });

  it('una herramienta sin sondear no trae fecha de observación y una sondeada sí', () => {
    for (const t of pedir().items) {
      expect(t.health.observedAt === null).toBe(t.health.state === 'NOT_PROBED');
    }
  });

  it('faltan variables sólo cuando falla, y siempre son nombres declarados como requeridos', () => {
    for (const t of pedir().items) {
      if (t.health.missingEnvVars.length > 0) {
        expect(t.health.state).toBe('FAIL');
        expect(t.health.missingEnvVars.every((v) => t.requiredEnvVars.includes(v))).toBe(true);
      }
    }
  });

  it('nunca trae un valor de variable: sólo nombres en MAYÚSCULAS', () => {
    const nombres = pedir().items.flatMap((t) => [
      ...t.requiredEnvVars,
      ...t.health.missingEnvVars,
    ]);
    expect(nombres.length).toBeGreaterThan(0);
    expect(nombres.every((n) => /^[A-Z][A-Z0-9_]*$/.test(n))).toBe(true);
  });
});
