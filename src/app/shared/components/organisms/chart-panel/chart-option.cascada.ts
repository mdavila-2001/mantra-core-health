import type { EChartsCoreOption } from 'echarts/core';

import { formatDate, formatearValor, NO_DATA } from '@core/data-access/reporting/reporting-format';
import type { DatosGrafico, UnidadValor } from '@core/data-access/reporting/reporting.types';
import { base, escapar, leyenda, LIENZO_ANGOSTO, type OpcionesBuild, type ParamEje, readValue, tooltipBase } from './chart-option.common';

/* ============================================================================
    Cascada (puente) y velas: los dos gráficos de «cómo se llega de un valor a otro».
    ========================================================================== */

/**
 * Rótulo del eje de un paso: su nombre y su valor firmado. En escritorio van en dos líneas; en un teléfono,
 * donde los rótulos se inclinan, dos líneas inclinadas se pisan con las del vecino y va todo en una.
 */
export function etiquetaCascada(
  d: Extract<DatosGrafico, { tipo: 'cascada' }>,
  unidad: UnidadValor,
  separador: () => string,
): (nombre: string) => string {
  const nombres = d.pasos.map((p) => p.nombre);
  return (nombre: string) => {
    const paso = d.pasos[nombres.indexOf(nombre)];
    if (paso === undefined) {
      return nombre;
    }
    const texto = formatearValor(Math.abs(paso.valor), unidad, true);
    return `${nombre}${separador()}${paso.total === true ? texto : `${paso.valor < 0 ? '−' : '+'}${texto}`}`;
  };
}

export function construirCascada(
  o: OpcionesBuild,
  d: Extract<DatosGrafico, { tipo: 'cascada' }>,
): EChartsCoreOption {
  const { tema, spec, seleccion } = o;
  let acumulado = 0;
  const base0: number[] = [];
  const sube: (number | null)[] = [];
  const baja: (number | null)[] = [];
  const total: (number | null)[] = [];
  for (const paso of d.pasos) {
    if (paso.total === true) {
      base0.push(0);
      sube.push(null);
      baja.push(null);
      total.push(paso.valor);
      acumulado = paso.valor;
    } else if (paso.valor >= 0) {
      base0.push(acumulado);
      sube.push(paso.valor);
      baja.push(null);
      total.push(null);
      acumulado += paso.valor;
    } else {
      acumulado += paso.valor;
      base0.push(acumulado);
      sube.push(null);
      baja.push(-paso.valor);
      total.push(null);
    }
  }
  const nombres = d.pasos.map((p) => p.nombre);
  const idxSel = seleccion === null ? -1 : nombres.indexOf(seleccion);
  const withOpacity = (arr: (number | null)[]) =>
    arr.map((v, i) => (v === null ? null : idxSel >= 0 && i !== idxSel ? { value: v, itemStyle: { opacity: 0.35 } } : v));
  return {
    ...base(tema),
    // Solo las series que existen: «Aumento» en la leyenda de un puente que solo baja no significa nada.
    legend: leyenda(
      tema,
      [
        ['Aumento', sube],
        ['Disminución', baja],
        ['Total', total],
      ].flatMap(([nombre, valores]) => ((valores as (number | null)[]).some((v) => v !== null) ? [nombre as string] : [])),
    ),
    tooltip: {
      ...tooltipBase(tema),
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: ParamEje | ParamEje[]) => {
        const lista = (Array.isArray(params) ? params : [params]).filter((p) => p.seriesName !== 'Base' && readValue(p) !== null);
        const paso = d.pasos[nombres.indexOf(lista[0]?.name ?? '')];
        const v = paso?.valor ?? null;
        return `<div style="font-weight:600">${escapar(lista[0]?.name ?? '')}</div><div>${paso?.total === true ? 'Total' : v !== null && v < 0 ? 'Disminución' : 'Aumento'}: <b>${escapar(formatearValor(v, spec.unidad))}</b></div>`;
      },
    },
    grid: { left: 8, right: 16, top: 20, bottom: 56, containLabel: true },
    // Con las barras de los totales desde cero, un paso del 1 % del total mide 1–3 px: el valor firmado
    // viaja en la propia etiqueta del eje para que se lea sin pasar el ratón por encima.
    xAxis: {
      type: 'category',
      data: nombres,
      axisLabel: {
        color: tema.textoSuave,
        interval: 0,
        // El nombre se parte en la casilla que le toca: con 7 pasos cada una mide ~70 px, no 96.
        width: Math.max(44, Math.min(96, Math.floor((spec.ancho === 'completo' ? 880 : 520) / Math.max(1, d.pasos.length)) - 8)),
        overflow: 'break',
        formatter: etiquetaCascada(d, spec.unidad, () => ((o.anchoLienzo?.() ?? Infinity) <= LIENZO_ANGOSTO ? ' ' : '\n')),
      },
      axisLine: { lineStyle: { color: tema.linea } },
    },
    // Con el eje desde cero las variaciones (1–5 % del total) quedan como rayitas: el eje arranca
    // cerca del mínimo para que cada paso se lea, y el borde inferior no pretende ser el cero.
    yAxis: { type: 'value', scale: true, splitLine: { lineStyle: { color: tema.rejilla } }, axisLabel: { color: tema.textoSuave, formatter: (v: number) => formatearValor(v, spec.unidad, true) } },
    series: [
      { name: 'Base', type: 'bar', stack: 'cascada', silent: true, itemStyle: { color: 'transparent' }, data: base0, tooltip: { show: false } },
      { name: 'Aumento', type: 'bar', stack: 'cascada', data: withOpacity(sube), itemStyle: { color: tema.bueno }, barMaxWidth: 40, barMinHeight: 3 },
      { name: 'Disminución', type: 'bar', stack: 'cascada', data: withOpacity(baja), itemStyle: { color: tema.malo }, barMaxWidth: 40, barMinHeight: 3 },
      { name: 'Total', type: 'bar', stack: 'cascada', data: withOpacity(total), itemStyle: { color: tema.serie[0] }, barMaxWidth: 40 },
    ],
  };
}

export function construirVelas(o: OpcionesBuild): EChartsCoreOption {
  const { tema, spec } = o;
  const velas = spec.velas?.velas ?? [];
  const seriesName = 'Velas (apertura–cierre)';
  return {
    ...base(tema),
    legend: leyenda(tema, [seriesName]),
    tooltip: {
      ...tooltipBase(tema),
      trigger: 'axis',
      axisPointer: { type: 'cross' },
      formatter: (params: ParamEje | ParamEje[]) => {
        const p = Array.isArray(params) ? params[0] : params;
        const v = velas.find((x) => x.fecha === p?.name);
        if (v === undefined) {
          return '';
        }
        const f = (n: number) => escapar(formatearValor(n, spec.unidad));
        const cambio = v.apertura === 0 ? null : ((v.cierre - v.apertura) / v.apertura) * 100;
        return `<div style="font-weight:600;margin-bottom:4px">${escapar(formatDate(v.fecha, true))}</div>
          <div>Apertura: <b>${f(v.apertura)}</b></div><div>Cierre: <b>${f(v.cierre)}</b></div>
          <div>Mínimo: <b>${f(v.minimo)}</b></div><div>Máximo: <b>${f(v.maximo)}</b></div>
          <div>Variación: <b>${cambio === null ? NO_DATA : `${cambio >= 0 ? '+' : '−'}${Math.abs(cambio).toFixed(1)} %`}</b> · ${cambio === null ? '' : (cambio >= 0) === (spec.velas?.subirEsMalo !== true) ? 'Mejora' : 'Empeora'}</div>`;
      },
    },
    grid: { left: 8, right: 16, top: 20, bottom: 84, containLabel: true },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 34, borderColor: tema.rejilla, textStyle: { color: tema.textoSuave } }],
    xAxis: { type: 'category', data: velas.map((v) => v.fecha), axisLabel: { color: tema.textoSuave, hideOverlap: true, formatter: (f: string) => formatDate(f) }, axisLine: { lineStyle: { color: tema.linea } } },
    yAxis: { type: 'value', scale: true, splitLine: { lineStyle: { color: tema.rejilla } }, axisLabel: { color: tema.textoSuave, formatter: (v: number) => formatearValor(v, spec.unidad, true) } },
    series: [
      {
        name: seriesName,
        type: 'candlestick',
        // [apertura, cierre, mínimo, máximo]
        data: velas.map((v) => [v.apertura, v.cierre, v.minimo, v.maximo]),
        // Color = mejora/empeora (según el sentido del indicador); relleno = sube (sólido) / baja (hueco).
        itemStyle: {
          color: spec.velas?.subirEsMalo === true ? tema.malo : tema.bueno,
          borderColor: spec.velas?.subirEsMalo === true ? tema.malo : tema.bueno,
          color0: tema.superficie,
          borderColor0: spec.velas?.subirEsMalo === true ? tema.bueno : tema.malo,
          borderWidth: 1.5,
        },
      },
    ],
  };
}
