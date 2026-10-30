import { describe, expect, it } from 'vitest';

import { CATALOG_TABS, CATALOG_TAB_LABELS, tabIndexOf, tabKeyOf } from './catalog-tabs';

describe('pestañas del catálogo', () => {
  it('son cinco, en el orden en que se dibujan', () => {
    expect(CATALOG_TABS).toEqual(['products', 'categories', 'prices', 'inventory', 'import']);
    expect(CATALOG_TABS.map((tab) => CATALOG_TAB_LABELS[tab])).toEqual([
      'Productos',
      'Categorías',
      'Precios',
      'Inventario',
      'Importación',
    ]);
  });

  it('cada clave da su índice y vuelta', () => {
    CATALOG_TABS.forEach((tab, index) => {
      expect(tabIndexOf(tab)).toBe(index);
      expect(tabKeyOf(index)).toBe(tab);
    });
  });

  it.each([null, undefined, '', 'foo', 'integration', 'PRODUCTS'])(
    'con %s abre Productos',
    (raw) => {
      expect(tabIndexOf(raw)).toBe(0);
    },
  );

  it('un índice fuera de rango da Productos', () => {
    expect(tabKeyOf(-1)).toBe('products');
    expect(tabKeyOf(CATALOG_TABS.length)).toBe('products');
  });
});
