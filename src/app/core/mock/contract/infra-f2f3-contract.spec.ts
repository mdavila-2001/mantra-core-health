import { HttpHeaders } from '@angular/common/http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { BedBoard, BedBoardCell, CleaningOrder, CleaningOrderPage } from '../../data-access/infrastructure-ops/infrastructure-ops.types';
import { SITIOS_INFRA } from '../fixtures/infraestructura';
import { shiftDate, siteDate } from '../fixtures/inpatient';
import { registerAdt } from '../handlers/adt.handlers';
import { registrarInfraestructura } from '../handlers/infrastructure.handlers';
import { registerInfrastructureOps } from '../handlers/infrastructure-ops.handlers';
import { registrarProcedimientos } from '../handlers/procedures.handlers';
import { isMockReply, MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario, TENANT_HOSPITAL, type MockUser } from '../mock-session';
import { uuid } from '../mock-store';
import { INFRA_OPERATIONS, INFRA_SCHEMAS } from './infra-f2f3-contract.generated';

/* ============================================================================
    Prueba de contrato F2/F3: la maqueta **imita a la API**, no al revés.

    Contra `openapi.json` de `mantra-core-health-api` (generado en
    `infra-f2f3-contract.generated.ts` por `scripts/gen-infra-contract.mjs`):

    1. cada ruta que llaman los clientes de F2/F3 existe en la API con ese
       método;
    2. cada respuesta de la maqueta tiene **exactamente** las claves del DTO
       (ni una de más, ninguna obligatoria de menos), recursivo en objetos y
       arreglos anidados;
    3. cada cuerpo que manda la web cabe en el DTO de la API
       (`forbidNonWhitelisted`) con sus obligatorias;
    4. las lecturas que el `openapi.json` no tipa (estancia, censo,
       indicadores, compatibilidad con encuentro, revisión) se fijan contra la
       forma del use case de la API, citada en cada caso.

    Los tipos de `core/data-access` los compara `infra-f2f3-types.check.ts`
    en `yarn typecheck`.
    ========================================================================== */

const router = new MockRouter();
registrarProcedimientos(router);
registrarInfraestructura(router);
registerInfrastructureOps(router);
registerAdt(router);
const SITIO = SITIOS_INFRA[0]!.id;
const u = (k: string): MockUser => buscarUsuario(k)!;
const enfermeria = u('enfermeria');
const supervision = u('supervision');
const limpieza = u('limpieza');
const supervisoraLimpieza = u('supervisora.limpieza@alovida.mock');
const admision = u('admision');
const patientId = (clave: string) => uuid(`pid-${clave}`);

interface Llamada {
  readonly body?: unknown;
  readonly ifMatch?: number;
  readonly ifMatchOps?: number;
  readonly usuario?: MockUser;
  readonly query?: string;
}

/** Lo que la web mandó en cada operación, para comparar con el DTO del cuerpo. */
const enviados: { method: string; pattern: string; body: unknown }[] = [];

function call(method: MockMethod, path: string, o: Llamada = {}): { status: number; body: unknown } {
  const match = router.match(method, path);
  if (match === null) throw new Error(`No existe ${method} ${path}`);
  let headers = new HttpHeaders().set('X-Tenant-Id', TENANT_HOSPITAL);
  if (o.ifMatch !== undefined) headers = headers.set('If-Match', String(o.ifMatch));
  if (o.ifMatchOps !== undefined) headers = headers.set('If-Match-Ops', String(o.ifMatchOps));
  if (o.body !== undefined) enviados.push({ method, pattern: path, body: o.body });
  const r = match.handler({ method, path, params: match.params, query: new URLSearchParams(o.query ?? ''), body: o.body ?? null, headers, user: o.usuario ?? enfermeria });
  return isMockReply(r) ? (r as MockReply) : { status: 200, body: r };
}

/** La operación del contrato que corresponde a una ruta concreta. */
function operationOf(method: string, path: string) {
  const seg = path.split('?')[0]!.split('/').filter(Boolean);
  return INFRA_OPERATIONS.find((op) => {
    if (op.method !== method) return false;
    const p = op.path.split('/').filter(Boolean);
    return p.length === seg.length && p.every((x, i) => x.startsWith(':') || x === seg[i]);
  });
}

/** Diferencias de `value` contra el esquema: claves de más y obligatorias que faltan, recursivo. */
function diff(value: unknown, schema: string, where: string): string[] {
  const s = INFRA_SCHEMAS[schema];
  if (s === undefined) return [`${where}: el esquema ${schema} no está en el contrato`];
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return [`${where}: se esperaba un objeto ${schema}`];
  const v = value as Record<string, unknown>;
  const out: string[] = [];
  for (const k of Object.keys(v)) if (v[k] !== undefined && !s.keys.includes(k)) out.push(`${where}.${k}: la API no la declara en ${schema}`);
  for (const k of s.required) if (v[k] === undefined) out.push(`${where}.${k}: obligatoria en ${schema} y falta`);
  for (const [k, n] of Object.entries(s.nested)) {
    const x = v[k];
    if (x === null || x === undefined) continue;
    if (n.array) (x as unknown[]).slice(0, 3).forEach((item, i) => out.push(...diff(item, n.schema, `${where}.${k}[${i}]`)));
    else out.push(...diff(x, n.schema, `${where}.${k}`));
  }
  return out;
}

/** Valida una respuesta contra el DTO de su operación. */
function respuesta(method: MockMethod, path: string, r: { status: number; body: unknown }): void {
  const op = operationOf(method, path);
  expect(op, `${method} ${path} no está en el contrato`).toBeDefined();
  expect(r.status, `${method} ${path}: ${JSON.stringify(r.body).slice(0, 300)}`).toBeLessThan(300);
  if (op!.response === null) return;
  const items = op!.responseIsArray ? (r.body as unknown[]) : [r.body];
  if (op!.responseIsArray) expect(Array.isArray(r.body), `${method} ${path} devuelve un arreglo`).toBe(true);
  expect(items.flatMap((x, i) => diff(x, op!.response!, `${op!.response}[${i}]`))).toEqual([]);
}

const cells = (usuario: MockUser = enfermeria) => (call('GET', `/sites/${SITIO}/bed-board`, { usuario }).body as BedBoard).units.flatMap((x) => x.cells);
const celda = (code: string, usuario: MockUser = enfermeria): BedBoardCell => cells(usuario).find((c) => c.code === code)!;

/** Deja la cama asignable: su orden abierta, limpiada por limpieza e inspeccionada por la supervisora. */
function prepararCama(code: string): BedBoardCell {
  const cama = celda(code);
  let o = (call('GET', `/sites/${SITIO}/cleaning-orders`, { usuario: limpieza }).body as CleaningOrderPage).items.find((x) => x.careSpaceId === cama.id);
  if (o !== undefined) {
    if (o.statusCode === 'CLN_PENDING') o = call('POST', `/cleaning-orders/${o.id}/start`, { usuario: limpieza, ifMatch: o.rowVersion }).body as CleaningOrder;
    if (o.statusCode === 'CLN_IN_PROGRESS') o = call('POST', `/cleaning-orders/${o.id}/finish`, { usuario: limpieza, ifMatch: o.rowVersion }).body as CleaningOrder;
    if (o.statusCode === 'CLN_DONE') call('POST', `/cleaning-orders/${o.id}/inspect`, { usuario: supervisoraLimpieza, ifMatch: o.rowVersion, body: { result: 'PASS' } });
  }
  const lista = celda(code);
  expect(lista.assignable, `${code} asignable`).toBe(true);
  return lista;
}

describe('contrato F2/F3: la maqueta y los clientes contra el openapi de la API', () => {
  it('cada ruta que llaman los clientes existe en la API con ese método', () => {
    const fuentes = ['src/app/core/data-access/infrastructure-ops/infrastructure-ops.client.ts', 'src/app/core/data-access/adt/adt.client.ts'].map((f) => readFileSync(resolve(f), 'utf8'));
    const rutas = fuentes.flatMap((t) => [...t.matchAll(/this\.url\(\s*[`'](\/[^`']+)[`']/g)].map((m) => m[1]!.replace(/\$\{[^}]+\}/g, ':p').replace(/\/:p\/(assign|start|finish|inspect|cancel)$/, '/:p/$1')));
    expect(rutas.length).toBeGreaterThanOrEqual(30);
    for (const ruta of rutas) {
      const enContrato = INFRA_OPERATIONS.some((op) => {
        const a = op.path.split('/').filter(Boolean);
        const b = ruta.replace(/\/\$\{action\}$/, '/:action').split('/').filter(Boolean);
        return a.length === b.length && a.every((x, i) => x.startsWith(':') || b[i]!.startsWith(':') || x === b[i]);
      });
      expect(enContrato, `${ruta} no está en el contrato de la API`).toBe(true);
    }
    expect(INFRA_OPERATIONS.filter((o) => !o.published).map((o) => `${o.method} ${o.path}`)).toEqual([]);
  });

  it('lecturas de F2: acceso, catálogo, tablero, estado, bloqueos, cola e historial', () => {
    respuesta('GET', '/practice/infrastructure-access/me', call('GET', '/practice/infrastructure-access/me'));
    // Del catálogo, la parte de F2 (`opsCatalogGroups`); la de F1 la cubre su propio contrato.
    const catalogo = call('GET', '/practice/infrastructure-catalog').body as Record<string, unknown[]>;
    const f2 = INFRA_SCHEMAS['InfrastructureCatalogDto']!.nested;
    for (const k of ['availability', 'hygiene', 'isolation', 'occupancy', 'blockReasons', 'cleaningTypes', 'cleaningPriorities', 'v2Map']) {
      expect(catalogo[k]!.length, k).toBeGreaterThan(0);
      expect(catalogo[k]!.flatMap((x, i) => diff(x, f2[k]!.schema, `catalog.${k}[${i}]`))).toEqual([]);
    }
    respuesta('GET', `/sites/${SITIO}/bed-board`, call('GET', `/sites/${SITIO}/bed-board`));
    respuesta('GET', `/sites/${SITIO}/bed-board`, call('GET', `/sites/${SITIO}/bed-board`, { usuario: limpieza }));
    const ocupada = celda('301-A');
    respuesta('GET', `/care-spaces/${ocupada.id}/operational-state`, call('GET', `/care-spaces/${ocupada.id}/operational-state`));
    respuesta('GET', `/care-spaces/${celda('302-B').id}/blocks`, call('GET', `/care-spaces/${celda('302-B').id}/blocks`, { query: 'includeEnded=true' }));
    respuesta('GET', `/sites/${SITIO}/cleaning-orders`, call('GET', `/sites/${SITIO}/cleaning-orders`, { usuario: limpieza }));
    respuesta('GET', `/care-spaces/${ocupada.id}/status-events`, call('GET', `/care-spaces/${ocupada.id}/status-events`));
  });

  it('mutaciones de F2: bloqueo, fin, higiene, aislamiento y la orden de limpieza completa', () => {
    const libre = celda('303-A');
    const fin = new Date(Date.now() + 86_400_000).toISOString();
    const m = call('POST', `/care-spaces/${libre.id}/availability`, { usuario: u('mantenimiento'), ifMatchOps: libre.opsVersion, body: { action: 'start-maintenance', reasonCode: 'BLOCK_RSN_PREVENTIVE_MAINTENANCE', expectedEndAt: fin } });
    respuesta('POST', `/care-spaces/${libre.id}/availability`, m);
    const blockId = (m.body as { blockId: string }).blockId;
    respuesta('POST', `/care-space-blocks/${blockId}/end`, call('POST', `/care-space-blocks/${blockId}/end`, { usuario: u('mantenimiento'), body: { note: 'Listo' } }));

    const otra = celda('301-B');
    const b = call('POST', `/care-spaces/${otra.id}/availability`, { ifMatchOps: otra.opsVersion, body: { action: 'block', kindCode: 'BLOCK_CLINICAL', reasonCode: 'BLOCK_RSN_STAFF_SHORTAGE' } });
    respuesta('POST', `/care-spaces/${otra.id}/availability`, b);
    const bid = (b.body as { blockId: string }).blockId;
    respuesta('POST', `/care-space-blocks/${bid}/cancel`, call('POST', `/care-space-blocks/${bid}/cancel`, { body: { reason: 'Se resolvió' } }));

    const iso = celda('301-B');
    respuesta('POST', `/care-spaces/${iso.id}/isolation`, call('POST', `/care-spaces/${iso.id}/isolation`, { ifMatchOps: iso.opsVersion, body: { isolationCode: 'ISO_CONTACT', reasonText: 'Cultivo', organismText: 'KPC' } }));
    const iso2 = celda('301-B');
    call('POST', `/care-spaces/${iso2.id}/isolation`, { ifMatchOps: iso2.opsVersion, body: { isolationCode: 'ISO_NONE', reasonText: 'Negativo' } });

    // La orden que dejó el fin de mantenimiento: cada transición devuelve el `CleaningOrderDto`.
    const orden = (call('GET', `/sites/${SITIO}/cleaning-orders`, { usuario: limpieza }).body as CleaningOrderPage).items.find((o) => o.careSpaceId === libre.id)!;
    const paso = (accion: string, o: CleaningOrder, usuario: MockUser, body: object) => {
      const r = call('POST', `/cleaning-orders/${o.id}/${accion}`, { usuario, ifMatch: o.rowVersion, body });
      respuesta('POST', `/cleaning-orders/${o.id}/${accion}`, r);
      return r.body as CleaningOrder;
    };
    const asignada = paso('assign', orden, limpieza, { userId: limpieza.id });
    const iniciada = paso('start', asignada, limpieza, {});
    const terminada = paso('finish', iniciada, limpieza, { note: 'Ok' });
    paso('inspect', terminada, supervisoraLimpieza, { result: 'PASS' });

    const sucia = celda('303-A');
    const h = call('POST', `/care-spaces/${sucia.id}/hygiene`, { usuario: limpieza, ifMatchOps: sucia.opsVersion, body: { action: 'mark-dirty', reasonText: 'Derrame' } });
    respuesta('POST', `/care-spaces/${sucia.id}/hygiene`, h);
    const abierta = (call('GET', `/sites/${SITIO}/cleaning-orders`, { usuario: limpieza }).body as CleaningOrderPage).items.find((o) => o.careSpaceId === sucia.id)!;
    paso('cancel', abierta, limpieza, { reason: 'Duplicada' });
    const nueva = call('POST', `/sites/${SITIO}/cleaning-orders`, { usuario: limpieza, body: { careSpaceId: sucia.id, typeCode: 'CLEAN_ROUTINE', priorityCode: 'CLN_PRIO_URGENT', note: 'Rehacer' } });
    expect(nueva.status).toBe(201);
    respuesta('POST', `/sites/${SITIO}/cleaning-orders`, nueva);
  });

  it('F3 tipado: compatibilidad prospectiva, ingreso, asignación, traslado, intercambio, egreso, cancelación y profesionales', () => {
    respuesta('GET', `/sites/${SITIO}/attending-practitioners`, call('GET', `/sites/${SITIO}/attending-practitioners`, { usuario: admision }));
    // Una cama asignable y lista para el ingreso.
    const destino = prepararCama('303-A');
    prepararCama('301-B');
    respuesta('POST', '/clinical/bed-compatibility', call('POST', '/clinical/bed-compatibility', { usuario: admision, body: { careSpaceId: destino.id, patientProfileId: patientId('p-guzman'), levelOfCareCode: 'LOC_CARE_GENERAL' } }));
    const sinCama = call('POST', '/clinical/admissions', { usuario: admision, body: { patientProfileId: patientId('p-guzman'), practiceSiteId: SITIO, levelOfCareCode: 'LOC_CARE_GENERAL', admissionSourceCode: 'ADM_SRC_EMERGENCY', reasonText: 'Observación' } });
    respuesta('POST', '/clinical/admissions', sinCama);
    const enc = (sinCama.body as { encounterId: string }).encounterId;
    const stay = call('GET', `/clinical/encounters/${enc}/stay`, { usuario: admision }).body as { encounter: { rowVersion: number } };
    const reserva = call('POST', `/clinical/encounters/${enc}/bed-assignment`, { usuario: admision, ifMatch: stay.encounter.rowVersion, body: { careSpaceId: destino.id, mode: 'RESERVE' } });
    respuesta('POST', `/clinical/encounters/${enc}/bed-assignment`, reserva);
    const locId = (reserva.body as { encounterLocationId: string }).encounterLocationId;
    respuesta('POST', `/clinical/encounter-locations/${locId}/cancel`, call('POST', `/clinical/encounter-locations/${locId}/cancel`, { usuario: admision, body: { reasonText: 'Error de carga' } }));

    const mamani = celda('301-A').occupancy.encounterId!;
    const flores = celda('302-A').occupancy.encounterId!;
    const sw = call('POST', '/clinical/bed-swaps', { usuario: supervision, body: { encounterAId: mamani, encounterBId: flores, reasonText: 'Familia', override: { justification: 'Habitaciones individuales en la práctica, autorizado', ruleCodes: ['SEX'] } } });
    respuesta('POST', '/clinical/bed-swaps', sw);

    const enc2 = (call('GET', `/clinical/encounters/${flores}/stay`).body as { encounter: { rowVersion: number } }).encounter;
    const libre = cells().find((c) => c.assignable && c.code !== celda('302-A').code) ?? prepararCama('303-A');
    const tr = call('POST', `/clinical/encounters/${flores}/transfer`, { ifMatch: enc2.rowVersion, body: { toCareSpaceId: libre.id, reasonCode: 'TRF_CLINICAL' } });
    respuesta('POST', `/clinical/encounters/${flores}/transfer`, tr);
    const enc3 = (call('GET', `/clinical/encounters/${flores}/stay`).body as { encounter: { rowVersion: number } }).encounter;
    const eg = call('POST', `/clinical/encounters/${flores}/discharge`, { ifMatch: enc3.rowVersion, body: { dischargeDispositionCode: 'DISP_HOME', occurredAt: new Date().toISOString() } });
    respuesta('POST', `/clinical/encounters/${flores}/discharge`, eg);
  });

  it('F3 sin esquema en el openapi: forma del use case de la API', () => {
    const mamani = cells().find((c) => c.occupancy.code === 'OCC_OCCUPIED')!.occupancy.encounterId!;
    // `InpatientReadUseCases.stay` → `{encounter: encounterView, movements: locationView[], incidents}`.
    const stay = call('GET', `/clinical/encounters/${mamani}/stay`).body as Record<string, Record<string, unknown> | Record<string, unknown>[]>;
    expect(Object.keys(stay).sort()).toEqual(['encounter', 'incidents', 'movements']);
    expect(Object.keys(stay['encounter']!).sort()).toEqual(['admissionSource', 'class', 'dischargeDisposition', 'endAt', 'episodeId', 'expectedDischargeAt', 'id', 'levelOfCare', 'patientProfileId', 'rowVersion', 'startAt', 'status'].sort());
    expect(Object.keys((stay['movements'] as Record<string, unknown>[])[0]!).sort()).toEqual(['careSpaceId', 'encounterId', 'endReason', 'id', 'movement', 'periodEnd', 'periodStart', 'placementIncidentId', 'previousEncounterLocationId', 'status'].sort());
    // `GET /clinical/patients/:id/inpatient-stay` → la misma forma que `/stay`.
    const actual = call('GET', `/clinical/patients/${patientId('p-mamani')}/inpatient-stay`).body as Record<string, unknown>;
    expect(Object.keys(actual).sort()).toEqual(['encounter', 'incidents', 'movements']);
    // Compatibilidad con encuentro: `compatibilityView` → `{assignable, rules, violations}`.
    const libre = cells().find((c) => c.assignable) ?? cells()[0]!;
    const compat = call('POST', `/clinical/encounters/${mamani}/bed-compatibility`, { body: { careSpaceId: libre.id } }).body as Record<string, unknown>;
    expect(diff(compat, 'CompatibilityResultDto', 'compat')).toEqual([]);
    // Censo: `CensusDayView[]`; cierre: `{closed: CensusDayView[]}`; ajuste: `adjView` (+ requestId del interceptor).
    const ayer = shiftDate(siteDate(Date.now()), -1);
    const dias = call('GET', `/sites/${SITIO}/census`, { query: `date=${ayer}` }).body as Record<string, unknown>[];
    expect(Array.isArray(dias)).toBe(true);
    const claveDia = ['adjustedTotals', 'adjustments', 'counts', 'cutoffAt', 'date', 'id', 'status', 'unitId'];
    expect(Object.keys(dias[0]!).sort()).toEqual(claveDia);
    expect(Object.keys(dias[0]!['counts'] as object).sort()).toEqual(['admissions', 'bedsAvailable', 'bedsBlocked', 'bedsCensable', 'deaths', 'dischargeStayDays', 'discharges', 'patientDays', 'patientsAtCutoff', 'sameDayStays', 'transfersIn', 'transfersOut']);
    const cierre = call('POST', `/sites/${SITIO}/census/${ayer}/close`, { usuario: supervision, body: { unitIds: [dias[0]!['unitId']] } }).body as { closed: Record<string, unknown>[] };
    expect(Object.keys(cierre).filter((k) => k !== 'requestId')).toEqual(['closed']);
    expect(Object.keys(cierre.closed[0]!).sort()).toEqual(claveDia);
    const aj = call('POST', `/census-days/${cierre.closed[0]!['id']}/adjustments`, { usuario: supervision, body: { fieldCode: 'admissions', newValue: 3, reasonText: 'Ingreso sin registrar' } }).body as Record<string, unknown>;
    expect(Object.keys(aj).sort()).toEqual(['adjustedByUserId', 'createdAt', 'fieldCode', 'id', 'newValue', 'previousValue', 'reasonText', 'requestId']);
    // Indicadores: `{period, ...computeIndicators, bedTurnaroundMinutes, coverage}`.
    const ind = call('GET', `/sites/${SITIO}/inpatient-indicators`, { query: `from=${shiftDate(ayer, -6)}&to=${ayer}` }).body as Record<string, unknown>;
    expect(Object.keys(ind).sort()).toEqual(['admissions', 'alos', 'avgBeds', 'bedDaysAvailable', 'bedTurnaroundMinutes', 'bedTurnover', 'coverage', 'crossCheck', 'days', 'dischargeStayDays', 'discharges', 'occupancyPct', 'patientDays', 'period', 'turnoverInterval'].sort());
    expect(Object.keys(ind['bedTurnaroundMinutes'] as object).sort()).toEqual(['cleaning', 'inspection', 'p50', 'p90', 'waitToStart']);
  });

  it('cada cuerpo que mandó la web cabe en el DTO de la API (forbidNonWhitelisted y obligatorias)', () => {
    expect(enviados.length).toBeGreaterThan(20);
    const problemas: string[] = [];
    for (const e of enviados) {
      const op = operationOf(e.method, e.pattern);
      if (op === undefined || op.body === null) continue;
      problemas.push(...diff(e.body, op.body, `${e.method} ${op.path}`));
    }
    expect(problemas).toEqual([]);
  });
});
