import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ContentDialog } from '../../../shared/components/organisms/content-dialog/content-dialog';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import { PharmacyCategories } from '../categories/pharmacy-categories';
import { ImportTargetPicker } from '../import/import-target/import-target';
import { PharmacyInventory } from '../inventory/pharmacy-inventory';
import { PharmacyProducts } from '../products/pharmacy-products';
import { PharmacyCatalogHub } from './pharmacy-catalog-hub';

/**
 * Pharmacy «Catálogo»: five screens in one tabbed card, with the tab in
 * `?tab=` both ways, and the import in a modal opened from the header button
 * (`?tab=import`). The screens are the real ones; their requests stay
 * unanswered because only which one is mounted matters here.
 */
const ROUTE = '/administration/pharmacy-catalog';

const SCREENS = [
  'app-pharmacy-products',
  'app-pharmacy-categories',
  'app-pharmacy-prices',
  'app-pharmacy-inventory',
  'app-pharmacy-integration',
] as const;

describe('PharmacyCatalogHub', () => {
  let harness: RouterTestingHarness;
  let router: Router;

  const root = (): HTMLElement => harness.routeNativeElement as HTMLElement;
  const tabButtons = (): HTMLButtonElement[] => [...root().querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const selectedLabel = (): string =>
    tabButtons()
      .find((button) => button.getAttribute('aria-selected') === 'true')
      ?.textContent?.trim() ?? '';
  const mountedScreens = (): string[] => SCREENS.filter((selector) => root().querySelector(selector) !== null);

  async function open(url: string): Promise<PharmacyCatalogHub> {
    const hub = await harness.navigateByUrl(url, PharmacyCatalogHub);
    harness.detectChanges();
    return hub;
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'administration/pharmacy-catalog', component: PharmacyCatalogHub }]),
      ],
    });
    harness = await RouterTestingHarness.create();
    router = TestBed.inject(Router);
  });

  it('dibuja un membrete «Catálogo» y UNA tarjeta con cinco pestañas de marco de ventana, en orden', async () => {
    await open(ROUTE);

    const headers = root().querySelectorAll('app-page-header');
    expect(headers).toHaveLength(1);
    expect(headers[0]!.textContent).toContain('Catálogo');
    expect(root().querySelectorAll('[data-testid="pharmacy-catalog-card"]')).toHaveLength(1);
    const tabs = root().querySelector('[data-testid="pharmacy-catalog-tabs"]');
    expect(tabs?.classList).toContain('tabs--browser');
    expect(tabButtons().map((button) => button.textContent?.trim())).toEqual([
      'Productos',
      'Categorías',
      'Precios',
      'Inventario',
      'Integración',
    ]);
  });

  it('sin `tab` abre Productos y monta sólo esa pantalla', async () => {
    await open(ROUTE);

    expect(selectedLabel()).toBe('Productos');
    expect(mountedScreens()).toEqual(['app-pharmacy-products']);
  });

  it('con `?tab=prices` abre Precios y sólo Precios está en el DOM', async () => {
    await open(`${ROUTE}?tab=prices`);

    expect(selectedLabel()).toBe('Precios');
    expect(mountedScreens()).toEqual(['app-pharmacy-prices']);
  });

  it('con `?tab=integration` abre Integración y sólo Integración está en el DOM', async () => {
    await open(`${ROUTE}?tab=integration`);

    expect(selectedLabel()).toBe('Integración');
    expect(mountedScreens()).toEqual(['app-pharmacy-integration']);
    expect(root().querySelectorAll('app-page-header')).toHaveLength(1);
  });

  it.each(['foo', 'INTEGRATION'])('con `?tab=%s` cae en Productos', async (tab) => {
    await open(`${ROUTE}?tab=${tab}`);

    expect(selectedLabel()).toBe('Productos');
    expect(mountedScreens()).toEqual(['app-pharmacy-products']);
  });

  it('ninguna pantalla montada dibuja su propio membrete', async () => {
    for (const tab of ['products', 'categories', 'prices', 'inventory', 'integration']) {
      await open(`${ROUTE}?tab=${tab}`);
      expect(root().querySelectorAll('app-page-header'), tab).toHaveLength(1);
    }
  });

  it('el clic en «Inventario» escribe sólo `?tab=inventory`, sin el query anterior y sin entrada en el historial', async () => {
    await open(`${ROUTE}?tab=products&status=DRAFT`);
    const navigate = vi.spyOn(router, 'navigate');

    tabButtons()[3]!.click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: { tab: 'inventory' },
      replaceUrl: true,
    }));
    expect(navigate.mock.calls[0]![1]).not.toHaveProperty('queryParamsHandling');
    expect(router.url).toBe(`${ROUTE}?tab=inventory`);
    expect(selectedLabel()).toBe('Inventario');
    expect(mountedScreens()).toEqual(['app-pharmacy-inventory']);
  });

  it('el filtro que trae el enlace llega a la pantalla montada', async () => {
    await open(`${ROUTE}?tab=inventory&alerts=true`);
    const inventory = harness.fixture.debugElement.query(By.directive(PharmacyInventory))
      .componentInstance as unknown as { onlyAlerts: () => boolean };
    expect(inventory.onlyAlerts()).toBe(true);

    await open(`${ROUTE}?status=DRAFT`);
    const products = harness.fixture.debugElement.query(By.directive(PharmacyProducts))
      .componentInstance as unknown as { filters: () => { status: string } };
    expect(products.filters().status).toBe('DRAFT');
  });

  it('un cambio de query a la misma ruta cambia de pestaña sin recrear el hub', async () => {
    const hub = await open(`${ROUTE}?tab=inventory`);

    const again = await harness.navigateByUrl(`${ROUTE}?tab=prices`, PharmacyCatalogHub);
    harness.detectChanges();
    expect(again).toBe(hub);
    expect(selectedLabel()).toBe('Precios');
    expect(mountedScreens()).toEqual(['app-pharmacy-prices']);
  });

  describe('«Importar CSV» del membrete', () => {
    const importButton = (): HTMLButtonElement =>
      root().querySelector<HTMLButtonElement>('[data-testid="catalog-import"] button, button[data-testid="catalog-import"]')!;
    const dialog = (): Element | null => root().querySelector('[data-testid="catalog-import-dialog"]');
    const target = (): string | null => router.parseUrl(router.url).queryParamMap.get('target');

    it('está en el membrete, no hay pestaña «Importación» y el modal arranca cerrado', async () => {
      await open(ROUTE);

      expect(root().querySelector('app-page-header [data-testid="catalog-import"]')).not.toBeNull();
      expect(tabButtons().map((button) => button.textContent?.trim())).not.toContain('Importación');
      expect(dialog()).toBeNull();
    });

    it.each([
      ['categories', 'categories', 'app-pharmacy-categories'],
      ['prices', 'products', 'app-pharmacy-prices'],
      ['inventory', 'products', 'app-pharmacy-inventory'],
    ])('desde `?tab=%s` abre el modal con «%s» y deja la pestaña debajo', async (tab, expected, screen) => {
      await open(`${ROUTE}?tab=${tab}`);

      importButton().click();
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(router.url).toContain('tab=import');
      expect(target()).toBe(expected);
      expect(dialog()).not.toBeNull();
      expect(dialog()!.querySelector('app-import-target')).not.toBeNull();
      expect(mountedScreens()).toEqual([screen]);
    });

    it('el enlace viejo `?tab=import&target=prices` abre el modal sobre Productos', async () => {
      await open(`${ROUTE}?tab=import&target=prices`);

      expect(dialog()).not.toBeNull();
      expect(selectedLabel()).toBe('Productos');
      expect(mountedScreens()).toEqual(['app-pharmacy-products']);
    });

    it('cerrar el modal (X, Esc o fondo) deja sólo la pestaña de abajo en la URL', async () => {
      await open(`${ROUTE}?tab=categories`);
      importButton().click();
      await harness.fixture.whenStable();
      harness.detectChanges();

      harness.fixture.debugElement.query(By.directive(ContentDialog)).triggerEventHandler('closed');
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(router.url).toBe(`${ROUTE}?tab=categories`);
      expect(dialog()).toBeNull();
      expect(mountedScreens()).toEqual(['app-pharmacy-categories']);
    });

    it('con una carga escribiéndose, el modal no se deja cerrar y lo avisa', async () => {
      const info = vi.spyOn(TestBed.inject(ToastService), 'info');
      const hub = await open(`${ROUTE}?tab=import&target=prices`);
      const picker = harness.fixture.debugElement.query(By.directive(ImportTargetPicker))
        .componentInstance as { busy: () => boolean };
      const guard = (hub as unknown as { importGuard: () => boolean }).importGuard;

      expect(guard()).toBe(true);
      Object.defineProperty(picker, 'busy', { value: () => true });
      expect(guard()).toBe(false);
      expect(info).toHaveBeenCalledWith(expect.stringContaining('Espere a que termine la carga'));
    });

    it('«Ver productos» (la ruta sin query) cierra el modal y abre Productos', async () => {
      await open(`${ROUTE}?tab=import&target=categories`);

      await harness.navigateByUrl(ROUTE, PharmacyCatalogHub);
      harness.detectChanges();

      expect(dialog()).toBeNull();
      expect(selectedLabel()).toBe('Productos');
      expect(mountedScreens()).toEqual(['app-pharmacy-products']);
    });

    it('«Ver precios» al terminar cierra el modal, abre la pestaña y la vuelve a montar', async () => {
      await open(`${ROUTE}?tab=prices`);
      const before = harness.fixture.debugElement.query(By.css('app-pharmacy-prices')).componentInstance;
      importButton().click();
      await harness.fixture.whenStable();
      harness.detectChanges();

      await harness.navigateByUrl(`${ROUTE}?tab=prices`, PharmacyCatalogHub);
      harness.detectChanges();

      expect(dialog()).toBeNull();
      expect(selectedLabel()).toBe('Precios');
      const after = harness.fixture.debugElement.query(By.css('app-pharmacy-prices')).componentInstance;
      expect(after).not.toBe(before);
    });
  });

  describe('pestañas que comparten la farmacia', () => {
    const FARMACIAS = [
      { id: 'f-1', name: 'Farmacia Uno', code: 'F1', siteCount: 1, productCount: 1 },
      { id: 'f-2', name: 'Farmacia Dos', code: 'F2', siteCount: 1, productCount: 1 },
    ];

    let http: HttpTestingController;

    beforeEach(() => {
      http = TestBed.inject(HttpTestingController);
    });

    function flushPharmacies(items: readonly unknown[]): void {
      http.match((r) => r.url.endsWith('/pharmacy/pharmacies')).forEach((r) => r.flush({ items, count: items.length }));
      harness.detectChanges();
    }

    it('la farmacia elegida en una pestaña sigue elegida en la siguiente, sin volver a pedir la lista', async () => {
      await open(`${ROUTE}?tab=categories`);
      flushPharmacies(FARMACIAS);
      const choose = (): void =>
        (
          harness.fixture.debugElement.query(By.directive(PharmacyCategories)).componentInstance as unknown as {
            scope: { choose: (id: string) => void };
          }
        ).scope.choose('f-2');
      choose();
      harness.detectChanges();

      tabButtons()[2]!.click();
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(http.match((r) => r.url.endsWith('/pharmacy/pharmacies'))).toHaveLength(0);
      const listing = http.match((r) => r.url.endsWith('/pharmacy/products'));
      expect(listing.map((r) => r.request.params.get('pharmacyId'))).toEqual(['f-2']);
    });
  });
});
