import { intervalOf, overlaps } from '../../data-access/operating-rooms/operating-rooms.rules';
import type { CreateOrBlockRequest, OperatingRoomSummary } from '../../data-access/operating-rooms/operating-rooms.types';
import type { MockRequest, MockRouter } from '../mock-router';
import { cuerpo, nuevoId, texto } from '../mock-store';
import { espacios } from './infrastructure.handlers';
import {
  blockOfCase,
  blocks,
  blockListRow,
  blockView,
  casesOfBlock,
  checklistOfCase,
  conflictReply,
  eventsOfCase,
  forbiddenReply,
  hasRole,
  notFoundReply,
  OPERATING_ROOM_FUNCTION,
  ownerLabelOf,
  preconditionReply,
  prepCleanupOf,
  releaseTick,
  roomOf,
  roomEvents,
  specialtyCodeOfConcept,
  turnoverOfCase,
  versionMismatch,
  visibleSite,
  windowOfCase,
  type SimulatedBlock,
} from './operating-rooms.state';
import { registerCaseFlow } from './periop-case-flow.handlers';
import { CASE_STATUS, connectOperatingRooms, periopCases } from './procedures.handlers';

/* ============================================================================
    Quirófanos — franja F4 (`CONTRATO-F2-F5.md` §F4.3): salas, bloques con
    liberación y utilización. La programación, el check-list y los tiempos de
    sala viven en `periop-case-flow.handlers.ts`.

    Lo que la maqueta hace igual que la API:
    - sede o bloque de otro tenant → 404; acción fuera de rol → 403 con
      `details.requiredRoles`;
    - bloques sin solape por sala (`ex_operating_room_blocks_time`, 409);
    - liberación automática al vencer el plazo sin casos (el tick corre antes
      de cada lectura) y manual con motivo; `If-Match` → 412;
    - utilización con las fórmulas del contrato, sobre los tiempos reales de
      los casos sembrados.
    ========================================================================== */

const MANAGER_ROLES = ['PERIOP_ADMIN'] as const;
/** Quién lee salas y bloques (`f4.or.read`): el equipo quirúrgico y la administración. Facturación no. */
const OR_READ_ROLES = ['PERIOP_ADMIN', 'SURGERY_SCHEDULER', 'PERIOP_NURSE', 'SURGEON', 'ANESTHESIOLOGIST', 'SECURITY_ADMIN'] as const;
const MAX_INSTANCES = 400;
const MAX_RANGE_DAYS = 366;

/** El próximo paso del recambio según su estado (`allowedCleaningActions` de F2). */
const TURNOVER_NEXT: Readonly<Record<string, string | undefined>> = { CLN_PENDING: 'start', CLN_IN_PROGRESS: 'finish', CLN_DONE: 'inspect' };
/** Agenda publicada de cada sala con actividad: 08:00–16:00 (la sesión). */

const sameDay = (iso: string, day: Date): boolean => {
  const d = new Date(iso);
  return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
};


function roomsOfSite(siteId: string) {
  return espacios.filtrar((e) => e.siteId === siteId && e.functionCode === OPERATING_ROOM_FUNCTION && e.statusCode !== 'SPACE_RETIRED');
}

function roomSummary(e: ReturnType<typeof roomsOfSite>[number]): OperatingRoomSummary {
  const today = new Date();
  return {
    careSpace: {
      id: e.id,
      code: e.code,
      name: e.name,
    },
    resourceId: e.schedulableResource === true ? `res-${e.id}` : null,
    prepMinutes: e.prepMinutes ?? 0,
    cleanupMinutes: e.cleanupMinutes ?? 0,
    todayCases: periopCases.todos().filter((c) => c.operatingRoomId === e.id && c.statusConceptId !== CASE_STATUS.CANCELADO && sameDay(c.scheduledStartAt, today)).length,
    todayBlocks: blocks.todos().filter((b) => b.operatingRoomId === e.id && b.status === 'ORB_ACTIVE' && sameDay(b.startsAt, today)).length,
  };
}

/* ---- alta de bloques ---------------------------------------------------------- */

function instancesOf(body: Partial<CreateOrBlockRequest>): { startsAt: string; endsAt: string }[] {
  const startsAt = body.startsAt!;
  const endsAt = body.endsAt!;
  if (body.recurrence === undefined) return [{ startsAt, endsAt }];
  const duration = Date.parse(endsAt) - Date.parse(startsAt);
  const until = Date.parse(`${body.recurrence.until}T23:59:59`);
  const weekdays = new Set(body.recurrence.weekdays);
  const out: { startsAt: string; endsAt: string }[] = [];
  for (let cursor = new Date(startsAt); cursor.getTime() <= until && out.length <= MAX_INSTANCES; cursor.setDate(cursor.getDate() + 1)) {
    const iso = cursor.getDay() === 0 ? 7 : cursor.getDay();
    if (weekdays.has(iso)) out.push({ startsAt: cursor.toISOString(), endsAt: new Date(cursor.getTime() + duration).toISOString() });
  }
  return out;
}

function createBlocks(request: MockRequest) {
  const site = visibleSite(request, request.params['siteId']);
  if (site === null) return notFoundReply();
  if (!hasRole(request, MANAGER_ROLES)) return forbiddenReply('Sólo la jefatura de quirófano asigna bloques.', MANAGER_ROLES);
  const body = cuerpo<CreateOrBlockRequest>(request);
  const room = roomOf(body.operatingRoomId);
  if (room === undefined || room.siteId !== site.id || room.functionCode !== OPERATING_ROOM_FUNCTION) {
    return preconditionReply('OR_BLOCK_INVALID_ROOM', 'El espacio elegido no es un quirófano de este establecimiento.');
  }
  const specialtyCode = specialtyCodeOfConcept(body.specialtyConceptId);
  if (body.specialtyConceptId && specialtyCode === null) return preconditionReply('OR_BLOCK_OWNER_REQUIRED', 'La especialidad no es del catálogo.');
  const ownerOk = body.ownerKind === 'SURGEON' ? Boolean(body.surgeonProfileId) : Boolean(specialtyCode || body.clinicalUnitId);
  if (!ownerOk) return preconditionReply('OR_BLOCK_OWNER_REQUIRED', 'Indique el servicio o el cirujano dueño del bloque.');
  if (!body.startsAt || !body.endsAt || Date.parse(body.endsAt) <= Date.parse(body.startsAt)) {
    return preconditionReply('OR_BLOCK_INVALID_RANGE', 'El bloque tiene que terminar después de empezar.');
  }
  if (Date.parse(body.startsAt) < Date.now()) return preconditionReply('OR_BLOCK_IN_PAST', 'No se asignan bloques en el pasado.');
  const instances = instancesOf(body);
  if (instances.length > MAX_INSTANCES) return preconditionReply('OR_BLOCK_TOO_MANY_INSTANCES', `Una serie admite hasta ${MAX_INSTANCES} bloques.`);
  for (const inst of instances) {
    const clash = blocks
      .todos()
      .find((b) => b.status === 'ORB_ACTIVE' && b.operatingRoomId === room.id && overlaps(intervalOf(b.startsAt, b.endsAt), intervalOf(inst.startsAt, inst.endsAt)));
    if (clash !== undefined) {
      return conflictReply('OR_BLOCK_OVERLAP', `Se superpone con el bloque de ${ownerLabelOf(clash)} del ${new Date(clash.startsAt).toLocaleDateString('es-BO')}.`, { conflictingBlockId: clash.id });
    }
  }
  const seriesId = body.recurrence === undefined ? null : nuevoId('or-series');
  const created = instances.map((inst) =>
    blocks.agregar({
      id: nuevoId('or-block'),
      tenantId: site.tenantId,
      siteId: site.id,
      seriesId,
      operatingRoomId: room.id,
      ownerKind: body.ownerKind === 'SURGEON' ? 'SURGEON' : 'SERVICE',
      clinicalUnitId: body.clinicalUnitId ?? null,
      specialtyCode,
      surgeonProfileId: body.surgeonProfileId ?? null,
      startsAt: inst.startsAt,
      endsAt: inst.endsAt,
      releaseHours: body.releaseHours ?? 72,
      status: 'ORB_ACTIVE',
      releasedAt: null,
      releasedByUserId: null,
      releaseReason: null,
      releasedMinutes: null,
      rowVersion: 1,
    }),
  );
  return { status: 201, body: { seriesId, blocks: created.map(blockView) } };
}

/** Liberar o cancelar: mismo camino, distinto estado final. */
function closeBlock(request: MockRequest, status: 'ORB_RELEASED' | 'ORB_CANCELLED') {
  const b = blocks.get(request.params['id']!);
  if (b === undefined || visibleSite(request, b.siteId) === null) return notFoundReply();
  if (!hasRole(request, MANAGER_ROLES)) return forbiddenReply('Sólo la jefatura de quirófano libera o cancela bloques.', MANAGER_ROLES);
  const stale = versionMismatch(request, b.rowVersion);
  if (stale !== null) return stale;
  if (b.status !== 'ORB_ACTIVE') return conflictReply('OR_BLOCK_NOT_ACTIVE', 'El bloque ya no está vigente.');
  const linked = casesOfBlock(b).filter((c) => c.statusConceptId !== CASE_STATUS.COMPLETADO);
  if (linked.length > 0) {
    return preconditionReply('OR_BLOCK_HAS_CASES', 'El bloque tiene casos programados: reubíquelos antes de liberarlo.', {
      cases: linked.map((c) => ({ id: c.id, caseNumber: c.caseNumber })),
    });
  }
  const reason = cuerpo<{ reasonText: string }>(request).reasonText ?? null;
  const minutes = Math.max(0, Math.round((Date.parse(b.endsAt) - Math.max(Date.now(), Date.parse(b.startsAt))) / 60_000));
  const updated = blocks.actualizar(b.id, {
    status,
    releasedAt: new Date().toISOString(),
    releasedByUserId: request.user?.id ?? null,
    releaseReason: reason,
    releasedMinutes: status === 'ORB_RELEASED' ? minutes : null,
    rowVersion: b.rowVersion + 1,
  })!;
  return blockView(updated);
}

/* ---- utilización ----------------------------------------------------------------- */

function utilization(request: MockRequest) {
  const site = visibleSite(request, request.params['siteId']);
  if (site === null) return notFoundReply();
  const from = texto(request.query, 'from');
  const to = texto(request.query, 'to');
  if (from === null || to === null || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return preconditionReply('INDICATOR_RANGE_TOO_LONG', 'Rango de fechas inválido');
  }
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`) + 86_400_000;
  if (!(end > start) || (end - start) / 86_400_000 > MAX_RANGE_DAYS) return preconditionReply('INDICATOR_RANGE_TOO_LONG', `El rango no puede superar ${MAX_RANGE_DAYS} días`);
  const roomFilter = texto(request.query, 'operatingRoomId');
  const allowed = roomsOfSite(site.id);
  if (roomFilter !== null && !allowed.some((r) => r.id === roomFilter)) return notFoundReply();
  const rooms = allowed.filter((r) => roomFilter === null || r.id === roomFilter);
  const minutes = (a?: string, b?: string): number => (a !== undefined && b !== undefined ? (Date.parse(b) - Date.parse(a)) / 60_000 : 0);

  // Misma cuenta que `OperatingRoomsReadUseCases.utilization` de la API.
  const result = rooms.map((room) => {
    const roomBlocks = blocks.todos().filter((b) => b.operatingRoomId === room.id && Date.parse(b.startsAt) < end && Date.parse(b.endsAt) > start);
    const byCase = new Map<string, Record<string, string>>();
    for (const e of roomEvents.todos()) {
      const c = periopCases.get(e.caseId);
      if (c === undefined || c.operatingRoomId !== room.id) continue;
      const at = Date.parse(e.occurredAt);
      if (at < start || at >= end) continue;
      byCase.set(e.caseId, { ...(byCase.get(e.caseId) ?? {}), [e.eventCode]: e.occurredAt });
    }
    const sessionMinutes = roomBlocks.filter((b) => b.status === 'ORB_ACTIVE').reduce((a, b) => a + minutes(b.startsAt, b.endsAt), 0);
    const touch = [...byCase.values()].reduce((a, m) => a + minutes(m['ANESTHESIA_START'], m['PATIENT_OUT_OF_ROOM']), 0);
    const sorted = [...byCase.values()].filter((m) => m['PATIENT_IN_ROOM'] !== undefined).sort((x, y) => x['PATIENT_IN_ROOM']!.localeCompare(y['PATIENT_IN_ROOM']!));
    const turnovers: number[] = [];
    for (let i = 1; i < sorted.length; i += 1) {
      const out = sorted[i - 1]!['PATIENT_OUT_OF_ROOM'];
      if (out !== undefined) turnovers.push(minutes(out, sorted[i]!['PATIENT_IN_ROOM']));
    }
    const allocated = roomBlocks.reduce((a, b) => a + minutes(b.startsAt, b.endsAt), 0);
    const released = roomBlocks.reduce((a, b) => a + (b.releasedMinutes ?? 0), 0);
    const p50 = turnovers.length === 0 ? null : [...turnovers].sort((x, y) => x - y)[Math.floor((turnovers.length - 1) / 2)]!;
    return {
      operatingRoomId: room.id,
      code: room.code,
      sessionMinutes,
      touchMinutes: touch,
      roomUtilizationPct: sessionMinutes > 0 ? (touch / sessionMinutes) * 100 : null,
      turnoverMinutesP50: p50,
      blocks: { allocated, released, blockUtilizationPct: allocated - released > 0 ? (touch / (allocated - released)) * 100 : null },
    };
  });
  // Como la API (`3036730d2`): `asOf` y `totals` calculados del lado servidor.
  const sum = (f: (r: (typeof result)[number]) => number): number => result.reduce((a, r) => a + f(r), 0);
  const session = sum((r) => r.sessionMinutes);
  const touch = sum((r) => r.touchMinutes);
  const available = sum((r) => r.blocks.allocated - r.blocks.released);
  return {
    from,
    to,
    asOf: new Date().toISOString(),
    totals: { sessionMinutes: session, touchMinutes: touch, roomUtilizationPct: session > 0 ? (touch / session) * 100 : null, blockUtilizationPct: available > 0 ? (touch / available) * 100 : null },
    rooms: result,
  };
}

/* ---- registro ------------------------------------------------------------------- */

export function registerOperatingRooms(router: MockRouter): void {
  connectOperatingRooms({
    visible: (c, tenant) => tenant === null || roomOf(c.operatingRoomId)?.tenantId === tenant,
    // Forma de `toSummary` + `CaseOrViewBuilder.fields` (API `3036730d2`).
    view: (c) => {
      const room = roomOf(c.operatingRoomId);
      const { prep, cleanup } = prepCleanupOf(c);
      const window = windowOfCase(c);
      const block = blockOfCase(c);
      const type = c.caseType ?? 'ELECTIVE';
      return {
        operatingRoom: room === undefined ? null : { id: room.id, code: room.code, name: room.name },
        reservedStartAt: window.reservedStartAt,
        reservedEndAt: window.reservedEndAt,
        prepMinutes: prep,
        cleanupMinutes: cleanup,
        block: block === undefined ? null : { id: block.id, label: ownerLabelOf(block) },
        caseType: { code: type, display: type === 'ELECTIVE' ? 'Electiva' : type === 'URGENT' ? 'Urgente' : 'Emergencia' },
        encounterId: c.encounterId ?? null,
      };
    },
    // Forma de `CaseOrViewBuilder.detail`: check-list, tiempos y recambio al nivel del detalle.
    detail: (c) => {
      const t = turnoverOfCase(c.id);
      const checklist = checklistOfCase(c.id);
      return {
        checklist:
          checklist === undefined
            ? null
            : { id: checklist.id, signIn: { completedAt: checklist.completedAt.SIGN_IN }, timeOut: { completedAt: checklist.completedAt.TIME_OUT }, signOut: { completedAt: checklist.completedAt.SIGN_OUT } },
        roomEvents: eventsOfCase(c.id).map(({ id, eventCode, occurredAt }) => ({ id, eventCode, occurredAt, recordedByUserId: null })),
        turnoverCleaning: t === undefined ? null : { id: t.id, status: t.status, rowVersion: t.rowVersion, allowedTransitions: TURNOVER_NEXT[t.status] === undefined ? [] : [TURNOVER_NEXT[t.status]!, 'cancel'] },
      };
    },
  });

  router.get('/sites/:siteId/operating-rooms', (request) => {
    const site = visibleSite(request, request.params['siteId']);
    if (site === null) return notFoundReply();
    if (!hasRole(request, OR_READ_ROLES)) return forbiddenReply('Su rol no consulta los quirófanos de la sede.', OR_READ_ROLES);
    return roomsOfSite(site.id).map(roomSummary);
  });

  router.get('/sites/:siteId/or-blocks', (request) => {
    const site = visibleSite(request, request.params['siteId']);
    if (site === null) return notFoundReply();
    if (!hasRole(request, OR_READ_ROLES)) return forbiddenReply('Su rol no consulta los bloques de quirófano.', OR_READ_ROLES);
    releaseTick();
    const from = Date.parse(texto(request.query, 'from') ?? '1970-01-01');
    const to = Date.parse(texto(request.query, 'to') ?? '2999-01-01');
    const room = texto(request.query, 'operatingRoomId');
    return blocks
      .todos()
      .filter((b: SimulatedBlock) => b.siteId === site.id && Date.parse(b.endsAt) > from && Date.parse(b.startsAt) < to)
      .filter((b) => room === null || b.operatingRoomId === room)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map(blockListRow);
  });

  router.post('/sites/:siteId/or-blocks', createBlocks);
  router.post('/or-blocks/:id/release', (request) => closeBlock(request, 'ORB_RELEASED'));
  router.post('/or-blocks/:id/cancel', (request) => closeBlock(request, 'ORB_CANCELLED'));
  router.get('/sites/:siteId/or-utilization', utilization);

  registerCaseFlow(router);
}

