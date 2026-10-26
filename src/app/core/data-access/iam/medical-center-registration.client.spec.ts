import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import {
  isMedicalOrganizationType,
  MEDICAL_ORGANIZATION_TYPES,
  MedicalCenterRegistrationClient,
  type MedicalCenterRegistration,
} from './medical-center-registration.client';

const REGISTRATION: MedicalCenterRegistration = {
  code: 'CENTRO-NORTE',
  tenantType: 'HOSPITAL',
  legalName: 'Centro Médico Norte S.R.L.',
  legalEntityType: 'SRL',
  countryConceptId: 'c-bo',
  jurisdictionConceptId: 'j-nac',
  owner: { email: 'marta@centro.test', password: 'S3cret-passw0rd', displayName: 'Marta Rojas' },
};

describe('MedicalCenterRegistrationClient', () => {
  let client: MedicalCenterRegistrationClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(MedicalCenterRegistrationClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('ofrece exactamente los cinco tipos institucionales de salud, en orden', () => {
    expect(MEDICAL_ORGANIZATION_TYPES).toEqual([
      'HOSPITAL',
      'CLINIC',
      'MEDICAL_OFFICE',
      'NURSING',
      'HEALTH_OTHER',
    ]);
  });

  it('reconoce los cinco tipos y rechaza los que no son una organización médica', () => {
    for (const tipo of MEDICAL_ORGANIZATION_TYPES) {
      expect(isMedicalOrganizationType(tipo)).toBe(true);
    }
    for (const ajeno of ['PAYER', 'PHARMACY', 'DIAGNOSTIC_CENTER', 'PROVIDER', '', 'clinic']) {
      expect(isMedicalOrganizationType(ajeno)).toBe(false);
    }
  });

  it.each(MEDICAL_ORGANIZATION_TYPES)('manda el tipo elegido tal cual: %s', (tipo) => {
    client.register({ ...REGISTRATION, tenantType: tipo }).subscribe();

    const req = http.expectOne((r) => r.url === '/iam/auth/register-organization');
    expect(req.request.body.organization.tenantType).toBe(tipo);
    req.flush({});
  });

  it('envía el tipo, el país y la jurisdicción a register-organization', () => {
    client.register(REGISTRATION).subscribe();

    const req = http.expectOne((r) => r.url === '/iam/auth/register-organization');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      organization: {
        code: 'CENTRO-NORTE',
        legalName: 'Centro Médico Norte S.R.L.',
        legalEntityType: 'SRL',
        tenantType: 'HOSPITAL',
        countryConceptId: 'c-bo',
        jurisdictionConceptId: 'j-nac',
      },
      owner: { email: 'marta@centro.test', password: 'S3cret-passw0rd', displayName: 'Marta Rojas' },
    });
    req.flush({ tenantId: 't-1', code: 'CENTRO-NORTE', ownerUserId: 'u-1', status: 'p', emailVerificationSent: true });
  });

  it('manda el nombre comercial sólo si lo hay', () => {
    client.register({ ...REGISTRATION, tradeName: 'Norte' }).subscribe();

    const req = http.expectOne((r) => r.url === '/iam/auth/register-organization');
    expect(req.request.body.organization.tradeName).toBe('Norte');
    req.flush({});
  });
});
