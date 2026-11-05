import { describe, expect, it } from 'vitest';

import { areaPath, boxStats, heatLevel, histogramBins, linePath, linear, nearestIndex, niceTicks, regression, trendIsSound } from './chart-math';

describe('matemática de gráficos', () => {
  it('niceTicks devuelve marcas redondas que contienen el rango', () => {
    const t = niceTicks(0, 43, 5);
    expect(t[0]).toBe(0);
    expect(t[t.length - 1]).toBeGreaterThanOrEqual(43);
    const steps = new Set(t.slice(1).map((v, i) => +(v - t[i]!).toFixed(6)));
    expect(steps.size).toBe(1);
  });

  it('niceTicks no revienta con un rango de un solo valor ni con valores no finitos', () => {
    expect(niceTicks(5, 5).length).toBeGreaterThan(1);
    expect(niceTicks(Number.NaN, 3)).toEqual([0]);
  });

  it('la escala lineal mapea los extremos y tolera un dominio degenerado', () => {
    const s = linear(0, 10, 100, 200);
    expect(s(0)).toBe(100);
    expect(s(10)).toBe(200);
    expect(linear(3, 3, 0, 10)(3)).toBe(5);
  });

  it('un hueco (null) corta la línea: un dato no medido no se dibuja como cero', () => {
    const d = linePath([{ x: 0, y: 1 }, { x: 1, y: 2 }, null, { x: 3, y: 4 }]);
    expect(d.match(/M/g)?.length).toBe(2);
    expect(areaPath([null, null], 10)).toBe('');
  });

  it('nearestIndex elige el punto más cercano', () => {
    expect(nearestIndex(4.2, [0, 2, 4, 6])).toBe(2);
  });

  it('boxStats exige muestra y detecta atípicos', () => {
    expect(boxStats([1, 2, 3])).toBeNull();
    const b = boxStats([10, 11, 12, 12, 13, 14, 15, 90])!;
    expect(b.median).toBe(12.5);
    expect(b.outliers).toContain(90);
    expect(b.max).toBeLessThan(90);
  });

  it('el histograma conserva el total de observaciones', () => {
    const values = Array.from({ length: 200 }, (_, i) => (i * 37) % 101);
    expect(histogramBins(values).reduce((s, b) => s + b.count, 0)).toBe(200);
    expect(histogramBins([])).toEqual([]);
    expect(histogramBins([4, 4, 4])).toEqual([{ from: 4, to: 4, count: 3 }]);
  });

  it('la regresión recupera una recta y la tendencia exige muestra y fuerza', () => {
    const xs = Array.from({ length: 12 }, (_, i) => i);
    const reg = regression(xs, xs.map((x) => 2 * x + 1))!;
    expect(reg.slope).toBeCloseTo(2, 6);
    expect(reg.r).toBeCloseTo(1, 6);
    expect(trendIsSound(reg)).toBe(true);
    expect(regression([1, 2], [1, 2])).toBeNull();
    expect(trendIsSound({ ...reg, n: 5 })).toBe(false);
    expect(trendIsSound({ ...reg, r: 0.1 })).toBe(false);
  });

  it('el nivel de calor cubre los cuatro tramos', () => {
    expect([0, 0.3, 0.6, 1].map((v) => heatLevel(v, 0, 1))).toEqual([1, 2, 3, 4]);
    expect(heatLevel(5, 5, 5)).toBe(2);
  });
});
