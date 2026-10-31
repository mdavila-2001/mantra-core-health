import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { SessionStore } from '../../../core/auth/session.store';
import { buscarUsuario, TENANT_CLINICA, TENANT_HOSPITAL, type MockUser } from '../../../core/mock/mock-session';
import { FullMockBackend } from '../../../../testing/full-mock-backend';
import { Diagnostics } from '../../diagnostics/diagnostics';
import { InfrastructureAccounting } from './infrastructure-accounting';

/** Pantallas de F5b y F5f contra el simulador completo. */
describe('Integración F5b · F5f · pantallas', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let backend: FullMockBackend;

  async function setup(user: MockUser, tenant = TENANT_HOSPITAL): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'diagnostics', component: Diagnostics },
          { path: 'administration/accounting/infrastructure', component: InfrastructureAccounting },
        ]),
      ],
    });
    const session = TestBed.inject(SessionStore);
    Object.defineProperty(session, 'roles', { value: signal(user.roles) });
    Object.defineProperty(session, 'activeTenantId', { value: signal(tenant) });
    http = TestBed.inject(HttpTestingController);
    backend = new FullMockBackend(user, tenant);
    harness = await RouterTestingHarness.create();
  }

  const root = (): HTMLElement => harness.routeNativeElement as HTMLElement;

  async function open<T>(url: string, component: Type<T>): Promise<void> {
    await harness.navigateByUrl(url, component);
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      backend.respondAll(http, () => harness.detectChanges());
      harness.detectChanges();
    }
  }

  it('la cola del laboratorio suma «Punto de toma» y su filtro', async () => {
    await setup(buscarUsuario('medica')!);
    await open('/diagnostics', Diagnostics);
    expect(root().textContent).toContain('Punto de toma');
    const points = Array.from(root().querySelectorAll('[data-testid=diagnostics-point]')).map((e) => e.textContent?.trim());
    expect(points.some((p) => p?.startsWith('LAB-TM'))).toBe(true);
    expect(root().querySelector('[data-testid=diagnostics-point-filter]')).not.toBeNull();
  });

  it('activos y centros de costo: una tarjeta con dos pestañas y la ruta del espacio', async () => {
    await setup(buscarUsuario('superadmin')!);
    await open('/administration/accounting/infrastructure', InfrastructureAccounting);
    expect(root().querySelectorAll('[data-testid=infra-accounting]')).toHaveLength(1);
    const tabs = Array.from(root().querySelectorAll('[role=tab]')).map((t) => t.textContent?.trim());
    expect(tabs).toEqual(['Activos de infraestructura', 'Centros de costo']);
    const paths = Array.from(root().querySelectorAll('[data-testid=infra-accounting-path]')).map((e) => e.textContent ?? '');
    expect(paths.some((p) => p.includes('Bloque quirúrgico › Quirófano 1'))).toBe(true);
    expect(root().textContent).toContain('Dato heredado');
  });

  it('ubicar un activo con el árbol abre el selector y deja elegir el espacio', async () => {
    await setup(buscarUsuario('superadmin')!);
    await open('/administration/accounting/infrastructure', InfrastructureAccounting);
    root().querySelector<HTMLElement>('[data-testid=infra-accounting-locate-AF-0103]')!.click();
    harness.detectChanges();
    expect(root().querySelector('[data-testid=infra-accounting-locate]')).not.toBeNull();
    expect(root().querySelector('[role=tree]')).not.toBeNull();
    expect(root().querySelector<HTMLElement>('[data-testid=infra-accounting-locate-confirm]')!.getAttribute('aria-disabled')).toBe('true');
  });

  it('una organización sin activos ve S3 con la próxima acción, no una tabla vacía', async () => {
    await setup(buscarUsuario('superadmin')!, TENANT_CLINICA);
    await open('/administration/accounting/infrastructure', InfrastructureAccounting);
    expect(root().textContent).toContain('La organización no tiene activos de infraestructura registrados.');
    expect(root().textContent).toContain('Volver a contabilidad');
    expect(root().querySelector('[data-testid^=infra-accounting-locate-AF-]')).toBeNull();
  });
});
