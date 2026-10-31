import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, type Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';

import { SessionStore } from '../../../../core/auth/session.store';
import { idDeEspacio, SITIOS_INFRA } from '../../../../core/mock/fixtures/infraestructura';
import { buscarUsuario, TENANT_HOSPITAL, type MockUser } from '../../../../core/mock/mock-session';
import { uuid } from '../../../../core/mock/mock-store';
import { FullMockBackend } from '../../../../../testing/full-mock-backend';
import { EquipmentDetail } from '../../medical-laboratory/equipment-detail/equipment-detail';
import { SpaceDetail } from '../../medical-organization/espacio/space-detail';
import { ServicesCatalog } from '../services-catalog';
import { BedDayCharges } from './bed-day-charges';

const SAN_LUCAS = SITIOS_INFRA[0]!;

/** Pantallas de F5 (día-cama, tarifas, equipos y stock) contra el simulador completo. */
describe('Integración F5 · pantallas', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let backend: FullMockBackend;

  async function setup(user: MockUser): Promise<void> {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'administration/services-catalog', component: ServicesCatalog },
          { path: 'administration/services-catalog/bed-day-charges', component: BedDayCharges },
          { path: 'administration/medical-organization/spaces/:id', component: SpaceDetail },
          { path: 'administration/medical-laboratory/equipment/:id', component: EquipmentDetail },
        ]),
      ],
    });
    const session = TestBed.inject(SessionStore);
    Object.defineProperty(session, 'roles', { value: signal(user.roles) });
    Object.defineProperty(session, 'activeTenantId', { value: signal(TENANT_HOSPITAL) });
    http = TestBed.inject(HttpTestingController);
    backend = new FullMockBackend(user, TENANT_HOSPITAL);
    harness = await RouterTestingHarness.create();
  }

  const root = (): HTMLElement => harness.routeNativeElement as HTMLElement;

  async function settle(): Promise<void> {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
      backend.respondAll(http, () => harness.detectChanges());
      harness.detectChanges();
    }
  }

  async function open<T>(url: string, component: Type<T>): Promise<void> {
    await harness.navigateByUrl(url, component);
    await settle();
  }

  it('día-cama: devengar aplica la regla de medianoche (3 días, con el traslado) y re-ejecutar no duplica', async () => {
    await setup(buscarUsuario('facturacion')!);
    await open(`/administration/services-catalog/bed-day-charges?encounter=${uuid('encounter-stay-1')}`, BedDayCharges);
    root().querySelector<HTMLButtonElement>('[data-testid=bed-day-run]')!.click();
    await settle();
    const table = root().querySelector('[data-testid=bed-day-table]')!.textContent ?? '';
    expect((table.match(/BEDDAY:/g) ?? []).length).toBe(3);
    expect(table).toContain('Compartida');
    expect(table).toContain('Privada');
    expect(root().querySelector('[data-testid=bed-day-result]')?.textContent).toContain('3 cargos nuevos');
    root().querySelector<HTMLButtonElement>('[data-testid=bed-day-run]')!.click();
    await settle();
    expect(root().querySelector('[data-testid=bed-day-result]')?.textContent).toContain('0 cargos nuevos; 3 días ya estaban devengados');
  });

  it('el catálogo de servicios suma la pestaña «Tarifas de espacios» con las tarifas versionadas', async () => {
    await setup(buscarUsuario('facturacion')!);
    await open('/administration/services-catalog?tab=space-tariffs', ServicesCatalog);
    const tabs = Array.from(root().querySelectorAll('[role=tab]')).map((t) => t.textContent?.trim());
    expect(tabs).toEqual(['Servicios', 'Tarifas de espacios']);
    const table = root().querySelector('[data-testid=space-tariffs-table]')?.textContent ?? '';
    expect(table).toContain('Día-cama');
    expect(table).toContain('Quirófano por tiempo');
  });

  it('la ficha de una sala de imagen suma «Equipos» y lista el equipo con su AE Title', async () => {
    await setup(buscarUsuario('superadmin')!);
    await open(`/administration/medical-organization/spaces/${idDeEspacio(SAN_LUCAS, 'IMG-TC')}?tab=equipment`, SpaceDetail);
    const tabs = Array.from(root().querySelectorAll('[role=tab]')).map((t) => t.textContent?.trim());
    expect(tabs).toContain('Equipos');
    expect(root().querySelector('[data-testid=space-equipment-list]')?.textContent).toContain('AE SLTC64');
  });

  it('la ficha de un botiquín suma «Stock» con sus existencias (lectura)', async () => {
    await setup(buscarUsuario('superadmin')!);
    await open(`/administration/medical-organization/spaces/${idDeEspacio(SAN_LUCAS, 'A-PN-P3-BOT')}?tab=stock`, SpaceDetail);
    const list = root().querySelector('[data-testid=space-stock-list]')?.textContent ?? '';
    expect(list).toContain('Botiquín de Medicina interna');
    expect(list).toContain('Paracetamol 500 mg');
  });

  it('ficha de equipo: un AE Title de 17 caracteres no se envía', async () => {
    await setup(buscarUsuario('superadmin')!);
    await open(`/administration/medical-laboratory/equipment/${uuid('equipment-sanlucas-us')}?tab=location`, EquipmentDetail);
    const tabs = Array.from(root().querySelectorAll('[role=tab]')).map((t) => t.textContent?.trim());
    expect(tabs).toEqual(['General', 'Ubicación y DICOM', 'Agenda']);
    const input = root().querySelector<HTMLInputElement>('[data-testid=equipment-ae-title]')!;
    input.value = 'A'.repeat(17);
    input.dispatchEvent(new Event('input'));
    await settle();
    expect(root().textContent).toContain('hasta 16 caracteres');
    expect(root().querySelector<HTMLElement>('[data-testid=equipment-save]')!.getAttribute('aria-disabled')).toBe('true');
  });
});
