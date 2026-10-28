import type { OfertaDeFarmacia } from '@core/data-access/public-marketplace/public-marketplace.types';

import { ramasPorMarca, SIN_MARCA } from './medication-tree.logic';

function oferta(extra: Partial<OfertaDeFarmacia> = {}): OfertaDeFarmacia {
  return {
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
    ...extra,
  };
}

describe('ramasPorMarca', () => {
  it('cuelga cada farmacia de la marca que publica', () => {
    const ramas = ramasPorMarca(
      ['Cozaar', 'Losartán Inti'],
      [
        oferta(),
        oferta({
          pharmacySlug: 'farmacia-norte',
          pharmacyName: 'Farmacia Norte',
          brandName: 'Losartán Inti',
        }),
      ],
    );

    expect(ramas.map((r) => [r.marca, r.proveedores.map((p) => p.nombre)])).toEqual([
      ['Cozaar', ['Farmacia Central']],
      ['Losartán Inti', ['Farmacia Norte']],
    ]);
  });

  it('conserva la marca de la tarjeta aunque nadie la ofrezca hoy', () => {
    const ramas = ramasPorMarca(['Cozaar', 'Losartán Genérico'], [oferta()]);

    expect(ramas.find((r) => r.marca === 'Losartán Genérico')?.proveedores).toEqual([]);
  });

  it('una farmacia con dos presentaciones de la marca es un solo proveedor, en stock si alguna lo está', () => {
    const ramas = ramasPorMarca(
      ['Cozaar'],
      [oferta({ inStock: false }), oferta({ presentation: '100 mg', inStock: true })],
    );

    expect(ramas[0]?.proveedores).toHaveLength(1);
    expect(ramas[0]?.proveedores[0]?.enStock).toBe(true);
  });

  it('las ofertas sin marca van al final, con su rótulo', () => {
    const ramas = ramasPorMarca(
      [],
      [oferta({ brandName: null }), oferta({ pharmacySlug: 'otra', brandName: 'Cozaar' })],
    );

    expect(ramas.map((r) => r.marca)).toEqual(['Cozaar', SIN_MARCA]);
  });
});
