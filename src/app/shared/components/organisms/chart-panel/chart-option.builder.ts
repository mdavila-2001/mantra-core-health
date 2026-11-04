import type { EChartsCoreOption } from 'echarts/core';

import { formatDate, formatearValor, NO_DATA } from '@core/data-access/reporting/reporting-format';
import type { ConfigFiltro, DatosGrafico } from '@core/data-access/reporting/reporting.types';
import { rampColorAt, readableOn } from './chart-color';
import { construirCascada, construirVelas } from './chart-option.cascada';
import { construirHistograma } from './chart-option.histograma';
import { coloresDeSeries, colorDeCategoria } from './chart-option.paleta';
import { ajusteEtiquetas, base, escapar, leyenda, type OpcionesBuild, type ParamEje, readValue, tooltipBase, unitOf } from './chart-option.common';

export { escapar, type ModoGrafico, type OpcionesBuild } from './chart-option.common';

/* ============================================================================
    Traduce un `ChartSpec` a las opciones de Apache ECharts, cumpliendo el
    contrato: leyenda y tooltip SIEMPRE presentes, `null` como «Sin dato», y el
    elemento elegido por un filtro resaltado. Los helpers comunes viven en
    `chart-option.common.ts` y la cascada y las velas en `chart-option.cascada.ts`.
    ========================================================================== */

function construirCartesiano(
  o: OpcionesBuild,
  d: Extract<DatosGrafico, { tipo: 'cartesiano' }>,
): EChartsCoreOption {
  const { tema, spec, seleccion } = o;
  const horizontal = d.horizontal === true;
  const bySeries = spec.filtro?.valorDe === 'serie';
  const idxSel = seleccion === null || bySeries ? -1 : d.categorias.indexOf(seleccion);

  const colores = coloresDeSeries(d, tema);
  // Marcas (dataviz `marks-and-anatomy.md`): línea de 2 px, marcador de 8 px con anillo de superficie de 2 px,
  // barra de a lo sumo 24 px y 2 px de brecha de superficie entre segmentos contiguos.
  const marcas: unknown[] = [];
  if (d.objetivo !== undefined) {
    marcas.push({
      [horizontal ? 'xAxis' : 'yAxis']: d.objetivo.valor,
      label: { show: true, formatter: d.objetivo.etiqueta, color: tema.texto, position: 'insideEndTop' },
      lineStyle: { color: tema.aviso ?? tema.texto, type: 'solid', width: 1.5 },
    });
  }
  for (const a of d.anotaciones ?? []) {
    marcas.push({
      xAxis: a.en,
      label: { show: true, formatter: a.etiqueta, color: tema.textoSuave, position: 'insideEndTop', rotate: 90 },
      lineStyle: { color: tema.linea, type: 'solid', width: 1 },
    });
  }
  const series = d.series.map((s, serieIdx) => {
    // Filtro por serie: las demás series se atenúan, como las demás barras cuando se filtra por categoría.
    const atenuada = bySeries && seleccion !== null && s.nombre !== seleccion;
    const tipo = s.forma === 'barra' ? 'bar' : 'line';
    const color = colores[serieIdx] ?? tema.serie[0] ?? 'currentColor';
    const datos = s.valores.map((v, i) => {
      if (v === null) {
        return null;
      }
      const cat = d.categorias[i] ?? '';
      const colorBarra = colorDeCategoria(d, tema, color, cat);
      const sinAtenuar = colorBarra === color;
      if (s.forma === 'barra' && idxSel >= 0 && i !== idxSel) {
        return { value: v, itemStyle: { opacity: 0.35, color: colorBarra } };
      }
      return s.forma === 'barra' && !sinAtenuar ? { value: v, itemStyle: { color: colorBarra } } : v;
    });
    const marcasDeEstaSerie = serieIdx === 0 ? marcas : [];
    const lineaSeleccion =
      tipo === 'line' && idxSel >= 0 ? [{ xAxis: idxSel, lineStyle: { color: tema.texto, type: 'dashed', width: 1 }, label: { show: false } }] : [];
    const dataMarks = [...marcasDeEstaSerie, ...lineaSeleccion];
    return {
      name: s.nombre,
      type: tipo,
      data: datos,
      stack: s.apilar,
      smooth: false,
      connectNulls: false,
      showSymbol: d.categorias.length <= 14,
      symbolSize: 8,
      areaStyle: s.forma === 'area' ? { opacity: 0.1, color } : undefined,
      lineStyle: tipo === 'line' ? { width: 2, color, ...(atenuada ? { opacity: 0.35 } : {}) } : undefined,
      barMaxWidth: 24,
      itemStyle: {
        color,
        borderColor: tema.superficie,
        // El anillo del marcador de línea es de 2 px; la brecha de una barra, de 1 px por lado (= 2 px entre vecinas).
        borderWidth: tipo === 'line' ? 2 : 1,
        ...(tipo === 'bar' && s.apilar === undefined ? { borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0] } : {}),
        ...(atenuada ? { opacity: 0.35 } : {}),
      },
      emphasis: { focus: 'series' },
      markLine:
        dataMarks.length > 0
          ? { silent: true, symbol: 'none', label: { show: false }, data: dataMarks }
          : undefined,
    };
  });

  const emptyCategories = new Set(d.categorias.filter((_, i) => d.series.every((s) => s.valores[i] === null || s.valores[i] === undefined)));
  // Inclinadas van en una línea: dos líneas inclinadas se pisan con las del vecino.
  const etiquetaInclinada =
    !horizontal &&
    d.categorias.length >= 4 &&
    d.categorias.length <= 12 &&
    ajusteEtiquetas(
      d.categorias.map((c) => formatDate(c)),
      Math.max(44, Math.min(spec.ancho === 'completo' ? 160 : 120, Math.floor((spec.ancho === 'completo' ? 880 : 520) / d.categorias.length))),
    ).rotate > 0;
  const categoria = {
    type: 'category',
    data: d.categorias,
    axisLine: { lineStyle: { color: tema.linea } },
    // Pocas categorías: se rotulan todas (si no, «Visitador / Referidor / Plataforma» salta una de cada dos).
    axisLabel: {
      color: tema.textoSuave,
      hideOverlap: true,
      ...(d.categorias.length <= 12 ? { interval: 0 } : {}),
      // Entre 4 y 12 categorías en el eje horizontal los nombres largos se parten en vez de taparse:
      // el ancho de cada nombre es lo que le toca de un panel de media columna (~330 px).
      // Una media columna de escritorio mide ~520 px y una de ancho completo ~880, no 330: sin esto «Organización afiliada» se partía en
      // «Organizaci / ón afiliada» con sitio de sobra.
      ...(!horizontal && d.categorias.length >= 4 && d.categorias.length <= 12
        ? {
            ...ajusteEtiquetas(
              d.categorias.map((c) => formatDate(c)),
              Math.max(44, Math.min(spec.ancho === 'completo' ? 160 : 120, Math.floor((spec.ancho === 'completo' ? 880 : 520) / d.categorias.length))),
            ),
            hideOverlap: false,
          }
        : {}),
      // Una categoría sin ningún valor no dibuja barra: el eje lo dice en vez de hacerla desaparecer.
      formatter: (nombre: string) =>
        emptyCategories.has(nombre) ? `${formatDate(nombre)}${etiquetaInclinada ? ' ' : '\n'}(sin dato)` : formatDate(nombre),
    },
    axisTick: { alignWithLabel: true },
  };
  const valor = {
    type: 'value',
    // Una línea no necesita el cero: con el eje desde 0 una serie que se mueve 10 % queda plana.
    scale: d.series.every((s) => s.forma === 'linea'),
    // En porcentajes, un eje que se aclara a 0,05 repetiría «1,9 % · 1,9 % · 1,8 %…» con un decimal.
    ...(spec.unidad.tipo === 'porcentaje' ? { minInterval: 0.1 } : {}),
    // Rejilla hairline SÓLIDA: la punteada es ruido (anti-patrón de dataviz).
    splitLine: { lineStyle: { color: tema.rejilla, type: 'solid' } },
    axisLine: { show: false },
    // Una línea de objetivo fuera del rango de los datos no se vería: el eje la incluye.
    ...(d.objetivo === undefined ? {} : { max: (v: { max: number }) => Math.max(v.max, d.objetivo?.valor ?? 0) * 1.08 }),
    axisLabel: {
      color: tema.textoSuave,
      fontSize: 11,
      hideOverlap: true,
      formatter: (v: number) => formatearValor(v, spec.unidad, true),
    },
  };

  return {
    ...base(tema),
    color: colores,
    // Con una sola serie no hay nada que distinguir: el título la nombra (enmienda X-8 a ADR-0017).
    legend: leyenda(tema, undefined, d.series.length > 1),
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
        return `<div style="font-weight:600;margin-bottom:4px">${escapar(formatDate(lista[0]?.axisValueLabel ?? lista[0]?.name ?? '', true))}</div>${filas}`;
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
            // Una etapa que es el 0,04 % de la anterior no puede quedar en una astilla sin forma.
            minSize: '14%',
            label: {
              show: true,
              position: 'right',
              // Sin distancia, el rótulo del primer paso (el más ancho) arrancaba bajo el borde oblicuo del trapecio.
              distance: 28,
              color: tema.texto,
              lineHeight: 16,
              formatter: (p: ParamEje) => `${p.name ?? ''}\n${formatearValor(readValue(p), spec.unidad, true)}`,
            },
            labelLine: { show: true, length: 48, lineStyle: { color: tema.linea } },
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
      text: [formatearValor(max, spec.unidad, true), formatearValor(min, spec.unidad, true)],
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
        const isEmptyCell = (p.data as { sinDato?: boolean } | undefined)?.sinDato === true;
        const val = !isEmptyCell && typeof v[2] === 'number' ? formatearValor(v[2], spec.unidad) : NO_DATA;
        return `<div style="font-weight:600">${escapar(fila)} · ${escapar(col)}</div><div>${escapar(d.nombreValor)}: <b>${escapar(val)}</b></div>`;
      },
    },
    grid: { left: 8, right: 16, top: 12, bottom: 60, containLabel: true },
    xAxis: { type: 'category', data: d.columnas, splitArea: { show: false }, axisLabel: { color: tema.textoSuave, interval: 0, hideOverlap: d.columnas.length > 8, width: 120, overflow: 'break' } },
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
                // Sin `show` propio: hereda el de la serie, que en un lienzo angosto se apaga (si no, «Sin dato» se amontona).
                label: { formatter: 'Sin dato', color: tema.textoSuave },
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
        splitNumber: 2,
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


/**
 * En un lienzo angosto (teléfono) cinco nombres de categoría no caben en horizontal y se montan
 * unos sobre otros: ECharts decide por el ancho real del lienzo (`media`), no por la ventana,
 * así que sigue valiendo dentro de un panel estrecho en una pantalla grande.
 */
function withNarrow(option: EChartsCoreOption, angosto?: Record<string, unknown>): EChartsCoreOption {
  return {
    baseOption: option,
    media: [
      {
        query: { maxWidth: 520 },
        option: angosto ?? {
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
      if (d.horizontal === true) {
        // Con el nombre ocupando el 70 % del ancho la barra no tenía área útil: en angosto el nombre se limita a
        // ~130 px. Con pocas barras sobra alto para partirlo en dos líneas y se lee entero; con muchas, dos líneas
        // por barra se pisarían y se trunca (el tooltip y la tabla lo dicen entero).
        return withNarrow(construirCartesiano(o, d), {
          yAxis: { axisLabel: { width: 130, overflow: d.categorias.length <= 7 ? 'break' : 'truncate' } },
          grid: { left: 8 },
        });
      }
      if (d.categorias.length >= 2 && d.categorias.length <= 3 && d.categorias.some((c) => c.length > 10)) {
        // Con 2 o 3 categorías de nombre largo («Notificación push»), en un lienzo angosto cada nombre se parte
        // dentro de su casilla; si no, ECharts oculta el del medio por solaparse y parece una barra sin nombre.
        return withNarrow(construirCartesiano(o, d), {
          xAxis: { axisLabel: { width: Math.floor(240 / d.categorias.length), overflow: 'break', hideOverlap: false } },
        });
      }
      return d.categorias.length >= 4 && d.categorias.length <= 12
        ? withNarrow(construirCartesiano(o, d))
        : construirCartesiano(o, d);
    case 'partes':
      // En un teléfono la leyenda se parte en dos líneas y pisaba la última etapa; la etiqueta de «En prueba o
      // con campaña creada» salía cortada: se deja más sitio abajo y a la derecha y la etiqueta se parte.
      return d.forma === 'embudo'
        ? withNarrow(construirPartes(o, d), {
            series: [{ right: '46%', bottom: 110, label: { width: 110, overflow: 'break' }, labelLine: { length: 14 } }],
          })
        : withNarrow(construirPartes(o, d), {
            // La leyenda se parte en varias líneas en un teléfono: el anillo sube y se achica para no quedar pisado.
            series: [{ center: ['50%', '33%'], radius: ['28%', '48%'] }],
          });
    case 'mapa-calor':
      // Con la celda de 40 px las cifras se montan unas sobre otras: en angosto se leen en el tooltip y en la tabla.
      return withNarrow(construirMapaCalor(o, d), { series: [{ label: { show: false } }], xAxis: { axisLabel: { rotate: 35, hideOverlap: d.columnas.length > 8, overflow: 'none' } } });
    case 'medidor':
      return construirMedidor(o, d);
    case 'histograma':
      return withNarrow(construirHistograma(o, d), { xAxis: { axisLabel: { rotate: 35, width: 80, overflow: 'none', hideOverlap: false } }, grid: { left: 28, bottom: 64 } });
    case 'cascada':
      return withNarrow(construirCascada(o, d), {
        xAxis: {
          // El `formatter` (una sola línea en angosto) no va aquí: una función de `media` no reemplaza a la base.
          axisLabel: { rotate: 40, width: 220, overflow: 'none', hideOverlap: false },
        },
        // `containLabel` ya reserva el sitio de los rótulos inclinados: un margen inferior grande encima los
        // suma y aplasta el trazado (el eje Y se amontonaba en ~55 px).
        // La leyenda sube: abajo la pisaban los rótulos inclinados.
        legend: { top: 0, bottom: 'auto' },
        grid: { left: 8, right: 12, top: 40, bottom: 8 },
      });
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
    case 'histograma':
      return null;
  }
}
