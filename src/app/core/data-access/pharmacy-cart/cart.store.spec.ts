import { TestBed } from '@angular/core/testing';

import { SessionStore } from '../../auth/session.store';
import type { AvailabilitySite } from '../pharmacy/pharmacy.types';
import type { CartStorage } from './cart.storage';
import { CART_STORAGE } from './cart.storage';
import { CartStore, type NuevaLineaDeCarrito } from './cart.store';
import type { CartState, CartLine, CartSite } from './pharmacy-cart.types';

function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => {
    const bytes = new TextEncoder().encode(JSON.stringify(o));
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.firma`;
}

/** Un adaptador en memoria: mismo patrón que `MemoriaStorage` de `tutorial-progress.store.spec.ts`. */
class MemoriaCartStorage implements CartStorage {
  readonly datos = new Map<string, CartState>();
  read(clave: string): CartState | null {
    return this.datos.get(clave) ?? null;
  }
  write(clave: string, cart: CartState): void {
    this.datos.set(clave, cart);
  }
  clear(clave: string): void {
    this.datos.delete(clave);
  }
}

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
  let storage: MemoriaCartStorage;
  let session: SessionStore;

  beforeEach(() => {
    storage = new MemoriaCartStorage();
    TestBed.configureTestingModule({
      providers: [{ provide: CART_STORAGE, useValue: storage }],
    });
    store = TestBed.inject(CartStore);
    session = TestBed.inject(SessionStore);
  });

  function abrirSesion(usuario: string): void {
    session.start({
      accessToken: jwt({ sub: usuario, roles: ['PATIENT'], tenants: ['t-1'] }),
      refreshToken: 'r-1',
    });
    TestBed.tick();
  }

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

  /* ---- persistencia por cuenta (H3.S1) ------------------------------------ */

  describe('persistencia por cuenta', () => {
    it('el carrito se escribe en el almacenamiento bajo la clave de la cuenta', () => {
      abrirSesion('u-1');

      store.add(SEDE_A, lineaSinReceta());
      TestBed.tick();

      expect(storage.datos.get('mantra.pharmacy.cart.u-1')?.lines[0].productId).toBe('prod-1');
    });

    it('cambiar de cuenta cambia el carrito: la cuenta nueva no ve el de la anterior', () => {
      abrirSesion('u-1');
      store.add(SEDE_A, lineaSinReceta());
      TestBed.tick();

      abrirSesion('u-2');

      expect(store.cart()).toBeNull();
    });

    it('volver a la cuenta anterior recupera su carrito', () => {
      abrirSesion('u-1');
      store.add(SEDE_A, lineaSinReceta());
      TestBed.tick();

      abrirSesion('u-2');
      abrirSesion('u-1');

      expect(store.cart()?.lines[0].productId).toBe('prod-1');
    });

    it('sin sesión usa la clave "anonimo" sin explotar', () => {
      expect(() => store.add(SEDE_A, lineaSinReceta())).not.toThrow();
      TestBed.tick();

      expect(storage.datos.get('mantra.pharmacy.cart.anonimo')?.lines[0].productId).toBe('prod-1');
    });
  });

  /* ---- toDraft (H3.S2) -----------------------------------------------------
   * El plan pedía comparar contra `borradorDePedido()` (where-to-buy.ts:836)
   * importada. No se importa: es de `features/`, y `core/` nunca importa de
   * `features/` (regla del propio ESLint del repo, `no-restricted-imports`).
   * En su lugar, las líneas esperadas están escritas a mano, verificadas por
   * lectura contra `borradorDePedido()` (where-to-buy.ts:836-885): mismo
   * criterio de `disponible` (`producto !== undefined && !missingProductIds`),
   * mismo origen de precio (`patientAmount ?? unitAmount`) y mismo `requestId`
   * (el del carrito, o `''`). */

  describe('toDraft()', () => {
    const CONCEPT: { code: string; display: string } = { code: 'BOB', display: 'Boliviano' };

    function producto(overrides: Partial<AvailabilitySite['products'][number]> = {}) {
      return {
        productId: 'prod-1',
        productCode: 'PC-1',
        brandName: 'Marca',
        genericName: 'Genérico',
        strengthText: '500 mg',
        packageSizeText: 'Caja x 20',
        medication: null,
        availableQuantity: 10,
        price: { unitAmount: '10.00', patientAmount: '10.00', currency: CONCEPT, priceListCode: 'p1' },
        ...overrides,
      };
    }

    function sede(overrides: Partial<AvailabilitySite> = {}): AvailabilitySite {
      return {
        siteId: 'site-a',
        siteName: 'Sede A',
        pharmacyId: 'ph-1',
        pharmacyName: 'Farmacia Uno',
        addressText: 'Av. Siempre Viva 123',
        latitude: null,
        longitude: null,
        distanceKm: null,
        homeDeliveryAvailable: null,
        pickupAvailable: null,
        complete: true,
        availableCount: 1,
        missingProductIds: [],
        totalAmount: '10.00',
        currency: CONCEPT,
        products: [producto()],
        ...overrides,
      };
    }

    it('con stock disponible: precio, moneda y disponible=true salen de site.products', () => {
      const sitio = sede();
      store.replaceWith(
        SEDE_A,
        [cartLine({ name: 'Paracetamol 500mg', presentation: '500 mg · Caja x 20' })],
        'req-1',
      );

      expect(store.toDraft(sitio)).toEqual({
        requestId: 'req-1',
        siteId: 'site-a',
        pharmacyId: 'ph-1',
        farmacia: 'Farmacia Uno',
        sede: 'Sede A',
        direccion: 'Av. Siempre Viva 123',
        lineas: [
          {
            productId: 'prod-1',
            medicamento: 'Paracetamol 500mg',
            presentacion: '500 mg · Caja x 20',
            cantidad: 1,
            precio: '10.00',
            moneda: 'BOB',
            disponible: true,
          },
        ],
        totalEstimado: '10.00',
        moneda: 'BOB',
      });
    });

    it('sin stock (en missingProductIds): disponible=false, precio y moneda null', () => {
      const sitio = sede({ missingProductIds: ['prod-1'] });
      store.replaceWith(
        SEDE_A,
        [cartLine({ name: 'Paracetamol 500mg', presentation: '500 mg · Caja x 20' })],
        'req-1',
      );

      expect(store.toDraft(sitio).lineas).toEqual([
        {
          productId: 'prod-1',
          medicamento: 'Paracetamol 500mg',
          presentacion: '500 mg · Caja x 20',
          cantidad: 1,
          precio: null,
          moneda: null,
          disponible: false,
        },
      ]);
    });

    it('producto que la sede ya no publica: disponible=false igual que sin stock', () => {
      const sitio = sede({ products: [] });
      store.replaceWith(
        SEDE_A,
        [cartLine({ productId: 'prod-9', name: 'Ibuprofeno', presentation: null })],
        'req-1',
      );

      expect(store.toDraft(sitio).lineas).toEqual([
        {
          productId: 'prod-9',
          medicamento: 'Ibuprofeno',
          presentacion: null,
          cantidad: 1,
          precio: null,
          moneda: null,
          disponible: false,
        },
      ]);
    });

    it('sin requestId en el carrito, el borrador viaja con requestId vacío', () => {
      const sitio = sede();
      store.add(SEDE_A, lineaSinReceta({ name: 'Paracetamol 500mg', presentation: '500 mg · Caja x 20' }));

      expect(store.toDraft(sitio).requestId).toBe('');
    });
  });
});
