import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { DialogService } from '../../../../../shared/components/molecules/dialog/dialog-service';
import { AccessPage } from './access-page';

const SCREEN = '/superadmin/portal/governance/users';
const USER = '00000000-0000-4000-8000-000000000001';
const STRANGER = '00000000-0000-4000-8000-000000000009';
const ASSIGNMENT = '00000000-0000-4000-8000-0000000000a1';

const internalUser = {
  id: USER,
  displayName: 'Elena Quispe',
  statusConceptId: 'c',
  lastLoginAt: null,
  globalRoles: [],
  assignments: [{ assignmentId: ASSIGNMENT, roleCode: 'DPO', roleName: 'Protección de datos', tenantId: null, validTo: null }],
};

const assignment = {
  id: ASSIGNMENT,
  roleId: 'r1',
  roleCode: 'DPO',
  roleName: 'Protección de datos',
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
  createdAt: '2026-10-01T10:00:00.000Z',
};

describe('AccessPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let confirmed: boolean;

  async function open(url = SCREEN): Promise<void> {
    confirmed = true;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'superadmin/portal/governance/users', component: AccessPage }]),
        { provide: DialogService, useValue: { confirm: () => Promise.resolve(confirmed) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, AccessPage);
    // La pantalla lee los roles para su filtro; el panel de permisos por rol, para su selector.
    for (const req of http.match('/authz/roles')) {
      req.flush([{ id: 'r1', code: 'DPO', name: 'Protección de datos', isSystem: true, tenantId: null }]);
    }
  }

  function users() {
    return http.expectOne((r) => r.url === '/authz/internal-users');
  }

  const text = () => (harness.routeNativeElement as HTMLElement).textContent ?? '';
  const drawer = () => document.querySelector('[data-testid="portal-user-access"]');

  afterEach(() => http.verify());

  it('las pestañas que no se ven no piden nada', async () => {
    await open();
    users().flush({ items: [], nextCursor: null, limit: 50 });
    http.expectNone((r) => r.url === '/authz/permissions' || r.url.endsWith('/permissions'));
  });

  it('lista a las personas internas con sus roles y sin mostrar identificadores', async () => {
    await open(`${SCREEN}?q=elena&roleCode=DPO`);
    const req = users();
    expect(req.request.params.get('q')).toBe('elena');
    expect(req.request.params.get('roleCode')).toBe('DPO');
    req.flush({ items: [internalUser], nextCursor: null, limit: 50 });
    harness.detectChanges();
    const table = harness.routeNativeElement!.querySelector('[data-testid="portal-internal-users-table"]')!;
    expect(table.textContent).toContain('Elena Quispe');
    expect(table.textContent).toContain('DPO');
    expect(table.textContent).toContain('Nunca ingresó');
    expect(table.textContent).not.toContain(USER);
  });

  it('el cajón de una persona muestra sus asignaciones con el alcance en palabras', async () => {
    await open(`${SCREEN}?user=${USER}`);
    users().flush({ items: [internalUser], nextCursor: null, limit: 50 });
    http.expectOne(`/authz/users/${USER}/role-assignments`).flush({ userId: USER, items: [assignment] });
    harness.detectChanges();
    expect(drawer()!.textContent).toContain('Protección de datos');
    expect(drawer()!.textContent).toContain('Ámbito global');
    expect(drawer()!.textContent).toContain('En toda la plataforma');
    expect(drawer()!.textContent).toContain('Vale hoy');
  });

  it('quien no está en la lista se nombra con su ficha, una sola vez', async () => {
    await open(`${SCREEN}?user=${STRANGER}`);
    http.expectOne(`/authz/users/${STRANGER}/role-assignments`).flush({ userId: STRANGER, items: [] });
    users().flush({ items: [internalUser], nextCursor: null, limit: 50 });
    harness.detectChanges();
    http.expectOne(`/iam/users/${STRANGER}`).flush({ id: STRANGER, displayName: 'Persona nueva' });
    harness.detectChanges();
    expect(document.body.textContent).toContain('Persona nueva');
    expect(drawer()!.textContent).toContain('Todavía no tiene asignaciones de rol');
  });

  it('revocar pide confirmación, llama a la API y vuelve a leer el cajón y la lista', async () => {
    await open(`${SCREEN}?user=${USER}`);
    users().flush({ items: [internalUser], nextCursor: null, limit: 50 });
    http.expectOne(`/authz/users/${USER}/role-assignments`).flush({ userId: USER, items: [assignment] });
    harness.detectChanges();

    (drawer()!.querySelector('[data-testid="portal-assignment-revoke"]') as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    const deletion = http.expectOne(`/authz/users/${USER}/role-assignments/${ASSIGNMENT}`);
    expect(deletion.request.method).toBe('DELETE');
    deletion.flush({ id: ASSIGNMENT, status: 'REVOKED', note: 'x' });
    http
      .expectOne(`/authz/users/${USER}/role-assignments`)
      .flush({ userId: USER, items: [{ ...assignment, status: 'REVOKED', isEffective: false }] });
    users().flush({ items: [], nextCursor: null, limit: 50 });
    harness.detectChanges();
    expect(drawer()!.textContent).toContain('Se revocó el rol «Protección de datos» de Elena Quispe.');
    expect(drawer()!.textContent).toContain('Revocada');
    expect(drawer()!.querySelector('[data-testid="portal-assignment-revoke"]')).toBeNull();
  });

  it('si la persona se arrepiente, no se revoca nada', async () => {
    await open(`${SCREEN}?user=${USER}`);
    confirmed = false;
    users().flush({ items: [internalUser], nextCursor: null, limit: 50 });
    http.expectOne(`/authz/users/${USER}/role-assignments`).flush({ userId: USER, items: [assignment] });
    harness.detectChanges();
    (drawer()!.querySelector('[data-testid="portal-assignment-revoke"]') as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    http.expectNone(`/authz/users/${USER}/role-assignments/${ASSIGNMENT}`);
  });

  it('un rechazo por asignación ya inactiva se explica por su motivo y relee el cajón', async () => {
    await open(`${SCREEN}?user=${USER}`);
    users().flush({ items: [internalUser], nextCursor: null, limit: 50 });
    http.expectOne(`/authz/users/${USER}/role-assignments`).flush({ userId: USER, items: [assignment] });
    harness.detectChanges();
    (drawer()!.querySelector('[data-testid="portal-assignment-revoke"]') as HTMLButtonElement).click();
    await harness.fixture.whenStable();
    http.expectOne(`/authz/users/${USER}/role-assignments/${ASSIGNMENT}`).flush(
      { code: 'PRECONDITION_FAILED', message: 'La asignación de rol no está activa', reason: 'ROLE_ASSIGNMENT_NOT_ACTIVE', timestamp: '', path: '' },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    http.expectOne(`/authz/users/${USER}/role-assignments`).flush({ userId: USER, items: [] });
    harness.detectChanges();
    expect(drawer()!.textContent).toContain('Esa asignación ya no estaba activa.');
  });

  it('la pestaña de permisos por rol lee el rol de la URL', async () => {
    await open(`${SCREEN}?view=role-permissions&role=r1`);
    users().flush({ items: [], nextCursor: null, limit: 50 });
    http.expectOne('/authz/roles/r1/permissions').flush({
      roleId: 'r1',
      roleCode: 'DPO',
      items: [{ permissionId: 'p1', code: 'AUDIT.READ', name: 'Leer la bitácora', resource: 'audit', effect: 'DENY', scope: 'GLOBAL' }],
    });
    harness.detectChanges();
    const table = harness.routeNativeElement!.querySelector('[data-testid="portal-role-permissions-table"]')!;
    expect(table.textContent).toContain('Leer la bitácora');
    expect(table.textContent).toContain('Niega');
    expect(text()).toContain('Permisos por rol');
  });
});
