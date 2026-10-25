import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { PerformerAssignmentsClient } from './performer-assignments.client';

describe('PerformerAssignmentsClient', () => {
  let client: PerformerAssignmentsClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(PerformerAssignmentsClient);
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
});
