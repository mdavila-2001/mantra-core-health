/**
 * «Cómo llegar», sin Leaflet real: jsdom no da layout y el chunk dinámico es
 * justamente lo que no queremos en la suite. El doble entra por
 * `CARGADOR_DE_LEAFLET` y además guarda el manejador de `click` del mapa, que
 * es por donde llega «marcar un punto» (AC-06-14).
 */
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import {
  CARGADOR_DE_LEAFLET,
  type CargadorDeLeaflet,
} from '@shared/components/organisms/map/map';

import {
  FacilityDirectionsDialog,
  formatKm,
  straightLineKm,
} from './facility-directions-dialog';

/* ---- el doble de Leaflet -------------------------------------------------- */

interface ClickDeMapa {
  readonly latlng: { readonly lat: number; readonly lng: number };
}

class LeafletRegistry {
  clickHandler: ((event: ClickDeMapa) => void) | null = null;
  readonly views: unknown[] = [];
}

function fakeLeaflet(registry: LeafletRegistry): unknown {
  return {
    map: () => ({
      setView: (centro: unknown, zoom: unknown) => registry.views.push([centro, zoom]),
      fitBounds: () => undefined,
      remove: () => undefined,
      on: (evento: string, manejador: (event: ClickDeMapa) => void) => {
        if (evento === 'click') {
          registry.clickHandler = manejador;
        }
      },
    }),
    tileLayer: () => ({ addTo: () => undefined }),
    layerGroup: () => ({ addTo: () => undefined, remove: () => undefined }),
    marker: () => ({
      bindPopup: () => ({ on: () => undefined, addTo: () => undefined }),
      on: () => undefined,
      addTo: () => undefined,
      getElement: () => document.createElement('div'),
    }),
    divIcon: (opciones: unknown) => opciones,
    latLngBounds: (limites: unknown) => limites,
  };
}

/* ---- arnés ---------------------------------------------------------------- */

const HOSPITAL = { lat: -17.7833, lng: -63.1821 };

@Component({
  imports: [FacilityDirectionsDialog],
  template: `
    <button type="button" data-testid="abrir" (click)="abierto.set(true)">Cómo llegar</button>
    @if (abierto()) {
      <app-facility-directions-dialog
        facilityName="Hospital Japonés"
        facilityAddress="Av. Japón s/n"
        [facilityLocation]="destino"
        (closed)="abierto.set(false)"
      />
    }
  `,
})
class HostComponent {
  readonly abierto = signal(false);
  readonly destino = HOSPITAL;
}

describe('straightLineKm', () => {
  it('mide cero contra sí mismo', () => {
    expect(straightLineKm(HOSPITAL, HOSPITAL)).toBe(0);
  });

  it('un grado de latitud son unos 111 km', () => {
    const km = straightLineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(km).toBeGreaterThan(110);
    expect(km).toBeLessThan(112);
  });

  it('es simétrica: la línea recta no tiene sentido de circulación', () => {
    const ida = straightLineKm(HOSPITAL, { lat: -16.4957, lng: -68.1335 });
    const vuelta = straightLineKm({ lat: -16.4957, lng: -68.1335 }, HOSPITAL);
    expect(ida).toBeCloseTo(vuelta, 9);
  });
});

describe('formatKm', () => {
  it('escribe con coma decimal, como se lee en Bolivia', () => {
    expect(formatKm(1.234)).toBe('1,2 km');
  });
});

describe('FacilityDirectionsDialog', () => {
  let fixture: ComponentFixture<HostComponent>;
  let registry: LeafletRegistry;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function dialogo(): HTMLElement | null {
    const element = document.querySelector('[data-testid="content-dialog"]');
    return element instanceof HTMLElement ? element : null;
  }

  function porTestId(id: string): HTMLElement | null {
    const element = dialogo()?.querySelector(`[data-testid="${id}"]`);
    return element instanceof HTMLElement ? element : null;
  }

  async function abrir(): Promise<void> {
    const boton = root().querySelector('[data-testid="abrir"]');
    if (!(boton instanceof HTMLButtonElement)) {
      throw new Error('falta el botón que abre');
    }
    boton.click();
    await fixture.whenStable();
    // `montar()` de `AppMap` espera el import dinámico: dos microtareas más.
    await Promise.resolve();
    await Promise.resolve();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    registry = new LeafletRegistry();
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        {
          provide: CARGADOR_DE_LEAFLET,
          useValue: (() => Promise.resolve(fakeLeaflet(registry))) as CargadorDeLeaflet,
        },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
  });

  afterEach(() => {
    fixture.destroy();
    document.getElementById('leaflet-css')?.remove();
  });

  it('abre centrado en ESE establecimiento, no en la pantalla genérica (AC-06-13)', async () => {
    await abrir();

    expect(porTestId('directions-facility')?.textContent?.trim()).toBe('Hospital Japonés');
    expect(registry.views.at(-1)).toEqual([[HOSPITAL.lat, HOSPITAL.lng], 15]);
  });

  it('el mapa se monta recién con el diálogo abierto (AC-06-11)', async () => {
    expect(document.querySelector('app-map')).toBeNull();

    await abrir();

    expect(dialogo()?.querySelector('app-map')).not.toBeNull();
  });

  it('deja marcar el origen tocando el mapa, y rotula la distancia como recta (AC-06-14, AC-06-15)', async () => {
    await abrir();

    porTestId('directions-pick-on-map')?.click();
    await fixture.whenStable();

    expect(registry.clickHandler).not.toBeNull();
    registry.clickHandler?.({ latlng: { lat: -17.79, lng: -63.19 } });
    await fixture.whenStable();

    expect(porTestId('directions-origin')?.textContent).toContain('el punto que marcaste');
    expect(porTestId('directions-distance')?.textContent).toContain('en línea recta');
  });

  it('un clic en el mapa SIN haber pedido marcar no mueve el origen', async () => {
    await abrir();

    registry.clickHandler?.({ latlng: { lat: -17.79, lng: -63.19 } });
    await fixture.whenStable();

    expect(porTestId('directions-origin')).toBeNull();
  });

  it('denegar la ubicación no rompe nada: queda el mapa y la otra vía (AC-06-16)', async () => {
    const geolocation = {
      getCurrentPosition: (
        _ok: PositionCallback,
        fail?: PositionErrorCallback | null,
      ): void => {
        fail?.({ code: 1, message: 'denied' } as GeolocationPositionError);
      },
    };
    Object.defineProperty(window.navigator, 'geolocation', {
      value: geolocation,
      configurable: true,
    });

    await abrir();
    porTestId('directions-use-location')?.click();
    await fixture.whenStable();

    expect(porTestId('directions-location-denied')).not.toBeNull();
    expect(dialogo()?.querySelector('app-map')).not.toBeNull();
    expect(porTestId('directions-pick-on-map')).not.toBeNull();
  });
});
