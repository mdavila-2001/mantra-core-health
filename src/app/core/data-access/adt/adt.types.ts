import type { InfraConcept } from '../infrastructure/infrastructure.types';

/* ============================================================================
    Tipos del cliente de internación / ADT — franja F3, módulo 08 (`clinical`).

    Las formas salen de la tabla de `§F3.3` de `CONTRATO-F2-F5.md`. Donde el
    contrato dice QUÉ viaja pero no CÓMO se llama la clave interna de la
    respuesta, el campo lleva un `SUPUESTO F3-n` (la lista completa está en
    `docs/frontend/evidence/infra-f3/REPORTE.md`). Lo que la API real devuelva
    distinto se reconcilia en este archivo y en nada más.

    Las fechas viajan como ISO 8601 y los conceptos como `{ code, display }`
    (igual que en F1): se compara por `code`, nunca por el rótulo.
    ========================================================================== */

/** Un concepto resuelto: el código es la identidad; el rótulo, sólo lectura. */
export type AdtConcept = InfraConcept;

/* ---- permisos que sólo se reflejan ---------------------------------------- */

/**
 * Qué puede hacer quien mira, tal como lo declara la API.
 *
 * SUPUESTO F3-1: el token no trae las asignaciones delegadas (Enfermería,
 * Admisión, supervisión), así que cada lectura declara lo que la persona puede
 * hacer, igual que `SiteSummary.viewer` en F1. Ocultar un control NO es
 * seguridad: la API contesta 403 `INFRA_ACTION_NOT_ALLOWED` igual.
 */
export interface AdtViewer {
  /** Ingresar, asignar, reservar, trasladar, intercambiar, dar el egreso, cancelar. */
  readonly canOperateBeds: boolean;
  /** Forzar una compatibilidad con justificación (supervisión de enfermería). */
  readonly canOverride: boolean;
  /** Revisar o cerrar un incidente de ubicación. */
  readonly canReviewIncidents: boolean;
  /** Cerrar el censo a mano. */
  readonly canCloseCensus: boolean;
  /** Registrar un ajuste sobre un censo cerrado. */
  readonly canAdjustCensus: boolean;
}

/* ---- la cama, como la entrega el tablero de F2 ----------------------------- */

/** Un tramo del camino físico de una cama: edificio › piso › sala › habitación. */
export interface BedPathItem {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly form: string;
}

/**
 * `BedBoardCell` de `§F2.3`. La definición vive en la franja F2
 * (`core/data-access/infrastructure-ops/`); esta copia es la parte que F3
 * lee, hasta que el integrador la reemplace por un `import` de esa carpeta.
 */
export interface BedBoardCell {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly path: readonly BedPathItem[];
  readonly form: AdtConcept;
  readonly function: AdtConcept;
  readonly lifecycle: AdtConcept;
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
  readonly isolation: { readonly code: string; readonly organism?: string | null; readonly since: string | null };
  readonly occupancy: {
    readonly code: string;
    readonly since: string | null;
    readonly encounterId?: string | null;
    readonly patient?: { readonly initials: string; readonly sexCode: string; readonly ageYears: number } | null;
  };
  /** Resumen HL7 v2-0116 (`C H I K O U`) más `R` (reservada, extensión local). */
  readonly v2Code: string;
  readonly assignable: boolean;
  readonly openCleaningOrderId: string | null;
  readonly lastEventAt: string | null;
  readonly opsVersion: number;
}

export interface BedBoardUnit {
  readonly unitId: string;
  readonly name: string;
  readonly counts: Readonly<Record<string, number>>;
  readonly cells: readonly BedBoardCell[];
}

/** `GET /sites/:siteId/bed-board` (F2). F3 sólo lo usa para ofrecer camas candidatas. */
export interface BedBoard {
  readonly generatedAt: string;
  readonly lastEventAt: string | null;
  readonly units: readonly BedBoardUnit[];
  readonly nextCursor: string | null;
  /** SUPUESTO F3-1: el tablero declara lo que puede hacer quien mira. */
  readonly viewer?: AdtViewer;
}

/* ---- compatibilidad -------------------------------------------------------- */

export const COMPATIBILITY_RULES = [
  'LIFECYCLE',
  'AVAILABILITY',
  'OCCUPANCY',
  'HYGIENE',
  'ISOLATION_AIRBORNE',
  'SEX',
  'AGE',
  'ISOLATION_COHORT',
  'LEVEL_OF_CARE',
] as const;
export type CompatibilityRule = (typeof COMPATIBILITY_RULES)[number];

export type ViolationSeverity = 'BLOCKING' | 'OVERRIDABLE';

export interface CompatibilityViolation {
  readonly rule: CompatibilityRule;
  readonly severity: ViolationSeverity;
  readonly detail: string;
}

/** `POST /clinical/encounters/:id/bed-compatibility` → esto. */
export interface BedCompatibility {
  readonly assignable: boolean;
  readonly violations: readonly CompatibilityViolation[];
}

/**
 * Datos del paciente que la comprobación de compatibilidad necesita antes de
 * que exista el encuentro (paso «Cama» del ingreso).
 *
 * DESVÍO F3-A (PROPUESTA, no contratada): `POST /clinical/encounters/:id/bed-compatibility`
 * pide un encuentro y, en el ingreso, todavía no existe. Se propone
 * `POST /clinical/admissions/bed-compatibility` con este cuerpo y la misma
 * respuesta. Si la API no la implementa (404/405), el paso Cama no muestra la
 * vista previa y la compatibilidad se decide al confirmar con los errores de
 * `POST /clinical/admissions`, que es la autoridad en cualquier caso.
 */
export interface AdmissionCompatibilityRequest {
  readonly patientProfileId: string;
  readonly careSpaceId: string;
  readonly levelOfCareCode: string;
  readonly isolationPrecautionCode?: string;
  readonly isolationOrganismText?: string;
}

/** Lo que se manda para forzar. La API revalida: la UI sólo junta el texto. */
export interface OverrideRequest {
  readonly justification: string;
  readonly ruleCodes: readonly CompatibilityRule[];
}

/* ---- ingreso --------------------------------------------------------------- */

export type BedMode = 'ASSIGN' | 'RESERVE';

export interface AdmissionRequest {
  readonly patientProfileId: string;
  readonly practiceSiteId: string;
  readonly episodeId?: string;
  readonly openEpisode?: boolean;
  readonly attendingPractitionerId: string;
  readonly levelOfCareCode: string;
  readonly admissionSourceCode: string;
  readonly isolationPrecautionCode?: string;
  readonly isolationOrganismText?: string;
  readonly reasonText: string;
  readonly expectedDischargeAt?: string;
  readonly bed?: { readonly careSpaceId: string; readonly mode: BedMode };
  readonly override?: OverrideRequest;
}

export interface AdmissionResult {
  readonly episodeId: string;
  readonly encounterId: string;
  readonly encounterLocationId?: string;
  readonly cell?: BedBoardCell;
  readonly incidentId?: string;
}

export interface BedAssignmentRequest {
  readonly careSpaceId: string;
  readonly mode: BedMode;
  readonly override?: OverrideRequest;
}

export interface BedAssignmentResult {
  readonly encounterLocationId: string;
  readonly cell: BedBoardCell;
  readonly incidentId?: string;
}

/* ---- traslado, intercambio, egreso, cancelación ---------------------------- */

export interface TransferRequest {
  readonly toCareSpaceId: string;
  readonly occurredAt?: string;
  readonly reasonCode: string;
  readonly override?: OverrideRequest;
}

export interface TransferResult {
  readonly fromLocationId: string;
  readonly toLocationId: string;
  readonly cleaningOrderId: string;
}

export interface BedSwapRequest {
  readonly encounterAId: string;
  readonly encounterBId: string;
  readonly occurredAt?: string;
  readonly reasonText: string;
  readonly override?: OverrideRequest;
}

export interface BedSwapResult {
  readonly locations: readonly StayMovement[];
}

export interface DischargeRequest {
  readonly dischargeDispositionCode: string;
  readonly occurredAt: string;
  readonly reasonText?: string;
  readonly closeEpisode?: boolean;
}

export interface DischargeResult {
  readonly encounterId: string;
  /** `null` si la internación no tenía cama (pendiente de cama): no hay nada que limpiar. */
  readonly cleaningOrderId: string | null;
}

export interface CancelLocationRequest {
  readonly reasonText: string;
}

/* ---- la ficha de internación ------------------------------------------------ */

export interface StayPatient {
  readonly id: string;
  readonly name: string;
  readonly initials: string;
  readonly sexCode: string;
  readonly ageYears: number;
}

export interface StayBedRef {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly path: readonly BedPathItem[];
}

/** Una fila de `encounter_locations` de camas, en el orden en que ocurrieron. */
export interface StayMovement {
  readonly id: string;
  readonly movementType: AdtConcept;
  readonly bed: StayBedRef;
  readonly status: AdtConcept;
  readonly periodStart: string;
  readonly periodEnd: string | null;
  readonly previousLocationId: string | null;
  readonly endReason: AdtConcept | null;
  readonly bedCategory: AdtConcept | null;
  readonly incidentId: string | null;
  /**
   * SUPUESTO F3-2: hasta cuándo se puede cancelar (`infra.adt_cancel_window_minutes`).
   * `null` = no se puede. La API decide igual al recibir el POST.
   */
  readonly cancellableUntil: string | null;
}

export const INCIDENT_STATUSES = ['PLC_INC_OPEN', 'PLC_INC_REVIEWED', 'PLC_INC_CLOSED'] as const;
export type IncidentStatusCode = (typeof INCIDENT_STATUSES)[number];

export interface PlacementIncident {
  readonly id: string;
  readonly encounterLocationId: string;
  readonly bed: StayBedRef;
  readonly violations: readonly { readonly rule: CompatibilityRule; readonly detail: string }[];
  readonly justificationText: string;
  readonly authorizedBy: string;
  readonly createdAt: string;
  readonly status: AdtConcept;
  readonly reviewedBy: string | null;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
}

export interface StayEncounter {
  readonly id: string;
  /** SUPUESTO F3-7: el establecimiento de la internación; sin él se usa el elegido en pantalla. */
  readonly siteId?: string;
  readonly episodeId: string | null;
  readonly patient: StayPatient;
  readonly status: AdtConcept;
  readonly levelOfCare: AdtConcept;
  readonly admissionSource: AdtConcept;
  readonly isolation: AdtConcept;
  readonly isolationOrganism: string | null;
  readonly reasonText: string;
  readonly attendingName: string | null;
  readonly startAt: string;
  readonly endAt: string | null;
  readonly expectedDischargeAt: string | null;
  readonly dischargeDisposition: AdtConcept | null;
  readonly unitName: string | null;
  /** Para el `If-Match` de traslado, asignación y egreso. */
  readonly rowVersion: number;
  readonly losDays: number;
}

/** `GET /clinical/encounters/:id/stay`. */
export interface StayView {
  readonly encounter: StayEncounter;
  /** La cama que ocupa hoy (o la reservada). `null` = pendiente de cama. */
  readonly currentBed: StayBedRef | null;
  readonly movements: readonly StayMovement[];
  readonly incidents: readonly PlacementIncident[];
  readonly asOf: string;
  /** SUPUESTO F3-1. */
  readonly viewer?: AdtViewer;
}

export interface ReviewIncidentRequest {
  readonly status: 'REVIEWED' | 'CLOSED';
  readonly reviewNote: string;
}

/* ---- censo vivo ------------------------------------------------------------- */

export interface InpatientRow {
  readonly encounterId: string;
  readonly patient: StayPatient;
  /** `null` = «pendiente de cama» (ingresó sin cama). */
  readonly bed: StayBedRef | null;
  readonly since: string;
  readonly levelOfCare: AdtConcept;
  readonly isolation: AdtConcept;
  readonly expectedDischargeAt: string | null;
  readonly losDays: number;
  readonly unitName: string | null;
}

/** SUPUESTO F3-3: el contrato muestra un arreglo; con `cursor` va envuelto. */
export interface InpatientsPage {
  readonly items: readonly InpatientRow[];
  readonly nextCursor: string | null;
  readonly generatedAt: string;
  readonly viewer?: AdtViewer;
}

/* ---- censo diario ------------------------------------------------------------ */

/** Las columnas numéricas del censo: lo único que un ajuste puede tocar. */
export const CENSUS_FIELDS = [
  'beds_censable',
  'beds_available',
  'beds_blocked',
  'patients_at_cutoff',
  'admissions',
  'discharges',
  'deaths',
  'transfers_in',
  'transfers_out',
  'same_day_stays',
  'patient_days',
  'discharge_stay_days',
] as const;
export type CensusField = (typeof CENSUS_FIELDS)[number];

export type CensusStatusCode = 'OPEN' | 'CLOSED';

export interface CensusDay {
  readonly id: string | null;
  readonly siteId: string;
  readonly unit: { readonly id: string; readonly code: string; readonly name: string };
  /** `YYYY-MM-DD`, en la zona de la sede. */
  readonly censusDate: string;
  readonly cutoffAt: string;
  readonly status: CensusStatusCode;
  readonly closedAt: string | null;
  /** `null` con `status = CLOSED` = lo cerró el corte programado (worker). */
  readonly closedBy: string | null;
  readonly bedsCensable: number;
  readonly bedsAvailable: number;
  readonly bedsBlocked: number;
  readonly patientsAtCutoff: number;
  readonly admissions: number;
  readonly discharges: number;
  readonly deaths: number;
  readonly transfersIn: number;
  readonly transfersOut: number;
  readonly sameDayStays: number;
  readonly patientDays: number;
  readonly dischargeStayDays: number;
  readonly contentHash: string | null;
}

export interface CensusAdjustment {
  readonly id: string;
  readonly censusDayId: string;
  readonly fieldCode: CensusField;
  readonly previousValue: number;
  readonly newValue: number;
  readonly reasonText: string;
  readonly entryRefId: string | null;
  readonly adjustedBy: string;
  readonly requestId: string;
  readonly createdAt: string;
}

/** Una unidad del censo: el snapshot (inmutable) y, aparte, sus ajustes. */
export interface CensusUnitView {
  readonly day: CensusDay;
  readonly adjustments: readonly CensusAdjustment[];
  /** El snapshot con los ajustes aplicados; sólo existe con el día cerrado. */
  readonly adjustedTotals: Readonly<Record<CensusField, number>> | null;
}

/** SUPUESTO F3-4: el contrato no nombra la envoltura del censo por unidad. */
export interface CensusResponse {
  readonly siteId: string;
  readonly date: string;
  readonly asOf: string;
  readonly units: readonly CensusUnitView[];
  readonly viewer?: AdtViewer;
}

export interface CloseCensusResult {
  readonly closed: readonly CensusDay[];
}

export interface AdjustCensusRequest {
  readonly fieldCode: CensusField;
  readonly newValue: number;
  readonly reasonText: string;
  readonly entryRefId?: string;
}

/* ---- indicadores --------------------------------------------------------------- */

export interface BedTurnaroundMinutes {
  readonly p50: number | null;
  readonly p90: number | null;
  readonly waitToStart: number | null;
  readonly cleaning: number | null;
  readonly inspection: number | null;
}

export interface InpatientIndicators {
  readonly period: { readonly from: string; readonly to: string };
  readonly days: number;
  readonly bedDaysAvailable: number;
  readonly patientDays: number;
  readonly admissions: number;
  readonly discharges: number;
  readonly dischargeStayDays: number;
  readonly avgBeds: number;
  readonly occupancyPct: number | null;
  readonly alos: number | null;
  readonly bedTurnover: number | null;
  readonly turnoverInterval: number | null;
  readonly bedTurnaroundMinutes: BedTurnaroundMinutes;
  readonly crossCheck: { readonly occupancyFromAlos: number | null; readonly deltaPct: number | null };
  readonly coverage: { readonly daysClosed: number; readonly daysMissing: readonly string[] };
  /** SUPUESTO F3-5: instante del cálculo, para el S7 obligatorio de `procesos/12`. */
  readonly asOf: string;
  /** SUPUESTO F3-5: desglose por unidad para «tabla por unidad». */
  readonly byUnit?: readonly IndicatorsByUnit[];
}

export interface IndicatorsByUnit {
  readonly unit: { readonly id: string; readonly code: string; readonly name: string };
  readonly bedDaysAvailable: number;
  readonly patientDays: number;
  readonly discharges: number;
  readonly dischargeStayDays: number;
  readonly occupancyPct: number | null;
  readonly alos: number | null;
  readonly bedTurnover: number | null;
  readonly turnoverInterval: number | null;
}

/* ---- razones de error del contrato --------------------------------------------- */

export const ADT_REASONS = [
  'INFRA_ACTION_NOT_ALLOWED',
  'BED_ASSIGNMENT_REQUIRES_ADT',
  'PATIENT_ALREADY_ADMITTED',
  'BED_NOT_ASSIGNABLE',
  'BED_DOUBLE_OCCUPANCY',
  'BED_COMPATIBILITY_OVERRIDE_REQUIRED',
  'OVERRIDE_JUSTIFICATION_TOO_SHORT',
  'OVERRIDE_RULE_NOT_OVERRIDABLE',
  'SPACE_NOT_A_BED',
  'ENCOUNTER_ALREADY_HAS_BED',
  'ENCOUNTER_HAS_NO_BED',
  'TRANSFER_TO_SAME_BED',
  'OCCURRED_AT_IN_FUTURE',
  'OCCURRED_AT_BEFORE_CURRENT_START',
  'SWAP_REQUIRES_TWO_OCCUPIED_BEDS',
  'SWAP_SAME_ENCOUNTER',
  'ENCOUNTER_NOT_IN_PROGRESS',
  'DISCHARGE_DISPOSITION_REQUIRED',
  'PREVIOUS_BED_NO_LONGER_AVAILABLE',
  'ADT_CANCEL_WINDOW_EXPIRED',
  'LOCATION_NOT_CANCELLABLE',
  'CENSUS_ALREADY_CLOSED',
  'CENSUS_DATE_NOT_ENDED',
  'CENSUS_NOT_CLOSED',
  'ADJUSTMENT_REASON_REQUIRED',
  'ADJUSTMENT_FIELD_INVALID',
  'INDICATOR_RANGE_TOO_LONG',
] as const;
export type AdtReason = (typeof ADT_REASONS)[number];

/** Lo que una pantalla de ADT lee de un fallo de la API. */
export interface AdtErrorDetail {
  readonly status: number;
  readonly reason: AdtReason | null;
  readonly message: string;
  readonly requestId: string | undefined;
  readonly violations: readonly CompatibilityViolation[];
  readonly requiredRoles: readonly string[];
}
