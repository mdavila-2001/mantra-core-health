import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
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
}

describe('LaboratoryPrices', () => {
  let fixture: ComponentFixture<LaboratoryPrices>;
  let sent: { id: string; changes: LabServiceChanges }[];
  let listServices: ReturnType<typeof vi.fn>;

  const internal = (): Internal => fixture.componentInstance as unknown as Internal;

  beforeEach(() => {
    sent = [];
    listServices = vi.fn(() => of({ items: CATALOG, count: CATALOG.length }));

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: LabPortalClient,
          useValue: {
            listServices,
            updateService: vi.fn((id: string, changes: LabServiceChanges) => {
              sent.push({ id, changes });
              return of(CATALOG[0]!);
            }),
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
});
