import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthzAdminClient } from './authz-admin.client';
import type { DirectoryUsersPage } from './authz-admin-directory.types';

const ID = '00000000-0000-4000-8000-000000000001';

describe('AuthzAdminClient.directoryUsers (API PR #1409)', () => {
  let client: AuthzAdminClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    client = TestBed.inject(AuthzAdminClient);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  function read(body: object, query = {}): DirectoryUsersPage {
    let page: DirectoryUsersPage | undefined;
    client.directoryUsers(query).subscribe((p) => (page = p));
    http.expectOne((r) => r.url === '/authz/users/directory').flush(body);
    return page!;
  }

  it('calls GET /authz/users/directory and sends only the filters that have a value', () => {
    client.directoryUsers({ type: 'PRACTITIONER', status: undefined, roleCode: '', limit: 50, cursor: 'abc' }).subscribe();
    const req = http.expectOne((r) => r.url === '/authz/users/directory');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('type')).toBe('PRACTITIONER');
    expect(req.request.params.get('cursor')).toBe('abc');
    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.has('status')).toBe(false);
    expect(req.request.params.has('roleCode')).toBe(false);
    req.flush({ items: [], nextCursor: null, limit: 50, scope: 'TENANT' });
  });

  it('maps the published DTO and keeps only whitelisted fields: password, document and phone never get through', () => {
    const page = read({
      items: [
        {
          id: ID,
          displayName: 'Ana',
          type: 'PRACTITIONER',
          statusConceptId: '00000000-0000-4000-8000-000000000001',
          mfaStatusConceptId: null,
          lastLoginAt: '2026-11-06T12:00:00.000000Z',
          maskedEmail: 'a***@c***.org',
          roles: [{ assignmentId: 'as1', roleCode: 'BILLING', roleName: 'Billing', tenantId: 't1', validTo: '2027-01-01T00:00:00.000Z', secret: 'x' }],
          permissions: { allowed: 12, denied: 1, dangerous: 2, directGrants: 1, debug: 1 },
          passwordHash: '$2b$10$abc',
          documentNumber: '1234567',
          phone: '+59170000000',
        },
      ],
      nextCursor: 'c2',
      limit: 50,
      scope: 'TENANT',
    });
    const wire = JSON.stringify(page);
    for (const leaked of ['passwordHash', '$2b$', 'documentNumber', '1234567', 'phone', '+5917', 'secret', 'debug']) {
      expect(wire).not.toContain(leaked);
    }
    const user = page.items[0]!;
    expect(user.type).toBe('PRACTITIONER');
    expect(user.lastLoginAt).toBeInstanceOf(Date);
    expect(user.roles[0]).toMatchObject({ assignmentId: 'as1', roleCode: 'BILLING', tenantId: 't1' });
    expect(user.roles[0]!.validTo).toBeInstanceOf(Date);
    expect(user.permissions).toEqual({ allowed: 12, denied: 1, dangerous: 2, directGrants: 1 });
    expect(page.nextCursor).toBe('c2');
    expect(page.scope).toBe('TENANT');
    expect(page.source).toBeNull();
  });

  it('keeps a row of a kind the front does not know as OTHER, tolerates nulls and reads the simulator marker', () => {
    const page = read({
      items: [
        { id: ID, type: 'ROBOT', displayName: 'x', maskedEmail: null, roles: [], permissions: {} },
        { id: '', type: 'PATIENT' },
      ],
      limit: 50,
      scope: 'GALAXY',
      source: 'SIMULATED',
    });
    expect(page.items.map((u) => u.type)).toEqual(['OTHER']);
    expect(page.items[0]!.maskedEmail).toBeNull();
    expect('lastLoginAt' in page.items[0]!).toBe(false);
    expect(page.items[0]!.permissions.allowed).toBe(0);
    expect(page.scope).toBeNull();
    expect(page.source).toBe('SIMULATED');
    expect(page.nextCursor).toBeNull();
  });
});
