import { HttpHeaders } from '@angular/common/http';

import type {
  ChangeLogPage,
  PiiColumnsPage,
  PiiReconciliationPage,
  PiiSummary,
  PolicyDetail,
  PolicyPage,
} from '../../data-access/admin-portal/governance-policies.types';
import { MockRouter, isMockReply, type MockRequest } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { registrarPoliticasGobierno } from './governance-policies.handlers';

describe('gobierno de datos simulado: mismas reglas que /admin/governance/* y /admin/catalog/pii/*', () => {
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

  const POLITICAS = '/admin/governance/policies';
  const COLUMNAS = '/admin/catalog/pii/columns';
  const CONCILIACION = '/admin/catalog/pii/reconciliation';

  it('todo dato sintético se declara SIMULADO o lleva el prefijo sim_/SIM-', () => {
    const page = cuerpo<PolicyPage>(pedir(POLITICAS));
    for (const p of page.items) expect(p.code.startsWith('SIM-')).toBe(true);
    for (const p of page.items.filter((x) => x.name)) expect(p.name).toContain('SIMULADO');
    const cols = cuerpo<PiiColumnsPage>(pedir(COLUMNAS));
    for (const c of cols.items) expect(c.schemaName.startsWith('sim_')).toBe(true);
  });

  it('correcto: la lista sigue la forma de la API (policyType, state, version) y no cuenta totales', () => {
    const page = cuerpo<PolicyPage>(pedir(POLITICAS));
    const codigos = page.items.map((p) => p.code);
    expect(codigos).toEqual([...codigos].sort());
    expect(page).toMatchObject({ sort: 'code', order: 'asc', limit: 50 });
    expect('total' in page).toBe(false);
    expect('byType' in page).toBe(false);
    const primera = page.items[0]! as unknown as Record<string, unknown>;
    expect(primera['policyType']).toBe('ANONYMIZATION');
    expect(typeof primera['version']).toBe('number');
    expect('settings' in primera).toBe(false);
    expect([...new Set(page.items.map((p) => p.policyType))].sort()).toEqual([
      'ANONYMIZATION',
      'RESIDENCY',
      'RETENTION',
      'WRITE',
    ]);
  });

  it('límite: filtra por tipo, ordena por fecha y el cursor recorre sin repetir', () => {
    const filtrada = cuerpo<PolicyPage>(pedir(POLITICAS, { type: 'WRITE' }));
    expect(filtrada.items.map((p) => p.policyType)).toEqual(['WRITE', 'WRITE']);
    const recientes = cuerpo<PolicyPage>(pedir(POLITICAS, { sort: 'updatedAt', order: 'desc' }));
    const fechas = recientes.items.map((p) => String(p.updatedAt));
    expect(fechas).toEqual([...fechas].sort().reverse());
    const a = cuerpo<PolicyPage>(pedir(POLITICAS, { limit: '2' }));
    expect(a.nextCursor).not.toBeNull();
    const b = cuerpo<PolicyPage>(pedir(POLITICAS, { limit: '2', cursor: a.nextCursor! }));
    expect(b.items.some((x) => a.items.some((y) => y.id === x.id))).toBe(false);
  });

  it('inválido: tipo, orden, límite, cursor o clave desconocidos son 400; un cursor de otro orden también', () => {
    expect(estado(pedir(POLITICAS, { type: 'CLASSIFICATION' }))).toBe(400);
    expect(estado(pedir(POLITICAS, { sort: 'name' }))).toBe(400);
    expect(estado(pedir(POLITICAS, { order: 'up' }))).toBe(400);
    expect(estado(pedir(POLITICAS, { limit: '0' }))).toBe(400);
    expect(estado(pedir(POLITICAS, { limit: '201' }))).toBe(400);
    expect(estado(pedir(POLITICAS, { cursor: 'x|-1' }))).toBe(400);
    expect(estado(pedir(POLITICAS, { sql: 'x' }))).toBe(400);
    const a = cuerpo<PolicyPage>(pedir(POLITICAS, { limit: '2' }));
    expect(estado(pedir(POLITICAS, { sort: 'updatedAt', cursor: a.nextCursor! }))).toBe(400);
  });

  it('el detalle trae ajustes y destinos; de una anonimización sólo los NOMBRES de los parámetros', () => {
    const lista = cuerpo<PolicyPage>(pedir(POLITICAS, { type: 'ANONYMIZATION' }));
    const id = lista.items[0]!.id;
    const detalle = cuerpo<PolicyDetail>(pedir(`${POLITICAS}/ANONYMIZATION/${id}`));
    expect(detalle.settings['parameterKeys']).toEqual(['algorithm', 'keepLast', 'salt']);
    expect(JSON.stringify(detalle)).not.toContain('[oculto]');
    expect(detalle.appliedTo.truncated).toBe(true);
    expect(detalle.appliedTo.total).toBeGreaterThan(detalle.appliedTo.items.length);
    expect('history' in detalle).toBe(false);
  });

  it('un id que existe en otro tipo, uno inexistente o uno mal formado no devuelven la política equivocada', () => {
    const lista = cuerpo<PolicyPage>(pedir(POLITICAS, { type: 'WRITE' }));
    const id = lista.items[0]!.id;
    expect(estado(pedir(`${POLITICAS}/RETENTION/${id}`))).toBe(404);
    expect(estado(pedir(`${POLITICAS}/WRITE/00000000-0000-4000-8000-0000000000ff`))).toBe(404);
    expect(estado(pedir(`${POLITICAS}/WRITE/no-es-uuid`))).toBe(400);
    expect(estado(pedir(`${POLITICAS}/OTRO/${id}`))).toBe(400);
  });

  it('la bitácora filtra por objeto, trae la acción como código y sin rango mira 30 días', () => {
    const lista = cuerpo<PolicyPage>(pedir(POLITICAS, { type: 'WRITE' }));
    const id = lista.items[0]!.id;
    const todo = cuerpo<ChangeLogPage>(
      pedir('/admin/governance/change-log', { targetId: id, from: '2026-01-01T00:00:00.000Z' }),
    );
    expect(todo.items.length).toBe(2);
    expect(todo.items.every((c) => c.targetId === id)).toBe(true);
    expect(todo.items[0]!.action).toBe('UPDATED');
    expect(todo.order).toBe('recorded_at desc, id desc');
    // Desde el «ahora» fijo de la maqueta (31/10/2026), 30 días no alcanzan al alta del 1/9.
    const reciente = cuerpo<ChangeLogPage>(pedir('/admin/governance/change-log', { targetId: id }));
    expect(reciente.items.map((c) => c.action)).toEqual(['UPDATED']);
  });

  it('inválido en la bitácora: uuid, fecha y ventana invertida son 400', () => {
    const bitacora = '/admin/governance/change-log';
    expect(estado(pedir(bitacora, { targetId: 'x' }))).toBe(400);
    expect(estado(pedir(bitacora, { from: 'ayer' }))).toBe(400);
    expect(
      estado(pedir(bitacora, { from: '2026-10-02T00:00:00Z', to: '2026-10-01T00:00:00Z' })),
    ).toBe(400);
    expect(estado(pedir(bitacora, { sql: 'x' }))).toBe(400);
  });

  it('las columnas personales parten de PERSONAL, filtran por nivel y ordenan por sensibilidad', () => {
    const todas = cuerpo<PiiColumnsPage>(pedir(COLUMNAS));
    expect(todas.sort).toBe('name');
    const nombres = todas.items.map((c) => `${c.schemaName}.${c.objectName}.${c.columnName}`);
    expect(nombres).toEqual([...nombres].sort());
    const alto = cuerpo<PiiColumnsPage>(pedir(COLUMNAS, { minSensitivity: 'PHI_IDENTIFIER' }));
    expect(alto.items.map((c) => c.sensitivity).sort()).toEqual([
      'CREDENTIAL',
      'PHI_IDENTIFIER',
      'PHI_SENSITIVE',
      'PHI_SPECIAL',
    ]);
    // La escala va de menos a más sensible: desde PHI_SENSITIVE ya no entra PHI_IDENTIFIER.
    const masAlto = cuerpo<PiiColumnsPage>(pedir(COLUMNAS, { minSensitivity: 'PHI_SENSITIVE' }));
    expect(masAlto.items.map((c) => c.sensitivity).sort()).toEqual([
      'CREDENTIAL',
      'PHI_SENSITIVE',
      'PHI_SPECIAL',
    ]);
    const porNivel = cuerpo<PiiColumnsPage>(pedir(COLUMNAS, { sort: 'sensitivity' }));
    expect(porNivel.items[0]!.sensitivity).toBe('CREDENTIAL');
    const pendientes = cuerpo<PiiColumnsPage>(pedir(COLUMNAS, { reviewStatus: 'NEEDS_REVIEW' }));
    expect(pendientes.items.map((c) => c.columnName)).toEqual(['telefono']);
    const ninguna = cuerpo<PiiColumnsPage>(pedir(COLUMNAS, { schema: 'no_existe' }));
    expect(ninguna.items).toEqual([]);
  });

  it('inválido en las columnas: nivel, estado, orden y esquema con caracteres raros son 400', () => {
    expect(estado(pedir(COLUMNAS, { minSensitivity: 'PUBLIC' }))).toBe(400);
    expect(estado(pedir(COLUMNAS, { sensitivity: 'X' }))).toBe(400);
    expect(estado(pedir(COLUMNAS, { reviewStatus: 'X' }))).toBe(400);
    expect(estado(pedir(COLUMNAS, { sort: 'otro' }))).toBe(400);
    expect(estado(pedir(COLUMNAS, { schema: 'a;b' }))).toBe(400);
  });

  it('el resumen cuenta por nivel, trae el registro declarado y declara que no lee valores', () => {
    const resumen = cuerpo<PiiSummary>(pedir('/admin/catalog/pii/summary'));
    expect(resumen.personalColumns).toBe(8);
    expect(resumen.classifiedColumns).toBeGreaterThanOrEqual(resumen.personalColumns);
    expect(resumen.bySensitivity.reduce((n, l) => n + l.columns, 0)).toBe(resumen.personalColumns);
    expect(resumen.declaredRegistry.fields).toBe(3);
    expect(resumen.notMeasured.map((n) => n.field)).toContain('dataValues');
  });

  it('la conciliación separa las tres clases y su resumen ignora el filtro de clase', () => {
    const todas = cuerpo<PiiReconciliationPage>(pedir(CONCILIACION));
    expect(todas.summary.byKind).toEqual({
      MISSING_IN_REGISTRY: 1,
      REGISTRY_DISAGREES: 1,
      ORPHAN_IN_REGISTRY: 1,
    });
    expect(todas.summary.total).toBe(3);
    const faltantes = cuerpo<PiiReconciliationPage>(
      pedir(CONCILIACION, { kind: 'ORPHAN_IN_REGISTRY' }),
    );
    expect(faltantes.items).toHaveLength(1);
    expect(faltantes.items[0]).toMatchObject({ objectId: null, sensitivity: null });
    expect(faltantes.summary.total).toBe(3);
    expect(estado(pedir(CONCILIACION, { kind: 'OTRA' }))).toBe(400);
  });
});
