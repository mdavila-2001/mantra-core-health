import { HttpHeaders } from '@angular/common/http';

import { MockRouter, isMockReply, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { registrarMutabilidad } from './mutability.handlers';
import type {
  MutabilityDetail,
  MutabilityPage,
  MutabilitySummary,
} from '../../data-access/admin-portal/mutability.types';

describe('mutabilidad demo (SIMULADA): mismas reglas que /admin/governance/mutability', () => {
  const router = new MockRouter();
  registrarMutabilidad(router);
  const admin = buscarUsuario('superadmin')!;

  function pedir(path: string, query: Record<string, string> = {}, user = admin) {
    const match = router.match('GET', path);
    if (match === null) throw new Error(`No existe GET ${path}`);
    return match.handler({
      method: 'GET',
      path,
      params: match.params,
      query: new URLSearchParams(query),
      body: null,
      headers: new HttpHeaders(),
      user,
    } satisfies MockRequest);
  }
  const estado = (r: unknown) => (isMockReply(r) ? r.status : 200);
  const cuerpo = <T>(r: unknown) => (isMockReply(r) ? r.body : r) as T;
  const LISTA = '/admin/governance/mutability';

  it('lista paginada con total del filtro entero y cursor opaco', () => {
    const primera = cuerpo<MutabilityPage>(pedir(LISTA, { limit: '5' }));
    expect(primera.items).toHaveLength(5);
    expect(primera.total).toBeGreaterThan(5);
    expect(primera.nextCursor).not.toBeNull();
    const segunda = cuerpo<MutabilityPage>(
      pedir(LISTA, { limit: '5', cursor: primera.nextCursor! }),
    );
    expect(segunda.items[0]).not.toEqual(primera.items[4]);
    const claves = [...primera.items, ...segunda.items].map((i) => `${i.schema}.${i.table}`);
    expect([...claves].sort()).toEqual(claves);
  });

  it('filtra por modo, nivel de evidencia y hallazgo', () => {
    const base = cuerpo<MutabilityPage>(pedir(LISTA, { writeMode: 'APPEND_ONLY' }));
    expect(base.items.length).toBeGreaterThan(0);
    expect(base.items.every((i) => i.writeMode === 'APPEND_ONLY')).toBe(true);
    const duro = cuerpo<MutabilityPage>(pedir(LISTA, { evidence: 'ENFORCED_DB' }));
    expect(duro.items.every((i) => i.writeModeLevel === 'ENFORCED_DB')).toBe(true);
    const contradicciones = cuerpo<MutabilityPage>(pedir(LISTA, { finding: 'CONTRADICTION' }));
    expect(contradicciones.items.length).toBeGreaterThan(0);
    expect(contradicciones.items.every((i) => i.contradictions > 0)).toBe(true);
    const ninguna = cuerpo<MutabilityPage>(pedir(LISTA, { finding: 'NONE' }));
    expect(ninguna.items.every((i) => i.contradictions + i.gaps === 0)).toBe(true);
  });

  it('un filtro desconocido, fuera de catálogo o un límite fuera de rango son 400', () => {
    const consultas: Record<string, string>[] = [
      { rol: 'x' },
      { writeMode: 'BORRABLE' },
      { schema: 'a;b' },
      { limit: '0' },
      { limit: '999' },
      { cursor: '-1' },
    ];
    for (const q of consultas) expect(estado(pedir(LISTA, q))).toBe(400);
  });

  it('un rol sin lectura recibe 403 en las tres rutas', () => {
    const user = buscarUsuario('paciente')!;
    expect(estado(pedir(LISTA, {}, user))).toBe(403);
    expect(estado(pedir(`${LISTA}/summary`, {}, user))).toBe(403);
    expect(estado(pedir(`${LISTA}/sim/bitacora_inmutable`, {}, user))).toBe(403);
  });

  it('el resumen suma el total por modo y por nivel, con denominador', () => {
    const s = cuerpo<MutabilitySummary>(pedir(`${LISTA}/summary`));
    expect(s.byWriteMode.reduce((n, m) => n + m.numerator, 0)).toBe(s.totalTables);
    expect(s.byEvidence.reduce((n, m) => n + m.numerator, 0)).toBe(s.totalTables);
    expect(s.byWriteMode.every((m) => m.denominator === s.totalTables)).toBe(true);
    const unknown = s.byWriteMode.find((m) => m.writeMode === 'UNKNOWN')!;
    expect(s.decided.numerator).toBe(s.totalTables - unknown.numerator);
    expect(s.generatedFrom.modelRoot).toBe('SIMULADO');
  });

  it('una contradicción conserva las dos evidencias y no cambia el modo declarado', () => {
    const d = cuerpo<MutabilityDetail>(pedir(`${LISTA}/sim/firmas_de_nota`));
    const c = d.findings.find((f) => f.kind === 'CONTRADICTION')!;
    expect(c.a.source).toBeTruthy();
    expect(c.b?.source).toBeTruthy();
    expect(d.writeMode).toBe('APPEND_ONLY');
    expect(d.writeModeLevel).toBe('DECLARED_MODEL');
  });

  it('sin evidencia es UNKNOWN con nivel UNKNOWN; el plazo sólo existe con fuente y queda pendiente', () => {
    const d = cuerpo<MutabilityDetail>(pedir(`${LISTA}/sim/otra_sin_evidencia`));
    expect(d.writeMode).toBe('UNKNOWN');
    expect(d.writeModeLevel).toBe('UNKNOWN');
    expect(d.retention).toBeNull();
    const lista = cuerpo<MutabilityPage>(pedir(LISTA, { limit: '200' }));
    for (const i of lista.items.filter((x) => x.retention)) {
      expect(i.retention!.status).toBe('PENDIENTE_DE_CUMPLIMIENTO');
      if (i.retention!.days !== null) expect(i.retention!.source).toBeTruthy();
    }
  });

  it('una tabla que no está en el catálogo es 404', () => {
    expect(estado(pedir(`${LISTA}/sim/no_existe`))).toBe(404);
  });
});
