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

  it('aceptar una invitación va por el vínculo, sin cuerpo', () => {
    client.confirm('l-1').subscribe();
    const req = ultima('/me/support-engagements/l-1/confirm');
    expect(req.request.body).toEqual({});
    req.flush({});
  });

  it('rechazar sin motivo no manda `reason` vacío', () => {
    client.decline('l-1', '  ').subscribe();
    const req = ultima('/me/support-engagements/l-1/decline');
    expect(req.request.body).toEqual({});
    req.flush({});
  });

  it('el catálogo de la secretaria pide el hospital por `org`', () => {
    client.getCatalogFor('t-1').subscribe();
    const req = ultima('/me/support-catalog');
    expect(req.request.params.get('org')).toBe('t-1');
    req.flush({ tenantId: 't-1', organizationName: null, sites: [], services: [], floors: [], practitioners: [] });
  });

  it('el hospital decide un vínculo con `decision`, sin ítems', () => {
    client.decide('l-9', { decision: 'APPROVED' }).subscribe();
    const req = ultima('/org/support-engagement-requests/l-9/decision');
    expect(req.request.body).toEqual({ decision: 'APPROVED' });
    req.flush({});
  });

  it('las solicitudes del hospital piden lo pendiente y devuelven la lista', () => {
    let filas: readonly unknown[] = [];
    client.listRequests().subscribe((items) => (filas = items));
    const req = ultima('/org/support-engagement-requests');
    expect(req.request.params.get('status')).toBe('PENDING');
    req.flush({ items: [{ id: 'l-1' }], count: 1, nextCursor: null });
    expect(filas).toEqual([{ id: 'l-1' }]);
  });

  it('el hospital invita por documento con sus objetivos', () => {
    client.inviteToOrganization({ nationalId: '6001001', items: [{ targetKind: 'SPACE', careSpaceId: 'p-2' }] }).subscribe();
    const req = ultima('/org/team/invitations');
    expect(req.request.body).toEqual({ nationalId: '6001001', items: [{ targetKind: 'SPACE', careSpaceId: 'p-2' }] });
    req.flush({ id: 'l-1', tenantId: 't', items: [] });
  });

  it('el doctor acepta y su equipo llega como lista', () => {
    client.acceptAsPractitioner('l-3').subscribe();
    ultima('/practitioner-delegates/l-3/accept').flush({});
    let equipo: readonly unknown[] = [];
    client.getMyTeam().subscribe((items) => (equipo = items));
    ultima('/me/practitioner/support-team').flush({ items: [{ id: 'l-3' }], count: 1, nextCursor: null });
    expect(equipo).toEqual([{ id: 'l-3' }]);
  });
});
