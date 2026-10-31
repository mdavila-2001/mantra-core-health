import {
  CHECKLIST_PHASES,
  intervalOf,
  nextFreeStart,
  nextRoomEvent,
  overlaps,
  PHASE_LABELS,
  PHASE_REQUIRED_REASON,
  REQUIRED_PHASE,
  reservedWindow,
  ROOM_EVENT_LABELS,
  ROOM_EVENT_ORDER,
  type ChecklistPhaseCode,
  type RoomEventCode,
} from '../../data-access/operating-rooms/operating-rooms.rules';
import type { ChecklistPhaseSubmission, ScheduleCaseRequest } from '../../data-access/procedures/procedures.types';
import { SPECIALTY } from '../fixtures/concepts';
import type { MockRequest, MockRouter } from '../mock-router';
import { cuerpo, nuevoId } from '../mock-store';
import {
  blocks,
  CHECKLIST_ITEMS,
  checklistOfCase,
  checklists,
  conflictReply,
  eventsOfCase,
  forbiddenReply,
  hasRole,
  isLive,
  notFoundReply,
  OPERATING_ROOM_FUNCTION,
  ownerOf,
  ownsBlock,
  preconditionReply,
  roomEvents,
  roomOf,
  tenantOf,
  windowOfCase,
  type SimulatedChecklist,
} from './operating-rooms.state';
import { CASE_STATUS, MEMBER_STATUS, periopCases, TEAM_ROLE, type SimulatedCase } from './procedures.handlers';

/* ============================================================================
    El día del caso en la maqueta (F4): programar con ventana reservada,
    check-list OMS en tres fases y tiempos de sala en orden, con los gates que
    la API exige (`CONTRATO-F2-F5.md` §F4.3).
    ========================================================================== */

const SCHEDULER_ROLES = ['SURGERY_SCHEDULER', 'SURGEON', 'PERIOP_ADMIN'] as const;
const ROOM_ROLES = ['PERIOP_NURSE', 'SURGEON', 'ANESTHESIOLOGIST', 'PERIOP_ADMIN'] as const;
const CLOCK_SKEW_MS = 60_000;

/** El caso, si existe y es del tenant activo (por el tenant de su sala). */
function visibleCase(request: MockRequest): SimulatedCase | null {
  const c = periopCases.get(request.params['id']!);
  if (c === undefined) return null;
  const tenant = tenantOf(request);
  return tenant === null || roomOf(c.operatingRoomId)?.tenantId === tenant ? c : null;
}

function nextCaseNumber(): string {
  const max = periopCases.todos().reduce((m, c) => Math.max(m, Number(c.caseNumber.slice(-4)) || 0), 100);
  return `CX-2026-${String(max + 1).padStart(4, '0')}`;
}

/* ---- programar (validaciones 1–7 de §F4.3) ----------------------------------------- */

function scheduleCase(request: MockRequest) {
  if (!hasRole(request, SCHEDULER_ROLES)) return forbiddenReply('Su rol no permite programar intervenciones.', SCHEDULER_ROLES);
  const body = cuerpo<ScheduleCaseRequest>(request);
  const tenant = tenantOf(request);
  const room = roomOf(body.operatingRoomId);
  // 1. La sala existe en el tenant del custodio: si no, 404 (no se filtra existencia).
  if (room === undefined || (tenant !== null && room.tenantId !== tenant) || (body.custodianTenantId !== undefined && body.custodianTenantId !== room.tenantId)) {
    return notFoundReply();
  }
  // 2. Misma sede.
  if (body.practiceSiteId !== undefined && body.practiceSiteId !== room.siteId) {
    return preconditionReply('OPERATING_ROOM_SITE_MISMATCH', 'El quirófano elegido es de otro establecimiento.');
  }
  // 3. Función quirófano.
  if (room.functionCode !== OPERATING_ROOM_FUNCTION) {
    return preconditionReply('OPERATING_ROOM_INVALID_FUNCTION', `«${room.name}» no es un quirófano: no se programan cirugías ahí.`);
  }
  if (!body.scheduledStartAt || !body.scheduledEndAt || Date.parse(body.scheduledEndAt) <= Date.parse(body.scheduledStartAt)) {
    return preconditionReply('CASE_INVALID_TIME_RANGE', 'La intervención tiene que terminar después de empezar.');
  }
  if (Date.parse(body.scheduledStartAt) < Date.now()) return preconditionReply('CASE_IN_PAST', 'No se programan intervenciones en el pasado.');
  const prep = room.prepMinutes ?? 0;
  const cleanup = room.cleanupMinutes ?? 0;
  const window = reservedWindow(body.scheduledStartAt, body.scheduledEndAt, prep, cleanup);
  // 4. Ciclo de vida y disponibilidad en la ventana reservada.
  if (room.statusCode !== 'SPACE_ACTIVE' || (room.operationalStatusCode !== null && room.operationalStatusCode !== 'SPACE_OP_AVAILABLE')) {
    return preconditionReply('OPERATING_ROOM_NOT_AVAILABLE', `«${room.name}» no está disponible (suspendido o en mantenimiento).`, {
      block: { operationalStatus: room.operationalStatusCode },
    });
  }
  // 5. Recurso agendable (R0).
  if (room.schedulableResource !== true) {
    return preconditionReply('OPERATING_ROOM_WITHOUT_RESOURCE', `«${room.name}» todavía no es un recurso agendable.`);
  }
  if (body.caseType !== undefined && body.caseType !== 'ELECTIVE' && !body.urgencyReasonText?.trim()) {
    return preconditionReply('URGENCY_REASON_REQUIRED', 'Una intervención urgente o de emergencia exige justificar la urgencia.');
  }
  // 6. Bloques.
  const scheduled = intervalOf(body.scheduledStartAt, body.scheduledEndAt);
  const probe = { primarySurgeonProfileId: body.primarySurgeonProfileId ?? '', specialtyCode: specialtyCodeOf(body.surgicalSpecialtyConceptId) };
  const inBlock = blocks.todos().find((b) => b.status === 'ORB_ACTIVE' && b.operatingRoomId === room.id && overlaps(intervalOf(b.startsAt, b.endsAt), scheduled));
  let blockId: string | null = null;
  if (inBlock !== undefined) {
    if (ownsBlock(inBlock, probe)) {
      blockId = inBlock.id;
    } else if (body.caseType === undefined || body.caseType === 'ELECTIVE') {
      return conflictReply('OR_BLOCK_OWNED_BY_OTHER', `Ese horario es del bloque de ${ownerOf(inBlock).label}.`, { blockId: inBlock.id, owner: ownerOf(inBlock).label });
    }
  }
  // 7. Solape con ventanas reservadas (la EXCLUDE es la red).
  const mine = intervalOf(window.reservedStartAt, window.reservedEndAt);
  const taken = periopCases
    .todos()
    .filter((c) => isLive(c) && c.operatingRoomId === room.id)
    .map((c) => ({ c, w: windowOfCase(c) }));
  const clash = taken.find(({ w }) => overlaps(mine, intervalOf(w.reservedStartAt, w.reservedEndAt)));
  if (clash !== undefined) {
    const duration = Math.round((scheduled.end - scheduled.start) / 60_000);
    return conflictReply('OPERATING_ROOM_SLOT_CONFLICT', `La ventana reservada se cruza con ${clash.c.caseNumber} (incluye preparación y limpieza).`, {
      reservedStartAt: clash.w.reservedStartAt,
      reservedEndAt: clash.w.reservedEndAt,
      conflictingCaseId: clash.c.id,
      nextAvailableStartAt: nextFreeStart(scheduled.start, duration, prep, cleanup, taken.map(({ w }) => intervalOf(w.reservedStartAt, w.reservedEndAt))),
    });
  }
  const id = nuevoId('surgical-case');
  const surgeon = body.primarySurgeonProfileId ?? '';
  const created = periopCases.agregar({
    id,
    caseNumber: nextCaseNumber(),
    patientProfileId: body.patientProfileId ?? '',
    primarySurgeonProfileId: surgeon,
    operatingRoomId: room.id,
    statusConceptId: CASE_STATUS.PROGRAMADO,
    scheduledStartAt: new Date(body.scheduledStartAt).toISOString(),
    scheduledEndAt: new Date(body.scheduledEndAt).toISOString(),
    procedimiento: '',
    specialtyCode: probe.specialtyCode,
    caseType: body.caseType ?? 'ELECTIVE',
    prepMinutes: prep,
    cleanupMinutes: cleanup,
    blockId,
    checklistId: null,
    encounterId: null,
    urgencyReasonText: body.urgencyReasonText ?? null,
    equipo: [{ id: nuevoId('team'), practitionerProfileId: surgeon, teamRoleConceptId: TEAM_ROLE.CIRUJANO, statusConceptId: MEMBER_STATUS.ACEPTADO }],
  });
  return {
    status: 201,
    body: { id: created.id, caseNumber: created.caseNumber, statusConceptId: created.statusConceptId, operatingRoomId: room.id, milestoneId: nuevoId('milestone'), ...window },
  };
}

/** La especialidad que la pantalla manda como concepto, vuelta a su código. */
function specialtyCodeOf(conceptId: string | undefined): string | null {
  if (conceptId === undefined) return null;
  return SPECIALTY_CODE_BY_ID.get(conceptId) ?? conceptId;
}

/** `VS_MEDICAL_SPECIALTY` al revés: del concepto que manda la pantalla al código del bloque. */
const SPECIALTY_CODE_BY_ID = new Map(Object.entries(SPECIALTY).map(([code, id]) => [id, code]));

/* ---- check-list OMS ------------------------------------------------------------------ */

function checklistView(k: SimulatedChecklist, caseId: string) {
  return {
    id: k.id,
    procedureCaseId: caseId,
    version: '2009',
    phases: CHECKLIST_PHASES.map((phase) => ({
      phase,
      completedAt: k.completedAt[phase],
      items: CHECKLIST_ITEMS[phase].map((item) => {
        const r = k.responses[item.id];
        return {
          ...item,
          ...(r === undefined ? {} : { response: { status: r.status, respondedAt: r.respondedAt, ...(r.exceptionReason === null ? {} : { exceptionReason: r.exceptionReason }) } }),
        };
      }),
    })),
  };
}

function createChecklist(request: MockRequest) {
  const c = visibleCase(request);
  if (c === null) return notFoundReply();
  if (!hasRole(request, ROOM_ROLES)) return forbiddenReply('Su rol no registra el check-list quirúrgico.', ROOM_ROLES);
  if (c.statusConceptId === CASE_STATUS.CANCELADO) return conflictReply('CASE_CANCELLED', 'La intervención está cancelada.');
  const existing = checklistOfCase(c.id);
  if (existing !== undefined) return checklistView(existing, c.id);
  const created = checklists.agregar({ id: nuevoId('checklist'), caseId: c.id, responses: {}, completedAt: { SIGN_IN: null, TIME_OUT: null, SIGN_OUT: null } });
  periopCases.actualizar(c.id, { checklistId: created.id });
  return { status: 201, body: checklistView(created, c.id) };
}

function submitPhase(request: MockRequest) {
  const c = visibleCase(request);
  const k = checklists.get(request.params['checklistId']!);
  if (c === null || k === undefined || k.caseId !== c.id) return notFoundReply();
  if (!hasRole(request, ROOM_ROLES)) return forbiddenReply('Su rol no registra el check-list quirúrgico.', ROOM_ROLES);
  const body = cuerpo<ChecklistPhaseSubmission>(request);
  const phase = body.phase as ChecklistPhaseCode;
  if (!CHECKLIST_PHASES.includes(phase)) return preconditionReply('CHECKLIST_PHASE_INVALID', 'Fase desconocida.');
  if (k.completedAt[phase] !== null) return conflictReply('CHECKLIST_PHASE_ALREADY_COMPLETED', `La fase «${PHASE_LABELS[phase]}» ya está completa: sus respuestas no se cambian.`);
  const previous = CHECKLIST_PHASES[CHECKLIST_PHASES.indexOf(phase) - 1];
  if (previous !== undefined && k.completedAt[previous] === null) {
    return preconditionReply('CHECKLIST_PHASE_OUT_OF_ORDER', `Antes hay que completar «${PHASE_LABELS[previous]}».`);
  }
  const responses = body.responses ?? [];
  const byItem = new Map(responses.map((r) => [r.itemId, r]));
  const missing = CHECKLIST_ITEMS[phase].filter((item) => item.mandatory && !byItem.has(item.id));
  if (missing.length > 0) {
    return preconditionReply('CHECKLIST_MANDATORY_ITEMS_MISSING', `Faltan ${missing.length} ítems obligatorios de «${PHASE_LABELS[phase]}».`, { itemIds: missing.map((m) => m.id) });
  }
  const noReason = responses.find((r) => r.status === 'EXCEPTION' && !r.exceptionReason?.trim());
  if (noReason !== undefined) return preconditionReply('CHECKLIST_EXCEPTION_REASON_REQUIRED', 'Una excepción exige escribir el motivo.', { itemId: noReason.itemId });
  const now = new Date().toISOString();
  const merged = { ...k.responses };
  for (const r of responses) merged[r.itemId] = { status: r.status, exceptionReason: r.exceptionReason ?? null, respondedAt: now };
  checklists.actualizar(k.id, { responses: merged, completedAt: { ...k.completedAt, [phase]: now } });
  return { status: 201, body: { checklistId: k.id, recorded: responses.length, phaseCompleted: true } };
}

/* ---- tiempos de sala -------------------------------------------------------------------- */

function recordRoomEvent(request: MockRequest) {
  const c = visibleCase(request);
  if (c === null) return notFoundReply();
  if (!hasRole(request, ROOM_ROLES)) return forbiddenReply('Su rol no registra tiempos de sala.', ROOM_ROLES);
  const body = cuerpo<{ eventCode: string; occurredAt: string }>(request);
  const code = body.eventCode as RoomEventCode;
  if (!ROOM_EVENT_ORDER.includes(code)) return preconditionReply('ROOM_EVENT_UNKNOWN', 'Evento de sala desconocido.');
  const events = eventsOfCase(c.id);
  if (events.some((e) => e.eventCode === code)) return conflictReply('ROOM_EVENT_ALREADY_RECORDED', `«${ROOM_EVENT_LABELS[code]}» ya está registrado.`);
  const expected = nextRoomEvent(events.map((e) => e.eventCode));
  if (expected !== code) {
    return preconditionReply('ROOM_EVENT_OUT_OF_ORDER', `Antes corresponde «${ROOM_EVENT_LABELS[expected ?? code]}».`, { expected });
  }
  const occurredAt = body.occurredAt ?? new Date().toISOString();
  if (Date.parse(occurredAt) > Date.now() + CLOCK_SKEW_MS) return preconditionReply('OCCURRED_AT_IN_FUTURE', 'La hora del evento no puede ser futura.');
  const last = events.at(-1);
  if (last !== undefined && Date.parse(occurredAt) < Date.parse(last.occurredAt)) {
    return preconditionReply('ROOM_EVENT_OUT_OF_ORDER', `La hora es anterior a «${ROOM_EVENT_LABELS[last.eventCode as RoomEventCode]}».`);
  }
  const phase = REQUIRED_PHASE[code];
  if (phase !== undefined && (checklistOfCase(c.id)?.completedAt[phase] ?? null) === null) {
    return preconditionReply(PHASE_REQUIRED_REASON[phase], `Falta completar la fase «${PHASE_LABELS[phase]}» del check-list OMS.`);
  }
  const created = roomEvents.agregar({ id: nuevoId('room-event'), caseId: c.id, eventCode: code, occurredAt: new Date(occurredAt).toISOString(), recordedAt: new Date().toISOString() });
  if (code === 'PATIENT_IN_ROOM') periopCases.actualizar(c.id, { statusConceptId: CASE_STATUS.EN_CURSO });
  return { status: 201, body: { utilizationEventId: created.id, milestoneId: nuevoId('milestone') } };
}

export function registerCaseFlow(router: MockRouter): void {
  router.post('/procedure-cases', scheduleCase);
  router.post('/procedure-cases/:id/safety-checklists', createChecklist);
  router.get('/procedure-cases/:id/safety-checklists/:checklistId', (request) => {
    const c = visibleCase(request);
    const k = checklists.get(request.params['checklistId']!);
    return c === null || k === undefined || k.caseId !== c.id ? notFoundReply() : checklistView(k, c.id);
  });
  router.post('/procedure-cases/:id/safety-checklists/:checklistId/responses', submitPhase);
  router.post('/procedure-cases/:id/room-events', recordRoomEvent);
}
