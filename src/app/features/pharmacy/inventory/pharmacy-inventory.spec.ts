import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { PharmacyProduct } from '../../../core/data-access/pharmacy/pharmacy.types';
import { PharmacyInventory } from './pharmacy-inventory';
import { afterAll, beforeAll } from 'vitest';
import { environment } from '../../../../environments/environment';

/**
 * «Inventario» de la farmacia (carril B, 29/09/2026): existencias y umbral
 * editables, guardados juntos, y lo que se ve sale de la lista releída.
 */
const PHARMACY = { id: '7f1c9a52-6d3e-4b18-9c47-2a5e8f0b1d63', name: 'Farmacia del Centro' };

function product(partial: Partial<PharmacyProduct>): PharmacyProduct {
  return {
    id: 'p-1',
    pharmacyId: PHARMACY.id,
    pharmacyName: PHARMACY.name,
    productCode: 'PAR-500',
    brandName: 'Paracetamol Bagó',
    genericName: 'Paracetamol',
    strengthText: null,
    packageSizeText: null,
    dosageForm: null,
    medication: null,
    requiresPrescription: false,
    status: 'PUBLISHED',
    stock: 20,
    minStock: 5,
    ...partial,
  };
}

interface Internal {
  setStock: (product: PharmacyProduct, value: string | number | null) => void;
  setMinimum: (product: PharmacyProduct, value: string | number | null) => void;
  save: () => void;
  dirtyCount: () => number;
  toggleAlerts: (only: boolean) => void;
  search: (term: string) => void;
  setView: (view: 'COUNT' | 'AVAILABILITY') => void;
  view: () => 'COUNT' | 'AVAILABILITY';
  setHas: (product: PharmacyProduct, has: boolean) => void;
  hasNow: (product: PharmacyProduct) => boolean;
  discard: () => void;
  isAlert: (product: PharmacyProduct) => boolean;
}

describe('PharmacyInventory', () => {
  // Las escrituras de farmacia son «sólo simulador»: sin esto la petición no sale.
  const originalMockBackend = environment.mockBackend;
  beforeAll(() => Object.assign(environment, { mockBackend: true }));
  afterAll(() => Object.assign(environment, { mockBackend: originalMockBackend }));

  let fixture: ComponentFixture<PharmacyInventory>;
  let http: HttpTestingController;

  const internal = (): Internal => fixture.componentInstance as unknown as Internal;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function expectListing(items: readonly PharmacyProduct[]): void {
    const request = http.expectOne((r) => r.url.endsWith('/pharmacy/products'));
    expect(request.request.params.get('managed')).toBe('true');
    request.flush({ items, limit: 500, truncated: false });
    fixture.detectChanges();
  }

  /** Sin sedes no hay selector: es la pantalla de siempre. */
  function mount(items: readonly PharmacyProduct[], sites: readonly { siteId: string; siteName: string }[] = []): void {
    fixture = TestBed.createComponent(PharmacyInventory);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/pharmacy/pharmacies'))
      .flush({ items: [{ ...PHARMACY, code: 'FC', siteCount: 1, productCount: 1 }], count: 1 });
    fixture.detectChanges();
    flushSites(sites);
    expectListing(items);
  }

  function flushSites(sites: readonly { siteId: string; siteName: string }[]): void {
    http.expectOne(`/pharmacies/${PHARMACY.id}/opening-hours`).flush({
      pharmacyId: PHARMACY.id,
      asOf: '2026-10-30T00:00:00Z',
      sites: sites.map((site) => ({ ...site, timeZone: 'America/La_Paz', open24h: null, shifts: [] })),
    });
  }

  beforeEach(() => {
    localStorage.removeItem('mch.pharmacy.inventory.view');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('montada como pestaña de «Catálogo» (`embedded`) no dibuja su membrete', () => {
    mount([]);
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('app-page-header')).not.toBeNull();

    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();

    expect(host.querySelector('app-page-header')).toBeNull();
  });

  it('no promete una sincronización futura: ya existe en «Integración»', () => {
    mount([product({})]);

    expect(root().querySelector('[data-testid="inventory-sync-notice"]')).toBeNull();
    expect(root().textContent).not.toContain('Cuando exista la sincronización');
  });

  it('con el listado cortado en 500 lo dice: la tabla, las alertas y el CSV ven sólo esos', () => {
    fixture = TestBed.createComponent(PharmacyInventory);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/pharmacy/pharmacies'))
      .flush({ items: [{ ...PHARMACY, code: 'FC', siteCount: 1, productCount: 1 }], count: 1 });
    fixture.detectChanges();
    flushSites([]);
    http.expectOne((r) => r.url.endsWith('/pharmacy/products')).flush({ items: [product({})], limit: 500, truncated: true });
    fixture.detectChanges();

    expect(root().querySelector('[data-testid="inventory-truncated"]')?.textContent).toContain(
      'Se muestran los primeros 500',
    );
  });

  it('sin corte no hay aviso, la tabla es compacta y avisa al catálogo de lo escrito sin guardar', () => {
    mount([product({})]);
    const inventory = fixture.componentInstance;

    expect(root().querySelector('[data-testid="inventory-truncated"]')).toBeNull();
    expect(root().querySelector('[data-testid="inventory-table"]')?.classList).toContain('data-table--dense');
    expect(inventory.hasUnsavedChanges()).toBe(false);
    internal().setStock(product({}), '3');
    expect(inventory.hasUnsavedChanges()).toBe(true);
  });

  it('ordena por existencias desde el encabezado', async () => {
    mount([
      product({ id: 'p-1', productCode: 'A', brandName: 'Alfa', stock: 9 }),
      product({ id: 'p-2', productCode: 'B', brandName: 'Beta', stock: 1 }),
    ]);
    const names = (): (string | undefined)[] =>
      [...root().querySelectorAll('.inventory__main')].map((name) => name.textContent?.trim());
    expect(names()).toEqual(['Alfa', 'Beta']);

    (root().querySelector('[data-testid="tabla-ordenar"][data-columna="stock"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(names()).toEqual(['Beta', 'Alfa']);
  });

  it('no lista los retirados: no tienen inventario que llevar', () => {
    mount([product({}), product({ id: 'p-2', productCode: 'OLD', brandName: 'Retirado ya', status: 'WITHDRAWN' })]);

    expect(root().textContent).toContain('Paracetamol Bagó');
    expect(root().textContent).not.toContain('Retirado ya');
  });

  it('guarda sólo lo que cambió, en un único PATCH, y relee la tabla', () => {
    const first = product({});
    mount([first, product({ id: 'p-2', productCode: 'B-2', brandName: 'Segundo' })]);

    internal().setStock(first, '3');
    internal().setMinimum(first, '10');
    expect(internal().dirtyCount()).toBe(1);
    internal().save();

    const patch = http.expectOne(`/pharmacies/${PHARMACY.id}/inventory`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ lines: [{ productId: 'p-1', stock: 3, minStock: 10 }] });
    patch.flush({ updated: 1 });

    expectListing([product({ stock: 3, minStock: 10 })]);
    expect(internal().dirtyCount()).toBe(0);
  });

  it('volver al valor de origen deja la fila como no editada', () => {
    const first = product({});
    mount([first]);

    internal().setStock(first, '7');
    expect(internal().dirtyCount()).toBe(1);
    internal().setStock(first, '20');
    expect(internal().dirtyCount()).toBe(0);
  });

  it('no manda nada si hay un valor inválido, y dice de qué producto', () => {
    const first = product({});
    mount([first]);

    internal().setStock(first, '-3');
    internal().save();
    fixture.detectChanges();

    http.expectNone(`/pharmacies/${PHARMACY.id}/inventory`);
    expect(root().querySelector('[data-testid="inventory-errors"]')?.textContent).toContain('Paracetamol Bagó');
  });

  it('una alerta es sin stock o en el umbral o debajo, y lo escrito manda', () => {
    const first = product({ stock: 20, minStock: 5 });
    mount([first]);

    expect(internal().isAlert(first)).toBe(false);
    internal().setStock(first, '5');
    expect(internal().isAlert(first)).toBe(true);
    internal().setStock(first, '0');
    expect(internal().isAlert(first)).toBe(true);
  });

  it('«sólo con alertas» deja a la vista lo que está en alerta', () => {
    mount([
      product({}),
      product({ id: 'p-2', productCode: 'LOW', brandName: 'Casi se acaba', stock: 2, minStock: 5 }),
    ]);

    internal().toggleAlerts(true);
    fixture.detectChanges();

    expect(root().textContent).toContain('Casi se acaba');
    expect(root().textContent).not.toContain('Paracetamol Bagó');
  });

  it('buscar por nombre o código deja a la vista sólo lo que coincide', () => {
    mount([
      product({}),
      product({ id: 'p-2', productCode: 'IBU-400', brandName: 'Ibuprofeno Inti', genericName: 'Ibuprofeno' }),
    ]);

    internal().search('ibu-4');
    fixture.detectChanges();

    expect(root().textContent).toContain('Ibuprofeno Inti');
    expect(root().textContent).not.toContain('Paracetamol Bagó');

    internal().search('zzz');
    fixture.detectChanges();
    expect(root().textContent).toContain('Nada coincide con «zzz»');
  });

  describe('hay / no hay', () => {
    it('cambiar a «Hay / no hay» muestra un interruptor por producto y no las cantidades', () => {
      mount([product({}), product({ id: 'p-2', productCode: 'B-2', brandName: 'Segundo', inStock: false, stock: 0 })]);
      expect(root().querySelector('[data-testid="inventory-stock-PAR-500"]')).not.toBeNull();

      internal().setView('AVAILABILITY');
      fixture.detectChanges();

      expect(root().querySelector('[data-testid="inventory-stock-PAR-500"]')).toBeNull();
      expect(root().querySelector('[data-testid="inventory-has-PAR-500"]')).not.toBeNull();
      expect(root().textContent).toContain('¿Lo tiene?');
    });

    it('la forma elegida se recuerda para la próxima vez', () => {
      mount([product({})]);

      internal().setView('AVAILABILITY');

      expect(localStorage.getItem('mch.pharmacy.inventory.view')).toBe('AVAILABILITY');
    });

    it('guarda sólo el booleano —sin existencias— en el mismo PATCH', () => {
      const first = product({});
      mount([first, product({ id: 'p-2', productCode: 'B-2', brandName: 'Segundo' })]);

      internal().setView('AVAILABILITY');
      internal().setHas(first, false);
      expect(internal().hasNow(first)).toBe(false);
      expect(internal().dirtyCount()).toBe(1);
      internal().save();

      const patch = http.expectOne(`/pharmacies/${PHARMACY.id}/inventory`);
      expect(patch.request.body).toEqual({ lines: [{ productId: 'p-1', inStock: false }] });
      patch.flush({ updated: 1 });

      expectListing([product({ inStock: false })]);
      expect(internal().dirtyCount()).toBe(0);
    });

    it('volver a lo que ya estaba deja la fila como no editada', () => {
      const first = product({});
      mount([first]);

      internal().setHas(first, false);
      expect(internal().dirtyCount()).toBe(1);
      internal().setHas(first, true);
      expect(internal().dirtyCount()).toBe(0);
    });

    it('«sólo los que no tengo» filtra por el booleano', () => {
      const first = product({});
      mount([first, product({ id: 'p-2', productCode: 'B-2', brandName: 'Segundo', inStock: false, stock: 0 })]);
      internal().setView('AVAILABILITY');

      internal().toggleAlerts(true);
      fixture.detectChanges();

      expect(root().textContent).toContain('Segundo');
      expect(root().textContent).not.toContain('Paracetamol Bagó');
      expect(root().querySelector('[data-testid="inventory-only-alerts"]')?.textContent).toContain('Sólo los que no tengo');
    });

    it('cantidades y booleano pendientes viajan juntos; si una fila tiene las dos, mandan las cantidades', () => {
      const first = product({});
      const second = product({ id: 'p-2', productCode: 'B-2', brandName: 'Segundo' });
      mount([first, second]);

      internal().setStock(first, '4');
      internal().setHas(first, false);
      internal().setHas(second, false);
      internal().save();

      const patch = http.expectOne(`/pharmacies/${PHARMACY.id}/inventory`);
      expect(patch.request.body).toEqual({
        lines: [
          { productId: 'p-1', stock: 4, minStock: 5 },
          { productId: 'p-2', inStock: false },
        ],
      });
      patch.flush({ updated: 2 });
      expectListing([first, second]);
    });

    it('descartar suelta también lo escrito en «hay / no hay»', () => {
      const first = product({});
      mount([first]);
      internal().setHas(first, false);

      internal().discard();

      expect(internal().dirtyCount()).toBe(0);
      expect(internal().hasNow(first)).toBe(true);
    });
  });

  describe('CSV', () => {
    const disabled = (id: string): string | null | undefined =>
      root().querySelector(`[data-testid="${id}"]`)?.getAttribute('aria-disabled');

    it('«Subir» y «Exportar» esperan a que la tabla esté leída: el archivo se revisa contra ella', () => {
      fixture = TestBed.createComponent(PharmacyInventory);
      fixture.detectChanges();
      http
        .expectOne((r) => r.url.endsWith('/pharmacy/pharmacies'))
        .flush({ items: [{ ...PHARMACY, code: 'FC', siteCount: 1, productCount: 1 }], count: 1 });
      fixture.detectChanges();

      expect(disabled('inventory-upload')).toBe('true');
      expect(disabled('inventory-export')).toBe('true');

      flushSites([]);
      expectListing([product({})]);

      expect(disabled('inventory-upload')).not.toBe('true');
      expect(disabled('inventory-export')).not.toBe('true');
    });

    it('«Subir CSV» abre el diálogo con el catálogo leído', () => {
      mount([product({})]);

      (root().querySelector('[data-testid="inventory-upload"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(root().querySelector('[data-testid="inventory-upload-dialog"]')).not.toBeNull();
    });
  });
  describe('sucursal', () => {
    const SITES = [
      { siteId: 's-1', siteName: 'Casa central' },
      { siteId: 's-2', siteName: 'Sucursal Norte' },
    ];

    function flushSiteStock(siteId: string, productIds: readonly string[]): void {
      http.expectOne(`/pharmacy-inventory/sites/${siteId}/stock`).flush({
        siteId,
        siteName: SITES.find((site) => site.siteId === siteId)?.siteName ?? '',
        pharmacyId: PHARMACY.id,
        pharmacyName: PHARMACY.name,
        items: productIds.map((productId) => ({
          productId,
          productCode: productId,
          brandName: null,
          genericName: null,
          strengthText: null,
          packageSizeText: null,
          medication: null,
          onHandQuantity: 4,
          reservedQuantity: 0,
          availableQuantity: 4,
          locationCount: 1,
        })),
        count: productIds.length,
      });
      fixture.detectChanges();
    }

    const siteSelect = (): HTMLElement | null => root().querySelector('[data-testid="inventory-site"]');

    it('lista «Todas» y las sedes de opening-hours; con «Todas», la tabla de siempre', () => {
      mount([product({})], SITES);

      const options = (fixture.componentInstance as unknown as { sites: { options: () => { label: string }[] } }).sites
        .options()
        .map((option) => option.label);
      expect(options).toEqual(['Todas (lo declarado en el catálogo)', 'Casa central', 'Sucursal Norte']);
      expect(siteSelect()).not.toBeNull();
      expect(root().querySelector('[data-testid="inventory-table"]')).not.toBeNull();
      expect(root().querySelector('[data-testid="inventory-save"]')).not.toBeNull();
      expect(root().querySelector('app-site-stock-panel')).toBeNull();
    });

    it('abrir la pestaña no lee el stock de cada sede: lo lee al empezar a cambiar algo, una sola vez', () => {
      mount([product({})], SITES);
      expect(http.match((r) => r.url.includes('/pharmacy-inventory/sites/'))).toHaveLength(0);

      internal().setStock(product({}), '3');
      fixture.detectChanges();
      flushSiteStock('s-1', []);
      flushSiteStock('s-2', []);

      internal().setMinimum(product({}), '2');
      fixture.detectChanges();
      expect(http.match((r) => r.url.includes('/pharmacy-inventory/sites/'))).toHaveLength(0);
    });

    it('«Subir CSV» también lee el stock de las sedes antes de abrir el diálogo', () => {
      mount([product({})], SITES);

      (root().querySelector('[data-testid="inventory-upload"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      flushSiteStock('s-1', ['p-1']);
      flushSiteStock('s-2', []);
      expect(root().querySelector('[data-testid="inventory-ledger-notice"]')?.textContent).toContain('Casa central');
    });

    it('con «Todas», al cambiar algo avisa qué sede tiene stock propio', () => {
      mount([product({})], SITES);
      internal().setStock(product({}), '3');
      fixture.detectChanges();
      flushSiteStock('s-1', ['p-1']);
      flushSiteStock('s-2', []);

      const notice = root().querySelector('[data-testid="inventory-ledger-notice"]')?.textContent ?? '';
      expect(notice).toContain(
        'Casa central tiene stock propio en algunos productos: en esos, lo que cambie en "Todas" no la afecta',
      );
      expect(notice).not.toContain('Sucursal Norte');
    });

    it('sin ninguna sede que lleve su stock, no hay aviso', () => {
      mount([product({})], SITES);
      internal().setStock(product({}), '3');
      fixture.detectChanges();
      flushSiteStock('s-1', []);
      flushSiteStock('s-2', []);

      expect(root().querySelector('[data-testid="inventory-ledger-notice"]')).toBeNull();
    });

    it('elegir una sede cambia la tabla por la del stock de esa sede, y «Todas» la devuelve', () => {
      mount([product({})], SITES);

      (fixture.componentInstance as unknown as { chooseSite: (id: string | null) => void }).chooseSite('s-1');
      fixture.detectChanges();
      flushSiteStock('s-1', ['p-1']);

      expect(root().querySelector('app-site-stock-panel')).not.toBeNull();
      expect(root().querySelector('[data-testid="inventory-table"]')).toBeNull();
      expect(root().querySelector('[data-testid="site-stock-ledger-notice"]')).not.toBeNull();

      (fixture.componentInstance as unknown as { chooseSite: (id: string | null) => void }).chooseSite('all');
      fixture.detectChanges();
      expect(root().querySelector('[data-testid="inventory-table"]')).not.toBeNull();
    });

    it('si no se pueden leer las sucursales, queda la tabla de siempre y se puede reintentar', () => {
      fixture = TestBed.createComponent(PharmacyInventory);
      fixture.detectChanges();
      http
        .expectOne((r) => r.url.endsWith('/pharmacy/pharmacies'))
        .flush({ items: [{ ...PHARMACY, code: 'FC', siteCount: 1, productCount: 1 }], count: 1 });
      fixture.detectChanges();
      http
        .expectOne(`/pharmacies/${PHARMACY.id}/opening-hours`)
        .flush({ code: 'INTERNAL', message: 'x' }, { status: 500, statusText: 'Error' });
      expectListing([product({})]);

      expect(root().querySelector('[data-testid="inventory-sites-failed"]')).not.toBeNull();
      expect(siteSelect()).toBeNull();
      expect(root().querySelector('[data-testid="inventory-table"]')).not.toBeNull();

      (root().querySelector('[data-testid="inventory-sites-failed"] button') as HTMLButtonElement).click();
      flushSites(SITES);
      fixture.detectChanges();
      expect(siteSelect()).not.toBeNull();
    });
  });
});
