import { blockUtilizationPct, intervalOf, median, overlaps, percentage } from '../../data-access/operating-rooms/operating-rooms.rules';
import type {
  BlockUtilization,
  CreateOrBlockRequest,
  OperatingRoomSummary,
  OwnerUtilization,
  RoomDayUtilization,
} from '../../data-access/operating-rooms/operating-rooms.types';
import type { MockRequest, MockRouter } from '../mock-router';
import { cuerpo, nuevoId, texto } from '../mock-store';
import { espacios } from './infrastructure.handlers';
import {
  blockOfCase,
  blocks,
  blockView,
  casesOfBlock,
  checklistOfCase,
  conflictReply,
  eventsOfCase,
  forbiddenReply,
  hasRole,
  notFoundReply,
  OPERATING_ROOM_FUNCTION,
  ownerOf,
  pathOf,
  preconditionReply,
  prepCleanupOf,
  releaseTick,
  roomOf,
  touchMinutes,
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
const MAX_INSTANCES = 400;
const MAX_RANGE_DAYS = 366;
/** Agenda publicada de cada sala con actividad: 08:00–16:00 (la sesión). */
const SESSION_HOURS = [8, 16] as const;
const ON_TIME_TOLERANCE_MINUTES = 5;

const sameDay = (iso: string, day: Date): boolean => {
  const d = new Date(iso);
  return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
};

const localDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
      path: pathOf(e.id),
      status: { code: e.statusCode, display: e.statusCode === 'SPACE_ACTIVE' ? 'Activo' : 'No disponible' },
      operationalStatus: e.operationalStatusCode === null ? null : { code: e.operationalStatusCode, display: e.operationalStatusCode === 'SPACE_OP_AVAILABLE' ? 'Disponible' : 'En mantenimiento' },
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
  const ownerOk = body.ownerKind === 'SURGEON' ? Boolean(body.surgeonProfileId) : Boolean(body.specialtyCode || body.clinicalUnitId);
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
      return conflictReply('OR_BLOCK_OVERLAP', `Se superpone con el bloque de ${ownerOf(clash).label} del ${new Date(clash.startsAt).toLocaleDateString('es-BO')}.`, { conflictingBlockId: clash.id });
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
      specialtyCode: body.specialtyCode ?? null,
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
  if (from === null || to === null) return preconditionReply('INDICATOR_RANGE_REQUIRED', 'Indique el período.');
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T23:59:59`);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (days > MAX_RANGE_DAYS) return preconditionReply('INDICATOR_RANGE_TOO_LONG', `El período no puede superar ${MAX_RANGE_DAYS} días.`);
  const roomFilter = texto(request.query, 'operatingRoomId');
  const rooms = roomsOfSite(site.id).filter((r) => roomFilter === null || r.id === roomFilter);

  const roomRows: RoomDayUtilization[] = [];
  const turnovers: number[] = [];
  const onTime: boolean[] = [];
  for (const room of rooms) {
    for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
      const cases = periopCases
        .todos()
        .filter((c) => c.operatingRoomId === room.id && c.statusConceptId !== CASE_STATUS.CANCELADO && sameDay(c.scheduledStartAt, day))
        .sort((a, b) => a.scheduledStartAt.localeCompare(b.scheduledStartAt));
      const dayBlocks = blocks.todos().filter((b) => b.operatingRoomId === room.id && b.status !== 'ORB_CANCELLED' && sameDay(b.startsAt, day));
      if (cases.length === 0 && dayBlocks.length === 0) continue;
      const session = { start: new Date(day).setHours(SESSION_HOURS[0], 0, 0, 0), end: new Date(day).setHours(SESSION_HOURS[1], 0, 0, 0) };
      const touch = cases.reduce((sum, c) => sum + touchMinutes(c.id, session), 0);
      const dayTurnovers: number[] = [];
      for (let i = 1; i < cases.length; i += 1) {
        const out = eventsOfCase(cases[i - 1]!.id).find((e) => e.eventCode === 'PATIENT_OUT_OF_ROOM');
        const next = eventsOfCase(cases[i]!.id).find((e) => e.eventCode === 'PATIENT_IN_ROOM');
        if (out !== undefined && next !== undefined) dayTurnovers.push(Math.round((Date.parse(next.occurredAt) - Date.parse(out.occurredAt)) / 60_000));
      }
      turnovers.push(...dayTurnovers);
      const first = cases[0];
      const firstIn = first === undefined ? undefined : eventsOfCase(first.id).find((e) => e.eventCode === 'PATIENT_IN_ROOM');
      const firstOnTime = first === undefined || firstIn === undefined ? null : Date.parse(firstIn.occurredAt) <= Date.parse(first.scheduledStartAt) + ON_TIME_TOLERANCE_MINUTES * 60_000;
      if (firstOnTime !== null) onTime.push(firstOnTime);
      const sessionMinutes = (session.end - session.start) / 60_000;
      roomRows.push({
        operatingRoomId: room.id,
        roomLabel: `${room.code} · ${room.name}`,
        date: localDate(day),
        sessionMinutes,
        touchMinutes: touch,
        roomUtilizationPct: percentage(touch, sessionMinutes),
        turnoverMinutes: median(dayTurnovers),
        firstCaseOnTimePct: firstOnTime === null ? null : firstOnTime ? 100 : 0,
        cases: cases.length,
      });
    }
  }

  const rangeBlocks = blocks
    .todos()
    .filter((b) => b.status !== 'ORB_CANCELLED' && rooms.some((r) => r.id === b.operatingRoomId))
    .filter((b) => Date.parse(b.startsAt) >= start.getTime() && Date.parse(b.startsAt) <= end.getTime())
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const blockRows: BlockUtilization[] = rangeBlocks.map((b) => {
    const window = intervalOf(b.startsAt, b.endsAt);
    const linked = casesOfBlock(b).sort((x, y) => x.scheduledStartAt.localeCompare(y.scheduledStartAt));
    const used = linked.reduce((sum, c) => sum + touchMinutes(c.id, window, 'PATIENT_IN_ROOM'), 0);
    let turnover = 0;
    for (let i = 1; i < linked.length; i += 1) {
      const out = eventsOfCase(linked[i - 1]!.id).find((e) => e.eventCode === 'PATIENT_OUT_OF_ROOM');
      const next = eventsOfCase(linked[i]!.id).find((e) => e.eventCode === 'PATIENT_IN_ROOM');
      if (out !== undefined && next !== undefined) turnover += Math.max(0, Math.round((Math.min(Date.parse(next.occurredAt), window.end) - Math.max(Date.parse(out.occurredAt), window.start)) / 60_000));
    }
    const allocated = Math.round((window.end - window.start) / 60_000);
    const released = b.releasedMinutes ?? 0;
    return {
      blockId: b.id,
      operatingRoomId: b.operatingRoomId,
      owner: ownerOf(b).label,
      startsAt: b.startsAt,
      allocatedMinutes: allocated,
      releasedMinutes: released,
      usedInBlockMinutes: used,
      turnoverInBlockMinutes: turnover,
      blockUtilizationPct: blockUtilizationPct(allocated, released, used, turnover),
    };
  });

  const owners = new Map<string, { allocated: number; released: number; used: number; turnover: number }>();
  for (const row of blockRows) {
    const acc = owners.get(row.owner) ?? { allocated: 0, released: 0, used: 0, turnover: 0 };
    owners.set(row.owner, { allocated: acc.allocated + row.allocatedMinutes, released: acc.released + row.releasedMinutes, used: acc.used + row.usedInBlockMinutes, turnover: acc.turnover + row.turnoverInBlockMinutes });
  }
  const ownerRows: OwnerUtilization[] = [...owners.entries()].map(([owner, a]) => ({
    owner,
    allocatedMinutes: a.allocated,
    releasedMinutes: a.released,
    usedInBlockMinutes: a.used,
    blockUtilizationPct: blockUtilizationPct(a.allocated, a.released, a.used, a.turnover),
  }));

  const sumOf = (rows: readonly RoomDayUtilization[], key: 'sessionMinutes' | 'touchMinutes') => rows.reduce((s, r) => s + r[key], 0);
  const totalsBlock = [...owners.values()].reduce((s, a) => ({ allocated: s.allocated + a.allocated, released: s.released + a.released, used: s.used + a.used, turnover: s.turnover + a.turnover }), { allocated: 0, released: 0, used: 0, turnover: 0 });
  return {
    from,
    to,
    asOf: new Date().toISOString(),
    totals: {
      sessionMinutes: sumOf(roomRows, 'sessionMinutes'),
      touchMinutes: sumOf(roomRows, 'touchMinutes'),
      roomUtilizationPct: percentage(sumOf(roomRows, 'touchMinutes'), sumOf(roomRows, 'sessionMinutes')),
      turnoverMinutes: median(turnovers),
      firstCaseOnTimePct: percentage(onTime.filter(Boolean).length, onTime.length),
      blockUtilizationPct: blockUtilizationPct(totalsBlock.allocated, totalsBlock.released, totalsBlock.used, totalsBlock.turnover),
    },
    rooms: roomRows,
    blocks: blockRows,
    owners: ownerRows,
  };
}

/* ---- registro ------------------------------------------------------------------- */

export function registerOperatingRooms(router: MockRouter): void {
  connectOperatingRooms({
    visible: (c, tenant) => tenant === null || roomOf(c.operatingRoomId)?.tenantId === tenant,
    view: (c) => {
      const room = roomOf(c.operatingRoomId);
      const { prep, cleanup } = prepCleanupOf(c);
      const window = windowOfCase(c);
      const block = blockOfCase(c);
      const checklist = checklistOfCase(c.id);
      return {
        operatingRoom: room === undefined ? null : { id: room.id, code: room.code, name: room.name, path: pathOf(room.id) },
        practiceSiteId: room?.siteId ?? null,
        reservedStartAt: window.reservedStartAt,
        reservedEndAt: window.reservedEndAt,
        prepMinutes: prep,
        cleanupMinutes: cleanup,
        block: block === undefined ? null : { id: block.id, owner: ownerOf(block).label },
        checklist: checklist === undefined ? null : { id: checklist.id, signIn: checklist.completedAt.SIGN_IN, timeOut: checklist.completedAt.TIME_OUT, signOut: checklist.completedAt.SIGN_OUT },
        caseType: c.caseType ?? 'ELECTIVE',
        encounterId: c.encounterId ?? null,
      };
    },
    detail: (c) => {
      const t = turnoverOfCase(c.id);
      return {
        roomEvents: eventsOfCase(c.id).map(({ id, eventCode, occurredAt, recordedAt }) => ({ id, eventCode, occurredAt, recordedAt })),
        // Desvío anotado: la orden de recambio de la sala, para operar la limpieza desde la ficha.
        turnoverCleaning: t === undefined ? null : { id: t.id, status: t.status, rowVersion: t.rowVersion },
      };
    },
  });

  router.get('/sites/:siteId/operating-rooms', (request) => {
    const site = visibleSite(request, request.params['siteId']);
    return site === null ? notFoundReply() : roomsOfSite(site.id).map(roomSummary);
  });

  router.get('/sites/:siteId/or-blocks', (request) => {
    const site = visibleSite(request, request.params['siteId']);
    if (site === null) return notFoundReply();
    releaseTick();
    const from = Date.parse(texto(request.query, 'from') ?? '1970-01-01');
    const to = Date.parse(texto(request.query, 'to') ?? '2999-01-01');
    const room = texto(request.query, 'operatingRoomId');
    const owner = texto(request.query, 'owner');
    return blocks
      .todos()
      .filter((b: SimulatedBlock) => b.siteId === site.id && Date.parse(b.endsAt) > from && Date.parse(b.startsAt) < to)
      .filter((b) => room === null || b.operatingRoomId === room)
      .filter((b) => owner === null || ownerOf(b).label === owner || b.specialtyCode === owner || b.surgeonProfileId === owner)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map(blockView);
  });

  router.post('/sites/:siteId/or-blocks', createBlocks);
  router.post('/or-blocks/:id/release', (request) => closeBlock(request, 'ORB_RELEASED'));
  router.post('/or-blocks/:id/cancel', (request) => closeBlock(request, 'ORB_CANCELLED'));
  router.get('/sites/:siteId/or-utilization', utilization);

  registerCaseFlow(router);
}

