import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthzClient } from './authz.client';
import type { AccessRequestItem, CareRelationship } from './authz.types';

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

  it('requestCareRelationship publica el pedido sin especialidades: el pedido por especialidad es otro circuito', () => {
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

  it('requestCareRelationship con cabecera manda relationshipType PRIMARY', () => {
    client
      .requestCareRelationship({ tenantId: 't-1', patientProfileId: 'p-1', relationshipType: 'PRIMARY' })
      .subscribe();

    const req = http.expectOne('/authz/care-relationships/request');
    expect(req.request.body).toEqual({ tenantId: 't-1', patientProfileId: 'p-1', relationshipType: 'PRIMARY' });
    req.flush({ id: 'cr-1' });
  });

  /* ---- el buzón unificado ------------------------------------------------ */

  const INBOX_ROW = {
    id: 'ar-1',
    kind: 'GRANULAR',
    direction: 'RECEIVED',
    counterpart: { profileId: 'pro-1', displayName: 'Dra. Rojas' },
    requestedAt: '2026-11-01T12:00:00.000Z',
    decidedAt: null,
    status: 'PENDING',
    requestedSpecialtyConceptIds: ['esp-1', 'esp-2'],
    authorizedSpecialtyConceptIds: [],
  };

  it('listMyAccessRequests no manda parámetros y convierte las fechas; sin decisión no declara decidedAt', () => {
    let rows: readonly AccessRequestItem[] = [];
    client.listMyAccessRequests().subscribe((r) => (rows = r));

    const req = http.expectOne('/authz/me/access-requests');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush([INBOX_ROW, { ...INBOX_ROW, id: 'ar-2', status: 'ACTIVE', decidedAt: '2026-11-02T09:00:00.000Z' }]);

    expect(rows[0].requestedAt).toBeInstanceOf(Date);
    expect('decidedAt' in rows[0]).toBe(false);
    expect(rows[1].decidedAt).toBeInstanceOf(Date);
    expect(rows[0].counterpart.displayName).toBe('Dra. Rojas');
  });

  it('listPractitionerAccessRequests lee la bandeja del profesional', () => {
    client.listPractitionerAccessRequests().subscribe();

    const req = http.expectOne('/authz/practitioners/me/access-requests');
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('requestPrimaryPractitioner manda el profesional y la organización del profesional en X-Tenant-Id', () => {
    client.requestPrimaryPractitioner('pro-1', 't-medico').subscribe();

    const req = http.expectOne('/authz/me/primary-practitioner-requests');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ practitionerProfileId: 'pro-1' });
    expect(req.request.headers.get('X-Tenant-Id')).toBe('t-medico');
    req.flush({ id: 'cr-9' }, { status: 201, statusText: 'Created' });
  });

  it('respondAsPractitioner lleva sólo la decisión a la ruta del profesional', () => {
    client.respondAsPractitioner('cr/9', 'ACCEPT').subscribe();

    const req = http.expectOne('/authz/practitioners/me/care-relationships/cr%2F9/respond');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ decision: 'ACCEPT' });
    req.flush({ ok: true });
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
