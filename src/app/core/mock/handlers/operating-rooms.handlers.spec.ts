import { HttpHeaders } from '@angular/common/http';

import type { OperatingRoomSummary, OrBlock, OrUtilization } from '../../data-access/operating-rooms/operating-rooms.types';
import type { SafetyChecklist, SurgicalCaseDetail, SurgicalCasePage } from '../../data-access/procedures/procedures.types';
import { SPECIALTY } from '../fixtures/concepts';
import { QUIROFANO_1, QUIROFANO_2, SITIO_SANLUCAS_NORTE, SITIOS_INFRA } from '../fixtures/infraestructura';
import { PATIENTS, PROFESSIONALS } from '../fixtures/people';
import { isMockReply, MockRouter, type MockMethod, type MockReply } from '../mock-router';
import { buscarUsuario, TENANT_CLINICA, TENANT_HOSPITAL } from '../mock-session';
import { fecha } from '../mock-store';
import { espacios, registrarInfraestructura } from './infrastructure.handlers';
import { registerOperatingRooms } from './operating-rooms.handlers';
import { registrarProcedimientos } from './procedures.handlers';

/**
 * La maqueta de F4 tiene que comportarse como el contrato (§F4.3 y §F4.5):
 * ventana reservada con preparación y limpieza, bloques con dueño, check-list
 * OMS bloqueante, aislamiento por tenant y errores con su `reason`.
 */
describe('handlers de quirófanos (F4)', () => {
  const router = new MockRouter();
  registrarProcedimientos(router);
  registrarInfraestructura(router);
  registerOperatingRooms(router);
  const jefe = buscarUsuario('quirofano')!;
  const facturacion = buscarUsuario('facturacion')!;
  const SITE = SITIOS_INFRA[0]!.id;

  interface Options {
    readonly body?: unknown;
    readonly tenant?: string | null;
    readonly ifMatch?: number;
    readonly user?: typeof jefe;
    readonly query?: Record<string, string>;
  }

  function call(method: MockMethod, path: string, options: Options = {}): { status: number; body: unknown } {
    const match = router.match(method, path);
    if (match === null) throw new Error(`No existe ${method} ${path}`);
    let headers = new HttpHeaders();
    const tenant = options.tenant === undefined ? TENANT_HOSPITAL : options.tenant;
    if (tenant !== null) headers = headers.set('X-Tenant-Id', tenant);
    if (options.ifMatch !== undefined) headers = headers.set('If-Match', `"${options.ifMatch}"`);
    const response = match.handler({
      method,
      path,
      params: match.params,
      query: new URLSearchParams(options.query ?? {}),
      body: options.body ?? null,
      headers,
      user: options.user ?? jefe,
    });
    return isMockReply(response) ? (response as MockReply) : { status: 200, body: response };
  }

  const reason = (r: { body: unknown }): unknown => (r.body as { reason?: unknown }).reason;

  /** Días desde hoy hasta el próximo `weekday` (0 = domingo) a partir de `min`. */
  function nextWeekday(weekday: number, min: number): number {
    let d = min;
    while (fecha(d).getDay() !== weekday) d += 1;
    return d;
  }

  function schedule(room: string, days: number, startHour: number, startMin: number, minutes: number, extra: Record<string, unknown> = {}) {
    const start = fecha(days, startHour, startMin);
    return call('POST', '/procedure-cases', {
      body: {
        custodianTenantId: TENANT_HOSPITAL,
        patientProfileId: PATIENTS[30]!.id,
        caseType: 'ELECTIVE',
        priority: 'ROUTINE',
        primarySurgeonProfileId: PROFESSIONALS[4]!.id,
        practiceSiteId: SITE,
        operatingRoomId: room,
        scheduledStartAt: start.toISOString(),
        scheduledEndAt: new Date(start.getTime() + minutes * 60_000).toISOString(),
        ...extra,
      },
    });
  }

  describe('salas', () => {
    it('lista los dos quirófanos de San Lucas con su preparación y limpieza', () => {
      const rooms = call('GET', `/sites/${SITE}/operating-rooms`).body as OperatingRoomSummary[];
      expect(rooms.map((r) => r.careSpace.code)).toEqual(['QX-01', 'QX-02']);
      expect(rooms[0]!.prepMinutes).toBe(20);
      expect(rooms[0]!.cleanupMinutes).toBe(30);
      // Forma de `OperatingRoomsReadUseCases.list`: la sala sin ruta ni estado.
      expect(Object.keys(rooms[0]!.careSpace).sort()).toEqual(['code', 'id', 'name']);
    });

    it('una sede de otro tenant responde 404, igual que una inexistente', () => {
      expect(call('GET', `/sites/${SITE}/operating-rooms`, { tenant: TENANT_CLINICA }).status).toBe(404);
      expect(call('GET', '/sites/no-existe/operating-rooms').status).toBe(404);
    });

    it('la agenda trae la sala resuelta y la ventana reservada; otro tenant no ve los casos', () => {
      const page = call('GET', '/procedure-cases').body as { items: (SurgicalCasePage['items'][number] & { reservedStartAt: string })[] };
      const withRoom = page.items.find((c) => c.operatingRoomId === QUIROFANO_1)!;
      expect(withRoom.operatingRoom?.code).toBe('QX-01');
      expect(Date.parse(withRoom.reservedStartAt)).toBe(Date.parse(String(withRoom.scheduledStartAt)) - 20 * 60_000);
      expect((call('GET', '/procedure-cases', { tenant: TENANT_CLINICA }).body as { total: number }).total).toBe(0);
      expect(call('GET', `/procedure-cases/${withRoom.id}`, { tenant: TENANT_CLINICA }).status).toBe(404);
    });
  });

  describe('programar (§F4.5 criterios 1 y 2)', () => {
    const saturday = nextWeekday(6, 7);

    it('un consultorio no es quirófano → 422 OPERATING_ROOM_INVALID_FUNCTION', () => {
      const consultorio = espacios.todos().find((e) => e.code === 'CE-01' && e.siteId === SITE)!;
      const r = schedule(consultorio.id, saturday, 9, 0, 60);
      expect(r.status).toBe(422);
      expect(reason(r)).toBe('OPERATING_ROOM_INVALID_FUNCTION');
    });

    it('otra sede → 422 OPERATING_ROOM_SITE_MISMATCH; otro tenant → 404', () => {
      expect(reason(schedule(QUIROFANO_2, saturday, 9, 0, 60, { practiceSiteId: SITIO_SANLUCAS_NORTE.id }))).toBe('OPERATING_ROOM_SITE_MISMATCH');
      expect(schedule(QUIROFANO_2, saturday, 9, 0, 60, { custodianTenantId: TENANT_CLINICA }).status).toBe(404);
    });

    it('la ventana de A (prep 20 + limpieza 30) bloquea a B a las 10:30 y deja a B a las 10:50', () => {
      expect(schedule(QUIROFANO_2, saturday, 8, 0, 120).status).toBe(201);
      const choque = schedule(QUIROFANO_2, saturday, 10, 30, 60);
      expect(choque.status).toBe(409);
      expect(reason(choque)).toBe('OPERATING_ROOM_SLOT_CONFLICT');
      const details = (choque.body as { details: { reservedEndAt: string; nextAvailableStartAt: string } }).details;
      expect(new Date(details.reservedEndAt).getHours()).toBe(10);
      expect(new Date(details.reservedEndAt).getMinutes()).toBe(30);
      expect(new Date(details.nextAvailableStartAt).getMinutes()).toBe(50);
      const libre = schedule(QUIROFANO_2, saturday, 10, 50, 60);
      expect(libre.status).toBe(201);
      expect(new Date((libre.body as { reservedStartAt: string }).reservedStartAt).getMinutes()).toBe(30);
    });

    it('sin rol de programación → 403 con los roles requeridos', () => {
      const r = schedule(QUIROFANO_2, saturday, 14, 0, 60, {});
      expect(r.status).toBe(201);
      const prohibido = call('POST', '/procedure-cases', { user: facturacion, body: {} });
      expect(prohibido.status).toBe(403);
      expect((prohibido.body as { details: { requiredRoles: string[] } }).details.requiredRoles).toContain('SURGERY_SCHEDULER');
    });
  });

  describe('bloques (§F4.5 criterio 3)', () => {
    const monday = nextWeekday(1, 5);

    it('un caso de otro servicio dentro del bloque de Traumatología → 409; el del dueño se liga', () => {
      const ajeno = schedule(QUIROFANO_1, monday, 9, 0, 60, { surgicalSpecialtyConceptId: SPECIALTY['CIRUGIA_GENERAL'] });
      expect(ajeno.status).toBe(409);
      expect(reason(ajeno)).toBe('OR_BLOCK_OWNED_BY_OTHER');
      const urgente = schedule(QUIROFANO_1, monday, 12, 0, 30, { surgicalSpecialtyConceptId: SPECIALTY['CIRUGIA_GENERAL'], caseType: 'URGENT' });
      expect(reason(urgente)).toBe('URGENCY_REASON_REQUIRED');
      const propio = schedule(QUIROFANO_1, monday, 9, 0, 60, { surgicalSpecialtyConceptId: SPECIALTY['TRAUMATOLOGIA'] });
      expect(propio.status).toBe(201);
      const caso = call('GET', `/procedure-cases/${(propio.body as { id: string }).id}`).body as SurgicalCaseDetail;
      expect(caso.case.block?.label).toContain('Traumatología');
    });

    it('liberar un bloque con casos → 422 OR_BLOCK_HAS_CASES; con versión vieja → 412', () => {
      const lista = call('GET', `/sites/${SITE}/or-blocks`, { query: { from: fecha(monday, 0).toISOString(), to: fecha(monday, 23).toISOString(), operatingRoomId: QUIROFANO_1 } }).body as OrBlock[];
      const bloque = lista[0]!;
      expect(bloque.cases.length).toBeGreaterThan(0);
      // `blockView` + uso: el dueño como ids con el rótulo de la API y los casos como ids.
      expect(bloque.owner).toEqual({ kind: 'SERVICE', clinicalUnitId: null, specialtyConceptId: SPECIALTY['TRAUMATOLOGIA'], surgeonProfileId: null, label: 'Traumatología y Ortopedia' });
      expect(bloque.cases.every((c) => typeof c === 'string')).toBe(true);
      expect(reason(call('POST', `/or-blocks/${bloque.id}/release`, { body: { reasonText: 'x' }, ifMatch: bloque.rowVersion }))).toBe('OR_BLOCK_HAS_CASES');
      expect(call('POST', `/or-blocks/${bloque.id}/release`, { body: { reasonText: 'x' }, ifMatch: bloque.rowVersion + 5 }).status).toBe(412);
    });

    it('alta: superpuesto → 409 OR_BLOCK_OVERLAP; en el pasado → 422; sin dueño → 422; facturación → 403', () => {
      const base = { operatingRoomId: QUIROFANO_1, ownerKind: 'SERVICE', specialtyConceptId: SPECIALTY['UROLOGIA'], startsAt: fecha(monday, 9).toISOString(), endsAt: fecha(monday, 11).toISOString() };
      expect(reason(call('POST', `/sites/${SITE}/or-blocks`, { body: base }))).toBe('OR_BLOCK_OVERLAP');
      expect(reason(call('POST', `/sites/${SITE}/or-blocks`, { body: { ...base, startsAt: fecha(-3, 9).toISOString(), endsAt: fecha(-3, 11).toISOString() } }))).toBe('OR_BLOCK_IN_PAST');
      expect(reason(call('POST', `/sites/${SITE}/or-blocks`, { body: { ...base, specialtyConceptId: undefined } }))).toBe('OR_BLOCK_OWNER_REQUIRED');
      expect(call('POST', `/sites/${SITE}/or-blocks`, { body: base, user: facturacion }).status).toBe(403);
    });

    it('una serie semanal crea una instancia por día elegido, y se libera con motivo', () => {
      const sunday = nextWeekday(0, 3);
      const r = call('POST', `/sites/${SITE}/or-blocks`, {
        body: { operatingRoomId: QUIROFANO_2, ownerKind: 'SERVICE', specialtyConceptId: SPECIALTY['UROLOGIA'], startsAt: fecha(sunday, 8).toISOString(), endsAt: fecha(sunday, 12).toISOString(), recurrence: { weekdays: [7], until: fecha(sunday + 14, 8).toISOString().slice(0, 10) } },
      });
      expect(r.status).toBe(201);
      const created = (r.body as { seriesId: string; blocks: OrBlock[] }).blocks;
      expect(created.length).toBe(3);
      const released = call('POST', `/or-blocks/${created[2]!.id}/release`, { body: { reasonText: 'Vacaciones' }, ifMatch: 1 }).body as OrBlock;
      expect(released.status).toBe('ORB_RELEASED');
      // La liberación devuelve `blockView`, sin uso ni casos.
      expect('cases' in released).toBe(false);
      expect(released.releaseReason).toBe('Vacaciones');
      expect(released.releasedMinutes).toBe(240);
    });
  });

  describe('check-list OMS bloqueante (§F4.5 criterio 4)', () => {
    it('Entrada antes de la anestesia, Pausa antes de la incisión, orden obligatorio', () => {
      const sat = nextWeekday(6, 7);
      const id = (schedule(QUIROFANO_1, sat, 13, 0, 60).body as { id: string }).id;
      const k = call('POST', `/procedure-cases/${id}/safety-checklists`);
      expect(k.status).toBe(201);
      expect(call('POST', `/procedure-cases/${id}/safety-checklists`).status).toBe(200);
      const checklist = k.body as SafetyChecklist;
      expect(checklist.phases.map((p) => p.items.length)).toEqual([7, 7, 5]);

      const now = new Date().toISOString();
      const event = (eventCode: string) => call('POST', `/procedure-cases/${id}/room-events`, { body: { eventCode, occurredAt: now } });
      expect(reason(event('ANESTHESIA_START'))).toBe('ROOM_EVENT_OUT_OF_ORDER');
      expect(event('PATIENT_IN_ROOM').status).toBe(201);
      expect(event('PATIENT_IN_ROOM').status).toBe(409);
      expect(reason(event('ANESTHESIA_START'))).toBe('CHECKLIST_SIGN_IN_REQUIRED');

      const answer = (phase: string, responses: unknown[]) =>
        call('POST', `/procedure-cases/${id}/safety-checklists/${checklist.id}/responses`, { body: { phase, respondedByProfileId: jefe.practitionerProfileId, responses } });
      const all = (phaseIndex: number, status = 'CONFIRMED') => checklist.phases[phaseIndex]!.items.map((i) => ({ itemId: i.id, status }));
      expect(reason(answer('TIME_OUT', all(1)))).toBe('CHECKLIST_PHASE_OUT_OF_ORDER');
      expect(reason(answer('SIGN_IN', all(0).slice(1)))).toBe('CHECKLIST_MANDATORY_ITEMS_MISSING');
      expect(reason(answer('SIGN_IN', all(0, 'EXCEPTION')))).toBe('CHECKLIST_EXCEPTION_REASON_REQUIRED');
      expect(answer('SIGN_IN', all(0)).status).toBe(201);
      expect(answer('SIGN_IN', all(0)).status).toBe(409);

      expect(event('ANESTHESIA_START').status).toBe(201);
      expect(reason(event('INCISION'))).toBe('CHECKLIST_TIME_OUT_REQUIRED');
      expect(answer('TIME_OUT', all(1)).status).toBe(201);
      expect(event('INCISION').status).toBe(201);
      expect(event('CLOSURE').status).toBe(201);
      expect(reason(event('PATIENT_OUT_OF_ROOM'))).toBe('CHECKLIST_SIGN_OUT_REQUIRED');
      expect(answer('SIGN_OUT', all(2)).status).toBe(201);
      expect(event('PATIENT_OUT_OF_ROOM').status).toBe(201);

      const detail = call('GET', `/procedure-cases/${id}`).body as SurgicalCaseDetail;
      expect(detail.roomEvents!.map((e) => e.eventCode)).toEqual(['PATIENT_IN_ROOM', 'ANESTHESIA_START', 'INCISION', 'CLOSURE', 'PATIENT_OUT_OF_ROOM']);
      // El check-list va en el detalle (`CaseOrViewBuilder.detail`), con la fecha por fase.
      expect(detail.checklist?.signOut.completedAt).not.toBeNull();
    });

    it('un evento con hora futura → 422 OCCURRED_AT_IN_FUTURE', () => {
      const sat = nextWeekday(6, 14);
      const id = (schedule(QUIROFANO_1, sat, 8, 0, 60).body as { id: string }).id;
      const r = call('POST', `/procedure-cases/${id}/room-events`, { body: { eventCode: 'PATIENT_IN_ROOM', occurredAt: fecha(2, 8).toISOString() } });
      expect(reason(r)).toBe('OCCURRED_AT_IN_FUTURE');
    });
  });

  describe('utilización (§F4.5 criterio 6)', () => {
    const range = { from: fecha(-14).toISOString().slice(0, 10), to: fecha(0).toISOString().slice(0, 10) };

    it('por sala y en total, con las fórmulas de la API (asOf y totals del servidor)', () => {
      const u = call('GET', `/sites/${SITE}/or-utilization`, { query: range }).body as OrUtilization;
      expect(u.rooms.length).toBeGreaterThan(0);
      expect(typeof u.asOf).toBe('string');
      const session = u.rooms.reduce((a, r) => a + r.sessionMinutes, 0);
      const touch = u.rooms.reduce((a, r) => a + r.touchMinutes, 0);
      const available = u.rooms.reduce((a, r) => a + r.blocks.allocated - r.blocks.released, 0);
      expect(u.totals).toEqual({ sessionMinutes: session, touchMinutes: touch, roomUtilizationPct: session > 0 ? (touch / session) * 100 : null, blockUtilizationPct: available > 0 ? (touch / available) * 100 : null });
      for (const r of u.rooms) {
        expect(Object.keys(r).sort()).toEqual(['blocks', 'code', 'operatingRoomId', 'roomUtilizationPct', 'sessionMinutes', 'touchMinutes', 'turnoverMinutesP50']);
        expect(r.roomUtilizationPct).toBe(r.sessionMinutes > 0 ? (r.touchMinutes / r.sessionMinutes) * 100 : null);
        const denominador = r.blocks.allocated - r.blocks.released;
        expect(r.blocks.blockUtilizationPct).toBe(denominador > 0 ? (r.touchMinutes / denominador) * 100 : null);
      }
      // Hay salas con dos casos en el período: el recambio existe.
      expect(u.rooms.some((r) => r.turnoverMinutesP50 !== null)).toBe(true);
    });

    it('una sala de otra sede o inexistente → 404', () => {
      expect(call('GET', `/sites/${SITE}/or-utilization`, { query: { ...range, operatingRoomId: 'no-existe' } }).status).toBe(404);
    });

    it('más de 366 días → 422 INDICATOR_RANGE_TOO_LONG', () => {
      expect(reason(call('GET', `/sites/${SITE}/or-utilization`, { query: { from: '2024-01-01', to: '2026-01-01' } }))).toBe('INDICATOR_RANGE_TOO_LONG');
    });
  });
});
