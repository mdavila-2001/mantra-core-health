/* ============================================================================
    Contratos de la operación de camas y salas — franja F2.

    Espejo de `CONTRATO-F2-F5.md` §F2.1–F2.3 del vault de documentación
    (`SALUD/Arquitectura/infraestructura-hospitalaria/`). Todo `readonly`: la
    pantalla proyecta y filtra, nunca muta la respuesta. Las fechas viajan como
    texto ISO y se quedan así.

    ## Qué está fijado por el contrato y qué es un supuesto

    El contrato fija las **rutas**, los **cuerpos de petición**, los **errores** y
    la forma de `BedBoardCell` y del tablero. De las demás respuestas no fija la
    forma interna: donde el tipo dice «SUPUESTO F2» es lo que este cliente espera
    y lo que hay que confrontar con la API real cuando exista.

    ## Tres ejes manuales y uno derivado

    Disponibilidad, higiene y aislamiento se mueven a mano (cada uno con su
    regla); la **ocupación se deriva** de las ubicaciones de internación (F3) y
    jamás se escribe desde aquí. El resumen `v2Code` (HL7 v2-0116) es una
    proyección que calcula el servidor: la pantalla lo muestra, no lo recalcula
    para decidir nada.
    ========================================================================== */

import type { InfraConcept, SpacePathStep } from '../infrastructure/infrastructure.types';

/* ---- códigos de los conceptos (F2.2) ----------------------------------------- */

/** Resumen HL7 v2-0116 de la cama; `R` es la extensión local de «reservada». */
export const V2_CODES = ['U', 'O', 'R', 'H', 'K', 'I', 'C'] as const;
export type V2Code = (typeof V2_CODES)[number];

export const AVAILABILITY_CODES = [
  'SPACE_OP_AVAILABLE',
  'SPACE_OP_BLOCKED_CLINICAL',
  'SPACE_OP_BLOCKED_ADMIN',
  'SPACE_OP_MAINTENANCE',
  'SPACE_OP_CLOSED',
] as const;
export type AvailabilityCode = (typeof AVAILABILITY_CODES)[number];

export const HYGIENE_CODES = ['HYG_CLEAN', 'HYG_DIRTY', 'HYG_CLEANING', 'HYG_INSPECTED', 'HYG_CONTAMINATED'] as const;
export type HygieneCode = (typeof HYGIENE_CODES)[number];

export const ISOLATION_CODES = ['ISO_NONE', 'ISO_CONTACT', 'ISO_DROPLET', 'ISO_AIRBORNE', 'ISO_PROTECTIVE'] as const;
export type IsolationCode = (typeof ISOLATION_CODES)[number];

export const OCCUPANCY_CODES = ['OCC_FREE', 'OCC_RESERVED', 'OCC_OCCUPIED'] as const;
export type OccupancyCode = (typeof OCCUPANCY_CODES)[number];

export const AXIS_CODES = ['AXIS_AVAILABILITY', 'AXIS_HYGIENE', 'AXIS_ISOLATION', 'AXIS_OCCUPANCY'] as const;
export type AxisCode = (typeof AXIS_CODES)[number];

/** Tipo de bloqueo (`care_space_blocks.kind_concept_id`). */
export const BLOCK_KINDS = ['BLOCK_CLINICAL', 'BLOCK_ADMIN', 'BLOCK_MAINTENANCE', 'BLOCK_CLOSURE'] as const;
export type BlockKind = (typeof BLOCK_KINDS)[number];

export const CLEANING_TYPES = ['CLEAN_ROUTINE', 'CLEAN_DISCHARGE', 'CLEAN_TERMINAL', 'CLEAN_OR_TURNOVER', 'CLEAN_SPOT'] as const;
export type CleaningType = (typeof CLEANING_TYPES)[number];

export const CLEANING_PRIORITIES = ['CLN_PRIO_ROUTINE', 'CLN_PRIO_URGENT', 'CLN_PRIO_STAT'] as const;
export type CleaningPriority = (typeof CLEANING_PRIORITIES)[number];

export const CLEANING_STATUSES = ['CLN_PENDING', 'CLN_IN_PROGRESS', 'CLN_DONE', 'CLN_INSPECTED', 'CLN_REJECTED', 'CLN_CANCELLED'] as const;
export type CleaningStatus = (typeof CLEANING_STATUSES)[number];

export type CleaningTrigger =
  | 'CLN_TRG_DISCHARGE'
  | 'CLN_TRG_TRANSFER'
  | 'CLN_TRG_MANUAL'
  | 'CLN_TRG_ISOLATION_END'
  | 'CLN_TRG_CONTAMINATION'
  | 'CLN_TRG_MAINTENANCE_END'
  | 'CLN_TRG_OR_TURNOVER'
  | 'CLN_TRG_INSPECTION_FAILED';

export type StatusSource = 'SRC_MANUAL' | 'SRC_ADT' | 'SRC_CLEANING' | 'SRC_BLOCK' | 'SRC_ROOM_EVENT' | 'SRC_SYSTEM';

/* ---- qué puede hacer quien mira (SUPUESTO F2) -------------------------------- */

/**
 * Acciones operativas que la interfaz puede ofrecer. Una por fila de la tabla
 * de permisos de F2.3.
 */
export const OPS_ACTIONS = [
  'block-clinical',
  'block-administrative',
  'maintenance',
  'close',
  'mark-dirty',
  'mark-contaminated',
  'isolate',
  'clean',
  'assign',
  'inspect',
  'inspect-terminal',
  'create-cleaning',
  'see-history',
] as const;
export type OpsAction = (typeof OPS_ACTIONS)[number];

/**
 * El rol operativo de quien mira, para escoger **cuánto** del tablero se dibuja.
 * `HOUSEKEEPING` ve solo el eje de higiene; el resto ve los cuatro ejes.
 */
export type OpsRole =
  | 'NURSING'
  | 'NURSE_SUPERVISOR'
  | 'ADMISSION'
  | 'HOUSEKEEPING'
  | 'HOUSEKEEPING_SUPERVISOR'
  | 'MAINTENANCE'
  | 'OR_MANAGER'
  | 'ADMIN'
  | 'SUPPORT'
  | 'READ_ONLY';

/**
 * SUPUESTO F2 — **no está en el contrato**. El token no trae las asignaciones
 * delegadas (enfermería, limpieza, mantenimiento), así que la interfaz no puede
 * deducir qué botones ofrecer. Se pide a la API que lo declare en la respuesta
 * del tablero, de la cola y del estado operativo, igual que `SiteSummary.viewer`
 * en F1. **Solo refleja**: cada mutación la vuelve a decidir la API (403).
 */
export interface OpsViewer {
  readonly role: OpsRole;
  readonly actions: readonly OpsAction[];
}

/* ---- tablero — GET /sites/:siteId/bed-board ---------------------------------- */

export interface CellAvailability {
  readonly code: AvailabilityCode;
  readonly reasonCode: string | null;
  readonly reasonText: string | null;
  readonly expectedUntil: string | null;
  readonly since: string;
}

export interface CellHygiene {
  readonly code: HygieneCode;
  readonly since: string;
  readonly terminalRequired: boolean;
}

export interface CellIsolation {
  readonly code: IsolationCode;
  readonly organism?: string | null;
  readonly since: string;
}

/** Solo viaja a Enfermería y Admisión del espacio: nunca a Limpieza ni a Mantenimiento. */
export interface CellPatient {
  readonly initials: string;
  readonly sexCode: string;
  readonly ageYears: number;
}

export interface CellOccupancy {
  readonly code: OccupancyCode;
  readonly since: string;
  readonly encounterId?: string | null;
  readonly patient?: CellPatient | null;
}

/** `BedBoardCell` del contrato, campo por campo. */
export interface BedBoardCell {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly path: readonly SpacePathStep[];
  readonly form: InfraConcept;
  readonly function: InfraConcept;
  readonly lifecycle: InfraConcept;
  readonly availability: CellAvailability;
  readonly hygiene: CellHygiene;
  readonly isolation: CellIsolation;
  readonly occupancy: CellOccupancy;
  readonly v2Code: V2Code;
  readonly assignable: boolean;
  readonly openCleaningOrderId: string | null;
  readonly lastEventAt: string;
  /** `If-Match-Ops` de las mutaciones de este espacio. */
  readonly opsVersion: number;
}

export interface BedBoardCounts {
  readonly total: number;
  readonly assignable: number;
  readonly occupied: number;
  readonly reserved: number;
  readonly blocked: number;
  readonly maintenance: number;
  readonly dirty: number;
  readonly cleaning: number;
  readonly isolation: number;
  readonly contaminated: number;
}

export interface BedBoardUnit {
  readonly unitId: string;
  readonly name: string;
  readonly counts: BedBoardCounts;
  readonly cells: readonly BedBoardCell[];
}

export interface BedBoard {
  /** Cuándo armó la API esta lectura: base del S7 («Dato de hace N min»). */
  readonly generatedAt: string;
  /** El evento de estado más reciente; es también la cabecera `X-Data-As-Of`. */
  readonly lastEventAt: string;
  readonly units: readonly BedBoardUnit[];
  readonly nextCursor: string | null;
  /** SUPUESTO F2: ver {@link OpsViewer}. */
  readonly viewer?: OpsViewer;
}

export interface BedBoardQuery {
  readonly unitId?: string;
  readonly parentSpaceId?: string;
  readonly functionCodes?: readonly string[];
  readonly v2Codes?: readonly V2Code[];
  readonly cursor?: string;
}

/* ---- bloqueos y orden abierta ------------------------------------------------ */

/**
 * `care_space_blocks`. SUPUESTO F2: el contrato lista las columnas de la tabla,
 * no la forma de la respuesta; se espera `camelCase` y los usuarios como nombre.
 */
export interface CareSpaceBlock {
  readonly id: string;
  readonly careSpaceId: string;
  readonly kind: BlockKind;
  readonly reasonCode: string;
  readonly reasonText: string | null;
  readonly startsAt: string;
  readonly expectedEndAt: string | null;
  readonly endedAt: string | null;
  readonly endedBy: string | null;
  readonly endNote: string | null;
  readonly cancelledAt: string | null;
  readonly cancelReason: string | null;
  readonly workOrderRef: string | null;
  readonly startedBy: string | null;
}

/** `GET /care-spaces/:id/operational-state`. */
export interface OperationalState extends BedBoardCell {
  readonly openBlocks: readonly CareSpaceBlock[];
  readonly openCleaningOrder: CleaningOrder | null;
  /** SUPUESTO F2: ver {@link OpsViewer}. */
  readonly viewer?: OpsViewer;
}

/* ---- cola de limpieza -------------------------------------------------------- */

/**
 * `cleaning_orders` **sin datos de paciente** (F2.3). SUPUESTO F2: la forma de
 * la respuesta; el espacio y la unidad viajan resueltos para no pedir cada uno.
 */
export interface CleaningOrder {
  readonly id: string;
  readonly siteId: string;
  readonly careSpace: { readonly id: string; readonly code: string; readonly name: string; readonly pathLabel: string };
  readonly clinicalUnit: { readonly id: string; readonly name: string } | null;
  readonly cleaningType: CleaningType;
  readonly trigger: CleaningTrigger;
  readonly priority: CleaningPriority;
  readonly status: CleaningStatus;
  readonly requestedAt: string;
  readonly dueAt: string | null;
  readonly assignedTo: { readonly id: string; readonly displayName: string } | null;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly finishedByUserId: string | null;
  readonly inspectedAt: string | null;
  readonly inspectionResult: 'PASS' | 'FAIL' | null;
  readonly rejectionReason: string | null;
  readonly cancelReason: string | null;
  readonly previousOrderId: string | null;
  readonly note: string | null;
  /** `If-Match` de las transiciones de la orden. */
  readonly rowVersion: number;
}

export interface CleaningOrderList {
  readonly items: readonly CleaningOrder[];
  readonly nextCursor: string | null;
  readonly generatedAt: string;
  /** SUPUESTO F2: ver {@link OpsViewer}. */
  readonly viewer?: OpsViewer;
}

export interface CleaningOrderQuery {
  readonly status?: CleaningStatus;
  readonly unitId?: string;
  readonly assignedTo?: 'me';
  readonly priority?: CleaningPriority;
  readonly cursor?: string;
}

/* ---- historial A20 ----------------------------------------------------------- */

/** `care_space_status_events` (append-only). SUPUESTO F2: usuario como nombre. */
export interface StatusEvent {
  readonly id: string;
  readonly axis: AxisCode;
  readonly from: string | null;
  readonly to: string;
  readonly reasonCode: string | null;
  readonly reasonText: string | null;
  readonly expectedUntil: string | null;
  readonly v2Code: V2Code;
  readonly source: StatusSource;
  readonly sourceRefId: string | null;
  readonly occurredAt: string;
  readonly recordedBy: string | null;
  readonly requestId: string;
}

export interface StatusEventPage {
  readonly items: readonly StatusEvent[];
  readonly nextCursor: string | null;
  readonly generatedAt: string;
}

export interface StatusEventQuery {
  readonly axis?: AxisCode;
  readonly from?: string;
  readonly to?: string;
  readonly cursor?: string;
}

/* ---- catálogo extendido (GET /practice/infrastructure-catalog) --------------- */

/**
 * SUPUESTO F2: el contrato dice `blockReasons: {code, kinds[]}`; se espera además
 * `display`. Si no viniera, la pantalla usa el rótulo propio de ese código.
 */
export interface BlockReason {
  readonly code: string;
  readonly display?: string;
  /** A qué tipos de bloqueo aplica el motivo. */
  readonly kinds: readonly BlockKind[];
}

export interface OpsCatalogExtension {
  readonly availability: readonly InfraConcept[];
  readonly hygiene: readonly InfraConcept[];
  readonly isolation: readonly InfraConcept[];
  readonly occupancy: readonly InfraConcept[];
  readonly blockReasons: readonly BlockReason[];
  readonly cleaningTypes: readonly InfraConcept[];
  readonly cleaningPriorities: readonly InfraConcept[];
  readonly v2Map: readonly { readonly rule: number; readonly condition: string; readonly code: V2Code }[];
}

/* ---- cuerpos de petición (F2.3) ---------------------------------------------- */

export type AvailabilityAction = 'block' | 'unblock' | 'start-maintenance' | 'close' | 'reopen';

export interface AvailabilityRequest {
  readonly action: AvailabilityAction;
  readonly kindCode: BlockKind;
  readonly reasonCode: string;
  readonly reasonText?: string;
  readonly startsAt?: string;
  readonly expectedEndAt?: string;
  readonly acknowledgeConflicts?: boolean;
}

/** `{cell, blockId}` del contrato. */
export interface AvailabilityResult {
  readonly cell: BedBoardCell;
  readonly blockId: string | null;
}

export type HygieneAction = 'mark-dirty' | 'mark-contaminated';

export interface HygieneRequest {
  readonly action: HygieneAction;
  readonly reasonText: string;
}

export interface HygieneResult {
  readonly cell: BedBoardCell;
  readonly cleaningOrderId: string;
}

export interface IsolationRequest {
  readonly isolationCode: IsolationCode;
  readonly organismText?: string;
  readonly reasonText: string;
  readonly cohortApproved?: boolean;
}

export interface IsolationResult {
  readonly cell: BedBoardCell;
  readonly companionBlocks: readonly { readonly careSpaceId: string; readonly blockId: string }[];
}

export interface CreateCleaningOrderRequest {
  readonly careSpaceId: string;
  readonly typeCode: CleaningType;
  readonly priorityCode: CleaningPriority;
  readonly note?: string;
}

export type CleaningTransition = 'assign' | 'start' | 'finish' | 'inspect' | 'cancel';

export interface AssignRequest {
  readonly userId: string | null;
}
export interface FinishRequest {
  readonly note?: string;
}
export interface InspectRequest {
  readonly result: 'PASS' | 'FAIL';
  readonly reasonText?: string;
}
export interface CancelCleaningRequest {
  readonly reason: string;
}

/* ---- errores ----------------------------------------------------------------- */

/** Los `reason` de F2.3 que la interfaz sabe leer. */
export const OPS_REASONS = [
  'BLOCK_REASON_REQUIRED',
  'BLOCK_REASON_TEXT_REQUIRED',
  'BLOCK_EXPECTED_END_REQUIRED',
  'BLOCK_REASON_KIND_MISMATCH',
  'SPACE_NOT_ACTIVE',
  'SPACE_OCCUPIED',
  'BLOCK_OVERLAP',
  'FUTURE_COMMITMENTS_CONFLICT',
  'OPS_VERSION_MISMATCH',
  'BLOCK_ALREADY_ENDED',
  'CLEANING_ORDER_ALREADY_OPEN',
  'TERMINAL_CLEANING_REQUIRED',
  'CLEANING_ORDER_INVALID_TRANSITION',
  'INSPECTION_REASON_REQUIRED',
  'INSPECTION_BY_CLEANER_NOT_ALLOWED',
  'TERMINAL_INSPECTION_REQUIRES_SUPERVISOR',
  'ISOLATION_ROOM_NOT_CAPABLE',
  'ISOLATION_REASON_REQUIRED',
  'ISOLATION_COHORT_REQUIRES_APPROVAL',
  'INFRA_ACTION_NOT_ALLOWED',
] as const;
export type OpsReason = (typeof OPS_REASONS)[number];

/** Un compromiso futuro que el bloqueo pisaría (`FUTURE_COMMITMENTS_CONFLICT`). */
export interface FutureCommitment {
  readonly kind: 'PROCEDURE_CASE' | 'APPOINTMENT' | 'BOOKING';
  readonly id: string;
  readonly startsAt: string;
  /** Qué hacer para resolverlo. Nunca se omite. */
  readonly nextAction: string;
}

/** Lo que la interfaz extrae de un error de la API de operación. */
export interface OpsErrorDetail {
  readonly status: number;
  readonly reason: OpsReason | null;
  readonly message: string;
  readonly requestId: string | undefined;
  readonly conflicts: readonly FutureCommitment[];
  /** `ISOLATION_ROOM_NOT_CAPABLE`: lo que le falta al local. */
  readonly missing: readonly string[];
  /** `CLEANING_ORDER_INVALID_TRANSITION`. */
  readonly from: string | null;
  readonly to: string | null;
  /** `INFRA_ACTION_NOT_ALLOWED`: roles que sí podrían. */
  readonly requiredRoles: readonly string[];
  /** `CLEANING_ORDER_ALREADY_OPEN`: la orden que ya existe. */
  readonly openOrderId: string | null;
}
