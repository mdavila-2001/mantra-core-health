import { ArchivoInvalido } from '../../catalog-rules/catalog.rules';
import { ENTITY_COLUMNS, ENTITY_TEMPLATE_ROWS, readEntityCsv } from './entity-csv';

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
});
