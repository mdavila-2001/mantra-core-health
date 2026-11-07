import { describe, expect, it } from 'vitest';

import { parseCatalogFile } from './catalog-bulk-file';
import { KINDS } from './catalog-bulk-kinds';

const products = KINDS.find((k) => k.value === 'products')!;
const categories = KINDS.find((k) => k.value === 'categories')!;

describe('parseCatalogFile', () => {
  it('reads semicolon CSV, drops empty cells and types numbers and booleans', () => {
    const r = parseCatalogFile('p.csv', 'productCode;unitPrice;requiresPrescription;brandName\nA1;12,50;si;"Nombre; con punto y coma"\nA2;;no;', products);
    expect(r).toEqual({ ok: true, rows: [{ productCode: 'A1', unitPrice: 12.5, requiresPrescription: true, brandName: 'Nombre; con punto y coma' }, { productCode: 'A2', requiresPrescription: false }] });
  });
  it('reads a JSON array and rejects anything else', () => {
    expect(parseCatalogFile('c.json', '[{"name":"X"}]', categories)).toEqual({ ok: true, rows: [{ name: 'X' }] });
    expect(parseCatalogFile('c.json', '{"name":"X"}', categories).ok).toBe(false);
    expect(parseCatalogFile('c.json', '{', categories).ok).toBe(false);
  });
  it('rejects empty files and more than 1000 rows', () => {
    expect(parseCatalogFile('c.csv', 'name', categories).ok).toBe(false);
    const big = 'name\n' + Array.from({ length: 1001 }, (_, i) => `c${i}`).join('\n');
    expect(parseCatalogFile('c.csv', big, categories)).toMatchObject({ ok: false });
    expect(parseCatalogFile('c.csv', big.split('\n').slice(0, 1001).join('\n'), categories).ok).toBe(true);
  });
});
