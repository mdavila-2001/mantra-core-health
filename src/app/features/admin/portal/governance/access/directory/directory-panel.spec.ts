import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { DirectoryPanel } from './directory-panel';
import { permissionsLine, visibleEmail } from './directory.model';

const SCREEN = '/superadmin/portal/governance/users';
const row = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  type: 'PATIENT',
  displayName: 'Ana Rojas (simulado)',
  maskedEmail: 'a***@e***.test',
  statusConceptId: '00000000-0000-4000-8000-00000000c0f2',
  mfaStatusConceptId: null,
  lastLoginAt: null,
  roles: [{ assignmentId: 'as1', roleCode: 'PATIENT', roleName: 'Paciente', tenantId: null, validTo: null }],
  permissions: { allowed: 6, denied: 1, dangerous: 2, directGrants: 1 },
  ...over,
});

describe('DirectoryPanel', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  async function open(query = ''): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'superadmin/portal/governance/users', component: DirectoryPanel }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(`${SCREEN}${query}`, DirectoryPanel);
  }
  const request = () => http.expectOne((r) => r.url === '/authz/users/directory');
  const el = () => harness.routeNativeElement as HTMLElement;

  afterEach(() => http.verify());

  it('lists every kind of account with type, state, roles and a permissions summary, e-mail masked', async () => {
    await open();
    request().flush({ items: [row()], nextCursor: null, limit: 50, scope: 'PLATFORM', source: 'SIMULATED' });
    harness.detectChanges();
    const table = el().querySelector('[data-testid="portal-directory-table"]')!.textContent!;
    expect(table).toContain('Ana Rojas (simulado)');
    expect(table).toContain('a***@e***.test');
    expect(table).toContain('Paciente');
    expect(table).toContain('Concepto …c0f2');
    expect(table).toContain('PATIENT');
    expect(table).toContain('6 permitidos · 1 denegados · 2 sensibles · 1 directos');
    expect(table).toContain('Nunca ingresó');
    expect(el().querySelector('[data-testid="directory-simulated"]')).not.toBeNull();
    expect(el().textContent).toContain('Abarca toda la plataforma');
  });

  it('reads the type from the URL, offers one chip per type and has no free-text search', async () => {
    await open('?type=PRACTITIONER&q=ana');
    const req = request();
    expect(req.request.params.get('type')).toBe('PRACTITIONER');
    expect(req.request.params.has('q')).toBe(false);
    req.flush({ items: [row({ type: 'PRACTITIONER' })], nextCursor: null, limit: 50, scope: 'TENANT' });
    harness.detectChanges();
    expect(el().textContent).toContain('Profesionales');
    expect(el().textContent).toContain('Se limita a su organización');
    expect(el().querySelector('input[type="search"]')).toBeNull();
    expect(el().querySelector('[data-testid="directory-simulated"]')).toBeNull();
  });

  it('ignores a type in the URL that the contract does not know', async () => {
    await open('?type=ROBOT');
    expect(request().request.params.has('type')).toBe(false);
  });

  it('empty with a type offers to drop the filter', async () => {
    await open('?type=PHARMACY');
    request().flush({ items: [], nextCursor: null, limit: 50, scope: 'TENANT' });
    harness.detectChanges();
    expect(el().textContent).toContain('Quitar el filtro');
  });

  it('a 403 TENANT_REQUIRED is shown as forbidden, not as an empty list', async () => {
    await open();
    request().flush(
      { statusCode: 403, message: 'La consulta se limita a una organización', reason: 'TENANT_REQUIRED' },
      { status: 403, statusText: 'Forbidden' },
    );
    harness.detectChanges();
    expect(el().querySelector('[data-testid="portal-directory-table"]')!.textContent).not.toContain('Ana Rojas');
    expect(el().textContent).not.toContain('Ninguna cuenta');
  });

  it('a server error shows the unexpected-error state with its request id and retries', async () => {
    await open();
    request().flush(
      { statusCode: 500, message: 'boom', requestId: 'req-g-123' },
      { status: 500, statusText: 'Server Error', headers: { 'x-request-id': 'req-g-123' } },
    );
    harness.detectChanges();
    expect(el().textContent).toContain('req-g-123');
    const retry = Array.from(el().querySelectorAll('button')).find((b) => /reintentar/i.test(b.textContent ?? ''));
    expect(retry).toBeDefined();
    retry!.click();
    request().flush({ items: [row()], nextCursor: null, limit: 50 });
    harness.detectChanges();
    expect(el().textContent).toContain('Ana Rojas');
  });

  it('only internal accounts link to the access drawer', async () => {
    await open();
    request().flush({
      items: [row(), row({ id: 'u2', type: 'INTERNAL', displayName: 'Lucía' })],
      nextCursor: null,
      limit: 50,
    });
    harness.detectChanges();
    const links = Array.from(el().querySelectorAll('a')).map((a) => a.textContent?.trim());
    expect(links).toContain('Lucía');
    expect(links).not.toContain('Ana Rojas (simulado)');
  });

  it('never shows an e-mail that arrives unmasked', () => {
    expect(visibleEmail('ana@gmail.com')).toBe('Correo no disponible');
    expect(visibleEmail('a***@g***.com')).toBe('a***@g***.com');
    expect(visibleEmail(null)).toContain('Sin correo');
    expect(permissionsLine({ allowed: 0, denied: 0, dangerous: 0, directGrants: 0 })).toBe('Sin permisos');
  });
});
