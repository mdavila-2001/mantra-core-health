import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { AuthzAdminClient } from './authz-admin.client';
import type { DirectoryUsersPage } from './authz-admin-directory.types';

const ID = '00000000-0000-4000-8000-000000000001';

describe('AuthzAdminClient.directoryUsers (provisional contract)', () => {
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
    http.expectOne((r) => r.url === '/authz/directory-users').flush(body);
    return page!;
  }

  it('sends only the filters that have a value', () => {
    client.directoryUsers({ q: '', type: 'DOCTOR', status: undefined, limit: 50 }).subscribe();
    const req = http.expectOne((r) => r.url === '/authz/directory-users');
    expect(req.request.params.get('type')).toBe('DOCTOR');
    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.has('status')).toBe(false);
    req.flush({ items: [], nextCursor: null, limit: 50 });
  });

  it('keeps only the whitelisted fields: password, document and phone never get through', () => {
    const page = read({
      items: [
        {
          id: ID,
          type: 'PATIENT',
          displayName: 'Ana',
          maskedEmail: 'a***@ejemplo.test',
          status: 'ACTIVE',
          lastLoginAt: '2026-11-01T10:00:00.000Z',
          roles: [{ code: 'PATIENT', name: 'Paciente', secret: 'x' }],
          permissions: { allowed: 3, denied: 1, dangerous: 0, resources: ['appointments'], debug: 1 },
          passwordHash: '$2b$10$abc',
          documentNumber: '1234567',
          phone: '+59170000000',
        },
      ],
      nextCursor: 'c2',
      limit: 50,
      typeCounts: { PATIENT: 1, DOCTOR: 0, PHARMACY: 0, LABORATORY: 0, INTERNAL: 0 },
    });
    const wire = JSON.stringify(page);
    for (const leaked of ['passwordHash', '$2b$', 'documentNumber', '1234567', 'phone', '+5917', 'secret', 'debug']) {
      expect(wire).not.toContain(leaked);
    }
    const user = page.items[0]!;
    expect(user.lastLoginAt).toBeInstanceOf(Date);
    expect(user.roles).toEqual([{ code: 'PATIENT', name: 'Paciente' }]);
    expect(page.nextCursor).toBe('c2');
    expect(page.typeCounts!.PATIENT).toBe(1);
    expect(page.source).toBeNull();
  });

  it('drops rows of an unknown type, maps unknown states to OTHER and reads partial + simulated markers', () => {
    const page = read({
      items: [
        { id: ID, type: 'ROBOT', displayName: 'x', status: 'ACTIVE' },
        { id: 'b', type: 'DOCTOR', displayName: 'Dr. B', maskedEmail: null, status: 'ARCHIVED', roles: [], permissions: {} },
      ],
      limit: 50,
      unavailableTypes: ['LABORATORY', 'NOPE'],
      source: 'SIMULATED',
    });
    expect(page.items.map((u) => u.id)).toEqual(['b']);
    expect(page.items[0]!.status).toBe('OTHER');
    expect(page.items[0]!.maskedEmail).toBeNull();
    expect('lastLoginAt' in page.items[0]!).toBe(false);
    expect(page.items[0]!.permissions.allowed).toBe(0);
    expect(page.unavailableTypes).toEqual(['LABORATORY']);
    expect(page.source).toBe('SIMULATED');
    expect(page.nextCursor).toBeNull();
  });
});
