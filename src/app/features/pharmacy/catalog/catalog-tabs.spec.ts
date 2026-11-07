import { describe, expect, it } from 'vitest';

import {
  CATALOG_TABS,
  CATALOG_TAB_LABELS,
  IMPORT_TARGET_BY_TAB,
  tabIndexOf,
  tabKeyOf,
} from './catalog-tabs';

describe('pestañas del catálogo', () => {
  it('son cinco, en el orden en que se dibujan: importar es un botón, no una pestaña', () => {
    expect(CATALOG_TABS).toEqual(['products', 'categories', 'prices', 'inventory', 'integration']);
    expect(CATALOG_TABS.map((tab) => CATALOG_TAB_LABELS[tab])).toEqual([
      'Productos',
      'Categorías',
      'Precios',
      'Inventario',
      'Integración',
    ]);
  });

  it('cada clave da su índice y vuelta', () => {
    CATALOG_TABS.forEach((tab, index) => {
      expect(tabIndexOf(tab)).toBe(index);
      expect(tabKeyOf(index)).toBe(tab);
    });
  });

  it('`integration` abre la quinta pestaña, Integración', () => {
    expect(tabIndexOf('integration')).toBe(4);
    expect(CATALOG_TAB_LABELS[tabKeyOf(4)]).toBe('Integración');
  });

  it.each([null, undefined, '', 'foo', 'import', 'INTEGRATION', 'PRODUCTS'])(
    'con %s abre Productos',
    (raw) => {
      expect(tabIndexOf(raw)).toBe(0);
    },
  );

  it('un índice fuera de rango da Productos', () => {
    expect(tabKeyOf(-1)).toBe('products');
    expect(tabKeyOf(CATALOG_TABS.length)).toBe('products');
  });

  it('el modal de importar propone lo de la pestaña abierta, o productos', () => {
    expect(IMPORT_TARGET_BY_TAB).toEqual({
      products: 'products',
      categories: 'categories',
      prices: 'products',
      inventory: 'products',
      integration: 'products',
    });
  });
});
