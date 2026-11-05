import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { PharmacyIntegrationClient } from './pharmacy-integration.client';
import type { SyncResult } from './pharmacy-integration.types';

/** Verbo, ruta y cuerpo de las llamadas de la pestaña «Integración». */
const PHARMACY = '7f1c9a52-6d3e-4b18-9c47-2a5e8f0b1d63';
const CONNECTION = 'c1f20f08-4bbf-47f2-8e8e-7a238cde42ba';
const BASE = `/pharmacies/${PHARMACY}/integration-connections`;

describe('PharmacyIntegrationClient', () => {
  let client: PharmacyIntegrationClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    client = TestBed.inject(PharmacyIntegrationClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista las conexiones de la farmacia', () => {
    let configured: boolean | null = null;
    client.listConnections(PHARMACY).subscribe((list) => (configured = list.providerConfigured));

    const req = http.expectOne(BASE);
    expect(req.request.method).toBe('GET');
    req.flush({ providerConfigured: true, items: [] });

    expect(configured).toBe(true);
  });

  it('da de alta la conexión por lotes con consulta de stock y la sucursal elegida', () => {
    client
      .createConnection(PHARMACY, {
        integrationMode: 'BATCH',
        supportsStockQuery: true,
        pharmacySiteId: '77fba9cc-93b1-4c7c-89f8-79d21f5dcf53',
      })
      .subscribe();

    const req = http.expectOne(BASE);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      integrationMode: 'BATCH',
      supportsStockQuery: true,
      pharmacySiteId: '77fba9cc-93b1-4c7c-89f8-79d21f5dcf53',
    });
    req.flush({ id: CONNECTION }, { status: 201, statusText: 'Created' });
  });

  it('sin sucursal no manda la clave: la conexión vale para todas', () => {
    client.createConnection(PHARMACY, { integrationMode: 'BATCH', supportsStockQuery: true }).subscribe();

    const req = http.expectOne(BASE);
    expect(req.request.body).toEqual({ integrationMode: 'BATCH', supportsStockQuery: true });
    expect(req.request.body).not.toHaveProperty('pharmacySiteId');
    req.flush({ id: CONNECTION });
  });

  it('lista los vínculos de una conexión', () => {
    client.listMappings(PHARMACY, CONNECTION).subscribe();

    const req = http.expectOne(`${BASE}/${CONNECTION}/product-mappings`);
    expect(req.request.method).toBe('GET');
    req.flush({ items: [] });
  });

  it('vincula un producto sin mandar los opcionales vacíos', () => {
    client
      .createMapping(PHARMACY, CONNECTION, {
        pharmacyProductId: 'd9cd922f-c25e-4a2e-99ac-cb8828afebec',
        externalProductCode: 'ERP-0003',
        externalUnitCode: '',
      })
      .subscribe();

    const req = http.expectOne(`${BASE}/${CONNECTION}/product-mappings`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      pharmacyProductId: 'd9cd922f-c25e-4a2e-99ac-cb8828afebec',
      externalProductCode: 'ERP-0003',
    });
    req.flush({ id: 'm-1', pharmacyProductId: 'd9cd922f-c25e-4a2e-99ac-cb8828afebec', externalProductCode: 'ERP-0003' });
  });

  it('lee el catálogo del sistema de la farmacia', () => {
    client.listExternalProducts(PHARMACY, CONNECTION).subscribe();

    const req = http.expectOne(`${BASE}/${CONNECTION}/external-products`);
    expect(req.request.method).toBe('GET');
    req.flush({ items: [] });
  });

  it('pide los últimos lotes con `limit`, acotado a 1..20', () => {
    client.listSyncBatches(PHARMACY, CONNECTION).subscribe();
    client.listSyncBatches(PHARMACY, CONNECTION, 50).subscribe();
    client.listSyncBatches(PHARMACY, CONNECTION, 0).subscribe();

    const reqs = http.match((r) => r.url === `${BASE}/${CONNECTION}/sync-batches`);
    expect(reqs.map((req) => req.request.method)).toEqual(['GET', 'GET', 'GET']);
    expect(reqs.map((req) => req.request.params.get('limit'))).toEqual(['5', '20', '1']);
    reqs.forEach((req) => req.flush({ items: [] }));
  });

  it('sincroniza con un POST y devuelve el resumen', () => {
    let result: SyncResult | null = null;
    client.sync(PHARMACY, CONNECTION).subscribe((value) => (result = value));

    const req = http.expectOne(`${BASE}/${CONNECTION}/sync`);
    expect(req.request.method).toBe('POST');
    const body: SyncResult = {
      batchId: 'b-1',
      received: 12,
      mapped: 2,
      unmapped: [{ externalCode: 'ERP-0003', name: 'Amoxicilina 500 mg' }],
      applied: 2,
    };
    req.flush(body);

    expect(result).toEqual(body);
  });

  it('codifica los identificadores en la ruta', () => {
    client.listMappings('a/b', 'c d').subscribe();

    http.expectOne('/pharmacies/a%2Fb/integration-connections/c%20d/product-mappings').flush({ items: [] });
  });

  it('corrige un vínculo con PATCH y sólo lo que cambia; `null` borra la unidad', () => {
    client
      .updateMapping(PHARMACY, CONNECTION, 'm 1', {
        pharmacyProductId: undefined,
        externalProductCode: 'ERP-0009',
        externalUnitCode: null,
      })
      .subscribe();

    const req = http.expectOne(`${BASE}/${CONNECTION}/product-mappings/m%201`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ externalProductCode: 'ERP-0009', externalUnitCode: null });
    req.flush({ id: 'm 1', pharmacyProductId: 'p-a', externalProductCode: 'ERP-0009', externalUnitCode: null });
  });

  it('deshace un vínculo con DELETE', () => {
    let removed: string | null = null;
    client.deleteMapping(PHARMACY, CONNECTION, 'm-1').subscribe((mapping) => (removed = mapping.externalProductCode));

    const req = http.expectOne(`${BASE}/${CONNECTION}/product-mappings/m-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ id: 'm-1', pharmacyProductId: 'p-a', externalProductCode: 'ERP-0001', externalUnitCode: 'BOX' });

    expect(removed).toBe('ERP-0001');
  });

  it('guarda el sistema de la farmacia con PUT y la clave solo en el cuerpo (FAR-C9)', () => {
    client
      .saveSystem(PHARMACY, CONNECTION, {
        format: 'SIMULATED_CHAIN',
        baseUrl: '  http://simulador:4100/simulated-chain/api/v2 ',
        externalPharmacyCode: ' CHAIN-1 ',
        apiKey: ' clave con espacios ',
      })
      .subscribe();

    const req = http.expectOne(`${BASE}/${CONNECTION}/external-system`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.urlWithParams).not.toContain('clave');
    // La clave viaja tal cual: un espacio puede ser parte de ella.
    expect(req.request.body).toEqual({
      format: 'SIMULATED_CHAIN',
      baseUrl: 'http://simulador:4100/simulated-chain/api/v2',
      externalPharmacyCode: 'CHAIN-1',
      apiKey: ' clave con espacios ',
    });
    req.flush({ system: null, probe: 'OK' });
  });

  it('prueba el sistema con POST …/external-system/test y lo quita con DELETE', () => {
    let source: string | null = null;
    client.probeSystem(PHARMACY, CONNECTION).subscribe((probe) => (source = probe.source));
    const probe = http.expectOne(`${BASE}/${CONNECTION}/external-system/test`);
    expect(probe.request.method).toBe('POST');
    probe.flush({ status: 'OK', source: 'PHARMACY' });
    expect(source).toBe('PHARMACY');

    client.removeSystem(PHARMACY, CONNECTION).subscribe();
    const remove = http.expectOne(`${BASE}/${CONNECTION}/external-system`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null, { status: 204, statusText: 'No Content' });
  });
});
