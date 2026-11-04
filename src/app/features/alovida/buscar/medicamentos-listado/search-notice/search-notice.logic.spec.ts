import { describe, expect, it } from 'vitest';

import type { TarjetaDeMedicamento } from '@core/data-access/public-marketplace/public-marketplace.types';

import { brandMatchOf, usesMatchedOf } from './search-notice.logic';

const card = (extra: Partial<TarjetaDeMedicamento>): TarjetaDeMedicamento => ({
  conceptId: 'c',
  atcCode: 'A03BB01',
  genericName: 'Butilescopolamina',
  therapeuticGroup: 'Aparato digestivo y metabolismo',
  brands: ['Buscapina'],
  presentations: [],
  requiresPrescription: false,
  priceFrom: '30.00',
  priceTo: '34.00',
  currency: 'BOB',
  pharmacyCount: 2,
  nearestKm: null,
  ...extra,
});

describe('search notice logic', () => {
  it('finds the brand that matched and its active ingredient', () => {
    expect(brandMatchOf('busca', [card({})])).toEqual({
      marca: 'Buscapina',
      compuesto: 'Butilescopolamina',
    });
    expect(brandMatchOf('b', [card({})])).toBeNull();
  });

  it('lists the uses only when every result came by use', () => {
    const porUso = card({ matchedBy: 'use', matchedUse: 'Dolor abdominal y cólicos' });
    expect(usesMatchedOf([porUso, porUso])).toEqual(['Dolor abdominal y cólicos']);
    expect(usesMatchedOf([porUso, card({ matchedBy: 'name' })])).toEqual([]);
    expect(usesMatchedOf([])).toEqual([]);
  });
});
