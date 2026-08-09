import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthzClient } from './authz.client';
import type { CareRelationship } from './authz.types';

const ALCANCE = { tenantId: 't-1', patientProfileId: 'p-1' };

describe('AuthzClient', () => {
  let client: AuthzClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(AuthzClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listCareRelationships manda los dos parámetros que el backend exige', () => {
    client.listCareRelationships(ALCANCE).subscribe();

    const req = http.expectOne((r) => r.url === '/authz/care-relationships');
    expect(req.request.params.get('tenantId')).toBe('t-1');
    expect(req.request.params.get('patientProfileId')).toBe('p-1');

    req.flush([]);
  });

  /** La respuesta es un array desnudo: es la forma del contrato, no un olvido. */
  it('acepta la respuesta sin sobre de paginación', () => {
    let relaciones: readonly CareRelationship[] = [];
    client.listCareRelationships(ALCANCE).subscribe((r) => (relaciones = r));

    http
      .expectOne((r) => r.url === '/authz/care-relationships')
      .flush([
        {
          id: 'cr-1',
          patientProfileId: 'p-1',
          practitionerProfileId: 'pr-1',
          relationshipTypeConceptId: 'rt-1',
          statusConceptId: 'st-1',
          validFrom: '2026-01-01T00:00:00.000Z',
        },
      ]);

    expect(relaciones).toHaveLength(1);
    expect(relaciones[0].validFrom).toBeInstanceOf(Date);
  });

  /**
   * Sin `validTo` la relación es **abierta** —vigente hasta que se revoque—, que
   * es distinto de una con fin en el pasado. Dejar la clave ausente conserva esa
   * distinción para `in` y para `Object.keys`.
   */
  it('una relación sin fin no declara `validTo`', () => {
    let relaciones: readonly CareRelationship[] = [];
    client.listCareRelationships(ALCANCE).subscribe((r) => (relaciones = r));

    http
      .expectOne((r) => r.url === '/authz/care-relationships')
      .flush([
        {
          id: 'cr-1',
          patientProfileId: 'p-1',
          practitionerProfileId: 'pr-1',
          relationshipTypeConceptId: 'rt-1',
          statusConceptId: 'st-1',
          validFrom: '2026-01-01T00:00:00.000Z',
          validTo: null,
        },
      ]);

    expect('validTo' in relaciones[0]).toBe(false);
  });

  it('listLegalRepresentations pega contra su propia ruta', () => {
    client.listLegalRepresentations(ALCANCE).subscribe();

    const req = http.expectOne((r) => r.url === '/authz/legal-representations');
    expect(req.request.params.get('patientProfileId')).toBe('p-1');

    req.flush([]);
  });
});
