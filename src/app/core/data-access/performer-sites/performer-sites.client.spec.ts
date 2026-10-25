import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PerformerSitesClient } from './performer-sites.client';

describe('PerformerSitesClient', () => {
  let client: PerformerSitesClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(PerformerSitesClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lee las vinculaciones del médico y normaliza los null', () => {
    let filas: unknown;
    client.readOwnAssignments().subscribe((r) => (filas = r));

    http.expectOne('/practitioners/me/role-assignments').flush([
      { id: 'r-1', practiceSiteId: 's-1', serviceConceptId: 'p-1', statusCode: 'ROLE_ASG_ACTIVE' },
      { id: 'r-2', practiceSiteId: null, serviceConceptId: null },
    ]);

    expect(filas).toEqual([
      { practiceSiteId: 's-1', serviceConceptId: 'p-1', statusCode: 'ROLE_ASG_ACTIVE' },
      { practiceSiteId: null, serviceConceptId: null, statusCode: '' },
    ]);
  });

  it('acepta las vinculaciones dentro de { items }', () => {
    let filas: readonly unknown[] = [];
    client.readOwnAssignments().subscribe((r) => (filas = r));

    http.expectOne('/practitioners/me/role-assignments').flush({
      items: [{ practiceSiteId: 's-1', serviceConceptId: 'p-1', statusCode: 'ROLE_ASG_ACTIVE' }],
    });

    expect(filas).toHaveLength(1);
  });

  it('busca sedes por procedimiento y conserva el orden recibido', () => {
    let sedes: unknown;
    client.searchSites('p-1').subscribe((r) => (sedes = r));

    const req = http.expectOne((r) => r.url === '/medical-centers/search');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('procedureConceptIds')).toBe('p-1');
    // Sólo ese parámetro: la API valida con `forbidNonWhitelisted`.
    expect(req.request.params.keys()).toEqual(['procedureConceptIds']);
    req.flush({
      items: [
        { practiceSiteId: 's-2', name: 'Centro Este', addressText: null, complete: true },
        { practiceSiteId: 's-1', name: 'Centro Norte', addressText: 'Av. 1', complete: true },
      ],
      total: 2,
      limit: 20,
      offset: 0,
    });

    expect(sedes).toEqual([
      { practiceSiteId: 's-2', name: 'Centro Este', addressText: null },
      { practiceSiteId: 's-1', name: 'Centro Norte', addressText: 'Av. 1' },
    ]);
  });
});
