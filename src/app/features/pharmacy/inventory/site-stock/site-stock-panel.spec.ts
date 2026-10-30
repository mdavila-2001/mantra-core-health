import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { SiteStockItem } from '../../../../core/data-access/pharmacy/pharmacy-site-stock.types';
import type { PharmacyProduct } from '../../../../core/data-access/pharmacy/pharmacy.types';
import { ready } from '../../../../core/view-state/view-state';
import { SiteStockPanel } from './site-stock-panel';
import type { SiteStockRow } from './site-stock-rows';

/**
 * El stock de una sucursal (FAR-06): sólo viajan las filas cambiadas, un `PUT`
 * por fila y en serie; un rechazo deja su fila marcada y no frena a las demás;
 * al terminar se relee el stock de la sede.
 */
const PHARMACY_ID = 'ph-1';
const SITE_ID = 's-1';
const STOCK_URL = `/pharmacy-inventory/sites/${SITE_ID}/stock`;
const putUrl = (productId: string): string =>
  `/pharmacies/${PHARMACY_ID}/sites/${SITE_ID}/products/${productId}/availability`;

function product(id: string, partial: Partial<PharmacyProduct> = {}): PharmacyProduct {
  return {
    id,
    pharmacyId: PHARMACY_ID,
    pharmacyName: 'Farmacia',
    productCode: id.toUpperCase(),
    brandName: `Producto ${id.toUpperCase()}`,
    genericName: null,
    strengthText: null,
    packageSizeText: null,
    dosageForm: null,
    medication: null,
    requiresPrescription: false,
    status: 'PUBLISHED',
    inStock: true,
    stock: 5,
    minStock: null,
    ...partial,
  };
}

function item(productId: string, availableQuantity: number): SiteStockItem {
  return {
    productId,
    productCode: productId.toUpperCase(),
    brandName: null,
    genericName: null,
    strengthText: null,
    packageSizeText: null,
    medication: null,
    onHandQuantity: availableQuantity,
    reservedQuantity: 0,
    availableQuantity,
    locationCount: 1,
  };
}

interface Internal {
  setAvailable: (row: SiteStockRow, available: boolean) => void;
  setQuantity: (row: SiteStockRow, value: string | number | null) => void;
  save: () => void;
  dirtyCount: () => number;
  rows: () => readonly SiteStockRow[];
  rowErrors: () => Readonly<Record<string, string>>;
  saving: () => boolean;
}

describe('SiteStockPanel', () => {
  let fixture: ComponentFixture<SiteStockPanel>;
  let http: HttpTestingController;

  const internal = (): Internal => fixture.componentInstance as unknown as Internal;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const row = (productId: string): SiteStockRow => {
    const found = internal().rows().find((candidate) => candidate.productId === productId);
    if (found === undefined) {
      throw new Error(`sin fila ${productId}`);
    }
    return found;
  };

  function flushStock(items: readonly SiteStockItem[]): void {
    const request = http.expectOne(STOCK_URL);
    expect(request.request.method).toBe('GET');
    request.flush({ siteId: SITE_ID, siteName: 'Casa central', pharmacyId: PHARMACY_ID, pharmacyName: 'F', items, count: items.length });
    fixture.detectChanges();
  }

  function mount(products: readonly PharmacyProduct[], items: readonly SiteStockItem[]): void {
    fixture = TestBed.createComponent(SiteStockPanel);
    fixture.componentRef.setInput('pharmacyId', PHARMACY_ID);
    fixture.componentRef.setInput('siteId', SITE_ID);
    fixture.componentRef.setInput('siteName', 'Casa central');
    fixture.componentRef.setInput('products', ready(products));
    fixture.detectChanges();
    flushStock(items);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sede con stock propio: lo dice, muestra la marca del catálogo y qué fila sigue el catálogo', () => {
    mount(
      [product('a'), product('d', { inStock: false, stock: 4, outOfStockDeclared: true }), product('g')],
      [item('a', 3), item('d', 4)],
    );

    expect(root().querySelector('[data-testid="site-stock-ledger-notice"]')?.textContent).toContain(
      'Los productos con stock propio en esta sucursal no siguen lo que cambie en "Todas"',
    );
    const declared = root().querySelector('[data-testid="site-stock-row-D"]');
    expect(declared?.textContent).toContain('Marcado sin stock en el catálogo');
    expect(declared?.querySelector('app-switch')).toBeNull();
    const fromCatalog = root().querySelector('[data-testid="site-stock-row-G"]');
    expect(fromCatalog?.querySelector('[data-testid="site-stock-catalog-G"]')?.textContent).toContain(
      'Como en el catálogo',
    );
    expect(fromCatalog?.querySelector('app-switch')).not.toBeNull();
    expect(row('g')).toMatchObject({ kind: 'CATALOG', available: true, quantity: 5 });
    expect(root().querySelector('[data-testid="site-stock-catalog-A"]')).toBeNull();
  });

  it('sede sin stock propio: avisa que el producto que se cambie pasa a llevar el suyo', () => {
    mount([product('a')], []);

    expect(root().querySelector('[data-testid="site-stock-catalog-notice"]')?.textContent).toContain(
      'pasa a llevar su propio stock en esta sucursal',
    );
    expect(row('a')).toMatchObject({ kind: 'CATALOG', available: true, quantity: 5 });
    expect(root().querySelector('[data-testid="site-stock-catalog-A"]')).toBeNull();
  });

  it('guarda sólo las filas cambiadas, un PUT por fila y en serie, y relee el stock', () => {
    mount([product('a'), product('b'), product('c')], [item('a', 3), item('b', 2), item('c', 1)]);

    internal().setAvailable(row('a'), false);
    internal().setQuantity(row('c'), '9');
    expect(internal().dirtyCount()).toBe(2);
    internal().save();

    // En serie: el segundo PUT no sale hasta que responde el primero.
    const first = http.expectOne(putUrl('a'));
    expect(first.request.method).toBe('PUT');
    expect(first.request.body).toEqual({ available: false });
    http.expectNone(putUrl('c'));
    http.expectNone(putUrl('b'));
    first.flush({ siteId: SITE_ID, productId: 'a', available: false, quantity: 0, stockUpdatedAt: '2026-10-30T00:00:00Z' });

    const second = http.expectOne(putUrl('c'));
    expect(second.request.body).toEqual({ available: true, quantity: 9 });
    http.expectNone(STOCK_URL);
    second.flush({ siteId: SITE_ID, productId: 'c', available: true, quantity: 9, stockUpdatedAt: '2026-10-30T00:00:00Z' });

    flushStock([item('a', 0), item('b', 2), item('c', 9)]);
    expect(internal().dirtyCount()).toBe(0);
    expect(row('a')).toMatchObject({ available: false, quantity: 0 });
    expect(row('c')).toMatchObject({ available: true, quantity: 9 });
  });

  it('un 422 marca su fila con el motivo de la API y las demás se guardan', () => {
    mount([product('a'), product('b'), product('c')], [item('a', 0), item('b', 0), item('c', 0)]);

    internal().setAvailable(row('a'), true);
    internal().setAvailable(row('b'), true);
    internal().setAvailable(row('c'), true);
    internal().save();

    http.expectOne(putUrl('a')).flush({ siteId: SITE_ID, productId: 'a', available: true, quantity: 1, stockUpdatedAt: 'x' });
    http.expectOne(putUrl('b')).flush(
      {
        code: 'PRECONDITION_FAILED',
        message: 'La sede lleva este producto por lotes',
        details: { reason: 'SITE_PRODUCT_KEPT_BY_LOTS' },
        timestamp: '2026-10-30T00:00:00Z',
        path: putUrl('b'),
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    http.expectOne(putUrl('c')).flush({ siteId: SITE_ID, productId: 'c', available: true, quantity: 1, stockUpdatedAt: 'x' });

    flushStock([item('a', 1), item('b', 0), item('c', 1)]);

    expect(internal().rowErrors()).toEqual({ b: 'La sede lleva este producto por lotes' });
    expect(root().querySelector('[data-testid="site-stock-error-B"]')?.textContent).toContain(
      'La sede lleva este producto por lotes',
    );
    // La fila rechazada conserva lo elegido; las guardadas, no.
    expect(internal().dirtyCount()).toBe(1);
    expect(internal().saving()).toBe(false);
  });

  it('una cantidad imposible no viaja y se marca en su fila; las válidas se guardan', () => {
    mount([product('a'), product('b')], [item('a', 3), item('b', 3)]);

    internal().setQuantity(row('a'), '0');
    internal().setQuantity(row('b'), '4');
    internal().save();

    http.expectNone(putUrl('a'));
    http.expectOne(putUrl('b')).flush({ siteId: SITE_ID, productId: 'b', available: true, quantity: 4, stockUpdatedAt: 'x' });
    flushStock([item('a', 3), item('b', 4)]);

    expect(internal().rowErrors()['a']).toContain('al menos 1');
  });

  it('«No lo tengo» de un producto que sigue el catálogo manda el PUT solo de ese producto', () => {
    mount([product('a'), product('g')], [item('a', 3)]);

    internal().setAvailable(row('g'), false);
    expect(internal().dirtyCount()).toBe(1);
    internal().save();

    expect(http.expectOne(putUrl('g')).request.body).toEqual({ available: false });
    http.expectNone(putUrl('a'));
  });

  it('volver a lo guardado deja la fila sin cambios y no hay nada que mandar', () => {
    mount([product('a')], [item('a', 3)]);

    internal().setAvailable(row('a'), false);
    internal().setAvailable(row('a'), true);
    expect(internal().dirtyCount()).toBe(0);
    internal().save();

    http.expectNone(putUrl('a'));
  });

  it('si la lectura del stock falla, la tabla lo dice y reintentar vuelve a pedirlo', () => {
    fixture = TestBed.createComponent(SiteStockPanel);
    fixture.componentRef.setInput('pharmacyId', PHARMACY_ID);
    fixture.componentRef.setInput('siteId', SITE_ID);
    fixture.componentRef.setInput('siteName', 'Casa central');
    fixture.componentRef.setInput('products', ready([product('a')]));
    fixture.detectChanges();
    http.expectOne(STOCK_URL).error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(root().querySelector('[data-testid="site-stock-ledger-notice"]')).toBeNull();
    (fixture.componentInstance as unknown as { reload: () => void }).reload();
    flushStock([item('a', 3)]);
    expect(row('a').kind).toBe('TRACKED');
  });
});
