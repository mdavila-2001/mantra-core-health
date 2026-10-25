import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { RoleAssignmentsClient } from './role-assignments.client';
import type { RoleAssignmentRow } from './role-assignments.types';

const ROW: RoleAssignmentRow = {
  id: 'ra-1',
  practitionerProfileId: 'pp-1',
  practitionerName: 'Dra. Rojas',
  practiceId: 'pr-1',
  practiceSiteId: 'site-1',
  healthcareServiceId: 'hs-1',
  serviceConceptId: 'sc-1',
  serviceDisplay: 'Colonoscopia',
  statusConceptId: 'st-1',
  statusCode: 'ROLE_ASG_INVITED',
  initiatedBy: 'PRACTICE',
};

describe('RoleAssignmentsClient', () => {
  let client: RoleAssignmentsClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(RoleAssignmentsClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista los médicos del centro sin renombrar los campos', () => {
    let rows: readonly RoleAssignmentRow[] = [];
    client.listForPractice('pr-1').subscribe((r) => (rows = r));

    const req = http.expectOne('/practices/pr-1/role-assignments');
    expect(req.request.method).toBe('GET');
    req.flush([ROW]);

    expect(rows).toEqual([ROW]);
  });

  it('conserva el null del procedimiento ausente', () => {
    let rows: readonly RoleAssignmentRow[] = [];
    client.listForPractice('pr-1').subscribe((r) => (rows = r));

    http.expectOne('/practices/pr-1/role-assignments').flush([
      { ...ROW, healthcareServiceId: null, serviceConceptId: null, serviceDisplay: null },
    ]);

    expect(rows[0]!.healthcareServiceId).toBeNull();
    expect(rows[0]!.serviceDisplay).toBeNull();
  });

  it('invita con el cuerpo exacto del contrato', () => {
    let rows: readonly RoleAssignmentRow[] = [];
    const input = { practitionerProfileId: 'pp-1', practiceSiteId: 'site-1', healthcareServiceIds: ['hs-1', 'hs-2'] };
    client.invite('pr-1', input).subscribe((r) => (rows = r));

    const req = http.expectOne('/practices/pr-1/role-assignments/invitations');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(input);
    req.flush({ items: [ROW, { ...ROW, id: 'ra-2' }] });

    expect(rows.map((r) => r.id)).toEqual(['ra-1', 'ra-2']);
  });

  it('el médico acepta y declina por la ruta de «me»', () => {
    client.accept('ra-1').subscribe();
    const accept = http.expectOne('/practitioners/me/role-assignments/ra-1/accept');
    expect(accept.request.method).toBe('POST');
    accept.flush({ ...ROW, statusCode: 'ROLE_ASG_ACTIVE' });

    client.decline('ra-1').subscribe();
    http.expectOne('/practitioners/me/role-assignments/ra-1/decline').flush({ ...ROW, statusCode: 'ROLE_ASG_REJECTED' });
  });

  it('el centro aprueba y rechaza por /role-assignments', () => {
    client.approve('ra-1').subscribe();
    http.expectOne('/role-assignments/ra-1/approve').flush({ ...ROW, statusCode: 'ROLE_ASG_ACTIVE' });

    client.reject('ra-1').subscribe();
    const reject = http.expectOne('/role-assignments/ra-1/reject');
    expect(reject.request.method).toBe('POST');
    reject.flush({ ...ROW, statusCode: 'ROLE_ASG_REJECTED' });
  });

  it('nunca llama a la ruta que activa sin aceptación', () => {
    client.invite('pr-1', { practitionerProfileId: 'pp-1', practiceSiteId: 's', healthcareServiceIds: ['h'] }).subscribe();
    const req = http.expectOne(() => true);
    expect(req.request.url).not.toBe('/practices/pr-1/role-assignments');
    req.flush({ items: [] });
  });
});
