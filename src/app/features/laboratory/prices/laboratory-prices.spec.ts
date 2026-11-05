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

/**
 * La pestaña «Precios» del laboratorio: precio de lista y descuento AloVida
 * por servicio, con el precio AloVida recalculado mientras se escribe.
 */
function service(partial: Partial<LabService>): LabService {
  return {
    id: 's-1',
    code: 'HEM-01',
    name: 'Hemograma completo',
    categoryId: null,
    categoryName: 'Hematología',
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
];

interface Internal {
  setPrice: (service: LabService, value: string) => void;
  setDiscount: (service: LabService, value: string) => void;
  alovidaPriceOf: (service: LabService) => string | null;
  dirtyCount: () => number;
  save: () => void;
  errors: () => readonly string[];
  importOpen: { (): boolean; set: (value: boolean) => void };
  importClosed: (imported: boolean) => void;
  toggleAvailable: (service: LabService, available: boolean) => void;
  availableOf: (service: LabService) => boolean;
  rejected: () => readonly { name: string; reason: string }[];
  services: () => { data?: readonly LabService[] };
}

describe('LaboratoryPrices', () => {
  let fixture: ComponentFixture<LaboratoryPrices>;
  let sent: { id: string; changes: LabServiceChanges }[];
  let listServices: ReturnType<typeof vi.fn>;
  let updateService: ReturnType<typeof vi.fn>;

  const internal = (): Internal => fixture.componentInstance as unknown as Internal;

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
          useValue: {
            listServices,
            listCategories: vi.fn(() => of({ items: [], count: 0 })),
            updateService,
          },
        },
      ],
    });
    fixture = TestBed.createComponent(LaboratoryPrices);
    fixture.detectChanges();
  });

  it('lista los servicios vivos con su precio AloVida, sin los retirados', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Hemograma completo');
    expect(text).toContain('72.00 Bs');
    expect(text).not.toContain('Retirado');
  });

  it('el precio AloVida se recalcula con lo escrito, y sin cuenta posible lo dice', () => {
    internal().setPrice(CATALOG[0]!, '100');
    expect(internal().alovidaPriceOf(CATALOG[0]!)).toBe('90.00 Bs');

    internal().setDiscount(CATALOG[0]!, '25');
    expect(internal().alovidaPriceOf(CATALOG[0]!)).toBe('75.00 Bs');

    internal().setDiscount(CATALOG[0]!, '150');
    expect(internal().alovidaPriceOf(CATALOG[0]!)).toBeNull();
  });

  it('volver a lo que estaba deja la fila sin cambios', () => {
    internal().setPrice(CATALOG[0]!, '90');
    internal().setPrice(CATALOG[0]!, '80,00');
    expect(internal().dirtyCount()).toBe(0);
  });

  it('manda precio con dos decimales y descuento; vaciar el descuento lo quita', () => {
    internal().setPrice(CATALOG[1]!, '35,5');
    internal().setDiscount(CATALOG[0]!, '');
    internal().save();

    expect(sent).toEqual([
      { id: 's-1', changes: { price: '80.00', alovidaDiscountPercent: null } },
      { id: 's-2', changes: { price: '35.50', alovidaDiscountPercent: null } },
    ]);
    expect(listServices).toHaveBeenCalledTimes(2);
  });

  it('un precio o un descuento mal escrito no sale', () => {
    internal().setPrice(CATALOG[0]!, 'ochenta');
    internal().setDiscount(CATALOG[1]!, '101');
    internal().save();

    expect(sent).toEqual([]);
    expect(internal().errors()).toHaveLength(2);
  });

  it('«Importar análisis (CSV)» abre el diálogo de carga masiva', () => {
    const root = fixture.nativeElement as HTMLElement;
    const button = root.querySelector<HTMLButtonElement>('[data-testid="lab-prices-import"]');
    expect(button?.textContent?.trim()).toBe('Importar análisis (CSV)');

    button!.click();
    fixture.detectChanges();

    expect(root.querySelector('[data-testid="lab-import-dialog"]')).not.toBeNull();
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

  describe('«Disponible hoy»', () => {
    it('cada fila trae su interruptor, con su estado y un nombre accesible', () => {
      const root = fixture.nativeElement as HTMLElement;
      const hemograma = root.querySelector('[data-testid="lab-prices-available-HEM-01"]');
      expect(hemograma).not.toBeNull();
      expect(root.querySelector('[data-testid="lab-prices-available-GLU-01"]')).not.toBeNull();
      expect(internal().availableOf(CATALOG[0]!)).toBe(true);
    });

    it('apagarlo manda sólo available:false, sin esperar a «Guardar cambios» ni tocar lo escrito', () => {
      updateService.mockImplementation((id: string, changes: LabServiceChanges) => {
        sent.push({ id, changes });
        return of({ ...CATALOG[1]!, available: false });
      });
      internal().setPrice(CATALOG[0]!, '90');

      internal().toggleAvailable(CATALOG[1]!, false);

      expect(sent).toEqual([{ id: 's-2', changes: { available: false } }]);
      expect(internal().dirtyCount()).toBe(1);
      // The row comes back from the PATCH response, not from a re-read of the whole list.
      expect(internal().services().data?.find((row) => row.id === 's-2')?.available).toBe(false);
      expect(listServices).toHaveBeenCalledTimes(1);
    });

    it('si la API lo rechaza, el interruptor vuelve a su estado y dice por qué', () => {
      updateService.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 422, error: { code: 'PRECONDITION_FAILED', message: 'No se pudo cambiar.' } })),
      );

      internal().toggleAvailable(CATALOG[0]!, false);

      expect(internal().availableOf(CATALOG[0]!)).toBe(true);
      expect(internal().rejected()).toEqual([{ name: 'Hemograma completo', reason: 'No se pudo cambiar.' }]);
    });
  });
});
