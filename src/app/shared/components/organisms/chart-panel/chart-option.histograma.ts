import type { EChartsCoreOption } from 'echarts/core';

import { formatearValor, NO_DATA } from '@core/data-access/reporting/reporting-format';
import type { DatosGrafico } from '@core/data-access/reporting/reporting.types';
import { base, escapar, type OpcionesBuild, type ParamEje, readValue, tooltipBase } from './chart-option.common';

type Histograma = Extract<DatosGrafico, { tipo: 'histograma' }>;

/** «< 5 ms» (el primer cubo desde cero), «5–10 ms» o «≥ 10 s» (el último, sin tope). Con `cerrado: 'derecha'`, «≤ 5 ms» y «> 10 s». */
export function etiquetaDeCubo(d: Histograma, i: number): string {
  const lo = d.bordes[i] ?? null;
  const hi = d.bordes[i + 1] ?? null;
  const f = (v: number) => formatearValor(v, d.unidadBorde);
  const derecha = d.cerrado === 'derecha';
  if (hi === null) {
    return lo === null ? NO_DATA : `${derecha ? '>' : '≥'} ${f(lo)}`;
  }
  if (lo === null || lo === 0) {
    return `${derecha ? '≤' : '<'} ${f(hi)}`;
  }
  // «5 ms–10 ms» se lee «5–10 ms» cuando los dos lados llevan la misma unidad.
  const a = f(lo);
  const b = f(hi);
  const sufijo = /\s\S+$/.exec(a)?.[0];
  return `${sufijo !== undefined && b.endsWith(sufijo) ? a.slice(0, -sufijo.length) : a}–${b}`;
}

/** El rango dicho con todas las letras para el tooltip y la tabla: «≥ 5 ms y < 10 ms» (o «> 5 ms y ≤ 10 ms»). */
export function rangoDeCubo(d: Histograma, i: number): string {
  const lo = d.bordes[i] ?? null;
  const hi = d.bordes[i + 1] ?? null;
  const f = (v: number) => formatearValor(v, d.unidadBorde);
  const derecha = d.cerrado === 'derecha';
  if (lo === null && hi === null) {
    return NO_DATA;
  }
  if (hi === null) {
    return `${derecha ? '>' : '≥'} ${f(lo ?? 0)}`;
  }
  if (lo === null || lo === 0) {
    return `${derecha ? '≤' : '<'} ${f(hi)}`;
  }
  return derecha ? `> ${f(lo)} y ≤ ${f(hi)}` : `≥ ${f(lo)} y < ${f(hi)}`;
}

/**
 * Histograma: barras CONTIGUAS por cubo (el eje es una magnitud continua, no categorías sueltas), un solo
 * matiz, 2 px de brecha de superficie entre cubos y 4 px de redondeo sólo arriba. Un cubo `null` es «sin
 * dato» y no se dibuja como cero. Sin leyenda: es una sola serie y el título del panel la nombra.
 */
export function construirHistograma(o: OpcionesBuild, d: Histograma): EChartsCoreOption {
  const { tema, spec } = o;
  const etiquetas = d.conteos.map((_, i) => etiquetaDeCubo(d, i));
  return {
    ...base(tema),
    legend: { show: false },
    tooltip: {
      ...tooltipBase(tema),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: ParamEje | ParamEje[]) => {
        const p = Array.isArray(params) ? params[0] : params;
        const i = etiquetas.indexOf(p?.name ?? p?.axisValueLabel ?? '');
        const v = p === undefined ? null : readValue(p);
        return `<div style="font-weight:600;margin-bottom:4px">${escapar(i >= 0 ? rangoDeCubo(d, i) : (p?.name ?? ''))}</div><div>${escapar(d.nombreValor)}: <b>${escapar(formatearValor(v, spec.unidad))}</b></div>`;
      },
    },
    grid: { left: 8, right: 16, top: 20, bottom: 36, containLabel: true },
    xAxis: {
      type: 'category',
      data: etiquetas,
      axisLine: { lineStyle: { color: tema.linea } },
      axisTick: { alignWithLabel: true },
      axisLabel: { color: tema.textoSuave, interval: 0, hideOverlap: true, width: 70, overflow: 'break' },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: tema.rejilla, type: 'solid' } },
      axisLine: { show: false },
      axisLabel: { color: tema.textoSuave, fontSize: 11, hideOverlap: true, formatter: (v: number) => formatearValor(v, spec.unidad, true) },
    },
    series: [
      {
        name: d.nombreValor,
        type: 'bar',
        data: d.conteos,
        // Contiguas: el hueco entre cubos lo da el borde de superficie, no un espacio de categoría.
        barCategoryGap: '0%',
        barMaxWidth: 64,
        itemStyle: { color: tema.serie[0], borderRadius: [4, 4, 0, 0], borderColor: tema.superficie, borderWidth: 1 },
        emphasis: { focus: 'series' },
      },
    ],
  };
}
