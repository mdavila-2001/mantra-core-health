import type { AdtConcept, CensusField, CompatibilityRule } from './adt.types';

/* ============================================================================
    Catálogos de internación que la pantalla ofrece como opciones.

    SUPUESTO F3-6: el contrato nombra los códigos (`LOC_CARE_*`, `ADM_SRC_*`,
    `DISP_*`) pero no dice de qué endpoint salen los rótulos. Mientras la API no
    los sirva por terminología, viven aquí con el código del contrato; la API
    valida el código de todas formas. Los motivos de traslado (`ADT_RSN_*`) son
    una propuesta: el contrato exige `reasonCode` sin enumerarlo.
    ========================================================================== */

const c = (code: string, display: string): AdtConcept => ({ code, display });

export const LEVELS_OF_CARE: readonly AdtConcept[] = [
  c('LOC_CARE_GENERAL', 'Cuidado general'),
  c('LOC_CARE_INTERMEDIATE', 'Cuidado intermedio'),
  c('LOC_CARE_ICU', 'Terapia intensiva'),
  c('LOC_CARE_NEONATAL_ICU', 'Terapia intensiva neonatal'),
];

export const ADMISSION_SOURCES: readonly AdtConcept[] = [
  c('ADM_SRC_EMERGENCY', 'Emergencias'),
  c('ADM_SRC_OUTPATIENT', 'Consulta externa'),
  c('ADM_SRC_REFERRAL', 'Referencia de otro establecimiento'),
  c('ADM_SRC_BIRTH', 'Nacimiento'),
  c('ADM_SRC_TRANSFER_IN', 'Traslado desde otro establecimiento'),
];

export const DISCHARGE_DISPOSITIONS: readonly AdtConcept[] = [
  c('DISP_HOME', 'Alta a domicilio'),
  c('DISP_TRANSFER', 'Traslado a otro establecimiento'),
  c('DISP_DEATH', 'Fallecimiento'),
  c('DISP_AGAINST_ADVICE', 'Alta voluntaria'),
  c('DISP_OTHER', 'Otro'),
];

export const ISOLATION_PRECAUTIONS: readonly AdtConcept[] = [
  c('ISO_NONE', 'Sin precaución'),
  c('ISO_CONTACT', 'Contacto'),
  c('ISO_DROPLET', 'Gotas'),
  c('ISO_AIRBORNE', 'Aérea'),
  c('ISO_PROTECTIVE', 'Protectora'),
];

export const TRANSFER_REASONS: readonly AdtConcept[] = [
  c('ADT_RSN_LEVEL_OF_CARE', 'Cambia el nivel de cuidado'),
  c('ADT_RSN_ISOLATION', 'Aislamiento o fin de aislamiento'),
  c('ADT_RSN_CLINICAL', 'Indicación clínica'),
  c('ADT_RSN_PATIENT_REQUEST', 'Pedido del paciente o la familia'),
  c('ADT_RSN_BED_MANAGEMENT', 'Gestión de camas'),
];

export const RULE_LABELS: Readonly<Record<CompatibilityRule, string>> = {
  LIFECYCLE: 'Ciclo de vida',
  AVAILABILITY: 'Disponibilidad',
  OCCUPANCY: 'Ocupación',
  HYGIENE: 'Higiene',
  ISOLATION_AIRBORNE: 'Aislamiento aéreo',
  SEX: 'Sexo de la habitación',
  AGE: 'Grupo de edad',
  ISOLATION_COHORT: 'Cohorte de aislamiento',
  LEVEL_OF_CARE: 'Nivel de cuidado',
};

export const CENSUS_FIELD_LABELS: Readonly<Record<CensusField, string>> = {
  beds_censable: 'Camas censables',
  beds_available: 'Camas disponibles',
  beds_blocked: 'Camas bloqueadas',
  patients_at_cutoff: 'Pacientes al corte',
  admissions: 'Ingresos',
  discharges: 'Egresos',
  deaths: 'Fallecimientos',
  transfers_in: 'Traslados recibidos',
  transfers_out: 'Traslados enviados',
  same_day_stays: 'Estancias del mismo día',
  patient_days: 'Días-paciente',
  discharge_stay_days: 'Días de estancia de los egresos',
};

/** Mínimo de la justificación para forzar o para ajustar (`CHECK length >= 20`). */
export const OVERRIDE_MIN_LENGTH = 20;
