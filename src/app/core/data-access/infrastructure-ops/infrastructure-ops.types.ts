/* ============================================================================
    Tipos de la operación de camas y salas — franja F2 (`CONTRATO-F2-F5.md` §F2).

    Tres ejes manuales (disponibilidad, higiene, aislamiento) y uno derivado
    (ocupación, que sale de `encounter_locations` de F3). El resumen HL7 v2-0116
    se **calcula** en la API; acá sólo se lee.
    ========================================================================== */

/** Un concepto del catálogo: código estable + texto para mostrar. */
export interface OpsConcept {
  readonly code: string;
  readonly display: string;
}

/** HL7 v2-0116 más la extensión local `R` (reservada). */
export const V2_CODES = ['C', 'K', 'I', 'O', 'R', 'H', 'U'] as const;
export type V2Code = (typeof V2_CODES)[number];

export type AvailabilityCode =
  | 'SPACE_OP_AVAILABLE'
  | 'SPACE_OP_BLOCKED_CLINICAL'
  | 'SPACE_OP_BLOCKED_ADMIN'
  | 'SPACE_OP_MAINTENANCE'
  | 'SPACE_OP_CLOSED';

export type HygieneCode = 'HYG_CLEAN' | 'HYG_DIRTY' | 'HYG_CLEANING' | 'HYG_INSPECTED' | 'HYG_CONTAMINATED';

export type IsolationCode = 'ISO_NONE' | 'ISO_CONTACT' | 'ISO_DROPLET' | 'ISO_AIRBORNE' | 'ISO_PROTECTIVE';

export type OccupancyCode = 'OCC_FREE' | 'OCC_RESERVED' | 'OCC_OCCUPIED';

export type BlockKindCode = 'BLOCK_CLINICAL' | 'BLOCK_ADMIN' | 'BLOCK_MAINTENANCE' | 'BLOCK_CLOSURE';

export type CleaningStatusCode =
  | 'CLN_PENDING'
  | 'CLN_IN_PROGRESS'
  | 'CLN_DONE'
  | 'CLN_INSPECTED'
  | 'CLN_REJECTED'
  | 'CLN_CANCELLED';

export type CleaningTypeCode = 'CLEAN_ROUTINE' | 'CLEAN_DISCHARGE' | 'CLEAN_TERMINAL' | 'CLEAN_OR_TURNOVER' | 'CLEAN_SPOT';

export type CleaningPriorityCode = 'CLN_PRIO_ROUTINE' | 'CLN_PRIO_URGENT' | 'CLN_PRIO_STAT';

export type CleaningTriggerCode =
  | 'CLN_TRG_DISCHARGE'
  | 'CLN_TRG_TRANSFER'
  | 'CLN_TRG_MANUAL'
  | 'CLN_TRG_ISOLATION_END'
  | 'CLN_TRG_CONTAMINATION'
  | 'CLN_TRG_MAINTENANCE_END'
  | 'CLN_TRG_OR_TURNOVER'
  | 'CLN_TRG_INSPECTION_FAILED';

export type StatusAxisCode = 'AXIS_AVAILABILITY' | 'AXIS_HYGIENE' | 'AXIS_ISOLATION' | 'AXIS_OCCUPANCY';

export type StatusSourceCode = 'SRC_MANUAL' | 'SRC_ADT' | 'SRC_CLEANING' | 'SRC_BLOCK' | 'SRC_ROOM_EVENT' | 'SRC_SYSTEM';

/**
 * Lo que la API dice que **este actor** puede hacer (§0.3). La pantalla no
 * deduce permisos: los lee. Ocultar un botón no protege nada; la API vuelve a
 * decidir en cada petición.
 */
export type InfraAction =
  | 'board.view'
  | 'board.view-patient'
  | 'block.clinical'
  | 'block.admin'
  | 'maintenance'
  | 'hygiene.mark-dirty'
  | 'hygiene.mark-contaminated'
  | 'isolation'
  | 'cleaning.view'
  | 'cleaning.create'
  | 'cleaning.assign'
  | 'cleaning.work'
  | 'cleaning.inspect'
  | 'history.view'
  | 'adt.admit'
  | 'adt.transfer'
  | 'adt.discharge'
  | 'adt.override'
  | 'adt.cancel'
  | 'incident.review'
  | 'census.view'
  | 'census.close'
  | 'census.adjust'
  | 'indicators.view';

/** Rol operativo resuelto por la API desde `organization_user_assignments`. */
export type InfraRoleCode =
  | 'SUPERADMIN'
  | 'ORG_ADMIN'
  | 'NURSE'
  | 'NURSE_SUPERVISOR'
  | 'ADMISSION'
  | 'HOUSEKEEPING'
  | 'HOUSEKEEPING_SUPERVISOR'
  | 'MAINTENANCE'
  | 'BILLING';

/** Un establecimiento donde el actor tiene algún rol operativo. */
export interface AccessSite {
  readonly siteId: string;
  readonly code: string;
  readonly name: string;
  readonly timeZone: string;
  readonly roles: readonly InfraRoleCode[];
  readonly actions: readonly InfraAction[];
}

/** `GET /practice/infrastructure-access/me` (desvío W-F2F3-1). */
export interface InfrastructureAccess {
  readonly userId: string;
  readonly sites: readonly AccessSite[];
}

export interface BedPathStep {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly form: string;
}

export interface BedPatient {
  readonly initials: string;
  readonly sexCode: string;
  readonly ageYears: number;
}

/** Una celda del tablero (`BedBoardCell` de F2.3) + `actions` (desvío W-F2F3-2). */
export interface BedBoardCell {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly path: readonly BedPathStep[];
  readonly form: OpsConcept;
  readonly function: OpsConcept;
  readonly lifecycle: OpsConcept;
  readonly unitId: string | null;
  readonly availability: {
    readonly code: AvailabilityCode;
    readonly display: string;
    readonly reasonCode: string | null;
    readonly reasonText: string | null;
    readonly expectedUntil: string | null;
    readonly since: string | null;
  };
  readonly hygiene: {
    readonly code: HygieneCode;
    readonly display: string;
    readonly since: string | null;
    readonly terminalRequired: boolean;
  };
  readonly isolation: {
    readonly code: IsolationCode;
    readonly display: string;
    readonly organism?: string | null;
    readonly since: string | null;
  };
  readonly occupancy: {
    readonly code: OccupancyCode;
    readonly display: string;
    readonly since: string | null;
    readonly encounterId?: string;
    readonly encounterLocationId?: string;
    /** Sólo para Enfermería/Admisión; nunca para Limpieza ni Mantenimiento. */
    readonly patient?: BedPatient;
  };
  readonly v2Code: V2Code;
  readonly assignable: boolean;
  readonly openCleaningOrderId: string | null;
  readonly lastEventAt: string | null;
  readonly opsVersion: number;
  readonly actions: readonly InfraAction[];
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

/** `GET /sites/:siteId/bed-board`. */
export interface BedBoard {
  readonly siteId: string;
  readonly generatedAt: string;
  readonly lastEventAt: string | null;
  readonly units: readonly BedBoardUnit[];
  readonly nextCursor: string | null;
}

export interface BedBoardQuery {
  readonly unitId?: string | null;
  readonly parentSpaceId?: string | null;
  readonly functionCodes?: readonly string[];
  readonly v2Codes?: readonly V2Code[];
}

export interface CareSpaceBlock {
  readonly id: string;
  readonly careSpaceId: string;
  readonly kind: OpsConcept;
  readonly reason: OpsConcept;
  readonly reasonText: string | null;
  readonly startsAt: string;
  readonly expectedEndAt: string | null;
  readonly endedAt: string | null;
  readonly endNote: string | null;
  readonly cancelledAt: string | null;
  readonly cancelReason: string | null;
  readonly createdByName: string | null;
  readonly workOrderRef: string | null;
}

export interface CleaningOrder {
  readonly id: string;
  readonly siteId: string;
  readonly careSpaceId: string;
  readonly careSpaceCode: string;
  readonly careSpaceName: string;
  readonly clinicalUnitId: string | null;
  readonly unitName: string | null;
  readonly type: OpsConcept & { readonly code: CleaningTypeCode };
  readonly trigger: OpsConcept & { readonly code: CleaningTriggerCode };
  readonly priority: OpsConcept & { readonly code: CleaningPriorityCode };
  readonly status: OpsConcept & { readonly code: CleaningStatusCode };
  readonly previousOrderId: string | null;
  readonly requestedAt: string;
  readonly dueAt: string | null;
  readonly assignedUserId: string | null;
  readonly assignedName: string | null;
  readonly startedAt: string | null;
  readonly startedByName: string | null;
  readonly finishedAt: string | null;
  readonly finishedByUserId: string | null;
  readonly finishedByName: string | null;
  readonly inspectedAt: string | null;
  readonly inspectedByName: string | null;
  readonly inspectionResult: 'PASS' | 'FAIL' | null;
  readonly rejectionReason: string | null;
  readonly cancelReason: string | null;
  readonly inspectionRequired: boolean;
  readonly rowVersion: number;
  /** Transiciones que este actor puede pedir ahora (desvío W-F2F3-2). */
  readonly allowedTransitions: readonly CleaningTransition[];
}

export type CleaningTransition = 'assign' | 'start' | 'finish' | 'inspect' | 'cancel';

export interface CleaningOrderPage {
  readonly items: readonly CleaningOrder[];
  readonly nextCursor: string | null;
  readonly generatedAt: string;
}

export interface CleaningOrderQuery {
  readonly status?: readonly CleaningStatusCode[];
  readonly unitId?: string | null;
  readonly assignedTo?: 'me' | null;
  readonly priority?: CleaningPriorityCode | null;
}

/** Un evento A20, append-only. */
export interface CareSpaceStatusEvent {
  readonly id: string;
  readonly careSpaceId: string;
  readonly axis: OpsConcept & { readonly code: StatusAxisCode };
  readonly from: OpsConcept | null;
  readonly to: OpsConcept;
  readonly reasonCode: string | null;
  readonly reasonText: string | null;
  readonly expectedUntil: string | null;
  readonly v2Code: V2Code;
  readonly source: OpsConcept & { readonly code: StatusSourceCode };
  readonly occurredAt: string;
  readonly recordedByName: string | null;
  readonly requestId: string;
}

export interface StatusEventPage {
  readonly items: readonly CareSpaceStatusEvent[];
  readonly nextCursor: string | null;
}

/** `GET /care-spaces/:id/operational-state`. */
export interface OperationalState {
  readonly cell: BedBoardCell;
  readonly openBlocks: readonly CareSpaceBlock[];
  readonly openCleaningOrder: CleaningOrder | null;
}

export type AvailabilityAction = 'block' | 'unblock' | 'start-maintenance' | 'close' | 'reopen';

export interface AvailabilityRequest {
  readonly action: AvailabilityAction;
  readonly kindCode?: BlockKindCode;
  readonly reasonCode?: string;
  readonly reasonText?: string;
  readonly startsAt?: string;
  readonly expectedEndAt?: string;
  readonly acknowledgeConflicts?: boolean;
}

export interface FutureCommitmentConflict {
  readonly kind: 'PROCEDURE_CASE' | 'APPOINTMENT' | 'BOOKING';
  readonly id: string;
  /** `null` cuando el módulo dueño del compromiso no expone el horario. */
  readonly startsAt: string | null;
  readonly nextAction: string;
}

export interface MutationResult {
  readonly cell: BedBoardCell;
  readonly requestId: string;
}

export interface AvailabilityResult extends MutationResult {
  readonly blockId: string | null;
}

export interface HygieneRequest {
  readonly action: 'mark-dirty' | 'mark-contaminated';
  readonly reasonText: string;
}

export interface HygieneResult extends MutationResult {
  readonly cleaningOrderId: string;
}

export interface IsolationRequest {
  readonly isolationCode: IsolationCode;
  readonly organismText?: string;
  readonly reasonText: string;
  readonly cohortApproved?: boolean;
}

export interface IsolationResult extends MutationResult {
  readonly companionBlocks: readonly { readonly careSpaceId: string; readonly blockId: string }[];
}

export interface CreateCleaningOrderRequest {
  readonly careSpaceId: string;
  readonly typeCode: CleaningTypeCode;
  readonly priorityCode: CleaningPriorityCode;
  readonly note?: string;
}

export interface CleaningOrderResult {
  readonly order: CleaningOrder;
  readonly requestId: string;
}

/** Un motivo de bloqueo y a qué tipos de bloqueo aplica (F2.2). */
export interface BlockReason extends OpsConcept {
  readonly kinds: readonly BlockKindCode[];
  readonly requiresText: boolean;
}

/** Lo que F2 agrega a `GET /practice/infrastructure-catalog`. */
export interface InfrastructureOpsCatalog {
  readonly availability: readonly OpsConcept[];
  readonly hygiene: readonly OpsConcept[];
  readonly isolation: readonly OpsConcept[];
  readonly occupancy: readonly OpsConcept[];
  readonly blockKinds: readonly OpsConcept[];
  readonly blockReasons: readonly BlockReason[];
  readonly cleaningTypes: readonly OpsConcept[];
  readonly cleaningPriorities: readonly OpsConcept[];
  readonly v2Map: readonly { readonly code: V2Code; readonly display: string; readonly rule: string }[];
}
