import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PharmacyProduct } from '../../../core/data-access/pharmacy/pharmacy.types';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import type { RowAction } from '../../../shared/components/molecules/row-actions/row-actions.types';
import { PharmacyInventory } from './pharmacy-inventory';
import { afterAll, beforeAll } from 'vitest';
import { environment } from '../../../../environments/environment';

/**
 * The pharmacy «Inventario» tab: each row has «Editar» (a modal with Save and
 * Cancel) and «Vaciar»; what is shown comes from the re-read list.
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
  toggleAlerts: (only: boolean) => void;
  search: (term: string) => void;
  setView: (view: 'COUNT' | 'AVAILABILITY') => void;
  view: () => 'COUNT' | 'AVAILABILITY';
  isAlert: (product: PharmacyProduct) => boolean;
  actionsOf: (product: PharmacyProduct) => readonly RowAction[];
  onRowAction: (code: string, product: PharmacyProduct) => Promise<void>;
}

describe('PharmacyInventory', () => {
  // Las escrituras de farmacia son «sólo simulador»: sin esto la petición no sale.
  const originalMockBackend = environment.mockBackend;
  beforeAll(() => Object.assign(environment, { mockBackend: true }));
  afterAll(() => Object.assign(environment, { mockBackend: originalMockBackend }));

  let fixture: ComponentFixture<PharmacyInventory>;
  let http: HttpTestingController;
  let confirm: ReturnType<typeof vi.fn<(...args: unknown[]) => Promise<boolean>>>;

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
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DialogService, useValue: { confirm: (...args: unknown[]) => confirm(...args) } },
      ],
    });
    confirm = vi.fn((..._args: unknown[]) => Promise.resolve(true));
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

  it('sin corte no hay aviso, la tabla es compacta y no tiene campos para escribir', () => {
    mount([product({})]);

    expect(root().querySelector('[data-testid="inventory-truncated"]')).toBeNull();
    expect(root().querySelector('[data-testid="inventory-table"]')?.classList).toContain('data-table--dense');
    expect(root().querySelector('[data-testid="inventory-save"]')).toBeNull();
    expect(root().querySelector('[data-testid="inventory-table"] input')).toBeNull();
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

  describe('acciones de la fila', () => {
    const dialog = (): HTMLElement | null => root().querySelector('[data-testid="inventory-dialog"]');
    const byId = (id: string): HTMLElement => root().querySelector(`[data-testid="${id}"]`) as HTMLElement;

    async function edit(target: PharmacyProduct): Promise<void> {
      await internal().onRowAction('edit', target);
      fixture.detectChanges();
    }

    function type(id: string, value: string): void {
      const input = byId(id) as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }

    function save(): void {
      byId('inventory-dialog-save').click();
      fixture.detectChanges();
    }

    it('cada fila tiene «Acciones»: Editar siempre y Vaciar sólo si hay stock', () => {
      const empty = product({ id: 'p-2', productCode: 'B-2', brandName: 'Segundo', stock: 0 });
      mount([product({}), empty]);

      expect(root().querySelectorAll('app-row-actions')).toHaveLength(2);
      expect(internal().actionsOf(product({})).map((action) => action.label)).toEqual(['Editar', 'Vaciar']);
      expect(internal().actionsOf(empty).map((action) => action.label)).toEqual(['Editar']);
    });

    it('«Editar» abre el modal con lo actual; Guardar manda la fila en un PATCH, cierra y relee', async () => {
      const first = product({});
      mount([first, product({ id: 'p-2', productCode: 'B-2', brandName: 'Segundo' })]);

      await edit(first);
      expect(dialog()?.textContent).toContain('Editar inventario');
      expect((byId('inventory-dialog-stock') as HTMLInputElement).value).toBe('20');
      expect((byId('inventory-dialog-minimum') as HTMLInputElement).value).toBe('5');
      type('inventory-dialog-stock', '3');
      type('inventory-dialog-minimum', '10');
      save();

      const patch = http.expectOne(`/pharmacies/${PHARMACY.id}/inventory`);
      expect(patch.request.method).toBe('PATCH');
      expect(patch.request.body).toEqual({ lines: [{ productId: 'p-1', stock: 3, minStock: 10 }] });
      patch.flush({ updated: 1 });
      fixture.detectChanges();

      expect(dialog()).toBeNull();
      expectListing([product({ stock: 3, minStock: 10 })]);
    });

    it('sin conteo y sin escribirlo, sólo viaja el umbral', async () => {
      const uncounted = product({ stock: null, inStock: true });
      mount([uncounted]);

      await edit(uncounted);
      type('inventory-dialog-minimum', '2');
      save();

      const patch = http.expectOne(`/pharmacies/${PHARMACY.id}/inventory`);
      expect(patch.request.body).toEqual({ lines: [{ productId: 'p-1', minStock: 2 }] });
      patch.flush({ updated: 1 });
      expectListing([uncounted]);
    });

    it('un valor inválido no sale y el modal lo dice', async () => {
      const first = product({});
      mount([first]);

      await edit(first);
      type('inventory-dialog-stock', '-3');
      save();

      http.expectNone(`/pharmacies/${PHARMACY.id}/inventory`);
      expect(byId('inventory-dialog-error').textContent).toContain('números enteros');
      expect(dialog()).not.toBeNull();
    });

    it('con conteo, vaciar el campo de existencias no borra nada en silencio: lo dice', async () => {
      const first = product({});
      mount([first]);

      await edit(first);
      type('inventory-dialog-stock', '');
      save();

      http.expectNone(`/pharmacies/${PHARMACY.id}/inventory`);
      expect(byId('inventory-dialog-error').textContent).toContain('para dejarlo sin stock, ponga 0');
    });

    it('si la API lo rechaza, el modal sigue abierto con el motivo', async () => {
      const first = product({});
      mount([first]);

      await edit(first);
      save();
      http
        .expectOne(`/pharmacies/${PHARMACY.id}/inventory`)
        .flush({ statusCode: 422, code: 'VALIDATION_FAILED', message: 'Datos inválidos' }, { status: 422, statusText: 'Unprocessable' });
      fixture.detectChanges();

      expect(dialog()).not.toBeNull();
      expect(byId('inventory-dialog-error').textContent?.trim()).not.toBe('');
    });

    it('Cancelar cierra el modal sin mandar nada', async () => {
      const first = product({});
      mount([first]);

      await edit(first);
      type('inventory-dialog-stock', '1');
      [...dialog()!.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Cancelar')!.click();
      fixture.detectChanges();

      expect(dialog()).toBeNull();
      http.expectNone(`/pharmacies/${PHARMACY.id}/inventory`);
    });

    it('«Vaciar» pregunta y, si se acepta, deja las existencias en 0 y relee', async () => {
      const first = product({});
      mount([first]);

      await internal().onRowAction('empty', first);

      expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ destructive: true, confirmLabel: 'Vaciar' }));
      const patch = http.expectOne(`/pharmacies/${PHARMACY.id}/inventory`);
      expect(patch.request.body).toEqual({ lines: [{ productId: 'p-1', stock: 0 }] });
      patch.flush({ updated: 1 });
      expectListing([product({ stock: 0 })]);
    });

    it('«Vaciar» sin conteo marca «no hay»; si no se acepta, no manda nada', async () => {
      const uncounted = product({ stock: null, inStock: true });
      mount([uncounted]);

      confirm.mockResolvedValueOnce(false);
      await internal().onRowAction('empty', uncounted);
      http.expectNone(`/pharmacies/${PHARMACY.id}/inventory`);

      await internal().onRowAction('empty', uncounted);
      const patch = http.expectOne(`/pharmacies/${PHARMACY.id}/inventory`);
      expect(patch.request.body).toEqual({ lines: [{ productId: 'p-1', inStock: false }] });
      patch.flush({ updated: 1 });
      expectListing([product({ stock: null, inStock: false })]);
    });
  });

  it('una alerta es sin stock o en el umbral o debajo', () => {
    mount([product({})]);

    expect(internal().isAlert(product({ stock: 20, minStock: 5 }))).toBe(false);
    expect(internal().isAlert(product({ stock: 5, minStock: 5 }))).toBe(true);
    expect(internal().isAlert(product({ stock: 0, minStock: 5 }))).toBe(true);
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
    it('cambiar a «Hay / no hay» muestra «Hay» o «No hay» por producto y no las cantidades', () => {
      mount([product({}), product({ id: 'p-2', productCode: 'B-2', brandName: 'Segundo', inStock: false, stock: 0 })]);
      expect(root().textContent).toContain('Existencias');

      internal().setView('AVAILABILITY');
      fixture.detectChanges();

      const table = root().querySelector('[data-testid="inventory-table"]')!.textContent ?? '';
      expect(table).toContain('¿Lo tiene?');
      expect(table).not.toContain('Existencias');
      expect(table).toContain('No hay');
    });

    it('la forma elegida se recuerda para la próxima vez', () => {
      mount([product({})]);

      internal().setView('AVAILABILITY');

      expect(localStorage.getItem('mch.pharmacy.inventory.view')).toBe('AVAILABILITY');
    });

    it('el modal pide sólo si lo tiene y manda el booleano, sin existencias', async () => {
      const first = product({});
      mount([first]);
      internal().setView('AVAILABILITY');

      await internal().onRowAction('edit', first);
      fixture.detectChanges();
      expect(root().querySelector('[data-testid="inventory-dialog-stock"]')).toBeNull();
      (root().querySelector('[data-testid="inventory-dialog-has"] input') as HTMLInputElement).click();
      fixture.detectChanges();
      (root().querySelector('[data-testid="inventory-dialog-save"]') as HTMLButtonElement).click();

      const patch = http.expectOne(`/pharmacies/${PHARMACY.id}/inventory`);
      expect(patch.request.body).toEqual({ lines: [{ productId: 'p-1', inStock: false }] });
      patch.flush({ updated: 1 });
      // The API keeps the count (20): the row must follow the flag, not the quantity.
      expectListing([product({ inStock: false })]);
      const table = root().querySelector('[data-testid="inventory-table"]')!.textContent ?? '';
      expect(table).toContain('No hay');
      expect(internal().actionsOf(product({ inStock: false })).map((action) => action.label)).toEqual(['Editar']);
    });

    it('«Vaciar» en «Hay / no hay» marca «no hay» y conserva el conteo', async () => {
      const first = product({});
      mount([first]);
      internal().setView('AVAILABILITY');

      await internal().onRowAction('empty', first);

      const patch = http.expectOne(`/pharmacies/${PHARMACY.id}/inventory`);
      expect(patch.request.body).toEqual({ lines: [{ productId: 'p-1', inStock: false }] });
      patch.flush({ updated: 1 });
      expectListing([product({ inStock: false })]);
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
      expect(root().querySelector('app-site-stock-panel')).toBeNull();
    });

    it('abrir la pestaña no lee el stock de cada sede: lo lee al usar una acción de fila, una sola vez', async () => {
      mount([product({})], SITES);
      expect(http.match((r) => r.url.includes('/pharmacy-inventory/sites/'))).toHaveLength(0);

      await internal().onRowAction('edit', product({}));
      fixture.detectChanges();
      flushSiteStock('s-1', []);
      flushSiteStock('s-2', []);

      await internal().onRowAction('edit', product({}));
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

    it('con «Todas», al usar una acción de fila avisa qué sede tiene stock propio', async () => {
      mount([product({})], SITES);
      await internal().onRowAction('edit', product({}));
      fixture.detectChanges();
      flushSiteStock('s-1', ['p-1']);
      flushSiteStock('s-2', []);

      const notice = root().querySelector('[data-testid="inventory-ledger-notice"]')?.textContent ?? '';
      expect(notice).toContain(
        'Casa central tiene stock propio en algunos productos: en esos, lo que cambie en "Todas" no la afecta',
      );
      expect(notice).not.toContain('Sucursal Norte');
    });

    it('sin ninguna sede que lleve su stock, no hay aviso', async () => {
      mount([product({})], SITES);
      await internal().onRowAction('edit', product({}));
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
