import { HttpHeaders } from '@angular/common/http';

import type {
  PiiPage,
  PolicyDetail,
  PolicyPage,
} from '../../data-access/admin-portal/governance-policies.types';
import { MockRouter, isMockReply, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { registrarPoliticasGobierno } from './governance-policies.handlers';

describe('gobierno de datos simulado: mismas reglas que /admin/governance/*', () => {
  const router = new MockRouter();
  registrarPoliticasGobierno(router);
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

  it('todo dato sintético se declara SIMULADO o lleva el prefijo sim_/SIM-', () => {
    const page = cuerpo<PolicyPage>(pedir('/admin/governance/policies'));
    for (const p of page.items) expect(p.code.startsWith('SIM-')).toBe(true);
    for (const p of page.items.filter((x) => x.name)) expect(p.name).toContain('SIMULADO');
    const pii = cuerpo<PiiPage>(pedir('/admin/governance/pii-fields'));
    for (const f of pii.items) expect(f.schemaName.startsWith('sim_')).toBe(true);
  });

  it('correcto: ordena por tipo y código, y byType cubre los cinco tipos', () => {
    const page = cuerpo<PolicyPage>(pedir('/admin/governance/policies'));
    const keys = page.items.map((p) => `${p.type}|${p.code}`);
    expect(keys).toEqual([...keys].sort());
    expect(page.byType.map((t) => t.type)).toEqual([
      'WRITE',
      'RETENTION',
      'ANONYMIZATION',
      'CLASSIFICATION',
      'RESIDENCY',
    ]);
    expect(page.byType.reduce((n, t) => n + t.total, 0)).toBe(page.total);
    expect(page.items.every((p) => !('configuration' in p) && !('history' in p))).toBe(true);
  });

  it('límite: el filtro de tipo no cambia byType, y el cursor recorre sin repetir', () => {
    const filtrada = cuerpo<PolicyPage>(pedir('/admin/governance/policies', { type: 'WRITE' }));
    expect(filtrada.total).toBe(2);
    expect(filtrada.byType.find((t) => t.type === 'RETENTION')!.total).toBe(2);
    const a = cuerpo<PolicyPage>(pedir('/admin/governance/policies', { limit: '3' }));
    expect(a.nextCursor).not.toBeNull();
    const b = cuerpo<PolicyPage>(
      pedir('/admin/governance/policies', { limit: '3', cursor: a.nextCursor! }),
    );
    expect(b.items.some((x) => a.items.some((y) => y.id === x.id))).toBe(false);
  });

  it('inválido: tipo, límite, cursor o clave desconocidos son 400', () => {
    expect(estado(pedir('/admin/governance/policies', { type: 'OTRO' }))).toBe(400);
    expect(estado(pedir('/admin/governance/policies', { limit: '0' }))).toBe(400);
    expect(estado(pedir('/admin/governance/policies', { limit: '201' }))).toBe(400);
    expect(estado(pedir('/admin/governance/policies', { cursor: '-1' }))).toBe(400);
    expect(estado(pedir('/admin/governance/policies', { sql: 'x' }))).toBe(400);
  });

  it('el detalle trae destinos, historial y configuración con lo secreto oculto; un id ajeno es 404', () => {
    const lista = cuerpo<PolicyPage>(
      pedir('/admin/governance/policies', { type: 'ANONYMIZATION' }),
    );
    const detalle = cuerpo<PolicyDetail>(pedir(`/admin/governance/policies/${lista.items[0]!.id}`));
    expect(JSON.stringify(detalle.configuration)).toContain('[oculto]');
    expect(detalle.appliesTo[0]!.truncated).toBe(true);
    expect(estado(pedir('/admin/governance/policies/no-existe'))).toBe(404);
  });

  it('el inventario filtra por nivel y fuente, y su resumen sigue el filtro', () => {
    const todos = cuerpo<PiiPage>(pedir('/admin/governance/pii-fields'));
    expect(todos.summary.fields).toBe(todos.total);
    const nivel = cuerpo<PiiPage>(
      pedir('/admin/governance/pii-fields', { sensitivity: 'PERSONAL' }),
    );
    expect(nivel.items.every((f) => f.sensitivity === 'PERSONAL')).toBe(true);
    expect(nivel.summary.fields).toBe(nivel.total);
    const registro = cuerpo<PiiPage>(pedir('/admin/governance/pii-fields', { source: 'REGISTRY' }));
    expect(registro.items.every((f) => f.sensitivity === null && f.registry !== null)).toBe(true);
    const ninguno = cuerpo<PiiPage>(pedir('/admin/governance/pii-fields', { schema: 'no_existe' }));
    expect(ninguno.total).toBe(0);
    expect(ninguno.sources.catalogColumns).toBeGreaterThan(0);
  });

  it('inválido en el inventario: nivel, fuente y esquema con caracteres raros son 400', () => {
    expect(estado(pedir('/admin/governance/pii-fields', { sensitivity: 'PUBLIC' }))).toBe(400);
    expect(estado(pedir('/admin/governance/pii-fields', { source: 'X' }))).toBe(400);
    expect(estado(pedir('/admin/governance/pii-fields', { schema: 'a;b' }))).toBe(400);
  });
});
