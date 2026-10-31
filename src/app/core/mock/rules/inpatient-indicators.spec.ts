import { CENSUS_FIELDS, type CensusCounts } from '../../data-access/adt/adt.types';
import { bedTurnaround, daysBetween, indicatorTotals, percentile, stayDays } from './inpatient-indicators';

const crossCheck = (d: readonly CensusCounts[]) => indicatorTotals(d).crossCheck;

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
    dia({ bedsAvailable: 4, patientDays: 3, admissions: 1, discharges: 1, dischargeStayDays: 5 }),
    dia({ bedsAvailable: 4, patientDays: 3 }),
    dia({ bedsAvailable: 4, patientDays: 4, admissions: 1 }),
    dia({ bedsAvailable: 3, patientDays: 3, discharges: 1, dischargeStayDays: 5 }),
    dia({ bedsAvailable: 4, patientDays: 2, discharges: 1, dischargeStayDays: 6 }),
    dia({ bedsAvailable: 4, patientDays: 3, admissions: 1 }),
    dia({ bedsAvailable: 4, patientDays: 3, admissions: 1, discharges: 1, dischargeStayDays: 5 }),
  ];

  it('días-cama, días-paciente y % de ocupación', () => {
    const t = indicatorTotals(siete);
    expect(t.bedDaysAvailable).toBe(27);
    expect(t.patientDays).toBe(21);
    expect(t.occupancyPct).toBeCloseTo(77.78, 2);
  });

  it('ALOS, camas promedio, giro e intervalo de sustitución', () => {
    const t = indicatorTotals(siete);
    expect(t.alos).toBeCloseTo(5.25, 2); // 21 ÷ 4
    expect(t.avgBeds).toBeCloseTo(3.86, 2); // 27 ÷ 7
    expect(t.bedTurnover).toBeCloseTo(1.04, 2); // 4 ÷ 3,857
    expect(t.turnoverInterval).toBeCloseTo(1.5, 2); // (27 − 21) ÷ 4
    expect(t.admissions).toBe(4);
  });

  it('la prueba cruzada informa el delta en puntos y es < 5 sin ajustes', () => {
    const c = crossCheck(siete);
    expect(c.occupancyFromAlos).toBeCloseTo(77.78, 2);
    expect(c.deltaPct).toBeCloseTo(0, 6);
    const ajustado = siete.map((d, i) => (i === 0 ? { ...d, patientDays: 6 } : d));
    expect(crossCheck(ajustado).deltaPct).toBeCloseTo(11.11, 2);
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
    const t0 = Date.parse('2026-10-28T10:00:00Z');
    const at = (min: number) => new Date(t0 + min * 60_000).toISOString();
    const r = bedTurnaround([
      { requestedAt: at(0), startedAt: at(10), finishedAt: at(50), inspectedAt: at(60) },
      { requestedAt: at(0), startedAt: at(50), finishedAt: at(100), inspectedAt: at(120) },
      { requestedAt: at(0), startedAt: at(20), finishedAt: at(65), inspectedAt: at(90) },
    ]);
    expect(r).toEqual({ p50: 90, p90: 120, waitToStart: 20, cleaning: 45, inspection: 20 });
  });

  it('días de estancia: fecha de egreso − fecha de ingreso, mínimo 1', () => {
    expect(stayDays('2026-10-20T22:00:00Z', '2026-10-25T08:00:00Z')).toBe(5);
    expect(stayDays('2026-10-25T08:00:00Z', '2026-10-25T18:00:00Z')).toBe(1);
  });

  it('enumera los días de un rango, ambos incluidos', () => {
    expect(daysBetween('2026-10-27', '2026-10-30')).toEqual(['2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']);
  });
});
