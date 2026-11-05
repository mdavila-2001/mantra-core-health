import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LabPortalClient } from '../../../core/data-access/lab-portal/lab-portal.client';
import type { LabService } from '../../../core/data-access/lab-portal/lab-portal.types';
import { LaboratoryPrices } from './laboratory-prices';
import { panelGroups } from './laboratory-prices.rules';

/**
 * Panels and their components on the «Precios» screen (proceso 4.2): a panel
 * is followed by its parts, a part without a price waits out of sight, and the
 * catalog entry point cannot be used with unsaved edits.
 */
function service(partial: Partial<LabService>): LabService {
  return {
    id: 's-1',
    code: 'HEMOGRAMA',
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
    price: '60.00',
    alovidaDiscountPercent: null,
    alovidaPrice: '60.00',
    currency: 'BOB',
    status: 'PUBLISHED',
    available: true,
    updatedAt: '2026-11-05T00:00:00Z',
    ...partial,
  };
}

const PANEL = service({});
const HB = service({ id: 's-2', code: 'HEMOGRAMA.HB', name: 'Hemoglobina', parentId: 's-1', price: '12.00', alovidaPrice: '12.00' });
const VCM = service({
  id: 's-3',
  code: 'HEMOGRAMA.VCM',
  name: 'VCM',
  parentId: 's-1',
  hasPrice: false,
  price: null,
  alovidaPrice: null,
  status: 'DRAFT',
});

describe('panelGroups', () => {
  it('agrupa cada perfil con sus componentes, por nombre', () => {
    const glucose = service({ id: 's-9', code: 'GLU', name: 'Glucosa' });
    const groups = panelGroups([VCM, glucose, HB, PANEL], '');
    expect(groups.map((g) => g.map((s) => s.code))).toEqual([
      ['GLU'],
      ['HEMOGRAMA', 'HEMOGRAMA.HB', 'HEMOGRAMA.VCM'],
    ]);
  });

  it('buscar un componente deja su perfil y solo los componentes que coinciden', () => {
    expect(panelGroups([PANEL, HB, VCM], 'hemoglob').map((g) => g.map((s) => s.code))).toEqual([
      ['HEMOGRAMA', 'HEMOGRAMA.HB'],
    ]);
    expect(panelGroups([PANEL, HB, VCM], 'nada que coincida')).toEqual([]);
  });

  it('un componente huérfano (su perfil no está en la lista) se muestra solo', () => {
    expect(panelGroups([HB], '').map((g) => g.map((s) => s.code))).toEqual([['HEMOGRAMA.HB']]);
  });
});

describe('LaboratoryPrices con perfiles y componentes', () => {
  let fixture: ComponentFixture<LaboratoryPrices>;
  const root = (): HTMLElement => fixture.nativeElement as HTMLElement;

  function create(items: readonly LabService[]): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: LabPortalClient,
          useValue: { listServices: vi.fn(() => of({ items, count: items.length })), updateService: vi.fn() },
        },
      ],
    });
    fixture = TestBed.createComponent(LaboratoryPrices);
    fixture.detectChanges();
  }

  it('el componente se lee bajo su perfil y dice de cuál es', () => {
    create([PANEL, HB, VCM]);
    const names = [...root().querySelectorAll('.price-table__main')].map((n) => n.textContent?.trim());
    expect(names).toEqual(['Hemograma completo', 'Hemoglobina', 'VCM']);
    expect(root().textContent).toContain('Componente de Hemograma completo');
  });

  it('un componente sin precio queda «Falta el precio» y con la casilla vacía', () => {
    create([PANEL, HB, VCM]);
    expect(root().textContent).toContain('Falta el precio');
    const price = root().querySelector<HTMLInputElement>('input[data-testid="lab-prices-price-HEMOGRAMA.VCM"]');
    expect(price?.value).toBe('');
    expect(price?.placeholder).toBe('Sin precio');
  });

  it('«Agregar del catálogo» lleva al catálogo y se apaga con cambios sin guardar', () => {
    create([PANEL, HB, VCM]);
    const link = () => root().querySelector<HTMLAnchorElement>('[data-testid="lab-prices-catalog"]')!;
    expect(link().getAttribute('href')).toBe('/administration/laboratory-prices/catalog');
    expect(link().getAttribute('title')).toBeNull();

    (fixture.componentInstance as unknown as { edits: { set: (v: object) => void } }).edits.set({
      's-2': { price: '15', discount: '' },
    });
    fixture.detectChanges();

    expect(link().getAttribute('title')).toBe('Guarde o descarte los cambios antes de salir');
  });

  it('la página se corta por perfiles: 11 perfiles, 10 en la primera con todos sus componentes', () => {
    const profiles = Array.from({ length: 11 }, (_, i) =>
      service({ id: `p-${i}`, code: `P${String(i).padStart(2, '0')}`, name: `Perfil ${String(i).padStart(2, '0')}` }),
    );
    const parts = [0, 1, 2].map((i) =>
      service({ id: `c-${i}`, code: `P00.C${i}`, name: `Parte ${i}`, parentId: 'p-0' }),
    );
    create([...profiles, ...parts]);
    const rows = [...root().querySelectorAll('.price-table__main')].map((n) => n.textContent?.trim());
    expect(rows).toHaveLength(13);
    expect(rows.slice(0, 4)).toEqual(['Perfil 00', 'Parte 0', 'Parte 1', 'Parte 2']);
    expect(rows).not.toContain('Perfil 10');
  });
});
