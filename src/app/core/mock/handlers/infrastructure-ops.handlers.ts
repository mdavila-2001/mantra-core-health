import { isTerminal } from '../../data-access/infrastructure-ops/infrastructure-ops.logic';
import type {
  AvailabilityRequest,
  BedBoardCell,
  BlockKind,
  CareSpaceBlock,
  CleaningOrder,
  CleaningPriority,
  CleaningStatus,
  CleaningType,
  FutureCommitment,
  HygieneRequest,
  IsolationRequest,
  OpsAction,
  OpsCatalogExtension,
  V2Code,
} from '../../data-access/infrastructure-ops/infrastructure-ops.types';
import { c, type EspacioSim } from '../fixtures/infrastructure.data';
import { notFound, reply, type MockReply, type MockRequest, type MockRouter } from '../mock-router';
import { ahora, cuerpo, iso, nuevoId, uuid } from '../mock-store';
import { atrasoDeLectura, conflicto, descendientes, espacioPropio, espacios, falla, hijosDe, regla, sitioPropio } from './infrastructure.store';
import { applyDrift } from './infrastructure-ops.drift';
import { can, inScope, PERSONAS, personaOf, viewerOf, type Persona } from './infrastructure-ops.personas';
import {
  blocks,
  boardUnits,
  ensureState,
  events,
  isOnBoard,
  isOperable,
  openOrderOf,
  opsRequestId,
  opsStates,
  orders,
  pathLabel,
  pushEvent,
  toCell,
  unitOf,
  type BlockSim,
  type OrderSim,
} from './infrastructure-ops.store';

/* ============================================================================
    Backend simulado de la operación de camas y salas — franja F2.

    Contesta cada fila de la tabla de F2.3 de `CONTRATO-F2-F5.md` con su cuerpo y
    sus errores: 422 `BLOCK_REASON_REQUIRED`, `BLOCK_EXPECTED_END_REQUIRED`…,
    409 `SPACE_OCCUPIED`, `FUTURE_COMMITMENTS_CONFLICT` con la lista de
    compromisos, 412 `OPS_VERSION_MISMATCH` ante un `If-Match-Ops` viejo, 403
    `INFRA_ACTION_NOT_ALLOWED` según la persona (ver `personas.ts`) y 404 ante
    un id de otro tenant. El `reason` viaja en `details.reason`.

    Cada mutación sube `ops_version`, deja evento A20 append-only y recalcula el
    `v2Code`; ninguna escribe la ocupación (INV-24).

    ## Simplificaciones

    - Los compromisos futuros de un quirófano son datos fijos con los ids de
      cirugía de `procedures.handlers.ts` (`surgical-case-4/5/6`).
    - El umbral de validación de climatización es de 365 días
      (`infra.hvac_validation_max_days`).
    - La cola, sin `status`, devuelve las órdenes abiertas.
    ========================================================================== */

const BLOCK_REASON_KINDS: Readonly<Record<string, readonly BlockKind[]>> = {
  BLOCK_RSN_STAFF_SHORTAGE: ['BLOCK_CLINICAL', 'BLOCK_ADMIN'],
  BLOCK_RSN_ISOLATION_COHORT: ['BLOCK_CLINICAL'],
  BLOCK_RSN_PATIENT_CONDITION: ['BLOCK_CLINICAL'],
  BLOCK_RSN_EQUIPMENT_FAILURE: ['BLOCK_MAINTENANCE'],
  BLOCK_RSN_PREVENTIVE_MAINTENANCE: ['BLOCK_MAINTENANCE'],
  BLOCK_RSN_INFRASTRUCTURE: ['BLOCK_MAINTENANCE', 'BLOCK_CLOSURE'],
  BLOCK_RSN_PEST_CONTROL: ['BLOCK_MAINTENANCE'],
  BLOCK_RSN_ADMIN_DECISION: ['BLOCK_ADMIN', 'BLOCK_CLOSURE'],
  BLOCK_RSN_OTHER: ['BLOCK_CLINICAL', 'BLOCK_ADMIN', 'BLOCK_MAINTENANCE', 'BLOCK_CLOSURE'],
};

const REASON_DISPLAY: Readonly<Record<string, string>> = {
  BLOCK_RSN_STAFF_SHORTAGE: 'Falta de personal',
  BLOCK_RSN_ISOLATION_COHORT: 'Cohorte de aislamiento',
  BLOCK_RSN_PATIENT_CONDITION: 'Condición del paciente',
  BLOCK_RSN_EQUIPMENT_FAILURE: 'Falla de equipo',
  BLOCK_RSN_PREVENTIVE_MAINTENANCE: 'Mantenimiento preventivo',
  BLOCK_RSN_INFRASTRUCTURE: 'Falla de infraestructura',
  BLOCK_RSN_PEST_CONTROL: 'Control de plagas',
  BLOCK_RSN_ADMIN_DECISION: 'Decisión administrativa',
  BLOCK_RSN_OTHER: 'Otro motivo',
};

/** Lo que el catálogo de F1 suma en F2 (§F2.3, fila del catálogo). */
export const OPS_CATALOG: OpsCatalogExtension = {
  availability: [
    c('SPACE_OP_AVAILABLE', 'Disponible'),
    c('SPACE_OP_BLOCKED_CLINICAL', 'Bloqueo clínico'),
    c('SPACE_OP_BLOCKED_ADMIN', 'Bloqueo administrativo'),
    c('SPACE_OP_MAINTENANCE', 'Mantenimiento'),
    c('SPACE_OP_CLOSED', 'Cerrada'),
  ],
  hygiene: [
    c('HYG_CLEAN', 'Limpia'),
    c('HYG_DIRTY', 'Sucia'),
    c('HYG_CLEANING', 'En limpieza'),
    c('HYG_INSPECTED', 'Inspeccionada'),
    c('HYG_CONTAMINATED', 'Contaminada'),
  ],
  isolation: [
    c('ISO_NONE', 'Sin aislamiento'),
    c('ISO_CONTACT', 'Contacto'),
    c('ISO_DROPLET', 'Gotas'),
    c('ISO_AIRBORNE', 'Aéreo'),
    c('ISO_PROTECTIVE', 'Protector'),
  ],
  occupancy: [c('OCC_FREE', 'Libre'), c('OCC_RESERVED', 'Reservada'), c('OCC_OCCUPIED', 'Ocupada')],
  blockReasons: Object.entries(BLOCK_REASON_KINDS).map(([code, kinds]) => ({ code, display: REASON_DISPLAY[code]!, kinds })),
  cleaningTypes: [
    c('CLEAN_ROUTINE', 'Rutina'),
    c('CLEAN_DISCHARGE', 'Alta'),
    c('CLEAN_TERMINAL', 'Terminal'),
    c('CLEAN_OR_TURNOVER', 'Cambio de quirófano'),
    c('CLEAN_SPOT', 'Puntual'),
  ],
  cleaningPriorities: [c('CLN_PRIO_ROUTINE', 'Rutina'), c('CLN_PRIO_URGENT', 'Urgente'), c('CLN_PRIO_STAT', 'Inmediata')],
  v2Map: [
    { rule: 1, condition: 'Disponibilidad distinta de «disponible», o ciclo de vida inactivo', code: 'C' },
    { rule: 2, condition: 'Higiene contaminada', code: 'K' },
    { rule: 3, condition: 'Con aislamiento', code: 'I' },
    { rule: 4, condition: 'Ocupada', code: 'O' },
    { rule: 5, condition: 'Reservada', code: 'R' },
    { rule: 6, condition: 'Sucia, en limpieza, limpia sin inspeccionar o con limpieza terminal pendiente', code: 'H' },
    { rule: 7, condition: 'El resto', code: 'U' },
  ],
};

/* ---- respuestas de error ----------------------------------------------------- */

function notAllowed(persona: Persona, action: OpsAction, reason = 'INFRA_ACTION_NOT_ALLOWED'): MockReply {
  return reply(403, {
    statusCode: 403,
    code: 'FORBIDDEN',
    message: `Su rol (${persona.role}) no permite esta acción.`,
    error: 'Forbidden',
    details: { reason, requiredRoles: reason === 'ISOLATION_COHORT_REQUIRES_APPROVAL' ? ['INFECTION_CONTROL'] : rolesFor(action) },
    correlationId: opsRequestId(),
    timestamp: new Date().toISOString(),
    path: '',
  });
}

function rolesFor(action: string): string[] {
  switch (action) {
    case 'block-clinical':
      return ['NURSING', 'OR_MANAGER'];
    case 'block-administrative':
    case 'close':
      return ['ADMIN'];
    case 'maintenance':
      return ['MAINTENANCE', 'ADMIN'];
    case 'inspect':
    case 'inspect-terminal':
      return ['NURSE_SUPERVISOR', 'HOUSEKEEPING_SUPERVISOR'];
    default:
      return ['NURSING'];
  }
}

const versionMismatch = (latest: number, sent: number | null): MockReply =>
  falla(412, 'CONCURRENCY_CONFLICT', 'OPS_VERSION_MISMATCH', 'Otra persona cambió el estado de esta cama.', {
    expectedVersion: sent,
    latestVersion: latest,
  });

function opsVersionOf(request: MockRequest): number | null {
  const raw = request.headers.get('If-Match-Ops');
  const n = raw === null ? NaN : Number(raw.replace(/"/g, ''));
  return Number.isFinite(n) ? n : null;
}

function rowVersionOf(request: MockRequest): number | null {
  const raw = request.headers.get('If-Match');
  const n = raw === null ? NaN : Number(raw.replace(/"/g, ''));
  return Number.isFinite(n) ? n : null;
}

/* ---- compromisos futuros de los quirófanos ---------------------------------------- */

interface Commitment extends FutureCommitment {
  readonly endsAt: string;
}

function commitmentsOf(e: EspacioSim, from: string, to: string | null): FutureCommitment[] {
  const all: Commitment[] =
    e.code === 'QX-1'
      ? [
          { kind: 'PROCEDURE_CASE', id: nuevoIdFor('surgical-case-6'), startsAt: iso(0, 14), endsAt: iso(0, 16), nextAction: 'Cirugía en curso hoy: espere a que termine o reprográmela en Intervenciones.' },
          { kind: 'PROCEDURE_CASE', id: nuevoIdFor('surgical-case-4'), startsAt: iso(3, 8), endsAt: iso(3, 10), nextAction: 'Reprogramar o cancelar la cirugía en Intervenciones.' },
        ]
      : e.code === 'QX-2'
        ? [{ kind: 'PROCEDURE_CASE', id: nuevoIdFor('surgical-case-5'), startsAt: iso(6, 11), endsAt: iso(6, 13), nextAction: 'Reprogramar o cancelar la cirugía en Intervenciones.' }]
        : [];
  const start = new Date(from).getTime();
  const end = to === null ? Number.POSITIVE_INFINITY : new Date(to).getTime();
  return all
    .filter((x) => new Date(x.startsAt).getTime() < end && new Date(x.endsAt).getTime() > start)
    .map(({ endsAt: _endsAt, ...rest }) => rest);
}

const nuevoIdFor = (seed: string): string => uuid(seed);

/* ---- transiciones de estado -------------------------------------------------------- */

function touch(e: EspacioSim, patch: Parameters<typeof opsStates.actualizar>[1]): void {
  const st = ensureState(e);
  opsStates.actualizar(e.id, { ...patch, opsVersion: st.opsVersion + 1, lastEventAt: new Date().toISOString() });
}

function setAvailability(e: EspacioSim, code: BedBoardCell['availability']['code'], extra: { reasonCode?: string | null; reasonText?: string | null; expected?: string | null } = {}): void {
  touch(e, {
    availability: code,
    availabilityReasonCode: extra.reasonCode ?? null,
    availabilityReasonText: extra.reasonText ?? null,
    availabilityExpected: extra.expected ?? null,
    availabilitySince: new Date().toISOString(),
  });
  espacios.actualizar(e.id, { operational: code });
}

function setHygiene(e: EspacioSim, code: BedBoardCell['hygiene']['code'], terminal?: boolean): void {
  touch(e, {
    hygiene: code,
    hygieneSince: new Date().toISOString(),
    ...(terminal === undefined ? {} : { terminalRequired: terminal }),
  });
}

function v2Now(e: EspacioSim): V2Code {
  return toCell(e, personaOfSystem).v2Code;
}
const personaOfSystem = { key: 'system', role: 'SUPPORT', userId: 'system', displayName: 'Sistema', actions: [], seesPatient: false } as const satisfies Persona;

function createOrder(
  e: EspacioSim,
  type: CleaningType,
  trigger: CleaningOrder['trigger'],
  priority: CleaningPriority,
  note: string | null,
  previous: string | null = null,
): OrderSim {
  const unit = unitOf(e);
  const row: OrderSim = {
    id: nuevoId('ops-order'),
    siteId: e.siteId,
    careSpace: { id: e.id, code: e.code, name: e.name, pathLabel: pathLabel(e) },
    clinicalUnit: unit === null ? null : { id: unit.id, name: unit.name },
    cleaningType: type,
    trigger,
    priority,
    status: 'CLN_PENDING',
    requestedAt: ahora(),
    dueAt: null,
    assignedTo: null,
    startedAt: null,
    finishedAt: null,
    finishedByUserId: null,
    inspectedAt: null,
    inspectionResult: null,
    rejectionReason: null,
    cancelReason: null,
    previousOrderId: previous,
    note,
    rowVersion: 1,
  };
  return orders.agregar(row);
}

function emit(e: EspacioSim, persona: Persona, axis: Parameters<typeof pushEvent>[1], from: string | null, to: string, o: Parameters<typeof pushEvent>[4] = {}): void {
  pushEvent(e, axis, from, to, { by: persona.displayName, v2: v2Now(e), ...o });
}

/* ---- rutas -------------------------------------------------------------------------- */

export function registerInfrastructureOps(router: MockRouter): void {
  /* tablero */
  router.get('/sites/:siteId/bed-board', (request) => {
    const site = sitioPropio(request.params['siteId']!);
    if (site === undefined) return notFound();
    applyDrift();
    const persona = personaOf(request);
    const q = request.query;
    const unitId = q.get('unitId');
    const parentId = q.get('parentSpaceId');
    const functions = (q.get('functionCodes') ?? '').split(',').filter(Boolean);
    const v2 = (q.get('v2Codes') ?? '').split(',').filter(Boolean);
    const scope = parentId === null ? null : new Set([parentId, ...descendientes(parentId).map((d) => d.id)]);
    let units = boardUnits(site.id, persona, (e) => (scope === null || scope.has(e.id)) && (functions.length === 0 || functions.includes(e.function)));
    if (unitId !== null) units = units.filter((u) => u.unitId === unitId);
    if (v2.length > 0) {
      units = units.map((u) => ({ ...u, cells: u.cells.filter((cell) => v2.includes(cell.v2Code)) }));
    }
    const delay = atrasoDeLectura();
    const generatedAt = new Date(Date.now() - delay * 60_000).toISOString();
    const lastEventAt = units.flatMap((u) => u.cells).map((x) => x.lastEventAt).sort().at(-1) ?? generatedAt;
    return {
      status: 200,
      headers: { 'X-Data-As-Of': lastEventAt },
      body: { generatedAt, lastEventAt, units, nextCursor: null, viewer: viewerOf(persona) },
    } satisfies MockReply;
  });

  router.get('/care-spaces/:id/operational-state', (request) => {
    const e = espacioPropio(request.params['id']!);
    if (e === undefined || !isOnBoard(e)) return notFound();
    applyDrift();
    const persona = personaOf(request);
    ensureState(e);
    return {
      ...toCell(e, persona),
      openBlocks: blocks.filtrar((b) => b.careSpaceId === e.id && b.endedAt === null && b.cancelledAt === null),
      openCleaningOrder: openOrderOf(e.id) ?? null,
      viewer: viewerOf(persona),
    };
  });

  router.post('/care-spaces/:id/availability', (request) => {
    const e = espacioPropio(request.params['id']!);
    if (e === undefined || !isOnBoard(e)) return notFound();
    const persona = personaOf(request);
    const st = ensureState(e);
    const body = cuerpo<AvailabilityRequest>(request);
    const action = body.action;
    const open = blocks.filtrar((b) => b.careSpaceId === e.id && b.endedAt === null && b.cancelledAt === null)[0];

    const needed: OpsAction | null =
      action === 'block'
        ? body.kindCode === 'BLOCK_CLINICAL'
          ? 'block-clinical'
          : 'block-administrative'
        : action === 'start-maintenance'
          ? 'maintenance'
          : action === 'close' || action === 'reopen'
            ? 'close'
            : action === 'unblock'
              ? st.availability === 'SPACE_OP_BLOCKED_CLINICAL'
                ? 'block-clinical'
                : st.availability === 'SPACE_OP_MAINTENANCE'
                  ? 'maintenance'
                  : 'block-administrative'
              : null;
    if (needed === null) return regla('INVALID_ACTION', 'Acción de disponibilidad desconocida.');
    if (!can(persona, needed) || !inScope(persona, e.function)) return notAllowed(persona, needed);

    const sent = opsVersionOf(request);
    if (sent !== st.opsVersion) return versionMismatch(st.opsVersion, sent);
    if (e.status !== 'SPACE_ACTIVE') return regla('SPACE_NOT_ACTIVE', 'El espacio no está activo.');

    if (action === 'unblock' || action === 'reopen') {
      if (open === undefined) return conflicto('BLOCK_ALREADY_ENDED', 'No hay un bloqueo vigente que levantar.');
      blocks.actualizar(open.id, { endedAt: ahora(), endedBy: persona.displayName, endNote: null } as Partial<BlockSim>);
      const from = st.availability;
      setAvailability(e, 'SPACE_OP_AVAILABLE');
      emit(e, persona, 'AXIS_AVAILABILITY', from, 'SPACE_OP_AVAILABLE', { source: 'SRC_BLOCK', sourceRefId: open.id });
      return { cell: toCell(e, persona), blockId: open.id };
    }

    // block · start-maintenance · close
    const kind: BlockKind = action === 'start-maintenance' ? 'BLOCK_MAINTENANCE' : action === 'close' ? 'BLOCK_CLOSURE' : (body.kindCode as BlockKind);
    if (st.availability !== 'SPACE_OP_AVAILABLE') return conflicto('BLOCK_OVERLAP', 'Ya hay un bloqueo vigente.');
    const occupied = (e.form === 'LOC_FORM_BED' && toCell(e, persona).occupancy.code !== 'OCC_FREE');
    if (occupied) return conflicto('SPACE_OCCUPIED', 'La cama está ocupada o reservada.');
    if (!body.reasonCode) return regla('BLOCK_REASON_REQUIRED', 'Un bloqueo exige un motivo.');
    if (!(BLOCK_REASON_KINDS[body.reasonCode] ?? []).includes(kind)) {
      return regla('BLOCK_REASON_KIND_MISMATCH', 'Ese motivo no aplica a este tipo de bloqueo.');
    }
    const text = (body.reasonText ?? '').trim();
    if (body.reasonCode === 'BLOCK_RSN_OTHER' && text === '') return regla('BLOCK_REASON_TEXT_REQUIRED', 'El motivo «Otro» exige un texto.');
    if (kind === 'BLOCK_MAINTENANCE' && !body.expectedEndAt) {
      return regla('BLOCK_EXPECTED_END_REQUIRED', 'El mantenimiento exige una fecha estimada de fin.');
    }
    const startsAt = body.startsAt ?? ahora();
    const conflicts = commitmentsOf(e, startsAt, body.expectedEndAt ?? null);
    if (conflicts.length > 0 && body.acknowledgeConflicts !== true) {
      return conflicto('FUTURE_COMMITMENTS_CONFLICT', 'Hay compromisos futuros en la ventana del bloqueo.', { conflicts });
    }
    const block: BlockSim = {
      id: nuevoId('ops-block'),
      careSpaceId: e.id,
      kind,
      reasonCode: body.reasonCode,
      reasonText: text === '' ? null : text,
      startsAt,
      expectedEndAt: body.expectedEndAt ?? null,
      endedAt: null,
      endedBy: null,
      endNote: null,
      cancelledAt: null,
      cancelReason: null,
      workOrderRef: kind === 'BLOCK_MAINTENANCE' ? `OT-SIM-${String(blocks.tamano + 1).padStart(4, '0')}` : null,
      startedBy: persona.displayName,
    };
    blocks.agregar(block);
    const code = kind === 'BLOCK_CLINICAL' ? 'SPACE_OP_BLOCKED_CLINICAL' : kind === 'BLOCK_ADMIN' ? 'SPACE_OP_BLOCKED_ADMIN' : kind === 'BLOCK_MAINTENANCE' ? 'SPACE_OP_MAINTENANCE' : 'SPACE_OP_CLOSED';
    setAvailability(e, code, { reasonCode: block.reasonCode, reasonText: block.reasonText, expected: block.expectedEndAt });
    emit(e, persona, 'AXIS_AVAILABILITY', 'SPACE_OP_AVAILABLE', code, {
      source: 'SRC_BLOCK', sourceRefId: block.id, reason: block.reasonCode, text: block.reasonText, expected: block.expectedEndAt, v2: 'C',
    });
    return { cell: toCell(e, persona), blockId: block.id };
  });

  router.get('/care-spaces/:id/blocks', (request) => {
    const e = espacioPropio(request.params['id']!);
    if (e === undefined || !isOnBoard(e)) return notFound();
    const includeEnded = request.query.get('includeEnded') === 'true';
    return blocks
      .filtrar((b) => b.careSpaceId === e.id && (includeEnded || (b.endedAt === null && b.cancelledAt === null)))
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  });

  const closeBlock = (request: MockRequest, how: 'end' | 'cancel'): MockReply | CareSpaceBlock => {
    const block = blocks.get(request.params['id']!);
    const e = block === undefined ? undefined : espacioPropio(block.careSpaceId);
    if (block === undefined || e === undefined) return notFound();
    const persona = personaOf(request);
    const needed: OpsAction = block.kind === 'BLOCK_CLINICAL' ? 'block-clinical' : block.kind === 'BLOCK_MAINTENANCE' ? 'maintenance' : block.kind === 'BLOCK_CLOSURE' ? 'close' : 'block-administrative';
    const allowed = can(persona, needed) || (block.kind === 'BLOCK_MAINTENANCE' && can(persona, 'block-administrative'));
    if (!allowed || !inScope(persona, e.function)) return notAllowed(persona, needed);
    if (block.endedAt !== null || block.cancelledAt !== null) return conflicto('BLOCK_ALREADY_ENDED', 'Ese bloqueo ya terminó.');
    const { note, reason } = cuerpo<{ note: string; reason: string }>(request);
    if (how === 'cancel' && (reason ?? '').trim() === '') return regla('VALIDATION', 'Cancelar un bloqueo exige un motivo.');
    const now = ahora();
    const updated = blocks.actualizar(
      block.id,
      how === 'end'
        ? ({ endedAt: now, endedBy: persona.displayName, endNote: (note ?? '').trim() || null } as Partial<BlockSim>)
        : ({ cancelledAt: now, cancelReason: (reason ?? '').trim() } as Partial<BlockSim>),
    )!;
    const st = ensureState(e);
    const from = st.availability;
    setAvailability(e, 'SPACE_OP_AVAILABLE');
    if (block.kind === 'BLOCK_MAINTENANCE' && how === 'end') {
      // Regla B.5-25: al terminar el mantenimiento hay que limpiar antes de volver a uso.
      setHygiene(e, 'HYG_DIRTY');
      const order = openOrderOf(e.id) ?? createOrder(e, 'CLEAN_DISCHARGE', 'CLN_TRG_MAINTENANCE_END', 'CLN_PRIO_ROUTINE', 'Fin de mantenimiento');
      emit(e, persona, 'AXIS_AVAILABILITY', from, 'SPACE_OP_AVAILABLE', { source: 'SRC_BLOCK', sourceRefId: block.id });
      emit(e, persona, 'AXIS_HYGIENE', st.hygiene, 'HYG_DIRTY', { source: 'SRC_CLEANING', sourceRefId: order.id });
    } else {
      emit(e, persona, 'AXIS_AVAILABILITY', from, 'SPACE_OP_AVAILABLE', { source: 'SRC_BLOCK', sourceRefId: block.id });
    }
    return updated;
  };
  router.post('/care-space-blocks/:id/end', (request) => closeBlock(request, 'end'));
  router.post('/care-space-blocks/:id/cancel', (request) => closeBlock(request, 'cancel'));

  router.post('/care-spaces/:id/hygiene', (request) => {
    const e = espacioPropio(request.params['id']!);
    if (e === undefined || !isOnBoard(e)) return notFound();
    const persona = personaOf(request);
    const st = ensureState(e);
    const { action } = cuerpo<HygieneRequest>(request);
    const reasonText = (cuerpo<HygieneRequest>(request).reasonText ?? '').trim();
    const needed: OpsAction = action === 'mark-contaminated' ? 'mark-contaminated' : 'mark-dirty';
    if (!can(persona, needed) || !inScope(persona, e.function)) return notAllowed(persona, needed);
    const sent = opsVersionOf(request);
    if (sent !== st.opsVersion) return versionMismatch(st.opsVersion, sent);
    if (e.status !== 'SPACE_ACTIVE') return regla('SPACE_NOT_ACTIVE', 'El espacio no está activo.');
    if (reasonText === '') return regla('VALIDATION', 'Indique por qué se marca.', { field: 'reasonText' });
    const open = openOrderOf(e.id);
    const from = st.hygiene;
    if (action === 'mark-contaminated') {
      setHygiene(e, 'HYG_CONTAMINATED', true);
      let order = open;
      if (order !== undefined) {
        order = orders.actualizar(order.id, { cleaningType: 'CLEAN_TERMINAL', trigger: 'CLN_TRG_CONTAMINATION', priority: 'CLN_PRIO_URGENT', rowVersion: order.rowVersion + 1 } as Partial<OrderSim>)!;
      } else {
        order = createOrder(e, 'CLEAN_TERMINAL', 'CLN_TRG_CONTAMINATION', 'CLN_PRIO_URGENT', reasonText);
      }
      emit(e, persona, 'AXIS_HYGIENE', from, 'HYG_CONTAMINATED', { source: 'SRC_MANUAL', sourceRefId: order.id, text: reasonText });
      return { cell: toCell(e, persona), cleaningOrderId: order.id };
    }
    if (open !== undefined) {
      return conflicto('CLEANING_ORDER_ALREADY_OPEN', 'Esta cama ya tiene una orden de limpieza abierta.', { openOrderId: open.id });
    }
    setHygiene(e, 'HYG_DIRTY');
    const order = createOrder(e, st.terminalRequired ? 'CLEAN_TERMINAL' : 'CLEAN_ROUTINE', 'CLN_TRG_MANUAL', 'CLN_PRIO_ROUTINE', reasonText);
    emit(e, persona, 'AXIS_HYGIENE', from, 'HYG_DIRTY', { source: 'SRC_MANUAL', sourceRefId: order.id, text: reasonText });
    return { cell: toCell(e, persona), cleaningOrderId: order.id };
  });

  router.post('/care-spaces/:id/isolation', (request) => {
    const e = espacioPropio(request.params['id']!);
    if (e === undefined || !isOnBoard(e)) return notFound();
    const persona = personaOf(request);
    const st = ensureState(e);
    const body = cuerpo<IsolationRequest>(request);
    if (!can(persona, 'isolate') || !inScope(persona, e.function)) return notAllowed(persona, 'isolate');
    const sent = opsVersionOf(request);
    if (sent !== st.opsVersion) return versionMismatch(st.opsVersion, sent);
    if (e.status !== 'SPACE_ACTIVE') return regla('SPACE_NOT_ACTIVE', 'El espacio no está activo.');
    const code = body.isolationCode ?? 'ISO_NONE';
    const text = (body.reasonText ?? '').trim();
    if (code !== 'ISO_NONE' && text === '') return regla('ISOLATION_REASON_REQUIRED', 'Un aislamiento exige un motivo clínico.');
    const room = e.parentId === null ? e : (espacios.get(e.parentId) ?? e);
    const missing: string[] = [];
    if (code === 'ISO_AIRBORNE') {
      if (room.function !== 'SPACE_FN_ISOLATION_AIIR') missing.push('AIIR');
      if (room.pressure !== 'PRESSURE_NEGATIVE') missing.push('NEGATIVE_PRESSURE');
      const days = room.hvacValidatedOn === null ? Infinity : (Date.now() - new Date(room.hvacValidatedOn).getTime()) / 86_400_000;
      if (days > 365) missing.push('HVAC_VALIDATION');
    } else if (code === 'ISO_PROTECTIVE') {
      if (room.function !== 'SPACE_FN_PROTECTIVE_ENV') missing.push('PROTECTIVE_ENV');
      if (room.pressure !== 'PRESSURE_POSITIVE') missing.push('POSITIVE_PRESSURE');
    }
    if (missing.length > 0) return regla('ISOLATION_ROOM_NOT_CAPABLE', 'El local no sirve para ese aislamiento.', { missing });
    if (body.cohortApproved === true) return notAllowed(persona, 'isolate', 'ISOLATION_COHORT_REQUIRES_APPROVAL');

    const from = st.isolation;
    const companions: { careSpaceId: string; blockId: string }[] = [];
    const siblings = e.parentId === null ? [] : hijosDe(e.parentId).filter((s) => s.id !== e.id && isOnBoard(s) && s.status === 'SPACE_ACTIVE');
    if (code === 'ISO_NONE') {
      touch(e, { isolation: 'ISO_NONE', isolationOrganism: null, isolationSince: ahora() });
      setHygiene(e, 'HYG_DIRTY', true);
      const order = openOrderOf(e.id) ?? createOrder(e, 'CLEAN_TERMINAL', 'CLN_TRG_ISOLATION_END', 'CLN_PRIO_URGENT', 'Fin de aislamiento');
      emit(e, persona, 'AXIS_ISOLATION', from, 'ISO_NONE', { source: 'SRC_MANUAL', text });
      emit(e, persona, 'AXIS_HYGIENE', 'HYG_INSPECTED', 'HYG_DIRTY', { source: 'SRC_CLEANING', sourceRefId: order.id });
      for (const s of siblings) {
        for (const b of blocks.filtrar((x) => x.careSpaceId === s.id && x.reasonCode === 'BLOCK_RSN_ISOLATION_COHORT' && x.endedAt === null)) {
          blocks.actualizar(b.id, { endedAt: ahora(), endedBy: 'Sistema' } as Partial<BlockSim>);
          setAvailability(s, 'SPACE_OP_AVAILABLE');
          emit(s, persona, 'AXIS_AVAILABILITY', 'SPACE_OP_BLOCKED_CLINICAL', 'SPACE_OP_AVAILABLE', { source: 'SRC_BLOCK', sourceRefId: b.id });
        }
      }
    } else {
      touch(e, { isolation: code, isolationOrganism: (body.organismText ?? '').trim() || null, isolationSince: ahora() });
      emit(e, persona, 'AXIS_ISOLATION', from, code, { source: 'SRC_MANUAL', text: text || null });
      if (from === 'ISO_NONE') {
        for (const s of siblings) {
          const sst = ensureState(s);
          const free = toCell(s, persona).occupancy.code === 'OCC_FREE';
          if (free && sst.availability === 'SPACE_OP_AVAILABLE') {
            const b: BlockSim = {
              id: nuevoId('ops-block'), careSpaceId: s.id, kind: 'BLOCK_CLINICAL', reasonCode: 'BLOCK_RSN_ISOLATION_COHORT',
              reasonText: `Aislamiento en ${e.code}`, startsAt: ahora(), expectedEndAt: null, endedAt: null, endedBy: null, endNote: null,
              cancelledAt: null, cancelReason: null, workOrderRef: null, startedBy: 'Sistema',
            };
            blocks.agregar(b);
            setAvailability(s, 'SPACE_OP_BLOCKED_CLINICAL', { reasonCode: b.reasonCode, reasonText: b.reasonText });
            emit(s, persona, 'AXIS_AVAILABILITY', 'SPACE_OP_AVAILABLE', 'SPACE_OP_BLOCKED_CLINICAL', { source: 'SRC_BLOCK', sourceRefId: b.id, reason: b.reasonCode, v2: 'C' });
            companions.push({ careSpaceId: s.id, blockId: b.id });
          }
        }
      }
    }
    return { cell: toCell(e, persona), companionBlocks: companions };
  });

  /* cola de limpieza */
  const view = (o: OrderSim): CleaningOrder => o;
  const OPEN: readonly CleaningStatus[] = ['CLN_PENDING', 'CLN_IN_PROGRESS', 'CLN_DONE'];

  router.get('/sites/:siteId/cleaning-orders', (request) => {
    const site = sitioPropio(request.params['siteId']!);
    if (site === undefined) return notFound();
    applyDrift();
    const persona = personaOf(request);
    const q = request.query;
    const status = q.get('status') as CleaningStatus | null;
    const items = orders
      .filtrar((o) => o.siteId === site.id)
      .filter((o) => (status === null ? OPEN.includes(o.status) : o.status === status))
      .filter((o) => q.get('unitId') === null || o.clinicalUnit?.id === q.get('unitId'))
      .filter((o) => q.get('priority') === null || o.priority === q.get('priority'))
      .filter((o) => q.get('assignedTo') !== 'me' || o.assignedTo?.id === persona.userId)
      .map(view);
    const delay = atrasoDeLectura();
    return {
      items,
      nextCursor: null,
      generatedAt: new Date(Date.now() - delay * 60_000).toISOString(),
      viewer: viewerOf(persona),
    };
  });

  router.post('/sites/:siteId/cleaning-orders', (request) => {
    const site = sitioPropio(request.params['siteId']!);
    if (site === undefined) return notFound();
    const persona = personaOf(request);
    if (!can(persona, 'create-cleaning')) return notAllowed(persona, 'create-cleaning');
    const b = cuerpo<{ careSpaceId: string; typeCode: CleaningType; priorityCode: CleaningPriority; note: string }>(request);
    const e = espacioPropio(b.careSpaceId ?? '');
    if (e === undefined || e.siteId !== site.id || !isOnBoard(e)) return notFound();
    const st = ensureState(e);
    const open = openOrderOf(e.id);
    if (open !== undefined) return conflicto('CLEANING_ORDER_ALREADY_OPEN', 'Esta cama ya tiene una orden de limpieza abierta.', { openOrderId: open.id });
    if (st.terminalRequired && b.typeCode !== 'CLEAN_TERMINAL') {
      return regla('TERMINAL_CLEANING_REQUIRED', 'La cama exige limpieza terminal.');
    }
    const from = st.hygiene;
    const order = createOrder(e, b.typeCode ?? 'CLEAN_ROUTINE', 'CLN_TRG_MANUAL', b.priorityCode ?? 'CLN_PRIO_ROUTINE', (b.note ?? '').trim() || null);
    if (from === 'HYG_CLEAN' || from === 'HYG_INSPECTED') {
      setHygiene(e, 'HYG_DIRTY');
      emit(e, persona, 'AXIS_HYGIENE', from, 'HYG_DIRTY', { source: 'SRC_CLEANING', sourceRefId: order.id });
    }
    return reply(201, view(order));
  });

  const transition = (request: MockRequest, target: 'assign' | 'start' | 'finish' | 'inspect' | 'cancel'): MockReply | CleaningOrder => {
    const order = orders.get(request.params['id']!);
    const e = order === undefined ? undefined : espacioPropio(order.careSpace.id);
    if (order === undefined || e === undefined) return notFound();
    const persona = personaOf(request);
    const sent = rowVersionOf(request);
    if (sent !== order.rowVersion) {
      return falla(412, 'CONCURRENCY_CONFLICT', 'ROW_VERSION_MISMATCH', 'Otra persona movió esta orden.', { expectedVersion: sent, latestVersion: order.rowVersion });
    }
    const body = cuerpo<{ userId: string | null; note: string; result: 'PASS' | 'FAIL'; reasonText: string; reason: string }>(request);
    const needs: OpsAction = target === 'assign' ? 'assign' : target === 'start' || target === 'finish' ? 'clean' : target === 'cancel' ? 'create-cleaning' : isTerminal(order) ? 'inspect-terminal' : 'inspect';
    if (!can(persona, needs)) {
      return needs === 'inspect-terminal' && can(persona, 'inspect')
        ? notAllowed(persona, needs, 'TERMINAL_INSPECTION_REQUIRES_SUPERVISOR')
        : notAllowed(persona, needs);
    }
    const valid: Record<typeof target, readonly CleaningStatus[]> = {
      assign: ['CLN_PENDING', 'CLN_IN_PROGRESS'],
      start: ['CLN_PENDING'],
      finish: ['CLN_IN_PROGRESS'],
      inspect: ['CLN_DONE'],
      cancel: ['CLN_PENDING', 'CLN_IN_PROGRESS'],
    };
    const to: CleaningStatus = { assign: order.status, start: 'CLN_IN_PROGRESS', finish: 'CLN_DONE', inspect: 'CLN_INSPECTED', cancel: 'CLN_CANCELLED' }[target] as CleaningStatus;
    if (!valid[target].includes(order.status)) {
      return conflicto('CLEANING_ORDER_INVALID_TRANSITION', 'La orden no admite esa transición.', { from: order.status, to });
    }
    const st = ensureState(e);
    const now = ahora();
    const bump = { rowVersion: order.rowVersion + 1 };
    switch (target) {
      case 'assign': {
        const who = body.userId === null || body.userId === undefined ? null : { id: body.userId, displayName: Object.values(PERSONAS).find((p) => p.userId === body.userId)?.displayName ?? 'Persona asignada' };
        return orders.actualizar(order.id, { assignedTo: who, ...bump } as Partial<OrderSim>)!;
      }
      case 'start': {
        const updated = orders.actualizar(order.id, {
          status: 'CLN_IN_PROGRESS', startedAt: now,
          assignedTo: order.assignedTo ?? { id: persona.userId, displayName: persona.displayName }, ...bump,
        } as Partial<OrderSim>)!;
        const from = st.hygiene;
        setHygiene(e, 'HYG_CLEANING');
        emit(e, persona, 'AXIS_HYGIENE', from, 'HYG_CLEANING', { source: 'SRC_CLEANING', sourceRefId: order.id });
        return updated;
      }
      case 'finish': {
        const updated = orders.actualizar(order.id, { status: 'CLN_DONE', finishedAt: now, finishedByUserId: persona.userId, note: (body.note ?? '').trim() || order.note, ...bump } as Partial<OrderSim>)!;
        setHygiene(e, 'HYG_CLEAN');
        emit(e, persona, 'AXIS_HYGIENE', 'HYG_CLEANING', 'HYG_CLEAN', { source: 'SRC_CLEANING', sourceRefId: order.id });
        return updated;
      }
      case 'inspect': {
        if (order.finishedByUserId === persona.userId) {
          return regla('INSPECTION_BY_CLEANER_NOT_ALLOWED', 'Quien terminó la limpieza no puede inspeccionarla.');
        }
        if (body.result === 'FAIL') {
          if ((body.reasonText ?? '').trim() === '') return regla('INSPECTION_REASON_REQUIRED', 'Rechazar exige un motivo.');
          const rejected = orders.actualizar(order.id, { status: 'CLN_REJECTED', inspectedAt: now, inspectionResult: 'FAIL', rejectionReason: (body.reasonText ?? '').trim(), ...bump } as Partial<OrderSim>)!;
          setHygiene(e, 'HYG_DIRTY');
          const next = createOrder(e, st.terminalRequired ? 'CLEAN_TERMINAL' : order.cleaningType, 'CLN_TRG_INSPECTION_FAILED', 'CLN_PRIO_URGENT', (body.reasonText ?? '').trim(), order.id);
          emit(e, persona, 'AXIS_HYGIENE', 'HYG_CLEAN', 'HYG_DIRTY', { source: 'SRC_CLEANING', sourceRefId: next.id, text: (body.reasonText ?? '').trim() });
          return rejected;
        }
        const passed = orders.actualizar(order.id, { status: 'CLN_INSPECTED', inspectedAt: now, inspectionResult: 'PASS', ...bump } as Partial<OrderSim>)!;
        setHygiene(e, 'HYG_INSPECTED', false);
        emit(e, persona, 'AXIS_HYGIENE', 'HYG_CLEAN', 'HYG_INSPECTED', { source: 'SRC_CLEANING', sourceRefId: order.id });
        return passed;
      }
      case 'cancel': {
        if ((body.reason ?? '').trim() === '') return regla('VALIDATION', 'Cancelar exige un motivo.', { field: 'reason' });
        const updated = orders.actualizar(order.id, { status: 'CLN_CANCELLED', cancelReason: (body.reason ?? '').trim(), ...bump } as Partial<OrderSim>)!;
        if (st.hygiene === 'HYG_CLEANING') {
          setHygiene(e, 'HYG_DIRTY');
          emit(e, persona, 'AXIS_HYGIENE', 'HYG_CLEANING', 'HYG_DIRTY', { source: 'SRC_CLEANING', sourceRefId: order.id });
        }
        return updated;
      }
    }
  };
  for (const t of ['assign', 'start', 'finish', 'inspect', 'cancel'] as const) {
    router.post(`/cleaning-orders/:id/${t}`, (request) => transition(request, t));
  }

  router.get('/care-spaces/:id/status-events', (request) => {
    const e = espacioPropio(request.params['id']!);
    if (e === undefined || !isOperable(e)) return notFound();
    const q = request.query;
    const axis = q.get('axis');
    const from = q.get('from');
    const to = q.get('to');
    const offset = Number(q.get('cursor') ?? 0) || 0;
    const all = events
      .filtrar((x) => x.spaceId === e.id)
      .filter((x) => axis === null || x.axis === axis)
      .filter((x) => (from === null || x.occurredAt >= from) && (to === null || x.occurredAt <= to))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    const page = all.slice(offset, offset + 20);
    return {
      items: page.map(({ spaceId: _s, siteId: _t, ...rest }) => rest),
      nextCursor: offset + 20 < all.length ? String(offset + 20) : null,
      generatedAt: ahora(),
    };
  });
}
