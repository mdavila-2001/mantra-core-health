import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { DirectoryPanel } from './directory-panel';
import { permissionsLine, visibleEmail } from './directory.model';

const SCREEN = '/superadmin/portal/governance/users';
const counts = { PATIENT: 2, DOCTOR: 1, PHARMACY: 0, LABORATORY: 0, INTERNAL: 0 };
const row = (over: Record<string, unknown> = {}) => ({
  id: 'u1',
  type: 'PATIENT',
  displayName: 'Ana Rojas (simulado)',
  maskedEmail: 'a***@ejemplo.test',
  status: 'SUSPENDED',
  lastLoginAt: null,
  roles: [{ code: 'PATIENT', name: 'Paciente' }],
  permissions: { allowed: 6, denied: 1, dangerous: 2, resources: ['own_record'] },
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
  const request = () => http.expectOne((r) => r.url === '/authz/directory-users');
  const el = () => harness.routeNativeElement as HTMLElement;

  afterEach(() => http.verify());

  it('lists every kind of account with type, status, roles and a permissions summary, e-mail masked', async () => {
    await open();
    request().flush({ items: [row()], nextCursor: null, limit: 50, typeCounts: counts, source: 'SIMULATED' });
    harness.detectChanges();
    const table = el().querySelector('[data-testid="portal-directory-table"]')!.textContent!;
    expect(table).toContain('Ana Rojas (simulado)');
    expect(table).toContain('a***@ejemplo.test');
    expect(table).toContain('Paciente');
    expect(table).toContain('Suspendido');
    expect(table).toContain('PATIENT');
    expect(table).toContain('6 permitidos · 1 denegados · 2 sensibles');
    expect(table).toContain('Nunca ingresó');
    expect(el().querySelector('[data-testid="directory-simulated"]')).not.toBeNull();
  });

  it('reads type and status from the URL and offers one chip per type with its count', async () => {
    await open('?type=DOCTOR&status=ACTIVE&q=%20ana%20');
    const req = request();
    expect(req.request.params.get('type')).toBe('DOCTOR');
    expect(req.request.params.get('status')).toBe('ACTIVE');
    expect(req.request.params.get('q')).toBe('ana');
    req.flush({ items: [row({ type: 'DOCTOR' })], nextCursor: null, limit: 50, typeCounts: counts });
    harness.detectChanges();
    expect(el().textContent).toContain('Pacientes · 2');
    expect(el().textContent).toContain('Médicos · 1');
    expect(el().querySelector('[data-testid="directory-simulated"]')).toBeNull();
  });

  it('ignores a type in the URL that the contract does not know', async () => {
    await open('?type=ROBOT');
    expect(request().request.params.has('type')).toBe(false);
  });

  it('says the list is partial when a source could not be read, and keeps showing the rest', async () => {
    await open();
    request().flush({ items: [row()], nextCursor: null, limit: 50, typeCounts: counts, unavailableTypes: ['LABORATORY'] });
    harness.detectChanges();
    const partial = el().querySelector('[data-testid="directory-partial"]')!;
    expect(partial.textContent).toContain('laboratorios');
    expect(el().textContent).toContain('Ana Rojas');
  });

  it('empty with filters offers to drop them; empty without filters offers the internal users', async () => {
    await open('?status=BLOCKED');
    request().flush({ items: [], nextCursor: null, limit: 50, typeCounts: counts });
    harness.detectChanges();
    expect(el().textContent).toContain('Quitar los filtros');
    expect(el().textContent).toContain('Ninguna cuenta coincide');
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
    request().flush({ items: [row()], nextCursor: null, limit: 50, typeCounts: counts });
    harness.detectChanges();
    expect(el().textContent).toContain('Ana Rojas');
  });

  it('only internal accounts link to the access drawer', async () => {
    await open();
    request().flush({
      items: [row(), row({ id: 'u2', type: 'INTERNAL', displayName: 'Lucía' })],
      nextCursor: null,
      limit: 50,
      typeCounts: counts,
    });
    harness.detectChanges();
    const links = Array.from(el().querySelectorAll('a')).map((a) => a.textContent?.trim());
    expect(links).toContain('Lucía');
    expect(links).not.toContain('Ana Rojas (simulado)');
  });

  it('never shows an e-mail that arrives unmasked', () => {
    expect(visibleEmail('ana@gmail.com')).toBe('Correo no disponible');
    expect(visibleEmail('a***@gmail.com')).toBe('a***@gmail.com');
    expect(visibleEmail(null)).toBe('Sin correo registrado');
    expect(permissionsLine({ allowed: 0, denied: 0, dangerous: 0, resources: [] })).toBe('Sin permisos');
  });
});
