import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { herramientasSimuladas, registrarHerramientas } from './ops-tools.handlers';
import type { OpsTools } from '../../data-access/admin-portal/ops-tools.types';

describe('herramientas simuladas: mismo contrato que /admin/ops/tools', () => {
  const router = new MockRouter();
  registrarHerramientas(router);
  const admin = buscarUsuario('superadmin')!;

  function pedir(): OpsTools {
    const path = '/admin/ops/tools';
    const match = router.match('GET', path);
    if (match === null) throw new Error(`No existe GET ${path}`);
    const r = match.handler({ method: 'GET', path, params: match.params, query: new URLSearchParams(), body: null, headers: new HttpHeaders(), user: admin } satisfies MockRequest);
    expect(isMockReply(r)).toBe(false);
    return r as OpsTools;
  }

  it('responde el contrato v1 y el resumen cierra con la lista', () => {
    const r = pedir();
    expect(r.modelVersion).toBe('ops-tools/v1');
    const { total, healthy, down, noProbe, notApplicable, critical } = r.summary;
    expect(total).toBe(r.tools.length);
    expect(healthy + down + noProbe + notApplicable).toBe(total);
    expect(healthy).toBe(r.tools.filter((t) => t.isHealthy === true).length);
    expect(down).toBe(r.tools.filter((t) => t.isHealthy === false).length);
    expect(notApplicable).toBe(r.tools.filter((t) => t.isHealthy === null && t.checkType === 'NOT_APPLICABLE').length);
    expect(critical).toBe(r.tools.filter((t) => t.isCritical).length);
  });

  it('cubre los tres tipos de chequeo, caídas críticas, una lenta pero viva y variables faltantes', () => {
    const r = pedir();
    for (const tipo of ['LIVE', 'CONFIGURATION', 'NOT_APPLICABLE'] as const) {
      expect(r.tools.some((t) => t.checkType === tipo)).toBe(true);
    }
    expect(r.tools.some((t) => t.isHealthy === false && t.isCritical)).toBe(true);
    // Lenta no es caída: OpenSearch responde por encima del umbral y sigue operativa.
    expect(r.tools.some((t) => t.isHealthy === true && (t.latencyMs ?? 0) > 1000 && !t.isCritical)).toBe(true);
    expect(r.tools.some((t) => t.missingEnvVars.length > 0 && !t.isConfigured)).toBe(true);
    // Lo que no se chequea en vivo nunca lleva veredicto: ni verde ni rojo.
    expect(r.tools.filter((t) => t.checkType !== 'LIVE').every((t) => t.isHealthy === null)).toBe(true);
  });

  it('las fechas salen del reloj y está marcado como simulado', () => {
    const ahora = Date.UTC(2026, 9, 31, 12, 0, 0);
    const r = herramientasSimuladas(ahora);
    expect(r.evaluatedAt).toBe('2026-10-31T12:00:00.000Z');
    expect(r.tools.every((t) => t.healthMessage.startsWith('Simulado:'))).toBe(true);
    expect(r.tools.filter((t) => t.checkType === 'LIVE').every((t) => t.checkedAt !== null)).toBe(true);
  });
});
