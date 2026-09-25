import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';

import { CartStore, type NuevaLineaDeCarrito } from '../../../../core/data-access/pharmacy-cart/cart.store';
import type { CartSite } from '../../../../core/data-access/pharmacy-cart/pharmacy-cart.types';
import { PharmacyOrdersClient } from '../../../../core/data-access/pharmacy-orders/pharmacy-orders.client';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { CartPage } from './cart-page';

/**
 * El carrito de farmacia (H5). Lo que se fija: los cuatro estados —vacío,
 * con líneas, revisando disponibilidad y sin poder continuar—, que
 * incrementar/decrementar/quitar tocan el store real, y que «Continuar»
 * revalida contra `/pharmacy-inventory/availability` antes de armar el
 * borrador y navegar.
 */

const SEDE: CartSite = {
  pharmacyId: 'ph-1',
  pharmacyName: 'Farmacia Uno',
  siteId: 'site-a',
  siteName: 'Sede A',
  addressText: 'Av. Siempre Viva 123',
};

function linea(overrides: Partial<NuevaLineaDeCarrito> = {}): NuevaLineaDeCarrito {
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

describe('CartPage', () => {
  let fixture: ComponentFixture<CartPage>;
  let cart: CartStore;
  let http: HttpTestingController;
  let router: Router;
  let confirmDialog: ReturnType<typeof vi.fn>;

  function configurar(): void {
    confirmDialog = vi.fn().mockResolvedValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: DialogService, useValue: { confirm: confirmDialog } },
      ],
    });
    cart = TestBed.inject(CartStore);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  }

  function montar(): void {
    fixture = TestBed.createComponent(CartPage);
    fixture.detectChanges();
  }

  function raiz(): HTMLElement {
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => http.verify());

  it('carrito vacío: S3 con la acción "Ir a la tienda"', () => {
    configurar();
    montar();

    const accion = raiz().querySelector('a[href="/my-account/pharmacy"]');
    expect(raiz().textContent).toContain('Tu carrito está vacío');
    expect(accion?.textContent).toContain('Ir a la tienda');
  });

  it('con carrito: muestra sede, líneas y total', () => {
    configurar();
    cart.add(SEDE, linea(), 2);
    montar();

    const texto = raiz().textContent ?? '';
    expect(texto).toContain('Farmacia Uno');
    expect(texto).toContain('Sede A');
    expect(texto).toContain('Paracetamol 500mg');
    expect(raiz().querySelector('[data-testid="pharmacy-cart-total"]')?.textContent).toContain(
      '21.00',
    );
  });

  it('incrementar cantidad actualiza el store y la vista', () => {
    configurar();
    cart.add(SEDE, linea(), 1);
    montar();

    raiz().querySelector<HTMLButtonElement>('[data-testid="pharmacy-store-qty-plus"]')?.click();

    expect(cart.cart()?.lines[0].quantity).toBe(2);
    expect(raiz().querySelector('[data-testid="pharmacy-store-qty-value"]')?.textContent?.trim()).toBe(
      '2',
    );
  });

  it('decrementar a 0 quita la línea y el carrito vuelve a null', () => {
    configurar();
    cart.add(SEDE, linea(), 1);
    montar();

    raiz().querySelector<HTMLButtonElement>('[data-testid="pharmacy-store-qty-minus"]')?.click();

    expect(cart.cart()).toBeNull();
  });

  it('"Quitar" remueve la línea', () => {
    configurar();
    cart.add(SEDE, linea(), 1);
    montar();

    raiz().querySelector<HTMLButtonElement>('[aria-label="Quitar Paracetamol 500mg del carrito"]')?.click();

    expect(cart.cart()).toBeNull();
  });

  it('"Vaciar" con el diálogo cancelado no cambia el carrito', async () => {
    configurar();
    cart.add(SEDE, linea(), 1);
    montar();
    confirmDialog.mockResolvedValue(false);

    raiz().querySelector<HTMLButtonElement>('[data-testid="pharmacy-cart-clear"]')?.click();
    await fixture.whenStable();

    expect(cart.cart()).not.toBeNull();
  });

  it('"Vaciar" confirmado vacía el carrito', async () => {
    configurar();
    cart.add(SEDE, linea(), 1);
    montar();

    raiz().querySelector<HTMLButtonElement>('[data-testid="pharmacy-cart-clear"]')?.click();
    await fixture.whenStable();

    expect(cart.cart()).toBeNull();
  });

  it('"Continuar" con la sede todavía disponible arma el borrador y navega', () => {
    configurar();
    cart.add(SEDE, linea(), 2);
    montar();
    const navegar = vi.spyOn(router, 'navigateByUrl');
    const orders = TestBed.inject(PharmacyOrdersClient);

    raiz().querySelector<HTMLButtonElement>('[data-testid="pharmacy-cart-continue"]')?.click();

    const request = http.expectOne(
      (r) => r.url === '/pharmacy-inventory/availability' && r.params.get('products') === 'prod-1',
    );
    request.flush({
      requestedProductIds: ['prod-1'],
      items: [
        {
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
          totalAmount: '21.00',
          currency: { code: 'BOB', display: 'Boliviano' },
          products: [
            {
              productId: 'prod-1',
              productCode: 'PC-1',
              brandName: 'Paracetamol',
              genericName: null,
              strengthText: '500 mg',
              packageSizeText: 'Caja x 20',
              medication: null,
              availableQuantity: 10,
              price: {
                unitAmount: '10.50',
                patientAmount: '10.50',
                currency: { code: 'BOB', display: 'Boliviano' },
                priceListCode: 'p1',
              },
            },
          ],
        },
      ],
    });

    expect(orders.borradorPreparado()?.siteId).toBe('site-a');
    expect(navegar).toHaveBeenCalledWith('/my-account/pharmacy-orders/new');
  });

  it('"Continuar" sin la sede en la respuesta avisa y no navega', () => {
    configurar();
    cart.add(SEDE, linea(), 1);
    montar();
    const navegar = vi.spyOn(router, 'navigateByUrl');

    raiz().querySelector<HTMLButtonElement>('[data-testid="pharmacy-cart-continue"]')?.click();

    http
      .expectOne((r) => r.url === '/pharmacy-inventory/availability')
      .flush({ requestedProductIds: ['prod-1'], items: [] });

    expect(raiz().textContent).toContain('ya no publica disponibilidad');
    expect(navegar).not.toHaveBeenCalled();
  });
});
