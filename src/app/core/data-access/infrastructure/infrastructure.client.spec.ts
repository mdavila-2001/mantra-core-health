import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { InfrastructureClient } from './infrastructure.client';
import type { RetireCheck } from './infrastructure.types';

describe('InfrastructureClient', () => {
  let client: InfrastructureClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(InfrastructureClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('pide el catálogo a la ruta del contrato', () => {
    client.getCatalog().subscribe();
    const req = http.expectOne('/practice/infrastructure-catalog');
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('pide la estructura del establecimiento escapando el id', () => {
    client.getStructure('sede/1').subscribe();
    http.expectOne('/sites/sede%2F1/structure').flush({});
  });

  it('crea un espacio con POST al establecimiento', () => {
    client.createCareSpace('s1', { code: '301', name: 'Hab 301', formCode: 'LOC_FORM_ROOM', functionCode: 'SPACE_FN_INPATIENT_ROOM' }).subscribe();
    const req = http.expectOne('/sites/s1/care-spaces');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.code).toBe('301');
    req.flush({});
  });

  it('manda If-Match con el rowVersion en PATCH, move y lifecycle', () => {
    client.updateCareSpace('e1', 4, { name: 'Nuevo' }).subscribe();
    const patch = http.expectOne('/care-spaces/e1');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.headers.get('If-Match')).toBe('4');
    patch.flush({});

    client.moveCareSpace('e1', 5, null).subscribe();
    const move = http.expectOne('/care-spaces/e1/move');
    expect(move.request.headers.get('If-Match')).toBe('5');
    expect(move.request.body).toEqual({ parentSpaceId: null });
    move.flush({});

    client.changeLifecycle('e1', 6, { action: 'retire', reason: 'Demolición' }).subscribe();
    const ciclo = http.expectOne('/care-spaces/e1/lifecycle');
    expect(ciclo.request.headers.get('If-Match')).toBe('6');
    expect(ciclo.request.body).toEqual({ action: 'retire', reason: 'Demolición' });
    ciclo.flush({});
  });

  it('manda dryRun en la query de la importación', () => {
    client.importCareSpaces('s1', [], true).subscribe();
    const seco = http.expectOne((r) => r.url === '/sites/s1/care-spaces/import');
    expect(seco.request.params.get('dryRun')).toBe('true');
    seco.flush({ ok: true, rows: [] });

    client.importCareSpaces('s1', [], false).subscribe();
    http.expectOne((r) => r.url === '/sites/s1/care-spaces/import' && r.params.get('dryRun') === 'false').flush({ ok: true, rows: [] });
  });

  it('normaliza los bloqueos de retire-check', () => {
    let resultado: RetireCheck | undefined;
    client.retireCheck('e1').subscribe((r) => (resultado = r));
    http.expectOne('/care-spaces/e1/retire-check').flush({ blockers: [{ kind: 'EQUIPMENT', count: 1, sampleIds: [], nextAction: 'Reubicar' }] });
    expect(resultado?.blockers[0]?.nextAction).toEqual({ label: 'Reubicar' });
  });

  it('cubre unidades, regulatorio, habilitaciones y capacidad', () => {
    client.assignUnit('e1', { clinicalUnitId: 'u1', roleCode: 'SPACE_UNIT_ROLE_SHARED' }).subscribe();
    http.expectOne('/care-spaces/e1/unit-assignments').flush({});
    client.unassignUnit('e1', 'a1').subscribe();
    expect(http.expectOne('/care-spaces/e1/unit-assignments/a1').request.method).toBe('DELETE');
    client.listClinicalUnits('s1').subscribe();
    http.expectOne('/sites/s1/clinical-units').flush([]);
    client.updateRegulatory('s1', { snisCode: '1', subsectorCode: null, careLevelCode: null, typologyCode: null, managingEntityName: null, healthNetworkName: null, sedesCode: null, municipalityName: null }).subscribe();
    expect(http.expectOne('/sites/s1/regulatory').request.method).toBe('PATCH');
    client.listLicenses('s1').subscribe();
    http.expectOne('/sites/s1/licenses').flush([]);
    client.updateLicense('l1', { notes: 'x' }).subscribe();
    expect(http.expectOne('/site-licenses/l1').request.method).toBe('PATCH');
    client.getCapacity('s1').subscribe();
    http.expectOne('/sites/s1/capacity').flush({});
    client.declareCapacity('s1', { kindCode: 'CAP_BEDS_CENSABLE', quantity: 3, asOf: '2026-01-01' }).subscribe();
    expect(http.expectOne('/sites/s1/declared-capacities').request.method).toBe('POST');
  });
});
