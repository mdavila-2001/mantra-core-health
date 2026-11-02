import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { PublicMarketplaceClient } from '@core/data-access/public-marketplace/public-marketplace.client';
import type {
  PaginaDeVitrina,
  TarjetaDeMedicamento,
} from '@core/data-access/public-marketplace/public-marketplace.types';

import { BuscarMedicamentosListado } from './medicamentos-listado';

const PARACETAMOL: TarjetaDeMedicamento = {
  conceptId: 'c-paracetamol',
  atcCode: 'N02BE01',
  genericName: 'Paracetamol',
  therapeuticGroup: 'Sistema nervioso',
  brands: ['Kitadol', 'Tylenol'],
  presentations: ['500 mg Comprimidos'],
  requiresPrescription: false,
  priceFrom: '5.00',
  priceTo: '18.00',
  currency: 'BOB',
  pharmacyCount: 3,
  nearestKm: null,
};

const PAGINA: PaginaDeVitrina = {
  items: [PARACETAMOL],
  total: 1,
  groups: ['Sistema nervioso'],
  generatedAt: '2026-11-01T00:00:00.000Z',
};

describe('BuscarMedicamentosListado', () => {
  let fixture: ComponentFixture<BuscarMedicamentosListado>;
  let listMedications: ReturnType<typeof vi.fn>;
  let getAvailability: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    listMedications = vi.fn().mockReturnValue(of(PAGINA));
    getAvailability = vi.fn().mockReturnValue(of({
      medication: PARACETAMOL,
      offers: [],
      generatedAt: '2026-11-01T00:00:00.000Z',
    }));

    await TestBed.configureTestingModule({
      imports: [BuscarMedicamentosListado],
      providers: [
        {
          provide: PublicMarketplaceClient,
          useValue: { listMedications, getAvailability },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BuscarMedicamentosListado);
    await fixture.whenStable();
  });

  it('detecta coincidencia con nombre comercial y muestra el banner educativo', async () => {
    // Al inicio sin búsqueda no hay banner
    expect(fixture.nativeElement.querySelector('[data-testid="vitrina-coincidencia-marca"]')).toBeNull();

    // El paciente busca por la marca "Kitadol"
    fixture.componentInstance['buscar']('Kitadol');
    fixture.detectChanges();
    await fixture.whenStable();

    const coincidencia = fixture.componentInstance['coincidenciaMarca']();
    expect(coincidencia).toEqual({
      marca: 'Kitadol',
      compuesto: 'Paracetamol',
    });

    const banner = fixture.nativeElement.querySelector('[data-testid="vitrina-coincidencia-marca"]');
    expect(banner).not.toBeNull();
    expect(banner?.textContent).toContain('Kitadol');
    expect(banner?.textContent).toContain('Paracetamol');
  });

  it('permite alternar a la vista de grafo visual y renderiza app-medication-graph', async () => {
    fixture.componentInstance['vista'].set('grafo');
    fixture.detectChanges();
    await fixture.whenStable();

    const grafo = fixture.nativeElement.querySelector('app-medication-graph');
    expect(grafo).not.toBeNull();
  });
});
