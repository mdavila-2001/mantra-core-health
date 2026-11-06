import { HttpErrorResponse } from '@angular/common/http';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PharmacyClient } from '../../../core/data-access/pharmacy/pharmacy.client';
import type {
  PharmacyProduct,
  PharmacyProductChanges,
} from '../../../core/data-access/pharmacy/pharmacy.types';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { ToastService } from '../../../shared/components/molecules/toast/toast.service';
import type { RowAction } from '../../../shared/components/molecules/row-actions/row-actions.types';
import { CsvExportService, toCsv, type CsvColumn } from '../../../shared/utils/csv-export/csv-export';
import { PharmacyPrices } from './pharmacy-prices';
import { afterAll, beforeAll } from 'vitest';
import { environment } from '../../../../environments/environment';

/**
 * The pharmacy «Precios» tab: each row has «Editar» (a modal with Save and
 * Cancel) and, when priced, «Quitar precio». Both send a `PATCH` and re-read
 * the table from the API.
 */
const PHARMACY = 'f-1';

function product(partial: Partial<PharmacyProduct>): PharmacyProduct {
  return {
    id: 'p-1',
    pharmacyId: PHARMACY,
    pharmacyName: 'Farmacia',
    productCode: 'PAR-500',
    brandName: 'Paracetamol',
    genericName: null,
    strengthText: null,
    packageSizeText: null,
    dosageForm: null,
    medication: null,
    requiresPrescription: false,
    status: 'PUBLISHED',
    unitPrice: '12.50',
    ...partial,
  };
}

const CATALOG = [
  product({}),
  product({ id: 'p-2', productCode: 'IBU-400', brandName: 'Ibuprofeno', unitPrice: null, status: 'DRAFT' }),
  product({ id: 'p-3', productCode: 'OLD-1', brandName: 'Retirado', status: 'WITHDRAWN' }),
];

interface Internal {
  actionsOf: (product: PharmacyProduct) => readonly RowAction[];
  onRowAction: (code: string, product: PharmacyProduct) => Promise<void>;
}

describe('PharmacyPrices', () => {
  // Las escrituras de farmacia son «sólo simulador»: sin esto la petición no sale.
  const originalMockBackend = environment.mockBackend;
  beforeAll(() => Object.assign(environment, { mockBackend: true }));
  afterAll(() => Object.assign(environment, { mockBackend: originalMockBackend }));

  let fixture: ComponentFixture<PharmacyPrices>;
  let sent: { productId: string; changes: PharmacyProductChanges }[];
  let reply: (productId: string) => Observable<PharmacyProduct>;
  let searchProducts: ReturnType<typeof vi.fn>;
  let confirm: ReturnType<typeof vi.fn>;

  const internal = (): Internal => fixture.componentInstance as unknown as Internal;

  beforeEach(() => {
    sent = [];
    reply = () => of(CATALOG[0]!);
    searchProducts = vi.fn(() => of({ items: CATALOG, limit: 500, truncated: false }));
    confirm = vi.fn(() => Promise.resolve(true));

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: DialogService, useValue: { confirm } },
        {
          provide: PharmacyClient,
          useValue: {
            listPharmacies: () => of({ items: [{ id: PHARMACY, name: 'Farmacia Central' }], count: 1 }),
            searchProducts,
            updateProduct: vi.fn((_pharmacy: string, productId: string, changes: PharmacyProductChanges) => {
              sent.push({ productId, changes });
              return reply(productId);
            }),
          },
        },
      ],
    });
    fixture = TestBed.createComponent(PharmacyPrices);
    fixture.detectChanges();
  });

  it('montada como pestaña de «Catálogo» (`embedded`) no dibuja su membrete', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('app-page-header')).not.toBeNull();

    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();

    expect(host.querySelector('app-page-header')).toBeNull();
  });

  it('lista los productos vivos con su precio publicado, sin los retirados', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Paracetamol');
    expect(text).toContain('12.50 Bs');
    expect(text).toContain('Sin precio');
    expect(text).not.toContain('Retirado');
  });

  describe('acciones de la fila', () => {
    const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
    const dialog = (): HTMLElement | null => root().querySelector('[data-testid="price-dialog"]');
    const byId = (id: string): HTMLElement => root().querySelector(`[data-testid="${id}"]`) as HTMLElement;

    async function edit(target: PharmacyProduct): Promise<void> {
      await internal().onRowAction('edit', target);
      fixture.detectChanges();
    }

    function type(value: string): void {
      const input = byId('price-dialog-input') as HTMLInputElement;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    }

    function click(id: string): void {
      byId(id).click();
      fixture.detectChanges();
    }

    it('cada fila tiene la columna «Acciones»: Editar siempre y Quitar precio sólo si tiene precio', () => {
      expect(root().querySelectorAll('app-row-actions')).toHaveLength(2);
      expect(internal().actionsOf(CATALOG[0]!).map((action) => action.label)).toEqual(['Editar', 'Quitar precio']);
      expect(internal().actionsOf(CATALOG[1]!).map((action) => action.label)).toEqual(['Editar']);
      expect(root().querySelector('input[inputmode="decimal"]')).toBeNull();
    });

    it('«Editar» abre el modal con el precio actual; Guardar manda el número, cierra y relee la tabla', async () => {
      await edit(CATALOG[0]!);
      expect(dialog()?.textContent).toContain('Editar precio');
      expect((byId('price-dialog-input') as HTMLInputElement).value).toBe('12.50');

      type('8,90');
      click('price-dialog-save');

      expect(sent).toEqual([{ productId: 'p-1', changes: { unitPrice: 8.9 } }]);
      expect(dialog()).toBeNull();
      expect(searchProducts).toHaveBeenCalledTimes(2);
    });

    it('un precio mal escrito o vacío no sale y el modal lo dice', async () => {
      await edit(CATALOG[1]!);

      for (const value of ['12.345', '0', '']) {
        type(value);
        click('price-dialog-save');
        expect(byId('price-dialog-error').textContent).toContain('Escriba el precio en bolivianos');
      }
      expect(sent).toEqual([]);
      expect(dialog()).not.toBeNull();
    });

    it('si la API lo rechaza, el modal sigue abierto con el motivo', async () => {
      reply = () =>
        throwError(
          () =>
            new HttpErrorResponse({
              status: 422,
              error: {
                statusCode: 422,
                code: 'VALIDATION_FAILED',
                message: 'Datos inválidos',
                issues: [{ field: 'unitPrice', message: 'El precio no es válido.' }],
              },
            }),
        );
      await edit(CATALOG[0]!);
      type('20');
      click('price-dialog-save');

      expect(dialog()).not.toBeNull();
      expect(byId('price-dialog-error').textContent?.trim()).not.toBe('');
      expect(searchProducts).toHaveBeenCalledTimes(1);
    });

    it('Cancelar cierra el modal sin mandar nada', async () => {
      await edit(CATALOG[0]!);
      type('99');
      const cancel = [...dialog()!.querySelectorAll('button')].find((button) => button.textContent?.trim() === 'Cancelar');
      cancel!.click();
      fixture.detectChanges();

      expect(dialog()).toBeNull();
      expect(sent).toEqual([]);
    });

    it('«Quitar precio» pregunta y, si se acepta, manda `unitPrice: null` y relee', async () => {
      await internal().onRowAction('clear', CATALOG[0]!);
      fixture.detectChanges();

      expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ destructive: true, confirmLabel: 'Quitar precio' }));
      expect(sent).toEqual([{ productId: 'p-1', changes: { unitPrice: null } }]);
      expect(searchProducts).toHaveBeenCalledTimes(2);
    });

    it('si la API rechaza «Quitar precio», lo avisa y no relee', async () => {
      const error = vi.spyOn(TestBed.inject(ToastService), 'error');
      reply = () => throwError(() => new HttpErrorResponse({ status: 500 }));

      await internal().onRowAction('clear', CATALOG[0]!);

      expect(error).toHaveBeenCalledTimes(1);
      expect(searchProducts).toHaveBeenCalledTimes(1);
    });

    it('si no se acepta, no se quita nada', async () => {
      confirm.mockResolvedValue(false);
      await internal().onRowAction('clear', CATALOG[0]!);

      expect(sent).toEqual([]);
    });
  });

  describe('catálogo de más de 500, exportar y ordenar', () => {
    const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

    function remount(truncated: boolean): void {
      searchProducts.mockReturnValue(of({ items: CATALOG, limit: 500, truncated }));
      fixture = TestBed.createComponent(PharmacyPrices);
      fixture.detectChanges();
    }

    it('con el listado cortado en 500 lo dice, como Productos', () => {
      expect(root().querySelector('[data-testid="prices-truncated"]')).toBeNull();

      remount(true);

      expect(root().querySelector('[data-testid="prices-truncated"]')?.textContent).toContain(
        'Se muestran los primeros 500',
      );
    });

    it('«Exportar CSV» baja código y precio publicado con los encabezados de la importación', () => {
      const download = vi.spyOn(TestBed.inject(CsvExportService), 'download').mockImplementation(() => undefined);

      (root().querySelector('[data-testid="prices-export"]') as HTMLButtonElement).click();

      const [rows, columns, filename] = download.mock.calls[0]!;
      expect(filename).toBe('precios-de-la-farmacia.csv');
      expect(toCsv(rows as readonly PharmacyProduct[], columns as readonly CsvColumn<PharmacyProduct>[])).toBe(
        'codigo,precio\r\nPAR-500,12.50\r\nIBU-400,',
      );
    });

    it('se ordena desde el encabezado, sin perder las filas', async () => {
      const header = root().querySelector('[data-testid="tabla-ordenar"][data-columna="name"]') as HTMLButtonElement;
      const names = (): (string | undefined)[] =>
        [...root().querySelectorAll('.prices__main')].map((name) => name.textContent?.trim());
      expect(names()).toEqual(['Paracetamol', 'Ibuprofeno']);

      header.click();
      await fixture.whenStable();

      expect(names()).toEqual(['Ibuprofeno', 'Paracetamol']);
      expect(root().querySelector('app-data-table')?.classList).toContain('data-table--dense');
    });
  });
});
