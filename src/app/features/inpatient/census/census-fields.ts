import type { CensusField } from '../../../core/data-access/adt/adt.types';

/** Cómo se llama cada columna del censo (F3.1), en el orden de la planilla. */
export const CENSUS_LABEL: Readonly<Record<CensusField, string>> = {
  bedsCensable: 'Camas censables',
  bedsAvailable: 'Disponibles',
  bedsBlocked: 'Bloqueadas',
  patientsAtCutoff: 'Pacientes al corte',
  admissions: 'Ingresos',
  discharges: 'Egresos',
  deaths: 'Defunciones',
  transfersIn: 'Traslados entrantes',
  transfersOut: 'Traslados salientes',
  sameDayStays: 'Estancias del mismo día',
  patientDays: 'Días-paciente',
  dischargeStayDays: 'Días de estancia de egresos',
};

/** El rótulo de un campo: el ajuste lo devuelve en snake_case (`patient_days`), la foto en camelCase. */
export function censusFieldLabel(code: string): string {
  const camel = code.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  return CENSUS_LABEL[camel as CensusField] ?? code;
}

/** Margen después del corte para cerrar (`infra.census_close_grace_minutes`, 60 por defecto en la API). */
export const CENSUS_CLOSE_GRACE_MS = 60 * 60_000;
