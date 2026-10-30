import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthzAdminClient, rejectionReason } from './authz-admin.client';
import type { InternalUser, UserRoleAssignments } from './authz-admin.types';

const USER = '00000000-0000-4000-8000-000000000001';
const ASSIGNMENT = '00000000-0000-4000-8000-000000000002';

describe('AuthzAdminClient', () => {
  let client: AuthzAdminClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(AuthzAdminClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista usuarios internos con sus filtros y convierte las fechas', () => {
    let users: readonly InternalUser[] = [];
    client.internalUsers({ q: 'ana', roleCode: '', limit: 50 }).subscribe((p) => (users = p.items));
    const req = http.expectOne((r) => r.url === '/authz/internal-users');
    expect(req.request.params.get('q')).toBe('ana');
    expect(req.request.params.has('roleCode')).toBe(false);
    req.flush({
      items: [
        {
          id: USER,
          displayName: 'Ana',
          statusConceptId: 'c1',
          lastLoginAt: null,
          globalRoles: ['SECURITY_ADMIN'],
          assignments: [
            { assignmentId: ASSIGNMENT, roleCode: 'DPO', roleName: 'DPO', tenantId: null, validTo: '2027-01-01T00:00:00.000Z' },
          ],
        },
      ],
      nextCursor: null,
      limit: 50,
    });
    expect('lastLoginAt' in users[0]!).toBe(false);
    expect(users[0]!.assignments[0]!.validTo).toBeInstanceOf(Date);
  });

  it('lee las asignaciones de un usuario con su alcance', () => {
    let result: UserRoleAssignments | undefined;
    client.assignmentsOf(USER).subscribe((r) => (result = r));
    http.expectOne(`/authz/users/${USER}/role-assignments`).flush({
      userId: USER,
      items: [
        {
          id: ASSIGNMENT,
          roleId: 'r1',
          roleCode: 'DPO',
          roleName: 'Encargado de protección de datos',
          roleScope: 'GLOBAL',
          tenantId: null,
          branchId: null,
          practiceId: null,
          status: 'ACTIVE',
          validFrom: null,
          validTo: null,
          isEffective: true,
          appliesGlobally: true,
          assignedByUserId: null,
          createdAt: '2026-10-24T10:00:00.000Z',
        },
      ],
    });
    const item = result!.items[0]!;
    expect(item.createdAt).toBeInstanceOf(Date);
    expect('validFrom' in item).toBe(false);
    expect(item.appliesGlobally).toBe(true);
  });

  it('asigna con POST y revoca con DELETE sobre la asignación', () => {
    client.assignRole(USER, { roleId: 'r1' }).subscribe();
    const post = http.expectOne(`/authz/users/${USER}/role-assignments`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ roleId: 'r1' });
    post.flush({ id: ASSIGNMENT });

    client.revoke(USER, ASSIGNMENT).subscribe();
    const deletion = http.expectOne(`/authz/users/${USER}/role-assignments/${ASSIGNMENT}`);
    expect(deletion.request.method).toBe('DELETE');
    deletion.flush({ id: ASSIGNMENT, status: 'REVOKED', note: 'x' });
  });

  it('lee roles asignables, el catálogo de permisos y los permisos de un rol', () => {
    client.assignableRoles().subscribe();
    http.expectOne('/authz/roles').flush([]);
    client.permissions({ q: 'audit', cursor: 'c' }).subscribe();
    const perms = http.expectOne((r) => r.url === '/authz/permissions');
    expect(perms.request.params.get('q')).toBe('audit');
    expect(perms.request.params.get('cursor')).toBe('c');
    perms.flush({ items: [], nextCursor: null, limit: 50 });
    client.rolePermissions('r1').subscribe();
    http.expectOne('/authz/roles/r1/permissions').flush({ roleId: 'r1', roleCode: 'DPO', items: [] });
  });

  it('lee el nombre visible de una persona de su ficha de iam', () => {
    let name = '';
    client.displayNameOf(USER).subscribe((n) => (name = n));
    http.expectOne(`/iam/users/${USER}`).flush({ id: USER, displayName: 'Ana', statusConceptId: 'c1' });
    expect(name).toBe('Ana');
  });

  describe('rejectionReason', () => {
    const fail = (error: unknown) => new HttpErrorResponse({ status: 422, error });

    it('lee el motivo de la raíz del cuerpo, que es donde lo pone la API', () => {
      expect(
        rejectionReason(
          fail({ code: 'PRECONDITION_FAILED', message: 'x', reason: 'ROLE_ASSIGNMENT_GLOBAL_ROLE_WITH_SCOPE' }),
        ),
      ).toBe('ROLE_ASSIGNMENT_GLOBAL_ROLE_WITH_SCOPE');
    });

    it('también lo lee de details.reason', () => {
      expect(rejectionReason(fail({ code: 'FORBIDDEN', details: { reason: 'TENANT_REQUIRED' } }))).toBe(
        'TENANT_REQUIRED',
      );
    });

    it('sin motivo, o sin cuerpo JSON, devuelve null', () => {
      expect(rejectionReason(fail({ code: 'INTERNAL', message: 'x' }))).toBeNull();
      expect(rejectionReason(fail('<html>'))).toBeNull();
      expect(rejectionReason(new Error('x'))).toBeNull();
    });
  });
});
