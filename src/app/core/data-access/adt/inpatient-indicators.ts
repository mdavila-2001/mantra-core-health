import type { BedTurnaround, CensusCounts, IndicatorTotals } from './adt.types';

/* ============================================================================
    Indicadores hospitalarios OPS (F3.3), como funciones puras.

    Se calculan **sólo** con días de censo CERRADOS y sus ajustes. Los usa el
    simulador —que es la API de la maqueta— y la pantalla para mostrar cada
    fórmula junto a su número. La pantalla no recalcula lo que mandó la API.
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
  bedTurnaround: 'inspección (o fin) de la orden que siguió al egreso − hora del egreso',
  crossCheck: 'ALOS × giro ÷ días × 100, comparado con el % de ocupación',
} as const;

/** Redondeo a dos decimales: la prueba de fixture compara «al decimal». */
export function round2(valor: number): number {
  return Math.round(valor * 100) / 100;
}

const dividir = (a: number, b: number): number | null => (b === 0 ? null : a / b);

/** Totales e indicadores de un conjunto de días cerrados (con sus valores ya ajustados). */
export function indicatorTotals(days: readonly CensusCounts[]): IndicatorTotals {
  const suma = (campo: keyof CensusCounts) => days.reduce((acc, d) => acc + d[campo], 0);
  const bedDaysAvailable = suma('beds_available');
  const patientDays = suma('patient_days');
  const discharges = suma('discharges');
  const dischargeStayDays = suma('discharge_stay_days');
  const n = days.length;
  const avgBeds = dividir(bedDaysAvailable, n);
  const occupancy = dividir(patientDays, bedDaysAvailable);
  const alos = dividir(dischargeStayDays, discharges);
  const turnover = avgBeds === null ? null : dividir(discharges, avgBeds);
  const interval = dividir(bedDaysAvailable - patientDays, discharges);
  return {
    days: n,
    bedDaysAvailable,
    patientDays,
    admissions: suma('admissions'),
    discharges,
    dischargeStayDays,
    avgBeds: avgBeds === null ? null : round2(avgBeds),
    occupancyPct: occupancy === null ? null : round2(occupancy * 100),
    alos: alos === null ? null : round2(alos),
    bedTurnover: turnover === null ? null : round2(turnover),
    turnoverInterval: interval === null ? null : round2(interval),
  };
}

/**
 * Prueba cruzada: `ALOS × giro ÷ días × 100`. Algebraicamente es Σ días de
 * estancia ÷ días-cama disponibles, así que con datos sin ajustes y estancias
 * que no cruzan el borde del período debe quedar cerca del % de ocupación.
 * `deltaPct` se informa en **puntos porcentuales** (|ocupación − estimada|).
 */
export function crossCheck(days: readonly CensusCounts[]): { occupancyFromAlos: number | null; deltaPct: number | null } {
  const t = indicatorTotals(days);
  const alos = dividir(t.dischargeStayDays, t.discharges);
  const avgBeds = dividir(t.bedDaysAvailable, t.days);
  const turnover = alos === null || avgBeds === null ? null : dividir(t.discharges, avgBeds);
  if (alos === null || turnover === null || t.days === 0) return { occupancyFromAlos: null, deltaPct: null };
  const estimada = ((alos * turnover) / t.days) * 100;
  const ocupacion = dividir(t.patientDays, t.bedDaysAvailable);
  return {
    occupancyFromAlos: round2(estimada),
    deltaPct: ocupacion === null ? null : round2(Math.abs(ocupacion * 100 - estimada)),
  };
}

/** Percentil por el método del rango más cercano; `null` sin muestras. */
export function percentile(valores: readonly number[], p: number): number | null {
  if (valores.length === 0) return null;
  const ordenados = [...valores].sort((a, b) => a - b);
  const rango = Math.max(1, Math.ceil((p / 100) * ordenados.length));
  return ordenados[rango - 1]!;
}

/** Un ciclo de rotación: del egreso a la cama lista, en minutos por tramo. */
export interface TurnaroundSample {
  readonly total: number;
  readonly waitToStart: number;
  readonly cleaning: number;
  readonly inspection: number;
}

export function bedTurnaround(samples: readonly TurnaroundSample[]): BedTurnaround {
  const mediana = (f: (s: TurnaroundSample) => number) => percentile(samples.map(f), 50);
  return {
    samples: samples.length,
    p50: percentile(samples.map((s) => s.total), 50),
    p90: percentile(samples.map((s) => s.total), 90),
    waitToStart: mediana((s) => s.waitToStart),
    cleaning: mediana((s) => s.cleaning),
    inspection: mediana((s) => s.inspection),
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
