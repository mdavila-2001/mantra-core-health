import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PharmacyBulkClient } from './pharmacy-bulk.client';
import type { BulkProgress, BulkResponse, BulkRowResult } from './pharmacy-bulk.types';

const PHARMACY_ID = '7f1c9a52-6d3e-4b18-9c47-2a5e8f0b1d63';

/** Lo que el servidor contesta a un lote: una fila por fila, `row` desde 1. */
function answer(count: number, dryRun = false): BulkResponse {
  return {
    dryRun,
    results: Array.from({ length: count }, (_, i): BulkRowResult => ({ row: i + 1, outcome: 'CREATED' })),
  };
}

describe('PharmacyBulkClient', () => {
  let client: PharmacyBulkClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(PharmacyBulkClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it.each(['categories', 'products', 'prices', 'sites'] as const)(
    'manda %s por POST a su ruta /bulk con modo, dryRun y filas',
    (entity) => {
      let response: BulkResponse | null = null;
      client
        .bulk(PHARMACY_ID, entity, { mode: 'UPSERT', dryRun: true, rows: [{ name: 'Vitaminas' }] })
        .subscribe((value) => (response = value));

      const req = http.expectOne(`/pharmacies/${PHARMACY_ID}/${entity}/bulk`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ mode: 'UPSERT', dryRun: true, rows: [{ name: 'Vitaminas' }] });
      req.flush(answer(1, true));

      expect(response).toEqual(answer(1, true));
    },
  );

  it('el stock de una sucursal va a su ruta …/sites/:siteId/availability/bulk, con el mismo contrato y en lotes', () => {
    const SITE_ID = '1b2c3d4e-0000-4000-8000-000000000001';
    let response: BulkResponse | null = null;
    const rows = Array.from({ length: 300 }, (_, i) => ({ productCode: `P-${i}`, available: true }));
    client
      .bulkAll(PHARMACY_ID, { siteAvailability: SITE_ID }, { mode: 'UPSERT', dryRun: true, rows })
      .subscribe((value) => (response = value));

    const url = `/pharmacies/${PHARMACY_ID}/sites/${SITE_ID}/availability/bulk`;
    const first = http.expectOne(url);
    expect(first.request.body).toEqual({ mode: 'UPSERT', dryRun: true, rows: rows.slice(0, 250) });
    first.flush(answer(250, true));
    const second = http.expectOne(url);
    expect(second.request.body.rows).toHaveLength(50);
    second.flush(answer(50, true));

    expect(response!.results).toHaveLength(300);
    expect(response!.results[299]!.row).toBe(300);
  });

  it('sin dryRun no declara la clave: la API escribe', () => {
    client.bulk(PHARMACY_ID, 'prices', { mode: 'UPDATE', rows: [{ productCode: 'A', unitPrice: '3' }] }).subscribe();

    const req = http.expectOne(`/pharmacies/${PHARMACY_ID}/prices/bulk`);
    expect(req.request.body).toEqual({ mode: 'UPDATE', rows: [{ productCode: 'A', unitPrice: '3' }] });
    req.flush(answer(1));
  });

  it('600 filas salen en tres pedidos de 250, 250 y 100, uno detrás del otro, y los resultados se unen con la fila corrida', () => {
    const rows = Array.from({ length: 600 }, (_, i) => ({ name: `C-${i + 1}` }));
    const emitted: BulkProgress[] = [];
    let merged: BulkResponse | null = null;
    client.chunked(PHARMACY_ID, 'categories', { mode: 'CREATE', rows }).subscribe((p) => emitted.push(p));
    const url = `/pharmacies/${PHARMACY_ID}/categories/bulk`;

    const first = http.expectOne(url);
    expect(first.request.body.rows).toHaveLength(250);
    expect(first.request.body.rows[0]).toEqual({ name: 'C-1' });
    // En serie: el segundo no salió todavía.
    http.expectNone(url);
    first.flush(answer(250));

    const second = http.expectOne(url);
    expect(second.request.body.rows).toHaveLength(250);
    expect(second.request.body.rows[0]).toEqual({ name: 'C-251' });
    http.expectNone(url);
    second.flush(answer(250));

    const third = http.expectOne(url);
    expect(third.request.body.rows).toHaveLength(100);
    expect(third.request.body.rows[99]).toEqual({ name: 'C-600' });
    third.flush(answer(100));

    expect(emitted.map((p) => p.results.length)).toEqual([250, 500, 600]);
    const last = emitted.at(-1)!;
    expect(last.total).toBe(600);
    expect(last.results.map((r) => r.row)).toEqual(Array.from({ length: 600 }, (_, i) => i + 1));

    // `bulkAll` entrega sólo el resultado final, ya unido.
    client.bulkAll(PHARMACY_ID, 'categories', { mode: 'CREATE', rows: rows.slice(0, 260) }).subscribe(
      (value) => (merged = value),
    );
    http.expectOne(url).flush(answer(250));
    http.expectOne(url).flush({ dryRun: false, results: [{ row: 10, outcome: 'REJECTED', errors: [] }] });
    expect(merged!.results).toHaveLength(251);
    expect(merged!.results.at(-1)).toEqual({ row: 260, outcome: 'REJECTED', errors: [] });
  });

  it('«proceed» se mira antes de cada lote: el que está en vuelo termina y no sale el siguiente', () => {
    const rows = Array.from({ length: 300 }, (_, i) => ({ name: `C-${i}` }));
    let go = true;
    let completed = false;
    const emitted: BulkProgress[] = [];
    client
      .chunked(PHARMACY_ID, 'categories', { mode: 'CREATE', rows }, { proceed: () => go })
      .subscribe({ next: (p) => emitted.push(p), complete: () => (completed = true) });

    const inFlight = http.expectOne(`/pharmacies/${PHARMACY_ID}/categories/bulk`);
    go = false;
    expect(inFlight.cancelled).toBe(false);
    inFlight.flush(answer(250));

    http.expectNone(`/pharmacies/${PHARMACY_ID}/categories/bulk`);
    expect(completed).toBe(true);
    expect(emitted.at(-1)!.results).toHaveLength(250);
  });

  it('un lote que falla corta la carga con el error y no manda los siguientes', () => {
    const rows = Array.from({ length: 300 }, (_, i) => ({ name: `C-${i}` }));
    let status = 0;
    const emitted: BulkProgress[] = [];
    client.chunked(PHARMACY_ID, 'categories', { mode: 'CREATE', rows }).subscribe({
      next: (p) => emitted.push(p),
      error: (error: { status: number }) => (status = error.status),
    });

    http
      .expectOne(`/pharmacies/${PHARMACY_ID}/categories/bulk`)
      .flush({ statusCode: 413, message: 'request entity too large' }, { status: 413, statusText: 'Payload Too Large' });

    expect(status).toBe(413);
    expect(emitted).toEqual([]);
    http.expectNone(`/pharmacies/${PHARMACY_ID}/categories/bulk`);
  });
});
