import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { rejectionReason } from '../authz-admin/authz-admin.client';
import { AuthzGovernanceClient } from './authz-governance.client';

const USER = '00000000-0000-4000-8000-000000000001';
const ROLE = '00000000-0000-4000-8000-000000000002';

describe('AuthzGovernanceClient', () => {
  let client: AuthzGovernanceClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(AuthzGovernanceClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reemplaza los permisos del rol con PUT y el cuerpo exacto', () => {
    client.setRolePermissions(ROLE, { permissions: [{ permissionId: 'p1', effect: 'ALLOW', scope: 'TENANT' }] }).subscribe();
    const req = http.expectOne(`/authz/roles/${ROLE}/permissions`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ permissions: [{ permissionId: 'p1', effect: 'ALLOW', scope: 'TENANT' }] });
    req.flush({ id: ROLE, code: 'DPO', status: 'ACTIVE', permissionCount: 1 });
  });

  it('lee los permisos por campo de un rol y guarda reglas con upsert', () => {
    client.roleFieldPermissions(ROLE).subscribe();
    http.expectOne(`/authz/roles/${ROLE}/field-permissions`).flush({ roleId: ROLE, items: [] });
    client.setFieldPermissions(ROLE, [{ entity: 'patient', columnName: 'document', canRead: true, canWrite: false, maskStrategy: 'PARTIAL' }]).subscribe();
    const req = http.expectOne(`/authz/roles/${ROLE}/field-permissions`);
    expect(req.request.method).toBe('PUT');
    expect((req.request.body as { fields: unknown[] }).fields).toHaveLength(1);
    req.flush({ ok: true });
  });

  it('lista los permisos por alcance sin mandar filtros vacíos y convierte fechas', () => {
    let first: Date | undefined;
    client.resourceScopeGrants({ subjectId: USER, resourceId: '', limit: 50 }).subscribe((p) => (first = p.items[0]?.validTo));
    const req = http.expectOne((r) => r.url === '/authz/resource-scope-grants');
    expect(req.request.params.get('subjectId')).toBe(USER);
    expect(req.request.params.has('resourceId')).toBe(false);
    req.flush({
      items: [{ id: 'g1', subjectId: USER, permissionId: 'p', resourceId: 'r', tenantId: null, subjectType: 'USER', resourceType: 'PATIENT', effect: 'DENY', validFrom: null, validTo: '2027-01-01T00:00:00.000Z', isEffective: true, createdAt: '2026-10-01T00:00:00.000Z' }],
      nextCursor: null,
      limit: 50,
    });
    expect(first).toBeInstanceOf(Date);
  });

  it('termina un permiso por alcance con DELETE', () => {
    let validTo: Date | undefined;
    client.endResourceScopeGrant('g1').subscribe((r) => (validTo = r.validTo));
    const req = http.expectOne('/authz/resource-scope-grants/g1');
    expect(req.request.method).toBe('DELETE');
    req.flush({ id: 'g1', validTo: '2026-10-31T10:00:00.000Z' });
    expect(validTo).toBeInstanceOf(Date);
  });

  it('evalúa una decisión en el PDP real y devuelve la respuesta tal cual', () => {
    let decision: string | undefined;
    client
      .evaluate({ userId: USER, tenantId: ROLE, action: 'READ', resource: 'patient_profile' })
      .subscribe((r) => (decision = r.decision));
    const req = http.expectOne('/authz/decisions/evaluate');
    expect(req.request.method).toBe('POST');
    req.flush({ decision: 'DENY', reason: 'sin rol', effectiveRoleIds: [], maskedFields: [], cacheKey: 'k', ttlSeconds: 30 });
    expect(decision).toBe('DENY');
  });

  it('suspende, reactiva y da de baja con el motivo en el cuerpo', () => {
    for (const action of ['suspend', 'reactivate', 'offboard'] as const) {
      client.lifecycleAction(USER, action, 'Motivo suficiente').subscribe();
      const req = http.expectOne(`/authz/users/${USER}/lifecycle/${action}`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ reason: 'Motivo suficiente' });
      req.flush({ userId: USER, state: 'ACTIVE', revokedAssignments: 0, note: '' });
    }
  });

  it('un 409 de transición inválida expone su reason estable', () => {
    let error: unknown;
    client.lifecycleAction(USER, 'reactivate', 'Motivo suficiente').subscribe({ error: (e: unknown) => (error = e) });
    http
      .expectOne(`/authz/users/${USER}/lifecycle/reactivate`)
      .flush(
        { statusCode: 409, code: 'CONFLICT', message: 'x', reason: 'USER_LIFECYCLE_NOT_SUSPENDED' },
        { status: 409, statusText: 'Conflict' },
      );
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(rejectionReason(error)).toBe('USER_LIFECYCLE_NOT_SUSPENDED');
  });

  it('lee el ciclo de vida con sus fechas convertidas', () => {
    let at: Date | undefined;
    client.lifecycleOf(USER).subscribe((r) => (at = r.history[0]?.recordedAt));
    http.expectOne(`/authz/users/${USER}/lifecycle`).flush({
      userId: USER,
      state: 'SUSPENDED',
      history: [{ id: 'e1', kind: 'SUSPENDED', reason: 'Licencia', actorUserId: null, recordedAt: '2026-10-30T10:00:00.000Z' }],
    });
    expect(at).toBeInstanceOf(Date);
  });

  it('pide la cola de revisión con el plazo sólo si se eligió y quita la fecha ausente', () => {
    let last: unknown = 'sentinel';
    client.accessReviewsDue().subscribe();
    const all = http.expectOne((r) => r.url === '/authz/access-reviews/due');
    expect(all.request.params.has('olderThanDays')).toBe(false);
    all.flush({ items: [], olderThanDays: null });
    client.accessReviewsDue(90).subscribe((p) => (last = p.items[0]));
    const some = http.expectOne((r) => r.url === '/authz/access-reviews/due');
    expect(some.request.params.get('olderThanDays')).toBe('90');
    some.flush({ items: [{ userId: USER, displayName: 'Ana', activeAssignments: 2, lastReviewedAt: null }], olderThanDays: 90 });
    expect('lastReviewedAt' in (last as object)).toBe(false);
  });

  it('registra una revisión y lee el historial', () => {
    client.recordAccessReview(USER, { decision: 'CERTIFIED', reason: 'Sus roles siguen vigentes', assignmentIds: ['a1'] }).subscribe();
    const post = http.expectOne(`/authz/users/${USER}/access-reviews`);
    expect(post.request.method).toBe('POST');
    post.flush({ id: 'r1', userId: USER, decision: 'CERTIFIED', reason: 'x', assignmentIds: ['a1'], reviewerUserId: null, reviewedAt: '2026-10-31T00:00:00.000Z' });
    let when: Date | undefined;
    client.accessReviewsOf(USER).subscribe((r) => (when = r.items[0]?.reviewedAt));
    http.expectOne(`/authz/users/${USER}/access-reviews`).flush({
      userId: USER,
      items: [{ id: 'r1', userId: USER, decision: 'CERTIFIED', reason: 'x', assignmentIds: [], reviewerUserId: null, reviewedAt: '2026-10-31T00:00:00.000Z' }],
    });
    expect(when).toBeInstanceOf(Date);
  });
});
