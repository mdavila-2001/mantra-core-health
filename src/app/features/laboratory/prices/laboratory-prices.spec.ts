import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LabPortalClient } from '../../../core/data-access/lab-portal/lab-portal.client';
import type {
  LabService,
  LabServiceChanges,
} from '../../../core/data-access/lab-portal/lab-portal.types';
import { LaboratoryPrices } from './laboratory-prices';
import type { PriceEdits, PriceRejection } from './laboratory-prices.rules';
import type { RowEdit } from './price-table/lab-price-table';

/**
 * La pestaña «Precios» del laboratorio: precio de lista y descuento AloVida
 * por servicio, con el precio AloVida recalculado mientras se escribe, las
 * modalidades del alta en su propia pestaña y lo rechazado sin perderse.
 */
function service(partial: Partial<LabService>): LabService {
  return {
    id: 's-1',
    code: 'HEM-01',
    name: 'Hemograma completo',
    kind: 'SERVICE',
    parentId: null,
    catalogConceptId: null,
    hasPrice: true,
    categoryId: null,
    categoryName: null,
    sampleType: null,
    preparation: null,
    description: null,
    turnaroundHours: null,
    requiresMedicalOrder: false,
    homeCollection: false,
    price: '80.00',
    alovidaDiscountPercent: 10,
    alovidaPrice: '72.00',
    currency: 'BOB',
    status: 'PUBLISHED',
    available: true,
    updatedAt: '2026-09-30T00:00:00Z',
    ...partial,
  };
}

const CATALOG = [
  service({}),
  service({ id: 's-2', code: 'GLU-01', name: 'Glucosa', price: '30.00', alovidaDiscountPercent: null, alovidaPrice: '30.00' }),
  service({ id: 's-3', code: 'OLD-01', name: 'Retirado', status: 'WITHDRAWN' }),
  service({ id: 's-4', code: 'RX-TORAX', name: 'Radiografía de tórax', price: null, alovidaDiscountPercent: null, alovidaPrice: null }),
  service({ id: 'm-1', code: 'MODALITY_XRAY', name: 'Rayos X', kind: 'MODALITY', price: null, alovidaDiscountPercent: null, alovidaPrice: null }),
];

interface Internal {
  setPrice: (edit: RowEdit) => void;
  setDiscount: (edit: RowEdit) => void;
  edits: () => PriceEdits;
  dirtyCount: () => number;
  save: () => void;
  errors: () => readonly string[];
  rejected: () => readonly PriceRejection[];
  modalities: () => readonly LabService[];
  importOpen: { (): boolean; set: (value: boolean) => void };
  importClosed: (imported: boolean) => void;
  tab: { set: (value: number) => void };
}

const edit = (row: LabService, value: string): RowEdit => ({ service: row, value });

describe('LaboratoryPrices', () => {
  let fixture: ComponentFixture<LaboratoryPrices>;
  let sent: { id: string; changes: LabServiceChanges }[];
  let listServices: ReturnType<typeof vi.fn>;
  let updateService: ReturnType<typeof vi.fn>;

  const internal = (): Internal => fixture.componentInstance as unknown as Internal;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => root().textContent ?? '';

  beforeEach(() => {
    sent = [];
    listServices = vi.fn(() => of({ items: CATALOG, count: CATALOG.length }));
    updateService = vi.fn((id: string, changes: LabServiceChanges) => {
      sent.push({ id, changes });
      return of(CATALOG[0]!);
    });

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: LabPortalClient,
          useValue: { listServices, updateService, listCategories: vi.fn(() => of({ items: [], count: 0 })) },
        },
      ],
    });
    fixture = TestBed.createComponent(LaboratoryPrices);
    fixture.detectChanges();
  });

  it('lista los servicios vivos con su precio AloVida, sin los retirados ni las modalidades', () => {
    expect(text()).toContain('Hemograma completo');
    expect(text()).toContain('72.00 Bs');
    expect(text()).not.toContain('Retirado');
    expect(root().querySelector('[data-testid="lab-prices-price-MODALITY_XRAY"]')).toBeNull();
  });

  it('un servicio sin precio se ve como «Sin precio», nunca como 0.00', () => {
    const price = root().querySelector<HTMLInputElement>('input[data-testid="lab-prices-price-RX-TORAX"]');
    expect(price?.value).toBe('');
    expect(price?.placeholder).toBe('Sin precio');
    expect(root().querySelector('[data-testid="lab-prices-alovida-RX-TORAX"]')?.textContent?.trim()).toBe('Sin precio');
    expect(text()).not.toMatch(/(^|[^\d])0\.00 Bs/);
  });

  it('las modalidades del alta van en su pestaña, con la explicación y sin casillas de precio', () => {
    expect(internal().modalities().map((m) => m.code)).toEqual(['MODALITY_XRAY']);
    const tabs = [...root().querySelectorAll('[role="tab"]')].map((tab) => tab.textContent?.trim());
    expect(tabs).toEqual(['Servicios', 'Modalidades declaradas (1)']);

    internal().tab.set(1);
    fixture.detectChanges();

    expect(root().querySelector('[data-testid="lab-modality-MODALITY_XRAY"]')?.textContent).toContain('Rayos X');
    expect(text()).toContain('Las modalidades no llevan precio');
    expect(root().querySelector('[data-testid="lab-prices-price-MODALITY_XRAY"]')).toBeNull();
  });

  it('el precio AloVida se recalcula con lo escrito, y sin cuenta posible lo dice', () => {
    const alovida = () => root().querySelector('[data-testid="lab-prices-alovida-HEM-01"]')?.textContent?.trim();
    internal().setPrice(edit(CATALOG[0]!, '100'));
    fixture.detectChanges();
    expect(alovida()).toBe('90.00 Bs');

    internal().setDiscount(edit(CATALOG[0]!, '25'));
    fixture.detectChanges();
    expect(alovida()).toBe('75.00 Bs');

    internal().setDiscount(edit(CATALOG[0]!, '150'));
    fixture.detectChanges();
    expect(alovida()).toBeUndefined();
    expect(text()).toContain('Revise el precio');
  });

  it('volver a lo que estaba deja la fila sin cambios, también en un servicio sin precio', () => {
    internal().setPrice(edit(CATALOG[0]!, '90'));
    internal().setPrice(edit(CATALOG[0]!, '80,00'));
    expect(internal().dirtyCount()).toBe(0);

    internal().setPrice(edit(CATALOG[3]!, '120'));
    expect(internal().dirtyCount()).toBe(1);
    internal().setPrice(edit(CATALOG[3]!, ''));
    expect(internal().dirtyCount()).toBe(0);
  });

  it('manda precio con dos decimales y descuento; vaciar el descuento lo quita', () => {
    internal().setPrice(edit(CATALOG[1]!, '35,5'));
    internal().setDiscount(edit(CATALOG[0]!, ''));
    internal().save();

    expect(sent).toEqual([
      { id: 's-1', changes: { price: '80.00', alovidaDiscountPercent: null } },
      { id: 's-2', changes: { price: '35.50', alovidaDiscountPercent: null } },
    ]);
    expect(internal().edits()).toEqual({});
    expect(listServices).toHaveBeenCalledTimes(2);
  });

  it('un precio o un descuento mal escrito no sale', () => {
    internal().setPrice(edit(CATALOG[0]!, 'ochenta'));
    internal().setDiscount(edit(CATALOG[1]!, '101'));
    internal().save();

    expect(sent).toEqual([]);
    expect(internal().errors()).toHaveLength(2);
  });

  it('lo que la API rechaza se queda escrito, con su motivo y la fila marcada; lo aceptado se relee', () => {
    updateService.mockImplementation((id: string, changes: LabServiceChanges) => {
      sent.push({ id, changes });
      return id === 's-2'
        ? throwError(() => new HttpErrorResponse({ status: 422, error: { code: 'PRECONDITION_FAILED', message: 'La unidad no está activa' } }))
        : of(CATALOG[0]!);
    });
    internal().setPrice(edit(CATALOG[0]!, '90'));
    internal().setPrice(edit(CATALOG[1]!, '40'));
    internal().save();
    fixture.detectChanges();

    expect(sent.map((s) => s.id)).toEqual(['s-1', 's-2']);
    expect(internal().rejected()).toEqual([{ id: 's-2', name: 'Glucosa', reason: 'La unidad no está activa' }]);
    expect(internal().edits()).toEqual({ 's-2': { price: '40', discount: '' } });
    expect(listServices).toHaveBeenCalledTimes(2);
    expect(root().querySelector<HTMLInputElement>('input[data-testid="lab-prices-price-GLU-01"]')?.value).toBe('40');
    expect(root().querySelector('[data-testid="lab-prices-rejected"]')?.textContent).toContain('La unidad no está activa');
    const glucose = root().querySelector('input[data-testid="lab-prices-price-GLU-01"]');
    const hemogram = root().querySelector('input[data-testid="lab-prices-price-HEM-01"]');
    expect(glucose?.closest('.status-error')).not.toBeNull();
    expect(hemogram?.closest('.status-error')).toBeNull();
  });

  it('«Importar análisis (CSV)» abre el diálogo de carga masiva, también desde la pestaña de modalidades', () => {
    const button = root().querySelector<HTMLButtonElement>('[data-testid="lab-prices-import"]');
    expect(button?.textContent?.trim()).toBe('Importar análisis (CSV)');
    button!.click();
    fixture.detectChanges();
    expect(root().querySelector('[data-testid="lab-import-dialog"]')).not.toBeNull();

    internal().importOpen.set(false);
    internal().tab.set(1);
    fixture.detectChanges();
    root().querySelector<HTMLButtonElement>('[data-testid="lab-modalities-import"]')!.click();
    expect(internal().importOpen()).toBe(true);
  });

  it('al cerrar la importación relee la lista sólo si se cargó algo', () => {
    expect(listServices).toHaveBeenCalledTimes(1);

    internal().importOpen.set(true);
    internal().importClosed(false);
    expect(listServices).toHaveBeenCalledTimes(1);

    internal().importOpen.set(true);
    internal().importClosed(true);
    expect(listServices).toHaveBeenCalledTimes(2);
    expect(internal().importOpen()).toBe(false);
  });
});
