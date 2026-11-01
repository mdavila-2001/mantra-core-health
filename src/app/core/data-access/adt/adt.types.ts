/* ============================================================================
    Tipos de internación / ADT — franja F3 (`CONTRATO-F2-F5.md` §F3).

    **La API manda las formas**: cada interfaz copia lo que devuelve
    `mantra-core-health-api` (`clinical/dto/inpatient.dto.ts` y
    `services/inpatient/*.use-cases.ts`). Los conceptos viajan como **código**
    (`LOC_CARE_ICU`, `LOCATION_ACTIVE`, `ENCOUNTER_IN_PROGRESS`…) y la
    etiqueta la pone `ops-labels.ts`. Las lecturas que la API no tipa en el
    `openapi.json` (estancia, internados, censo, indicadores) se fijan contra
    el código del use case, citado en cada interfaz.
    ========================================================================== */

export type LevelOfCareCode = 'LOC_CARE_GENERAL' | 'LOC_CARE_INTERMEDIATE' | 'LOC_CARE_ICU' | 'LOC_CARE_NEONATAL_ICU';

export type AdmissionSourceCode =
  | 'ADM_SRC_EMERGENCY'
  | 'ADM_SRC_OUTPATIENT'
  | 'ADM_SRC_REFERRAL'
  | 'ADM_SRC_BIRTH'
  | 'ADM_SRC_TRANSFER_IN';

export type DischargeDispositionCode = 'DISP_HOME' | 'DISP_TRANSFER' | 'DISP_DEATH' | 'DISP_AGAINST_ADVICE' | 'DISP_OTHER';

export type MovementTypeCode = 'ADT_ADMIT' | 'ADT_TRANSFER' | 'ADT_SWAP' | 'ADT_RESERVE';

export type LocationStatusCode = 'LOCATION_ACTIVE' | 'LOCATION_RESERVED' | 'LOCATION_COMPLETED' | 'LOCATION_CANCELLED';

/** Reglas de compatibilidad (F3.2). Las cuatro primeras y la aérea nunca se fuerzan. */
export type CompatibilityRule =
  | 'LIFECYCLE'
  | 'AVAILABILITY'
  | 'OCCUPANCY'
  | 'HYGIENE'
  | 'ISOLATION_AIRBORNE'
  | 'SEX'
  | 'AGE'
  | 'ISOLATION_COHORT'
  | 'LEVEL_OF_CARE';

/** `Violation` de `clinical/domain/inpatient/bed-compatibility.ts`. */
export interface CompatibilityViolation {
  readonly rule: CompatibilityRule;
  readonly severity: 'BLOCKING' | 'OVERRIDABLE';
  readonly detail: string;
}

/** `CompatibilityRuleDto`: una regla evaluada. */
export interface CompatibilityRuleResult {
  readonly code: string;
  readonly severity: 'BLOCKING' | 'OVERRIDABLE';
  readonly overridable: boolean;
  readonly detail: string;
}

/** `CompatibilityResultDto` (con encuentro o prospectiva). `violations` es la forma anterior, que la web lee. */
export interface BedCompatibility {
  readonly assignable: boolean;
  readonly rules: readonly CompatibilityRuleResult[];
  readonly violations: readonly CompatibilityViolation[];
}

/** `ProspectiveCompatibilityDto` — `POST /clinical/bed-compatibility`, antes de que exista el encuentro. */
export interface ProspectiveCompatibilityRequest {
  readonly careSpaceId: string;
  readonly patientProfileId: string;
  readonly levelOfCareCode?: LevelOfCareCode;
  readonly isolationPrecautionCode?: string;
  readonly isolationOrganismText?: string;
}

/** `PlacementOverrideDto`. */
export interface PlacementOverride {
  readonly justification: string;
  readonly ruleCodes: readonly CompatibilityRule[];
}

/** `CreateAdmissionDto`. */
export interface AdmissionRequest {
  readonly patientProfileId: string;
  readonly practiceSiteId: string;
  readonly episodeId?: string;
  readonly openEpisode?: boolean;
  readonly attendingPractitionerId?: string;
  readonly levelOfCareCode: LevelOfCareCode;
  readonly admissionSourceCode: AdmissionSourceCode;
  readonly isolationPrecautionCode?: string;
  readonly isolationOrganismText?: string;
  readonly reasonText: string;
  readonly expectedDischargeAt?: string;
  readonly bed?: { readonly careSpaceId: string; readonly mode: 'ASSIGN' | 'RESERVE' };
  readonly override?: PlacementOverride;
}

/** `BedAssignmentDto`. */
export interface BedAssignmentRequest {
  readonly careSpaceId: string;
  readonly mode: 'ASSIGN' | 'RESERVE';
  readonly override?: PlacementOverride;
}

/** `CareSpaceOperationalState` del puerto de F2: el `cell` de las respuestas ADT (desvío API-F2F5). */
export interface CareSpaceOperationalState {
  readonly careSpaceId: string;
  readonly formCode: string | null;
  readonly functionCode: string | null;
  readonly lifecycle: string;
  readonly availability: string;
  readonly hygiene: string;
  readonly isolation: string;
  readonly occupancy: string;
  readonly terminalCleaningRequired: boolean;
  readonly v2Code: string;
  readonly assignable: boolean;
  readonly violations: readonly string[];
  readonly opsVersion: number;
}

/**
 * `AdtResultDto`: una sola forma para todo movimiento ADT; cada uno llena los
 * campos que le corresponden. `requestId` lo agrega la API en F2–F5.
 */
export interface AdtResult {
  readonly episodeId?: string;
  readonly encounterId?: string;
  readonly encounterLocationId?: string;
  readonly fromLocationId?: string;
  readonly toLocationId?: string;
  readonly cleaningOrderId?: string | null;
  readonly incidentId?: string;
  readonly cell?: CareSpaceOperationalState;
  readonly locations?: readonly EncounterLocation[];
  readonly requestId?: string;
}

/** `TransferDto`. */
export interface TransferRequest {
  readonly toCareSpaceId: string;
  readonly occurredAt?: string;
  readonly reasonCode?: string;
  readonly override?: PlacementOverride;
}

/** `BedSwapDto`. */
export interface SwapRequest {
  readonly encounterAId: string;
  readonly encounterBId: string;
  readonly occurredAt?: string;
  readonly reasonText: string;
  readonly override?: PlacementOverride;
}

/** `DischargeDto`. */
export interface DischargeRequest {
  readonly dischargeDispositionCode?: DischargeDispositionCode;
  readonly occurredAt?: string;
  readonly reasonText?: string;
  readonly closeEpisode?: boolean;
}

/** `locationView` de `adt.use-cases.ts`: una fila de `encounter_locations`. */
export interface EncounterLocation {
  readonly id: string;
  readonly encounterId: string;
  readonly careSpaceId: string | null;
  /** `LOCATION_ACTIVE | LOCATION_RESERVED | LOCATION_COMPLETED | LOCATION_CANCELLED`. */
  readonly status: string | null;
  /** `ADT_ADMIT | ADT_TRANSFER | ADT_SWAP | ADT_RESERVE`. */
  readonly movement: string | null;
  readonly endReason: string | null;
  readonly periodStart: string | null;
  readonly periodEnd: string | null;
  readonly previousEncounterLocationId: string | null;
  readonly placementIncidentId: string | null;
}

/** Un incidente de ubicación forzada, como lo arma `InpatientReadUseCases.stay`. */
export interface PlacementIncident {
  readonly id: string;
  readonly encounterLocationId: string | null;
  readonly careSpaceId: string;
  readonly violations: readonly CompatibilityViolation[] | null;
  /** `PLC_INC_OPEN | PLC_INC_REVIEWED | PLC_INC_CLOSED`. */
  readonly status: string | null;
  readonly reviewedAt: string | null;
}

/** `encounterView` de `inpatient-read.use-cases.ts`. */
export interface StayEncounter {
  readonly id: string;
  readonly episodeId: string | null;
  readonly patientProfileId: string;
  readonly class: string | null;
  /** `ENCOUNTER_IN_PROGRESS | ENCOUNTER_FINISHED | …`. */
  readonly status: string | null;
  readonly levelOfCare: string | null;
  readonly admissionSource: string | null;
  readonly dischargeDisposition: string | null;
  readonly startAt: string | null;
  readonly endAt: string | null;
  readonly expectedDischargeAt: string | null;
  readonly rowVersion: number;
}

/** `GET /clinical/encounters/:id/stay` → `{encounter, movements, incidents}`. */
export interface InpatientStay {
  readonly encounter: StayEncounter;
  readonly movements: readonly EncounterLocation[];
  readonly incidents: readonly PlacementIncident[];
}

/** `AttendingPractitionerDto` — `GET /sites/:siteId/attending-practitioners`. */
export interface AttendingPractitioner {
  readonly practitionerProfileId: string;
  readonly displayName: string;
  readonly specialty: { readonly code: string; readonly display: string } | null;
}

/** `PATCH /clinical/placement-incidents/:id` (`ReviewIncidentDto`). */
export interface ReviewIncidentRequest {
  readonly status: 'REVIEWED' | 'CLOSED';
  readonly reviewNote: string;
}

/** Respuesta de la revisión: `{id, status}`. */
export interface ReviewIncidentResult {
  readonly id: string;
  readonly status: 'REVIEWED' | 'CLOSED';
  readonly requestId?: string;
}

/* ---- censo ---------------------------------------------------------------- */

/** `CENSUS_FIELDS` de `clinical/domain/inpatient/census.ts`, en camelCase. */
export const CENSUS_FIELDS = [
  'bedsCensable',
  'bedsAvailable',
  'bedsBlocked',
  'patientsAtCutoff',
  'admissions',
  'discharges',
  'deaths',
  'transfersIn',
  'transfersOut',
  'sameDayStays',
  'patientDays',
  'dischargeStayDays',
] as const;
export type CensusField = (typeof CENSUS_FIELDS)[number];

export type CensusCounts = Readonly<Record<CensusField, number>>;

/** `adjView` de `census.use-cases.ts`. `fieldCode` viaja en snake_case, como lo guarda el modelo. */
export interface CensusAdjustment {
  readonly id: string;
  readonly fieldCode: string;
  readonly previousValue: number;
  readonly newValue: number;
  readonly reasonText: string;
  readonly adjustedByUserId: string | null;
  readonly createdAt: string;
}

/** `CensusDayView` de `census.use-cases.ts`: una fila por unidad. */
export interface CensusDayView {
  /** `null` mientras el día está abierto: la vista previa no se persiste. */
  readonly id: string | null;
  readonly unitId: string | null;
  readonly date: string;
  readonly status: 'OPEN' | 'CLOSED';
  readonly cutoffAt: string;
  readonly counts: CensusCounts;
  readonly adjustments: readonly CensusAdjustment[];
  readonly adjustedTotals: CensusCounts;
}

/** `CloseCensusDto`. */
export interface CloseCensusRequest {
  readonly unitIds?: readonly string[];
}

/** `POST /sites/:siteId/census/:date/close` → `{closed}`. */
export interface CloseCensusResult {
  readonly closed: readonly CensusDayView[];
  readonly requestId?: string;
}

/** `CensusAdjustmentDto`. */
export interface CensusAdjustmentRequest {
  readonly fieldCode: CensusField;
  readonly newValue: number;
  readonly reasonText: string;
  readonly entryRefId?: string;
}

/* ---- indicadores ---------------------------------------------------------- */

/** `computeIndicators` de `census.ts`, **sin redondear**. */
export interface IndicatorTotals {
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
  /** `deltaPct` en puntos porcentuales: |ocupación − estimada|. */
  readonly crossCheck: { readonly occupancyFromAlos: number | null; readonly deltaPct: number | null };
}

export interface BedTurnaround {
  readonly p50: number | null;
  readonly p90: number | null;
  readonly waitToStart: number | null;
  readonly cleaning: number | null;
  readonly inspection: number | null;
}

/** `GET /sites/:siteId/inpatient-indicators` tal como viene. */
export interface InpatientIndicators extends IndicatorTotals {
  readonly period: { readonly from: string; readonly to: string };
  readonly bedTurnaroundMinutes: BedTurnaround;
  readonly coverage: { readonly daysClosed: number; readonly daysMissing: readonly string[] };
}
