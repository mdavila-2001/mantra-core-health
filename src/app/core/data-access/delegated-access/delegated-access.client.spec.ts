import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { DelegatedAccessClient } from './delegated-access.client';

/**
 * Lo que fijan estas pruebas es el contrato con el backend: ruta exacta, verbo
 * y **solo** las claves que los DTOs admiten — `forbidNonWhitelisted` convierte
 * cualquier propiedad de más en un 400.
 */
describe('DelegatedAccessClient', () => {
  let client: DelegatedAccessClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    client = TestBed.inject(DelegatedAccessClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  const CREADO = { id: 'r-1', status: 'concepto-uuid', createdAt: '2026-08-07T12:00:00.000Z' };

  it('el alta de asignación lleva la membresía en la ruta, no en el cuerpo', () => {
    client.createOrgUserAssignment('tm-1', { role: 'NURSE', accessScope: 'SITE' }).subscribe();

    const req = http.expectOne('/org/tm-1/user-assignments');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ role: 'NURSE', accessScope: 'SITE' });

    req.flush(CREADO);
  });

  it('convierte `createdAt` a fecha de verdad, no la deja como texto', () => {
    let creado: { createdAt: Date } | undefined;
    client
      .createOrgUserAssignment('tm-1', {})
      .subscribe((value) => (creado = value));

    http.expectOne('/org/tm-1/user-assignments').flush(CREADO);

    expect(creado?.createdAt).toBeInstanceOf(Date);
  });

  it('la reasignación va por PATCH con el cuerpo tal cual', () => {
    client
      .updateOrgUserAssignment('a-1', { suspend: true, expectedRowVersion: 3 })
      .subscribe();

    const req = http.expectOne('/org/user-assignments/a-1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ suspend: true, expectedRowVersion: 3 });

    req.flush({ ok: true });
  });

  it('la delegación de practitioner manda exactamente sus tres referencias', () => {
    client
      .createPractitionerDelegate({
        practitionerRoleAssignmentId: 'pra-1',
        delegateUserAssignmentId: 'dua-1',
        delegatedPermissionSetId: 'set-1',
      })
      .subscribe();

    const req = http.expectOne('/practitioner-delegates');
    expect(Object.keys(req.request.body as object)).toEqual([
      'practitionerRoleAssignmentId',
      'delegateUserAssignmentId',
      'delegatedPermissionSetId',
    ]);

    req.flush(CREADO);
  });

  it('la solicitud de acceso cuelga de su delegación', () => {
    client
      .requestDelegatedAccess('d-1', { requestedPermissionId: 'perm-1', reasonText: 'guardia' })
      .subscribe();

    const req = http.expectOne('/practitioner-delegates/d-1/access-requests');
    expect(req.request.body).toEqual({ requestedPermissionId: 'perm-1', reasonText: 'guardia' });

    req.flush(CREADO);
  });

  it('el grant exige propósito y vencimiento', () => {
    client
      .issueGrant('d-1', { purpose: 'TREATMENT', validTo: '2026-09-01T00:00:00.000Z' })
      .subscribe();

    const req = http.expectOne('/practitioner-delegates/d-1/grants');
    expect(req.request.body).toEqual({
      purpose: 'TREATMENT',
      validTo: '2026-09-01T00:00:00.000Z',
    });

    req.flush(CREADO);
  });

  it('revocar admite un cuerpo vacío: el motivo es opcional', () => {
    client.revokeDelegation('d-1', {}).subscribe();

    const req = http.expectOne('/practitioner-delegates/d-1/revoke');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});

    req.flush({ ok: true });
  });

  it('la resolución viaja a la solicitud correcta', () => {
    client.resolveAccessRequest('req-1', { decision: 'APPROVED', purpose: 'BILLING' }).subscribe();

    const req = http.expectOne('/access-requests/req-1/decision');
    expect(req.request.body).toEqual({ decision: 'APPROVED', purpose: 'BILLING' });

    req.flush({ requestId: 'req-1', decision: 'APPROVED', grantId: 'g-1' });
  });

  it('la evaluación del actor efectivo es un POST de consulta', () => {
    let veredicto: { allowed: boolean } | undefined;
    client
      .evaluateEffectiveActor({ practitionerDelegateAssignmentId: 'd-1', purpose: 'TREATMENT' })
      .subscribe((value) => (veredicto = value));

    const req = http.expectOne('/authz/effective-actor/evaluate');
    expect(req.request.body).toEqual({
      practitionerDelegateAssignmentId: 'd-1',
      purpose: 'TREATMENT',
    });

    req.flush({ allowed: false, requiresStepUp: true, reason: 'step-up requerido' });
    expect(veredicto?.allowed).toBe(false);
  });

  it('el barrido de expiración no lleva cuerpo', () => {
    let resultado: { expiredGrants: number } | undefined;
    client.runExpirySweep().subscribe((value) => (resultado = value));

    const req = http.expectOne('/delegated-access/expiry-sweep');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBeNull();

    req.flush({ expiredGrants: 2, expiredDelegations: 1, expiredOrgAssignments: 0 });
    expect(resultado?.expiredGrants).toBe(2);
  });

  it('el set nace con al menos un ítem en su versión 1', () => {
    client
      .createPermissionSet({
        tenantId: 't-1',
        code: 'AGENDA',
        name: 'Agenda del consultorio',
        items: [{ permissionId: 'perm-1', requiresStepUpAuthentication: true }],
      })
      .subscribe();

    const req = http.expectOne('/delegated-permission-sets');
    expect(req.request.body).toEqual({
      tenantId: 't-1',
      code: 'AGENDA',
      name: 'Agenda del consultorio',
      items: [{ permissionId: 'perm-1', requiresStepUpAuthentication: true }],
    });

    req.flush({ id: 'v-1', versionNumber: 1, itemCount: 1 });
  });

  it('versionar reemplaza los ítems del set indicado', () => {
    let version: { versionNumber: number } | undefined;
    client
      .publishSetVersion('set-1', { items: [{ permissionId: 'perm-2' }] })
      .subscribe((value) => (version = value));

    const req = http.expectOne('/delegated-permission-sets/set-1/versions');
    expect(req.request.body).toEqual({ items: [{ permissionId: 'perm-2' }] });

    req.flush({ id: 'v-2', versionNumber: 2, itemCount: 1 });
    expect(version?.versionNumber).toBe(2);
  });
});
