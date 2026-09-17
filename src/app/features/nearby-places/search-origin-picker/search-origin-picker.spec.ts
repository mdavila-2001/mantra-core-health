import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { SavedPlaces } from '../../../core/data-access/profiles/saved-places';
import { SearchOriginPicker } from './search-origin-picker';
import type { SearchOrigin } from './search-origin-picker.types';

const CASA: SavedPlaces = { home: { lat: -17.78, lng: -63.18 }, work: null };
const CASA_Y_TRABAJO: SavedPlaces = {
  home: { lat: -17.78, lng: -63.18 },
  work: { lat: -16.5, lng: -68.15 },
};
const SIN_LUGARES: SavedPlaces = { home: null, work: null };

/**
 * Anfitrión de prueba: `places` y `origin` son `input`, así que hace falta un
 * componente propio para pasarlos como bindings — no se puede reasignar un
 * `InputSignal` a mano desde el test, sólo leerlo.
 */
@Component({
  selector: 'app-host',
  imports: [SearchOriginPicker],
  template: `<app-search-origin-picker
    [places]="places"
    [origin]="origin"
    (originChange)="onChange($event)"
  />`,
})
class Host {
  places: SavedPlaces | null = null;
  origin: SearchOrigin | null = null;
  emitidos: SearchOrigin[] = [];
  onChange(origin: SearchOrigin): void {
    this.emitidos.push(origin);
  }
}

describe('SearchOriginPicker', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let getCurrentPosition: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getCurrentPosition = vi.fn();
    Object.defineProperty(window.navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideRouter([])],
    });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
  });

  it('mientras los lugares no llegan, muestra el estado de carga y no emite', () => {
    fixture.detectChanges();
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('Buscando tus lugares guardados');
    expect(host.emitidos).toEqual([]);
  });

  it('con casa guardada y sin origen elegido, siembra la casa una sola vez', () => {
    host.places = CASA;
    fixture.detectChanges();
    fixture.detectChanges();
    expect(host.emitidos).toEqual([{ source: 'home', lat: -17.78, lng: -63.18 }]);
  });

  it('sin casa pero con trabajo, siembra el trabajo', () => {
    host.places = { home: null, work: { lat: -16.5, lng: -68.15 } };
    fixture.detectChanges();
    expect(host.emitidos).toEqual([{ source: 'work', lat: -16.5, lng: -68.15 }]);
  });

  it('sin ningún lugar guardado, no siembra y ofrece sólo el botón único', () => {
    host.places = SIN_LUGARES;
    fixture.detectChanges();
    expect(host.emitidos).toEqual([]);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="search-origin-current-only"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="search-origin-profile-link"]')).not.toBeNull();
    expect(root.querySelector('[role="radiogroup"]')).toBeNull();
  });

  it('no vuelve a sembrar cuando ya hay un origen elegido por la persona', () => {
    host.places = CASA_Y_TRABAJO;
    host.origin = { source: 'work', lat: -16.5, lng: -68.15 };
    fixture.detectChanges();
    fixture.detectChanges();
    expect(host.emitidos).toEqual([]);
  });

  it('tocar «Ubicación actual» pide el GPS y emite lo que devuelve', () => {
    host.places = CASA;
    host.origin = { source: 'home', lat: -17.78, lng: -63.18 };
    fixture.detectChanges();
    host.emitidos = [];

    getCurrentPosition.mockImplementation((exito: PositionCallback) =>
      exito({ coords: { latitude: -16.0, longitude: -60.0 } } as GeolocationPosition),
    );

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="segmentado-current"]')!
      .click();
    fixture.detectChanges();

    expect(host.emitidos).toEqual([{ source: 'current', lat: -16.0, lng: -60.0 }]);
  });

  it('el GPS denegado avisa y conserva el origen anterior', () => {
    host.places = CASA;
    host.origin = { source: 'home', lat: -17.78, lng: -63.18 };
    fixture.detectChanges();
    host.emitidos = [];

    getCurrentPosition.mockImplementation((_exito: PositionCallback, error: PositionErrorCallback) =>
      error({} as GeolocationPositionError),
    );

    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[data-testid="segmentado-current"]')!
      .click();
    fixture.detectChanges();

    expect(host.emitidos).toEqual([]);
    const texto = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(texto).toContain('No pudimos usar tu ubicación actual');
  });
});
