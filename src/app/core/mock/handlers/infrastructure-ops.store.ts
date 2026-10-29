import { isAssignable, v2CodeOf, countCells, blockKindOf } from '../../data-access/infrastructure-ops/infrastructure-ops.logic';
import type {
  AvailabilityCode,
  AxisCode,
  BedBoardCell,
  BlockKind,
  CareSpaceBlock,
  CleaningOrder,
  CleaningPriority,
  CleaningStatus,
  CleaningTrigger,
  CleaningType,
  HygieneCode,
  IsolationCode,
  OccupancyCode,
  StatusEvent,
  StatusSource,
} from '../../data-access/infrastructure-ops/infrastructure-ops.types';
import { c, CATALOGO, UNIDADES_SEMILLA, type EspacioSim } from '../fixtures/infrastructure.data';
import { Coleccion, nuevoId, uuid } from '../mock-store';
import { concepto, espacios, vinculoPropietario } from './infrastructure.store';
import { PERSONAS, type Persona } from './infrastructure-ops.personas';

/* ============================================================================
    Estado del backend simulado de operación de camas y salas — franja F2.

    Tres ejes manuales (disponibilidad, higiene, aislamiento) y uno derivado
    (ocupación) por espacio operable, más bloqueos, órdenes de limpieza y el
    historial append-only A20. Todo en colecciones que sobreviven a F5
    (`sessionStorage`), igual que el simulador de F1.

    ## Lo que NO es una invención

    - Los recuentos del tablero se **cuentan** de las celdas cada vez.
    - El `v2Code` y «asignable» salen de la regla de §F2.2 (`v2CodeOf`).
    - Los espacios y sus unidades son los de F1; los quirófanos, los de
      `procedures.handlers` (`operating-room-1/2`).

    ## Lo que es una simplificación del simulador

    - La **ocupación** es una colección propia que hace de proyección de las
      ubicaciones de internación (F3): cuando exista el simulador de ADT, solo
      cambia quién la escribe.
    - La unidad de una cama es la del primer ancestro (o ella misma) con un
      vínculo propietario vigente: las camas sembradas por F1 no traen vínculo
      propio, lo hereda su habitación.
    - `infra.inspection_required` está fijo en `true`.
    ========================================================================== */

export const INSPECTION_REQUIRED = true;

/** Funciones no-cama que tienen estado operativo propio (§F2.4). */
const OPERABLE_FUNCTIONS: readonly string[] = [
  'SPACE_FN_OPERATING_ROOM',
  'SPACE_FN_DELIVERY_ROOM',
  'SPACE_FN_EMERGENCY_BOX',
  'SPACE_FN_PROCEDURE_ROOM',
  'SPACE_FN_IMAGING_ROOM',
];

export const isOperable = (e: EspacioSim): boolean => e.form === 'LOC_FORM_BED' || OPERABLE_FUNCTIONS.includes(e.function);

/** ¿Está en el tablero? Operable, y ni planificado ni clausurado. */
export const isOnBoard = (e: EspacioSim): boolean =>
  isOperable(e) && (e.status === 'SPACE_ACTIVE' || e.status === 'SPACE_SUSPENDED');

/* ---- filas ------------------------------------------------------------------- */

export interface OpsStateSim extends Record<string, unknown> {
  /** Es el id del espacio. */
  readonly id: string;
  availability: AvailabilityCode;
  availabilityReasonCode: string | null;
  availabilityReasonText: string | null;
  availabilityExpected: string | null;
  availabilitySince: string;
  hygiene: HygieneCode;
  hygieneSince: string;
  terminalRequired: boolean;
  isolation: IsolationCode;
  isolationOrganism: string | null;
  isolationSince: string;
  opsVersion: number;
  lastEventAt: string;
}

export interface OccupancySim extends Record<string, unknown> {
  readonly id: string;
  code: OccupancyCode;
  since: string;
  encounterId: string | null;
  patient: { initials: string; sexCode: string; ageYears: number } | null;
}

export type BlockSim = CareSpaceBlock & Record<string, unknown>;
export type OrderSim = CleaningOrder & Record<string, unknown>;
export interface EventSim extends StatusEvent, Record<string, unknown> {
  readonly spaceId: string;
  readonly siteId: string;
}
export interface DriftSim extends Record<string, unknown> {
  readonly id: string;
  readonly appliedAt: string;
}

const minAgo = (n: number): string => new Date(Date.now() - n * 60_000).toISOString();
const inMin = (n: number): string => new Date(Date.now() + n * 60_000).toISOString();

/* ---- semillas -------------------------------------------------------------------- */

interface Seed {
  readonly occ?: { code: 'OCC_OCCUPIED' | 'OCC_RESERVED'; patient: [string, string, number]; sinceMin: number };
  readonly hyg?: HygieneCode;
  readonly hygMin?: number;
  readonly terminal?: boolean;
  readonly iso?: { code: IsolationCode; organism: string; sinceMin: number };
  readonly avail?: {
    code: AvailabilityCode;
    reason: string;
    text?: string;
    expectedInMin?: number;
    sinceMin: number;
    by: string;
    workOrder?: string;
  };
}

const SEEDS: Readonly<Record<string, Seed>> = {
  '301-A': { occ: { code: 'OCC_OCCUPIED', patient: ['M.R.', 'F', 54], sinceMin: 4320 } },
  '301-B': { occ: { code: 'OCC_OCCUPIED', patient: ['J.C.', 'M', 67], sinceMin: 1440 } },
  '302-A': { hygMin: 90 },
  '302-B': { hyg: 'HYG_DIRTY', hygMin: 40 },
  '303-A': { occ: { code: 'OCC_RESERVED', patient: ['L.P.', 'F', 41], sinceMin: 20 } },
  '303-B': { hyg: 'HYG_CLEANING', hygMin: 12 },
  'AIS-1A': {
    occ: { code: 'OCC_OCCUPIED', patient: ['T.V.', 'M', 38], sinceMin: 2880 },
    iso: { code: 'ISO_AIRBORNE', organism: 'Tuberculosis pulmonar', sinceMin: 2880 },
  },
  'AIS-2A': {},
  'UTI-1': { occ: { code: 'OCC_OCCUPIED', patient: ['H.G.', 'M', 72], sinceMin: 600 } },
  'UTI-3': {
    avail: { code: 'SPACE_OP_BLOCKED_CLINICAL', reason: 'BLOCK_RSN_STAFF_SHORTAGE', sinceMin: 180, by: 'nurse' },
  },
  'UTI-4': { hyg: 'HYG_CONTAMINATED', hygMin: 25, terminal: true },
  '311-A': { hyg: 'HYG_CLEAN', hygMin: 8 },
  '311-B': {
    occ: { code: 'OCC_OCCUPIED', patient: ['A.S.', 'M', 6], sinceMin: 1440 },
    iso: { code: 'ISO_CONTACT', organism: 'Rotavirus', sinceMin: 1400 },
  },
  '312-A': {
    avail: {
      code: 'SPACE_OP_MAINTENANCE',
      reason: 'BLOCK_RSN_EQUIPMENT_FAILURE',
      text: 'Cama eléctrica sin motor',
      expectedInMin: 2160,
      sinceMin: 300,
      by: 'maintenance',
      workOrder: 'OT-2026-0457',
    },
  },
  '401-B': {
    avail: {
      code: 'SPACE_OP_BLOCKED_ADMIN',
      reason: 'BLOCK_RSN_ADMIN_DECISION',
      text: 'Reservada para remodelación',
      expectedInMin: -90,
      sinceMin: 4320,
      by: 'admin',
    },
  },
  'EMER-BOX-2': { occ: { code: 'OCC_OCCUPIED', patient: ['P.Q.', 'F', 29], sinceMin: 75 } },
  'QX-2': { hyg: 'HYG_DIRTY', hygMin: 6 },
};

/** Las órdenes abiertas que acompañan a las semillas, y dos cerradas para el historial. */
const ORDER_SEEDS: readonly {
  code: string;
  type: CleaningType;
  trigger: CleaningTrigger;
  priority: CleaningPriority;
  status: CleaningStatus;
  requestedMin: number;
  startedMin?: number;
  finishedMin?: number;
  inspectedMin?: number;
  assigned?: string;
}[] = [
  { code: '302-B', type: 'CLEAN_DISCHARGE', trigger: 'CLN_TRG_DISCHARGE', priority: 'CLN_PRIO_ROUTINE', status: 'CLN_PENDING', requestedMin: 40 },
  { code: '303-B', type: 'CLEAN_DISCHARGE', trigger: 'CLN_TRG_DISCHARGE', priority: 'CLN_PRIO_URGENT', status: 'CLN_IN_PROGRESS', requestedMin: 35, startedMin: 12, assigned: 'housekeeping' },
  { code: 'UTI-4', type: 'CLEAN_TERMINAL', trigger: 'CLN_TRG_CONTAMINATION', priority: 'CLN_PRIO_URGENT', status: 'CLN_PENDING', requestedMin: 25 },
  { code: '311-A', type: 'CLEAN_DISCHARGE', trigger: 'CLN_TRG_DISCHARGE', priority: 'CLN_PRIO_ROUTINE', status: 'CLN_DONE', requestedMin: 50, startedMin: 30, finishedMin: 8, assigned: 'housekeeping' },
  { code: 'QX-2', type: 'CLEAN_OR_TURNOVER', trigger: 'CLN_TRG_OR_TURNOVER', priority: 'CLN_PRIO_STAT', status: 'CLN_PENDING', requestedMin: 6 },
  { code: '302-A', type: 'CLEAN_DISCHARGE', trigger: 'CLN_TRG_DISCHARGE', priority: 'CLN_PRIO_ROUTINE', status: 'CLN_INSPECTED', requestedMin: 150, startedMin: 135, finishedMin: 110, inspectedMin: 95, assigned: 'housekeeping' },
  { code: 'EMER-BOX-1', type: 'CLEAN_SPOT', trigger: 'CLN_TRG_MANUAL', priority: 'CLN_PRIO_ROUTINE', status: 'CLN_CANCELLED', requestedMin: 200 },
];

/* ---- colecciones ------------------------------------------------------------------ */

export const opsStates = new Coleccion<OpsStateSim>([]);
export const occupancies = new Coleccion<OccupancySim>([]);
export const blocks = new Coleccion<BlockSim>([]);
export const orders = new Coleccion<OrderSim>([]);
export const events = new Coleccion<EventSim>([]);
export const drift = new Coleccion<DriftSim>([]);

opsStates.persistirEn('mock.infra.ops.states');
occupancies.persistirEn('mock.infra.ops.occupancies');
blocks.persistirEn('mock.infra.ops.blocks');
orders.persistirEn('mock.infra.ops.orders');
events.persistirEn('mock.infra.ops.events');
drift.persistirEn('mock.infra.ops.drift');

let sequence = 0;
export const opsRequestId = (): string => `req-ops-${String(++sequence).padStart(4, '0')}`;

const byCode = (code: string): EspacioSim | undefined => espacios.todos().find((e) => e.code === code);

/** ¿La persona-semilla (clave) es esta? Resuelve un nombre desde las personas. */
const nameOf = (key: string): string => PERSONAS[key]?.displayName ?? key;
const idOf = (key: string): string => PERSONAS[key]?.userId ?? uuid(key);

export function seedOps(): void {
  for (const e of espacios.todos().filter(isOnBoard)) {
    const s = SEEDS[e.code] ?? {};
    const hygiene: HygieneCode = s.hyg ?? 'HYG_INSPECTED';
    const hygieneSince = minAgo(s.hygMin ?? 600);
    const avail = s.avail;
    const state: OpsStateSim = {
      id: e.id,
      availability: avail?.code ?? 'SPACE_OP_AVAILABLE',
      availabilityReasonCode: avail?.reason ?? null,
      availabilityReasonText: avail?.text ?? null,
      availabilityExpected: avail?.expectedInMin === undefined ? null : inMin(avail.expectedInMin),
      availabilitySince: avail === undefined ? minAgo(4000) : minAgo(avail.sinceMin),
      hygiene,
      hygieneSince,
      terminalRequired: s.terminal === true,
      isolation: s.iso?.code ?? 'ISO_NONE',
      isolationOrganism: s.iso?.organism ?? null,
      isolationSince: s.iso === undefined ? minAgo(4000) : minAgo(s.iso.sinceMin),
      opsVersion: 1,
      lastEventAt: minAgo(Math.min(s.hygMin ?? 600, avail?.sinceMin ?? 600, s.iso?.sinceMin ?? 600, s.occ?.sinceMin ?? 600)),
    };
    opsStates.agregar(state);
    if (s.occ !== undefined) {
      occupancies.agregar({
        id: e.id,
        code: s.occ.code,
        since: minAgo(s.occ.sinceMin),
        encounterId: e.code === '301-B' ? uuid('encounter-301-B') : uuid(`encounter-${e.code}`),
        patient: { initials: s.occ.patient[0], sexCode: s.occ.patient[1], ageYears: s.occ.patient[2] },
      });
      pushEvent(e, 'AXIS_OCCUPANCY', 'OCC_FREE', s.occ.code, { source: 'SRC_ADT', at: minAgo(s.occ.sinceMin), by: 'Internación' });
    }
    if (avail !== undefined) {
      const kind = blockKindOf(avail.code)!;
      const block: BlockSim = {
        id: uuid(`ops-block-${e.code}`),
        careSpaceId: e.id,
        kind,
        reasonCode: avail.reason,
        reasonText: avail.text ?? null,
        startsAt: minAgo(avail.sinceMin),
        expectedEndAt: avail.expectedInMin === undefined ? null : inMin(avail.expectedInMin),
        endedAt: null,
        endedBy: null,
        endNote: null,
        cancelledAt: null,
        cancelReason: null,
        workOrderRef: avail.workOrder ?? null,
        startedBy: nameOf(avail.by),
      };
      blocks.agregar(block);
      pushEvent(e, 'AXIS_AVAILABILITY', 'SPACE_OP_AVAILABLE', avail.code, {
        source: 'SRC_BLOCK', reason: avail.reason, text: avail.text, expected: block.expectedEndAt, at: block.startsAt, by: nameOf(avail.by), v2: 'C',
      });
    }
    if (s.iso !== undefined) {
      pushEvent(e, 'AXIS_ISOLATION', 'ISO_NONE', s.iso.code, { source: 'SRC_MANUAL', at: minAgo(s.iso.sinceMin), by: nameOf('nurse'), text: s.iso.organism });
    }
    if (s.hyg !== undefined) {
      pushEvent(e, 'AXIS_HYGIENE', 'HYG_INSPECTED', s.hyg, { source: 'SRC_CLEANING', at: hygieneSince, by: nameOf('nurse') });
    }
  }
  for (const o of ORDER_SEEDS) {
    const e = byCode(o.code);
    if (e === undefined) continue;
    const unit = unitOf(e);
    const row: OrderSim = {
      id: uuid(`ops-order-${o.code}-${o.status}`),
      siteId: e.siteId,
      careSpace: { id: e.id, code: e.code, name: e.name, pathLabel: pathLabel(e) },
      clinicalUnit: unit === null ? null : { id: unit.id, name: unit.name },
      cleaningType: o.type,
      trigger: o.trigger,
      priority: o.priority,
      status: o.status,
      requestedAt: minAgo(o.requestedMin),
      dueAt: null,
      assignedTo: o.assigned === undefined ? null : { id: idOf(o.assigned), displayName: nameOf(o.assigned) },
      startedAt: o.startedMin === undefined ? null : minAgo(o.startedMin),
      finishedAt: o.finishedMin === undefined ? null : minAgo(o.finishedMin),
      finishedByUserId: o.finishedMin === undefined ? null : idOf(o.assigned ?? 'housekeeping'),
      inspectedAt: o.inspectedMin === undefined ? null : minAgo(o.inspectedMin),
      inspectionResult: o.status === 'CLN_INSPECTED' ? 'PASS' : null,
      rejectionReason: null,
      cancelReason: o.status === 'CLN_CANCELLED' ? 'Pedido duplicado' : null,
      previousOrderId: null,
      note: null,
      rowVersion: 1,
    };
    orders.agregar(row);
  }
}

/** Vacía y vuelve a sembrar: para las pruebas, que necesitan un punto de partida conocido. */
export function resetOps(): void {
  for (const col of [opsStates, occupancies, blocks, orders, events, drift]) {
    for (const row of col.todos()) col.borrar(row.id);
  }
  seedOps();
}

/** Un espacio operable creado después de la siembra (p. ej. una cama nueva de F1) nace limpia e inspeccionada. */
export function ensureState(e: EspacioSim): OpsStateSim {
  const existing = opsStates.get(e.id);
  if (existing !== undefined) return existing;
  const now = new Date().toISOString();
  return opsStates.agregar({
    id: e.id,
    availability: 'SPACE_OP_AVAILABLE',
    availabilityReasonCode: null,
    availabilityReasonText: null,
    availabilityExpected: null,
    availabilitySince: now,
    hygiene: 'HYG_INSPECTED',
    hygieneSince: now,
    terminalRequired: false,
    isolation: 'ISO_NONE',
    isolationOrganism: null,
    isolationSince: now,
    opsVersion: 1,
    lastEventAt: now,
  });
}

/* ---- unidad, ruta, nombres --------------------------------------------------------- */

export interface UnitRef {
  readonly id: string;
  readonly name: string;
}

export function unitOf(e: EspacioSim): UnitRef | null {
  let current: EspacioSim | undefined = e;
  for (let i = 0; i < 20 && current !== undefined; i++) {
    const link = vinculoPropietario(current.id);
    if (link !== undefined) {
      const u = UNIDADES_SEMILLA.find((x) => x.id === link.clinicalUnitId);
      return u === undefined ? null : { id: u.id, name: u.name };
    }
    current = current.parentId === null ? undefined : espacios.get(current.parentId);
  }
  return null;
}

export function pathOf(e: EspacioSim): BedBoardCell['path'] {
  const path: BedBoardCell['path'][number][] = [];
  let current = e.parentId === null ? undefined : espacios.get(e.parentId);
  while (current !== undefined && path.length < 20) {
    path.unshift({ id: current.id, code: current.code, name: current.name, form: concepto(CATALOGO.forms, current.form)! });
    current = current.parentId === null ? undefined : espacios.get(current.parentId);
  }
  return path;
}

export const pathLabel = (e: EspacioSim): string => pathOf(e).map((p) => p.name).join(' › ');

/* ---- la celda ------------------------------------------------------------------------ */

export function axesOf(e: EspacioSim) {
  const st = opsStates.get(e.id)!;
  const occ = occupancies.get(e.id);
  return {
    lifecycleActive: e.status === 'SPACE_ACTIVE',
    availability: st.availability,
    hygiene: st.hygiene,
    terminalRequired: st.terminalRequired,
    isolation: st.isolation,
    occupancy: (occ?.code ?? 'OCC_FREE') as OccupancyCode,
    inspectionRequired: INSPECTION_REQUIRED,
  };
}

export const openOrderOf = (spaceId: string): OrderSim | undefined =>
  orders.todos().find((o) => o.careSpace.id === spaceId && ['CLN_PENDING', 'CLN_IN_PROGRESS', 'CLN_DONE'].includes(o.status));

export function toCell(e: EspacioSim, persona: Persona): BedBoardCell {
  const st = opsStates.get(e.id)!;
  const occ = occupancies.get(e.id);
  const axes = axesOf(e);
  return {
    id: e.id,
    code: e.code,
    name: e.name,
    path: pathOf(e),
    form: concepto(CATALOGO.forms, e.form)!,
    function: c(e.function, CATALOGO.functions.find((f) => f.code === e.function)?.display ?? e.function),
    lifecycle: concepto(CATALOGO.lifecycle, e.status)!,
    availability: {
      code: st.availability,
      reasonCode: st.availabilityReasonCode,
      reasonText: st.availabilityReasonText,
      expectedUntil: st.availabilityExpected,
      since: st.availabilitySince,
    },
    hygiene: { code: st.hygiene, since: st.hygieneSince, terminalRequired: st.terminalRequired },
    isolation: { code: st.isolation, organism: st.isolationOrganism, since: st.isolationSince },
    occupancy: {
      code: axes.occupancy,
      since: occ?.since ?? st.availabilitySince,
      ...(occ === undefined ? {} : { encounterId: persona.seesPatient ? occ.encounterId : null }),
      ...(occ !== undefined && persona.seesPatient && occ.patient !== null ? { patient: occ.patient } : {}),
    },
    v2Code: v2CodeOf(axes),
    assignable: isAssignable(axes),
    openCleaningOrderId: openOrderOf(e.id)?.id ?? null,
    lastEventAt: st.lastEventAt,
    opsVersion: st.opsVersion,
  };
}

/** Las unidades del tablero con sus celdas y recuentos **contados** de ellas. */
export function boardUnits(siteId: string, persona: Persona, filter: (e: EspacioSim) => boolean = () => true) {
  const groups = new Map<string, { name: string; cells: BedBoardCell[] }>();
  for (const e of espacios.filtrar((x) => x.siteId === siteId && isOnBoard(x) && filter(x))) {
    ensureState(e);
    const unit = unitOf(e);
    if (unit === null) continue;
    const group = groups.get(unit.id) ?? { name: unit.name, cells: [] };
    group.cells.push(toCell(e, persona));
    groups.set(unit.id, group);
  }
  return [...groups.entries()]
    .map(([unitId, g]) => ({
      unitId,
      name: g.name,
      counts: countCells(g.cells),
      cells: g.cells.sort((a, b) => a.code.localeCompare(b.code, 'es', { numeric: true })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'es'));
}

/* ---- eventos A20 -------------------------------------------------------------------- */

let lastStamp = 0;

export function pushEvent(
  e: EspacioSim,
  axis: AxisCode,
  from: string | null,
  to: string,
  options: {
    source?: StatusSource;
    sourceRefId?: string | null;
    reason?: string | null;
    text?: string | null;
    expected?: string | null;
    at?: string;
    by?: string | null;
    v2?: StatusEvent['v2Code'];
  } = {},
): EventSim {
  // Sin hora explícita, cada evento es estrictamente posterior al anterior: el historial
  // se ordena por `occurredAt` y dos cambios en el mismo milisegundo no pueden empatar.
  lastStamp = Math.max(Date.now(), lastStamp + 1);
  const at = options.at ?? new Date(lastStamp).toISOString();
  const state = opsStates.get(e.id);
  const v2 = options.v2 ?? (state === undefined ? 'U' : v2CodeOf(axesOf(e)));
  const row: EventSim = {
    id: nuevoId('ops-event'),
    spaceId: e.id,
    siteId: e.siteId,
    axis,
    from,
    to,
    reasonCode: options.reason ?? null,
    reasonText: options.text ?? null,
    expectedUntil: options.expected ?? null,
    v2Code: v2,
    source: options.source ?? 'SRC_MANUAL',
    sourceRefId: options.sourceRefId ?? null,
    occurredAt: at,
    recordedBy: options.by ?? null,
    requestId: opsRequestId(),
  };
  events.agregar(row);
  return row;
}

export const blockKindFromRequest = (action: string, kind: BlockKind): BlockKind =>
  action === 'start-maintenance' ? 'BLOCK_MAINTENANCE' : action === 'close' ? 'BLOCK_CLOSURE' : kind;

// Primera visita: se siembra. Con datos guardados (F5), se conservan.
if (opsStates.tamano === 0) seedOps();
