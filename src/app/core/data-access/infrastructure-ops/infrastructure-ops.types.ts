/* ============================================================================
    Tipos de la operación de camas y salas — franja F2 (`CONTRATO-F2-F5.md` §F2).

    **La API manda las formas** (decisión del orquestador, 31/10/2026): cada
    interfaz copia el DTO de `mantra-core-health-api`
    (`src/modules/practice/dto/care-space-ops.dto.ts`, rama de F2–F5). La API
    manda **códigos**, nunca textos: forma, función, ciclo de vida y cada eje
    viajan como `string`, y la etiqueta en castellano la pone la web con el
    mapa de conceptos de `ops-labels.ts`.

    La prueba de contrato (`infrastructure-contract.spec.ts`) compara estas
    formas y las respuestas de la maqueta contra el `openapi.json` de la API.
    ========================================================================== */

/** Un concepto del catálogo, como lo arma `opsCatalogGroups` de la API. */
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

/** Ciclo de vida del espacio tal como lo devuelve la celda (`lifecycleStateOf`). */
export type LifecycleState = 'PLANNED' | 'ACTIVE' | 'SUSPENDED' | 'RETIRED';

export type BlockKindCode = 'BLOCK_CLINICAL' | 'BLOCK_ADMIN' | 'BLOCK_MAINTENANCE' | 'BLOCK_CLOSURE';

export type CleaningStatusCode = 'CLN_PENDING' | 'CLN_IN_PROGRESS' | 'CLN_DONE' | 'CLN_INSPECTED' | 'CLN_REJECTED' | 'CLN_CANCELLED';

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

/** Eje del evento A20 (`AXIS` de `ops-catalog.ts`): sin prefijo. */
export type StatusAxisCode = 'AVAILABILITY' | 'HYGIENE' | 'ISOLATION' | 'OCCUPANCY';

/** Fuente del evento A20 (`SOURCE` de `ops-catalog.ts`): sin prefijo. */
export type StatusSourceCode = 'MANUAL' | 'ADT' | 'CLEANING' | 'BLOCK' | 'ROOM_EVENT' | 'SYSTEM';

/**
 * Las acciones de la política de §0.3 tal como las registra la API
 * (`policies/infra-f2.policy.ts` y `clinical/policies/infra-f3.policy.ts`).
 * La pantalla no deduce permisos: los lee de `BedBoardCell.actions` y de
 * `/practice/infrastructure-access/me`. Ocultar un botón no protege nada; la
 * API vuelve a decidir en cada petición.
 */
export type InfraAction =
  | 'f2.board.read'
  | 'f2.availability.clinical'
  | 'f2.availability.admin'
  | 'f2.availability.maintenance'
  | 'f2.hygiene.mark-dirty'
  | 'f2.hygiene.mark-contaminated'
  | 'f2.isolation.set'
  | 'f2.isolation.cohort-approve'
  | 'f2.cleaning.read'
  | 'f2.cleaning.create'
  | 'f2.cleaning.assign'
  | 'f2.cleaning.work'
  | 'f2.cleaning.inspect'
  | 'f2.cleaning.cancel'
  | 'f2.events.read'
  | 'f3.adt.place'
  | 'f3.adt.override'
  | 'f3.adt.read'
  | 'f3.incident.review'
  | 'f3.census.read'
  | 'f3.census.close'
  | 'f3.census.adjust'
  | 'f3.indicators.read';

/** Rol operativo resuelto por la API (`InfraRole` de `domain/ops/infra-scope.ts`). */
export type InfraRoleCode =
  | 'SUPERADMIN'
  | 'ORG_ADMIN'
  | 'SITE_ADMIN'
  | 'NURSE'
  | 'NURSE_SUPERVISOR'
  | 'ADMISSION'
  | 'HOUSEKEEPING'
  | 'HOUSEKEEPING_SUPERVISOR'
  | 'MAINTENANCE'
  | 'OR_MANAGER'
  | 'BILLING'
  | 'INFECTION_CONTROL'
  | 'UNIT_HEAD';

/** `InfraAccessGrantDto`: una asignación de UNIDAD o ESPACIO con lo que permite ahí. */
export interface AccessGrant {
  readonly scope: 'UNIT' | 'SPACE';
  readonly role: string;
  readonly clinicalUnitId: string | null;
  readonly careSpaceId: string | null;
  readonly actions: readonly InfraAction[];
}

/** `InfraAccessSiteDto`: un establecimiento donde el actor tiene algún rol operativo. */
export interface AccessSite {
  readonly siteId: string;
  readonly practiceId: string;
  readonly code: string;
  readonly name: string;
  /** IANA (`America/La_Paz`) de la sede o de la práctica; `null` sin zona declarada. */
  readonly timeZone: string | null;
  /** Roles de nivel sede u organización. */
  readonly roles: readonly string[];
  readonly globalRoles: readonly string[];
  /** Acciones sobre la sede **entera**. */
  readonly actions: readonly InfraAction[];
  /** Asignaciones acotadas a una unidad o un espacio. */
  readonly grants: readonly AccessGrant[];
}

/** `GET /practice/infrastructure-access/me` (`InfraAccessMeDto`). */
export interface InfrastructureAccess {
  readonly userId: string;
  readonly tenantId: string;
  readonly sites: readonly AccessSite[];
}

/** `SpacePathItemDto`. */
export interface BedPathStep {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly form: string | null;
}

/**
 * `BedPatientDto`: iniciales, sexo y edad. Sólo viaja a Enfermería/Admisión
 * sobre ese espacio; nunca a Limpieza ni a Mantenimiento. `sexCode` es
 * `M`/`F`/`O` o `null` (sin dato), `ageYears` `null` sin fecha de nacimiento.
 */
export interface BedPatient {
  readonly initials: string;
  readonly sexCode: string | null;
  readonly ageYears: number | null;
}

/** `BedBoardCellDto`. */
export interface BedBoardCell {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly path: readonly BedPathStep[];
  /** `LOC_FORM_*`. */
  readonly form: string | null;
  /** `SPACE_FN_*`. */
  readonly function: string | null;
  /** `PLANNED | ACTIVE | SUSPENDED | RETIRED`. */
  readonly lifecycle: string;
  readonly availability: {
    readonly code: string;
    readonly reasonCode: string | null;
    readonly reasonText: string | null;
    readonly expectedUntil: string | null;
    readonly since: string | null;
  };
  readonly hygiene: {
    readonly code: string;
    readonly since: string | null;
    readonly terminalRequired: boolean;
  };
  readonly isolation: {
    readonly code: string;
    readonly organism?: string | null;
    readonly since: string | null;
  };
  readonly occupancy: {
    readonly code: string;
    readonly since: string | null;
    /** Sólo con rol clínico sobre el espacio (igual que `patient`). */
    readonly encounterId?: string | null;
    /** Ubicación ADT vigente; sólo con rol clínico. */
    readonly encounterLocationId?: string | null;
    readonly patient?: BedPatient;
  };
  readonly v2Code: V2Code;
  readonly assignable: boolean;
  readonly openCleaningOrderId: string | null;
  readonly lastEventAt: string | null;
  readonly opsVersion: number;
  /** Unidad dueña de la cama (vínculo OWNER vigente o la del espacio). */
  readonly unitId: string | null;
  /** Lo que el actor puede hacer sobre **esta** cama según la política; la UI lo combina con el estado. */
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

/** `BedBoardUnitDto` — `unitId` es `null` para «Sin unidad». */
export interface BedBoardUnit {
  readonly unitId: string | null;
  readonly name: string;
  readonly counts: BedBoardCounts;
  readonly cells: readonly BedBoardCell[];
}

/** `GET /sites/:siteId/bed-board` (`BedBoardDto`). */
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

/** `CareSpaceBlockDto`. */
export interface CareSpaceBlock {
  readonly id: string;
  readonly careSpaceId: string;
  readonly kindCode: string;
  readonly reasonCode: string;
  readonly reasonText: string | null;
  readonly startsAt: string;
  readonly expectedEndAt: string | null;
  readonly endedAt: string | null;
  readonly cancelledAt: string | null;
  readonly endNote: string | null;
  readonly cancelReason: string | null;
  readonly rowVersion: number;
}

export type CleaningTransition = 'assign' | 'start' | 'finish' | 'inspect' | 'cancel';

/** `CleaningOrderDto` — **sin datos de paciente**. */
export interface CleaningOrder {
  readonly id: string;
  readonly careSpaceId: string;
  readonly careSpaceCode: string;
  readonly careSpaceName: string;
  readonly clinicalUnitId: string | null;
  readonly typeCode: string;
  readonly triggerCode: string;
  readonly priorityCode: string;
  readonly statusCode: string;
  readonly requestedAt: string;
  readonly dueAt: string | null;
  readonly assignedUserId: string | null;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly finishedByUserId: string | null;
  readonly inspectedAt: string | null;
  readonly inspectionResult: string | null;
  readonly rejectionReason: string | null;
  readonly previousOrderId: string | null;
  readonly ageMinutes: number;
  readonly rowVersion: number;
  /** Transiciones que **este actor** puede pedir ahora (estado ∩ permisos). */
  readonly allowedTransitions: readonly CleaningTransition[];
  /** La orden exige inspección (terminal o `infra.inspection_required`). */
  readonly inspectionRequired: boolean;
}

/** `CleaningOrderListDto`. */
export interface CleaningOrderPage {
  readonly items: readonly CleaningOrder[];
  readonly nextCursor: string | null;
  readonly generatedAt: string;
}

/** Filtros de `CleaningOrderQueryDto` (`status` y `priority` son un solo valor). */
export interface CleaningOrderQuery {
  readonly status?: CleaningStatusCode | null;
  readonly unitId?: string | null;
  readonly assignedTo?: 'me' | null;
  readonly priority?: CleaningPriorityCode | null;
}

/** `StatusEventDto` — un evento A20, append-only. */
export interface CareSpaceStatusEvent {
  readonly id: string;
  readonly axis: string;
  readonly from: string | null;
  readonly to: string;
  readonly v2Code: string;
  readonly reasonCode: string | null;
  readonly reasonText: string | null;
  readonly expectedUntil: string | null;
  readonly source: string;
  readonly sourceRefId: string | null;
  readonly occurredAt: string;
  readonly recordedByUserId: string | null;
  readonly requestId: string | null;
}

/** `StatusEventListDto`. */
export interface StatusEventPage {
  readonly items: readonly CareSpaceStatusEvent[];
  readonly nextCursor: string | null;
}

/** `GET /care-spaces/:id/operational-state` — `OperationalStateDto extends BedBoardCellDto`. */
export interface OperationalState extends BedBoardCell {
  readonly openBlocks: readonly CareSpaceBlock[];
  readonly openCleaningOrder: CleaningOrder | null;
}

export type AvailabilityAction = 'block' | 'unblock' | 'start-maintenance' | 'close' | 'reopen';

/** `AvailabilityChangeDto`. */
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

/**
 * El `requestId` que la API agrega al cuerpo de toda mutación de F2/F3
 * (`RequestIdBodyInterceptor`, igual al de la cabecera `X-Request-Id`). El
 * `openapi.json` lo declara opcional.
 */
export interface WithRequestId {
  readonly requestId?: string;
}

/** `AvailabilityResultDto`. */
export interface AvailabilityResult extends WithRequestId {
  readonly cell: BedBoardCell;
  readonly blockId: string | null;
  readonly conflicts?: readonly Record<string, unknown>[];
}

/** `HygieneActionDto`. */
export interface HygieneRequest {
  readonly action: 'mark-dirty' | 'mark-contaminated';
  readonly reasonText?: string;
}

/** `HygieneResultDto`. */
export interface HygieneResult extends WithRequestId {
  readonly cell: BedBoardCell;
  readonly cleaningOrderId: string;
}

/** `IsolationChangeDto`. */
export interface IsolationRequest {
  readonly isolationCode: IsolationCode;
  readonly organismText?: string;
  readonly reasonText?: string;
  readonly cohortApproved?: boolean;
}

/** `IsolationResultDto`. */
export interface IsolationResult extends WithRequestId {
  readonly cell: BedBoardCell;
  readonly companionBlocks: readonly { readonly careSpaceId: string; readonly blockId: string }[];
  readonly cleaningOrderId?: string | null;
}

/** `CreateCleaningOrderDto`. */
export interface CreateCleaningOrderRequest {
  readonly careSpaceId: string;
  readonly typeCode: CleaningTypeCode;
  readonly priorityCode?: CleaningPriorityCode;
  readonly note?: string;
}

/** Respuesta de alta y de cada transición de una orden: el `CleaningOrderDto`. */
export type CleaningOrderResult = CleaningOrder & WithRequestId;

/** Respuesta de `POST /care-space-blocks/:id/{end|cancel}`: el `CareSpaceBlockDto`. */
export type BlockResult = CareSpaceBlock & WithRequestId;

/** Un motivo de bloqueo y a qué tipos aplica (`opsCatalogGroups().blockReasons`). */
export interface BlockReason extends OpsConcept {
  readonly kinds: readonly string[];
}

/** Una regla del mapeo v2 tal como la publica el catálogo. */
export interface V2MapRule {
  readonly order: number;
  readonly condition: string;
  readonly v2Code: string;
}

/** Lo que F2 agrega a `GET /practice/infrastructure-catalog` (`opsCatalogGroups`). */
export interface InfrastructureOpsCatalog {
  readonly availability: readonly OpsConcept[];
  readonly hygiene: readonly OpsConcept[];
  readonly isolation: readonly OpsConcept[];
  readonly occupancy: readonly OpsConcept[];
  readonly blockReasons: readonly BlockReason[];
  readonly cleaningTypes: readonly OpsConcept[];
  readonly cleaningPriorities: readonly OpsConcept[];
  readonly v2Map: readonly V2MapRule[];
}
