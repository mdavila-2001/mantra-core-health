import type { CensusCounts, IndicatorTotals } from '../../data-access/adt/adt.types';

/* ============================================================================
    Indicadores OPS de la maqueta: la misma cuenta que la API
    (`clinical/domain/inpatient/census.ts` → `computeIndicators`, `percentile`).

    Sólo la usa el simulador (M6). Los números salen **sin redondear**, como de
    la API: la pantalla los formatea.
    ========================================================================== */

const dividir = (a: number, b: number): number | null => (b > 0 ? a / b : null);

/** `computeIndicators(days, periodDays)` de la API. */
export function indicatorTotals(days: readonly CensusCounts[], periodDays: number = days.length): IndicatorTotals {
  const suma = (k: keyof CensusCounts) => days.reduce((acc, d) => acc + d[k], 0);
  const bedDaysAvailable = suma('bedsAvailable');
  const patientDays = suma('patientDays');
  const discharges = suma('discharges');
  const dischargeStayDays = suma('dischargeStayDays');
  const avgBeds = periodDays > 0 ? bedDaysAvailable / periodDays : 0;
  const occupancyPct = bedDaysAvailable > 0 ? (patientDays / bedDaysAvailable) * 100 : null;
  const alos = dividir(dischargeStayDays, discharges);
  const bedTurnover = avgBeds > 0 ? discharges / avgBeds : null;
  const turnoverInterval = dividir(bedDaysAvailable - patientDays, discharges);
  const occupancyFromAlos = alos !== null && bedTurnover !== null && periodDays > 0 ? ((alos * bedTurnover) / periodDays) * 100 : null;
  const deltaPct = occupancyFromAlos !== null && occupancyPct ? Math.abs(occupancyFromAlos - occupancyPct) : null;
  return {
    days: periodDays,
    bedDaysAvailable,
    patientDays,
    admissions: suma('admissions'),
    discharges,
    dischargeStayDays,
    avgBeds,
    occupancyPct,
    alos,
    bedTurnover,
    turnoverInterval,
    crossCheck: { occupancyFromAlos, deltaPct },
  };
}

/** `percentile` de la API: rango más cercano; `null` sin muestras. */
export function percentile(valores: readonly number[], p: number): number | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const idx = Math.min(ordenados.length - 1, Math.max(0, Math.ceil((p / 100) * ordenados.length) - 1));
  return ordenados[idx]!;
}

/** Una orden de limpieza que siguió a un egreso, en instantes ISO. */
export interface TurnaroundSample {
  readonly requestedAt: string;
  readonly startedAt: string | null;
  readonly finishedAt: string | null;
  readonly inspectedAt: string | null;
}

/** `bedTurnaroundMinutes` como lo arma `InpatientCensusUseCases.indicators`. */
export function bedTurnaround(samples: readonly TurnaroundSample[]) {
  const min = (a: string | null, b: string | null) => (a && b ? (Date.parse(b) - Date.parse(a)) / 60_000 : null);
  const pick = (xs: (number | null)[]) => xs.filter((x): x is number => x !== null);
  const total = pick(samples.map((t) => min(t.requestedAt, t.inspectedAt ?? t.finishedAt)));
  return {
    p50: percentile(total, 50),
    p90: percentile(total, 90),
    waitToStart: percentile(pick(samples.map((t) => min(t.requestedAt, t.startedAt))), 50),
    cleaning: percentile(pick(samples.map((t) => min(t.startedAt, t.finishedAt))), 50),
    inspection: percentile(pick(samples.map((t) => min(t.finishedAt, t.inspectedAt))), 50),
  };
}

/** Días de estancia de un egreso: fecha(egreso) − fecha(ingreso), mínimo 1 (F3.3). */
export function stayDays(admittedOn: string, dischargedOn: string): number {
  const a = Date.parse(`${admittedOn.slice(0, 10)}T00:00:00Z`);
  const b = Date.parse(`${dischargedOn.slice(0, 10)}T00:00:00Z`);
  return Math.max(1, Math.round((b - a) / 86_400_000));
}

/** Los días del rango `[from, to]` (ambos incluidos), como `AAAA-MM-DD`. */
export function daysBetween(from: string, to: string): string[] {
  const dias: string[] = [];
  let t = Date.parse(`${from}T00:00:00Z`);
  const fin = Date.parse(`${to}T00:00:00Z`);
  while (Number.isFinite(t) && t <= fin && dias.length <= 400) {
    dias.push(new Date(t).toISOString().slice(0, 10));
    t += 86_400_000;
  }
  return dias;
}
