import { addDays, PROTOTYPE_TODAY, weekStart } from './dates';
import type { DailyFact } from './insights.types';
import { noise } from './prng';

/* ============================================================================
    Cohortes de retención.

    Cohorte = usuarios activados en una semana (lunes a domingo). Para la
    semana k de vida de la cohorte solo hay dato si esa semana YA TERMINÓ: las
    celdas futuras son `null`, nunca 0 — un 0 diría «nadie volvió» cuando la
    verdad es «todavía no se puede saber».
    ========================================================================== */

/** Curva base de retención semanal por campaña (semana 0 = 100 %). */
const BASE_CURVE: Readonly<Record<string, readonly number[]>> = {
  c1: [1, 0.78, 0.7, 0.64, 0.61, 0.59, 0.57, 0.56, 0.55],
  c2: [1, 0.62, 0.5, 0.43, 0.38, 0.35, 0.33, 0.31, 0.3],
  c3: [1, 0.66, 0.54, 0.47, 0.43, 0.4, 0.38, 0.36, 0.35],
  c4: [1, 0.8, 0.74, 0.7, 0.68, 0.66, 0.65, 0.64, 0.63],
};

export const COHORT_WEEKS = 9;

export interface Cohort {
  readonly weekStart: string;
  readonly size: number;
  /** Retención por semana de vida; `null` = semana todavía no observable. */
  readonly retention: readonly (number | null)[];
}

/** La semana k de una cohorte es observable si ya terminó. */
export function isObserved(cohortWeekStart: string, k: number): boolean {
  return addDays(cohortWeekStart, 7 * k + 6) <= PROTOTYPE_TODAY;
}

export function buildCohorts(facts: readonly DailyFact[]): Cohort[] {
  // Activaciones por (campaña, semana).
  const sizes = new Map<string, number>();
  for (const fact of facts) {
    const key = `${fact.campaignId}|${weekStart(fact.date)}`;
    sizes.set(key, (sizes.get(key) ?? 0) + fact.activations);
  }
  // Se unen las campañas de una misma semana, ponderando por tamaño.
  const byWeek = new Map<string, { size: number; sums: number[]; weights: number[] }>();
  for (const [key, size] of sizes) {
    const [campaignId = '', week = ''] = key.split('|');
    const curve = BASE_CURVE[campaignId] ?? BASE_CURVE['c1']!;
    const entry = byWeek.get(week) ?? {
      size: 0,
      sums: Array.from({ length: COHORT_WEEKS }, () => 0),
      weights: Array.from({ length: COHORT_WEEKS }, () => 0),
    };
    entry.size += size;
    for (let k = 0; k < COHORT_WEEKS; k += 1) {
      if (!isObserved(week, k)) continue;
      // Las cohortes que llegan con el onboarding degradado retienen un poco menos.
      const degraded = campaignId === 'c1' && week >= '2026-10-12' ? 0.94 : 1;
      const value = Math.min(1, (curve[k] ?? 0) * (k === 0 ? 1 : degraded) * noise(`${key}|${k}`, 0.025));
      entry.sums[k] = (entry.sums[k] ?? 0) + value * size;
      entry.weights[k] = (entry.weights[k] ?? 0) + size;
    }
    byWeek.set(week, entry);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, entry]) => ({
      weekStart: week,
      size: entry.size,
      retention: entry.sums.map((sum, k) => ((entry.weights[k] ?? 0) > 0 ? sum / (entry.weights[k] ?? 1) : null)),
    }));
}

export interface RetentionResult {
  readonly rate: number;
  readonly retained: number;
  readonly cohortSize: number;
}

/** Retención en la semana `k` ponderada por tamaño, solo con cohortes observables. */
export function retentionAtWeek(facts: readonly DailyFact[], k: number): RetentionResult | null {
  let retained = 0;
  let size = 0;
  for (const cohort of buildCohorts(facts)) {
    const value = cohort.retention[k];
    if (value === null || value === undefined) continue;
    retained += value * cohort.size;
    size += cohort.size;
  }
  return size > 0 ? { rate: retained / size, retained: Math.round(retained), cohortSize: size } : null;
}

/** Retención a 30 días ≈ semana 4 de vida. */
export function retentionD30(_campaignIds: readonly string[], facts: readonly DailyFact[]): RetentionResult | null {
  return retentionAtWeek(facts, 4);
}
