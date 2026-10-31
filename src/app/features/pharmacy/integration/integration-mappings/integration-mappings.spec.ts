import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from '@angular/common/http/testing';
import type { WritableSignal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  ExternalProduct,
  IntegrationConnection,
  ProductMapping,
} from '../../../../core/data-access/pharmacy/pharmacy-integration.types';
import type { PharmacyProduct } from '../../../../core/data-access/pharmacy/pharmacy.types';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { IntegrationMappings } from './integration-mappings';

/**
 * Corregir y deshacer un vínculo (FAR-C8): «Deshacer» confirma y borra,
 * «Corregir» manda sólo lo que cambió, el 404 y el 409 se dicen y el 409
 * ofrece corregir el vínculo que ya tiene el producto. Un código ambiguo se
 * distingue de uno libre y deja deshacer los vínculos que sobran. La unidad se
 * precarga con la del catálogo del sistema de la farmacia y se puede cambiar.
 */
const PHARMACY = '7f1c9a52-6d3e-4b18-9c47-2a5e8f0b1d63';
const CONNECTION: IntegrationConnection = {
  id: 'c1f20f08-4bbf-47f2-8e8e-7a238cde42ba',
  pharmacySiteId: null,
  siteName: null,
  integrationMode: 'BATCH',
  supportsStockQuery: true,
  status: 'ACTIVE',
  providerConfigured: true,
  createdAt: '2026-10-30T02:51:26.935Z',
};
const CONN = `/pharmacies/${PHARMACY}/integration-connections/${CONNECTION.id}`;

const MAPPINGS: readonly ProductMapping[] = [
  {
    id: 'm-1',
    externalProductCode: 'ERP-0001',
    pharmacyProductId: 'p-a',
    productCode: 'FAR06-A',
    productName: 'Producto A',
    externalUnitCode: 'BOX',
    createdAt: '2026-10-30T02:51:27.059Z',
  },
  {
    id: 'm-2',
    externalProductCode: 'ERP-0004',
    pharmacyProductId: 'p-b',
    productCode: 'FAR06-B',
    productName: 'Producto B',
    externalUnitCode: null,
    createdAt: '2026-10-30T02:51:27.059Z',
  },
  {
    id: 'm-3',
    externalProductCode: 'ERP-0004',
    pharmacyProductId: 'p-c',
    productCode: 'FAR06-C',
    productName: 'Producto C',
    externalUnitCode: null,
    createdAt: '2026-10-30T02:51:27.059Z',
  },
];

const EXTERNALS: readonly ExternalProduct[] = [
  {
    code: 'ERP-0001',
    name: 'Paracetamol 500 mg',
    presentation: 'Caja x 20',
    unitCode: 'BOX',
    mappedProductId: 'p-a',
    mappingStatus: 'MAPPED',
    mappedProductIds: ['p-a'],
  },
  {
    code: 'ERP-0003',
    name: 'Amoxicilina 500 mg',
    presentation: 'Caja x 21',
    unitCode: 'TAB',
    mappedProductId: null,
    mappingStatus: 'UNMAPPED',
    mappedProductIds: [],
  },
  {
    code: 'ERP-0004',
    name: 'Loratadina 10 mg',
    presentation: null,
    unitCode: 'BOX',
    mappedProductId: null,
    mappingStatus: 'AMBIGUOUS',
    mappedProductIds: ['p-b', 'p-c'],
  },
];

const PRODUCTS: readonly Partial<PharmacyProduct>[] = [
  { id: 'p-a', productCode: 'FAR06-A', brandName: 'Producto A', status: 'PUBLISHED' },
  { id: 'p-b', productCode: 'FAR06-B', brandName: 'Producto B', status: 'PUBLISHED' },
  { id: 'p-c', productCode: 'FAR06-C', brandName: 'Producto C', status: 'PUBLISHED' },
  { id: 'p-d', productCode: 'FAR06-D', brandName: 'Producto D', status: 'PUBLISHED' },
];

interface Internal {
  productOptions: () => readonly { value: string; disabled?: boolean; description?: string }[];
  externalOptions: () => readonly { value: string; disabled?: boolean; description?: string }[];
  productId: WritableSignal<string | null>;
  chooseExternal: (code: string | null) => void;
  chooseUnit: (value: string | null) => void;
}

function apiError(status: number, reason: string, details: Record<string, unknown> = {}): object {
  return { code: 'X', message: reason, reason, details: { reason, ...details }, correlationId: 'req-1' };
}

describe('IntegrationMappings · corregir y deshacer', () => {
  let fixture: ComponentFixture<IntegrationMappings>;
  let http: HttpTestingController;
  let confirm: ReturnType<typeof vi.spyOn>;

  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const byTestId = (id: string): HTMLElement | null => root().querySelector(`[data-testid="${id}"]`);
  const text = (id: string): string => byTestId(id)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const internal = (): Internal => fixture.componentInstance as unknown as Internal;
  const disabled = (id: string): boolean => byTestId(id)?.getAttribute('aria-disabled') === 'true';
  const unitInput = (): HTMLInputElement =>
    root().querySelector('input[data-testid="integration-link-unit"]') as HTMLInputElement;

  function expectOne(method: string, url: string): TestRequest {
    return http.expectOne((r) => r.method === method && r.url === url);
  }

  function answerReload(mappings: readonly ProductMapping[] = MAPPINGS, externals = EXTERNALS): void {
    expectOne('GET', `${CONN}/product-mappings`).flush({ items: mappings });
    expectOne('GET', `${CONN}/external-products`).flush({ items: externals });
    fixture.detectChanges();
  }

  /** El botón de una acción de la fila del vínculo. */
  function rowAction(mappingIndex: number, action: 'edit' | 'undo'): HTMLButtonElement {
    const menus = root().querySelectorAll('[data-testid="integration-mapping-actions"]');
    return menus[mappingIndex].querySelector(`[data-action="${action}"]`) as HTMLButtonElement;
  }

  /** Contesta lo que pide el modal al abrirse. */
  function answerDialog(): void {
    http.expectOne((r) => r.url.endsWith('/pharmacy/products')).flush({ items: PRODUCTS, limit: 500, truncated: false });
    expectOne('GET', `${CONN}/external-products`).flush({ items: EXTERNALS });
    fixture.detectChanges();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    confirm = vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(true);
    fixture = TestBed.createComponent(IntegrationMappings);
    fixture.componentRef.setInput('pharmacyId', PHARMACY);
    fixture.componentRef.setInput('connection', CONNECTION);
    fixture.detectChanges();
    answerReload();
  });

  afterEach(() => http.verify());

  it('muestra la unidad de cada vínculo y «Sin unidad» cuando no la declara', () => {
    const rows = [...root().querySelectorAll('[data-testid="integration-mappings-table"] tbody tr')].map((row) =>
      row.textContent?.replace(/\s+/g, ' '),
    );
    expect(rows[0]).toContain('BOX');
    expect(rows[1]).toContain('Sin unidad');
  });

  it('«Deshacer» confirma, borra con DELETE y relee la tabla', async () => {
    rowAction(0, 'undo').click();
    await fixture.whenStable();

    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ destructive: true, confirmLabel: 'Deshacer' }));
    expect(String((confirm.mock.calls[0][0] as { message: string }).message)).toContain('se conserva');
    expectOne('DELETE', `${CONN}/product-mappings/m-1`).flush({ ...MAPPINGS[0] });
    fixture.detectChanges();
    answerReload(MAPPINGS.slice(1));

    expect(text('integration-mappings-table')).not.toContain('Producto A');
  });

  it('si no se confirma, no borra nada', async () => {
    confirm.mockResolvedValue(false);
    rowAction(0, 'undo').click();
    await fixture.whenStable();

    http.expectNone(`${CONN}/product-mappings/m-1`);
  });

  it('un 404 al deshacer dice que ya no existe y relee', async () => {
    rowAction(0, 'undo').click();
    await fixture.whenStable();

    expectOne('DELETE', `${CONN}/product-mappings/m-1`).flush(apiError(404, 'EXTERNAL_MAPPING_NOT_AVAILABLE'), {
      status: 404,
      statusText: 'Not Found',
    });
    fixture.detectChanges();
    answerReload(MAPPINGS.slice(1));

    expect(text('integration-mappings-notice')).toContain('Ese vínculo ya no existe');
  });

  it('«Corregir» abre el modal con el vínculo y manda sólo lo que cambió', () => {
    rowAction(0, 'edit').click();
    fixture.detectChanges();
    answerDialog();

    expect(text('integration-link-dialog')).toContain('Corregir el vínculo');
    expect(unitInput().value).toBe('BOX');
    // Sin cambios no se puede guardar: la API respondería 400.
    expect(disabled('integration-link-save')).toBe(true);

    internal().chooseUnit('TAB');
    fixture.detectChanges();
    expect(disabled('integration-link-save')).toBe(false);
    (byTestId('integration-link-save') as HTMLButtonElement).click();

    const patch = expectOne('PATCH', `${CONN}/product-mappings/m-1`);
    expect(patch.request.body).toEqual({ externalUnitCode: 'TAB' });
    patch.flush({ id: 'm-1', pharmacyProductId: 'p-a', externalProductCode: 'ERP-0001', externalUnitCode: 'TAB' });
    fixture.detectChanges();
    answerReload([{ ...MAPPINGS[0], externalUnitCode: 'TAB' }, ...MAPPINGS.slice(1)]);

    expect(byTestId('integration-link-dialog')).toBeNull();
  });

  it('corregir el producto ofrece el propio y los libres; vaciar la unidad manda `null`', () => {
    rowAction(0, 'edit').click();
    fixture.detectChanges();
    answerDialog();

    expect(internal().productOptions().map((option) => option.value)).toEqual(['p-a', 'p-d']);
    internal().productId.set('p-d');
    internal().chooseUnit('');
    fixture.detectChanges();
    (byTestId('integration-link-save') as HTMLButtonElement).click();

    const patch = expectOne('PATCH', `${CONN}/product-mappings/m-1`);
    expect(patch.request.body).toEqual({ pharmacyProductId: 'p-d', externalUnitCode: null });
    patch.flush({ id: 'm-1', pharmacyProductId: 'p-d', externalProductCode: 'ERP-0001', externalUnitCode: null });
    fixture.detectChanges();
    answerReload();
  });

  it('un 409 dice que el producto ya está vinculado y ofrece corregir ese vínculo', () => {
    rowAction(0, 'edit').click();
    fixture.detectChanges();
    answerDialog();
    internal().productId.set('p-b');
    fixture.detectChanges();
    (byTestId('integration-link-save') as HTMLButtonElement).click();

    expectOne('PATCH', `${CONN}/product-mappings/m-1`).flush(
      apiError(409, 'EXTERNAL_MAPPING_PRODUCT_TAKEN', { productId: 'p-b', mappingId: 'm-2' }),
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    expect(text('integration-link-error')).toContain('ya está vinculado con otro código');
    (byTestId('integration-link-edit-taken') as HTMLButtonElement).click();
    fixture.detectChanges();
    answerDialog();

    // Ahora se corrige el vínculo m-2, el que ya tenía el producto.
    internal().chooseUnit('BOX');
    fixture.detectChanges();
    (byTestId('integration-link-save') as HTMLButtonElement).click();
    expectOne('PATCH', `${CONN}/product-mappings/m-2`).flush({ ...MAPPINGS[1], externalUnitCode: 'BOX' });
    fixture.detectChanges();
    answerReload();
  });

  it('un 404 al corregir lo dice dentro del modal y relee la tabla', () => {
    rowAction(0, 'edit').click();
    fixture.detectChanges();
    answerDialog();
    internal().chooseUnit('TAB');
    fixture.detectChanges();
    (byTestId('integration-link-save') as HTMLButtonElement).click();

    expectOne('PATCH', `${CONN}/product-mappings/m-1`).flush(apiError(404, 'EXTERNAL_MAPPING_NOT_AVAILABLE'), {
      status: 404,
      statusText: 'Not Found',
    });
    fixture.detectChanges();
    expectOne('GET', `${CONN}/product-mappings`).flush({ items: MAPPINGS.slice(1) });
    fixture.detectChanges();

    expect(text('integration-link-error')).toContain('Ese vínculo ya no existe');
  });

  it('un código ambiguo se marca, lista sus productos y deja deshacer los que sobran', async () => {
    const ambiguous = text('integration-ambiguous');
    expect(ambiguous).toContain('ERP-0004');
    expect(ambiguous).toContain('Producto B');
    expect(ambiguous).toContain('Producto C');
    expect(text('integration-mappings-table')).toContain('Ambiguo');

    (root().querySelectorAll('[data-testid="integration-ambiguous-undo"]')[1] as HTMLButtonElement).click();
    await fixture.whenStable();
    expectOne('DELETE', `${CONN}/product-mappings/m-3`).flush({ ...MAPPINGS[2] });
    fixture.detectChanges();
    answerReload(MAPPINGS.slice(0, 2), [
      EXTERNALS[0],
      EXTERNALS[1],
      { ...EXTERNALS[2], mappedProductId: 'p-b', mappingStatus: 'MAPPED', mappedProductIds: ['p-b'] },
    ]);

    expect(byTestId('integration-ambiguous')).toBeNull();
  });

  it('en el alta, sólo los códigos sin vincular se pueden elegir; el ambiguo dice por qué', () => {
    (byTestId('integration-link-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    answerDialog();

    const options = internal().externalOptions();
    expect(options.map((option) => [option.value, option.disabled])).toEqual([
      ['ERP-0001', true],
      ['ERP-0003', false],
      ['ERP-0004', true],
    ]);
    expect(options[2].description).toContain('Ambiguo: vinculado a 2 productos');
  });

  it('al elegir el código, la unidad se precarga con la del catálogo y se puede cambiar', () => {
    (byTestId('integration-link-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    answerDialog();

    internal().productId.set('p-d');
    internal().chooseExternal('ERP-0003');
    fixture.detectChanges();
    expect(unitInput().value).toBe('TAB');

    internal().chooseUnit('BLISTER');
    fixture.detectChanges();
    (byTestId('integration-link-save') as HTMLButtonElement).click();

    const create = expectOne('POST', `${CONN}/product-mappings`);
    expect(create.request.body).toEqual({
      pharmacyProductId: 'p-d',
      externalProductCode: 'ERP-0003',
      externalUnitCode: 'BLISTER',
    });
    create.flush({ id: 'm-9', pharmacyProductId: 'p-d', externalProductCode: 'ERP-0003' });
    fixture.detectChanges();
    answerReload();
  });
});
