import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { EquipmentLocationClient } from '../diagnostic-units/equipment-location.client';
import { InventoryLocationsClient } from '../pharmacy/inventory-locations.client';
import { InfrastructureItemsClient } from './infrastructure-items.client';

/*
 * Fixtures de contrato (M7) de F5a/F5c/F5f, copiados de la API:
 * `space-accounting.service.ts` (`itemRows`, `costCenterRows`),
 * `EquipmentResponseDto` (PATCH plano) y las respuestas del inventario
 * (`create → {id}`, `relocate → {id, careSpaceId, previousCareSpaceId}`).
 */
const ITEM_ROW = {
  id: 'it-1',
  practiceId: 'pr-1',
  code: '',
  name: 'Lámpara cialítica LED',
  category: 'Equipo médico',
  careSpace: { id: 'qx-2', code: 'QX-02', name: 'Quirófano 2', path: 'Edificio A › Quirófano 2' },
  locationText: null,
  bookValue: '64000.00',
  currencyCode: '',
  rowVersion: 4,
};

describe('contrato de F5a/F5c/F5f con la API', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('activos: la fila trae rowVersion y ubicar la manda en If-Match (M2)', () => {
    const client = TestBed.inject(InfrastructureItemsClient);
    let rows: unknown = null;
    client.listItems('pr-1').subscribe((r) => (rows = r));
    http.expectOne('/accounting/infrastructure-items?practiceId=pr-1').flush([ITEM_ROW]);
    expect(rows).toEqual([ITEM_ROW]);
    client.locateItem('it-1', 'qx-2', ITEM_ROW.rowVersion).subscribe();
    const req = http.expectOne('/accounting/infrastructure-items/it-1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.headers.get('If-Match')).toBe('"4"');
    expect(req.request.body).toEqual({ careSpaceId: 'qx-2' });
    req.flush({ ...ITEM_ROW, rowVersion: 5 });
  });

  it('equipo: el PATCH devuelve el DTO plano (la ficha relee la lista de la sede)', () => {
    const client = TestBed.inject(EquipmentLocationClient);
    let r: unknown = null;
    client.update('eq-1', { careSpaceId: 'img-rx', aeTitle: 'SLUS01' }).subscribe((x) => (r = x));
    const plano = { id: 'eq-1', diagnosticUnitSiteId: 'du-1', operationalStatus: 'DU_EQ_OPERATIONAL', careSpaceId: 'img-rx', aeTitle: 'SLUS01', stationName: null };
    http.expectOne('/diagnostic-equipment/eq-1').flush(plano);
    expect(r).toEqual(plano);
  });

  it('equipo: detalle (LocatedEquipment con rowVersion), recurso {equipmentId, resourceId} y MWL', () => {
    const client = TestBed.inject(EquipmentLocationClient);
    const seen: unknown[] = [];
    const detalle = { id: 'eq-1', siteId: 's-1', diagnosticUnitSiteName: 'Imagen', type: { code: 'EQ_US', display: 'Ecógrafo' }, manufacturer: 'GE', model: 'E10', serialNumber: 'X', modality: { code: 'US', display: 'Ultrasonido' }, operationalStatus: { code: 'DU_EQ_OPERATIONAL', display: 'Operativo' }, careSpace: null, aeTitle: null, stationName: null, schedulableResourceId: null, rowVersion: 2 };
    client.get('eq-1').subscribe((x) => seen.push(x));
    http.expectOne('/diagnostic-equipment/eq-1').flush(detalle);
    client.createResource('eq-1').subscribe((x) => seen.push(x));
    http.expectOne('/diagnostic-equipment/eq-1/resource').flush({ equipmentId: 'eq-1', resourceId: 'res-1' });
    client.getMwlStation('eq-1').subscribe((x) => seen.push(x));
    http.expectOne('/diagnostic-equipment/eq-1/mwl-station').flush({ scheduledStationAETitle: null, scheduledStationName: null, spsLocation: null });
    expect(seen).toEqual([detalle, { equipmentId: 'eq-1', resourceId: 'res-1' }, { scheduledStationAETitle: null, scheduledStationName: null, spsLocation: null }]);
  });

  it('stock: crear devuelve {id}; reubicar, los dos espacios (M5)', () => {
    const client = TestBed.inject(InventoryLocationsClient);
    const seen: unknown[] = [];
    client.create('ph-1', { code: 'BOT-P3', name: 'Botiquín', locationTypeCode: 'WARD_STOCK', careSpaceId: 'bot', clinicalUnitId: 'u-1' }).subscribe((x) => seen.push(x));
    http.expectOne('/pharmacy/ph-1/inventory-locations').flush({ id: 'loc-1' });
    client.relocate('loc-1', 'bot-2').subscribe((x) => seen.push(x));
    http.expectOne('/pharmacy/inventory-locations/loc-1/relocate').flush({ id: 'loc-1', careSpaceId: 'bot-2', previousCareSpaceId: 'bot' });
    expect(seen).toEqual([{ id: 'loc-1' }, { id: 'loc-1', careSpaceId: 'bot-2', previousCareSpaceId: 'bot' }]);
  });
});
