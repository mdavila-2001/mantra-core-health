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
  /* ---- FT-07 · el vínculo por consentimiento ---------------------------- */

  it('requestCareRelationship publica el pedido sin especialidades: las elige el paciente', () => {
    client
      .requestCareRelationship({ tenantId: 't-1', patientProfileId: 'p-1', reasonText: 'Seguimiento' })
      .subscribe();

    const req = http.expectOne('/authz/care-relationships/request');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      tenantId: 't-1',
      patientProfileId: 'p-1',
      reasonText: 'Seguimiento',
    });

    req.flush({ id: 'cr-1' });
  });

  it('listMyPendingCareRelationshipRequests no manda parámetros: el sujeto es la sesión', () => {
    let pendientes: readonly CareRelationship[] = [];
    client.listMyPendingCareRelationshipRequests().subscribe((r) => (pendientes = r));

    const req = http.expectOne('/authz/care-relationships/requests/mine');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush([
      {
        id: 'cr-2',
        patientProfileId: 'p-1',
        practitionerProfileId: 'pro-1',
        relationshipTypeConceptId: 'tipo-1',
        statusConceptId: 'estado-pendiente',
        validFrom: '2026-09-05T12:00:00.000Z',
        validTo: null,
      },
    ]);

    expect(pendientes.length).toBe(1);
    expect(pendientes[0].validFrom).toBeInstanceOf(Date);
    expect('validTo' in pendientes[0]).toBe(false);
  });

  it('respondToCareRelationshipRequest lleva la decisión y las áreas al id de la solicitud', () => {
    client
      .respondToCareRelationshipRequest('cr/2', {
        decision: 'ACCEPT',
        authorizedSpecialtyConceptIds: ['esp-1'],
      })
      .subscribe();

    const req = http.expectOne('/authz/care-relationships/cr%2F2/respond');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      decision: 'ACCEPT',
      authorizedSpecialtyConceptIds: ['esp-1'],
    });

    req.flush({ ok: true, affected: 1 });
  });
});
