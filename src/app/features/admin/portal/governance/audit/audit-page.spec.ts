import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { AuditPage } from './audit-page';

const SCREEN = '/superadmin/portal/governance/audit';
const ACTOR = '00000000-0000-4000-8000-000000000001';

const logEntry = {
  id: 'a1',
  userId: ACTOR,
  tenantId: null,
  action: 'ROLE_ASSIGNED',
  entity: 'user_role_assignment',
  entityId: null,
  result: 'SUCCESS',
  ip: null,
  method: 'POST',
  route: '/authz/users/:userId/role-assignments',
  healthRisk: 'CRITICAL',
  recordedAt: '2026-10-24T10:00:00.000Z',
};

describe('AuditPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  async function open(url = SCREEN): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'superadmin/portal/governance/audit', component: AuditPage }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, AuditPage);
    http
      .expectOne((r) => r.url === '/authz/internal-users' && r.params.get('limit') === '200')
      .flush({
        items: [{ id: ACTOR, displayName: 'Lucía Paredes', statusConceptId: 'c', lastLoginAt: null, globalRoles: ['SECURITY_ADMIN'], assignments: [] }],
        nextCursor: null,
        limit: 200,
      });
  }

  const text = () => (harness.routeNativeElement as HTMLElement).textContent ?? '';

  afterEach(() => http.verify());

  it('dibuja cada acción con su riesgo, su resultado, su ruta y el nombre de quien actuó', async () => {
    await open();
    http.expectOne((r) => r.url === '/audit/log').flush({ items: [logEntry], nextCursor: null, limit: 50 });
    harness.detectChanges();
    const table = harness.routeNativeElement!.querySelector('[data-testid="portal-audit-log-table"]')!;
    expect(table.textContent).toContain('Riesgo crítico');
    expect(table.textContent).toContain('Correcta');
    expect(table.textContent).toContain('role-assignments');
    expect(table.textContent).toContain('ROLE_ASSIGNED');
    expect(table.textContent).toContain('Lucía Paredes');
    // Nada de identificadores técnicos a la vista: el id del actor no se dibuja.
    expect(table.textContent).not.toContain(ACTOR);
  });

  it('manda a la API los filtros de la URL, con «hasta» incluido, y descarta los inválidos', async () => {
    await open(`${SCREEN}?result=FAILURE&method=GET&to=2026-10-24&userId=${ACTOR}`);
    const req = http.expectOne((r) => r.url === '/audit/log');
    expect(req.request.params.get('result')).toBe('FAILURE');
    expect(req.request.params.get('to')).toBe('2026-10-25');
    expect(req.request.params.get('userId')).toBe(ACTOR);
    expect(req.request.params.has('method')).toBe(false);
    expect(req.request.params.get('limit')).toBe('50');
    req.flush({ items: [], nextCursor: null, limit: 50 });
  });

  it('la pestaña de accesos a datos sensibles pide su propia bitácora', async () => {
    await open(`${SCREEN}?view=data-access&operation=EXPORT`);
    const req = http.expectOne((r) => r.url === '/audit/data-access');
    expect(req.request.params.get('operation')).toBe('EXPORT');
    req.flush({
      items: [
        {
          id: 'd1',
          userId: 'otro',
          tenantId: null,
          patientProfileId: null,
          operation: 'EXPORT',
          resourceType: 'AUDIT_LOG',
          resourceId: null,
          purpose: 'SECURITY_OVERSIGHT',
          healthRisk: 'LOW',
          recordedAt: '2026-10-20T10:00:00.000Z',
        },
      ],
      nextCursor: null,
      limit: 50,
    });
    harness.detectChanges();
    const table = harness.routeNativeElement!.querySelector('[data-testid="portal-audit-access-table"]')!;
    expect(table.textContent).toContain('Exportación');
    expect(table.textContent).toContain('Bitácora de acciones');
    expect(table.textContent).toContain('Supervisión de seguridad');
    expect(table.textContent).toContain('Usuario fuera de la consola');
  });

  it('sin resultados con filtros, ofrece quitarlos; sin filtros, mirar el último año', async () => {
    await open(`${SCREEN}?result=FAILURE`);
    http.expectOne((r) => r.url === '/audit/log').flush({ items: [], nextCursor: null, limit: 50 });
    harness.detectChanges();
    expect(text()).toContain('Ninguna acción coincide con los filtros elegidos.');
    expect(text()).toContain('Quitar los filtros');
  });

  it('sin filtros y sin acciones, propone ampliar el rango', async () => {
    await open();
    http.expectOne((r) => r.url === '/audit/log').flush({ items: [], nextCursor: null, limit: 50 });
    harness.detectChanges();
    expect(text()).toContain('No hay acciones registradas en los últimos 30 días.');
    expect(text()).toContain('Mirar el último año');
  });

  it('aplicar los filtros los escribe en la URL y vuelve a pedir la primera página', async () => {
    await open();
    http.expectOne((r) => r.url === '/audit/log').flush({ items: [logEntry], nextCursor: 'c2', limit: 50 });
    const page = harness.routeDebugElement!.componentInstance as unknown as {
      apply(filters: Record<string, string>): void;
    };
    page.apply({ result: 'SUCCESS', entity: 'role' });
    await harness.fixture.whenStable();
    const req = http.expectOne((r) => r.url === '/audit/log');
    expect(req.request.params.get('result')).toBe('SUCCESS');
    expect(req.request.params.get('entity')).toBe('role');
    expect(req.request.params.has('cursor')).toBe(false);
    req.flush({ items: [], nextCursor: null, limit: 50 });
  });
});
