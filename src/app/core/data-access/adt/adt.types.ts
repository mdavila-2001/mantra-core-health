/* ============================================================================
    Tipos de internación / ADT — franja F3 (`CONTRATO-F2-F5.md` §F3).
    ========================================================================== */

import type { BedBoardCell, OpsConcept } from '../infrastructure-ops/infrastructure-ops.types';

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

export interface CompatibilityViolation {
  readonly rule: CompatibilityRule;
  readonly severity: 'BLOCKING' | 'OVERRIDABLE';
  readonly detail: string;
}

export interface BedCompatibility {
  readonly assignable: boolean;
  readonly violations: readonly CompatibilityViolation[];
}

/** Compatibilidad **antes** de que exista el encuentro (desvío W-F2F3-4). */
export interface ProspectiveCompatibilityRequest {
  readonly careSpaceId: string;
  readonly patientProfileId: string;
  readonly levelOfCareCode: LevelOfCareCode;
  readonly isolationPrecautionCode?: string;
  readonly isolationOrganismText?: string;
}

export interface PlacementOverride {
  readonly justification: string;
  readonly ruleCodes: readonly CompatibilityRule[];
}

export interface AdmissionRequest {
  readonly patientProfileId: string;
  readonly practiceSiteId: string;
  readonly episodeId?: string;
  readonly openEpisode?: boolean;
  readonly attendingPractitionerId: string;
  readonly levelOfCareCode: LevelOfCareCode;
  readonly admissionSourceCode: AdmissionSourceCode;
  readonly isolationPrecautionCode?: string;
  readonly isolationOrganismText?: string;
  readonly reasonText: string;
  readonly expectedDischargeAt?: string;
  readonly bed?: { readonly careSpaceId: string; readonly mode: 'ASSIGN' | 'RESERVE' };
  readonly override?: PlacementOverride;
}

export interface AdmissionResult {
  readonly episodeId: string;
  readonly encounterId: string;
  readonly encounterLocationId?: string;
  readonly cell?: BedBoardCell;
  readonly incidentId?: string;
  readonly requestId: string;
}

export interface BedAssignmentResult {
  readonly encounterLocationId: string;
  readonly cell: BedBoardCell;
  readonly incidentId?: string;
  readonly requestId: string;
}

export interface TransferRequest {
  readonly toCareSpaceId: string;
  readonly occurredAt?: string;
  readonly reasonCode: string;
  readonly override?: PlacementOverride;
}

export interface TransferResult {
  readonly fromLocationId: string;
  readonly toLocationId: string;
  readonly cleaningOrderId: string;
  readonly requestId: string;
}

export interface SwapRequest {
  readonly encounterAId: string;
  readonly encounterBId: string;
  readonly occurredAt?: string;
  readonly reasonText: string;
  readonly override?: PlacementOverride;
}

export interface SwapResult {
  readonly locations: readonly EncounterLocation[];
  readonly requestId: string;
}

export interface DischargeRequest {
  readonly dischargeDispositionCode: DischargeDispositionCode;
  readonly occurredAt: string;
  readonly reasonText?: string;
  readonly closeEpisode?: boolean;
}

export interface DischargeResult {
  readonly encounterId: string;
  readonly cleaningOrderId: string;
  readonly requestId: string;
}

export interface StayBed {
  readonly careSpaceId: string;
  readonly code: string;
  readonly name: string;
  readonly unitId: string | null;
  readonly unitName: string | null;
  readonly siteId: string;
}

/** Una fila de `encounter_locations` (= FHIR `Encounter.location`). */
export interface EncounterLocation {
  readonly id: string;
  readonly encounterId: string;
  readonly bed: StayBed;
  readonly movementType: OpsConcept & { readonly code: MovementTypeCode };
  readonly status: OpsConcept & { readonly code: LocationStatusCode };
  readonly periodStart: string;
  readonly periodEnd: string | null;
  readonly endReason: OpsConcept | null;
  readonly previousEncounterLocationId: string | null;
  readonly placementIncidentId: string | null;
  /** Reserva o traslado que todavía se puede cancelar (A11/A12). */
  readonly cancellable: boolean;
  /** Mensaje HL7 v2 equivalente (A01/A02/A17/A14), para la línea de tiempo. */
  readonly hl7Event: string;
}

export interface PlacementIncident {
  readonly id: string;
  readonly encounterId: string;
  readonly careSpaceId: string;
  readonly bedCode: string;
  readonly violations: readonly { readonly rule: CompatibilityRule; readonly detail: string }[];
  readonly justification: string;
  readonly authorizedByName: string | null;
  readonly status: OpsConcept & { readonly code: 'PLC_INC_OPEN' | 'PLC_INC_REVIEWED' | 'PLC_INC_CLOSED' };
  readonly reviewedByName: string | null;
  readonly reviewedAt: string | null;
  readonly reviewNote: string | null;
  readonly createdAt: string;
}

export interface StayPatient {
  readonly patientProfileId: string;
  readonly displayName: string;
  readonly initials: string;
  readonly sexCode: string;
  readonly ageYears: number;
}

/** `GET /clinical/encounters/:id/stay`. */
export interface InpatientStay {
  readonly encounterId: string;
  readonly episodeId: string;
  readonly siteId: string;
  readonly status: 'IN_PROGRESS' | 'FINISHED';
  readonly patient: StayPatient;
  readonly attendingName: string | null;
  readonly levelOfCare: OpsConcept;
  readonly admissionSource: OpsConcept;
  readonly isolation: OpsConcept;
  readonly isolationOrganism: string | null;
  readonly reasonText: string;
  readonly startedAt: string;
  readonly endedAt: string | null;
  readonly expectedDischargeAt: string | null;
  readonly disposition: OpsConcept | null;
  readonly currentBed: StayBed | null;
  readonly reservedBed: StayBed | null;
  readonly losDays: number;
  readonly movements: readonly EncounterLocation[];
  readonly incidents: readonly PlacementIncident[];
  readonly rowVersion: number;
}

/** Fila del censo vivo (`GET /sites/:siteId/inpatients`). */
export interface InpatientRow {
  readonly encounterId: string;
  readonly patient: StayPatient;
  readonly bed: StayBed | null;
  readonly since: string;
  readonly levelOfCare: OpsConcept;
  readonly isolation: OpsConcept;
  readonly expectedDischargeAt: string | null;
  readonly losDays: number;
  readonly rowVersion: number;
}

/** Internación en curso de un paciente, para el expediente (desvío W-F2F3-5). */
export interface PatientCurrentStay {
  readonly encounterId: string;
  readonly siteId: string;
  readonly siteName: string;
  readonly bed: StayBed | null;
  readonly since: string;
  readonly levelOfCare: OpsConcept;
}

export interface AttendingPractitioner {
  readonly id: string;
  readonly displayName: string;
}

/* ---- censo ---------------------------------------------------------------- */

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

export type CensusCounts = Readonly<Record<CensusField, number>>;

export interface CensusAdjustment {
  readonly id: string;
  readonly censusDayId: string;
  readonly fieldCode: CensusField;
  readonly previousValue: number;
  readonly newValue: number;
  readonly reasonText: string;
  readonly adjustedByName: string | null;
  readonly requestId: string;
  readonly createdAt: string;
}

export interface CensusDay {
  /** `null` mientras el día está abierto: la vista previa no se persiste. */
  readonly id: string | null;
  readonly siteId: string;
  readonly unitId: string;
  readonly unitName: string;
  readonly censusDate: string;
  readonly cutoffAt: string;
  readonly status: 'CENSUS_OPEN' | 'CENSUS_CLOSED';
  readonly closedAt: string | null;
  readonly closedByName: string | null;
  readonly counts: CensusCounts;
  readonly adjustments: readonly CensusAdjustment[];
  readonly adjustedCounts: CensusCounts;
}

export interface CensusView {
  readonly siteId: string;
  readonly date: string;
  readonly generatedAt: string;
  /** Desde cuándo se puede cerrar (corte + gracia). */
  readonly closableFrom: string;
  readonly days: readonly CensusDay[];
}

export interface CensusAdjustmentRequest {
  readonly fieldCode: CensusField;
  readonly newValue: number;
  readonly reasonText: string;
  readonly entryRefId?: string;
}

/* ---- indicadores ---------------------------------------------------------- */

export interface IndicatorTotals {
  readonly days: number;
  readonly bedDaysAvailable: number;
  readonly patientDays: number;
  readonly admissions: number;
  readonly discharges: number;
  readonly dischargeStayDays: number;
  readonly avgBeds: number | null;
  readonly occupancyPct: number | null;
  readonly alos: number | null;
  readonly bedTurnover: number | null;
  readonly turnoverInterval: number | null;
}

export interface BedTurnaround {
  readonly samples: number;
  readonly p50: number | null;
  readonly p90: number | null;
  readonly waitToStart: number | null;
  readonly cleaning: number | null;
  readonly inspection: number | null;
}

export interface InpatientIndicators extends IndicatorTotals {
  readonly siteId: string;
  readonly period: { readonly from: string; readonly to: string };
  readonly bedTurnaroundMinutes: BedTurnaround;
  readonly crossCheck: { readonly occupancyFromAlos: number | null; readonly deltaPct: number | null };
  readonly coverage: { readonly daysClosed: number; readonly daysMissing: readonly string[] };
  /** Desglose por unidad (desvío W-F2F3-6). */
  readonly byUnit: readonly (IndicatorTotals & { readonly unitId: string; readonly unitName: string })[];
  readonly generatedAt: string;
}
