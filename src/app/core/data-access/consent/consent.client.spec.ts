import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthzClient } from '../authz/authz.client';
import { ConsentClient } from './consent.client';

/**
 * BR-20 · el cliente de `consent` y las lecturas del titular de `authz`: las
 * rutas `me` (la persona sale de la sesión), los `null` del cable normalizados y
 * las fechas ya convertidas.
 */
describe('ConsentClient (BR-20)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('listMyConsents pide /consent/me/consents y normaliza null y fechas', () => {
    let items: readonly { state: string; withdrawnAt?: Date; validTo?: Date; createdAt: Date }[] = [];
    TestBed.inject(ConsentClient)
      .listMyConsents()
      .subscribe((valor) => (items = valor));

    http.expectOne('/consent/me/consents').flush({
      items: [
        {
          id: 'c-1',
          state: 'WITHDRAWN',
          purpose: { id: 'p-1', name: 'Tratamiento' },
          validFrom: '2026-01-01T00:00:00.000Z',
          validTo: '2026-03-01T00:00:00.000Z',
          withdrawnAt: '2026-03-01T00:00:00.000Z',
          policyVersion: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'c-2',
          state: 'ACTIVE',
          purpose: { id: 'p-2' },
          validFrom: null,
          validTo: null,
          withdrawnAt: null,
          createdAt: '2026-02-01T00:00:00.000Z',
        },
      ],
    });

    expect(items[0]?.state).toBe('WITHDRAWN');
    expect(items[0]?.withdrawnAt).toBeInstanceOf(Date);
    expect(items[0]?.createdAt).toBeInstanceOf(Date);
    // Los vacíos llegan como null y se leen como ausentes, no como 1970.
    expect(items[1]).not.toHaveProperty('withdrawnAt');
    expect(items[1]).not.toHaveProperty('validTo');
  });

  it('withdrawMyConsent hace POST a la ruta del titular, sin cuerpo con ids', () => {
    TestBed.inject(ConsentClient).withdrawMyConsent('c-1').subscribe();

    const pedido = http.expectOne('/consent/me/consents/c-1/withdraw');
    expect(pedido.request.method).toBe('POST');
    expect(pedido.request.body).toEqual({});
    pedido.flush({ ok: true });
  });

  it('registerEncounterInformedConsent manda la decision y omite lo que no se escribio', () => {
    TestBed.inject(ConsentClient)
      .registerEncounterInformedConsent('e-1', { decision: 'ACCEPTED', informationVersion: undefined })
      .subscribe();

    const pedido = http.expectOne('/consent/encounters/e-1/informed-consent');
    expect(pedido.request.method).toBe('POST');
    // Nada de paciente ni tenant: los toma la API del encuentro.
    expect(pedido.request.body).toEqual({ decision: 'ACCEPTED' });
    pedido.flush({
      id: 'i-1',
      patientProfileId: 'p-1',
      status: 'SIGNED',
      decision: 'ACCEPTED',
      createdAt: '2026-09-26T10:00:00.000Z',
    });
  });

  it('AuthzClient.getMyClinicalAccess lee /authz/me/access y convierte las fechas', () => {
    let acceso: unknown;
    TestBed.inject(AuthzClient)
      .getMyClinicalAccess()
      .subscribe((valor) => (acceso = valor));

    http.expectOne('/authz/me/access').flush({
      careRelationships: [
        {
          id: 'r-1',
          tenantId: 't-1',
          practitionerProfileId: 'h-1',
          practitionerName: 'Dra. Rojas',
          state: 'ACTIVE',
          validFrom: '2026-01-01T00:00:00.000Z',
        },
      ],
      grants: [
        {
          id: 'g-1',
          tenantId: 't-1',
          grantedUserId: 'u-9',
          isEmergency: true,
          state: 'ACTIVE',
          validFrom: '2026-09-26T09:00:00.000Z',
          validTo: '2026-09-26T10:00:00.000Z',
        },
      ],
    });

    const leido = acceso as {
      careRelationships: { validFrom: Date; validTo?: Date; practitionerName: string }[];
      grants: { validTo: Date; isEmergency: boolean }[];
    };
    expect(leido.careRelationships[0]?.validFrom).toBeInstanceOf(Date);
    expect(leido.careRelationships[0]?.validTo).toBeUndefined();
    expect(leido.careRelationships[0]?.practitionerName).toBe('Dra. Rojas');
    expect(leido.grants[0]?.validTo).toBeInstanceOf(Date);
    expect(leido.grants[0]?.isEmergency).toBe(true);
  });

  it('las revocaciones del titular usan las rutas /authz/me/... y la emergencia manda justificacion', () => {
    const authz = TestBed.inject(AuthzClient);
    authz.revokeMyCareRelationship('r-1').subscribe();
    http.expectOne('/authz/me/care-relationships/r-1/revoke').flush({ ok: true });

    authz.revokeMyClinicalGrant('g-1').subscribe();
    http.expectOne('/authz/me/clinical-access-grants/g-1/revoke').flush({ ok: true });

    authz
      .breakTheGlass('p-1', { tenantId: 't-1', justification: 'Paciente inconsciente en urgencias' })
      .subscribe();
    const emergencia = http.expectOne('/authz/patients/p-1/break-the-glass');
    expect(emergencia.request.body).toEqual({
      tenantId: 't-1',
      justification: 'Paciente inconsciente en urgencias',
    });
    emergencia.flush({ id: 'g-2' });
  });
});
