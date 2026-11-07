import { describe, expect, it } from 'vitest';

import { branchCategoryFromCell } from './branch-category-cell';
import { branchImportColumns, reviewBranchCsv, validDrafts } from './branch-import';

/** The optional `categoria` column of the branch CSV (v4.2.92). */
describe('columna categoria del CSV de sucursales', () => {
  it.each([
    ['Casa matriz', 'head_office'],
    ['CASA  MATRIZ', 'head_office'],
    ['matriz', 'head_office'],
    ['Sucursal', 'branch'],
    ['por defecto', 'default'],
    ['Por Defecto', 'default'],
    ['', 'default'],
    ['head_office', 'head_office'],
  ])('lee «%s» como %s', (cell, category) => {
    expect(branchCategoryFromCell(cell)).toBe(category);
  });

  it('un valor desconocido no se adivina', () => {
    expect(branchCategoryFromCell('franquicia')).toBeNull();
  });

  it('con la opción, la categoría viaja en cada fila y una vacía queda por defecto', () => {
    const review = reviewBranchCsv(
      'nombre;categoria\nCentral;Casa matriz\nNorte;sucursal\nSur;\n',
      [],
      { withCategory: true },
    );
    expect(validDrafts(review).map((d) => [d.name, d.category])).toEqual([
      ['Central', 'head_office'],
      ['Norte', 'branch'],
      ['Sur', 'default'],
    ]);
  });

  it('un valor desconocido es error de su fila y dice los válidos', () => {
    const review = reviewBranchCsv('nombre;categoria\nNorte;franquicia\n', [], { withCategory: true });
    const row = review.rows[0];
    expect(row.ok).toBe(false);
    expect(row.ok ? [] : row.errors.join(' ')).toContain('«casa matriz», «sucursal», «por defecto»');
  });

  it('dos casas matrices en el archivo: la segunda no entra y nombra la línea de la primera', () => {
    const review = reviewBranchCsv(
      'nombre;categoria\nCentral;casa matriz\nOtra;casa matriz\n',
      [],
      { withCategory: true },
    );
    expect(validDrafts(review).map((d) => d.name)).toEqual(['Central']);
    const second = review.rows[1];
    expect(second.ok ? '' : second.errors.join(' ')).toContain('línea 2');
  });

  it('si la organización ya tiene casa matriz, ninguna fila puede serlo', () => {
    const review = reviewBranchCsv('nombre;categoria\nNueva;casa matriz\n', [], {
      withCategory: true,
      headOfficeName: 'Casa central',
    });
    const row = review.rows[0];
    expect(row.ok ? '' : row.errors.join(' ')).toContain('«Casa central»');
  });

  it('sin la opción (altas), la columna se ignora y las filas no llevan categoría', () => {
    const review = reviewBranchCsv('nombre;categoria\nNorte;casa matriz\n');
    expect(review.ignoredColumns).toEqual(['categoria']);
    expect(validDrafts(review)[0].category).toBeUndefined();
  });

  it('la plantilla suma la columna sólo con la opción', () => {
    expect(branchImportColumns(false).map((c) => c.header)).not.toContain('categoria');
    expect(branchImportColumns(true).map((c) => c.header).at(-1)).toBe('categoria');
  });
});
