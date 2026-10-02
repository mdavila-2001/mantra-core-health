import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { By } from '@angular/platform-browser';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type {
  CatalogProduct,
  PharmacyDirectoryPage,
  PharmacyProduct,
  PharmacyProductSearchPage,
} from '../../../core/data-access/pharmacy/pharmacy.types';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { PharmacyProducts } from './pharmacy-products';
import { ProductDialog } from './product-dialog/product-dialog';

/**
 * «Productos» de la farmacia (carril B, 29/09/2026).
 *
 * Se fija el recorrido de cada mutación contra la API simulada con
 * `HttpTestingController`: qué petición sale, con qué cuerpo, y que después de la
 * respuesta **se relee el catálogo** — la prueba de un alta es verla en la
 * lista, no el aviso.
 */
const PHARMACY = { id: '7f1c9a52-6d3e-4b18-9c47-2a5e8f0b1d63', name: 'Farmacia del Centro' };

const DIRECTORY: PharmacyDirectoryPage = {
  items: [{ ...PHARMACY, code: 'FC-01', siteCount: 1, productCount: 1 }],
  count: 1,
};

function product(partial: Partial<PharmacyProduct>): PharmacyProduct {
  return {
    id: 'p-1',
    pharmacyId: PHARMACY.id,
    pharmacyName: PHARMACY.name,
    productCode: 'PAR-500',
    brandName: 'Paracetamol Bagó',
    genericName: 'Paracetamol',
    strengthText: '500 mg',
    packageSizeText: 'Caja x 20',
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

function page(items: readonly PharmacyProduct[]): PharmacyProductSearchPage {
  return { items, limit: 500, truncated: false };
}

/** Lo que la spec toca del componente: señales y métodos protegidos. */
interface Internal {
  onRowAction: (code: string, product: PharmacyProduct) => Promise<void>;
  selection: { set: (rows: readonly PharmacyProduct[]) => void };
  filters: () => { status: string };
  totalFiltered: () => number;
  openNew: () => void;
}

describe('PharmacyProducts', () => {
  let fixture: ComponentFixture<PharmacyProducts>;
  let http: HttpTestingController;
  let confirmAnswer: boolean;

  const internal = (): Internal => fixture.componentInstance as unknown as Internal;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const text = (): string => root().textContent ?? '';
  const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

  function expectListing(items: readonly PharmacyProduct[]): void {
    const request = http.expectOne((r) => r.url.endsWith('/pharmacy/products'));
    expect(request.request.params.get('pharmacyId')).toBe(PHARMACY.id);
    // `managed` es lo que trae borradores y retirados: sin él la lista mentiría.
    expect(request.request.params.get('managed')).toBe('true');
    expect(request.request.params.get('limit')).toBe('500');
    request.flush(page(items));
    fixture.detectChanges();
  }

  function expectCategories(names: readonly string[] = ['Medicamentos']): void {
    http
      .expectOne((r) => r.url.endsWith(`/pharmacies/${PHARMACY.id}/categories`))
      .flush({ items: names.map((name, i) => ({ id: `c-${i}`, name, productCount: 0 })) });
    fixture.detectChanges();
  }

  function mount(items: readonly PharmacyProduct[] = [product({})]): void {
    fixture = TestBed.createComponent(PharmacyProducts);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/pharmacy/pharmacies')).flush(DIRECTORY);
    fixture.detectChanges();
    expectListing(items);
    expectCategories();
  }

  function dialog(): ProductDialog {
    return fixture.debugElement.query(By.directive(ProductDialog)).componentInstance as ProductDialog;
  }

  beforeEach(() => {
    confirmAnswer = true;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DialogService, useValue: { confirm: () => Promise.resolve(confirmAnswer) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('con una sola farmacia no pregunta cuál y lista todo su catálogo, borradores y retirados incluidos', () => {
    mount([
      product({}),
      product({ id: 'p-2', productCode: 'DRAFT-1', brandName: 'En borrador', status: 'DRAFT' }),
      product({ id: 'p-3', productCode: 'OLD-1', brandName: 'Retirado ya', status: 'WITHDRAWN' }),
    ]);

    expect(root().querySelector('.products__pharmacy')).toBeNull();
    expect(text()).toContain('Paracetamol Bagó');
    expect(text()).toContain('En borrador');
    expect(text()).toContain('Retirado ya');
    expect(text()).toContain('Borrador');
    expect(text()).toContain('Retirado');
  });

  it('un catálogo vacío dice qué hacer', () => {
    mount([]);

    expect(text()).toContain('Tu catálogo todavía no tiene productos.');
  });

  it('el filtro de estado viene de la URL y deja a la vista sólo lo que coincide', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'productos', component: PharmacyProducts }]),
        { provide: DialogService, useValue: { confirm: () => Promise.resolve(true) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    const harness = await RouterTestingHarness.create();
    const component = await harness.navigateByUrl('/productos?status=DRAFT', PharmacyProducts);
    http.expectOne((r) => r.url.endsWith('/pharmacy/pharmacies')).flush(DIRECTORY);
    harness.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/pharmacy/products'))
      .flush(
        page([
          product({}),
          product({ id: 'p-2', productCode: 'DRAFT-1', brandName: 'En borrador', status: 'DRAFT' }),
        ]),
      );
    http
      .expectOne((r) => r.url.endsWith(`/pharmacies/${PHARMACY.id}/categories`))
      .flush({ items: [] });
    harness.detectChanges();

    const internalComponent = component as unknown as Internal;
    expect(internalComponent.filters().status).toBe('DRAFT');
    expect(internalComponent.totalFiltered()).toBe(1);
    expect((harness.routeNativeElement as HTMLElement).textContent).toContain('En borrador');
    expect((harness.routeNativeElement as HTMLElement).textContent).not.toContain('Paracetamol Bagó');
  });

  describe('alta desde el modal', () => {
    /** Un producto real del catálogo (CIMA, ibuprofeno 400 mg) con dos presentaciones. */
    const IBUPROFENO: CatalogProduct = {
      id: 'cat-ibu',
      source: 'cima',
      sourceName: 'CIMA — Centro de Información online de Medicamentos de la AEMPS',
      code: '60885',
      display: 'DALSYDOL 400 MG COMPRIMIDOS RECUBIERTOS CON PELICULA EFG',
      holder: 'Laboratorio Stada S.L.',
      strengthText: '400 mg',
      dosageForm: 'COMPRIMIDO RECUBIERTO',
      requiresPrescription: true,
      generic: true,
      activeIngredients: [{ name: 'IBUPROFENO', amount: '400', unit: 'mg' }],
      atc: ['M01AE01'],
      presentations: [
        { code: '700001', name: 'DALSYDOL 400 mg, 20 comprimidos', gtin: null, active: true },
        { code: '700002', name: 'DALSYDOL 400 mg, 40 comprimidos', gtin: null, active: true },
      ],
      regulatoryStatus: 'ACTIVE',
      selectable: true,
      photo: null,
      sourceUrl: 'https://cima.aemps.es/cima/publico/detalle.html?nregistro=60885',
    };
    const REVOCADO: CatalogProduct = { ...IBUPROFENO, id: 'cat-rev', regulatoryStatus: 'REVOKED', selectable: false };

    interface DialogInternal {
      searchCatalog: (text: string) => void;
      chooseCatalog: (option: { value: string; label: string } | null) => void;
      setPresentation: (code: string | null) => void;
      setField: (f: string, v: string) => void;
      setStatus: (s: string) => void;
      save: () => void;
      selectedProduct: () => CatalogProduct | null;
      toggleRequest: () => void;
      setRequestField: (f: string, v: string) => void;
      sendRequest: () => void;
    }
    const inner = (): DialogInternal => dialog() as unknown as DialogInternal;

    function open(): void {
      internal().openNew();
      fixture.detectChanges();
    }

    /** Busca «ibup» en el catálogo, responde con los productos dados y elige el primero. */
    function chooseFromCatalog(results: readonly CatalogProduct[], pick: CatalogProduct): void {
      inner().searchCatalog('ibup');
      const search = http.expectOne((r) => r.url.endsWith('/pharmacy/catalog-products'));
      expect(search.request.params.get('search')).toBe('ibup');
      search.flush({ items: results, limit: 12, truncated: false });
      fixture.detectChanges();
      inner().chooseCatalog({ value: pick.id, label: pick.display });
      fixture.detectChanges();
    }

    it('el alta manda el id del catálogo y la presentación, nunca los datos del producto', () => {
      mount();
      open();
      chooseFromCatalog([IBUPROFENO], IBUPROFENO);
      // Aunque alguien los tipee (legado), un alta del catálogo no los manda.
      inner().setField('marca', 'Inventada');
      inner().setField('generico', 'Inventado');
      inner().setPresentation('700002');
      expect(inner().selectedProduct()?.id).toBe('cat-ibu');
      dialog().saved.subscribe(() => undefined);
      inner().save();
      fixture.detectChanges();

      const create = http.expectOne(`/pharmacies/${PHARMACY.id}/products`);
      expect(create.request.method).toBe('POST');
      expect(create.request.body).toEqual({
        productCode: '700002',
        catalogProductId: 'cat-ibu',
        catalogPresentationCode: '700002',
        inStock: true,
        status: 'PUBLISHED',
      });
      create.flush(
        { id: 'p-2', pharmacyId: PHARMACY.id, productCode: '700002', status: 's', identifierCount: 0, createdAt: '' },
        { status: 201, statusText: 'Created' },
      );
      fixture.detectChanges();

      expectListing([product({}), product({ id: 'p-2', productCode: '700002', brandName: IBUPROFENO.display })]);
      expect(text()).toContain('700002');
    });

    it('el SKU arranca con el código de la presentación y se puede cambiar', () => {
      mount();
      open();
      chooseFromCatalog([IBUPROFENO], IBUPROFENO);
      inner().setPresentation('700001');
      inner().setField('codigo', 'IBU-400-20');
      inner().setPresentation('700002');
      inner().save();

      const create = http.expectOne(`/pharmacies/${PHARMACY.id}/products`);
      expect((create.request.body as { productCode: string }).productCode).toBe('IBU-400-20');
      create.flush({}, { status: 201, statusText: 'Created' });
      fixture.detectChanges();
      expectListing([product({})]);
    });

    it('con varias presentaciones, elegir el producto sin decir cuál se vende no llama a la API', () => {
      mount();
      open();
      chooseFromCatalog([IBUPROFENO], IBUPROFENO);
      inner().setField('codigo', 'IBU');
      inner().save();
      fixture.detectChanges();

      http.expectNone(`/pharmacies/${PHARMACY.id}/products`);
      expect(root().querySelector('[data-testid="product-dialog-errors"]')?.textContent).toContain(
        'Elegí la presentación',
      );
    });

    it('guardar un borrador manda status DRAFT', () => {
      mount();
      open();
      chooseFromCatalog([IBUPROFENO], IBUPROFENO);
      inner().setPresentation('700001');
      inner().setStatus('DRAFT');
      inner().save();

      const create = http.expectOne(`/pharmacies/${PHARMACY.id}/products`);
      expect((create.request.body as { status: string }).status).toBe('DRAFT');
      create.flush({}, { status: 201, statusText: 'Created' });
      fixture.detectChanges();
      expectListing([product({})]);
    });

    it('sin elegir un medicamento del catálogo no hay alta: no llama a la API y lo dice', () => {
      mount();
      open();
      inner().setField('codigo', 'LIBRE-1');
      inner().setField('generico', 'Algo escrito a mano');
      inner().save();
      fixture.detectChanges();

      http.expectNone(`/pharmacies/${PHARMACY.id}/products`);
      expect(root().querySelector('[data-testid="product-dialog-errors"]')?.textContent).toContain(
        'Elegí el medicamento del catálogo oficial',
      );
    });

    it('un registro que no está vigente se lista pero no se puede elegir', () => {
      mount();
      open();
      chooseFromCatalog([REVOCADO], REVOCADO);

      expect(inner().selectedProduct()).toBeNull();
    });

    it('si falla la búsqueda no se rompe el modal ni queda elegido nada', () => {
      mount();
      open();
      inner().searchCatalog('ibup');
      http
        .expectOne((r) => r.url.endsWith('/pharmacy/catalog-products'))
        .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
      fixture.detectChanges();

      expect(inner().selectedProduct()).toBeNull();
      expect(root().querySelector('[data-testid="product-dialog"]')).not.toBeNull();
    });

    it('descarta la respuesta de una búsqueda vieja', () => {
      mount();
      open();
      inner().searchCatalog('ibu');
      const first = http.expectOne((r) => r.url.endsWith('/pharmacy/catalog-products'));
      inner().searchCatalog('ibup');
      const second = http.expectOne((r) => r.url.endsWith('/pharmacy/catalog-products'));
      second.flush({ items: [IBUPROFENO], limit: 12, truncated: false });
      first.flush({ items: [REVOCADO], limit: 12, truncated: false });
      fixture.detectChanges();

      inner().chooseCatalog({ value: 'cat-ibu', label: IBUPROFENO.display });
      expect(inner().selectedProduct()?.id).toBe('cat-ibu');
    });

    it('muestra el 409 de un producto repetido tal como lo dice la API y deja el modal abierto', () => {
      mount();
      open();
      chooseFromCatalog([IBUPROFENO], IBUPROFENO);
      inner().setPresentation('700001');
      inner().save();

      http
        .expectOne(`/pharmacies/${PHARMACY.id}/products`)
        .flush(
          { statusCode: 409, code: 'CONFLICT', message: 'Ya cargaste ese producto y presentación' },
          { status: 409, statusText: 'Conflict' },
        );
      fixture.detectChanges();

      expect(root().querySelector('[data-testid="product-dialog-errors"]')?.textContent).toContain(
        'Ya cargaste ese producto',
      );
      expect(root().querySelector('[data-testid="product-dialog"]')).not.toBeNull();
    });

    it('«no encuentro mi medicamento» manda la solicitud y no publica ningún producto', () => {
      mount();
      open();
      inner().toggleRequest();
      inner().setRequestField('name', 'Ibuprofeno Boliviano 600');
      inner().setRequestField('holder', 'Laboratorio Local');
      inner().sendRequest();

      const request = http.expectOne(`/pharmacies/${PHARMACY.id}/catalog-requests`);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ name: 'Ibuprofeno Boliviano 600', holder: 'Laboratorio Local' });
      request.flush({ id: 'r-1', status: 'PENDING', createdAt: '' }, { status: 201, statusText: 'Created' });
      http.expectNone(`/pharmacies/${PHARMACY.id}/products`);
    });

    it('la solicitud sin nombre no sale', () => {
      mount();
      open();
      inner().toggleRequest();
      inner().sendRequest();

      http.expectNone(`/pharmacies/${PHARMACY.id}/catalog-requests`);
    });
  });

  it('editar un producto del catálogo guarda lo suyo y NO manda nombre, concentración ni receta', async () => {
    const linked = product({
      unitPrice: '18.50',
      category: 'Medicamentos',
      catalog: {
        catalogProductId: 'cat-ibu',
        source: 'cima',
        sourceName: 'CIMA',
        code: '60885',
        presentationCode: '700001',
        officialPhoto: null,
      },
    });
    mount([linked]);

    await internal().onRowAction('edit', linked);
    fixture.detectChanges();
    expect(root().querySelector('[data-testid="product-official"]')).not.toBeNull();
    (dialog() as unknown as { save: () => void }).save();

    const save = http.expectOne(`/pharmacies/${PHARMACY.id}/products/p-1`);
    expect(save.request.method).toBe('PATCH');
    expect(save.request.body).toMatchObject({ unitPrice: 18.5, category: 'Medicamentos', inStock: true });
    for (const oficial of ['brandName', 'genericName', 'strengthText', 'packageSizeText', 'requiresPrescription']) {
      expect(save.request.body).not.toHaveProperty(oficial);
    }
    save.flush(linked);
    fixture.detectChanges();
    expectListing([linked]);
  });

  it('editar abre el modal con el producto y guarda con PATCH, sin tocar el código', async () => {
    const original = product({ unitPrice: '18.50', category: 'Medicamentos' });
    mount([original]);

    await internal().onRowAction('edit', original);
    fixture.detectChanges();
    (dialog() as unknown as { save: () => void }).save();

    const save = http.expectOne(`/pharmacies/${PHARMACY.id}/products/p-1`);
    expect(save.request.method).toBe('PATCH');
    expect(save.request.body).toMatchObject({
      brandName: 'Paracetamol Bagó',
      unitPrice: 18.5,
      category: 'Medicamentos',
      inStock: true,
      status: 'PUBLISHED',
    });
    expect(save.request.body).not.toHaveProperty('productCode');
    save.flush(product({}));
    fixture.detectChanges();
    expectListing([product({})]);
  });

  it('retira un producto confirmado y relee el catálogo', async () => {
    mount();

    // La acción termina cuando vuelve la petición: no se espera antes de responder.
    const done = internal().onRowAction('withdraw', product({}));
    await tick();
    const withdraw = http.expectOne(`/pharmacies/${PHARMACY.id}/products/p-1`);
    expect(withdraw.request.method).toBe('DELETE');
    withdraw.flush({ ok: true });
    await done;

    expectListing([product({ status: 'WITHDRAWN' })]);
    expect(text()).toContain('Retirado');
  });

  it('no retira nada si se cancela la confirmación', async () => {
    mount();
    confirmAnswer = false;

    await internal().onRowAction('withdraw', product({}));

    http.expectNone(`/pharmacies/${PHARMACY.id}/products/p-1`);
  });

  it('publica un borrador con PATCH status PUBLISHED', async () => {
    const draft = product({ status: 'DRAFT' });
    mount([draft]);

    await internal().onRowAction('publish', draft);
    const patch = http.expectOne(`/pharmacies/${PHARMACY.id}/products/p-1`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({ status: 'PUBLISHED' });
    patch.flush(product({}));
    await tick();

    expectListing([product({})]);
  });

  it('«marcar sin stock» avisa a la API y relee el catálogo', async () => {
    mount([product({ unitPrice: '18.50' })]);

    await internal().onRowAction('out-of-stock', product({}));
    const patch = http.expectOne(`/pharmacies/${PHARMACY.id}/products/p-1`);
    expect(patch.request.body).toEqual({ inStock: false });
    patch.flush(product({ inStock: false }));

    expectListing([product({ inStock: false, unitPrice: '18.50' })]);
    expect(text()).toContain('Sin stock');
    expect(text()).toContain('Bs 18.50');
  });

  describe('en lote', () => {
    const drafts = [
      product({ id: 'p-1', productCode: 'A-1', brandName: 'Uno', status: 'DRAFT' }),
      product({ id: 'p-2', productCode: 'A-2', brandName: 'Dos', status: 'DRAFT' }),
    ];

    it('publica lo seleccionado en serie: la segunda sale cuando vuelve la primera', async () => {
      mount(drafts);
      internal().selection.set(drafts);
      fixture.detectChanges();

      (root().querySelector('[data-testid="products-bulk-publish"]') as HTMLButtonElement).click();
      fixture.detectChanges();

      const first = http.expectOne(`/pharmacies/${PHARMACY.id}/products/p-1`);
      expect(first.request.body).toEqual({ status: 'PUBLISHED' });
      http.expectNone(`/pharmacies/${PHARMACY.id}/products/p-2`);
      first.flush(product({}));
      await tick();

      const second = http.expectOne(`/pharmacies/${PHARMACY.id}/products/p-2`);
      second.flush(product({ id: 'p-2' }));
      await tick();

      expectListing([]);
    });

    it('retirar en lote pide confirmación una sola vez y sigue aunque uno falle', async () => {
      mount(drafts);
      internal().selection.set(drafts);
      fixture.detectChanges();

      (root().querySelector('[data-testid="products-bulk-withdraw"]') as HTMLButtonElement).click();
      await tick();

      const first = http.expectOne(`/pharmacies/${PHARMACY.id}/products/p-1`);
      expect(first.request.method).toBe('DELETE');
      first.flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });
      await tick();

      // Un fallo no corta el resto.
      http.expectOne(`/pharmacies/${PHARMACY.id}/products/p-2`).flush({ ok: true });
      await tick();

      expectListing([drafts[0]!]);
    });
  });
});
