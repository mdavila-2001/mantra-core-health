import { convertToParamMap } from '@angular/router';

import type { GlossaryNeighbor } from '../../core/data-access/terminology/terminology.types';
import type { ClinicalRoute, RouteColumn } from './glossary-clinical-route';
import {
  applyNetworkFilters,
  DEFAULT_FILTERS,
  filtersFromParams,
  filtersToParams,
  isDefaultFilters,
  neighborPasses,
  type NetworkFilters,
} from './glossary-network-filters.logic';

const vecino = (id: string, extra: Partial<GlossaryNeighbor> = {}): GlossaryNeighbor => ({
  conceptId: id,
  slug: id,
  display: id,
  category: null,
  ...extra,
});

const params = (query: Record<string, string>) => convertToParamMap(query);

describe('filtros del mapa: URL ↔ estado', () => {
  it('sin parámetros, el estado es el por defecto: T1–T3, cualquier frecuencia, todo visible', () => {
    const filtros = filtersFromParams(params({}));
    expect([...filtros.tiers].sort()).toEqual(['COLLABORATIVE_KNOWLEDGE', 'CURATED_REFERENCE', 'NATIONAL_STANDARD']);
    expect(filtros.minFrequency).toBeNull();
    expect(filtros.hiddenColumns.size).toBe(0);
    expect(filtros.includeUnrated).toBe(true);
    expect(isDefaultFilters(filtros)).toBe(true);
  });

  it('el estado por defecto no escribe nada en la URL', () => {
    expect(filtersToParams(DEFAULT_FILTERS)).toEqual({
      evidence: null,
      minFrequency: null,
      hide: null,
      unrated: null,
    });
  });

  it('ida y vuelta: lo que se escribe se vuelve a leer igual', () => {
    const filtros: NetworkFilters = {
      tiers: new Set(['NATIONAL_STANDARD', 'STATISTICAL_LITERATURE']),
      minFrequency: 'FREQUENT',
      hiddenColumns: new Set(['related', 'anatomy']),
      includeUnrated: false,
    };
    const escritos = filtersToParams(filtros);
    expect(escritos).toEqual({ evidence: '1,4', minFrequency: 'FREQUENT', hide: 'anatomy,related', unrated: 'exclude' });

    const leidos = filtersFromParams(
      params(Object.fromEntries(Object.entries(escritos).filter((e): e is [string, string] => e[1] !== null))),
    );
    expect(leidos).toEqual(filtros);
  });

  it('ningún nivel marcado se escribe como evidence=none y se lee como vacío', () => {
    const filtros = { ...DEFAULT_FILTERS, tiers: new Set<never>() };
    expect(filtersToParams(filtros)['evidence']).toBe('none');
    expect(filtersFromParams(params({ evidence: 'none' })).tiers.size).toBe(0);
  });

  it('lo ilegible vuelve al valor por defecto en vez de vaciar el mapa', () => {
    const filtros = filtersFromParams(
      params({ evidence: '9,x', minFrequency: 'EXCLUDED', hide: 'inventada,symptoms', unrated: 'si' }),
    );
    expect(filtros.tiers).toEqual(DEFAULT_FILTERS.tiers);
    expect(filtros.minFrequency).toBeNull();
    expect([...filtros.hiddenColumns]).toEqual(['symptoms']);
    expect(filtros.includeUnrated).toBe(true);
  });
});

describe('neighborPasses', () => {
  it('un vecino sin ningún dato de evidencia queda visible salvo que se lo excluya explícitamente', () => {
    expect(neighborPasses(vecino('a'), DEFAULT_FILTERS)).toBe(true);
    expect(neighborPasses(vecino('a'), { ...DEFAULT_FILTERS, minFrequency: 'OBLIGATE' })).toBe(true);
    expect(neighborPasses(vecino('a'), { ...DEFAULT_FILTERS, includeUnrated: false })).toBe(false);
  });

  it('por defecto la bibliografía estadística (T4) no pasa', () => {
    expect(neighborPasses(vecino('a', { evidenceTier: 'STATISTICAL_LITERATURE' }), DEFAULT_FILTERS)).toBe(false);
    expect(neighborPasses(vecino('a', { evidenceTier: 'NATIONAL_STANDARD' }), DEFAULT_FILTERS)).toBe(true);
  });

  it('la frecuencia mínima sólo mira a quien informa frecuencia; «descartado» nunca la cumple', () => {
    const frecuente = { ...DEFAULT_FILTERS, minFrequency: 'FREQUENT' as const };
    expect(neighborPasses(vecino('a', { frequency: 'VERY_FREQUENT' }), frecuente)).toBe(true);
    expect(neighborPasses(vecino('a', { frequency: 'FREQUENT' }), frecuente)).toBe(true);
    expect(neighborPasses(vecino('a', { frequency: 'OCCASIONAL' }), frecuente)).toBe(false);
    expect(neighborPasses(vecino('a', { frequency: 'EXCLUDED' }), frecuente)).toBe(false);
    expect(neighborPasses(vecino('a', { evidenceTier: 'NATIONAL_STANDARD' }), frecuente)).toBe(true);
  });
});

describe('applyNetworkFilters', () => {
  const columna = (key: RouteColumn['key'], items: GlossaryNeighbor[], complete = true): RouteColumn => ({
    key,
    title: key,
    zone: 'next',
    items,
    complete,
    sources: [],
  });
  const ruta: ClinicalRoute = {
    findings: [columna('symptoms', [vecino('s-1'), vecino('s-2', { evidenceTier: 'STATISTICAL_LITERATURE' })])],
    next: [columna('tests', [vecino('t-1')]), columna('treatments', [vecino('x-1', { evidenceTier: 'STATISTICAL_LITERATURE' })], false)],
    context: [],
    neighborCount: 4,
  };

  it('cuenta los ocultos sobre los vecinos distintos cargados', () => {
    const resultado = applyNetworkFilters(ruta, DEFAULT_FILTERS);
    expect(resultado.totalCount).toBe(4);
    expect(resultado.hiddenCount).toBe(2);
    expect(resultado.route.neighborCount).toBe(2);
  });

  it('una columna incompleta queda aunque su muestra no pase, para poder pedir «Ver todos»', () => {
    const resultado = applyNetworkFilters(ruta, DEFAULT_FILTERS);
    expect(resultado.route.next.map((c) => [c.key, c.items.length])).toEqual([
      ['tests', 1],
      ['treatments', 0],
    ]);
  });

  it('una columna oculta desaparece entera', () => {
    const resultado = applyNetworkFilters(ruta, { ...DEFAULT_FILTERS, hiddenColumns: new Set(['symptoms']) });
    expect(resultado.route.findings).toEqual([]);
    expect(resultado.hiddenCount).toBe(3);
  });
});
