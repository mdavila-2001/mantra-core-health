import { describe, expect, it } from 'vitest';

import type { BranchListItem } from '../../../core/data-access/directory/directory.types';
import {
  branchCategoryOptions,
  branchFilterFrom,
  branchFilterOptions,
  branchPins,
  filterBranches,
  mapUrlOf,
} from './branch-category-view';

/** Head office, branch and default (v4.2.91): the label, the filter and the pins. */
function branch(partial: Partial<BranchListItem>): BranchListItem {
  return {
    id: partial.code ?? 'id',
    code: 'X',
    name: 'Sede',
    statusConceptId: 'st',
    createdAt: new Date('2026-01-01'),
    ...partial,
  };
}

const MATRIZ = branch({ id: 'b1', code: 'CENTRAL', name: 'Central', category: 'head_office', latitude: -17.78, longitude: -63.18, description: 'Av. Busch' });
const NORTE = branch({ id: 'b2', code: 'NORTE', name: 'Norte', category: 'branch', latitude: -17.7, longitude: -63.1 });
const VIEJA = branch({ id: 'b3', code: 'VIEJA', name: 'Vieja' });
const SUR = branch({ id: 'b4', code: 'SUR', name: 'Sur', category: 'branch' });
const ALL = [MATRIZ, NORTE, VIEJA, SUR];

describe('branch-category-view', () => {
  it('una sede sin categoría (API anterior) cuenta como «Por defecto»', () => {
    expect(filterBranches(ALL, 'default')).toEqual([VIEJA]);
    expect(filterBranches(ALL, 'branch')).toEqual([NORTE, SUR]);
    expect(filterBranches(ALL, 'all')).toEqual(ALL);
  });

  it('el filtro dice cuántas hay en cada oleada', () => {
    expect(branchFilterOptions(ALL).map((o) => o.label)).toEqual([
      'Todas (4)',
      'Casa matriz (1)',
      'Sucursal (2)',
      'Por defecto (1)',
    ]);
  });

  it('lee el filtro de la URL y lo desconocido es «todas»', () => {
    expect(branchFilterFrom('head_office')).toBe('head_office');
    expect(branchFilterFrom('otra')).toBe('all');
    expect(branchFilterFrom(null)).toBe('all');
  });

  it('un pin por sede con punto exacto, con su categoría escrita y el código como id', () => {
    const pins = branchPins(ALL);
    expect(pins).toEqual([
      {
        id: 'CENTRAL',
        codigo: 'M',
        lat: -17.78,
        lng: -63.18,
        titulo: 'Central',
        subtitulo: 'Av. Busch',
        estado: { etiqueta: 'Casa matriz', tono: 'primary' },
      },
      {
        id: 'NORTE',
        codigo: 'S',
        lat: -17.7,
        lng: -63.1,
        titulo: 'Norte',
        estado: { etiqueta: 'Sucursal', tono: 'info' },
      },
    ]);
  });

  it('«Casa matriz» se ofrece deshabilitada si ya lo es otra sede, y no a la propia', () => {
    const forOther = branchCategoryOptions(MATRIZ, 'b2').find((o) => o.value === 'head_office')!;
    expect(forOther.disabled).toBe(true);
    expect(forOther.description).toContain('«Central»');

    const forItself = branchCategoryOptions(MATRIZ, 'b1').find((o) => o.value === 'head_office')!;
    expect(forItself.disabled).toBe(false);

    const noHeadOffice = branchCategoryOptions(null, null).find((o) => o.value === 'head_office')!;
    expect(noHeadOffice.disabled).toBe(false);
  });

  it('sin enlace pegado, el enlace al mapa sale del punto; sin punto, no hay', () => {
    expect(mapUrlOf(NORTE)).toBe(
      'https://www.openstreetmap.org/?mlat=-17.7&mlon=-63.1#map=17/-17.7/-63.1',
    );
    expect(mapUrlOf({ ...NORTE, locationUrl: 'https://maps.example/n' })).toBe('https://maps.example/n');
    expect(mapUrlOf(SUR)).toBeNull();
  });
});
