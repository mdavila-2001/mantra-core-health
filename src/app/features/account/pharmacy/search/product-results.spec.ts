import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { CartStore } from '../../../../core/data-access/pharmacy-cart/cart.store';
import { DialogService } from '../../../../shared/components/molecules/dialog/dialog-service';
import { ProductResults } from './product-results';
import type { ProductHit } from './pharmacy-search.types';

/** Una fila sintética declarada; los ids no son de ninguna persona ni sede real. */
function fila(cambios: Partial<ProductHit> = {}): ProductHit {
  return {
    id: 's-1:p-1',
    productId: 'p-1',
    name: 'Paracetamol Andina',
    presentation: '500 mg · Caja x 20',
    pharmacyId: 'f-1',
    pharmacyName: 'Farmacia Andina',
    siteId: 's-1',
    siteName: 'Sucursal Centro',
    addressText: 'Av. de prueba 123',
    unitAmount: '12.50',
    currency: 'BOB',
    distanceKm: 1.2,
    requiresPrescription: false,
    medicationConceptId: null,
    ...cambios,
  };
}

/**
 * Anfitrión: `items` es un `input.required`, así que hace falta un componente
 * propio para pasarlo como binding — un `InputSignal` no se reasigna a mano.
 */
@Component({
  selector: 'app-host',
  imports: [ProductResults],
  template: `<app-product-results [items]="items()" [sinOrigen]="sinOrigen()" />`,
})
class Host {
  readonly items = signal<readonly ProductHit[]>([]);
  readonly sinOrigen = signal(false);
}

describe('ProductResults', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let cart: CartStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    cart = TestBed.inject(CartStore);
  });

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('pinta las cuatro partes de la fila: qué, dónde, precio y distancia', () => {
    host.items.set([fila()]);
    fixture.detectChanges();

    const texto = raiz().textContent ?? '';
    expect(texto).toContain('Paracetamol Andina');
    expect(texto).toContain('500 mg · Caja x 20');
    expect(texto).toContain('Farmacia Andina');
    expect(texto).toContain('Sucursal Centro');
    expect(texto).toContain('12.50');
    expect(texto).toContain('1,2 km');
  });

  it('sin precio publicado lo dice con todas las letras, no lo inventa', () => {
    host.items.set([fila({ unitAmount: null, currency: null })]);
    fixture.detectChanges();

    expect(raiz().textContent).toContain('Precio no publicado');
  });

  it('sin distancia invita a elegir desde dónde medir', () => {
    host.items.set([fila({ distanceKm: null })]);
    fixture.detectChanges();

    expect(raiz().textContent).toContain('Elegí desde dónde medir');
  });

  it('«Agregar» suma la línea al carrito', () => {
    host.items.set([fila()]);
    fixture.detectChanges();

    raiz().querySelector<HTMLButtonElement>('[data-testid="pharmacy-result-add"]')!.click();

    expect(cart.unitCount()).toBe(1);
    expect(cart.cart()?.site.siteId).toBe('s-1');
    expect(cart.cart()?.lines[0].name).toBe('Paracetamol Andina');
  });

  it('con carrito de otra sede pregunta, y cancelar no cambia nada', async () => {
    cart.add(
      {
        pharmacyId: 'f-9',
        pharmacyName: 'Otra Farmacia',
        siteId: 's-9',
        siteName: 'Otra Sucursal',
        addressText: null,
      },
      {
        productId: 'p-9',
        name: 'Otro producto',
        presentation: null,
        unitAmount: '5.00',
        currency: 'BOB',
        requiresPrescription: false,
        medicationConceptId: null,
      },
    );
    const confirmar = vi
      .spyOn(TestBed.inject(DialogService), 'confirm')
      .mockResolvedValue(false);

    host.items.set([fila()]);
    fixture.detectChanges();
    raiz().querySelector<HTMLButtonElement>('[data-testid="pharmacy-result-add"]')!.click();
    await Promise.resolve();

    expect(confirmar).toHaveBeenCalledOnce();
    expect(cart.cart()?.site.siteId).toBe('s-9');
    expect(cart.cart()?.lines.map((linea) => linea.name)).toEqual(['Otro producto']);
  });

  it('confirmando, el carrito pasa a ser de la sede nueva y con una sola línea', async () => {
    cart.add(
      {
        pharmacyId: 'f-9',
        pharmacyName: 'Otra Farmacia',
        siteId: 's-9',
        siteName: 'Otra Sucursal',
        addressText: null,
      },
      {
        productId: 'p-9',
        name: 'Otro producto',
        presentation: null,
        unitAmount: '5.00',
        currency: 'BOB',
        requiresPrescription: false,
        medicationConceptId: null,
      },
    );
    vi.spyOn(TestBed.inject(DialogService), 'confirm').mockResolvedValue(true);

    host.items.set([fila()]);
    fixture.detectChanges();
    raiz().querySelector<HTMLButtonElement>('[data-testid="pharmacy-result-add"]')!.click();
    await Promise.resolve();

    expect(cart.cart()?.site.siteId).toBe('s-1');
    expect(cart.cart()?.lines.map((linea) => linea.name)).toEqual(['Paracetamol Andina']);
  });

  it('un producto con receta obligatoria no tiene «Agregar»: tiene insignia y camino', () => {
    host.items.set([fila({ requiresPrescription: true })]);
    fixture.detectChanges();

    expect(raiz().querySelector('[data-testid="pharmacy-result-add"]')).toBeNull();
    expect(raiz().textContent).toContain('Requiere receta');
    const enlace = raiz().querySelector<HTMLAnchorElement>('.resultado__receta');
    expect(enlace?.getAttribute('href')).toBe('/my-account/pharmacy/prescriptions');
  });

  it('«Ver tienda» apunta a la tienda de esa farmacia, con la sede en la query', () => {
    host.items.set([fila()]);
    fixture.detectChanges();

    const enlace = raiz().querySelector<HTMLAnchorElement>(
      '[data-testid="pharmacy-result-store"]',
    );
    expect(enlace?.getAttribute('href')).toBe('/my-account/pharmacy/stores/f-1?site=s-1');
  });

  it('sin origen avisa que la lista no está ordenada por cercanía', () => {
    host.items.set([fila({ distanceKm: null })]);
    host.sinOrigen.set(true);
    fixture.detectChanges();

    expect(raiz().textContent).toContain('no están ordenados por cercanía');
  });
});
