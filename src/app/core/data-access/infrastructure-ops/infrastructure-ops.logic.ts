import type {
  AvailabilityCode,
  BedBoardCell,
  BedBoardCounts,
  BlockKind,
  BlockReason,
  CleaningOrder,
  CleaningPriority,
  CleaningStatus,
  CleaningType,
  HygieneCode,
  IsolationCode,
  OccupancyCode,
  OpsAction,
  OpsViewer,
  V2Code,
} from './infrastructure-ops.types';

/* ============================================================================
    Lógica pura de la operación de camas y salas — franja F2. Sin Angular.

    Dos clases de cosas viven acá y no se mezclan:

    1. **Rótulos y proyecciones** que la pantalla necesita (texto de cada código,
       cuenta de un tablero, antigüedad de un dato). Los rótulos son los del
       lenguaje del dominio; los códigos de los conceptos son los de §F2.2.
    2. **La regla v2-0116 de §F2.2**, que el servidor calcula y que acá existe
       para el simulador y para las pruebas. La pantalla muestra el `v2Code` que
       manda la API; no lo recalcula para decidir nada.
    ========================================================================== */

/* ---- rótulos ------------------------------------------------------------------ */

export const V2_LABEL: Readonly<Record<V2Code, string>> = {
  U: 'Disponible',
  O: 'Ocupada',
  R: 'Reservada',
  H: 'Por limpiar',
  K: 'Contaminada',
  I: 'Aislada',
  C: 'No disponible',
};

export const AVAILABILITY_LABEL: Readonly<Record<AvailabilityCode, string>> = {
  SPACE_OP_AVAILABLE: 'Disponible',
  SPACE_OP_BLOCKED_CLINICAL: 'Bloqueo clínico',
  SPACE_OP_BLOCKED_ADMIN: 'Bloqueo administrativo',
  SPACE_OP_MAINTENANCE: 'Mantenimiento',
  SPACE_OP_CLOSED: 'Cerrada',
};

export const HYGIENE_LABEL: Readonly<Record<HygieneCode, string>> = {
  HYG_CLEAN: 'Limpia',
  HYG_DIRTY: 'Sucia',
  HYG_CLEANING: 'En limpieza',
  HYG_INSPECTED: 'Inspeccionada',
  HYG_CONTAMINATED: 'Contaminada',
};

export const ISOLATION_LABEL: Readonly<Record<IsolationCode, string>> = {
  ISO_NONE: 'Sin aislamiento',
  ISO_CONTACT: 'Aislamiento de contacto',
  ISO_DROPLET: 'Aislamiento por gotas',
  ISO_AIRBORNE: 'Aislamiento aéreo',
  ISO_PROTECTIVE: 'Aislamiento protector',
};

export const OCCUPANCY_LABEL: Readonly<Record<OccupancyCode, string>> = {
  OCC_FREE: 'Libre',
  OCC_RESERVED: 'Reservada',
  OCC_OCCUPIED: 'Ocupada',
};

export const BLOCK_KIND_LABEL: Readonly<Record<BlockKind, string>> = {
  BLOCK_CLINICAL: 'Bloqueo clínico',
  BLOCK_ADMIN: 'Bloqueo administrativo',
  BLOCK_MAINTENANCE: 'Mantenimiento',
  BLOCK_CLOSURE: 'Cierre',
};

/** Motivo de bloqueo → rótulo. Si la API manda su propio `display`, ese manda. */
export const BLOCK_REASON_LABEL: Readonly<Record<string, string>> = {
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

export const CLEANING_TYPE_LABEL: Readonly<Record<CleaningType, string>> = {
  CLEAN_ROUTINE: 'Rutina',
  CLEAN_DISCHARGE: 'Alta',
  CLEAN_TERMINAL: 'Terminal',
  CLEAN_OR_TURNOVER: 'Cambio de quirófano',
  CLEAN_SPOT: 'Puntual',
};

export const CLEANING_PRIORITY_LABEL: Readonly<Record<CleaningPriority, string>> = {
  CLN_PRIO_ROUTINE: 'Rutina',
  CLN_PRIO_URGENT: 'Urgente',
  CLN_PRIO_STAT: 'Inmediata',
};

export const CLEANING_STATUS_LABEL: Readonly<Record<CleaningStatus, string>> = {
  CLN_PENDING: 'Pendiente',
  CLN_IN_PROGRESS: 'En curso',
  CLN_DONE: 'Por inspeccionar',
  CLN_INSPECTED: 'Inspeccionada',
  CLN_REJECTED: 'Rechazada',
  CLN_CANCELLED: 'Cancelada',
};

export const CLEANING_TRIGGER_LABEL: Readonly<Record<string, string>> = {
  CLN_TRG_DISCHARGE: 'Egreso',
  CLN_TRG_TRANSFER: 'Traslado',
  CLN_TRG_MANUAL: 'Pedido manual',
  CLN_TRG_ISOLATION_END: 'Fin de aislamiento',
  CLN_TRG_CONTAMINATION: 'Contaminación',
  CLN_TRG_MAINTENANCE_END: 'Fin de mantenimiento',
  CLN_TRG_OR_TURNOVER: 'Cambio de quirófano',
  CLN_TRG_INSPECTION_FAILED: 'Inspección rechazada',
};

export const AXIS_LABEL: Readonly<Record<string, string>> = {
  AXIS_AVAILABILITY: 'Disponibilidad',
  AXIS_HYGIENE: 'Higiene',
  AXIS_ISOLATION: 'Aislamiento',
  AXIS_OCCUPANCY: 'Ocupación',
};

export const SOURCE_LABEL: Readonly<Record<string, string>> = {
  SRC_MANUAL: 'Manual',
  SRC_ADT: 'Internación',
  SRC_CLEANING: 'Limpieza',
  SRC_BLOCK: 'Bloqueo',
  SRC_ROOM_EVENT: 'Evento del local',
  SRC_SYSTEM: 'Sistema',
};

/** Rótulo de cualquier código de estado conocido; el código mismo si no lo conoce. */
export function labelOf(code: string | null | undefined): string {
  if (code === null || code === undefined) return '—';
  return (
    (AVAILABILITY_LABEL as Record<string, string>)[code] ??
    (HYGIENE_LABEL as Record<string, string>)[code] ??
    (ISOLATION_LABEL as Record<string, string>)[code] ??
    (OCCUPANCY_LABEL as Record<string, string>)[code] ??
    BLOCK_REASON_LABEL[code] ??
    code
  );
}

export function reasonLabel(code: string | null | undefined, catalog: readonly BlockReason[] = []): string {
  if (code === null || code === undefined) return '—';
  return catalog.find((r) => r.code === code)?.display ?? BLOCK_REASON_LABEL[code] ?? code;
}

/** El tipo de bloqueo que corresponde a cada código de disponibilidad. */
export function blockKindOf(code: AvailabilityCode): BlockKind | null {
  switch (code) {
    case 'SPACE_OP_BLOCKED_CLINICAL':
      return 'BLOCK_CLINICAL';
    case 'SPACE_OP_BLOCKED_ADMIN':
      return 'BLOCK_ADMIN';
    case 'SPACE_OP_MAINTENANCE':
      return 'BLOCK_MAINTENANCE';
    case 'SPACE_OP_CLOSED':
      return 'BLOCK_CLOSURE';
    default:
      return null;
  }
}

/* ---- regla v2-0116 (§F2.2) ---------------------------------------------------- */

export interface AxesInput {
  readonly lifecycleActive: boolean;
  readonly availability: AvailabilityCode;
  readonly hygiene: HygieneCode;
  readonly terminalRequired: boolean;
  readonly isolation: IsolationCode;
  readonly occupancy: OccupancyCode;
  /** `infra.inspection_required` del establecimiento. */
  readonly inspectionRequired: boolean;
}

/** Primera regla que aplica, en el orden de la tabla de §F2.2. */
export function v2CodeOf(a: AxesInput): V2Code {
  if (a.availability !== 'SPACE_OP_AVAILABLE' || !a.lifecycleActive) return 'C';
  if (a.hygiene === 'HYG_CONTAMINATED') return 'K';
  if (a.isolation !== 'ISO_NONE') return 'I';
  if (a.occupancy === 'OCC_OCCUPIED') return 'O';
  if (a.occupancy === 'OCC_RESERVED') return 'R';
  if (
    a.hygiene === 'HYG_DIRTY' ||
    a.hygiene === 'HYG_CLEANING' ||
    (a.hygiene === 'HYG_CLEAN' && a.inspectionRequired) ||
    a.terminalRequired
  ) {
    return 'H';
  }
  return 'U';
}

/** «Asignable» de §F2.2: lo que consume la internación (F3). */
export function isAssignable(a: AxesInput): boolean {
  const hygieneOk = a.hygiene === 'HYG_INSPECTED' || (a.hygiene === 'HYG_CLEAN' && !a.inspectionRequired);
  return (
    a.lifecycleActive &&
    a.availability === 'SPACE_OP_AVAILABLE' &&
    a.occupancy === 'OCC_FREE' &&
    hygieneOk &&
    !a.terminalRequired
  );
}

/* ---- recuentos ----------------------------------------------------------------- */

/**
 * Los recuentos de un tablero **se cuentan** de las celdas; nunca se escriben.
 * Los mismos criterios del contrato: `blocked` agrupa los dos bloqueos y el
 * cierre; `maintenance` va aparte; `dirty` es sucia, `cleaning` es en limpieza.
 */
export function countCells(cells: readonly BedBoardCell[]): BedBoardCounts {
  const n = (f: (c: BedBoardCell) => boolean): number => cells.filter(f).length;
  return {
    total: cells.length,
    assignable: n((c) => c.assignable),
    occupied: n((c) => c.occupancy.code === 'OCC_OCCUPIED'),
    reserved: n((c) => c.occupancy.code === 'OCC_RESERVED'),
    blocked: n((c) =>
      ['SPACE_OP_BLOCKED_CLINICAL', 'SPACE_OP_BLOCKED_ADMIN', 'SPACE_OP_CLOSED'].includes(c.availability.code),
    ),
    maintenance: n((c) => c.availability.code === 'SPACE_OP_MAINTENANCE'),
    dirty: n((c) => c.hygiene.code === 'HYG_DIRTY'),
    cleaning: n((c) => c.hygiene.code === 'HYG_CLEANING'),
    isolation: n((c) => c.isolation.code !== 'ISO_NONE'),
    contaminated: n((c) => c.hygiene.code === 'HYG_CONTAMINATED'),
  };
}

/* ---- tiempo -------------------------------------------------------------------- */

/** Pasado este tiempo desde `generatedAt`, el tablero se muestra como S7. */
export const BOARD_STALE_AFTER_SECONDS = 120;
/** Cada cuánto se vuelve a pedir el tablero (F2.4). */
export const BOARD_POLL_INTERVAL_MS = 30_000;

export function secondsSince(iso: string, now: Date = new Date()): number {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : Math.max(0, Math.floor((now.getTime() - t) / 1000));
}

/** «hace 35 s» · «hace 4 min» · «hace 2 h» · «hace 3 d». */
export function ageLabel(iso: string, now: Date = new Date()): string {
  const s = secondsSince(iso, now);
  if (s < 5) return 'hace un momento';
  if (s < 60) return `hace ${s} s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

/** Minutos enteros desde `iso`, para ordenar y para «hace N min» de la cola. */
export function minutesSince(iso: string, now: Date = new Date()): number {
  return Math.floor(secondsSince(iso, now) / 60);
}

const DATE_PARTS = new Intl.DateTimeFormat('es-BO', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/La_Paz',
});

/** `2026-10-30T22:00:00Z` → `30/10 18:00` (hora de La Paz). */
export function shortDateTime(iso: string | null | undefined): string {
  if (iso === null || iso === undefined || iso === '') return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = Object.fromEntries(DATE_PARTS.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p['day']}/${p['month']} ${p['hour']}:${p['minute']}`;
}

export function isOverdue(expectedIso: string | null, now: Date = new Date()): boolean {
  return expectedIso !== null && new Date(expectedIso).getTime() < now.getTime();
}

/* ---- una celda en palabras ----------------------------------------------------- */

export interface CellSummary {
  /** Lo principal que se lee de la cama (el motivo, el paciente, el estado de higiene). */
  readonly headline: string;
  /** El complemento: hasta cuándo, desde cuándo. */
  readonly detail: string | null;
}

/**
 * Qué decir de una celda debajo de su código. Sigue la misma prioridad que el
 * `v2Code`, así que lo que se lee coincide con el badge: nunca «Disponible» con
 * un motivo de bloqueo al lado.
 */
export function summarizeCell(cell: BedBoardCell, reasons: readonly BlockReason[] = []): CellSummary {
  switch (cell.v2Code) {
    case 'C': {
      const reason = reasonLabel(cell.availability.reasonCode, reasons);
      const base = AVAILABILITY_LABEL[cell.availability.code];
      const until = cell.availability.expectedUntil;
      // «Mantenimiento · Mantenimiento preventivo» repite; si el motivo ya dice el tipo, va solo.
      const named = reason.toLowerCase().includes(base.toLowerCase()) ? reason : `${base} · ${reason}`;
      return {
        headline: cell.availability.code === 'SPACE_OP_AVAILABLE' ? 'Fuera de servicio' : named,
        detail: until === null ? null : `hasta ${shortDateTime(until)}`,
      };
    }
    case 'K':
      return { headline: 'Exige limpieza terminal', detail: null };
    case 'I':
      return {
        headline: ISOLATION_LABEL[cell.isolation.code],
        detail: cell.isolation.organism ? cell.isolation.organism : null,
      };
    case 'O':
      return {
        headline: cell.occupancy.patient
          ? `${cell.occupancy.patient.initials} · ${cell.occupancy.patient.ageYears} a`
          : 'Con paciente internado',
        detail: null,
      };
    case 'R':
      return { headline: 'Reservada para un ingreso', detail: null };
    case 'H':
      return {
        headline: cell.hygiene.terminalRequired
          ? 'Limpieza terminal pendiente'
          : cell.hygiene.code === 'HYG_CLEAN'
            ? 'Limpia, falta inspección'
            : HYGIENE_LABEL[cell.hygiene.code],
        detail: null,
      };
    case 'U':
      return { headline: 'Lista para asignar', detail: null };
  }
}

/* ---- qué ofrecer (solo refleja; la API decide) ---------------------------------- */

export type CellActionCode =
  | 'block-clinical'
  | 'block-admin'
  | 'start-maintenance'
  | 'close'
  | 'unblock'
  | 'end-maintenance'
  | 'reopen'
  | 'mark-dirty'
  | 'mark-contaminated'
  | 'isolate'
  | 'lift-isolation';

export interface CellActionOffer {
  readonly code: CellActionCode;
  readonly label: string;
}

const has = (viewer: OpsViewer | undefined, action: OpsAction): boolean => viewer?.actions.includes(action) === true;

/**
 * Las acciones sobre una cama que vale la pena **ofrecer** según su estado y lo
 * que el servidor dice que quien mira puede hacer. Una cama ocupada o reservada
 * no ofrece bloquear ni cerrar (la API respondería 409 `SPACE_OCCUPIED`); eso no
 * sustituye a la API, solo evita ofrecer lo que ya se sabe que no va.
 */
export function offerCellActions(cell: BedBoardCell, viewer: OpsViewer | undefined): readonly CellActionOffer[] {
  const out: CellActionOffer[] = [];
  // La jefatura de quirófano opera únicamente quirófanos; en el resto, la API respondería 403.
  if (viewer?.role === 'OR_MANAGER' && cell.function.code !== 'SPACE_FN_OPERATING_ROOM') return out;
  const free = cell.occupancy.code === 'OCC_FREE';
  const available = cell.availability.code === 'SPACE_OP_AVAILABLE';
  const cleanable = cell.hygiene.code !== 'HYG_DIRTY' && cell.hygiene.code !== 'HYG_CLEANING' && cell.hygiene.code !== 'HYG_CONTAMINATED' && cell.openCleaningOrderId === null;

  if (available && free) {
    if (has(viewer, 'block-clinical')) out.push({ code: 'block-clinical', label: 'Bloquear (clínico)' });
    if (has(viewer, 'block-administrative')) out.push({ code: 'block-admin', label: 'Bloquear (administrativo)' });
    if (has(viewer, 'maintenance')) out.push({ code: 'start-maintenance', label: 'Poner en mantenimiento' });
    if (has(viewer, 'close')) out.push({ code: 'close', label: 'Cerrar' });
  }
  if (cell.availability.code === 'SPACE_OP_BLOCKED_CLINICAL' && has(viewer, 'block-clinical')) {
    out.push({ code: 'unblock', label: 'Desbloquear' });
  }
  if (cell.availability.code === 'SPACE_OP_BLOCKED_ADMIN' && has(viewer, 'block-administrative')) {
    out.push({ code: 'unblock', label: 'Desbloquear' });
  }
  if (cell.availability.code === 'SPACE_OP_MAINTENANCE' && has(viewer, 'maintenance')) {
    out.push({ code: 'end-maintenance', label: 'Terminar mantenimiento' });
  }
  if (cell.availability.code === 'SPACE_OP_CLOSED' && has(viewer, 'close')) {
    out.push({ code: 'reopen', label: 'Reabrir' });
  }
  if (has(viewer, 'mark-dirty') && cleanable) out.push({ code: 'mark-dirty', label: 'Marcar sucia' });
  if (has(viewer, 'mark-contaminated') && cell.hygiene.code !== 'HYG_CONTAMINATED') {
    out.push({ code: 'mark-contaminated', label: 'Marcar contaminada' });
  }
  if (has(viewer, 'isolate')) {
    out.push(
      cell.isolation.code === 'ISO_NONE'
        ? { code: 'isolate', label: 'Aislar' }
        : { code: 'lift-isolation', label: 'Levantar aislamiento' },
    );
  }
  return out;
}

export type CleaningActionCode = 'assign' | 'start' | 'finish' | 'inspect-pass' | 'inspect-fail' | 'cancel';

export interface CleaningActionOffer {
  readonly code: CleaningActionCode;
  readonly label: string;
}

export const isTerminal = (o: Pick<CleaningOrder, 'cleaningType'>): boolean => o.cleaningType === 'CLEAN_TERMINAL';

/**
 * La transición válida de una orden, a quien puede pedirla. `userId` es quien
 * mira: la inspección la hace alguien **distinto** de quien terminó la limpieza
 * (`INSPECTION_BY_CLEANER_NOT_ALLOWED`) y la terminal solo supervisión
 * (`TERMINAL_INSPECTION_REQUIRES_SUPERVISOR`). Se ofrece lo que se sabe válido;
 * la API repite la comprobación.
 */
export function offerCleaningActions(
  order: CleaningOrder,
  viewer: OpsViewer | undefined,
  userId: string | null,
): readonly CleaningActionOffer[] {
  const out: CleaningActionOffer[] = [];
  switch (order.status) {
    case 'CLN_PENDING':
      if (has(viewer, 'assign')) out.push({ code: 'assign', label: order.assignedTo ? 'Reasignar' : 'Asignar' });
      if (has(viewer, 'clean')) out.push({ code: 'start', label: 'Iniciar' });
      if (has(viewer, 'create-cleaning')) out.push({ code: 'cancel', label: 'Cancelar' });
      break;
    case 'CLN_IN_PROGRESS':
      if (has(viewer, 'clean')) out.push({ code: 'finish', label: 'Terminar' });
      if (has(viewer, 'create-cleaning')) out.push({ code: 'cancel', label: 'Cancelar' });
      break;
    case 'CLN_DONE': {
      const mayInspect = has(viewer, isTerminal(order) ? 'inspect-terminal' : 'inspect');
      if (mayInspect && (userId === null || order.finishedByUserId !== userId)) {
        out.push({ code: 'inspect-pass', label: 'Aprobar' }, { code: 'inspect-fail', label: 'Rechazar' });
      }
      break;
    }
    default:
      break;
  }
  return out;
}

/** El orden de la cola: inmediata antes que urgente antes que rutina; luego la más vieja. */
export function sortCleaningQueue(items: readonly CleaningOrder[]): readonly CleaningOrder[] {
  const rank: Record<CleaningPriority, number> = { CLN_PRIO_STAT: 0, CLN_PRIO_URGENT: 1, CLN_PRIO_ROUTINE: 2 };
  return [...items].sort(
    (a, b) => rank[a.priority] - rank[b.priority] || a.requestedAt.localeCompare(b.requestedAt),
  );
}

/** ¿El tablero viene con una vista reducida (solo higiene)? */
export const isHygieneOnly = (viewer: OpsViewer | undefined): boolean =>
  viewer?.role === 'HOUSEKEEPING' || viewer?.role === 'HOUSEKEEPING_SUPERVISOR';

/** Las funciones no-cama que llevan estado operativo propio (§F2.4): quirófano, parto, box, procedimientos, imagen. */
const OPERABLE_FUNCTIONS: readonly string[] = [
  'SPACE_FN_OPERATING_ROOM',
  'SPACE_FN_DELIVERY_ROOM',
  'SPACE_FN_EMERGENCY_BOX',
  'SPACE_FN_PROCEDURE_ROOM',
  'SPACE_FN_IMAGING_ROOM',
];

/** ¿Este espacio tiene estado operativo? Una cama, o uno de esos locales. La API responde 404 al resto. */
export const hasOperationalState = (formCode: string, functionCode: string): boolean =>
  formCode === 'LOC_FORM_BED' || OPERABLE_FUNCTIONS.includes(functionCode);
