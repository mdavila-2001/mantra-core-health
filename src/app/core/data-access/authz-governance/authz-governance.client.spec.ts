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

  it('termina un permiso por alcance con DELETE y, sin motivo, con cuerpo vacío', () => {
    let validTo: Date | undefined;
    client.endResourceScopeGrant('g1').subscribe((r) => (validTo = r.validTo));
    const req = http.expectOne('/authz/resource-scope-grants/g1');
    expect(req.request.method).toBe('DELETE');
    expect(req.request.body).toEqual({});
    req.flush({ id: 'g1', validTo: '2026-10-31T10:00:00.000Z' });
    expect(validTo).toBeInstanceOf(Date);
  });

  it('al terminar un permiso DENY manda el motivo recortado en el cuerpo y expone el rechazo de la API', () => {
    let error: unknown;
    client.endResourceScopeGrant('g1', '  Se cargó por error  ').subscribe({ error: (e: unknown) => (error = e) });
    const req = http.expectOne('/authz/resource-scope-grants/g1');
    expect(req.request.body).toEqual({ reason: 'Se cargó por error' });
    req.flush(
      { statusCode: 422, message: 'x', reason: 'RESOURCE_SCOPE_GRANT_DENY_REASON_REQUIRED' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    expect(rejectionReason(error)).toBe('RESOURCE_SCOPE_GRANT_DENY_REASON_REQUIRED');
  });

  it('simula una decisión con POST /authz/simulations y devuelve la respuesta tal cual', () => {
    let out: { simulated: boolean; decision: string } | undefined;
    client
      .simulate({ userId: USER, tenantId: ROLE, action: 'READ', resource: 'patient_profile' })
      .subscribe((r) => (out = { simulated: r.simulated, decision: r.decision.decision }));
    const req = http.expectOne('/authz/simulations');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ userId: USER, tenantId: ROLE, action: 'READ', resource: 'patient_profile' });
    req.flush({
      simulated: true,
      decision: { decision: 'DENY', reason: 'sin rol', effectiveRoleIds: [], maskedFields: [], cacheKey: 'k', ttlSeconds: 30 },
    });
    expect(out).toEqual({ simulated: true, decision: 'DENY' });
  });

  it('suspende, reactiva y da de baja en /iam/users con el motivo en el cuerpo', () => {
    for (const action of ['suspend', 'reactivate', 'deactivate'] as const) {
      client.lifecycleAction(USER, action, 'Motivo suficiente').subscribe();
      const req = http.expectOne(`/iam/users/${USER}/${action}`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ reason: 'Motivo suficiente' });
      req.flush({ id: USER, state: 'ACTIVE', changed: true, revokedSessions: 0 });
    }
  });

  it('un 409 de transición inválida expone su reason estable', () => {
    let error: unknown;
    client.lifecycleAction(USER, 'reactivate', 'Motivo suficiente').subscribe({ error: (e: unknown) => (error = e) });
    http
      .expectOne(`/iam/users/${USER}/reactivate`)
      .flush(
        { statusCode: 409, code: 'CONFLICT', message: 'x', reason: 'USER_LIFECYCLE_TRANSITION_INVALID' },
        { status: 409, statusText: 'Conflict' },
      );
    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(rejectionReason(error)).toBe('USER_LIFECYCLE_TRANSITION_INVALID');
  });

  it('lee el ciclo de vida con su paginación y las fechas convertidas', () => {
    let at: Date | undefined;
    let next: string | null | undefined;
    client.lifecycleOf(USER, { limit: 20, cursor: '' }).subscribe((r) => {
      at = r.items[0]?.recordedAt;
      next = r.nextCursor;
    });
    const req = http.expectOne((r) => r.url === `/iam/users/${USER}/lifecycle`);
    expect(req.request.params.get('limit')).toBe('20');
    expect(req.request.params.has('cursor')).toBe(false);
    req.flush({
      userId: USER,
      state: 'SUSPENDED',
      items: [{ id: 'e1', action: 'SUSPEND', reason: 'Licencia', recordedByUserId: null, recordedAt: '2026-10-30T10:00:00.000Z' }],
      nextCursor: 'c2',
      limit: 20,
    });
    expect(at).toBeInstanceOf(Date);
    expect(next).toBe('c2');
  });

  it('pide la cola de revisión con el plazo sólo si se eligió y quita la fecha ausente', () => {
    let last: unknown = 'sentinel';
    client.accessReviewsDue().subscribe();
    const all = http.expectOne((r) => r.url === '/authz/access-reviews/due');
    expect(all.request.params.has('olderThanDays')).toBe(false);
    all.flush({ items: [], nextCursor: null, limit: 50, olderThanDays: 90, lookbackDays: 730 });
    client.accessReviewsDue({ olderThanDays: 30 }).subscribe((p) => (last = p.items[0]));
    const some = http.expectOne((r) => r.url === '/authz/access-reviews/due');
    expect(some.request.params.get('olderThanDays')).toBe('30');
    some.flush({
      items: [{ userId: USER, displayName: 'Ana', accountStatus: 'ACTIVE', lastReviewedAt: null, lastReviewerUserId: null }],
      nextCursor: null,
      limit: 50,
      olderThanDays: 30,
      lookbackDays: 730,
    });
    expect('lastReviewedAt' in (last as object)).toBe(false);
  });

  it('registra una revisión sin cuerpo y lee la historia filtrada por cuenta', () => {
    client.recordAccessReview(USER).subscribe();
    const post = http.expectOne(`/authz/users/${USER}/access-reviews`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({});
    post.flush({
      id: 'r1',
      userId: USER,
      userDisplayName: 'Ana',
      reviewerUserId: ROLE,
      reviewerDisplayName: 'Luis',
      reviewedAt: '2026-10-31T00:00:00.000Z',
    });
    let when: Date | undefined;
    client.accessReviews({ userId: USER }).subscribe((r) => (when = r.items[0]?.reviewedAt));
    const get = http.expectOne((r) => r.url === '/authz/access-reviews');
    expect(get.request.params.get('userId')).toBe(USER);
    get.flush({
      items: [{ id: 'r1', userId: USER, userDisplayName: null, reviewerUserId: ROLE, reviewerDisplayName: null, reviewedAt: '2026-10-31T00:00:00.000Z' }],
      nextCursor: null,
      limit: 50,
    });
    expect(when).toBeInstanceOf(Date);
  });

  it('un 422 de revisión propia expone su reason estable', () => {
    let error: unknown;
    client.recordAccessReview(USER).subscribe({ error: (e: unknown) => (error = e) });
    http
      .expectOne(`/authz/users/${USER}/access-reviews`)
      .flush(
        { statusCode: 422, message: 'x', reason: 'ACCESS_REVIEW_SELF_REVIEW_FORBIDDEN' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    expect(rejectionReason(error)).toBe('ACCESS_REVIEW_SELF_REVIEW_FORBIDDEN');
  });

  it('lee el mapa de accesos con la última revisión convertida', () => {
    let when: Date | undefined;
    client.accessMap(USER).subscribe((m) => (when = m.lastReview?.reviewedAt));
    http.expectOne(`/authz/users/${USER}/access-map`).flush({
      user: { id: USER, displayName: 'Ana', accountStatus: 'ACTIVE' },
      globalRoles: ['SECURITY_ADMIN'],
      assignments: [],
      counts: { directGrants: 0, resourceScopeGrants: 1, restrictedFields: 2 },
      lastReview: { id: 'r1', userId: USER, userDisplayName: null, reviewerUserId: ROLE, reviewerDisplayName: null, reviewedAt: '2026-10-31T00:00:00.000Z' },
    });
    expect(when).toBeInstanceOf(Date);
  });

  it('lee quiénes tienen un permiso, con filtros sin vacíos', () => {
    let people = 0;
    client.permissionHolders('perm-1', { source: 'ROLE', q: '', limit: 25 }).subscribe((p) => (people = p.items.length));
    const req = http.expectOne((r) => r.url === '/authz/permissions/perm-1/holders');
    expect(req.request.params.get('source')).toBe('ROLE');
    expect(req.request.params.has('q')).toBe(false);
    req.flush({
      permissionId: 'perm-1',
      items: [{ userId: USER, displayName: 'Ana', accountStatus: 'ACTIVE', sources: [{ source: 'ROLE', effect: 'ALLOW', roleCode: 'DPO', viaRoleCode: 'DPO', resourceId: null, tenantId: null }] }],
      nextCursor: null,
      limit: 25,
    });
    expect(people).toBe(1);
  });
});
