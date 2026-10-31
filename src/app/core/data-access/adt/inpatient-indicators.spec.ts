import { CENSUS_FIELDS, type CensusCounts } from './adt.types';
import { bedTurnaround, crossCheck, daysBetween, indicatorTotals, percentile, stayDays } from './inpatient-indicators';

function dia(valores: Partial<CensusCounts>): CensusCounts {
  const base = Object.fromEntries(CENSUS_FIELDS.map((f) => [f, 0])) as Record<string, number>;
  return { ...base, ...valores } as CensusCounts;
}

/**
 * F3.5 #8: un fixture de 7 días con valores conocidos coincide al decimal con
 * las fórmulas OPS. Es el mismo fixture que siembra la maqueta.
 */
describe('indicadores OPS', () => {
  const siete: CensusCounts[] = [
    dia({ beds_available: 4, patient_days: 3, admissions: 1, discharges: 1, discharge_stay_days: 5 }),
    dia({ beds_available: 4, patient_days: 3 }),
    dia({ beds_available: 4, patient_days: 4, admissions: 1 }),
    dia({ beds_available: 3, patient_days: 3, discharges: 1, discharge_stay_days: 5 }),
    dia({ beds_available: 4, patient_days: 2, discharges: 1, discharge_stay_days: 6 }),
    dia({ beds_available: 4, patient_days: 3, admissions: 1 }),
    dia({ beds_available: 4, patient_days: 3, admissions: 1, discharges: 1, discharge_stay_days: 5 }),
  ];

  it('días-cama, días-paciente y % de ocupación', () => {
    const t = indicatorTotals(siete);
    expect(t.bedDaysAvailable).toBe(27);
    expect(t.patientDays).toBe(21);
    expect(t.occupancyPct).toBe(77.78);
  });

  it('ALOS, camas promedio, giro e intervalo de sustitución', () => {
    const t = indicatorTotals(siete);
    expect(t.alos).toBe(5.25); // 21 ÷ 4
    expect(t.avgBeds).toBe(3.86); // 27 ÷ 7
    expect(t.bedTurnover).toBe(1.04); // 4 ÷ 3,857
    expect(t.turnoverInterval).toBe(1.5); // (27 − 21) ÷ 4
    expect(t.admissions).toBe(4);
  });

  it('la prueba cruzada informa el delta en puntos y es < 5 sin ajustes', () => {
    const c = crossCheck(siete);
    expect(c.occupancyFromAlos).toBe(77.78);
    expect(c.deltaPct).toBe(0);
    const ajustado = siete.map((d, i) => (i === 0 ? { ...d, patient_days: 6 } : d));
    expect(crossCheck(ajustado).deltaPct).toBe(11.11);
  });

  it('sin egresos ni camas no inventa números', () => {
    const t = indicatorTotals([dia({})]);
    expect(t.occupancyPct).toBeNull();
    expect(t.alos).toBeNull();
    expect(t.turnoverInterval).toBeNull();
    expect(crossCheck([]).deltaPct).toBeNull();
  });

  it('percentiles y rotación de cama desglosada', () => {
    expect(percentile([30, 10, 20], 50)).toBe(20);
    expect(percentile([10, 20, 30, 40, 50, 60, 70, 80, 90, 100], 90)).toBe(90);
    expect(percentile([], 50)).toBeNull();
    const r = bedTurnaround([
      { total: 60, waitToStart: 10, cleaning: 40, inspection: 10 },
      { total: 120, waitToStart: 50, cleaning: 50, inspection: 20 },
      { total: 90, waitToStart: 20, cleaning: 45, inspection: 25 },
    ]);
    expect(r).toEqual({ samples: 3, p50: 90, p90: 120, waitToStart: 20, cleaning: 45, inspection: 20 });
  });

  it('días de estancia: fecha de egreso − fecha de ingreso, mínimo 1', () => {
    expect(stayDays('2026-10-20T22:00:00Z', '2026-10-25T08:00:00Z')).toBe(5);
    expect(stayDays('2026-10-25T08:00:00Z', '2026-10-25T18:00:00Z')).toBe(1);
  });

  it('enumera los días de un rango, ambos incluidos', () => {
    expect(daysBetween('2026-10-27', '2026-10-30')).toEqual(['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']);
  });
});
