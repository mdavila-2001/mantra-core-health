import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { PharmacyProduct } from '../../../../core/data-access/pharmacy/pharmacy.types';
import { InventoryUploadDialog } from './inventory-upload-dialog';

/**
 * «Subir inventario por CSV»: se revisa el archivo sin mandar nada y recién con
 * «Aplicar» sale un único `PATCH …/inventory`.
 */
const PHARMACY_ID = '7f1c9a52-6d3e-4b18-9c47-2a5e8f0b1d63';

function product(partial: Partial<PharmacyProduct>): PharmacyProduct {
  return {
    id: 'p-1',
    pharmacyId: PHARMACY_ID,
    pharmacyName: 'Farmacia',
    productCode: 'PAR-500',
    brandName: 'Paracetamol Bagó',
    genericName: null,
    strengthText: null,
    packageSizeText: null,
    dosageForm: null,
    medication: null,
    requiresPrescription: false,
    status: 'PUBLISHED',
    stock: 20,
    minStock: 5,
    inStock: true,
    ...partial,
  };
}

const CATALOG = [product({}), product({ id: 'p-2', productCode: 'IBU-400', brandName: 'Ibuprofeno' })];

interface Internal {
  choose: (files: readonly File[]) => Promise<void>;
  apply: () => void;
}

describe('InventoryUploadDialog', () => {
  let fixture: ComponentFixture<InventoryUploadDialog>;
  let http: HttpTestingController;
  let applied: number;

  const internal = (): Internal => fixture.componentInstance as unknown as Internal;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const testId = (id: string): string => root().querySelector(`[data-testid="${id}"]`)?.textContent?.trim() ?? '';

  function csv(content: string): File[] {
    return [new File([content], 'inventario.csv', { type: 'text/csv' })];
  }

  async function upload(content: string): Promise<void> {
    await internal().choose(csv(content));
    fixture.detectChanges();
  }

  beforeEach(() => {
    applied = 0;
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(InventoryUploadDialog);
    fixture.componentRef.setInput('pharmacyId', PHARMACY_ID);
    fixture.componentRef.setInput('products', CATALOG);
    fixture.componentInstance.applied.subscribe(() => (applied += 1));
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('revisa el archivo sin mandar nada: dice qué cambia y qué no vale', async () => {
    await upload('codigo;existencias\nPAR-500;3\nIBU-400;25\nNOPE;1\n');

    expect(testId('inventory-upload-changes')).toBe('2');
    expect(testId('inventory-upload-problems-count')).toBe('1');
    expect(testId('inventory-upload-problems')).toContain('NOPE');
    expect(testId('inventory-upload-problems')).toContain('Línea 4');
    http.expectNone(`/pharmacies/${PHARMACY_ID}/inventory`);
  });

  it('«Aplicar» manda un único PATCH con las filas válidas y avisa que terminó', async () => {
    await upload('codigo;existencias;umbral\nPAR-500;3;10\nNOPE;1;1\n');

    (root().querySelector('[data-testid="inventory-upload-apply"]') as HTMLButtonElement).click();
    fixture.detectChanges();

    const patch = http.expectOne(`/pharmacies/${PHARMACY_ID}/inventory`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ lines: [{ productId: 'p-1', stock: 3, minStock: 10 }] });
    patch.flush({ updated: 1 });
    fixture.detectChanges();

    expect(applied).toBe(1);
  });

  it('un archivo sólo con «disponible» manda el booleano, sin cantidades', async () => {
    await upload('codigo;disponible\nPAR-500;no\n');

    internal().apply();

    const patch = http.expectOne(`/pharmacies/${PHARMACY_ID}/inventory`);
    expect(patch.request.body).toEqual({ lines: [{ productId: 'p-1', inStock: false }] });
    patch.flush({ updated: 1 });
    expect(root().textContent).toContain('sólo si hay o no hay');
  });

  it('si el archivo no cambia nada lo dice y no deja aplicar', async () => {
    await upload('codigo;existencias;umbral\nPAR-500;20;5\n');

    expect(root().querySelector('[data-testid="inventory-upload-nothing"]')).not.toBeNull();
    expect(root().querySelector('[data-testid="inventory-upload-apply"]')?.getAttribute('aria-disabled')).toBe('true');
    internal().apply();
    http.expectNone(`/pharmacies/${PHARMACY_ID}/inventory`);
  });

  it('un archivo que no sirve entero se explica y no se revisa fila por fila', async () => {
    await upload('producto;color\nA;rojo\n');

    expect(testId('inventory-upload-file-error')).toContain('codigo');
    expect(root().querySelector('[data-testid="inventory-upload-summary"]')).toBeNull();
  });

  it('si el servidor rechaza, el diálogo queda abierto con el motivo y no avisa que terminó', async () => {
    await upload('codigo;existencias\nPAR-500;3\n');

    internal().apply();
    http
      .expectOne(`/pharmacies/${PHARMACY_ID}/inventory`)
      .flush(
        { statusCode: 422, code: 'VALIDATION_FAILED', message: 'lines are invalid', errors: [{ field: 'lines.0.stock', message: 'Las existencias son un número entero.' }] },
        { status: 422, statusText: 'Unprocessable Entity' },
      );
    fixture.detectChanges();

    expect(testId('inventory-upload-apply-error')).not.toBe('');
    expect(applied).toBe(0);
  });
});
