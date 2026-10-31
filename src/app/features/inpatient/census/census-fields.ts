import type { CensusField } from '../../../core/data-access/adt/adt.types';

/** Cómo se llama cada columna del censo (F3.1), en el orden de la planilla. */
export const CENSUS_LABEL: Readonly<Record<CensusField, string>> = {
  beds_censable: 'Camas censables',
  beds_available: 'Disponibles',
  beds_blocked: 'Bloqueadas',
  patients_at_cutoff: 'Pacientes al corte',
  admissions: 'Ingresos',
  discharges: 'Egresos',
  deaths: 'Defunciones',
  transfers_in: 'Traslados entrantes',
  transfers_out: 'Traslados salientes',
  same_day_stays: 'Estancias del mismo día',
  patient_days: 'Días-paciente',
  discharge_stay_days: 'Días de estancia de egresos',
};
