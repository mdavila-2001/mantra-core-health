import type { BulkPriceRow } from '../../../../core/data-access/pharmacy/pharmacy-bulk.types';
import { ArchivoInvalido } from '../../catalog-rules/catalog.rules';
import { ENTITY_COLUMNS, ENTITY_TEMPLATE_ROWS, readEntityCsv, upsertKeyOf } from './entity-csv';

describe('entity-csv', () => {
  it('los encabezados de cada plantilla van en castellano', () => {
    expect(ENTITY_COLUMNS.categories.map((column) => column.header)).toEqual(['nombre']);
    expect(ENTITY_COLUMNS.prices.map((column) => column.header)).toEqual(['codigo', 'precio']);
    expect(ENTITY_COLUMNS.sites.map((column) => column.header)).toEqual([
      'codigo',
      'nombre',
      'direccion',
      'latitud',
      'longitud',
      'retiro',
      'envio',
    ]);
    // Cada fila de ejemplo tiene una celda por columna.
    for (const entity of ['categories', 'prices', 'sites'] as const) {
      for (const row of ENTITY_TEMPLATE_ROWS[entity]) {
        expect(row).toHaveLength(ENTITY_COLUMNS[entity].length);
      }
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

  it('precios: acepta la coma decimal y frena un importe que no es un número', () => {
    const reading = readEntityCsv('prices', 'codigo,precio\nP-1,"12,50"\nP-2,3\nP-3,doce\nP-4,\n');

    expect(reading.rows.map((row) => row.payload)).toEqual([
      { productCode: 'P-1', unitPrice: 12.5 },
      { productCode: 'P-2', unitPrice: 3 },
      null,
      { productCode: 'P-4', unitPrice: '' },
    ]);
    expect(reading.rows[2]!.errors[0]).toContain('El precio va en Bs');
  });

  it('sucursales: lee si/no, coordenadas con coma y omite lo vacío', () => {
    const reading = readEntityCsv(
      'sites',
      [
        'codigo;nombre;direccion;latitud;longitud;retiro;envio',
        'SUR;Sucursal Sur;Av. Ejemplo 123;-17,78;-63,18;si;no',
        'NORTE;Sucursal Norte;;;;Sí;',
        'MAL;Mala;;norte;;quizá;',
      ].join('\n'),
    );

    expect(reading.rows[0]!.payload).toEqual({
      code: 'SUR',
      name: 'Sucursal Sur',
      addressLines: 'Av. Ejemplo 123',
      latitude: -17.78,
      longitude: -63.18,
      pickupAvailable: true,
      homeDeliveryAvailable: false,
    });
    expect(reading.rows[1]!.payload).toEqual({ code: 'NORTE', name: 'Sucursal Norte', pickupAvailable: true });
    expect(reading.rows[2]!.payload).toBeNull();
    expect(reading.rows[2]!.errors).toEqual([
      'La latitud tiene que ser un número, con punto o coma decimal.',
      '«retiro» se responde con si o no.',
    ]);
  });

  it('sin una columna obligatoria el archivo no se usa', () => {
    expect(() => readEntityCsv('prices', 'codigo\nP-1\n')).toThrow(ArchivoInvalido);
    expect(() => readEntityCsv('prices', 'codigo\nP-1\n')).toThrow('Falta la columna «precio»');
    expect(() => readEntityCsv('sites', 'codigo,direccion\nS,x\n')).toThrow('Falta la columna «nombre»');
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

    it('precios: el mismo código dos veces; el código distingue mayúsculas, como el servidor', () => {
      const reading = readEntityCsv('prices', 'codigo,precio\nP-1,10\np-1,11\n P-1 ,12\nP-2,3\n');

      expect(reading.rows.map((row) => (row.payload as BulkPriceRow | null)?.unitPrice ?? null)).toEqual([
        null,
        11,
        null,
        3,
      ]);
    });

    it('sucursales: el mismo código dos veces', () => {
      const reading = readEntityCsv('sites', 'codigo;nombre\nSUR;Sur\nNORTE;Norte\nSUR;Sur renombrada\n');

      expect(reading.rows.map((row) => row.payload === null)).toEqual([true, false, true]);
    });

    it('una fila que no sale (precio ilegible) no cuenta: la otra con ese código sí se envía', () => {
      const reading = readEntityCsv('prices', 'codigo,precio\nP-1,doce\nP-1,12\n');

      expect(reading.rows[0]!.payload).toBeNull();
      expect(reading.rows[0]!.repeatedOnLines).toBeUndefined();
      expect(reading.rows[1]!.payload).toEqual({ productCode: 'P-1', unitPrice: 12 });
    });

    it('la clave de cada tipo es la que usa el servidor', () => {
      expect(upsertKeyOf('categories', { name: ' Niños   y Niñas ' })).toBe('ninos y ninas');
      expect(upsertKeyOf('prices', { productCode: ' AB-1 ', unitPrice: 1 })).toBe('AB-1');
      expect(upsertKeyOf('sites', { code: 'Sur', name: 'x' })).toBe('Sur');
      expect(upsertKeyOf('sites', { code: '  ', name: 'x' })).toBeNull();
    });
  });
});
