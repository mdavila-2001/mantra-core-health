import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { DecisionSimulator } from './decision-simulator';
import { WhoCanPage } from './who-can-page';
import { WhoCanPanel } from './who-can-panel';

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
      http.expectNone((r) => r.url === '/authz/simulations');
      expect(text()).toContain('Elija la persona.');
      expect(text()).toContain('Elija la organización.');
      expect(text()).toContain('Elija el recurso.');
    });

    it('manda la consulta exacta al simulador del PDP real y muestra su decisión, sus roles y los campos enmascarados', async () => {
      const sim = await openSimulator();
      sim.userId.set(USER);
      sim.tenantId.set(TENANT);
      sim.resource.set('audit');
      sim.patientProfileId.set(PATIENT);
      sim.evaluate();
      const req = http.expectOne('/authz/simulations');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ userId: USER, tenantId: TENANT, action: 'READ', resource: 'audit', patientProfileId: PATIENT });
      req.flush({
        simulated: true,
        decision: {
          decision: 'PERMIT',
          reason: 'Un rol efectivo lo permite',
          effectiveRoleIds: ['r-dpo'],
          maskedFields: [{ entity: 'patient_profile', columnName: 'national_id', strategy: 'PARTIAL' }],
          cacheKey: 'k',
          ttlSeconds: 30,
        },
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
      http.expectNone((r) => r.url === '/authz/simulations');
    });

    it('si la consulta falla, el resultado anterior se retira y se explica', async () => {
      const sim = await openSimulator();
      sim.userId.set(USER);
      sim.tenantId.set(TENANT);
      sim.resource.set('audit');
      sim.evaluate();
      http
        .expectOne('/authz/simulations')
        .flush({ simulated: true, decision: { decision: 'DENY', reason: 'x', effectiveRoleIds: [], maskedFields: [], cacheKey: 'k', ttlSeconds: 1 } });
      harness.detectChanges();
      expect(harness.routeNativeElement!.querySelector('[data-testid="portal-simulator-result"]')).not.toBeNull();
      sim.evaluate();
      http.expectOne('/authz/simulations').flush({ statusCode: 500, code: 'INTERNAL', message: 'x' }, { status: 500, statusText: 'Server Error' });
      harness.detectChanges();
      expect(harness.routeNativeElement!.querySelector('[data-testid="portal-simulator-result"]')).toBeNull();
      expect(harness.routeNativeElement!.querySelector('[data-testid="portal-simulator-error"]')).not.toBeNull();
    });
  });

  describe('quién puede qué', () => {
    const holder = (id: string, name: string, sources: unknown[], accountStatus = 'ACTIVE') => ({ userId: id, displayName: name, accountStatus, sources });
    const roleSource = (roleCode: string, viaRoleCode: string, effect = 'ALLOW') => ({
      source: 'ROLE',
      effect,
      roleCode,
      viaRoleCode,
      resourceId: null,
      tenantId: null,
    });
    const page = (items: unknown[], nextCursor: string | null = null) => ({ permissionId: 'p-read', items, nextCursor, limit: 50 });

    async function openWho(query = '?view=who-can&permission=p-read'): Promise<void> {
      await open(`${SCREEN}${query}`);
      http.expectOne((r) => r.url === '/authz/permissions').flush(CATALOG);
    }

    it('con un permiso elegido lista a las PERSONAS y el camino por el que lo tienen, sin leer roles uno por uno', async () => {
      await openWho();
      const req = http.expectOne((r) => r.url === '/authz/permissions/p-read/holders');
      expect(req.request.params.get('limit')).toBe('50');
      expect(req.request.params.has('source')).toBe(false);
      req.flush(
        page([
          holder(USER, 'Marcos Rivero', [roleSource('DPO', 'DPO')]),
          holder('u2', 'Elena Quispe', [roleSource('AUDITOR_JR', 'AUDITOR', 'DENY'), { source: 'RESOURCE', effect: 'ALLOW', roleCode: null, viaRoleCode: null, resourceId: PATIENT, tenantId: null }], 'LOCKED'),
        ]),
      );
      harness.detectChanges();
      http.expectNone((r) => r.url === '/authz/roles');
      const table = harness.routeNativeElement!.querySelector('[data-testid="portal-who-can-table"]')!.textContent!;
      expect(table).toContain('Marcos Rivero');
      expect(table).toContain('Permite');
      expect(table).toContain('Elena Quispe');
      expect(table).toContain('Bloqueada');
      expect(table).toContain('Niega');
      expect(table).toContain('AUDITOR_JR, heredado de AUDITOR');
      expect(table).toContain('Sobre un recurso');
    });

    it('sin permiso elegido orienta y no pregunta quién lo tiene', async () => {
      await openWho('?view=who-can');
      harness.detectChanges();
      http.expectNone((r) => r.url.endsWith('/holders'));
      expect(text()).toContain('Elija un permiso');
    });

    it('un permiso que nadie tiene orienta hacia Roles y permisos', async () => {
      await openWho();
      http.expectOne((r) => r.url === '/authz/permissions/p-read/holders').flush(page([]));
      harness.detectChanges();
      expect(text()).toContain('Nadie lo tiene hoy');
    });

    it('el filtro de camino y el buscador viajan a la API y vuelven a la primera página', async () => {
      await openWho();
      http.expectOne((r) => r.url === '/authz/permissions/p-read/holders').flush(page([holder(USER, 'Marcos Rivero', [roleSource('DPO', 'DPO')])], 'c2'));
      harness.detectChanges();
      const panel = harness.routeDebugElement!.query(By.directive(WhoCanPanel)).componentInstance as unknown as {
        source: { set(v: string): void };
        query: { set(v: string): void };
      };
      panel.source.set('RESOURCE');
      panel.query.set('  Elena ');
      harness.detectChanges();
      const filtered = http.expectOne((r) => r.url === '/authz/permissions/p-read/holders');
      expect(filtered.request.params.get('source')).toBe('RESOURCE');
      expect(filtered.request.params.get('q')).toBe('Elena');
      expect(filtered.request.params.has('cursor')).toBe(false);
      filtered.flush(page([]));
      harness.detectChanges();
      expect(text()).toContain('Nadie coincide con ese filtro');
    });

    it('una administración acotada a una organización recibe un 403 y no ve una lista vacía engañosa', async () => {
      await openWho();
      http
        .expectOne((r) => r.url === '/authz/permissions/p-read/holders')
        .flush({ statusCode: 403, code: 'FORBIDDEN', message: 'x', reason: 'ROLE_INSUFFICIENT' }, { status: 403, statusText: 'Forbidden' });
      harness.detectChanges();
      expect(text()).not.toContain('Nadie lo tiene hoy');
    });

    it('si el catálogo de permisos no llega lo avisa', async () => {
      await open(`${SCREEN}?view=who-can`);
      http.expectOne((r) => r.url === '/authz/permissions').flush({ statusCode: 500, code: 'INTERNAL', message: 'x' }, { status: 500, statusText: 'Server Error' });
      harness.detectChanges();
      expect(harness.routeNativeElement!.querySelector('[data-testid="portal-who-can-catalog-error"]')).not.toBeNull();
    });
  });
});
