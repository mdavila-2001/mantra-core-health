import { TestBed } from '@angular/core/testing';

import { CartStore, type NuevaLineaDeCarrito } from './cart.store';
import type { CartLine, CartSite } from './pharmacy-cart.types';

const SEDE_A: CartSite = {
  pharmacyId: 'ph-1',
  pharmacyName: 'Farmacia Uno',
  siteId: 'site-a',
  siteName: 'Sede A',
  addressText: 'Av. Siempre Viva 123',
};

const SEDE_B: CartSite = {
  pharmacyId: 'ph-2',
  pharmacyName: 'Farmacia Dos',
  siteId: 'site-b',
  siteName: 'Sede B',
  addressText: null,
};

function lineaSinReceta(overrides: Partial<NuevaLineaDeCarrito> = {}): NuevaLineaDeCarrito {
  return {
    productId: 'prod-1',
    name: 'Paracetamol 500mg',
    presentation: 'Caja x 20',
    unitAmount: '10.50',
    currency: 'BOB',
    requiresPrescription: false,
    medicationConceptId: null,
    ...overrides,
  };
}

describe('CartStore', () => {
  let store: CartStore;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(CartStore);
  });

  it('arranca sin carrito', () => {
    expect(store.cart()).toBeNull();
    expect(store.unitCount()).toBe(0);
    expect(store.estimatedTotal()).toBeNull();
  });

  it('add() en un carrito vacío crea el carrito y devuelve added', () => {
    const resultado = store.add(SEDE_A, lineaSinReceta(), 2);

    expect(resultado).toBe('added');
    expect(store.cart()?.site.siteId).toBe('site-a');
    expect(store.cart()?.lines).toEqual([{ ...lineaSinReceta(), quantity: 2 }]);
  });

  it('add() con la misma sede y producto suma cantidad en vez de duplicar la línea', () => {
    store.add(SEDE_A, lineaSinReceta(), 1);
    store.add(SEDE_A, lineaSinReceta(), 2);

    expect(store.cart()?.lines.length).toBe(1);
    expect(store.cart()?.lines[0].quantity).toBe(3);
  });

  it('add() con una sede distinta a la del carrito devuelve conflict y no cambia nada', () => {
    store.add(SEDE_A, lineaSinReceta());
    const antes = store.cart();

    const resultado = store.add(SEDE_B, lineaSinReceta({ productId: 'prod-2' }));

    expect(resultado).toBe('conflict');
    expect(store.cart()).toEqual(antes);
  });

  it('add() de un producto con receta sin requestId devuelve requires-prescription y no cambia nada', () => {
    const resultado = store.add(
      SEDE_A,
      lineaSinReceta({ requiresPrescription: true, medicationConceptId: 'concept-1' }),
    );

    expect(resultado).toBe('requires-prescription');
    expect(store.cart()).toBeNull();
  });

  it('add() de un producto con receta SÍ agrega cuando el carrito ya tiene requestId', () => {
    store.replaceWith(SEDE_A, [], 'request-1');

    const resultado = store.add(
      SEDE_A,
      lineaSinReceta({ requiresPrescription: true, medicationConceptId: 'concept-1' }),
    );

    expect(resultado).toBe('added');
    expect(store.cart()?.requestId).toBe('request-1');
  });

  it('setQuantity(0) quita la línea y el carrito vacío es null', () => {
    store.add(SEDE_A, lineaSinReceta());

    store.setQuantity('prod-1', 0);

    expect(store.cart()).toBeNull();
  });

  it('setQuantity con una cantidad positiva actualiza esa línea', () => {
    store.add(SEDE_A, lineaSinReceta(), 1);

    store.setQuantity('prod-1', 5);

    expect(store.cart()?.lines[0].quantity).toBe(5);
  });

  it('remove() quita la línea indicada', () => {
    store.add(SEDE_A, lineaSinReceta());
    store.add(SEDE_A, lineaSinReceta({ productId: 'prod-2' }));

    store.remove('prod-1');

    expect(store.cart()?.lines.map((l) => l.productId)).toEqual(['prod-2']);
  });

  it('clear() vacía el carrito', () => {
    store.add(SEDE_A, lineaSinReceta());

    store.clear();

    expect(store.cart()).toBeNull();
  });

  it('unitCount() suma las cantidades de todas las líneas', () => {
    store.add(SEDE_A, lineaSinReceta(), 2);
    store.add(SEDE_A, lineaSinReceta({ productId: 'prod-2' }), 3);

    expect(store.unitCount()).toBe(5);
  });

  it('estimatedTotal() suma precio × cantidad de dos líneas: 10,50 + 2×3,25 = 17,00', () => {
    store.add(SEDE_A, lineaSinReceta({ unitAmount: '10.50' }), 1);
    store.add(SEDE_A, lineaSinReceta({ productId: 'prod-2', unitAmount: '3.25' }), 2);

    expect(store.estimatedTotal()).toEqual({ amount: '17.00', currency: 'BOB' });
  });

  it('estimatedTotal() es null si a alguna línea le falta precio', () => {
    store.add(SEDE_A, lineaSinReceta({ unitAmount: null, currency: null }), 1);

    expect(store.estimatedTotal()).toBeNull();
  });

  const cartLine = (overrides: Partial<CartLine> = {}): CartLine => ({
    ...lineaSinReceta(),
    quantity: 1,
    ...overrides,
  });

  it('replaceWith() vacía y arma de nuevo, con requestId', () => {
    store.add(SEDE_A, lineaSinReceta());

    store.replaceWith(SEDE_B, [cartLine({ productId: 'prod-9' })], 'req-2');

    expect(store.cart()?.site.siteId).toBe('site-b');
    expect(store.cart()?.requestId).toBe('req-2');
    expect(store.cart()?.lines).toEqual([cartLine({ productId: 'prod-9' })]);
  });
});
