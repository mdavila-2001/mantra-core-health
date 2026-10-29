import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { PublicMarketplaceClient } from '@core/data-access/public-marketplace/public-marketplace.client';
import type {
  DisponibilidadDeMedicamento,
  OfertaDeFarmacia,
  TarjetaDeMedicamento,
} from '@core/data-access/public-marketplace/public-marketplace.types';

import { MedicationTree } from './medication-tree';

const LOSARTAN: TarjetaDeMedicamento = {
  conceptId: 'c-losartan',
  atcCode: 'C09CA01',
  genericName: 'Losartán',
  therapeuticGroup: 'Cardiovascular',
  brands: ['Cozaar', 'Losartán Inti'],
  presentations: ['50 mg'],
  requiresPrescription: true,
  priceFrom: '18.50',
  priceTo: '25.00',
  currency: 'BOB',
  pharmacyCount: 1,
  nearestKm: null,
};

const OFERTA: OfertaDeFarmacia = {
  pharmacySlug: 'farmacia-central',
  pharmacyName: 'Farmacia Central',
  addressText: null,
  city: 'Santa Cruz de la Sierra',
  latitude: -17.78,
  longitude: -63.18,
  distanceKm: null,
  brandName: 'Cozaar',
  presentation: '50 mg',
  price: '18.50',
  currency: 'BOB',
  inStock: true,
  homeDelivery: false,
  pickup: true,
  requiresPrescription: true,
};

describe('MedicationTree', () => {
  let fixture: ComponentFixture<MedicationTree>;
  let getAvailability: ReturnType<typeof vi.fn>;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  async function abrirCompuesto(): Promise<void> {
    const details = root().querySelector<HTMLDetailsElement>('[data-testid="arbol-compuesto"]');
    if (details === null) throw new Error('falta el compuesto');
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
    await fixture.whenStable();
  }

  async function montar(respuesta: unknown): Promise<void> {
    getAvailability = vi.fn(() => respuesta);
    await TestBed.configureTestingModule({
      imports: [MedicationTree],
      providers: [{ provide: PublicMarketplaceClient, useValue: { getAvailability } }],
    }).compileComponents();
    fixture = TestBed.createComponent(MedicationTree);
    fixture.componentRef.setInput('medications', [LOSARTAN]);
    await fixture.whenStable();
  }

  it('muestra compuesto, ATC, receta y para qué se usa sin pedir nada', async () => {
    await montar(of({ medication: LOSARTAN, offers: [], generatedAt: '' }));

    const texto = root().textContent ?? '';
    expect(texto).toContain('Losartán');
    expect(texto).toContain('ATC C09CA01');
    expect(texto).toContain('Con receta');
    expect(texto).toContain('Cardiovascular');
    expect(root().querySelector('[data-testid="arbol-indicaciones-sin-fuente"]')).not.toBeNull();
    expect(getAvailability).not.toHaveBeenCalled();
  });

  it('al abrir el compuesto cuelga cada marca de las farmacias que la ofrecen', async () => {
    const respuesta: DisponibilidadDeMedicamento = {
      medication: LOSARTAN,
      offers: [OFERTA],
      generatedAt: '',
    };
    await montar(of(respuesta));

    await abrirCompuesto();

    const marcas = root().querySelector('[data-testid="arbol-marcas"]');
    expect(marcas?.textContent).toContain('Cozaar');
    expect(marcas?.textContent).toContain('1 farmacia');
    expect(marcas?.textContent).toContain('Farmacia Central');
    expect(marcas?.textContent).toContain('Ninguna farmacia la publica hoy');
  });

  it('pide los proveedores una sola vez aunque se abra dos veces', async () => {
    await montar(of({ medication: LOSARTAN, offers: [OFERTA], generatedAt: '' }));

    await abrirCompuesto();
    await abrirCompuesto();

    expect(getAvailability).toHaveBeenCalledTimes(1);
  });

  it('mientras carga muestra las marcas de la tarjeta', async () => {
    await montar(new Subject<DisponibilidadDeMedicamento>());

    await abrirCompuesto();

    expect(root().textContent).toContain('Buscando quién lo ofrece');
    expect(root().textContent).toContain('Losartán Inti');
  });

  it('si falla, lo dice y deja reintentar', async () => {
    await montar(throwError(() => new Error('caído')));

    await abrirCompuesto();

    expect(root().querySelector('[role="alert"]')?.textContent).toContain(
      'No pudimos consultar quién lo ofrece',
    );
  });

  it('no afirma «venta libre» con el dato recortado de la tarjeta; sí con la disponibilidad', async () => {
    const sinReceta = { ...LOSARTAN, requiresPrescription: false };
    await montar(
      of({
        medication: { ...sinReceta, brands: ['Cozaar', 'Losartán Inti', 'Losartán Genérico'] },
        offers: [OFERTA],
        generatedAt: '',
      }),
    );
    fixture.componentRef.setInput('medications', [sinReceta]);
    await fixture.whenStable();
    expect(root().textContent).not.toContain('Venta libre');
    expect(root().textContent).not.toContain('Con receta');

    await abrirCompuesto();

    // Una farmacia lo publica bajo receta: la rama lo dice aunque la tarjeta no.
    expect(root().querySelector('summary')?.textContent).toContain('Con receta');
    expect(root().textContent).toContain('Losartán Genérico');
    expect(root().textContent).toContain('(3)');
  });

  it('reintentar vuelve a pedir, con el origen elegido', async () => {
    await montar(throwError(() => new Error('caído')));
    fixture.componentRef.setInput('origin', { lat: -17.78, lng: -63.18 });
    await fixture.whenStable();

    await abrirCompuesto();
    const antes = getAvailability.mock.calls.length;
    const reintentar = [...root().querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Reintentar'),
    );
    reintentar?.click();
    await fixture.whenStable();

    expect(getAvailability.mock.calls.length).toBe(antes + 1);
    expect(getAvailability).toHaveBeenLastCalledWith('c-losartan', {
      origin: { lat: -17.78, lng: -63.18 },
    });
  });

  it('si ninguna farmacia lo publica, lo dice en vez de dejar la rama vacía', async () => {
    await montar(of({ medication: { ...LOSARTAN, brands: [] }, offers: [], generatedAt: '' }));

    await abrirCompuesto();

    expect(root().querySelector('[data-testid="arbol-sin-marcas"]')).not.toBeNull();
  });
});
