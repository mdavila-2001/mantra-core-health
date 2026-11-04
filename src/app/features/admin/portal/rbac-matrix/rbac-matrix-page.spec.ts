import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import type { ModulesCatalog } from '../../../../core/data-access/authz-governance/authz-modules-catalog.types';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { RbacMatrixPage } from './rbac-matrix-page';
import { ROLE_FIN, fixtureCatalog } from './rbac-matrix.fixture';
import { RoleViewEditor } from './role-view-editor';

const SCREEN = '/superadmin/portal/governance/rbac-matrix';

type Wire = Omit<ModulesCatalog, 'generatedAt'> & { generatedAt: string };
const wire = (over: Partial<Wire> = {}): Wire => ({
  ...fixtureCatalog(),
  generatedAt: '2026-10-31T10:00:00.000Z',
  ...over,
});

describe('RbacMatrixPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let confirmed: boolean;
  let confirmDetails: readonly { label: string; value: string }[] | undefined;

  async function open(url = SCREEN, body: Wire = wire()): Promise<void> {
    confirmed = true;
    confirmDetails = undefined;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'superadmin/portal/governance/rbac-matrix', component: RbacMatrixPage },
        ]),
        {
          provide: DialogService,
          useValue: {
            confirmarCambios: (config: {
              details?: readonly { label: string; value: string }[];
            }) => {
              confirmDetails = config.details;
              return Promise.resolve(confirmed);
            },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, RbacMatrixPage);
    http.expectOne('/authz/catalog/modules').flush(body);
    harness.detectChanges();
  }

  const host = () => harness.routeNativeElement as HTMLElement;
  const text = () => host().textContent ?? '';
  const editor = () =>
    harness.routeDebugElement!.query(By.directive(RoleViewEditor)).componentInstance as unknown as {
      setEffect(id: string, effect: string): void;
      save(): void;
    };

  afterEach(() => http.verify());

  it('lee el catálogo una vez, avisa lo que no demuestra y dibuja la matriz con los roles de cada celda', async () => {
    await open();
    expect(host().querySelector('[data-testid="rbac-notes"]')?.textContent).toContain(
      'SIMULADO: nota de prueba',
    );
    const table = host().querySelector('[data-testid="rbac-matrix-table"]')!;
    const headers = [...table.querySelectorAll('thead th')].map((th) => th.textContent?.trim());
    expect(headers).toEqual(['Recurso', 'Listar', 'Exportar', 'Aprobar']);
    expect(table.textContent).toContain('FINANCE');
    expect(table.textContent).toContain('Niega OPS');
    expect(table.textContent).toContain('Sólo por rol');
    expect(table.textContent).toContain('Rutas exigen: FINANCE');
  });

  it('abre el primer módulo con permisos y deja elegir otro por la URL', async () => {
    await open(`${SCREEN}?module=pharma_lab`);
    const table = host().querySelector('[data-testid="rbac-matrix-table"]')!;
    expect(table.textContent).toContain('notices');
    expect(table.textContent).toContain('Sin autorización declarada');
    expect(host().querySelector('[data-testid="rbac-matrix-panel"]')?.textContent).toContain(
      'no tiene ningún permiso fino',
    );
  });

  it('la pestaña de huecos lista los de todos los módulos con su código propuesto, y filtra', async () => {
    await open(`${SCREEN}?view=gaps`);
    const gaps = [...host().querySelectorAll('[data-testid="rbac-gap"]')];
    expect(gaps).toHaveLength(3);
    expect(gaps[0]!.textContent).toContain('Prioridad alta');
    expect(gaps[0]!.textContent).toContain('pharma_lab.notices.update');
    expect(host().querySelector('[data-testid="rbac-gaps-count"]')?.textContent).toContain(
      '3 huecos de 3',
    );
  });

  it('la pestaña de huecos con un módulo en la URL sólo muestra los suyos', async () => {
    await open(`${SCREEN}?view=gaps&module=billing`);
    expect(host().querySelectorAll('[data-testid="rbac-gap"]')).toHaveLength(1);
  });

  it('la cobertura calcula el porcentaje sobre rutas que autorizan y dice "No aplica" donde no hay ninguna', async () => {
    await open(`${SCREEN}?view=coverage`);
    const rows = [...host().querySelectorAll('[data-testid="rbac-coverage-table"] tbody tr')].map(
      (r) => r.textContent ?? '',
    );
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.includes('billing'))).toContain('50 %');
    expect(rows.find((r) => r.includes('ops'))).toContain('No aplica');
  });

  describe('vista por rol', () => {
    const URL = `${SCREEN}?mode=role&role=${ROLE_FIN}`;

    it('sin rol elegido orienta a elegir uno', async () => {
      await open(`${SCREEN}?mode=role`);
      expect(text()).toContain('Elija un rol');
      http.expectNone('/authz/roles/role-fin/permissions');
    });

    it('guarda el reemplazo completo releyendo antes al servidor y conservando la restricción de lo que no se tocó', async () => {
      await open(URL);
      editor().setEffect('p-approve', 'ALLOW');
      harness.detectChanges();
      expect(text()).toContain('1 cambio pendiente');
      editor().save();
      http.expectOne('/authz/roles/role-fin/permissions').flush({
        roleId: ROLE_FIN,
        roleCode: 'FINANCE',
        items: [
          {
            permissionId: 'p-list',
            code: 'billing.invoices.list',
            name: 'x',
            resource: 'invoices',
            effect: 'ALLOW',
            scope: 'TENANT',
          },
        ],
      });
      await harness.fixture.whenStable();
      expect(confirmDetails).toEqual([
        { label: 'Por agregar', value: 'billing.invoices.approve' },
        { label: 'Por cambiar', value: 'Ninguno' },
        { label: 'Por quitar', value: 'Ninguno' },
        { label: 'Sensibles que pasan a permitirse', value: '1' },
      ]);
      const put = http.expectOne(
        (r) => r.method === 'PUT' && r.url === '/authz/roles/role-fin/permissions',
      );
      expect(put.request.body).toEqual({
        permissions: [
          {
            permissionId: 'p-list',
            effect: 'ALLOW',
            scope: 'TENANT',
            constraintJson: { maxAmount: 100 },
          },
          { permissionId: 'p-approve', effect: 'ALLOW' },
        ],
      });
      put.flush({ id: ROLE_FIN, code: 'FINANCE', status: 'ACTIVE', permissionCount: 2 });
      // Se vuelve a leer el catálogo: lo que se ve es lo que quedó.
      http.expectOne('/authz/catalog/modules').flush(wire());
      harness.detectChanges();
      expect(text()).toContain('Se guardaron los permisos de Finanzas: ahora tiene 2.');
    });

    it('si no se confirma, no se escribe nada y el borrador se conserva', async () => {
      await open(URL);
      editor().setEffect('p-approve', 'ALLOW');
      confirmed = false;
      editor().save();
      http.expectOne('/authz/roles/role-fin/permissions').flush({
        roleId: ROLE_FIN,
        roleCode: 'FINANCE',
        items: [
          {
            permissionId: 'p-list',
            code: 'x',
            name: 'x',
            resource: 'x',
            effect: 'ALLOW',
            scope: 'TENANT',
          },
        ],
      });
      await harness.fixture.whenStable();
      http.expectNone((r) => r.method === 'PUT');
      harness.detectChanges();
      expect(text()).toContain('1 cambio pendiente');
    });

    it('ante un rechazo conserva el borrador y explica el motivo por su reason', async () => {
      await open(URL);
      editor().setEffect('p-approve', 'ALLOW');
      editor().save();
      http.expectOne('/authz/roles/role-fin/permissions').flush({
        roleId: ROLE_FIN,
        roleCode: 'FINANCE',
        items: [
          {
            permissionId: 'p-list',
            code: 'x',
            name: 'x',
            resource: 'x',
            effect: 'ALLOW',
            scope: 'TENANT',
          },
        ],
      });
      await harness.fixture.whenStable();
      http
        .expectOne((r) => r.method === 'PUT')
        .flush(
          {
            statusCode: 422,
            code: 'PRECONDITION_FAILED',
            message: 'x',
            reason: 'ROLE_PERMISSION_NOT_FOUND',
          },
          { status: 422, statusText: 'Unprocessable Entity' },
        );
      harness.detectChanges();
      expect(text()).toContain('Alguno de los permisos ya no existe');
      expect(text()).toContain('1 cambio pendiente');
    });

    it('si el rol tiene en el servidor un permiso que el catálogo no conoce, no guarda y pide recargar', async () => {
      await open(URL);
      editor().setEffect('p-approve', 'ALLOW');
      editor().save();
      http.expectOne('/authz/roles/role-fin/permissions').flush({
        roleId: ROLE_FIN,
        roleCode: 'FINANCE',
        items: [
          {
            permissionId: 'p-nuevo',
            code: 'n',
            name: 'n',
            resource: 'n',
            effect: 'ALLOW',
            scope: null,
          },
        ],
      });
      await harness.fixture.whenStable();
      http.expectNone((r) => r.method === 'PUT');
      harness.detectChanges();
      expect(text()).toContain('Recargue la pantalla antes de guardar');
    });

    it('dejar el rol sin permisos no se manda', async () => {
      await open(URL);
      editor().setEffect('p-list', '');
      editor().save();
      http.expectOne('/authz/roles/role-fin/permissions').flush({
        roleId: ROLE_FIN,
        roleCode: 'FINANCE',
        items: [
          {
            permissionId: 'p-list',
            code: 'x',
            name: 'x',
            resource: 'x',
            effect: 'ALLOW',
            scope: 'TENANT',
          },
        ],
      });
      await harness.fixture.whenStable();
      http.expectNone((r) => r.method === 'PUT');
      harness.detectChanges();
      expect(text()).toContain('al menos un permiso');
    });

    it('con la lectura truncada no se edita ningún rol', async () => {
      await open(URL, wire({ truncated: true }));
      expect(host().querySelector('[data-testid="rbac-role-truncated"]')).not.toBeNull();
      const save = host().querySelector('[data-testid="rbac-role-save"]')!;
      expect(save.getAttribute('aria-disabled')).toBe('true');
    });
  });

  describe('estados', () => {
    it('un 403 se muestra como falta de permiso, sin matriz', async () => {
      TestBed.configureTestingModule({
        providers: [
          provideHttpClient(),
          provideHttpClientTesting(),
          provideRouter([
            { path: 'superadmin/portal/governance/rbac-matrix', component: RbacMatrixPage },
          ]),
        ],
      });
      http = TestBed.inject(HttpTestingController);
      harness = await RouterTestingHarness.create();
      await harness.navigateByUrl(SCREEN, RbacMatrixPage);
      http
        .expectOne('/authz/catalog/modules')
        .flush(
          { statusCode: 403, code: 'FORBIDDEN', message: 'x', reason: 'ROLE_INSUFFICIENT' },
          { status: 403, statusText: 'Forbidden' },
        );
      harness.detectChanges();
      expect(host().querySelector('[data-testid="rbac-matrix-table"]')).toBeNull();
      expect(host().querySelector('app-view-state-host')?.textContent?.length).toBeGreaterThan(0);
    });

    it('sin módulos, orienta en vez de dejar la pantalla muda', async () => {
      await open(SCREEN, wire({ modules: [], availableModules: [] }));
      expect(host().querySelector('[data-testid="rbac-matrix-table"]')).toBeNull();
      expect(text()).toContain('Ir a Roles y permisos');
    });
  });
});
