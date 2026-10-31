import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { DecisionSimulator } from './decision-simulator';
import { WhoCanPage } from './who-can-page';

const SCREEN = '/superadmin/portal/governance/who-can';
const USER = '00000000-0000-4000-8000-00000000c002';
const TENANT = '00000000-0000-4000-8000-00000000c0a1';
const PATIENT = '00000000-0000-4000-8000-00000000d001';

const permission = (id: string, code: string, resource: string) => ({
  id,
  code,
  name: `Permiso ${code}`,
  resource,
  categoryId: null,
  isDangerous: false,
  isFieldLevel: false,
  isRoleRestricted: false,
});
const CATALOG = { items: [permission('p-read', 'AUDIT.READ', 'audit')], nextCursor: null, limit: 200 };
const ROLES = [
  { id: 'r-dpo', code: 'DPO', name: 'Protección de datos', isSystem: true, tenantId: null },
  { id: 'r-aud', code: 'AUDITOR', name: 'Auditor', isSystem: true, tenantId: null },
];

describe('WhoCanPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  async function open(url = SCREEN): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'superadmin/portal/governance/who-can', component: WhoCanPage }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, WhoCanPage);
  }

  const text = () => (harness.routeNativeElement as HTMLElement).textContent ?? '';
  afterEach(() => http.verify());

  describe('simulador', () => {
    interface Sim {
      userId: { set(v: string): void };
      tenantId: { set(v: string): void };
      action: { set(v: string): void };
      resource: { set(v: string): void };
      patientProfileId: { set(v: string): void };
      evaluate(): void;
    }

    async function openSimulator(): Promise<Sim> {
      await open();
      http.expectOne((r) => r.url === '/authz/internal-users').flush({
        items: [{ id: USER, displayName: 'Marcos Rivero', statusConceptId: 'c', globalRoles: [], assignments: [] }],
        nextCursor: null,
        limit: 200,
      });
      http.expectOne((r) => r.url === '/admin/tenants').flush({ items: [], nextCursor: null, limit: 100 });
      http.expectOne((r) => r.url === '/authz/permissions').flush(CATALOG);
      http.expectOne('/authz/roles').flush(ROLES);
      harness.detectChanges();
      return harness.routeDebugElement!.query(By.directive(DecisionSimulator)).componentInstance as unknown as Sim;
    }

    it('no pide nada al PDP hasta que se eligen persona, organización y recurso, y lo dice por campo', async () => {
      const sim = await openSimulator();
      sim.evaluate();
      harness.detectChanges();
      http.expectNone((r) => r.url === '/authz/decisions/evaluate');
      expect(text()).toContain('Elija la persona.');
      expect(text()).toContain('Elija la organización.');
      expect(text()).toContain('Elija el recurso.');
    });

    it('manda la consulta exacta al PDP real y muestra su decisión, sus roles y los campos enmascarados', async () => {
      const sim = await openSimulator();
      sim.userId.set(USER);
      sim.tenantId.set(TENANT);
      sim.resource.set('audit');
      sim.patientProfileId.set(PATIENT);
      sim.evaluate();
      const req = http.expectOne('/authz/decisions/evaluate');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ userId: USER, tenantId: TENANT, action: 'READ', resource: 'audit', patientProfileId: PATIENT });
      req.flush({
        decision: 'PERMIT',
        reason: 'Un rol efectivo lo permite',
        effectiveRoleIds: ['r-dpo'],
        maskedFields: [{ entity: 'patient_profile', columnName: 'national_id', strategy: 'PARTIAL' }],
        cacheKey: 'k',
        ttlSeconds: 30,
      });
      harness.detectChanges();
      const result = harness.routeNativeElement!.querySelector('[data-testid="portal-simulator-result"]')!.textContent!;
      expect(result).toContain('Permitido');
      expect(result).toContain('Un rol efectivo lo permite');
      expect(result).toContain('Protección de datos · DPO');
      expect(result).toContain('patient_profile.national_id');
      expect(result).toContain('Parcial');
    });

    it('un UUID mal escrito en el contexto no llega al PDP', async () => {
      const sim = await openSimulator();
      sim.userId.set(USER);
      sim.tenantId.set(TENANT);
      sim.resource.set('audit');
      sim.patientProfileId.set('paciente-1');
      sim.evaluate();
      http.expectNone((r) => r.url === '/authz/decisions/evaluate');
    });

    it('si la consulta falla, el resultado anterior se retira y se explica', async () => {
      const sim = await openSimulator();
      sim.userId.set(USER);
      sim.tenantId.set(TENANT);
      sim.resource.set('audit');
      sim.evaluate();
      http.expectOne('/authz/decisions/evaluate').flush({ decision: 'DENY', reason: 'x', effectiveRoleIds: [], maskedFields: [], cacheKey: 'k', ttlSeconds: 1 });
      harness.detectChanges();
      expect(harness.routeNativeElement!.querySelector('[data-testid="portal-simulator-result"]')).not.toBeNull();
      sim.evaluate();
      http.expectOne('/authz/decisions/evaluate').flush({ statusCode: 500, code: 'INTERNAL', message: 'x' }, { status: 500, statusText: 'Server Error' });
      harness.detectChanges();
      expect(harness.routeNativeElement!.querySelector('[data-testid="portal-simulator-result"]')).toBeNull();
      expect(harness.routeNativeElement!.querySelector('[data-testid="portal-simulator-error"]')).not.toBeNull();
    });
  });

  describe('quién puede qué', () => {
    it('sin permiso elegido orienta; con uno, cruza roles y personas', async () => {
      await open(`${SCREEN}?view=who-can&permission=p-read`);
      http.expectOne((r) => r.url === '/authz/permissions').flush(CATALOG);
      http.expectOne('/authz/roles').flush(ROLES);
      http.expectOne('/authz/roles/r-dpo/permissions').flush({
        roleId: 'r-dpo',
        roleCode: 'DPO',
        items: [{ permissionId: 'p-read', code: 'AUDIT.READ', name: 'x', resource: 'audit', effect: 'ALLOW', scope: 'GLOBAL' }],
      });
      http.expectOne('/authz/roles/r-aud/permissions').flush({ roleId: 'r-aud', roleCode: 'AUDITOR', items: [] });
      const people = http.expectOne((r) => r.url === '/authz/internal-users');
      expect(people.request.params.get('roleCode')).toBe('DPO');
      people.flush({
        items: [{ id: USER, displayName: 'Marcos Rivero', statusConceptId: 'c', globalRoles: [], assignments: [] }],
        nextCursor: null,
        limit: 200,
      });
      harness.detectChanges();
      const table = harness.routeNativeElement!.querySelector('[data-testid="portal-who-can-table"]')!.textContent!;
      expect(table).toContain('Protección de datos');
      expect(table).toContain('Permite');
      expect(table).toContain('Marcos Rivero');
      expect(table).not.toContain('Auditor');
    });

    it('si no se pudo leer algún rol lo dice: la lista puede estar incompleta', async () => {
      await open(`${SCREEN}?view=who-can&permission=p-read`);
      http.expectOne((r) => r.url === '/authz/permissions').flush(CATALOG);
      http.expectOne('/authz/roles').flush(ROLES);
      http.expectOne('/authz/roles/r-dpo/permissions').flush({ statusCode: 500, code: 'INTERNAL', message: 'x' }, { status: 500, statusText: 'Server Error' });
      http.expectOne('/authz/roles/r-aud/permissions').flush({ roleId: 'r-aud', roleCode: 'AUDITOR', items: [] });
      harness.detectChanges();
      expect(harness.routeNativeElement!.querySelector('[data-testid="portal-who-can-partial"]')!.textContent).toContain('1 rol');
      expect(text()).toContain('Ningún rol permite ni niega este permiso');
    });

    it('sin permiso elegido no lee los permisos de ningún rol', async () => {
      await open(`${SCREEN}?view=who-can`);
      http.expectOne((r) => r.url === '/authz/permissions').flush(CATALOG);
      http.expectOne('/authz/roles').flush(ROLES);
      harness.detectChanges();
      http.expectNone((r) => r.url.endsWith('/permissions') && r.url !== '/authz/permissions');
      expect(text()).toContain('Elija un permiso');
    });
  });
});
