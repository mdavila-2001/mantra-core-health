import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { PermissionDriftPage } from './permission-drift-page';

const SCREEN = '/superadmin/portal/governance/permission-drift';

const report = {
  generatedAt: '2026-10-24T12:00:00.000Z',
  routes: { total: 1523, public: 55, withRoles: 1178, withoutRoles: 290 },
  usedNotSeeded: [
    {
      role: 'PLATFORM_ADMIN',
      routeCount: 265,
      inDatabase: true,
      sample: [{ method: 'GET', template: '/admin/analytics/funnels', controller: 'TelemetryAnalyticsController', handler: 'listFunnels' }],
    },
    { role: 'RELEASE_MANAGER', routeCount: 27, inDatabase: false, sample: [] },
  ],
  seededNotUsed: ['LEGACY_VIEWER'],
  routesWithoutRoles: [{ method: 'POST', template: '/files/uploads', controller: 'FilesController', handler: 'upload' }],
  routesWithoutRolesTruncated: true,
};

describe('PermissionDriftPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;

  async function open(url = SCREEN): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'superadmin/portal/governance/permission-drift', component: PermissionDriftPage }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url, PermissionDriftPage);
  }

  const text = () => (harness.routeNativeElement as HTMLElement).textContent ?? '';

  afterEach(() => http.verify());

  it('muestra los recuentos y los roles exigidos que nadie siembra, con su estado en la base', async () => {
    await open();
    http.expectOne('/admin/catalog/permission-drift').flush(report);
    harness.detectChanges();
    expect(text()).toContain('1.523');
    expect(text()).toContain('Sin sembrar (2)');
    const table = harness.routeNativeElement!.querySelector('[data-testid="portal-drift-used-not-seeded"]')!;
    expect(table.textContent).toContain('PLATFORM_ADMIN');
    expect(table.textContent).toContain('265');
    expect(table.textContent).toContain('Existe en la base, sin siembra');
    expect(table.textContent).toContain('No existe en la base');
    expect(table.textContent).toContain('/admin/analytics/funnels');
  });

  it('la pestaña de la URL abre las rutas sin roles y avisa que la lista vino recortada', async () => {
    await open(`${SCREEN}?view=without-roles`);
    http.expectOne('/admin/catalog/permission-drift').flush(report);
    harness.detectChanges();
    const table = harness.routeNativeElement!.querySelector('[data-testid="portal-drift-without-roles"]')!;
    expect(table.textContent).toContain('/files/uploads');
    expect(table.textContent).toContain('FilesController.upload');
    expect(text()).toContain('Se muestran 1 de 290.');
  });

  it('los roles sembrados sin uso se listan en su pestaña', async () => {
    await open(`${SCREEN}?view=seeded-not-used`);
    http.expectOne('/admin/catalog/permission-drift').flush(report);
    harness.detectChanges();
    const section = harness.routeNativeElement!.querySelector('[data-testid="portal-drift-seeded-not-used"]')!;
    expect(section.textContent).toContain('LEGACY_VIEWER');
  });

  it('un fallo de la API ofrece reintentar y vuelve a pedir', async () => {
    await open();
    http.expectOne('/admin/catalog/permission-drift').flush(
      { code: 'INTERNAL', message: 'x', timestamp: '', path: '' },
      { status: 500, statusText: 'Server Error', headers: { 'x-request-id': 'req-1' } },
    );
    harness.detectChanges();
    const page = harness.routeDebugElement!.componentInstance as unknown as { load(): void };
    page.load();
    http.expectOne('/admin/catalog/permission-drift').flush(report);
    harness.detectChanges();
    expect(text()).toContain('PLATFORM_ADMIN');
  });
});
