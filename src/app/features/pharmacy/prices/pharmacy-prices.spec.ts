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
import { PharmacyPrices } from './pharmacy-prices';

/**
 * La pestaña «Precios» de la farmacia: se edita en la tabla, se manda sólo lo
 * que cambió, un precio mal escrito no sale y uno rechazado no frena al resto.
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
  setPrice: (product: PharmacyProduct, value: string) => void;
  priceOf: (product: PharmacyProduct) => string;
  dirtyCount: () => number;
  save: () => void;
  errors: () => readonly string[];
  rejected: () => readonly { name: string; reason: string }[];
}

describe('PharmacyPrices', () => {
  let fixture: ComponentFixture<PharmacyPrices>;
  let sent: { productId: string; changes: PharmacyProductChanges }[];
  let reply: (productId: string) => Observable<PharmacyProduct>;
  let searchProducts: ReturnType<typeof vi.fn>;

  const internal = (): Internal => fixture.componentInstance as unknown as Internal;

  beforeEach(() => {
    sent = [];
    reply = () => of(CATALOG[0]!);
    searchProducts = vi.fn(() => of({ items: CATALOG, limit: 500, truncated: false }));

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
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

  it('lista los productos vivos con su precio publicado, sin los retirados', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Paracetamol');
    expect(text).toContain('12.50 Bs');
    expect(text).toContain('Sin precio');
    expect(text).not.toContain('Retirado');
  });

  it('volver al mismo valor, escrito de otra forma, no cuenta como cambio', () => {
    internal().setPrice(CATALOG[0]!, '12,5');
    expect(internal().dirtyCount()).toBe(0);

    internal().setPrice(CATALOG[0]!, '13');
    expect(internal().dirtyCount()).toBe(1);
    expect(internal().priceOf(CATALOG[0]!)).toBe('13');
  });

  it('manda sólo las filas que cambiaron, con el precio como número; vacío es «sin precio»', () => {
    internal().setPrice(CATALOG[0]!, '');
    internal().setPrice(CATALOG[1]!, '8,90');
    internal().save();

    expect(sent).toEqual([
      { productId: 'p-1', changes: { unitPrice: null } },
      { productId: 'p-2', changes: { unitPrice: 8.9 } },
    ]);
    // La tabla se relee de la API: es la prueba de lo que quedó.
    expect(searchProducts).toHaveBeenCalledTimes(2);
  });

  it('un precio mal escrito no sale y se dice cuál', () => {
    internal().setPrice(CATALOG[0]!, '12.345');
    internal().setPrice(CATALOG[1]!, '0');
    internal().save();

    expect(sent).toEqual([]);
    expect(internal().errors()).toHaveLength(2);
    expect(internal().errors()[0]).toContain('Paracetamol');
  });

  it('uno rechazado por la API no frena a los demás y queda dicho con su motivo', () => {
    reply = (productId) =>
      productId === 'p-1'
        ? throwError(
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
          )
        : of(CATALOG[1]!);

    internal().setPrice(CATALOG[0]!, '20');
    internal().setPrice(CATALOG[1]!, '5');
    internal().save();

    expect(sent.map((s) => s.productId)).toEqual(['p-1', 'p-2']);
    expect(internal().rejected()).toHaveLength(1);
    expect(internal().rejected()[0]!.name).toBe('Paracetamol');
  });
});
