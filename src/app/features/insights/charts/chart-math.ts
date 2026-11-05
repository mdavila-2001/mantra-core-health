/* ============================================================================
    Matemática de gráficos. Sin dependencias: escalas, ejes legibles, trazados
    con huecos para los `null` (un dato faltante es un hueco, no una caída a 0)
    y estadística básica para dispersión y distribución.
    ========================================================================== */

export type Scale = (value: number) => number;

export function linear(d0: number, d1: number, r0: number, r1: number): Scale {
  const span = d1 - d0;
  if (span === 0) return () => (r0 + r1) / 2;
  return (value) => r0 + ((value - d0) / span) * (r1 - r0);
}

/** Marcas «redondas» de eje: 0, 5, 10… en lugar de 0, 4,3, 8,6. */
const NICE_STEPS = [1, 2, 2.5, 5, 10] as const;

export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0];
  if (min === max) {
    const pad = Math.abs(min) * 0.1 || 1;
    return niceTicks(min - pad, max + pad, count);
  }
  const rawStep = (max - min) / Math.max(1, count - 1);
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  const step = (NICE_STEPS.find((n) => n >= residual - 1e-9) ?? 10) * magnitude;
  const clean = step === 0 ? 1 : step;
  const start = Math.floor(min / clean) * clean;
  const end = Math.ceil(max / clean) * clean;
  const ticks: number[] = [];
  for (let v = start; v <= end + clean * 1e-9; v += clean) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

export interface XY {
  readonly x: number;
  readonly y: number;
}

/** Trazado de línea que se corta donde hay `null`. */
export function linePath(points: readonly (XY | null)[]): string {
  let d = '';
  let pen = false;
  for (const p of points) {
    if (!p) {
      pen = false;
      continue;
    }
    d += `${pen ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    pen = true;
  }
  return d;
}

/** Área bajo la línea, por tramos continuos. */
export function areaPath(points: readonly (XY | null)[], baseline: number): string {
  const runs: XY[][] = [];
  let run: XY[] = [];
  for (const p of points) {
    if (!p) {
      if (run.length) runs.push(run);
      run = [];
    } else run.push(p);
  }
  if (run.length) runs.push(run);
  return runs
    .map((r) => {
      const first = r[0]!;
      const last = r[r.length - 1]!;
      return `M${first.x.toFixed(1)},${baseline.toFixed(1)}${r.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join('')}L${last.x.toFixed(1)},${baseline.toFixed(1)}Z`;
    })
    .join('');
}

export function nearestIndex(x: number, xs: readonly number[]): number {
  let best = 0;
  let bestDistance = Infinity;
  xs.forEach((value, i) => {
    const distance = Math.abs(value - x);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = i;
    }
  });
  return best;
}

export function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const next = sorted[base + 1];
  return next === undefined ? sorted[base]! : sorted[base]! + rest * (next - sorted[base]!);
}

export interface BoxStats {
  readonly min: number;
  readonly q1: number;
  readonly median: number;
  readonly q3: number;
  readonly max: number;
  readonly outliers: readonly number[];
  readonly n: number;
}

/** Caja de Tukey: bigotes a 1,5 × RIC, lo que queda fuera es atípico. */
export function boxStats(values: readonly number[]): BoxStats | null {
  if (values.length < 4) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  const low = q1 - 1.5 * iqr;
  const high = q3 + 1.5 * iqr;
  const inside = sorted.filter((v) => v >= low && v <= high);
  return {
    min: inside[0] ?? sorted[0]!,
    q1,
    median,
    q3,
    max: inside[inside.length - 1] ?? sorted[sorted.length - 1]!,
    outliers: sorted.filter((v) => v < low || v > high),
    n: values.length,
  };
}

export interface Bin {
  readonly from: number;
  readonly to: number;
  readonly count: number;
}

/** Regla de Sturges acotada: ni un solo bloque ni polvo. */
export function histogramBins(values: readonly number[], requested?: number): Bin[] {
  if (values.length === 0) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const count = requested ?? Math.min(14, Math.max(5, Math.ceil(Math.log2(values.length) + 1)));
  if (min === max) return [{ from: min, to: max, count: values.length }];
  const width = (max - min) / count;
  const bins: Bin[] = Array.from({ length: count }, (_, i) => ({ from: min + i * width, to: min + (i + 1) * width, count: 0 }));
  const counts = bins.map(() => 0);
  for (const v of values) {
    const i = Math.min(count - 1, Math.floor((v - min) / width));
    counts[i] = (counts[i] ?? 0) + 1;
  }
  return bins.map((b, i) => ({ ...b, count: counts[i] ?? 0 }));
}

export interface Regression {
  readonly n: number;
  readonly r: number;
  readonly r2: number;
  readonly slope: number;
  readonly intercept: number;
}

export function regression(xs: readonly number[], ys: readonly number[]): Regression | null {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  if (sxx === 0 || syy === 0) return null;
  const r = sxy / Math.sqrt(sxx * syy);
  const slope = sxy / sxx;
  return { n, r, r2: r * r, slope, intercept: my - slope * mx };
}

/** ¿Sostiene la estadística dibujar una tendencia? Muestra suficiente y relación apreciable. */
export function trendIsSound(reg: Regression | null, minN = 10, minAbsR = 0.3): boolean {
  return reg !== null && reg.n >= minN && Math.abs(reg.r) >= minAbsR;
}

/** Intensidad 0–3 de una celda para la escala `--heat-1…4`. */
export function heatLevel(value: number, min: number, max: number): 1 | 2 | 3 | 4 {
  if (max <= min) return 2;
  const t = (value - min) / (max - min);
  return t < 0.25 ? 1 : t < 0.5 ? 2 : t < 0.75 ? 3 : 4;
}
