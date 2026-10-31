import { describe, expect, it } from 'vitest';

import type { PharmacyProduct } from '../../../../core/data-access/pharmacy/pharmacy.types';
import type { SiteStock, SiteStockItem } from '../../../../core/data-access/pharmacy/pharmacy-site-stock.types';
import {
  availabilityDraft,
  declaredOutOfStock,
  initialEdit,
  isChanged,
  isLedgerSite,
  joinNames,
  matchesTerm,
  siteStockRows,
  type SiteStockRow,
} from './site-stock-rows';

function product(partial: Partial<PharmacyProduct>): PharmacyProduct {
  return {
    id: 'p-a',
    pharmacyId: 'ph-1',
    pharmacyName: 'Farmacia',
    productCode: 'A',
    brandName: 'Producto A',
    genericName: null,
    strengthText: null,
    packageSizeText: null,
    dosageForm: null,
    medication: null,
    requiresPrescription: false,
    status: 'PUBLISHED',
    inStock: true,
    stock: 5,
    minStock: null,
    ...partial,
  };
}

function item(productId: string, availableQuantity: number): SiteStockItem {
  return {
    productId,
    productCode: productId,
    brandName: null,
    genericName: null,
    strengthText: null,
    packageSizeText: null,
    medication: null,
    onHandQuantity: availableQuantity,
    reservedQuantity: 0,
    availableQuantity,
    locationCount: 1,
  };
}

function stock(items: readonly SiteStockItem[]): SiteStock {
  return { siteId: 's-1', siteName: 'Casa central', pharmacyId: 'ph-1', pharmacyName: 'Farmacia', items, count: items.length };
}

describe('siteStockRows', () => {
  it('con posición en una sede que lleva su stock: lo que dice la posición', () => {
    const rows = siteStockRows([product({ id: 'p-a' }), product({ id: 'p-b', productCode: 'B' })], stock([item('p-a', 0), item('p-b', 7)]));

    expect(rows.map((row) => [row.kind, row.available, row.quantity])).toEqual([
      ['TRACKED', false, 0],
      ['TRACKED', true, 7],
    ]);
  });

  it('sin posición, aunque la sede tenga stock propio de otros: sigue el catálogo', () => {
    const rows = siteStockRows(
      [product({ id: 'p-a' }), product({ id: 'p-g', productCode: 'G', stock: 2 })],
      stock([item('p-a', 1)]),
    );

    expect(rows[1]).toMatchObject({ productId: 'p-g', kind: 'CATALOG', available: true, quantity: 2 });
  });

  it('sede sin ninguna posición: lo declarado en el catálogo, con «sin conteo» como null', () => {
    const rows = siteStockRows(
      [product({ id: 'p-a', stock: 5 }), product({ id: 'p-b', stock: null }), product({ id: 'p-c', stock: 0, inStock: false })],
      stock([]),
    );

    expect(rows.map((row) => [row.kind, row.available, row.quantity])).toEqual([
      ['CATALOG', true, 5],
      ['CATALOG', true, null],
      ['CATALOG', false, 0],
    ]);
  });

  it('marcado sin stock en toda la farmacia gana, lleve o no la sede su stock', () => {
    const declared = product({ id: 'p-d', stock: 4, inStock: false, outOfStockDeclared: true });

    expect(siteStockRows([declared], stock([item('p-d', 4)]))[0]?.kind).toBe('DECLARED_OUT');
    expect(siteStockRows([declared], stock([]))[0]?.kind).toBe('DECLARED_OUT');
  });

  it('deja afuera borradores y retirados', () => {
    const rows = siteStockRows(
      [product({ id: 'p-a' }), product({ id: 'p-e', status: 'DRAFT' }), product({ id: 'p-w', status: 'WITHDRAWN' })],
      stock([]),
    );

    expect(rows.map((row) => row.productId)).toEqual(['p-a']);
  });
});

describe('modo de la sede y marca de la farmacia', () => {
  it('una sede con posiciones lleva su stock; sin ninguna, no', () => {
    expect(isLedgerSite(stock([item('p-a', 0)]))).toBe(true);
    expect(isLedgerSite(stock([]))).toBe(false);
  });

  it('«no lo tengo» de la farmacia es la marca que sirve la API, no se deduce del conteo', () => {
    expect(declaredOutOfStock(product({ inStock: false, stock: 0, outOfStockDeclared: true }))).toBe(true);
    expect(declaredOutOfStock(product({ inStock: false, stock: 4, outOfStockDeclared: true }))).toBe(true);
    expect(declaredOutOfStock(product({ inStock: false, stock: 0, outOfStockDeclared: false }))).toBe(false);
    expect(declaredOutOfStock(product({ inStock: false, stock: 4 }))).toBe(false);
  });
});

describe('lo editado', () => {
  const tracked: SiteStockRow = { productId: 'p-a', productCode: 'A', name: 'A', kind: 'TRACKED', available: true, quantity: 3 };

  it('parte de lo guardado y sólo cuenta como cambio lo que difiere', () => {
    expect(initialEdit(tracked)).toEqual({ available: true, quantity: '3' });
    expect(isChanged(tracked, { available: true, quantity: '3' })).toBe(false);
    expect(isChanged(tracked, { available: true, quantity: ' 3 ' })).toBe(false);
    expect(isChanged(tracked, { available: true, quantity: '4' })).toBe(true);
    expect(isChanged(tracked, { available: false, quantity: '3' })).toBe(true);
  });

  it('con «No lo tengo» la cantidad escrita no cuenta', () => {
    const off: SiteStockRow = { ...tracked, available: false, quantity: 0 };

    expect(initialEdit(off)).toEqual({ available: false, quantity: '' });
    expect(isChanged(off, { available: false, quantity: '9' })).toBe(false);
  });

  it('arma el cuerpo del PUT', () => {
    expect(availabilityDraft({ available: false, quantity: '7' })).toEqual({ draft: { available: false } });
    expect(availabilityDraft({ available: true, quantity: '' })).toEqual({ draft: { available: true } });
    expect(availabilityDraft({ available: true, quantity: '12' })).toEqual({ draft: { available: true, quantity: 12 } });
  });

  it('no manda una cantidad imposible', () => {
    expect(availabilityDraft({ available: true, quantity: '0' })).toHaveProperty('problem');
    expect(availabilityDraft({ available: true, quantity: '1.5' })).toHaveProperty('problem');
    expect(availabilityDraft({ available: true, quantity: '-2' })).toHaveProperty('problem');
    expect(availabilityDraft({ available: true, quantity: '1000001' })).toHaveProperty('problem');
  });
});

describe('ayudas de la pantalla', () => {
  it('busca por nombre o código', () => {
    const row: SiteStockRow = { productId: 'p', productCode: 'FAR06-A', name: 'Producto A', kind: 'TRACKED', available: true, quantity: 1 };

    expect(matchesTerm(row, '')).toBe(true);
    expect(matchesTerm(row, 'far06')).toBe(true);
    expect(matchesTerm(row, 'PRODUCTO')).toBe(true);
    expect(matchesTerm(row, 'otro')).toBe(false);
  });

  it('nombra las sedes con «y»', () => {
    expect(joinNames([])).toBe('');
    expect(joinNames(['Casa central'])).toBe('Casa central');
    expect(joinNames(['Casa central', 'Norte'])).toBe('Casa central y Norte');
    expect(joinNames(['Casa central', 'Norte', 'Sur'])).toBe('Casa central, Norte y Sur');
  });
});
