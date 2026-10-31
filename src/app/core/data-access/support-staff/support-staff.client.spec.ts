import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { forcedRealApi } from '../../mock/api-mode';
import { SupportStaffClient } from './support-staff.client';

describe('SupportStaffClient — lo que viaja a la API', () => {
  let client: SupportStaffClient;
  let http: HttpTestingController;

  beforeEach(() => {
    forcedRealApi.set(true);
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(SupportStaffClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    forcedRealApi.set(false);
  });

  function ultima(sufijo: string) {
    return http.expectOne((r) => r.url.endsWith(sufijo));
  }

  it('el alta manda sólo los campos del DTO, sin opcionales vacíos', () => {
    client
      .registerSupportStaff({
        nationalId: '6001001',
        issuerAdministrativeAreaConceptId: 'dep-sc',
        password: 'secreta123',
        name: 'Rosa',
        middleName: ' ',
        lastName: 'Choque',
        motherLastName: 'Mamani',
        email: 'rosa@ejemplo.com',
        birthDate: '1990-05-04',
        phone: '+591 70012345',
      })
      .subscribe();
    const req = ultima('/iam/auth/register-support-staff');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      nationalId: '6001001',
      issuerAdministrativeAreaConceptId: 'dep-sc',
      password: 'secreta123',
      name: 'Rosa',
      lastName: 'Choque',
      motherLastName: 'Mamani',
      email: 'rosa@ejemplo.com',
      birthDate: '1990-05-04',
      phone: '+591 70012345',
    });
    req.flush({ userId: 'u', personId: 'p', supportProfileId: 's', role: 'SUPPORT_STAFF', emailVerificationSent: true });
  });
});
