import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { API_BASE_URL } from '../api';
import { SupportPatientsClient } from './support-patients.client';

describe('SupportPatientsClient (rutas propuesta)', () => {
  let client: SupportPatientsClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: '' }] });
    client = TestBed.inject(SupportPatientsClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('búsqueda exacta', () => {
    it('por documento manda solo el documento y la organización donde se audita', () => {
      let encontrados: unknown;
      client.searchExact('t-1', { kind: 'DOCUMENT', document: '4123456' }).subscribe((r) => (encontrados = r));
      const req = http.expectOne('/me/support-patient-search');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ tenantId: 't-1', nationalId: '4123456' });
      req.flush({ items: [{ patientProfileId: 'p-1', displayName: 'Juan Pérez', documentMasked: '***456', ageYears: 40, isMinor: false }], count: 1 });
      // Las pantallas leen `profileId`: el `patientProfileId` de la API se traduce acá.
      expect(encontrados).toEqual({ items: [{ profileId: 'p-1', displayName: 'Juan Pérez', documentMasked: '***456', ageYears: 40, isMinor: false }], count: 1 });
    });

    it('por teléfono manda solo el teléfono', () => {
      client.searchExact('t-1', { kind: 'PHONE', phone: '71234567' }).subscribe();
      expect(http.expectOne('/me/support-patient-search').request.body).toEqual({ tenantId: 't-1', phone: '71234567' });
    });

    it('por nombre manda el nombre completo y la fecha de nacimiento, nunca uno sin el otro', () => {
      client.searchExact('t-1', { kind: 'NAME_BIRTH', fullName: 'Juan Pérez', birthDate: '1990-05-12' }).subscribe();
      expect(http.expectOne('/me/support-patient-search').request.body).toEqual({ tenantId: 't-1', fullName: 'Juan Pérez', birthDate: '1990-05-12' });
    });
  });

  describe('registro rápido', () => {
    it('manda lo mínimo; lo opcional vacío no viaja', () => {
      client.register('t-1', { name: 'Ana', lastName: 'Rojas', motherLastName: '', document: '5000001', birthDate: '1990-01-01', phone: '71234567', inviteToPortal: true }).subscribe();
      const req = http.expectOne('/me/support-patients');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ tenantId: 't-1', name: 'Ana', lastName: 'Rojas', document: '5000001', birthDate: '1990-01-01', phone: '71234567', inviteToPortal: true });
      req.flush({ outcome: 'CREATED', patient: { patientProfileId: 'p-9', displayName: 'Ana Rojas', documentMasked: '***001', ageYears: 36, isMinor: false }, invitationSent: true });
    });

    it('un menor viaja con su representante, y seguir pese a un duplicado se dice a propósito', () => {
      client
        .register('t-1', {
          name: 'Luis',
          lastName: 'Vaca',
          document: '5000002',
          birthDate: '2018-01-01',
          phone: '71234567',
          guardian: { name: 'Marta Vaca', document: '4000001', phone: '71234568', relationship: 'Madre' },
          inviteToPortal: false,
          acknowledgeDuplicates: true,
        })
        .subscribe();
      const pedido = http.expectOne('/me/support-patients');
      const body = pedido.request.body as Record<string, unknown>;
      expect(body['guardian']).toEqual({ name: 'Marta Vaca', document: '4000001', phone: '71234568', relationship: 'Madre' });
      expect(body['acknowledgeDuplicates']).toBe(true);
      expect(body['inviteToPortal']).toBe(false);
      pedido.flush({ outcome: 'CREATED', patient: { profileId: 'p-10', displayName: 'Luis Vaca', documentMasked: '***002', ageYears: 8, isMinor: true }, invitationSent: false, identityVerified: false, guardian: { recorded: true, status: 'PENDING_VERIFICATION' } });
    });

    it('la respuesta CREATED deja `profileId` aunque la API lo mande como `patientProfileId`, y trae cómo quedó el representante', () => {
      let resultado: unknown;
      client.register('t-1', { name: 'Luis', lastName: 'Vaca', document: '5000002', birthDate: '2018-01-01', phone: '71234567', inviteToPortal: false }).subscribe((r) => (resultado = r));
      http.expectOne('/me/support-patients').flush({ outcome: 'CREATED', patient: { patientProfileId: 'p-10', displayName: 'Luis Vaca', documentMasked: '***002', ageYears: 8, isMinor: true }, invitationSent: false, identityVerified: false, guardian: { recorded: true, status: 'PENDING_VERIFICATION' } });
      expect(resultado).toMatchObject({ outcome: 'CREATED', identityVerified: false, guardian: { recorded: true, status: 'PENDING_VERIFICATION' }, patient: { profileId: 'p-10' } });
      expect(resultado as object).not.toHaveProperty('guardianLink');
      expect(resultado as object).not.toHaveProperty('patient.patientProfileId');
    });

    it('un duplicado de otra organización llega sin perfil y sin inventarle uno', () => {
      let resultado: { duplicates: Record<string, unknown>[] } | undefined;
      client.register('t-1', { name: 'Ana', lastName: 'Rojas', document: '5000001', birthDate: '1990-01-01', phone: '71234567', inviteToPortal: false }).subscribe((r) => (resultado = r as never));
      http.expectOne('/me/support-patients').flush({
        outcome: 'POSSIBLE_DUPLICATES',
        duplicates: [
          { patientProfileId: 'p-7', displayName: 'Ana Rojas Vaca', documentMasked: '***111', ageYears: 30, isMinor: false, linkedToOrganization: true, matchedBy: ['DOCUMENT'] },
          { documentMasked: '***222', isMinor: false, linkedToOrganization: false, matchedBy: ['NAME_AND_BIRTH_DATE'] },
        ],
      });
      expect(resultado!.duplicates[0]).toMatchObject({ profileId: 'p-7', linkedToOrganization: true });
      expect(resultado!.duplicates[1]).toEqual({ documentMasked: '***222', isMinor: false, linkedToOrganization: false, matchedBy: ['NAME_AND_BIRTH_DATE'] });
    });
  });
});
