import { describe, expect, it } from 'vitest';

import type { UnidadValor } from '@core/data-access/reporting/reporting.types';
import { formatearValor } from '@core/data-access/reporting/reporting-format';
import type { ChartTheme } from '@shared/components/organisms/chart-panel/chart-theme';
import { buildSparkline, describeTrend } from './sparkline';

const THEME: ChartTheme = {
  serie: ['#111', '#222'],
  texto: '#000',
  textoSuave: '#333',
  linea: '#444',
  rejilla: '#555',
  fondoTooltip: '#fff',
  bordeTooltip: '#666',
  bueno: '#0a0',
  malo: '#a00',
  superficie: '#fff',
  rampa: ['#aaa'],
};
const UNIT: UnidadValor = { tipo: 'numero' };

type Option = {
  xAxis: { show: boolean };
  yAxis: { show: boolean };
  legend?: unknown;
  animation: boolean;
  tooltip: { formatter: (p: unknown) => string };
  series: { connectNulls: boolean; data: (number | null)[]; symbol: (v: unknown, p: { dataIndex: number }) => string }[];
};

describe('describeTrend', () => {
  it('dice de dónde a dónde fue, ignorando los huecos', () => {
    const text = describeTrend([null, 10, 20, null, 30], UNIT);
    expect(text).toContain('3 puntos');
    expect(text).toContain(formatearValor(10, UNIT));
    expect(text).toContain(formatearValor(30, UNIT));
  });

  it('no inventa una tendencia con menos de dos puntos', () => {
    expect(describeTrend([null, 5], UNIT)).toBe('Sin tendencia disponible.');
  });
});

describe('buildSparkline', () => {
  const option = buildSparkline([1, null, 3], UNIT, THEME, false) as unknown as Option;

  it('no tiene ejes ni leyenda: es una sola serie que el título de la tarjeta ya nombra', () => {
    expect(option.xAxis.show).toBe(false);
    expect(option.yAxis.show).toBe(false);
    expect(option.legend).toBeUndefined();
  });

  it('un hueco sigue siendo hueco: la línea no lo une ni lo vuelve cero', () => {
    expect(option.series[0]?.connectNulls).toBe(false);
    expect(option.series[0]?.data).toEqual([1, null, 3]);
  });

  it('solo el último punto lleva marca', () => {
    const symbol = option.series[0]?.symbol;
    expect([0, 1, 2].map((dataIndex) => symbol?.(undefined, { dataIndex }))).toEqual(['none', 'none', 'circle']);
  });

  it('el tooltip dice qué punto es y su valor; un hueco sale «Sin dato»', () => {
    expect(option.tooltip.formatter([{ dataIndex: 2 }])).toContain(formatearValor(3, UNIT));
    expect(option.tooltip.formatter([{ dataIndex: 2 }])).toContain('Punto 3 de 3');
    expect(option.tooltip.formatter([{ dataIndex: 1 }])).toContain('Sin dato');
  });

  it('respeta el movimiento reducido', () => {
    expect(option.animation).toBe(false);
    expect((buildSparkline([1, 2], UNIT, THEME, true) as unknown as Option).animation).toBe(true);
  });
});
