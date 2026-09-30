import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { StoreResults } from './store-results';
import type { StoreHit } from './pharmacy-search.types';

/** Una tarjeta sintética declarada. */
function sede(cambios: Partial<StoreHit> = {}): StoreHit {
  return {
    id: 's-1',
    siteId: 's-1',
    siteName: 'Sucursal Centro',
    pharmacyId: 'f-1',
    pharmacyName: 'Farmacia Andina',
    addressText: 'Av. de prueba 123',
    distanceKm: 1.2,
    fromAmount: '6.00',
    currency: 'BOB',
    productCount: 8,
    ...cambios,
  };
}

@Component({
  selector: 'app-host',
  imports: [StoreResults],
  template: `<app-store-results [items]="items()" [sinOrigen]="sinOrigen()" />`,
})
class Host {
  readonly items = signal<readonly StoreHit[]>([]);
  readonly sinOrigen = signal(false);
}

describe('StoreResults', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
  });

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('pinta farmacia, sede, dirección, distancia y «desde»', () => {
    host.items.set([sede()]);
    fixture.detectChanges();

    const texto = raiz().textContent ?? '';
    expect(texto).toContain('Farmacia Andina');
    expect(texto).toContain('Sucursal Centro');
    expect(texto).toContain('Av. de prueba 123');
    expect(texto).toContain('1,2 km');
    expect(texto).toContain('desde 6.00');
  });

  it('sin término (sin «desde») no muestra ningún importe', () => {
    host.items.set([sede({ fromAmount: null, currency: null })]);
    fixture.detectChanges();

    expect(raiz().textContent).not.toContain('desde');
  });

  it('respeta el orden que recibe: no reordena por su cuenta', () => {
    host.items.set([
      sede({ id: 's-2', siteId: 's-2', siteName: 'Sucursal Sur', distanceKm: 3.4 }),
      sede(),
    ]);
    fixture.detectChanges();

    const nombres = [...raiz().querySelectorAll('.sede__nombre')].map((n) => n.textContent?.trim());
    expect(nombres).toEqual(['Sucursal Sur', 'Sucursal Centro']);
  });

  it('sin origen avisa que la lista no está ordenada por cercanía', () => {
    host.items.set([sede({ distanceKm: null })]);
    host.sinOrigen.set(true);
    fixture.detectChanges();

    expect(raiz().textContent).toContain('no están ordenadas por cercanía');
    expect(raiz().textContent).toContain('Elegí desde dónde medir');
  });

  it('«Entrar» apunta a la tienda de esa farmacia, con la sede en la query', () => {
    host.items.set([sede()]);
    fixture.detectChanges();

    const enlace = raiz().querySelector<HTMLAnchorElement>(
      '[data-testid="pharmacy-result-store"]',
    );
    expect(enlace?.getAttribute('href')).toBe('/my-account/pharmacy/stores/f-1?site=s-1');
  });
});
