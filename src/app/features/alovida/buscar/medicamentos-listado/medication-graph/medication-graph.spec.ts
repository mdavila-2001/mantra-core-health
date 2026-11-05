import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { PublicMarketplaceClient } from '@core/data-access/public-marketplace/public-marketplace.client';
import type {
  DisponibilidadDeMedicamento,
  TarjetaDeMedicamento,
} from '@core/data-access/public-marketplace/public-marketplace.types';

import { MedicationGraph } from './medication-graph';
import {
  buildMedicationTree,
  layoutMedicationGraph,
  resolveNodeDetail,
} from './medication-graph.tree';

const PARACETAMOL: TarjetaDeMedicamento = {
  conceptId: 'c-paracetamol',
  atcCode: 'N02BE01',
  genericName: 'Paracetamol',
  therapeuticGroup: 'Sistema nervioso',
  brands: ['Kitadol', 'Tylenol', 'Genfar'],
  presentations: ['500 mg Comprimidos'],
  requiresPrescription: false,
  priceFrom: '5.00',
  priceTo: '18.00',
  currency: 'BOB',
  pharmacyCount: 3,
  nearestKm: 1.2,
};

const DISPONIBILIDAD: DisponibilidadDeMedicamento = {
  medication: PARACETAMOL,
  offers: [
    {
      pharmacySlug: 'farmacorp-central',
      pharmacyName: 'Farmacorp Central',
      addressText: 'Av. Cristo Redentor',
      city: 'Santa Cruz',
      latitude: -17.78,
      longitude: -63.18,
      distanceKm: 1.2,
      brandName: 'Kitadol',
      presentation: '500 mg',
      price: '14.50',
      currency: 'BOB',
      inStock: true,
      homeDelivery: true,
      pickup: true,
      requiresPrescription: false,
    },
    {
      pharmacySlug: 'farmacia-chavez',
      pharmacyName: 'Farmacia Chávez',
      addressText: 'Calle 21 Calacoto',
      city: 'La Paz',
      latitude: -16.54,
      longitude: -68.08,
      distanceKm: 2.5,
      brandName: 'Tylenol',
      presentation: '500 mg',
      price: '18.00',
      currency: 'BOB',
      inStock: false,
      homeDelivery: false,
      pickup: true,
      requiresPrescription: false,
    },
  ],
  generatedAt: '2026-11-01T00:00:00.000Z',
};

describe('medication-graph.tree', () => {
  it('construye el nodo raíz con el compuesto químico, ATC y grupo', () => {
    const tree = buildMedicationTree(PARACETAMOL, undefined);
    expect(tree.label).toBe('Paracetamol');
    expect(tree.tone).toBe('aqua');
    expect(tree.sublabel).toContain('ATC N02BE01');
    expect(tree.sublabel).toContain('Venta libre');
    expect(tree.children.length).toBe(2); // Uso terapéutico y Marcas
  });

  it('resalta la marca buscada cuando el término coincide', () => {
    const tree = buildMedicationTree(PARACETAMOL, undefined, 'Kitadol');
    const grupoMarcas = tree.children.find((c: { key: string }) => c.key.startsWith('grupo:marcas:'));
    expect(grupoMarcas).toBeDefined();

    const kitadol = grupoMarcas?.children.find((m: { label: string }) => m.label === 'Kitadol');
    expect(kitadol?.tone).toBe('aqua'); // Resaltada por búsqueda

    const tylenol = grupoMarcas?.children.find((m: { label: string }) => m.label === 'Tylenol');
    expect(tylenol?.tone).toBe('sage'); // No resaltada
  });

  it('resuelve el detalle didáctico del compuesto, marca y proveedor', () => {
    const tree = buildMedicationTree(PARACETAMOL, undefined);
    const detalleCompuesto = resolveNodeDetail(tree, PARACETAMOL, undefined);
    expect(detalleCompuesto.type).toBe('compound');
    expect(detalleCompuesto.genericName).toBe('Paracetamol');
    expect(detalleCompuesto.explanation).toContain('principio activo');

    const nodoMarca = {
      key: 'marca:c-paracetamol:Kitadol',
      kind: 'term' as const,
      label: 'Kitadol',
      tone: 'sage' as const,
      expandable: false,
      expanded: false,
      loading: false,
      children: [],
    };
    const detalleMarca = resolveNodeDetail(nodoMarca, PARACETAMOL, undefined);
    expect(detalleMarca.type).toBe('brand');
    expect(detalleMarca.brandName).toBe('Kitadol');
    expect(detalleMarca.explanation).toContain('Paracetamol');
  });

  it('calcula la disposición espacial con layoutMedicationGraph sin fallar', () => {
    const placed = layoutMedicationGraph(PARACETAMOL, undefined);
    expect(placed.nodes.length).toBeGreaterThan(0);
    expect(placed.links.length).toBeGreaterThan(0);
    expect(placed.width).toBeGreaterThan(0);
    expect(placed.height).toBeGreaterThan(0);
  });
});

describe('MedicationGraph Component', () => {
  let fixture: ComponentFixture<MedicationGraph>;
  let getAvailability: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    getAvailability = vi.fn().mockReturnValue(of(DISPONIBILIDAD));

    await TestBed.configureTestingModule({
      imports: [MedicationGraph],
      providers: [
        {
          provide: PublicMarketplaceClient,
          useValue: { getAvailability },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MedicationGraph);
    fixture.componentRef.setInput('medications', [PARACETAMOL]);
    fixture.componentRef.setInput('searchTerm', '');
    await fixture.whenStable();
  });

  it('monta el componente y carga disponibilidad automáticamente', () => {
    expect(getAvailability).toHaveBeenCalledWith('c-paracetamol', { origin: undefined });
    const lienzo = fixture.nativeElement.querySelector('[data-testid="med-grafo-lienzo"]');
    expect(lienzo).not.toBeNull();
  });

  it('muestra la ficha lateral con el detalle didáctico del compuesto', () => {
    const ficha = fixture.nativeElement.querySelector('[data-testid="med-grafo-ficha"]');
    expect(ficha?.textContent).toContain('Paracetamol');
    expect(ficha?.textContent).toContain('Compuesto Químico');
  });

  it('permite cambiar a la vista de lista accesible', async () => {
    fixture.componentInstance.setMode('list');
    fixture.detectChanges();
    await fixture.whenStable();

    const lista = fixture.nativeElement.querySelector('[data-testid="med-grafo-lista"]');
    expect(lista).not.toBeNull();
    expect(lista?.textContent).toContain('Paracetamol');
    expect(lista?.textContent).toContain('Kitadol');
  });

  it('emite pharmaciesRequested al pulsar el botón de ver farmacias', () => {
    let emitido: TarjetaDeMedicamento | null = null;
    fixture.componentInstance.pharmaciesRequested.subscribe((med) => {
      emitido = med;
    });

    const boton = fixture.nativeElement.querySelector('[data-testid="med-grafo-ver-farmacias"]') as HTMLButtonElement;
    boton?.click();

    expect(emitido).toEqual(PARACETAMOL);
  });
});
