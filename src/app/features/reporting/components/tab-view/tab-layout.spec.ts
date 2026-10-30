import { describe, expect, it } from 'vitest';

import type { ChartSpec, DatosGrafico } from '@core/data-access/reporting/reporting.types';
import { orphanCharts } from './tab-layout';

const BARS: DatosGrafico = {
  tipo: 'cartesiano',
  categorias: ['A'],
  series: [{ nombre: 'S', valores: [1], forma: 'barra' }],
};
const DONUT: DatosGrafico = { tipo: 'partes', forma: 'dona', partes: [{ nombre: 'A', valor: 1 }] };
const FUNNEL: DatosGrafico = { tipo: 'partes', forma: 'embudo', partes: [{ nombre: 'A', valor: 1 }] };
const GAUGE: DatosGrafico = { tipo: 'medidor', nombre: 'M', valor: 1, minimo: 0, maximo: 2 };

function chart(id: string, datos: DatosGrafico = BARS, ancho?: 'completo' | 'medio'): ChartSpec {
  return {
    id,
    titulo: id,
    unidad: { tipo: 'numero' },
    datos,
    resumenAccesible: 'r',
    filtro: null,
    filtroMotivo: 'm',
    info: null,
    infoMotivo: 'm',
    velas: null,
    velasMotivo: 'm',
    ...(ancho === undefined ? {} : { ancho }),
  };
}

describe('orphanCharts', () => {
  it('con un número par de gráficos de media columna no estira ninguno', () => {
    expect([...orphanCharts([chart('a'), chart('b')])]).toEqual([]);
  });

  it('sin gráficos no hay nada que estirar', () => {
    expect([...orphanCharts([])]).toEqual([]);
  });

  it('el último que sobra pasa a ancho completo', () => {
    expect([...orphanCharts([chart('a'), chart('b'), chart('c')])]).toEqual(['c']);
  });

  it('los de ancho completo no cuentan para el pareo', () => {
    expect([...orphanCharts([chart('a'), chart('b', BARS, 'completo'), chart('c')])]).toEqual([]);
    expect([...orphanCharts([chart('a'), chart('b', BARS, 'completo')])]).toEqual(['a']);
  });

  it('un embudo huérfano se estira', () => {
    expect([...orphanCharts([chart('a', FUNNEL)])]).toEqual(['a']);
  });

  it('una dona o un medidor huérfanos también se estiran cuando no hay otro que estirar: una ficha con media fila vacía es peor', () => {
    expect([...orphanCharts([chart('a', DONUT)])]).toEqual(['a']);
    expect([...orphanCharts([chart('a', GAUGE)])]).toEqual(['a']);
  });

  it('si el último no se puede estirar, estira el anterior que sí', () => {
    expect([...orphanCharts([chart('a'), chart('b'), chart('c', DONUT)])]).toEqual(['b']);
  });
});
