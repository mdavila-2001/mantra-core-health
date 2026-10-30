import type { EChartsCoreOption } from 'echarts/core';

import { formatearValor, NO_DATA } from '@core/data-access/reporting/reporting-format';
import type {
  ConfigFiltro,
  ChartSpec,
  DatosGrafico,
  SerieCartesiana,
  UnidadValor,
} from '@core/data-access/reporting/reporting.types';
import { rampColorAt, readableOn } from './chart-color';
import type { ChartTheme } from './chart-theme';

/* ============================================================================
    Traduce un `ChartSpec` a las opciones de Apache ECharts, cumpliendo el
    contrato: leyenda y tooltip SIEMPRE presentes, `null` como «Sin dato», y el
    elemento elegido por un filtro resaltado.
    ========================================================================== */

export type ModoGrafico = 'normal' | 'velas';

export interface OpcionesBuild {
  readonly spec: ChartSpec;
  readonly tema: ChartTheme;
  readonly modo: ModoGrafico;
  /** Valor del elemento filtrado (nombre de categoría/parte), si lo hay. */
  readonly seleccion: string | null;
}

export function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function prefersMoreContrast(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    (window.matchMedia('(prefers-contrast: more)').matches || window.matchMedia('(forced-colors: active)').matches)
  );
}

function base(tema: ChartTheme): Record<string, unknown> {
  return {
    backgroundColor: 'transparent',
    color: tema.serie,
    textStyle: { color: tema.texto, fontFamily: tema.fuente },
    // Los patrones de relleno son para quien pide más contraste (ADR-0017): por defecto
    // ensucian marcas pequeñas y las etiquetas; la leyenda, el tooltip y la tabla ya llevan la identidad.
    aria: { enabled: true, decal: { show: prefersMoreContrast() } },
    animation: !(typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches),
  };
}

function leyenda(tema: ChartTheme, nombres?: readonly string[]): Record<string, unknown> {
  return {
    show: true,
    type: 'plain',
    bottom: 0,
    left: 'center',
    width: '92%',
    itemGap: 14,
    textStyle: { color: tema.texto, fontSize: 12 },
    ...(nombres === undefined ? {} : { data: nombres }),
  };
}

function tooltipBase(tema: ChartTheme): Record<string, unknown> {
  return {
    confine: true,
    appendToBody: false,
    backgroundColor: tema.fondoTooltip,
    borderColor: tema.bordeTooltip,
    borderWidth: 1,
    padding: [8, 10],
    textStyle: { color: tema.texto, fontSize: 12 },
    extraCssText: 'box-shadow: var(--shadow-md);',
  };
}

interface ParamEje {
  readonly marker?: string;
  readonly seriesName?: string;
  readonly axisValueLabel?: string;
  readonly name?: string;
  readonly value?: unknown;
  readonly data?: unknown;
}

const num = (v: unknown): number | null => (typeof v === 'number' && !Number.isNaN(v) ? v : null);

function readValue(p: ParamEje): number | null {
  if (Array.isArray(p.value)) {
    return num(p.value[p.value.length - 1]);
  }
  if (p.data !== null && typeof p.data === 'object' && 'value' in (p.data as object)) {
    return num((p.data as { value: unknown }).value);
  }
  return num(p.value);
}

function unitOf(serie: SerieCartesiana | undefined, general: UnidadValor): UnidadValor {
  return serie?.unidad ?? general;
}

function construirCartesiano(
  o: OpcionesBuild,
  d: Extract<DatosGrafico, { tipo: 'cartesiano' }>,
): EChartsCoreOption {
  const { tema, spec, seleccion } = o;
  const horizontal = d.horizontal === true;
  const porSerie = spec.filtro?.valorDe === 'serie';
  const idxSel = seleccion === null || porSerie ? -1 : d.categorias.indexOf(seleccion);

  const series = d.series.map((s) => {
    // Filtro por serie: las demás series se atenúan, como las demás barras cuando se filtra por categoría.
    const atenuada = porSerie && seleccion !== null && s.nombre !== seleccion;
    const tipo = s.forma === 'barra' ? 'bar' : 'line';
    const datos = s.valores.map((v, i) =>
      v === null
        ? null
        : s.forma === 'barra' && idxSel >= 0 && i !== idxSel
          ? { value: v, itemStyle: { opacity: 0.35 } }
          : v,
    );
    return {
      name: s.nombre,
      type: tipo,
      data: datos,
      stack: s.apilar,
      smooth: false,
      connectNulls: false,
      showSymbol: d.categorias.length <= 40,
      symbolSize: 6,
      areaStyle: s.forma === 'area' ? { opacity: 0.18 } : undefined,
      lineStyle: tipo === 'line' ? { width: 2, ...(atenuada ? { opacity: 0.35 } : {}) } : undefined,
      ...(atenuada && tipo === 'bar' ? { itemStyle: { opacity: 0.35 } } : {}),
      barMaxWidth: 36,
      emphasis: { focus: 'series' },
      markLine:
        tipo === 'line' && idxSel >= 0
          ? {
              silent: true,
              symbol: 'none',
              lineStyle: { color: tema.texto, type: 'dashed', width: 1 },
              label: { show: false },
              data: [{ xAxis: idxSel }],
            }
          : undefined,
    };
  });

  const categoria = {
    type: 'category',
    data: d.categorias,
    axisLine: { lineStyle: { color: tema.linea } },
    // Pocas categorías: se rotulan todas (si no, «Visitador / Referidor / Plataforma» salta una de cada dos).
    axisLabel: {
      color: tema.textoSuave,
      hideOverlap: true,
      ...(d.categorias.length <= 12 ? { interval: 0 } : {}),
      // Entre 4 y 12 categorías en el eje horizontal los nombres largos se parten en vez de taparse.
      ...(!horizontal && d.categorias.length >= 4 && d.categorias.length <= 12 ? { width: 84, overflow: 'break' } : {}),
    },
    axisTick: { alignWithLabel: true },
  };
  const valor = {
    type: 'value',
    // Una línea no necesita el cero: con el eje desde 0 una serie que se mueve 10 % queda plana.
    scale: d.series.every((s) => s.forma === 'linea'),
    splitLine: { lineStyle: { color: tema.rejilla } },
    axisLabel: {
      color: tema.textoSuave,
      hideOverlap: true,
      formatter: (v: number) => formatearValor(v, spec.unidad, true),
    },
  };

  return {
    ...base(tema),
    legend: leyenda(tema),
    tooltip: {
      ...tooltipBase(tema),
      trigger: 'axis',
      axisPointer: { type: d.series.some((s) => s.forma === 'barra') ? 'shadow' : 'line' },
      formatter: (params: ParamEje | ParamEje[]) => {
        const lista = Array.isArray(params) ? params : [params];
        const filas = lista
          .map((p) => {
            const serie = d.series.find((s) => s.nombre === p.seriesName);
            const v = readValue(p);
            return `<div style="display:flex;justify-content:space-between;gap:16px"><span>${p.marker ?? ''}${escapar(p.seriesName ?? '')}</span><b>${escapar(formatearValor(v, unitOf(serie, spec.unidad)))}</b></div>`;
          })
          .join('');
        return `<div style="font-weight:600;margin-bottom:4px">${escapar(lista[0]?.axisValueLabel ?? lista[0]?.name ?? '')}</div>${filas}`;
      },
    },
    grid: { left: 8, right: 16, top: 20, bottom: 56, containLabel: true },
    xAxis: horizontal ? valor : categoria,
    yAxis: horizontal ? { ...categoria, inverse: true } : valor,
    series,
  };
}

function construirPartes(
  o: OpcionesBuild,
  d: Extract<DatosGrafico, { tipo: 'partes' }>,
): EChartsCoreOption {
  const { tema, spec, seleccion } = o;
  const total = d.partes.reduce((a, p) => a + (p.valor ?? 0), 0);
  const primero = d.partes[0]?.valor ?? null;
  const datos = d.partes.map((p) => ({
    name: p.nombre,
    value: p.valor,
    itemStyle: seleccion !== null && seleccion !== p.nombre ? { opacity: 0.35 } : undefined,
  }));
  const embudo = d.forma === 'embudo';
  return {
    ...base(tema),
    legend: leyenda(tema, d.partes.map((p) => p.nombre)),
    tooltip: {
      ...tooltipBase(tema),
      trigger: 'item',
      formatter: (p: ParamEje) => {
        const v = readValue(p);
        const extra = embudo
          ? primero !== null && primero > 0 && v !== null
            ? `<div>${escapar(`${((v / primero) * 100).toFixed(1)} % del primer paso`)}</div>`
            : ''
          : total > 0 && v !== null
            ? `<div>${escapar(`${((v / total) * 100).toFixed(1)} % del total`)}</div>`
            : '';
        return `<div style="font-weight:600">${p.marker ?? ''}${escapar(p.name ?? '')}</div><div><b>${escapar(formatearValor(v, spec.unidad))}</b></div>${extra}`;
      },
    },
    series: [
      embudo
        ? {
            type: 'funnel',
            name: spec.titulo,
            left: '4%',
            right: '38%',
            top: 12,
            bottom: 64,
            sort: 'none',
            gap: 3,
            label: {
              show: true,
              position: 'right',
              color: tema.texto,
              lineHeight: 16,
              formatter: (p: ParamEje) => `${p.name ?? ''}\n${formatearValor(readValue(p), spec.unidad, true)}`,
            },
            labelLine: { show: true, length: 14, lineStyle: { color: tema.linea } },
            data: datos,
          }
        : {
            type: 'pie',
            name: spec.titulo,
            radius: ['36%', '58%'],
            center: ['50%', '40%'],
            avoidLabelOverlap: true,
            label: { show: false },
            emphasis: { scale: true, label: { show: false } },
            itemStyle: { borderColor: tema.fondoTooltip, borderWidth: 2 },
            data: datos,
          },
    ],
  };
}

function construirMapaCalor(
  o: OpcionesBuild,
  d: Extract<DatosGrafico, { tipo: 'mapa-calor' }>,
): EChartsCoreOption {
  const { tema, spec } = o;
  const valores = d.celdas.map((c) => c[2]).filter((v): v is number => v !== null);
  const min = valores.length > 0 ? Math.min(...valores) : 0;
  const max = valores.length > 0 ? Math.max(...valores) : 1;
  return {
    ...base(tema),
    // La «leyenda» de un mapa de calor es su escala de color.
    visualMap: {
      type: 'continuous',
      min,
      max,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 4,
      itemWidth: 12,
      itemHeight: 160,
      text: [formatearValor(max, spec.unidad), formatearValor(min, spec.unidad)],
      textStyle: { color: tema.texto },
      inRange: { color: [...tema.rampa] },
    },
    tooltip: {
      ...tooltipBase(tema),
      trigger: 'item',
      formatter: (p: ParamEje) => {
        const v = Array.isArray(p.value) ? p.value : [];
        const col = d.columnas[Number(v[0])] ?? '';
        const fila = d.filas[Number(v[1])] ?? '';
        const sinDato = (p.data as { sinDato?: boolean } | undefined)?.sinDato === true;
        const val = !sinDato && typeof v[2] === 'number' ? formatearValor(v[2], spec.unidad) : NO_DATA;
        return `<div style="font-weight:600">${escapar(fila)} · ${escapar(col)}</div><div>${escapar(d.nombreValor)}: <b>${escapar(val)}</b></div>`;
      },
    },
    grid: { left: 8, right: 16, top: 12, bottom: 60, containLabel: true },
    xAxis: { type: 'category', data: d.columnas, splitArea: { show: false }, axisLabel: { color: tema.textoSuave, interval: 0, hideOverlap: true } },
    yAxis: { type: 'category', data: d.filas, inverse: true, axisLabel: { color: tema.textoSuave, interval: 0 } },
    series: [
      {
        type: 'heatmap',
        name: d.nombreValor,
        data: d.celdas.map((c) =>
          c[2] === null
            ? {
                // Sin dato no es cero ni un hueco: se pinta neutro y lo dice. ECharts no dibuja un
                // valor ausente, así que la celda lleva un número de relleno (el mínimo de la
                // escala) y la marca `sinDato`; el tooltip y el color mandan sobre ese número.
                value: [c[0], c[1], min],
                sinDato: true,
                itemStyle: { color: tema.rejilla },
                label: { show: d.columnas.length <= 14 && d.filas.length <= 14, formatter: 'Sin dato', color: tema.textoSuave },
              }
            : {
                value: [c[0], c[1], c[2]],
                label: {
                  color: readableOn(
                    rampColorAt(tema.rampa, max === min ? 0 : (c[2] - min) / (max - min)),
                    tema.texto,
                    tema.superficie,
                  ),
                },
              },
        ),
        label: {
          show: d.columnas.length <= 14 && d.filas.length <= 14,
          color: tema.texto,
          formatter: (p: ParamEje) => (Array.isArray(p.value) && typeof p.value[2] === 'number' ? formatearValor(p.value[2], spec.unidad, true) : ''),
        },
        itemStyle: { borderColor: tema.fondoTooltip, borderWidth: 2 },
        emphasis: { itemStyle: { borderColor: tema.texto } },
      },
    ],
  };
}

function construirMedidor(
  o: OpcionesBuild,
  d: Extract<DatosGrafico, { tipo: 'medidor' }>,
): EChartsCoreOption {
  const { tema, spec } = o;
  const objetivoFrac = d.objetivo === undefined ? null : (d.objetivo - d.minimo) / (d.maximo - d.minimo);
  return {
    ...base(tema),
    legend: leyenda(tema, [d.nombre]),
    tooltip: {
      ...tooltipBase(tema),
      trigger: 'item',
      formatter: () =>
        `<div style="font-weight:600">${escapar(d.nombre)}</div><div><b>${escapar(formatearValor(d.valor, spec.unidad))}</b></div>${
          d.objetivo === undefined ? '' : `<div>Objetivo: ${escapar(formatearValor(d.objetivo, spec.unidad))}</div>`
        }`,
    },
    series: [
      {
        type: 'gauge',
        name: d.nombre,
        min: d.minimo,
        max: d.maximo,
        startAngle: 210,
        endAngle: -30,
        radius: '84%',
        center: ['50%', '58%'],
        splitNumber: 4,
        progress: { show: true, width: 16 },
        axisLine: {
          lineStyle: {
            width: 16,
            color: objetivoFrac === null ? [[1, tema.rejilla]] : [[objetivoFrac, tema.rejilla], [1, tema.linea]],
          },
        },
        pointer: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { color: tema.textoSuave, distance: 22, formatter: (v: number) => formatearValor(v, spec.unidad, true) },
        title: { show: false },
        detail: {
          valueAnimation: true,
          offsetCenter: [0, '8%'],
          fontSize: 26,
          fontWeight: 700,
          color: tema.texto,
          formatter: () => formatearValor(d.valor, spec.unidad),
        },
        data: [{ value: d.valor === null ? 0 : d.valor, name: d.nombre, itemStyle: { color: tema.serie[0] } }],
      },
    ],
  };
}

function construirCascada(
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
    legend: leyenda(tema, ['Aumento', 'Disminución', 'Total']),
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
    xAxis: { type: 'category', data: nombres, axisLabel: { color: tema.textoSuave, interval: 0, width: 96, overflow: 'break' }, axisLine: { lineStyle: { color: tema.linea } } },
    yAxis: { type: 'value', splitLine: { lineStyle: { color: tema.rejilla } }, axisLabel: { color: tema.textoSuave, formatter: (v: number) => formatearValor(v, spec.unidad, true) } },
    series: [
      { name: 'Base', type: 'bar', stack: 'cascada', silent: true, itemStyle: { color: 'transparent' }, data: base0, tooltip: { show: false } },
      { name: 'Aumento', type: 'bar', stack: 'cascada', data: withOpacity(sube), itemStyle: { color: tema.bueno }, barMaxWidth: 40 },
      { name: 'Disminución', type: 'bar', stack: 'cascada', data: withOpacity(baja), itemStyle: { color: tema.malo }, barMaxWidth: 40 },
      { name: 'Total', type: 'bar', stack: 'cascada', data: withOpacity(total), itemStyle: { color: tema.serie[0] }, barMaxWidth: 40 },
    ],
  };
}

function construirVelas(o: OpcionesBuild): EChartsCoreOption {
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
        return `<div style="font-weight:600;margin-bottom:4px">${escapar(v.fecha)}</div>
          <div>Apertura: <b>${f(v.apertura)}</b></div><div>Cierre: <b>${f(v.cierre)}</b></div>
          <div>Mínimo: <b>${f(v.minimo)}</b></div><div>Máximo: <b>${f(v.maximo)}</b></div>
          <div>Variación: <b>${cambio === null ? NO_DATA : `${cambio >= 0 ? '+' : '−'}${Math.abs(cambio).toFixed(1)} %`}</b> · ${cambio === null ? '' : (cambio >= 0) === (spec.velas?.subirEsMalo !== true) ? 'Mejora' : 'Empeora'}</div>`;
      },
    },
    grid: { left: 8, right: 16, top: 20, bottom: 84, containLabel: true },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 34, borderColor: tema.rejilla, textStyle: { color: tema.textoSuave } }],
    xAxis: { type: 'category', data: velas.map((v) => v.fecha), axisLabel: { color: tema.textoSuave, hideOverlap: true }, axisLine: { lineStyle: { color: tema.linea } } },
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

/**
 * En un lienzo angosto (teléfono) cinco nombres de categoría no caben en horizontal y se montan
 * unos sobre otros: ECharts decide por el ancho real del lienzo (`media`), no por la ventana,
 * así que sigue valiendo dentro de un panel estrecho en una pantalla grande.
 */
function conMovil(option: EChartsCoreOption): EChartsCoreOption {
  return {
    baseOption: option,
    media: [
      {
        query: { maxWidth: 520 },
        option: {
          xAxis: { axisLabel: { rotate: 35, width: 160, overflow: 'none', hideOverlap: false } },
          grid: { left: 28, bottom: 84 },
        },
      },
    ],
  };
}

export function construirOpciones(o: OpcionesBuild): EChartsCoreOption {
  if (o.modo === 'velas' && o.spec.velas !== null) {
    return construirVelas(o);
  }
  const d = o.spec.datos;
  switch (d.tipo) {
    case 'cartesiano':
      // Solo con pocas categorías (las que se rotulan todas): una serie diaria se aclara sola por intervalo.
      return d.horizontal !== true && d.categorias.length >= 4 && d.categorias.length <= 12
        ? conMovil(construirCartesiano(o, d))
        : construirCartesiano(o, d);
    case 'partes':
      return construirPartes(o, d);
    case 'mapa-calor':
      return construirMapaCalor(o, d);
    case 'medidor':
      return construirMedidor(o, d);
    case 'cascada':
      return conMovil(construirCascada(o, d));
  }
}

/** Qué valor de la dimensión representa un clic en el gráfico, o `null` si no filtra. */
export function clickedValue(
  datos: DatosGrafico,
  evento: { name?: string; value?: unknown; seriesName?: string },
  filtro?: ConfigFiltro | null,
): string | null {
  switch (datos.tipo) {
    case 'cartesiano':
      return (filtro?.valorDe === 'serie' ? evento.seriesName : evento.name) ?? null;
    case 'partes':
    case 'cascada':
      return evento.name ?? null;
    case 'mapa-calor': {
      const fila = Array.isArray(evento.value) ? datos.filas[Number(evento.value[1])] : undefined;
      return fila ?? null;
    }
    case 'medidor':
      return null;
  }
}
