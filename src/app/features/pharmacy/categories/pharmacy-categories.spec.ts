import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { PharmacyCategory } from '../../../core/data-access/pharmacy/pharmacy.types';
import { DialogService } from '../../../shared/components/molecules/dialog/dialog-service';
import { PharmacyCategories } from './pharmacy-categories';

/**
 * «Categorías» de la farmacia (carril B, 29/09/2026): crear, renombrar y
 * eliminar, con el 409 de «tiene productos» a la vista en pantalla.
 */
const PHARMACY = { id: '7f1c9a52-6d3e-4b18-9c47-2a5e8f0b1d63', name: 'Farmacia del Centro' };
const CATEGORIES_URL = `/pharmacies/${PHARMACY.id}/categories`;

const CATEGORIES: readonly PharmacyCategory[] = [
  { id: 'c-1', name: 'Medicamentos', productCount: 12 },
  { id: 'c-2', name: 'Bienestar', productCount: 0 },
];

interface Internal {
  openNew: () => void;
  nameDraft: { set: (name: string) => void };
  save: () => void;
  onRowAction: (code: string, category: PharmacyCategory) => Promise<void>;
}

describe('PharmacyCategories', () => {
  let fixture: ComponentFixture<PharmacyCategories>;
  let http: HttpTestingController;

  const internal = (): Internal => fixture.componentInstance as unknown as Internal;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function expectList(items: readonly PharmacyCategory[] = CATEGORIES): void {
    http.expectOne((r) => r.url.endsWith(CATEGORIES_URL)).flush({ items });
    fixture.detectChanges();
  }

  function mount(): void {
    fixture = TestBed.createComponent(PharmacyCategories);
    fixture.detectChanges();
    http
      .expectOne((r) => r.url.endsWith('/pharmacy/pharmacies'))
      .flush({ items: [{ ...PHARMACY, code: 'FC', siteCount: 1, productCount: 1 }], count: 1 });
    fixture.detectChanges();
    expectList();
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DialogService, useValue: { confirm: () => Promise.resolve(true) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista las categorías con cuántos productos usa cada una', () => {
    mount();

    const text = root().textContent ?? '';
    expect(text).toContain('Medicamentos');
    expect(text).toContain('Bienestar');
    // Con productos, el conteo lleva al listado filtrado por esa categoría.
    const link = root().querySelector('a[href*="pharmacy-catalog"]') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toContain('category=Medicamentos');
  });

  it('crea una categoría con POST y relee la lista', () => {
    mount();

    internal().openNew();
    fixture.detectChanges();
    internal().nameDraft.set('Vitaminas');
    internal().save();

    const create = http.expectOne(CATEGORIES_URL);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ name: 'Vitaminas' });
    create.flush({ id: 'c-3', name: 'Vitaminas', productCount: 0 }, { status: 201, statusText: 'Created' });
    fixture.detectChanges();

    expectList([...CATEGORIES, { id: 'c-3', name: 'Vitaminas', productCount: 0 }]);
    expect(root().textContent).toContain('Vitaminas');
  });

  it('no manda un nombre vacío', () => {
    mount();

    internal().openNew();
    fixture.detectChanges();
    internal().nameDraft.set('   ');
    internal().save();
    fixture.detectChanges();

    http.expectNone(CATEGORIES_URL);
    expect(root().textContent).toContain('Escribí un nombre');
  });

  it('un nombre repetido es un 409 que se dice en el modal', () => {
    mount();

    internal().openNew();
    fixture.detectChanges();
    internal().nameDraft.set('medicamentos');
    internal().save();
    http
      .expectOne(CATEGORIES_URL)
      .flush(
        { statusCode: 409, code: 'CONFLICT', message: 'Ya existe una categoría con ese nombre' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    expect(root().querySelector('[data-testid="category-dialog"]')?.textContent).toContain(
      'Ya existe una categoría con ese nombre',
    );
  });

  it('renombra con PATCH', async () => {
    mount();

    await internal().onRowAction('rename', CATEGORIES[0]!);
    fixture.detectChanges();
    internal().nameDraft.set('Fármacos');
    internal().save();

    const rename = http.expectOne(`${CATEGORIES_URL}/c-1`);
    expect(rename.request.method).toBe('PATCH');
    expect(rename.request.body).toEqual({ name: 'Fármacos' });
    rename.flush({ id: 'c-1', name: 'Fármacos', productCount: 12 });
    fixture.detectChanges();

    expectList([{ id: 'c-1', name: 'Fármacos', productCount: 12 }, CATEGORIES[1]!]);
  });

  it('eliminar una con productos es un 409 que queda a la vista en la pantalla', async () => {
    mount();

    await internal().onRowAction('delete', CATEGORIES[0]!);
    http
      .expectOne(`${CATEGORIES_URL}/c-1`)
      .flush(
        { statusCode: 409, code: 'CONFLICT', message: 'La categoría tiene productos: pasalos a otra antes de eliminarla' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    expect(root().querySelector('[data-testid="categories-notice"]')?.textContent).toContain('tiene productos');
    // Y se relee: la lista que se ve no queda vieja.
    expectList();
  });

  it('elimina una sin productos con DELETE y relee', async () => {
    mount();

    await internal().onRowAction('delete', CATEGORIES[1]!);
    const remove = http.expectOne(`${CATEGORIES_URL}/c-2`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush({ ok: true });

    expectList([CATEGORIES[0]!]);
    expect(root().textContent).not.toContain('Bienestar');
  });
});
