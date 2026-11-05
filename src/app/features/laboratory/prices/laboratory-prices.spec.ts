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
import type { PriceEdits } from './price-edits';

/**
 * La pestaña «Precios» del laboratorio: precio de lista y descuento AloVida
 * por servicio, con el precio AloVida recalculado mientras se escribe.
 */
function service(partial: Partial<LabService>): LabService {
  return {
    id: 's-1',
    code: 'HEM-01',
    name: 'Hemograma completo',
    parentId: null,
    catalogConceptId: null,
    hasPrice: true,
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
  service({
    id: 's-2',
    code: 'GLU-01',
    name: 'Glucosa',
    price: '30.00',
    alovidaDiscountPercent: null,
    alovidaPrice: '30.00',
  }),
  service({ id: 's-3', code: 'OLD-01', name: 'Retirado', status: 'WITHDRAWN' }),
];

interface Internal {
  edits: PriceEdits;
  save: () => void;
  errors: () => readonly string[];
  importOpen: { (): boolean; set: (value: boolean) => void };
  importClosed: (imported: boolean) => void;
}

describe('LaboratoryPrices', () => {
  let fixture: ComponentFixture<LaboratoryPrices>;
  let sent: { id: string; changes: LabServiceChanges }[];
  let listServices: ReturnType<typeof vi.fn>;

  const component = (): Internal => fixture.componentInstance as unknown as Internal;
  // The row edits live in `PriceEdits`; the assertions stay the same.
  const internal = () => {
    const c = component();
    return {
      ...c,
      save: () => c.save(),
      errors: () => c.errors(),
      importOpen: c.importOpen,
      importClosed: (imported: boolean) => c.importClosed(imported),
      setPrice: (s: LabService, v: string) => c.edits.setPrice(s, v),
      setDiscount: (s: LabService, v: string) => c.edits.setDiscount(s, v),
      alovidaPriceOf: (s: LabService) => c.edits.alovidaPriceOf(s),
      dirtyCount: () => c.edits.count(),
    };
  };

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
            listCategories: vi.fn(() => of({ items: [], count: 0 })),
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

  it('pone cada componente debajo de su perfil, con su propio monto', () => {
    const panel = service({
      id: 'p-1',
      code: 'HEMOGRAMA',
      name: 'Hemograma completo',
      catalogConceptId: 'c-1',
    });
    const hb = service({
      id: 'p-2',
      code: 'HEMOGRAMA.HB',
      name: 'Hemoglobina',
      parentId: 'p-1',
      price: '9.75',
      alovidaPrice: '9.75',
      alovidaDiscountPercent: null,
    });
    const vcm = service({
      id: 'p-3',
      code: 'HEMOGRAMA.VCM',
      name: 'Volumen corpuscular medio',
      parentId: 'p-1',
      hasPrice: false,
      price: '0.00',
      alovidaPrice: '0.00',
      status: 'DRAFT',
      alovidaDiscountPercent: null,
    });
    const glu = service({ id: 's-2', code: 'GLU-01', name: 'Glucosa' });
    listServices.mockReturnValue(of({ items: [vcm, glu, hb, panel], count: 4 }));
    fixture = TestBed.createComponent(LaboratoryPrices);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    const rows = [...root.querySelectorAll('.prices__main')].map((el) => el.textContent?.trim());
    expect(rows).toEqual([
      'Glucosa',
      'Hemograma completo',
      'Hemoglobina',
      'Volumen corpuscular medio',
    ]);
    expect(root.textContent).toContain('Componente de Hemograma completo');
    // Without a suggested price the row asks for one instead of showing 0.00.
    expect(root.textContent).toContain('Falta el precio');
    expect(component().edits.priceOf(vcm)).toBe('');

    component().edits.setPrice(vcm, '12');
    component().save();
    expect(sent).toEqual([
      { id: 'p-3', changes: { price: '12.00', alovidaDiscountPercent: null } },
    ]);
  });

  it('ofrece agregar análisis del catálogo', () => {
    const link = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="lab-prices-catalog"]',
    );
    expect(link?.getAttribute('href')).toBe('/administration/laboratory-prices/catalog');
  });
});
