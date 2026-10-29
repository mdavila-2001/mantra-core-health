import { HttpHeaders } from '@angular/common/http';

import type {
  BedBoard,
  BedBoardCell,
  CleaningOrder,
  CleaningOrderList,
  OperationalState,
  StatusEventPage,
} from '../../data-access/infrastructure-ops/infrastructure-ops.types';
import { SITIO_OTRO_TENANT } from '../fixtures/infrastructure.data';
import { SITIO_SANLUCAS } from '../fixtures/agenda';
import { MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario } from '../mock-session';
import { registerInfrastructure } from './infrastructure.handlers';
import { applyDrift } from './infrastructure-ops.drift';
import { registerInfrastructureOps } from './infrastructure-ops.handlers';
import { resetOps } from './infrastructure-ops.store';

/**
 * El simulador de operación contesta lo que dice F2.3 del contrato, con sus
 * errores, deriva cada recuento de las celdas y deja un evento por cambio.
 */
describe('simulador de operación de camas (F2)', () => {
  const router = new MockRouter();
  registerInfrastructure(router);
  registerInfrastructureOps(router);
  const admin = buscarUsuario('superadmin')!;

  function persona(clave: string): void {
    sessionStorage.setItem('mock:infra-ops-persona', clave);
  }

  function llamar(
    method: MockMethod,
    path: string,
    o: { body?: unknown; query?: string; ifMatch?: number; opsVersion?: number } = {},
  ): MockReply {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    const h: Record<string, string> = {};
    if (o.ifMatch !== undefined) h['If-Match'] = String(o.ifMatch);
    if (o.opsVersion !== undefined) h['If-Match-Ops'] = String(o.opsVersion);
    const r = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(o.query ?? ''),
      body: o.body ?? null,
      headers: new HttpHeaders(h),
      user: admin,
    });
    return typeof r === 'object' && r !== null && 'status' in r && 'body' in r ? (r as MockReply) : { status: 200, body: r };
  }

  const board = (query = ''): BedBoard => llamar('GET', `/sites/${SITIO_SANLUCAS.id}/bed-board`, { query }).body as BedBoard;
  const cells = (b: BedBoard = board()): BedBoardCell[] => b.units.flatMap((u) => u.cells);
  const cell = (code: string): BedBoardCell => cells().find((x) => x.code === code)!;
  const reason = (r: MockReply): unknown => (r.body as { details?: { reason?: string } }).details?.reason;
  const orders = (query = ''): CleaningOrder[] =>
    (llamar('GET', `/sites/${SITIO_SANLUCAS.id}/cleaning-orders`, { query }).body as CleaningOrderList).items as CleaningOrder[];
  const orderOf = (code: string): CleaningOrder => orders().find((o) => o.careSpace.code === code)!;
  const events = (code: string, query = ''): StatusEventPage['items'] =>
    (llamar('GET', `/care-spaces/${cell(code).id}/status-events`, { query }).body as StatusEventPage).items;

  const block = (code: string, body: object, version?: number): MockReply =>
    llamar('POST', `/care-spaces/${cell(code).id}/availability`, { body, opsVersion: version ?? cell(code).opsVersion });

  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem('mock:infra-ops-drift', 'off');
    resetOps();
    persona('nurse');
  });

  describe('el tablero', () => {
    it('agrupa por unidad y cuenta los recuentos de las celdas, sin escribir ninguno', () => {
      const b = board();
      expect(b.units.map((u) => u.name)).toEqual(expect.arrayContaining(['Medicina interna', 'Pediatría', 'Quirófanos']));
      for (const u of b.units) {
        expect(u.counts.total).toBe(u.cells.length);
        expect(u.counts.occupied).toBe(u.cells.filter((x) => x.occupancy.code === 'OCC_OCCUPIED').length);
        expect(u.counts.assignable).toBe(u.cells.filter((x) => x.assignable).length);
      }
    });

    it('cubre los siete resúmenes v2 del §F2.2 con las semillas', () => {
      const vistos = new Set(cells().map((x) => x.v2Code));
      expect([...vistos].sort()).toEqual(['C', 'H', 'I', 'K', 'O', 'R', 'U']);
    });

    it('cada celda trae su código de petición y su versión operativa', () => {
      for (const x of cells()) {
        expect(x.opsVersion).toBeGreaterThanOrEqual(1);
        expect(typeof x.lastEventAt).toBe('string');
      }
    });

    it('la cabecera X-Data-As-Of repite lastEventAt', () => {
      const r = llamar('GET', `/sites/${SITIO_SANLUCAS.id}/bed-board`);
      expect(r.headers?.['X-Data-As-Of']).toBe((r.body as BedBoard).lastEventAt);
    });

    it('enfermería ve al paciente; limpieza, mantenimiento y administración no', () => {
      expect(cell('301-A').occupancy.patient?.initials).toBe('M.R.');
      for (const p of ['housekeeping', 'maintenance', 'admin', 'support']) {
        persona(p);
        expect(cells().every((x) => x.occupancy.patient === undefined)).toBe(true);
      }
    });

    it('un establecimiento de otro tenant da 404', () => {
      expect(llamar('GET', `/sites/${SITIO_OTRO_TENANT}/bed-board`).status).toBe(404);
    });

    it('filtra por código v2 y por función', () => {
      expect(cells(board('v2Codes=K')).map((x) => x.code)).toEqual(['UTI-4']);
      expect(cells(board('functionCodes=SPACE_FN_OPERATING_ROOM')).map((x) => x.code).sort()).toEqual(['QX-1', 'QX-2']);
    });

    it('con atraso simulado, generatedAt envejece y las celdas no', () => {
      sessionStorage.setItem('mock:infra-antiguedad', '4');
      const b = board();
      expect(Date.now() - new Date(b.generatedAt).getTime()).toBeGreaterThanOrEqual(4 * 60_000 - 1000);
    });
  });

  describe('bloqueos (F2.5 #1–#3)', () => {
    it('bloquear por mantenimiento preventivo con fecha estimada deja la celda en C, un evento A20 y sobrevive a la relectura', () => {
      persona('maintenance');
      const hasta = new Date(Date.now() + 36 * 3_600_000).toISOString();
      const antes = events('302-A').length;
      const r = block('302-A', { action: 'start-maintenance', kindCode: 'BLOCK_MAINTENANCE', reasonCode: 'BLOCK_RSN_PREVENTIVE_MAINTENANCE', expectedEndAt: hasta });
      expect(r.status).toBe(200);
      const c = cell('302-A');
      expect(c.v2Code).toBe('C');
      expect(c.availability.code).toBe('SPACE_OP_MAINTENANCE');
      expect(c.availability.expectedUntil).toBe(hasta);
      expect(c.opsVersion).toBeGreaterThan(1);
      const e = events('302-A');
      expect(e).toHaveLength(antes + 1);
      expect(e[0]).toMatchObject({ axis: 'AXIS_AVAILABILITY', to: 'SPACE_OP_MAINTENANCE', v2Code: 'C', reasonCode: 'BLOCK_RSN_PREVENTIVE_MAINTENANCE' });
      const estado = llamar('GET', `/care-spaces/${c.id}/operational-state`).body as OperationalState;
      expect(estado.openBlocks).toHaveLength(1);
    });

    it('mantenimiento sin fecha estimada → 422 BLOCK_EXPECTED_END_REQUIRED; sin motivo → 422; «otro» sin texto → 422', () => {
      persona('maintenance');
      const base = { action: 'start-maintenance', kindCode: 'BLOCK_MAINTENANCE' };
      expect(reason(block('302-A', { ...base, reasonCode: 'BLOCK_RSN_EQUIPMENT_FAILURE' }))).toBe('BLOCK_EXPECTED_END_REQUIRED');
      expect(reason(block('302-A', base))).toBe('BLOCK_REASON_REQUIRED');
      expect(reason(block('302-A', { ...base, reasonCode: 'BLOCK_RSN_OTHER', expectedEndAt: new Date().toISOString() }))).toBe('BLOCK_REASON_TEXT_REQUIRED');
      expect(reason(block('302-A', { ...base, reasonCode: 'BLOCK_RSN_STAFF_SHORTAGE', expectedEndAt: new Date().toISOString() }))).toBe('BLOCK_REASON_KIND_MISMATCH');
      expect(cell('302-A').v2Code).toBe('U');
    });

    it('una cama ocupada o reservada no se bloquea: 409 SPACE_OCCUPIED', () => {
      expect(reason(block('301-A', { action: 'block', kindCode: 'BLOCK_CLINICAL', reasonCode: 'BLOCK_RSN_STAFF_SHORTAGE' }))).toBe('SPACE_OCCUPIED');
      expect(reason(block('303-A', { action: 'block', kindCode: 'BLOCK_CLINICAL', reasonCode: 'BLOCK_RSN_STAFF_SHORTAGE' }))).toBe('SPACE_OCCUPIED');
    });

    it('un quirófano con cirugías en la ventana → 409 FUTURE_COMMITMENTS_CONFLICT con la lista; con acknowledgeConflicts → 200', () => {
      persona('admin');
      const cuerpo = { action: 'block', kindCode: 'BLOCK_ADMIN', reasonCode: 'BLOCK_RSN_ADMIN_DECISION', expectedEndAt: new Date(Date.now() + 5 * 86_400_000).toISOString() };
      const r = block('QX-1', cuerpo);
      expect(r.status).toBe(409);
      expect(reason(r)).toBe('FUTURE_COMMITMENTS_CONFLICT');
      const conflicts = (r.body as { details: { conflicts: { kind: string; nextAction: string }[] } }).details.conflicts;
      expect(conflicts.length).toBeGreaterThanOrEqual(2);
      expect(conflicts.every((x) => x.kind === 'PROCEDURE_CASE' && x.nextAction.length > 10)).toBe(true);
      expect(cell('QX-1').v2Code).toBe('U');
      expect(block('QX-1', { ...cuerpo, acknowledgeConflicts: true }).status).toBe(200);
      expect(cell('QX-1').v2Code).toBe('C');
    });

    it('desbloquear devuelve la cama a la disponibilidad y termina el bloqueo', () => {
      const r = llamar('POST', `/care-spaces/${cell('UTI-3').id}/availability`, {
        body: { action: 'unblock', kindCode: 'BLOCK_CLINICAL', reasonCode: 'BLOCK_RSN_STAFF_SHORTAGE' },
        opsVersion: cell('UTI-3').opsVersion,
      });
      expect(r.status).toBe(200);
      expect(cell('UTI-3').availability.code).toBe('SPACE_OP_AVAILABLE');
    });

    it('terminar un mantenimiento deja la cama sucia y crea la orden MAINTENANCE_END (regla B.5-25)', () => {
      persona('maintenance');
      const abierto = (llamar('GET', `/care-spaces/${cell('312-A').id}/blocks`).body as { id: string }[])[0]!;
      expect(llamar('POST', `/care-space-blocks/${abierto.id}/end`, { body: { note: 'Motor cambiado' } }).status).toBe(200);
      expect(cell('312-A').hygiene.code).toBe('HYG_DIRTY');
      expect(orderOf('312-A').trigger).toBe('CLN_TRG_MAINTENANCE_END');
      expect(reason(llamar('POST', `/care-space-blocks/${abierto.id}/end`, { body: {} }))).toBe('BLOCK_ALREADY_ENDED');
    });

    it('limpieza intenta bloquear → 403 INFRA_ACTION_NOT_ALLOWED con los roles que sí podrían', () => {
      persona('housekeeping');
      const r = block('302-A', { action: 'block', kindCode: 'BLOCK_CLINICAL', reasonCode: 'BLOCK_RSN_STAFF_SHORTAGE' });
      expect(r.status).toBe(403);
      expect(reason(r)).toBe('INFRA_ACTION_NOT_ALLOWED');
      expect((r.body as { details: { requiredRoles: string[] } }).details.requiredRoles).toContain('NURSING');
    });

    it('un If-Match-Ops viejo → 412 OPS_VERSION_MISMATCH', () => {
      const r = block('302-A', { action: 'block', kindCode: 'BLOCK_CLINICAL', reasonCode: 'BLOCK_RSN_STAFF_SHORTAGE' }, 99);
      expect(r.status).toBe(412);
      expect(reason(r)).toBe('OPS_VERSION_MISMATCH');
    });

    it('los recuentos de la unidad cambian con el bloqueo', () => {
      const antes = board().units.find((u) => u.name === 'Medicina interna')!.counts;
      expect(block('302-A', { action: 'block', kindCode: 'BLOCK_CLINICAL', reasonCode: 'BLOCK_RSN_STAFF_SHORTAGE' }).status).toBe(200);
      const despues = board().units.find((u) => u.name === 'Medicina interna')!.counts;
      expect(despues.blocked).toBe(antes.blocked + 1);
      expect(despues.assignable).toBe(antes.assignable - 1);
    });
  });

  describe('ciclo de limpieza (F2.5 #4)', () => {
    it('sucia → limpiando → limpia → inspeccionada, con cuatro eventos A20 en orden y la cama asignable al final', () => {
      const id = cell('302-A').id;
      expect(llamar('POST', `/care-spaces/${id}/hygiene`, { body: { action: 'mark-dirty', reasonText: 'Derrame' }, opsVersion: cell('302-A').opsVersion }).status).toBe(200);
      persona('housekeeping');
      let o = orderOf('302-A');
      expect(o.status).toBe('CLN_PENDING');
      o = llamar('POST', `/cleaning-orders/${o.id}/start`, { ifMatch: o.rowVersion }).body as CleaningOrder;
      expect(cell('302-A').hygiene.code).toBe('HYG_CLEANING');
      o = llamar('POST', `/cleaning-orders/${o.id}/finish`, { ifMatch: o.rowVersion, body: {} }).body as CleaningOrder;
      expect(cell('302-A').hygiene.code).toBe('HYG_CLEAN');
      expect(cell('302-A').assignable).toBe(false); // falta la inspección
      persona('housekeeping-supervisor');
      const r = llamar('POST', `/cleaning-orders/${o.id}/inspect`, { ifMatch: o.rowVersion, body: { result: 'PASS' } });
      expect(r.status).toBe(200);
      expect(cell('302-A')).toMatchObject({ assignable: true, v2Code: 'U' });
      const higiene = events('302-A', 'axis=AXIS_HYGIENE').map((x) => x.to);
      expect(higiene.slice(0, 4).reverse()).toEqual(['HYG_DIRTY', 'HYG_CLEANING', 'HYG_CLEAN', 'HYG_INSPECTED']);
    });

    it('quien terminó la limpieza no puede inspeccionarla', () => {
      persona('housekeeping-supervisor');
      let o = orderOf('302-B');
      o = llamar('POST', `/cleaning-orders/${o.id}/start`, { ifMatch: o.rowVersion }).body as CleaningOrder;
      o = llamar('POST', `/cleaning-orders/${o.id}/finish`, { ifMatch: o.rowVersion, body: {} }).body as CleaningOrder;
      const r = llamar('POST', `/cleaning-orders/${o.id}/inspect`, { ifMatch: o.rowVersion, body: { result: 'PASS' } });
      expect(r.status).toBe(422);
      expect(reason(r)).toBe('INSPECTION_BY_CLEANER_NOT_ALLOWED');
    });

    it('rechazar exige motivo y abre una orden nueva por INSPECTION_FAILED; la cama vuelve a sucia', () => {
      persona('housekeeping-supervisor');
      const o = orderOf('311-A'); // ya terminada por limpieza
      expect(o.status).toBe('CLN_DONE');
      const sin = llamar('POST', `/cleaning-orders/${o.id}/inspect`, { ifMatch: o.rowVersion, body: { result: 'FAIL' } });
      expect(reason(sin)).toBe('INSPECTION_REASON_REQUIRED');
      expect(llamar('POST', `/cleaning-orders/${o.id}/inspect`, { ifMatch: o.rowVersion, body: { result: 'FAIL', reasonText: 'Quedó polvo en el barral' } }).status).toBe(200);
      const nueva = orderOf('311-A');
      expect(nueva).toMatchObject({ status: 'CLN_PENDING', trigger: 'CLN_TRG_INSPECTION_FAILED', previousOrderId: o.id });
      expect(cell('311-A').hygiene.code).toBe('HYG_DIRTY');
    });

    it('la limpieza terminal solo la inspecciona supervisión; enfermería sin supervisión recibe 403', () => {
      persona('housekeeping');
      let o = orderOf('UTI-4');
      expect(o.cleaningType).toBe('CLEAN_TERMINAL');
      o = llamar('POST', `/cleaning-orders/${o.id}/start`, { ifMatch: o.rowVersion }).body as CleaningOrder;
      o = llamar('POST', `/cleaning-orders/${o.id}/finish`, { ifMatch: o.rowVersion, body: {} }).body as CleaningOrder;
      persona('nurse');
      const r = llamar('POST', `/cleaning-orders/${o.id}/inspect`, { ifMatch: o.rowVersion, body: { result: 'PASS' } });
      expect(r.status).toBe(403);
      persona('nurse-supervisor');
      expect(llamar('POST', `/cleaning-orders/${o.id}/inspect`, { ifMatch: o.rowVersion, body: { result: 'PASS' } }).status).toBe(200);
      expect(cell('UTI-4')).toMatchObject({ assignable: true });
      expect(cell('UTI-4').hygiene.terminalRequired).toBe(false);
    });

    it('dos operarios toman la misma orden: gana el primero, el segundo recibe 412', () => {
      persona('housekeeping');
      const o = orderOf('302-B');
      expect(llamar('POST', `/cleaning-orders/${o.id}/start`, { ifMatch: o.rowVersion }).status).toBe(200);
      expect(llamar('POST', `/cleaning-orders/${o.id}/start`, { ifMatch: o.rowVersion }).status).toBe(412);
    });

    it('una transición inválida da 409 con from y to', () => {
      persona('housekeeping');
      const o = orderOf('302-B');
      const r = llamar('POST', `/cleaning-orders/${o.id}/finish`, { ifMatch: o.rowVersion, body: {} });
      expect(r.status).toBe(409);
      expect(reason(r)).toBe('CLEANING_ORDER_INVALID_TRANSITION');
    });

    it('marcar sucia una cama con orden abierta → 409 con la orden; marcar contaminada la escala a terminal', () => {
      const dirty = llamar('POST', `/care-spaces/${cell('302-B').id}/hygiene`, { body: { action: 'mark-dirty', reasonText: 'x' }, opsVersion: cell('302-B').opsVersion });
      expect(reason(dirty)).toBe('CLEANING_ORDER_ALREADY_OPEN');
      const cont = llamar('POST', `/care-spaces/${cell('302-B').id}/hygiene`, { body: { action: 'mark-contaminated', reasonText: 'Sangre' }, opsVersion: cell('302-B').opsVersion });
      expect(cont.status).toBe(200);
      expect(cell('302-B')).toMatchObject({ v2Code: 'K' });
      expect(orderOf('302-B')).toMatchObject({ cleaningType: 'CLEAN_TERMINAL', priority: 'CLN_PRIO_URGENT' });
    });

    it('la cola devuelve las abiertas por defecto, filtra por «mías» y no trae datos de paciente', () => {
      persona('housekeeping');
      expect(orders().every((o) => ['CLN_PENDING', 'CLN_IN_PROGRESS', 'CLN_DONE'].includes(o.status))).toBe(true);
      expect(orders('assignedTo=me').every((o) => o.assignedTo?.displayName === 'Rosa Condori')).toBe(true);
      expect(orders('status=CLN_INSPECTED')).toHaveLength(1);
      expect(JSON.stringify(orders())).not.toMatch(/initials|patient/);
    });

    it('un pedido de rutina sobre una cama con la bandera terminal → 422 TERMINAL_CLEANING_REQUIRED', () => {
      const abierta = orderOf('UTI-4');
      llamar('POST', `/cleaning-orders/${abierta.id}/cancel`, { ifMatch: abierta.rowVersion, body: { reason: 'Se repite el pedido' } });
      const r = llamar('POST', `/sites/${SITIO_SANLUCAS.id}/cleaning-orders`, { body: { careSpaceId: cell('UTI-4').id, typeCode: 'CLEAN_ROUTINE', priorityCode: 'CLN_PRIO_ROUTINE' } });
      expect(r.status).toBe(422);
      expect(reason(r)).toBe('TERMINAL_CLEANING_REQUIRED');
      const ok = llamar('POST', `/sites/${SITIO_SANLUCAS.id}/cleaning-orders`, { body: { careSpaceId: cell('UTI-4').id, typeCode: 'CLEAN_TERMINAL', priorityCode: 'CLN_PRIO_URGENT' } });
      expect(ok.status).toBe(201);
      expect(reason(llamar('POST', `/sites/${SITIO_SANLUCAS.id}/cleaning-orders`, { body: { careSpaceId: cell('UTI-4').id, typeCode: 'CLEAN_TERMINAL', priorityCode: 'CLN_PRIO_URGENT' } }))).toBe('CLEANING_ORDER_ALREADY_OPEN');
    });
  });

  describe('aislamiento (F2.5 #5)', () => {
    it('aéreo en un local sin AIIR validado → 422 con details.missing', () => {
      const r = llamar('POST', `/care-spaces/${cell('AIS-2A').id}/isolation`, { body: { isolationCode: 'ISO_AIRBORNE', reasonText: 'TBC' }, opsVersion: cell('AIS-2A').opsVersion });
      expect(r.status).toBe(422);
      expect(reason(r)).toBe('ISOLATION_ROOM_NOT_CAPABLE');
      expect((r.body as { details: { missing: string[] } }).details.missing).toEqual(['HVAC_VALIDATION']);
      const sin = llamar('POST', `/care-spaces/${cell('302-A').id}/isolation`, { body: { isolationCode: 'ISO_AIRBORNE', reasonText: 'TBC' }, opsVersion: cell('302-A').opsVersion });
      expect((sin.body as { details: { missing: string[] } }).details.missing).toEqual(expect.arrayContaining(['AIIR', 'NEGATIVE_PRESSURE']));
    });

    it('sin motivo clínico → 422 ISOLATION_REASON_REQUIRED', () => {
      const r = llamar('POST', `/care-spaces/${cell('302-A').id}/isolation`, { body: { isolationCode: 'ISO_CONTACT', reasonText: '' }, opsVersion: cell('302-A').opsVersion });
      expect(reason(r)).toBe('ISOLATION_REASON_REQUIRED');
    });

    it('en habitación compartida, la cama hermana libre queda bloqueada por cohorte; al levantar, orden TERMINAL y no asignable hasta inspección', () => {
      const r = llamar('POST', `/care-spaces/${cell('302-A').id}/isolation`, { body: { isolationCode: 'ISO_DROPLET', organismText: 'Influenza', reasonText: 'Cuadro respiratorio' }, opsVersion: cell('302-A').opsVersion });
      expect(r.status).toBe(200);
      const companions = (r.body as { companionBlocks: unknown[] }).companionBlocks;
      expect(companions).toHaveLength(1);
      expect(cell('302-A').v2Code).toBe('I');
      expect(cell('302-B')).toMatchObject({ v2Code: 'C' });
      expect(cell('302-B').availability.reasonCode).toBe('BLOCK_RSN_ISOLATION_COHORT');

      const lift = llamar('POST', `/care-spaces/${cell('302-A').id}/isolation`, { body: { isolationCode: 'ISO_NONE', reasonText: 'Alta del cuadro' }, opsVersion: cell('302-A').opsVersion });
      expect(lift.status).toBe(200);
      expect(cell('302-A')).toMatchObject({ assignable: false });
      expect(cell('302-A').hygiene.terminalRequired).toBe(true);
      expect(orderOf('302-A')).toMatchObject({ cleaningType: 'CLEAN_TERMINAL', trigger: 'CLN_TRG_ISOLATION_END' });
      expect(cell('302-B').availability.code).toBe('SPACE_OP_AVAILABLE');
    });

    it('limpieza no aísla: 403', () => {
      persona('housekeeping');
      const r = llamar('POST', `/care-spaces/${cell('302-A').id}/isolation`, { body: { isolationCode: 'ISO_CONTACT', reasonText: 'x' }, opsVersion: cell('302-A').opsVersion });
      expect(r.status).toBe(403);
    });
  });

  describe('el tiempo y el historial', () => {
    it('con el guion activo y el tiempo transcurrido, el sondeo ve la limpieza terminada y la reserva ocupada', () => {
      sessionStorage.removeItem('mock:infra-ops-drift');
      expect(cell('303-B').hygiene.code).toBe('HYG_CLEANING');
      expect(cell('303-A').occupancy.code).toBe('OCC_RESERVED');
      const t0 = Number(sessionStorage.getItem('mock:infra-ops-t0') ?? Date.now());
      applyDrift(t0 + 50_000);
      expect(cell('303-B').hygiene.code).toBe('HYG_CLEAN');
      expect(cell('303-A').occupancy.code).toBe('OCC_RESERVED');
      applyDrift(t0 + 110_000);
      expect(cell('303-A').occupancy.code).toBe('OCC_OCCUPIED');
      // idempotente: no se aplica dos veces
      const e = events('303-A').length;
      applyDrift(t0 + 200_000);
      expect(events('303-A')).toHaveLength(e);
    });

    it('el historial se pagina, filtra por eje y no se puede modificar por ninguna ruta', () => {
      expect(events('UTI-3', 'axis=AXIS_AVAILABILITY')).toHaveLength(1);
      expect(events('UTI-3', 'axis=AXIS_HYGIENE')).toHaveLength(0);
      expect(router.match('PATCH', `/care-spaces/${cell('UTI-3').id}/status-events`)).toBeNull();
      expect(router.match('DELETE', `/care-spaces/${cell('UTI-3').id}/status-events`)).toBeNull();
    });

    it('un espacio de otro tenant responde 404 en todas las lecturas de operación', () => {
      const ajeno = '00000000-0000-4000-a000-000000000000';
      for (const ruta of ['operational-state', 'blocks', 'status-events']) {
        expect(llamar('GET', `/care-spaces/${ajeno}/${ruta}`).status).toBe(404);
      }
    });
  });
});
