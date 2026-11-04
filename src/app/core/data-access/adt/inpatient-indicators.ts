/* ============================================================================
    Indicadores hospitalarios OPS (F3.3): la fórmula que acompaña a cada
    número en la pantalla. Los números los calcula la API
    (`clinical/domain/inpatient/census.ts`); la copia de la maqueta vive en
    `mock/rules/inpatient-indicators.ts` del simulador (M6).
    ========================================================================== */

/** Cómo se calcula cada indicador, para la ayuda de la tarjeta. */
export const INDICATOR_FORMULAS = {
  bedDaysAvailable: 'Σ camas disponibles al corte de cada día',
  patientDays: 'Σ (pacientes al corte + estancias del mismo día)',
  occupancyPct: 'días-paciente ÷ días-cama disponibles × 100',
  alos: 'Σ días de estancia de los egresos ÷ Σ egresos',
  avgBeds: 'Σ camas disponibles ÷ días del período',
  bedTurnover: 'Σ egresos ÷ camas promedio',
  turnoverInterval: '(días-cama disponibles − días-paciente) ÷ Σ egresos',
  bedTurnaround: 'inspección (o fin) de la orden que siguió al egreso − pedido de la orden',
  crossCheck: 'ALOS × giro ÷ días × 100, comparado con el % de ocupación',
} as const;
