import { HttpHeaders } from '@angular/common/http';

import type {
  BedBoard,
  BedBoardCell,
  CleaningOrder,
  CleaningOrderPage,
  InfrastructureAccess,
  OperationalState,
  StatusEventPage,
} from '../../data-access/infrastructure-ops/infrastructure-ops.types';
import { SITIOS_INFRA } from '../fixtures/infraestructura';
import { isMockReply, MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario, TENANT_CLINICA, TENANT_HOSPITAL, type MockUser } from '../mock-session';
import { registerAdt } from './adt.handlers';
import { registrarInfraestructura } from './infrastructure.handlers';
import { registerInfrastructureOps } from './infrastructure-ops.handlers';
import { registrarProcedimientos } from './procedures.handlers';

/**
 * El simulador de F2 tiene que comportarse como el contrato (§F2.3 y F2.5):
 * si no, el tablero se ve bien contra la maqueta y mal contra la API.
 */
describe('handlers de operación de camas (F2)', () => {
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
  const mantenimiento = u('mantenimiento');
  const superadmin = u('superadmin');

  interface Opciones {
    readonly body?: unknown;
    readonly tenant?: string | null;
    readonly ifMatch?: number;
    readonly ifMatchOps?: number;
    readonly usuario?: MockUser;
    readonly query?: string;
  }

  function call(method: MockMethod, path: string, o: Opciones = {}): { status: number; body: unknown } {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    let headers = new HttpHeaders();
    const tenant = o.tenant === undefined ? TENANT_HOSPITAL : o.tenant;
    if (tenant !== null) headers = headers.set('X-Tenant-Id', tenant);
    if (o.ifMatch !== undefined) headers = headers.set('If-Match', String(o.ifMatch));
    if (o.ifMatchOps !== undefined) headers = headers.set('If-Match-Ops', String(o.ifMatchOps));
    const r = match.handler({ method, path, params: match.params, query: new URLSearchParams(o.query ?? ''), body: o.body ?? null, headers, user: o.usuario ?? enfermeria });
    return isMockReply(r) ? (r as MockReply) : { status: 200, body: r };
  }

  const reasonOf = (r: { body: unknown }) => (r.body as { reason?: string }).reason;
  const tablero = (usuario: MockUser = enfermeria) => call('GET', `/sites/${SITIO}/bed-board`, { usuario }).body as BedBoard;
  const celda = (code: string, usuario: MockUser = enfermeria): BedBoardCell =>
    tablero(usuario).units.flatMap((x) => x.cells).find((c) => c.code === code)!;
  const cola = (usuario: MockUser = limpieza) => (call('GET', `/sites/${SITIO}/cleaning-orders`, { usuario }).body as CleaningOrderPage).items;
  const eventos = (id: string) => (call('GET', `/care-spaces/${id}/status-events`).body as StatusEventPage).items;

  it('el tablero agrupa por unidad, deriva recuentos y calcula la letra v2', () => {
    const t = tablero();
    const medint = t.units.find((x) => x.name === 'Internación de medicina interna')!;
    expect(medint.cells.map((c) => c.code)).toEqual(['301-A', '301-B', '302-A', '302-B', '303-A']);
    expect(medint.counts).toMatchObject({ total: 5, occupied: 2, maintenance: 1, assignable: 2 });
    expect(celda('301-A').v2Code).toBe('O');
    expect(celda('301-B').v2Code).toBe('U');
    expect(celda('302-B').v2Code).toBe('C');
    // La API manda el motivo como código en la celda; el texto vive en el bloqueo.
    expect(celda('302-B').availability.reasonText).toBeNull();
    expect((call('GET', `/care-spaces/${celda('302-B').id}/operational-state`).body as OperationalState).openBlocks[0]!.reasonText).toContain('Cabecera');
    expect(t.siteId).toBe(SITIO);
    expect(celda('301-A').form).toBe('LOC_FORM_BED');
    expect(celda('301-A').lifecycle).toBe('ACTIVE');
    expect(celda('REC-1').v2Code).toBe('H');
    expect(t.generatedAt).toBeTypeOf('string');
  });

  it('enfermería ve iniciales del paciente; limpieza y soporte no (§F2.3 y F2.5 #6)', () => {
    expect(celda('301-A').occupancy.patient?.initials).toMatch(/^[A-Z]{2,3}$/);
    expect(celda('301-A', limpieza).occupancy.patient).toBeUndefined();
    expect(celda('301-A', limpieza).occupancy.encounterId).toBeNull();
    expect(Object.keys(celda('301-A', limpieza).occupancy)).not.toContain('encounterLocationId');
    expect(Object.keys(celda('301-A', limpieza).occupancy)).not.toContain('patient');
    expect(celda('301-A').occupancy.encounterLocationId).toBeTypeOf('string');
    expect(celda('301-A', superadmin).occupancy.patient).toBeUndefined();
    expect(tablero(limpieza).units.flatMap((x) => x.cells).every((c) => c.occupancy.patient === undefined)).toBe(true);
  });

  it('el acceso del actor dice sus roles y acciones por sede', () => {
    const acceso = call('GET', '/practice/infrastructure-access/me', { usuario: limpieza }).body as InfrastructureAccess;
    expect(acceso.sites).toHaveLength(1);
    expect(acceso.sites[0]!.roles).toEqual(['HOUSEKEEPING']);
    expect(acceso.sites[0]!.actions).toContain('f2.cleaning.work');
    expect(acceso.sites[0]!.actions).not.toContain('f3.adt.place');
    expect(acceso.sites[0]!.actions).not.toContain('f3.adt.read');
    expect(acceso.sites[0]).toMatchObject({ practiceId: expect.any(String), globalRoles: [], grants: [] });
    const medica = call('GET', '/practice/infrastructure-access/me', { usuario: u('medica') }).body as InfrastructureAccess;
    expect(medica.sites).toEqual([]);
  });

  it('otro tenant: 404 en sede y espacio; If-Match-Ops viejo: 412', () => {
    const cama = celda('301-B');
    expect(call('GET', `/sites/${SITIO}/bed-board`, { tenant: TENANT_CLINICA }).status).toBe(404);
    expect(call('GET', `/care-spaces/${cama.id}/operational-state`, { tenant: TENANT_CLINICA }).status).toBe(404);
    expect(call('POST', `/care-spaces/${cama.id}/hygiene`, { tenant: TENANT_CLINICA, body: { action: 'mark-dirty' }, ifMatchOps: cama.opsVersion }).status).toBe(404);
    const viejo = call('POST', `/care-spaces/${cama.id}/availability`, { body: { action: 'block', kindCode: 'BLOCK_CLINICAL', reasonCode: 'BLOCK_RSN_STAFF_SHORTAGE' }, ifMatchOps: cama.opsVersion - 1 });
    expect(viejo.status).toBe(412);
    expect(reasonOf(viejo)).toBe('OPS_VERSION_MISMATCH');
  });

  it('limpieza no bloquea (403 con los roles requeridos)', () => {
    const cama = celda('301-B', limpieza);
    const r = call('POST', `/care-spaces/${cama.id}/availability`, { usuario: limpieza, ifMatchOps: cama.opsVersion, body: { action: 'block', kindCode: 'BLOCK_CLINICAL', reasonCode: 'BLOCK_RSN_STAFF_SHORTAGE' } });
    expect(r.status).toBe(403);
    expect((r.body as { details: { requiredRoles: string[] } }).details.requiredRoles).toEqual(['NURSE']);
  });

  it('bloqueo: motivo, texto de «Otro», fecha estimada de mantenimiento, cama ocupada (F2.5 #2)', () => {
    const libre = celda('303-A');
    const pedir = (body: object, usuario = enfermeria) => call('POST', `/care-spaces/${libre.id}/availability`, { usuario, ifMatchOps: libre.opsVersion, body });
    expect(reasonOf(pedir({ action: 'block', kindCode: 'BLOCK_CLINICAL' }))).toBe('BLOCK_REASON_REQUIRED');
    expect(reasonOf(pedir({ action: 'block', kindCode: 'BLOCK_CLINICAL', reasonCode: 'BLOCK_RSN_OTHER' }))).toBe('BLOCK_REASON_TEXT_REQUIRED');
    expect(reasonOf(pedir({ action: 'block', kindCode: 'BLOCK_CLINICAL', reasonCode: 'BLOCK_RSN_PREVENTIVE_MAINTENANCE' }))).toBe('BLOCK_REASON_KIND_MISMATCH');
    const withoutEnd = pedir({ action: 'start-maintenance', reasonCode: 'BLOCK_RSN_PREVENTIVE_MAINTENANCE' }, mantenimiento);
    expect(withoutEnd.status).toBe(422);
    expect(reasonOf(withoutEnd)).toBe('BLOCK_EXPECTED_END_REQUIRED');
    const ocupada = celda('301-A');
    const r = call('POST', `/care-spaces/${ocupada.id}/availability`, { ifMatchOps: ocupada.opsVersion, body: { action: 'block', kindCode: 'BLOCK_CLINICAL', reasonCode: 'BLOCK_RSN_STAFF_SHORTAGE' } });
    expect(r.status).toBe(409);
    expect(reasonOf(r)).toBe('SPACE_OCCUPIED');
  });

  it('mantenimiento preventivo con fecha → C, evento A20 y al terminar exige limpieza (F2.5 #1)', () => {
    const libre = celda('303-A');
    const until = new Date(Date.now() + 86_400_000).toISOString();
    const r = call('POST', `/care-spaces/${libre.id}/availability`, {
      usuario: mantenimiento, ifMatchOps: libre.opsVersion,
      body: { action: 'start-maintenance', reasonCode: 'BLOCK_RSN_PREVENTIVE_MAINTENANCE', expectedEndAt: until },
    });
    expect(r.status).toBe(200);
    const { cell, blockId, requestId } = r.body as { cell: BedBoardCell; blockId: string; requestId: string };
    expect(cell.v2Code).toBe('C');
    expect(cell.availability).toMatchObject({ code: 'SPACE_OP_MAINTENANCE', expectedUntil: until, reasonCode: 'BLOCK_RSN_PREVENTIVE_MAINTENANCE' });
    const a20 = eventos(libre.id)[0]!;
    expect(a20).toMatchObject({ v2Code: 'C', requestId, axis: 'AVAILABILITY', source: 'BLOCK', to: 'SPACE_OP_MAINTENANCE' });
    expect(call('POST', `/care-space-blocks/${blockId}/end`, { usuario: mantenimiento, body: { note: 'Revisado' } }).status).toBe(200);
    const despues = call('GET', `/care-spaces/${libre.id}/operational-state`).body as OperationalState;
    expect(despues.availability.code).toBe('SPACE_OP_AVAILABLE');
    expect(despues.hygiene.code).toBe('HYG_DIRTY');
    expect(despues.openCleaningOrder?.triggerCode).toBe('CLN_TRG_MAINTENANCE_END');
    expect(call('POST', `/care-space-blocks/${blockId}/end`, { usuario: mantenimiento, body: {} }).status).toBe(409);
  });

  it('ciclo completo de limpieza: cuatro eventos A20 en orden y quien limpió no inspecciona (F2.5 #4)', () => {
    const cama = celda('303-A');
    const orden = cola().find((o) => o.careSpaceId === cama.id)!;
    expect(orden.allowedTransitions).toEqual(['assign', 'start', 'cancel']);
    expect(Object.keys(orden)).not.toContain('patient');
    const paso = (accion: string, o: CleaningOrder, usuario: MockUser, body: object = {}) =>
      call('POST', `/cleaning-orders/${o.id}/${accion}`, { usuario, ifMatch: o.rowVersion, body });
    const viejo = call('POST', `/cleaning-orders/${orden.id}/start`, { usuario: limpieza, ifMatch: orden.rowVersion + 5 });
    expect(viejo.status).toBe(412);
    const iniciada = paso('start', orden, limpieza).body as CleaningOrder;
    expect(iniciada.statusCode).toBe('CLN_IN_PROGRESS');
    const mal = paso('inspect', iniciada, supervisoraLimpieza, { result: 'PASS' });
    expect(mal.status).toBe(409);
    expect(reasonOf(mal)).toBe('CLEANING_ORDER_INVALID_TRANSITION');
    const terminada = paso('finish', iniciada, limpieza).body as CleaningOrder;
    expect(terminada.statusCode).toBe('CLN_DONE');
    expect(terminada.inspectionRequired).toBe(true);
    expect(celda('303-A').assignable).toBe(false);
    // La limpiadora no tiene la acción de inspeccionar (403); la supervisora que
    // además limpió, tampoco puede inspeccionar lo suyo (422).
    expect(paso('inspect', terminada, limpieza, { result: 'PASS' }).status).toBe(403);
    expect(reasonOf(paso('inspect', terminada, supervisoraLimpieza, { result: 'FAIL' }))).toBe('INSPECTION_REASON_REQUIRED');
    const ok = paso('inspect', terminada, supervisoraLimpieza, { result: 'PASS' });
    expect(ok.status).toBe(200);
    expect(celda('303-A')).toMatchObject({ assignable: true, v2Code: 'U' });
    const higiene = eventos(cama.id).filter((x) => x.axis === 'HYGIENE').map((x) => x.to).reverse();
    expect(higiene.slice(-4)).toEqual(['HYG_DIRTY', 'HYG_CLEANING', 'HYG_CLEAN', 'HYG_INSPECTED']);
  });

  it('la supervisora no inspecciona lo que ella misma terminó', () => {
    const r1 = celda('REC-1');
    const orden = cola(supervisoraLimpieza).find((o) => o.careSpaceId === r1.id)!;
    const paso = (accion: string, o: CleaningOrder, body: object = {}) =>
      call('POST', `/cleaning-orders/${o.id}/${accion}`, { usuario: supervisoraLimpieza, ifMatch: o.rowVersion, body }).body as CleaningOrder;
    const terminada = paso('finish', paso('start', orden));
    const r = call('POST', `/cleaning-orders/${terminada.id}/inspect`, { usuario: supervisoraLimpieza, ifMatch: terminada.rowVersion, body: { result: 'PASS' } });
    expect(r.status).toBe(422);
    expect(reasonOf(r)).toBe('INSPECTION_BY_CLEANER_NOT_ALLOWED');
    // Inspección rechazada por otra supervisora: orden REJECTED y una next PENDING.
    const fail = call('POST', `/cleaning-orders/${terminada.id}/inspect`, { usuario: supervision, ifMatch: terminada.rowVersion, body: { result: 'FAIL', reasonText: 'Quedó material en el carro' } });
    expect((fail.body as CleaningOrder).statusCode).toBe('CLN_REJECTED');
    const next = cola().find((o) => o.careSpaceId === r1.id)!;
    expect(next).toMatchObject({ triggerCode: 'CLN_TRG_INSPECTION_FAILED', previousOrderId: terminada.id, statusCode: 'CLN_PENDING' });
    expect(celda('REC-1').hygiene.code).toBe('HYG_DIRTY');
  });

  it('marcar sucia con orden abierta → 409; contaminada la escala a TERMINAL', () => {
    const r1 = celda('REC-1');
    expect(reasonOf(call('POST', `/care-spaces/${r1.id}/hygiene`, { usuario: limpieza, ifMatchOps: r1.opsVersion, body: { action: 'mark-dirty' } }))).toBe('CLEANING_ORDER_ALREADY_OPEN');
    expect(call('POST', `/care-spaces/${r1.id}/hygiene`, { usuario: limpieza, ifMatchOps: r1.opsVersion, body: { action: 'mark-contaminated' } }).status).toBe(403);
    const r = call('POST', `/care-spaces/${r1.id}/hygiene`, { ifMatchOps: r1.opsVersion, body: { action: 'mark-contaminated', reasonText: 'Derrame de fluidos' } });
    expect((r.body as { cell: BedBoardCell }).cell).toMatchObject({ v2Code: 'K', hygiene: { terminalRequired: true } });
    expect(cola().find((o) => o.careSpaceId === r1.id)?.typeCode).toBe('CLEAN_TERMINAL');
  });

  it('aislamiento aéreo fuera de AIIR → 422 con lo que falta; en habitación compartida bloquea la hermana libre (F2.5 #5)', () => {
    const ocupada = celda('301-A');
    const r = call('POST', `/care-spaces/${ocupada.id}/isolation`, { ifMatchOps: ocupada.opsVersion, body: { isolationCode: 'ISO_AIRBORNE', reasonText: 'TB sospechada' } });
    expect(r.status).toBe(422);
    expect((r.body as { details: { missing: string[] } }).details.missing).toEqual(['AIIR', 'NEGATIVE_PRESSURE', 'HVAC_VALIDATION']);
    expect(reasonOf(call('POST', `/care-spaces/${ocupada.id}/isolation`, { ifMatchOps: ocupada.opsVersion, body: { isolationCode: 'ISO_CONTACT' } }))).toBe('ISOLATION_REASON_REQUIRED');
    const contacto = call('POST', `/care-spaces/${ocupada.id}/isolation`, { ifMatchOps: ocupada.opsVersion, body: { isolationCode: 'ISO_CONTACT', organismText: 'KPC', reasonText: 'Cultivo positivo' } });
    expect(contacto.status).toBe(200);
    expect((contacto.body as { companionBlocks: unknown[] }).companionBlocks).toHaveLength(1);
    expect(celda('301-B')).toMatchObject({ v2Code: 'C', availability: { code: 'SPACE_OP_BLOCKED_CLINICAL', reasonCode: 'BLOCK_RSN_ISOLATION_COHORT' } });
    expect(celda('301-A').v2Code).toBe('I');
    // Al levantarlo: orden TERMINAL, la hermana vuelve y la cama no es asignable until la inspección.
    const vigente = celda('301-A');
    call('POST', `/care-spaces/${vigente.id}/isolation`, { ifMatchOps: vigente.opsVersion, body: { isolationCode: 'ISO_NONE', reasonText: 'Cultivos negativos' } });
    expect(celda('301-A').hygiene.terminalRequired).toBe(true);
    expect(celda('301-B').availability.code).toBe('SPACE_OP_AVAILABLE');
    expect(cola().find((o) => o.careSpaceId === vigente.id)).toMatchObject({ typeCode: 'CLEAN_TERMINAL', triggerCode: 'CLN_TRG_ISOLATION_END' });
  });

  it('el aval de cohorte exige control de infecciones (403)', () => {
    const libre = celda('303-A');
    const r = call('POST', `/care-spaces/${libre.id}/isolation`, { ifMatchOps: libre.opsVersion, body: { isolationCode: 'ISO_CONTACT', reasonText: 'x', cohortApproved: true } });
    expect(r.status).toBe(403);
    expect(reasonOf(r)).toBe('ISOLATION_COHORT_REQUIRES_APPROVAL');
  });

  it('una orden manual sobre bandera terminal exige TERMINAL; la cola filtra «mías»', () => {
    const cama = celda('301-A');
    const cerrar = cola().find((o) => o.careSpaceId === cama.id)!;
    call('POST', `/cleaning-orders/${cerrar.id}/cancel`, { ifMatch: cerrar.rowVersion, body: { reason: 'Se repite' } });
    const r = call('POST', `/sites/${SITIO}/cleaning-orders`, { body: { careSpaceId: cama.id, typeCode: 'CLEAN_ROUTINE', priorityCode: 'CLN_PRIO_ROUTINE' } });
    expect(reasonOf(r)).toBe('TERMINAL_CLEANING_REQUIRED');
    expect(call('POST', `/sites/${SITIO}/cleaning-orders`, { body: { careSpaceId: cama.id, typeCode: 'CLEAN_TERMINAL', priorityCode: 'CLN_PRIO_STAT' } }).status).toBe(201);
    const mias = (call('GET', `/sites/${SITIO}/cleaning-orders`, { usuario: limpieza, query: 'assignedTo=me' }).body as CleaningOrderPage).items;
    expect(mias.length).toBeGreaterThan(0);
    expect(mias.every((o) => o.assignedUserId === limpieza.id)).toBe(true);
    expect(cola()[0]!.priorityCode).toBe('CLN_PRIO_STAT');
  });
});
