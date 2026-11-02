import type { CompatibilityRule, CompatibilityViolation, LevelOfCareCode, PlacementOverride } from '../../data-access/adt/adt.types';
import { OVERRIDE_MIN_LENGTH } from '../../data-access/adt/bed-compatibility';

/* ============================================================================
    Compatibilidad cama ↔ paciente (F3.2), como función pura.

    La evalúa la API (`clinical/domain/inpatient/bed-compatibility.ts`); esta
    copia la usa **sólo** el simulador para responder como ella (M6).
    ========================================================================== */

/** Las que **nunca** se fuerzan. */
export const BLOCKING_RULES: ReadonlySet<CompatibilityRule> = new Set([
  'LIFECYCLE',
  'AVAILABILITY',
  'OCCUPANCY',
  'HYGIENE',
  'ISOLATION_AIRBORNE',
]);

/** Qué niveles admite cada función de cama (tabla del perfil de función). */
export const LEVELS_BY_BED_FUNCTION: Readonly<Record<string, readonly LevelOfCareCode[]>> = {
  SPACE_FN_BED_ICU: ['LOC_CARE_ICU'],
  SPACE_FN_BED_STANDARD: ['LOC_CARE_GENERAL', 'LOC_CARE_INTERMEDIATE'],
  SPACE_FN_CRIB: ['LOC_CARE_GENERAL', 'LOC_CARE_NEONATAL_ICU'],
  SPACE_FN_STRETCHER: ['LOC_CARE_GENERAL'],
};

export interface CompatibilityInput {
  readonly bed: {
    readonly lifecycleCode: string;
    readonly availabilityCode: string;
    readonly occupancyCode: string;
    readonly hygieneReady: boolean;
    readonly functionCode: string;
    readonly ageGroupCode: string | null;
  };
  readonly room: {
    readonly functionCode: string | null;
    readonly sexRestrictionCode: string | null;
    readonly ageGroupCode: string | null;
    readonly pressureCode: string | null;
    readonly hvacValid: boolean;
  };
  /** Los otros pacientes de la misma habitación (ocupadas o reservadas). */
  readonly roommates: readonly { readonly sexCode: string; readonly isolationCode: string; readonly organism: string | null }[];
  readonly patient: { readonly sexCode: string; readonly ageYears: number; readonly ageDays: number };
  readonly encounter: {
    readonly levelOfCareCode: LevelOfCareCode;
    readonly isolationCode: string;
    readonly organism: string | null;
    readonly cohortApproved: boolean;
  };
  /** `infra.age_group_thresholds`: pediatría < 15 años, neonatal < 28 días. */
  readonly thresholds?: { readonly pediatricYears: number; readonly neonatalDays: number };
}

const SEX_OF_RESTRICTION: Readonly<Record<string, string>> = { SEX_FEMALE: 'FEMALE', SEX_MALE: 'MALE' };

export function evaluateCompatibility(input: CompatibilityInput): CompatibilityViolation[] {
  const v: CompatibilityViolation[] = [];
  const add = (rule: CompatibilityRule, detail: string) =>
    v.push({ rule, severity: BLOCKING_RULES.has(rule) ? 'BLOCKING' : 'OVERRIDABLE', detail });
  const { bed, room, patient, encounter } = input;
  const umbral = input.thresholds ?? { pediatricYears: 15, neonatalDays: 28 };

  if (bed.lifecycleCode !== 'SPACE_ACTIVE') add('LIFECYCLE', 'La cama no está activa.');
  if (bed.availabilityCode !== 'SPACE_OP_AVAILABLE') add('AVAILABILITY', 'La cama está bloqueada, en mantenimiento o cerrada.');
  if (bed.occupancyCode !== 'OCC_FREE') add('OCCUPANCY', 'La cama ya está ocupada o reservada.');
  if (!bed.hygieneReady) add('HYGIENE', 'La cama no está limpia e inspeccionada.');

  if (encounter.isolationCode === 'ISO_AIRBORNE') {
    const apta = room.functionCode === 'SPACE_FN_ISOLATION_AIIR' && room.pressureCode === 'PRESSURE_NEGATIVE' && room.hvacValid;
    if (!apta) add('ISOLATION_AIRBORNE', 'El aislamiento aéreo sólo va en un local AIIR con presión negativa y climatización validada.');
  }

  const sexoExigido = room.sexRestrictionCode === null ? undefined : SEX_OF_RESTRICTION[room.sexRestrictionCode];
  if (sexoExigido !== undefined && sexoExigido !== patient.sexCode) {
    add('SEX', 'La habitación está reservada a pacientes de otro sexo.');
  } else if (input.roommates.some((r) => r.sexCode !== patient.sexCode)) {
    add('SEX', 'La habitación compartida aloja a un paciente de otro sexo.');
  }

  const grupo = bed.ageGroupCode ?? room.ageGroupCode;
  const pediatrico = patient.ageYears < umbral.pediatricYears;
  const neonatal = patient.ageDays < umbral.neonatalDays;
  if (grupo === 'AGE_ADULT' && pediatrico) add('AGE', 'La cama es de adultos y el paciente es pediátrico.');
  if (grupo === 'AGE_PEDIATRIC' && !pediatrico) add('AGE', 'La cama es pediátrica y el paciente es adulto.');
  if (grupo === 'AGE_NEONATAL' && !neonatal) add('AGE', 'La cama es neonatal.');

  const withPrecaution = encounter.isolationCode !== 'ISO_NONE';
  const roommateWithPrecaution = input.roommates.some((r) => r.isolationCode !== 'ISO_NONE');
  if (input.roommates.length > 0 && (withPrecaution || roommateWithPrecaution)) {
    const mismoOrganismo =
      withPrecaution &&
      encounter.organism !== null &&
      input.roommates.every((r) => r.isolationCode === encounter.isolationCode && r.organism === encounter.organism);
    if (!(mismoOrganismo && encounter.cohortApproved)) {
      add('ISOLATION_COHORT', 'Compartir habitación con precaución de aislamiento exige el mismo organismo y el aval de control de infecciones.');
    }
  }

  const admitidos = LEVELS_BY_BED_FUNCTION[bed.functionCode];
  if (admitidos !== undefined && !admitidos.includes(encounter.levelOfCareCode)) {
    add('LEVEL_OF_CARE', 'El nivel de cuidado del ingreso no es el que admite esta cama.');
  }
  return v;
}

/** Qué responde la API ante un forzado (F3.3); `null` si se puede seguir. */
export function overrideProblem(
  violations: readonly CompatibilityViolation[],
  override: PlacementOverride | undefined,
): 'BED_NOT_ASSIGNABLE' | 'BED_COMPATIBILITY_OVERRIDE_REQUIRED' | 'OVERRIDE_JUSTIFICATION_TOO_SHORT' | 'OVERRIDE_RULE_NOT_OVERRIDABLE' | null {
  if (violations.some((x) => x.severity === 'BLOCKING')) return 'BED_NOT_ASSIGNABLE';
  const forzables = violations.filter((x) => x.severity === 'OVERRIDABLE');
  if (forzables.length === 0) return null;
  if (override === undefined) return 'BED_COMPATIBILITY_OVERRIDE_REQUIRED';
  if (override.ruleCodes.some((r) => BLOCKING_RULES.has(r))) return 'OVERRIDE_RULE_NOT_OVERRIDABLE';
  if (override.justification.trim().length < OVERRIDE_MIN_LENGTH) return 'OVERRIDE_JUSTIFICATION_TOO_SHORT';
  if (forzables.some((x) => !override.ruleCodes.includes(x.rule))) return 'BED_COMPATIBILITY_OVERRIDE_REQUIRED';
  return null;
}
