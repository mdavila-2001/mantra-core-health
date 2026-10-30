import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ChartSpec, DatosGrafico } from '@core/data-access/reporting/reporting.types';
import { clickedValue, construirOpciones } from './chart-option.builder';
import type { ChartTheme } from './chart-theme';

const TEMA: ChartTheme = {
  serie: ['#2a78d6', '#e8673a'],
  texto: '#1a1a1a',
  textoSuave: '#555555',
  linea: '#999999',
  rejilla: '#dddddd',
  fondoTooltip: '#ffffff',
  bordeTooltip: '#999999',
  bueno: '#0a7a3c',
  malo: '#a02020',
  superficie: '#ffffff',
  rampa: ['#cde2fb', '#86b6ef', '#3987e5', '#1c5cab', '#0d366b'],
  fuente: 'Nunito, sans-serif',
};

function spec(datos: DatosGrafico): ChartSpec {
  return {
    id: 'g',
    titulo: 'G',
    unidad: { tipo: 'numero' },
    datos,
    resumenAccesible: 'r',
    filtro: null,
    filtroMotivo: 'm',
    info: null,
    infoMotivo: 'm',
    velas: null,
    velasMotivo: 'm',
  };
}

/** La opción base: `construirOpciones` la envuelve en `baseOption` + `media` cuando el eje horizontal rotula categorías. */
function build(datos: DatosGrafico): unknown {
  const o = construirOpciones({ spec: spec(datos), tema: TEMA, modo: 'normal', seleccion: null });
  return (o as { baseOption?: unknown }).baseOption ?? o;
}

function buildRaw(datos: DatosGrafico): unknown {
  return construirOpciones({ spec: spec(datos), tema: TEMA, modo: 'normal', seleccion: null });
}

/** Lee `a.b.0.c` de una opción de ECharts sin tipar su forma interna. */
function at(o: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => (acc as Record<string, unknown> | undefined)?.[key], o);
}

function media(matches: Record<string, boolean>): void {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: matches[q] === true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}

interface HeatCell {
  value: [number, number, number];
  sinDato?: boolean;
  itemStyle?: { color: string };
  label: { show: boolean; formatter?: unknown; color: string };
}

/** Las celdas del mapa de calor ya como objetos (con su etiqueta propia), no como tuplas. */
function cells(datos: DatosGrafico): HeatCell[] {
  return (at(build(datos), 'series.0.data') as unknown[]).filter((d): d is HeatCell => !Array.isArray(d));
}

afterEach(() => vi.unstubAllGlobals());

describe('construirOpciones', () => {
  describe('patrones de relleno (decal)', () => {
    const BARS: DatosGrafico = { tipo: 'cartesiano', categorias: ['A', 'B'], series: [{ nombre: 'S', valores: [1, 2], forma: 'barra' }] };

    it('no se usan por defecto: ensucian marcas pequeñas y etiquetas', () => {
      media({});
      expect(at(build(BARS), 'aria.decal.show')).toBe(false);
    });

    it('se activan con «más contraste» o en modo de contraste forzado', () => {
      media({ '(prefers-contrast: more)': true });
      expect(at(build(BARS), 'aria.decal.show')).toBe(true);
      media({ '(forced-colors: active)': true });
      expect(at(build(BARS), 'aria.decal.show')).toBe(true);
    });
  });

  it('la tipografía de los textos es la real de la página, no «inherit» (ECharts mide con ella)', () => {
    media({});
    const o = build({ tipo: 'partes', forma: 'dona', partes: [{ nombre: 'A', valor: 1 }] });
    expect(at(o, 'textStyle.fontFamily')).toBe('Nunito, sans-serif');
  });

  it('la leyenda envuelve en vez de paginar: ninguna entrada queda escondida', () => {
    media({});
    const o = build({ tipo: 'partes', forma: 'dona', partes: [{ nombre: 'A', valor: 1 }] });
    expect(at(o, 'legend.type')).toBe('plain');
    expect(at(o, 'legend.width')).toBeDefined();
  });

  describe('cartesiano', () => {
    it('una serie solo de líneas no fuerza el cero; con barras sí', () => {
      media({});
      const lineas = build({ tipo: 'cartesiano', categorias: ['A', 'B'], series: [{ nombre: 'S', valores: [400, 410], forma: 'linea' }] });
      expect(at(lineas, 'yAxis.scale')).toBe(true);
      const barras = build({ tipo: 'cartesiano', categorias: ['A', 'B'], series: [{ nombre: 'S', valores: [400, 410], forma: 'barra' }] });
      expect(at(barras, 'yAxis.scale')).toBe(false);
    });

    it('entre 4 y 12 categorías los nombres largos se parten en vez de taparse', () => {
      media({});
      const nombres = ['Visitador médico', 'Corredor de seguros', 'Referidor', 'Organización afiliada', 'Plataforma'];
      const o = build({ tipo: 'cartesiano', categorias: nombres, series: [{ nombre: 'S', valores: [1, 2, 3, 4, 5], forma: 'barra' }] });
      expect(at(o, 'xAxis.axisLabel.overflow')).toBe('break');
      expect(at(o, 'xAxis.axisLabel.width')).toBeDefined();
      const tres = build({ tipo: 'cartesiano', categorias: ['A', 'B', 'C'], series: [{ nombre: 'S', valores: [1, 2, 3], forma: 'barra' }] });
      expect(at(tres, 'xAxis.axisLabel.overflow')).toBeUndefined();
    });

    it('en un lienzo angosto los nombres rotan en vez de montarse (media del propio ECharts)', () => {
      media({});
      const nombres = ['Visitador médico', 'Corredor de seguros', 'Referidor', 'Organización afiliada', 'Plataforma'];
      const raw = buildRaw({ tipo: 'cartesiano', categorias: nombres, series: [{ nombre: 'S', valores: [1, 2, 3, 4, 5], forma: 'barra' }] });
      expect(at(raw, 'media.0.query.maxWidth')).toBe(520);
      expect(at(raw, 'media.0.option.xAxis.axisLabel.rotate')).toBe(35);
      // Una serie diaria (muchas categorías) o un eje horizontal no se envuelven: no los necesitan.
      const dias = Array.from({ length: 30 }, (_, i) => `D${i}`);
      expect(at(buildRaw({ tipo: 'cartesiano', categorias: dias, series: [{ nombre: 'S', valores: dias.map(() => 1), forma: 'barra' }] }), 'media')).toBeUndefined();
      expect(at(buildRaw({ tipo: 'cartesiano', horizontal: true, categorias: nombres, series: [{ nombre: 'S', valores: [1, 2, 3, 4, 5], forma: 'barra' }] }), 'media')).toBeUndefined();
    });

    it('con pocas categorías se rotulan todas', () => {
      media({});
      const o = build({ tipo: 'cartesiano', categorias: ['A', 'B', 'C'], series: [{ nombre: 'S', valores: [1, 2, 3], forma: 'barra' }] });
      expect(at(o, 'xAxis.axisLabel.interval')).toBe(0);
      const muchas = Array.from({ length: 30 }, (_, i) => `D${i}`);
      const o2 = build({ tipo: 'cartesiano', categorias: muchas, series: [{ nombre: 'S', valores: muchas.map(() => 1), forma: 'barra' }] });
      expect(at(o2, 'xAxis.axisLabel.interval')).toBeUndefined();
      expect(at(o2, 'xAxis.axisLabel.hideOverlap')).toBe(true);
    });
  });

  describe('mapa de calor', () => {
    const HEAT: DatosGrafico = {
      tipo: 'mapa-calor',
      filas: ['F1', 'F2'],
      columnas: ['C1', 'C2'],
      celdas: [
        [0, 0, 10],
        [1, 0, 100],
        [0, 1, null],
        [1, 1, 55],
      ],
      nombreValor: 'V',
    };

    it('una celda sin dato dice «Sin dato» y se pinta neutra; no es un hueco ni un cero', () => {
      media({});
      const vacia = cells(HEAT).find((d) => d.sinDato === true);
      expect(vacia?.itemStyle?.color).toBe(TEMA.rejilla);
      expect(vacia?.label.formatter).toBe('Sin dato');
      expect(vacia?.label.show).toBe(true);
    });

    it('el tooltip de una celda sin dato dice «Sin dato» y no el número de relleno', () => {
      media({});
      const vacia = cells(HEAT).find((d) => d.sinDato === true);
      const formatter = at(build(HEAT), 'tooltip.formatter') as (p: unknown) => string;
      const html = formatter({ value: vacia?.value, data: vacia });
      expect(html).toContain('Sin dato');
      expect(html).not.toContain('10');
    });

    it('la etiqueta de cada celda es legible sobre su relleno: oscura sobre clara y clara sobre oscura', () => {
      media({});
      expect(cells(HEAT).find((d) => d.value[2] === 10)?.label.color).toBe(TEMA.texto);
      expect(cells(HEAT).find((d) => d.value[2] === 100)?.label.color).toBe(TEMA.superficie);
    });
  });

  it('las etiquetas del embudo van fuera de la forma, con su línea guía', () => {
    media({});
    const o = build({ tipo: 'partes', forma: 'embudo', partes: [{ nombre: 'Muy largo nombre de etapa', valor: 5 }, { nombre: 'B', valor: 2 }] });
    expect(at(o, 'series.0.label.position')).toBe('right');
    expect(at(o, 'series.0.labelLine.show')).toBe(true);
  });

  it('la cascada rotula todos los pasos y su serie auxiliar es invisible y sin tooltip', () => {
    media({});
    const o = build({ tipo: 'cascada', pasos: [{ nombre: 'Inicio', valor: 10, total: true }, { nombre: 'Sube', valor: 5 }, { nombre: 'Fin', valor: 15, total: true }] });
    expect(at(o, 'xAxis.axisLabel.interval')).toBe(0);
    const series = at(o, 'series') as { name: string; itemStyle: { color: string }; tooltip: { show: boolean } }[];
    const baseSerie = series.find((s) => s.name === 'Base');
    expect(baseSerie?.itemStyle.color).toBe('transparent');
    expect(baseSerie?.tooltip.show).toBe(false);
  });
});

describe('clickedValue', () => {
  const POR_DIA: DatosGrafico = {
    tipo: 'cartesiano',
    categorias: ['2026-10-01', '2026-10-02'],
    series: [
      { nombre: 'Esencial', valores: [1, 2], forma: 'barra', apilar: 'a' },
      { nombre: 'Pro', valores: [3, 4], forma: 'barra', apilar: 'a' },
    ],
  };
  const EVENTO = { name: '2026-10-02', seriesName: 'Pro' };

  it('por omisión el clic devuelve la categoría del eje', () => {
    expect(clickedValue(POR_DIA, EVENTO)).toBe('2026-10-02');
    expect(clickedValue(POR_DIA, EVENTO, { dimension: 'plan' })).toBe('2026-10-02');
  });

  it('con valorDe «serie» devuelve la serie: filtrar «plan = 2026-10-02» no significaría nada', () => {
    expect(clickedValue(POR_DIA, EVENTO, { dimension: 'plan', valorDe: 'serie' })).toBe('Pro');
  });

  it('sin nombre de serie no inventa un valor', () => {
    expect(clickedValue(POR_DIA, { name: 'x' }, { dimension: 'plan', valorDe: 'serie' })).toBeNull();
  });
});

describe('filtro por serie en el constructor', () => {
  it('atenúa las series que no son la elegida y deja intacta la elegida', () => {
    media({});
    const datos: DatosGrafico = {
      tipo: 'cartesiano',
      categorias: ['2026-10-01', '2026-10-02'],
      series: [
        { nombre: 'Esencial', valores: [1, 2], forma: 'barra', apilar: 'a' },
        { nombre: 'Pro', valores: [3, 4], forma: 'barra', apilar: 'a' },
      ],
    };
    const base: ChartSpec = { ...spec(datos), filtro: { dimension: 'plan', valorDe: 'serie' } };
    const o = construirOpciones({ spec: base, tema: TEMA, modo: 'normal', seleccion: 'Pro' }) as { series: { name: string; itemStyle?: { opacity: number } }[] };
    expect(o.series.find((s) => s.name === 'Esencial')?.itemStyle?.opacity).toBe(0.35);
    expect(o.series.find((s) => s.name === 'Pro')?.itemStyle).toBeUndefined();
  });
});
