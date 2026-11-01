import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { PharmacyProduct } from '../../../../core/data-access/pharmacy/pharmacy.types';
import { InventoryUploadDialog } from './inventory-upload-dialog';
import { afterAll, beforeAll } from 'vitest';
import { environment } from '../../../../../environments/environment';

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
  // Las escrituras de farmacia son «sólo simulador»: sin esto la petición no sale.
  const originalMockBackend = environment.mockBackend;
  beforeAll(() => Object.assign(environment, { mockBackend: true }));
  afterAll(() => Object.assign(environment, { mockBackend: originalMockBackend }));

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

  describe('con una sucursal elegida', () => {
    const SITE = { siteId: 'site-sur', siteName: 'Sucursal Sur' };
    const url = `/pharmacies/${PHARMACY_ID}/sites/${SITE.siteId}/availability/bulk`;

    beforeEach(() => {
      fixture.componentRef.setInput('site', SITE);
      fixture.detectChanges();
    });

    it('pide la vista previa al servidor (dryRun) y muestra lo que pasaría, sin escribir', async () => {
      await upload('codigo;existencias;umbral\nPAR-500;3;9\nIBU-400;0;9\nNOPE;1;1\nX;dos;1\n');

      const preview = http.expectOne(url);
      expect(preview.request.body).toEqual({
        mode: 'UPSERT',
        dryRun: true,
        rows: [
          { productCode: 'PAR-500', available: true, quantity: 3 },
          { productCode: 'IBU-400', available: false },
          { productCode: 'NOPE', available: true, quantity: 1 },
        ],
      });
      preview.flush({
        dryRun: true,
        results: [
          { row: 1, outcome: 'CREATED' },
          { row: 2, outcome: 'UPDATED' },
          { row: 3, outcome: 'REJECTED', errors: [{ field: 'productCode', reason: 'PRODUCT_NOT_FOUND' }] },
        ],
      });
      fixture.detectChanges();

      expect(testId('inventory-upload-site-note')).toContain('Sucursal Sur');
      expect(testId('inventory-upload-site-created')).toBe('1');
      expect(testId('inventory-upload-site-updated')).toBe('1');
      expect(testId('inventory-upload-site-problems-count')).toBe('2');
      expect(testId('inventory-upload-site-problems')).toContain('Línea 4');
      expect(testId('inventory-upload-site-problems')).toContain('No hay un producto con ese código');
      expect(testId('inventory-upload-site-problems')).toContain('Línea 5');
      expect(root().textContent).toContain('umbral');
      expect(testId('inventory-upload-apply')).toBe('Aplicar 2 cambios');
      http.expectNone(`/pharmacies/${PHARMACY_ID}/inventory`);
    });

    it('«Aplicar» manda lo mismo sin dryRun, avisa que terminó y no toca el inventario del catálogo', async () => {
      await upload('codigo;disponible\nPAR-500;sí\n');
      http.expectOne(url).flush({ dryRun: true, results: [{ row: 1, outcome: 'CREATED' }] });
      fixture.detectChanges();

      internal().apply();
      const real = http.expectOne(url);
      expect(real.request.body).toEqual({ mode: 'UPSERT', rows: [{ productCode: 'PAR-500', available: true }] });
      real.flush({ dryRun: false, results: [{ row: 1, outcome: 'CREATED', id: 'p-1' }] });
      fixture.detectChanges();

      expect(applied).toBe(1);
      http.expectNone(`/pharmacies/${PHARMACY_ID}/inventory`);
    });

    it('un código repetido no se manda en ninguna de sus filas', async () => {
      await upload('codigo;existencias\nPAR-500;3\nIBU-400;2\nPAR-500;4\n');

      const preview = http.expectOne(url);
      expect(preview.request.body.rows).toEqual([{ productCode: 'IBU-400', available: true, quantity: 2 }]);
      preview.flush({ dryRun: true, results: [{ row: 1, outcome: 'UPDATED' }] });
      fixture.detectChanges();

      expect(testId('inventory-upload-site-problems')).toContain('líneas 2, 4');
    });

    it('si el servidor rechaza filas al aplicar, quedan a la vista con su motivo y no se vuelve a aplicar', async () => {
      await upload('codigo;existencias\nPAR-500;3\nIBU-400;2\n');
      http.expectOne(url).flush({
        dryRun: true,
        results: [
          { row: 1, outcome: 'CREATED' },
          { row: 2, outcome: 'CREATED' },
        ],
      });
      fixture.detectChanges();

      internal().apply();
      http.expectOne(url).flush({
        dryRun: false,
        results: [
          { row: 1, outcome: 'CREATED', id: 'p-1' },
          { row: 2, outcome: 'REJECTED', errors: [{ field: 'available', reason: 'X', message: 'Cambió mientras tanto' }] },
        ],
      });
      fixture.detectChanges();

      expect(testId('inventory-upload-apply-error')).toContain('rechazó 1');
      expect(testId('inventory-upload-site-problems')).toContain('Cambió mientras tanto');
      expect(applied).toBe(1);
      internal().apply();
      http.expectNone(url);
    });
  });
});
