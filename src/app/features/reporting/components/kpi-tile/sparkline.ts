import type { EChartsCoreOption } from 'echarts/core';

import { formatearValor } from '@core/data-access/reporting/reporting-format';
import type { UnidadValor } from '@core/data-access/reporting/reporting.types';
import { escapar } from '@shared/components/organisms/chart-panel/chart-option.builder';
import type { ChartTheme } from '@shared/components/organisms/chart-panel/chart-theme';

/** La mini-tendencia necesita al menos dos puntos con dato para ser una línea. */
export function hasTrend(values: readonly (number | null)[] | undefined): boolean {
  return (values ?? []).filter((v) => v !== null && !Number.isNaN(v)).length >= 2;
}

/**
 * Una frase para el lector de pantalla: el primer y el último punto con dato.
 * El gráfico es decoración encima de un número que ya está escrito; esto solo
 * dice en qué dirección fue.
 */
export function describeTrend(values: readonly (number | null)[], unit: UnidadValor): string {
  const real = values.filter((v): v is number => v !== null && !Number.isNaN(v));
  const first = real[0];
  const last = real[real.length - 1];
  if (first === undefined || last === undefined || real.length < 2) {
    return 'Sin tendencia disponible.';
  }
  return `Tendencia de ${real.length} puntos: de ${formatearValor(first, unit)} a ${formatearValor(last, unit)}.`;
}

/**
 * Opciones de ECharts para la mini-tendencia de una tarjeta: sin ejes, sin
 * leyenda (es una sola serie y el título de la tarjeta la nombra) y con
 * tooltip. El último punto lleva marca para saber dónde termina.
 */
export function buildSparkline(
  values: readonly (number | null)[],
  unit: UnidadValor,
  theme: ChartTheme,
  animate: boolean,
): EChartsCoreOption {
  const lastIndex = values.length - 1;
  const color = theme.serie[0] ?? theme.texto;
  return {
    backgroundColor: 'transparent',
    animation: animate,
    grid: { left: 4, right: 8, top: 6, bottom: 4 },
    xAxis: { type: 'category', show: false, boundaryGap: false, data: values.map((_, i) => i) },
    // `scale` ajusta el eje al rango de la serie: la forma es lo que importa en una mini-tendencia.
    yAxis: { type: 'value', show: false, scale: true },
    tooltip: {
      trigger: 'axis',
      confine: true,
      backgroundColor: theme.fondoTooltip,
      borderColor: theme.bordeTooltip,
      borderWidth: 1,
      padding: [6, 8],
      textStyle: { color: theme.texto, fontSize: 12 },
      axisPointer: { type: 'line', lineStyle: { color: theme.linea } },
      formatter: (params: unknown) => {
        const first = (Array.isArray(params) ? params[0] : params) as
          | { dataIndex?: number; value?: unknown }
          | undefined;
        const index = first?.dataIndex ?? 0;
        const raw = values[index] ?? null;
        return `<div>${escapar(`Punto ${index + 1} de ${values.length}`)}</div><b>${escapar(formatearValor(raw, unit))}</b>`;
      },
    },
    series: [
      {
        type: 'line',
        data: [...values],
        smooth: false,
        connectNulls: false,
        // Solo el último punto lleva marca: dice dónde termina la línea.
        symbol: (_value: unknown, params: { dataIndex: number }) =>
          params.dataIndex === lastIndex ? 'circle' : 'none',
        symbolSize: 7,
        lineStyle: { width: 2, color },
        itemStyle: { color, borderColor: theme.superficie, borderWidth: 2 },
        areaStyle: { color, opacity: 0.12 },
        emphasis: { disabled: false },
      },
    ],
  };
}
