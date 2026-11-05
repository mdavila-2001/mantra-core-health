import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { PharmacyCategories } from '../categories/pharmacy-categories';
import { PharmacyInventory } from '../inventory/pharmacy-inventory';
import { PharmacyPrices } from '../prices/pharmacy-prices';
import { PharmacyProducts } from '../products/pharmacy-products';
import { PharmacyCatalogHub } from './pharmacy-catalog-hub';

/**
 * «Catálogo» de la farmacia: seis pantallas en una tarjeta con pestañas, con
 * la pestaña en `?tab=` en las dos direcciones. Las pantallas son las reales;
 * sus peticiones quedan sin contestar porque acá sólo importa cuál se monta.
 */
const ROUTE = '/administration/pharmacy-catalog';

const SCREENS = [
  'app-pharmacy-products',
  'app-pharmacy-categories',
  'app-pharmacy-prices',
  'app-pharmacy-inventory',
  'app-pharmacy-import',
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

  it('dibuja un membrete «Catálogo» y UNA tarjeta con seis pestañas de marco de ventana, en orden', async () => {
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
      'Importación',
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
    for (const tab of ['products', 'categories', 'prices', 'inventory', 'import', 'integration']) {
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

    const again = await harness.navigateByUrl(`${ROUTE}?tab=import`, PharmacyCatalogHub);
    harness.detectChanges();
    expect(again).toBe(hub);
    expect(selectedLabel()).toBe('Importación');
    expect(mountedScreens()).toEqual(['app-pharmacy-import']);

    // «Ver productos» al terminar una importación: la misma ruta, sin query.
    await harness.navigateByUrl(ROUTE, PharmacyCatalogHub);
    harness.detectChanges();
    expect(selectedLabel()).toBe('Productos');
    expect(mountedScreens()).toEqual(['app-pharmacy-products']);
  });

  describe('pestañas que comparten la farmacia y no pierden lo escrito', () => {
    const FARMACIAS = [
      { id: 'f-1', name: 'Farmacia Uno', code: 'F1', siteCount: 1, productCount: 1 },
      { id: 'f-2', name: 'Farmacia Dos', code: 'F2', siteCount: 1, productCount: 1 },
    ];
    const PRODUCT = {
      id: 'p-1',
      pharmacyId: 'f-1',
      pharmacyName: 'Farmacia Uno',
      productCode: 'PAR-500',
      brandName: 'Paracetamol',
      genericName: null,
      strengthText: null,
      packageSizeText: null,
      dosageForm: null,
      medication: null,
      requiresPrescription: false,
      status: 'PUBLISHED' as const,
      unitPrice: '12.50',
    };

    let http: HttpTestingController;
    let discard: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      http = TestBed.inject(HttpTestingController);
      discard = vi.spyOn(TestBed.inject(DialogService), 'confirmarDescarte');
    });

    function flushPharmacies(items: readonly unknown[]): void {
      http.match((r) => r.url.endsWith('/pharmacy/pharmacies')).forEach((r) => r.flush({ items, count: items.length }));
      harness.detectChanges();
    }

    function flushProducts(): void {
      http
        .match((r) => r.url.endsWith('/pharmacy/products'))
        .forEach((r) => r.flush({ items: [PRODUCT], limit: 500, truncated: false }));
      harness.detectChanges();
    }

    async function pricesWithAnEdit(): Promise<PharmacyPrices> {
      await open(`${ROUTE}?tab=prices`);
      flushPharmacies([FARMACIAS[0]]);
      flushProducts();
      const prices = harness.fixture.debugElement.query(By.directive(PharmacyPrices))
        .componentInstance as PharmacyPrices;
      (prices as unknown as { setPrice: (product: unknown, value: string) => void }).setPrice(PRODUCT, '13');
      harness.detectChanges();
      return prices;
    }

    it('con un precio sin guardar, cambiar de pestaña pregunta y, si no se acepta, no se mueve ni se pierde nada', async () => {
      discard.mockResolvedValue(false);
      const prices = await pricesWithAnEdit();

      tabButtons()[3]!.click();
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(discard).toHaveBeenCalledTimes(1);
      expect(selectedLabel()).toBe('Precios');
      expect(mountedScreens()).toEqual(['app-pharmacy-prices']);
      expect(router.url).toBe(`${ROUTE}?tab=prices`);
      expect(harness.fixture.debugElement.query(By.directive(PharmacyPrices)).componentInstance).toBe(prices);
      expect(prices.hasUnsavedChanges()).toBe(true);
    });

    it('si se acepta descartar, cambia de pestaña', async () => {
      discard.mockResolvedValue(true);
      await pricesWithAnEdit();

      tabButtons()[3]!.click();
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(selectedLabel()).toBe('Inventario');
      expect(router.url).toBe(`${ROUTE}?tab=inventory`);
    });

    it('sin cambios sin guardar, cambia sin preguntar', async () => {
      await open(`${ROUTE}?tab=prices`);
      flushPharmacies([FARMACIAS[0]]);
      flushProducts();

      tabButtons()[0]!.click();
      await harness.fixture.whenStable();
      harness.detectChanges();

      expect(discard).not.toHaveBeenCalled();
      expect(selectedLabel()).toBe('Productos');
    });

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
