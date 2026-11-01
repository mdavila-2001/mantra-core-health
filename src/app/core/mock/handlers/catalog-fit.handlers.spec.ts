import { HttpHeaders } from '@angular/common/http';

import type { CatalogFit, FitRunAccepted } from '../../data-access/admin-portal/catalog-fit.types';
import { MockRouter, isMockReply, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { puntuar, registrarSondaCatalogo, veredicto } from './catalog-fit.handlers';

describe('sonda de ajuste simulada: mismo contrato que /admin/catalog/fit', () => {
  const admin = buscarUsuario('superadmin')!;
  const paciente = buscarUsuario('paciente')!;
  let ahora = Date.UTC(2026, 9, 31, 12, 0, 0);

  function montar() {
    const router = new MockRouter();
    registrarSondaCatalogo(router, () => ahora);
    function pedir(
      method: MockMethod,
      path: string,
      opciones: { clave?: string; user?: typeof admin | null } = {},
    ) {
      const match = router.match(method, path);
      if (match === null) throw new Error(`No existe ${method} ${path}`);
      const headers = new HttpHeaders(
        opciones.clave === undefined ? {} : { 'Idempotency-Key': opciones.clave },
      );
      return match.handler({
        method,
        path,
        params: match.params,
        query: new URLSearchParams(),
        body: {},
        headers,
        user: opciones.user === undefined ? admin : opciones.user,
      });
    }
    const leer = (opciones?: { user?: typeof admin | null }): CatalogFit =>
      pedir('GET', '/admin/catalog/fit', opciones) as CatalogFit;
    const correr = (clave?: string, user?: typeof admin | null): MockReply =>
      pedir('POST', '/admin/catalog/fit/run', {
        ...(clave === undefined ? {} : { clave }),
        ...(user === undefined ? {} : { user }),
      }) as MockReply;
    return { leer, correr };
  }

  beforeEach(() => {
    ahora = Date.UTC(2026, 9, 31, 12, 0, 0);
  });

  it('responde un resultado vigente con las seis dimensiones y 23 comprobaciones de id estable', () => {
    const { leer } = montar();
    const r = leer();
    expect(r.modelVersion).toBe('catalog-fit/v1');
    expect(r.state).toBe('VIGENTE');
    expect(r.report?.dimensions.map((d) => d.dimension)).toEqual([
      'ROUTES',
      'MODEL',
      'COMPLETENESS',
      'FRESHNESS',
      'MUTABILITY',
      'SENSITIVITY',
    ]);
    const ids = r.report!.checks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^FIT-[A-Z]{3}-\d{3}$/);
    expect(r.retention.kind).toBe('MEMORIA_DEL_PROCESO');
  });

  it('cubre los cinco estados de una comprobación y un veredicto DESAJUSTADA', () => {
    const r = montar().leer().report!;
    for (const estado of ['OK', 'FALLA', 'SIN_DATO', 'NO_DECLARADO', 'NO_APLICA'] as const)
      expect(
        r.checks.some((c) => c.status === estado),
        estado,
      ).toBe(true);
    expect(r.verdict).toBe('DESAJUSTADA');
    expect([...r.blindSpots].sort()).toEqual(
      r.checks
        .filter((c) => c.status === 'SIN_DATO' || c.status === 'NO_DECLARADO')
        .map((c) => c.id)
        .sort(),
    );
  });

  it('null no es cero: lo que no se midió no tiene ni cubiertos, ni base, ni porcentaje', () => {
    const r = montar().leer().report!;
    for (const c of r.checks.filter((c) => c.status !== 'OK' && c.status !== 'FALLA')) {
      expect([c.covered, c.denominator]).toEqual([null, null]);
      expect(c.reason).toBeTruthy();
    }
    const mut = r.dimensions.find((d) => d.dimension === 'MUTABILITY')!;
    expect(mut).toMatchObject({
      status: 'NO_DECLARADO',
      covered: null,
      denominator: null,
      ratio: null,
    });
  });

  it('el ratio de cada dimensión sale de su numerador y denominador', () => {
    for (const d of montar().leer().report!.dimensions) {
      if (d.status !== 'MEDIDA') continue;
      expect(d.ratio).toBe(Math.round((d.covered! / d.denominator!) * 10_000) / 10_000);
    }
  });

  it('está marcado como simulado: cada hallazgo y cada razón empiezan por «Simulado:»', () => {
    const r = montar().leer().report!;
    for (const c of r.checks) {
      for (const f of c.findings) expect(f.detail, c.id).toMatch(/^Simulado:/);
      if (c.reason) expect(c.reason, c.id).toMatch(/^Simulado:/);
    }
  });

  it('sin sesión es 401 y sin rol de lectura 403, en las dos rutas', () => {
    const { leer, correr } = montar();
    expect((leer({ user: null }) as unknown as MockReply).status).toBe(401);
    expect((leer({ user: paciente }) as unknown as MockReply).status).toBe(403);
    expect(correr('clave-valida-1', null).status).toBe(401);
    expect(correr('clave-valida-1', paciente).status).toBe(403);
  });

  it('pedir una corrida exige Idempotency-Key válida (422) y responde 202 con la corrida EN_CURSO', () => {
    const { correr } = montar();
    expect(correr().status).toBe(422);
    expect(correr('corta').status).toBe(422);
    const r = correr('clave-valida-1');
    expect(r.status).toBe(202);
    const cuerpo = r.body as FitRunAccepted;
    expect(cuerpo).toMatchObject({
      status: 'EN_CURSO',
      created: true,
      statusUrl: '/admin/catalog/fit',
    });
  });

  it('idempotente: la misma clave, o una corrida en vuelo, devuelven la misma corrida con created=false', () => {
    const { correr } = montar();
    const a = correr('clave-valida-1').body as FitRunAccepted;
    const b = correr('clave-valida-1').body as FitRunAccepted;
    const c = correr('otra-clave-22').body as FitRunAccepted;
    expect(b).toMatchObject({ runId: a.runId, created: false });
    expect(c).toMatchObject({ runId: a.runId, created: false });
  });

  it('la corrida termina pasada su duración: informe nuevo y una línea más en el historial', () => {
    const { correr, leer } = montar();
    const antes = leer();
    const aceptada = correr('clave-valida-1').body as FitRunAccepted;
    expect(leer().running?.runId).toBe(aceptada.runId);
    ahora += 5_000;
    const despues = leer();
    expect(despues.running).toBeNull();
    expect(despues.lastRun).toMatchObject({
      runId: aceptada.runId,
      status: 'COMPLETADA',
      trigger: 'MANUAL',
    });
    expect(despues.history).toHaveLength(antes.history.length + 1);
    expect(despues.report?.evaluatedAt).toBe(new Date(ahora).toISOString());
    // y con la corrida ya terminada, la misma clave devuelve esa corrida, no crea otra
    expect((correr('clave-valida-1').body as FitRunAccepted).runId).toBe(aceptada.runId);
  });

  it('S7: con el tiempo el resultado se sirve ATRASADO con su antigüedad; pasado el TTL, EXPIRADO sin informe', () => {
    const { leer } = montar();
    ahora += 20 * 60_000;
    expect(leer()).toMatchObject({ state: 'ATRASADO', noResultReason: null });
    expect(leer().ageSeconds).toBeGreaterThan(900);
    ahora += 25 * 3_600_000;
    expect(leer()).toMatchObject({
      state: 'SIN_RESULTADO',
      noResultReason: 'EXPIRADO',
      report: null,
      ageSeconds: null,
    });
  });
});

describe('puntaje y veredicto del simulador: las mismas reglas que la API', () => {
  const check = (over: object) =>
    ({
      id: 'FIT-TST-001',
      dimension: 'ROUTES',
      title: 't',
      severity: 'ALTA',
      status: 'OK',
      covered: 1,
      denominator: 1,
      summary: '',
      reason: null,
      remediation: '',
      evidence: {},
      findings: [],
      findingsTotal: 0,
      findingsTruncated: false,
      ...over,
    }) as never;

  it('sin nada medido no hay porcentaje', () => {
    expect(
      puntuar('ROUTES', [check({ status: 'SIN_DATO', covered: null, denominator: null })]),
    ).toMatchObject({ status: 'SIN_DATO', ratio: null, covered: null });
    expect(puntuar('FRESHNESS', [check({})])).toMatchObject({ status: 'NO_APLICA', ratio: null });
  });

  it('una falla ALTA desajusta; no saber una ALTA impide declararla ajustada; sin medir, SIN_DATOS', () => {
    expect(veredicto([check({ status: 'FALLA', covered: 0 })])).toBe('DESAJUSTADA');
    expect(
      veredicto([check({}), check({ status: 'SIN_DATO', covered: null, denominator: null })]),
    ).toBe('CON_AVISOS');
    expect(veredicto([check({})])).toBe('AJUSTADA');
    expect(veredicto([])).toBe('SIN_DATOS');
  });
});

describe('isMockReply', () => {
  it('las respuestas con estado explícito son MockReply (el 202 no se confunde con un cuerpo)', () => {
    expect(isMockReply({ status: 202, body: {} })).toBe(true);
  });
});
