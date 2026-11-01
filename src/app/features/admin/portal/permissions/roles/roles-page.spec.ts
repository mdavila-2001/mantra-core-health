import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { DialogService } from '../../../../../shared/components/molecules/dialog/dialog-service';
import { RolePermissionsEditor } from './role-permissions-editor';
import { RolesPage } from './roles-page';

const SCREEN = '/superadmin/portal/governance/roles';
const ROLE = 'role-dpo';

const permission = (id: string, code: string, resource: string, isDangerous = false) => ({
  id,
  code,
  name: `Permiso ${code}`,
  resource,
  categoryId: null,
  isDangerous,
  isFieldLevel: false,
  isRoleRestricted: false,
});

const CATALOG = {
  items: [permission('p-read', 'AUDIT.READ', 'audit'), permission('p-export', 'AUDIT.EXPORT', 'audit', true)],
  nextCursor: null,
  limit: 200,
};

describe('RolesPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let confirmed: boolean;
  let confirmDetails: readonly { label: string; value: string }[] | undefined;

  async function open(url = SCREEN): Promise<void> {
    confirmed = true;
    confirmDetails = undefined;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'superadmin/portal/governance/roles', component: RolesPage }]),
        {
          provide: DialogService,
          useValue: {
            confirmarCambios: (config: { details?: readonly { label: string; value: string }[] }) => {
              confirmDetails = config.details;
              return Promise.resolve(confirmed);
            },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, RolesPage);
    for (const req of http.match('/authz/roles')) {
      req.flush([{ id: ROLE, code: 'DPO', name: 'Protección de datos', isSystem: true, tenantId: null }]);
    }
  }

  function loadRole(effect: 'ALLOW' | 'DENY' = 'ALLOW'): void {
    http.expectOne((r) => r.url === '/authz/permissions').flush(CATALOG);
    http.expectOne(`/authz/roles/${ROLE}/permissions`).flush({
      roleId: ROLE,
      roleCode: 'DPO',
      items: [{ permissionId: 'p-read', code: 'AUDIT.READ', name: 'x', resource: 'audit', effect, scope: 'GLOBAL' }],
    });
    harness.detectChanges();
  }

  const editor = () =>
    harness.routeDebugElement!.query(By.directive(RolePermissionsEditor)).componentInstance as unknown as {
      setEffect(id: string, effect: string): void;
      save(): Promise<void>;
    };
  const text = () => (harness.routeNativeElement as HTMLElement).textContent ?? '';
  /** `app-button` no usa `disabled` nativo: lo expone como `aria-disabled`. */
  const saveDisabled = () =>
    harness.routeNativeElement!.querySelector('[data-testid="portal-role-editor-save"]')!.getAttribute('aria-disabled') === 'true';

  afterEach(() => http.verify());

  it('sin rol elegido no pide permisos y orienta a elegir uno', async () => {
    await open();
    harness.detectChanges();
    http.expectNone((r) => r.url === '/authz/permissions');
    expect(text()).toContain('Elija un rol');
  });

  it('muestra el catálogo con lo que el rol permite y no ofrece guardar sin cambios', async () => {
    await open(`${SCREEN}?role=${ROLE}`);
    loadRole();
    const table = harness.routeNativeElement!.querySelector('[data-testid="portal-role-editor-table"]')!;
    expect(table.textContent).toContain('AUDIT.READ');
    expect(table.textContent).toContain('AUDIT.EXPORT');
    expect(table.textContent).toContain('Sensible');
    expect(saveDisabled()).toBe(true);
  });

  it('guarda el reemplazo completo con lo que no se tocó intacto, y relee del servidor', async () => {
    await open(`${SCREEN}?role=${ROLE}`);
    loadRole();
    editor().setEffect('p-export', 'DENY');
    harness.detectChanges();
    expect(text()).toContain('Pendiente: 1 por agregar, 0 por cambiar, 0 por quitar.');
    await editor().save();
    expect(confirmDetails).toEqual([
      { label: 'Por agregar', value: '1' },
      { label: 'Por cambiar', value: '0' },
      { label: 'Por quitar', value: '0' },
    ]);
    const put = http.expectOne((r) => r.method === 'PUT' && r.url === `/authz/roles/${ROLE}/permissions`);
    expect(put.request.body).toEqual({
      permissions: [
        { permissionId: 'p-read', effect: 'ALLOW', scope: 'GLOBAL' },
        { permissionId: 'p-export', effect: 'DENY' },
      ],
    });
    put.flush({ id: ROLE, code: 'DPO', status: 'ACTIVE', permissionCount: 2 });
    // Se vuelve a leer: lo que se ve es lo que quedó.
    http.expectOne((r) => r.url === '/authz/permissions').flush(CATALOG);
    http.expectOne(`/authz/roles/${ROLE}/permissions`).flush({
      roleId: ROLE,
      roleCode: 'DPO',
      items: [
        { permissionId: 'p-read', code: 'AUDIT.READ', name: 'x', resource: 'audit', effect: 'ALLOW', scope: 'GLOBAL' },
        { permissionId: 'p-export', code: 'AUDIT.EXPORT', name: 'x', resource: 'audit', effect: 'DENY', scope: 'GLOBAL' },
      ],
    });
    harness.detectChanges();
    expect(text()).toContain('Se guardaron los permisos de Protección de datos: ahora tiene 2.');
    expect(saveDisabled()).toBe(true);
  });

  it('si el usuario no confirma, no escribe nada', async () => {
    await open(`${SCREEN}?role=${ROLE}`);
    loadRole();
    editor().setEffect('p-export', 'ALLOW');
    confirmed = false;
    await editor().save();
    http.expectNone((r) => r.method === 'PUT');
  });

  it('ante un rechazo conserva lo editado y explica el motivo por su reason', async () => {
    await open(`${SCREEN}?role=${ROLE}`);
    loadRole();
    editor().setEffect('p-export', 'DENY');
    await editor().save();
    http
      .expectOne((r) => r.method === 'PUT')
      .flush(
        { statusCode: 422, code: 'PRECONDITION_FAILED', message: 'x', reason: 'ROLE_PERMISSION_NOT_FOUND' },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    harness.detectChanges();
    expect(text()).toContain('Alguno de los permisos ya no existe');
    expect(text()).toContain('Pendiente: 1 por agregar');
    expect(saveDisabled()).toBe(false);
  });

  it('un rol no puede quedar sin permisos: el guardado se bloquea y se explica', async () => {
    await open(`${SCREEN}?role=${ROLE}`);
    loadRole();
    editor().setEffect('p-read', '');
    harness.detectChanges();
    expect(saveDisabled()).toBe(true);
    expect(text()).toContain('al menos un permiso');
  });

  it('la pestaña de cambios registrados pide la bitácora sólo al abrirla', async () => {
    await open(`${SCREEN}?view=audit`);
    harness.detectChanges();
    const logs = http.match((r) => r.url === '/audit/log');
    expect(logs.map((r) => r.request.params.get('action')).sort()).toEqual(['ROLE_CREATED', 'ROLE_PERMISSIONS_SET']);
    for (const req of logs) req.flush({ items: [], nextCursor: null, limit: 10 });
    harness.detectChanges();
    expect(text()).toContain('Todavía no hay cambios registrados');
  });
});
