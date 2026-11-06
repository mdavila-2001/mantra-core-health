import { ArchivoInvalido } from '../../catalog-rules/catalog.rules';
import { ENTITY_COLUMNS, ENTITY_TEMPLATE_ROWS, readEntityCsv, upsertKeyOf } from './entity-csv';

describe('entity-csv', () => {
  it('la plantilla de categorías va en castellano, con una celda por columna', () => {
    expect(ENTITY_COLUMNS.categories.map((column) => column.header)).toEqual(['nombre']);
    for (const row of ENTITY_TEMPLATE_ROWS.categories) {
      expect(row).toHaveLength(ENTITY_COLUMNS.categories.length);
    }
  });

  it('categorías: una fila por nombre; el nombre vacío viaja igual y lo rechaza el servidor', () => {
    const reading = readEntityCsv('categories', 'Nombre;nota\nVitaminas;\n;fila sin nombre\n');

    expect(reading.ignored).toEqual(['nota']);
    expect(reading.rows).toEqual([
      { line: 2, key: 'Vitaminas', payload: { name: 'Vitaminas' }, errors: [] },
      { line: 3, key: '', payload: { name: '' }, errors: [] },
    ]);
  });

  it('sin una columna obligatoria el archivo no se usa', () => {
    expect(() => readEntityCsv('categories', 'categoria\nVitaminas\n')).toThrow(ArchivoInvalido);
    expect(() => readEntityCsv('categories', 'categoria\nVitaminas\n')).toThrow('Falta la columna «nombre»');
  });

  it('admite hasta 1000 filas, el tope de la API por pedido', () => {
    const rows = Array.from({ length: 1000 }, (_, i) => `C-${i}`);
    expect(readEntityCsv('categories', ['nombre', ...rows].join('\n')).rows).toHaveLength(1000);
    expect(() => readEntityCsv('categories', ['nombre', ...rows, 'otra'].join('\n'))).toThrow(ArchivoInvalido);
  });

  describe('clave repetida en el archivo (también entre lotes de 250)', () => {
    it('categorías: 600 filas con una clave en la línea 7 y en la 402 (otro lote): no se manda ninguna de las dos', () => {
      const names = Array.from({ length: 600 }, (_, i) => `far45-cx-${String(i + 1).padStart(4, '0')}`);
      names[400] = 'FAR45-CX-0006'; // línea 402: segundo lote; repite la línea 7
      const reading = readEntityCsv('categories', ['nombre', ...names].join('\n'));

      const repeated = reading.rows.filter((row) => row.repeatedOnLines !== undefined);
      expect(repeated.map((row) => row.line)).toEqual([7, 402]);
      for (const row of repeated) {
        expect(row).toMatchObject({
          payload: null,
          repeatedOnLines: [7, 402],
          errors: ['La misma clave está en las líneas 7, 402: no se envía ninguna. Deje una sola.'],
        });
      }
      expect(reading.rows.filter((row) => row.payload !== null)).toHaveLength(598);
    });

    it('categorías: se comparan sin mayúsculas, tildes ni espacios de más', () => {
      const reading = readEntityCsv(
        'categories',
        'nombre\nAnalgésicos\n  analgesicos \nANALGÉSICOS\nAnalgesicos  extra\nOtra\n',
      );

      expect(reading.rows.map((row) => row.payload === null)).toEqual([true, true, true, false, false]);
      expect(reading.rows[0]!.repeatedOnLines).toEqual([2, 3, 4]);
    });

    it('categorías: dos nombres vacíos o de más de 60 caracteres no son «repetidos»: los rechaza el servidor', () => {
      const long = 'x'.repeat(61);
      const reading = readEntityCsv('categories', `nombre;nota\n;a\n;b\n${long};\n${long};\n`);

      expect(reading.rows.every((row) => row.payload !== null && row.repeatedOnLines === undefined)).toBe(true);
    });

    it('la clave es la que usa el servidor', () => {
      expect(upsertKeyOf({ name: ' Niños   y Niñas ' })).toBe('ninos y ninas');
      expect(upsertKeyOf({ name: '  ' })).toBeNull();
    });
  });
});
