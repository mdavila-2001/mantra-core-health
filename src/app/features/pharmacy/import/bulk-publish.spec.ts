import { HttpErrorResponse } from '@angular/common/http';
import { of, type Observable } from 'rxjs';

import type { PharmacyBulkClient } from '../../../core/data-access/pharmacy/pharmacy-bulk.client';
import type { BulkProgress, BulkRequest } from '../../../core/data-access/pharmacy/pharmacy-bulk.types';
import { readCsv, reviewLoad } from '../catalog-rules/catalog.rules';
import {
  BULK_MODE_OF,
  bulkFailureMessage,
  bulkRowMessage,
  countOutcomes,
  productBulkRow,
  productResultRows,
  sendProducts,
  toFileRows,
  type ReadyRow,
} from './bulk-publish';

/** Revisa un CSV contra un catálogo con `PAR-500` y devuelve las filas. */
function reviewed(csv: string) {
  return reviewLoad(readCsv(csv).filas, new Map([['PAR-500', 'p-1']]), 'CREAR_Y_ACTUALIZAR', ['Ortopedia']);
}

const CSV = [
  'codigo;marca;generico;receta;codigo_barras;cadena_frio;precio;categoria;descripcion',
  'A-1;Uno;;no;7501031311309;sí;12,5;ortopedia;',
  'PAR-500;Ya está;;;;;;;',
  ';Sin código;;;;;;;',
].join('\n');

describe('bulk-publish', () => {
  it('lleva el modo del asistente al de la API', () => {
    expect(BULK_MODE_OF).toEqual({ CREAR_Y_ACTUALIZAR: 'UPSERT', SOLO_CREAR: 'CREATE', SOLO_ACTUALIZAR: 'UPDATE' });
  });

  it('un alta viaja con los campos del alta, sin vacíos; un cambio, sólo con lo que trae la fila y su código', () => {
    const [created, updated] = reviewed(CSV).filter((row): row is ReadyRow => row.lista);

    expect(productBulkRow(created!)).toEqual({
      productCode: 'A-1',
      brandName: 'Uno',
      requiresPrescription: false,
      coldChainRequired: true,
      identifiers: [{ identifierType: 'GTIN', identifierValue: '7501031311309' }],
      unitPrice: 12.5,
      category: 'Ortopedia',
      inStock: true,
    });
    // El cambio no lleva lo que sólo admite el alta, ni borra lo que la fila dejó vacío.
    expect(productBulkRow(updated!)).toEqual({ productCode: 'PAR-500', brandName: 'Ya está', inStock: true });
  });

  it('sendProducts manda las filas listas por la carga masiva y devuelve el resultado con la línea del archivo', () => {
    const ready = reviewed(CSV).filter((row): row is ReadyRow => row.lista);
    const calls: { entity: string; request: BulkRequest; proceed?: () => boolean }[] = [];
    const client = {
      chunked: (_: string, entity: string, request: BulkRequest, options: { proceed?: () => boolean }) => {
        calls.push({ entity, request, ...options });
        return of<BulkProgress>({
          dryRun: true,
          total: 2,
          results: [
            { row: 1, outcome: 'CREATED' },
            { row: 2, outcome: 'REJECTED', errors: [{ field: 'productCode', reason: 'PRODUCT_RETIRED' }] },
          ],
        }) as Observable<BulkProgress>;
      },
    } as unknown as PharmacyBulkClient;

    let results: unknown;
    sendProducts(client, 'f-1', 'SOLO_CREAR', ready, { dryRun: true }).subscribe((value) => (results = value));

    expect(calls).toHaveLength(1);
    expect(calls[0]!.entity).toBe('products');
    expect(calls[0]!.request.mode).toBe('CREATE');
    expect(calls[0]!.request.dryRun).toBe(true);
    expect(calls[0]!.request.rows).toHaveLength(2);
    // Las líneas del archivo: el encabezado es la 1.
    expect(results).toEqual([
      { number: 2, outcome: 'CREATED', message: '' },
      { number: 3, outcome: 'REJECTED', message: 'El producto de ese código está retirado.' },
    ]);
  });

  it('sin dryRun no declara la clave', () => {
    const ready = reviewed('codigo;marca\nA-1;Uno\n').filter((row): row is ReadyRow => row.lista);
    let request: BulkRequest | null = null;
    const client = {
      chunked: (_: string, __: string, value: BulkRequest) => {
        request = value;
        return of<BulkProgress>({ dryRun: false, total: 1, results: [] });
      },
    } as unknown as PharmacyBulkClient;

    sendProducts(client, 'f-1', 'CREAR_Y_ACTUALIZAR', ready).subscribe();

    expect(request).toEqual({ mode: 'UPSERT', rows: [{ productCode: 'A-1', brandName: 'Uno', inStock: true }] });
  });

  it('el motivo de un rechazo es el mensaje de la API; sin él, el de su código o el campo', () => {
    expect(
      bulkRowMessage({
        row: 1,
        outcome: 'REJECTED',
        errors: [
          { field: 'name', reason: 'REQUIRED', message: 'Falta el nombre' },
          { field: 'code', reason: 'DUPLICATE_IN_FILE' },
          { field: 'latitude', reason: 'COORDINATES_INCOMPLETE' },
        ],
      }),
    ).toBe('Falta el nombre La clave aparece más de una vez en el archivo. latitude: COORDINATES_INCOMPLETE');
    expect(bulkRowMessage({ row: 1, outcome: 'REJECTED' })).toBe('El servidor rechazó la fila.');
  });

  it('cuenta los resultados y deja vacío el motivo de lo que no se rechazó', () => {
    const rows = toFileRows([5, 9, 12], [
      { row: 1, outcome: 'CREATED' },
      { row: 2, outcome: 'UNCHANGED' },
      { row: 3, outcome: 'REJECTED', errors: [{ field: 'x', reason: 'NOT_FOUND' }] },
    ]);
    expect(rows.map((row) => row.number)).toEqual([5, 9, 12]);
    expect(rows.map((row) => row.message)).toEqual(['', '', 'No existe: eligió sólo actualizar.']);
    expect(countOutcomes(rows)).toEqual({ created: 1, updated: 0, unchanged: 1, rejected: 1 });
  });

  it('el medicamento por su nombre viaja en el alta y en el cambio; vacío, no viaja', () => {
    const rows = reviewed(
      [
        'codigo;generico;receta;medicamento',
        'AMX;Amoxicilina;sí;Amoxicilina',
        'PAR-500;Paracetamol;;Paracetamol',
        'B-1;Otro;no;',
      ].join('\n'),
    ).filter((row): row is ReadyRow => row.lista);

    expect(productBulkRow(rows[0]!)).toMatchObject({ productCode: 'AMX', medicationName: 'Amoxicilina' });
    expect(productBulkRow(rows[1]!)).toEqual({
      productCode: 'PAR-500',
      genericName: 'Paracetamol',
      inStock: true,
      medicationName: 'Paracetamol',
    });
    expect('medicationName' in productBulkRow(rows[2]!)).toBe(false);
  });

  it('una fila que se carga con un aviso lo lleva como motivo, para que se vea en la tabla', () => {
    const rows = toFileRows([3, 4], [
      {
        row: 1,
        outcome: 'CREATED',
        warnings: [{ field: 'medicationConceptId', reason: 'MEDICATION_NOT_LINKED', message: 'Pide receta sin medicamento' }],
      },
      { row: 2, outcome: 'UPDATED', warnings: [{ field: 'medicationConceptId', reason: 'MEDICATION_NOT_LINKED' }] },
    ]);

    expect(rows.map((row) => row.message)).toEqual([
      'Pide receta sin medicamento',
      'Pide receta y no tiene medicamento vinculado: ninguna receta lo encuentra.',
    ]);
  });

  it('un 413 se dice como tamaño; lo demás, con el mensaje de la farmacia', () => {
    expect(bulkFailureMessage(new HttpErrorResponse({ status: 413 }))).toContain('pasó de 1 MB');
    expect(bulkFailureMessage(new HttpErrorResponse({ status: 0 }))).toContain('Sin conexión');
  });

  it('el resultado por línea: lo que dijo el servidor, «no enviada» o «sin enviar»', () => {
    const rows = reviewed(CSV);
    const result = productResultRows(rows, [{ number: 2, outcome: 'CREATED', message: '' }]);

    expect(result.map((row) => [row.number, row.code, row.outcome])).toEqual([
      [2, 'A-1', 'CREATED'],
      [3, 'PAR-500', 'PENDING'],
      [4, '', 'NOT_SENT'],
    ]);
    expect(result[2]!.name).toBe('Sin código');
  });
});
