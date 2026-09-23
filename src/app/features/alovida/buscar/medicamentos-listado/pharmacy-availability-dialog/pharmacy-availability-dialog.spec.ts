/**
 * El modal de farmacias, sin Leaflet real: jsdom no da layout y el chunk
 * dinámico es justamente lo que no queremos en la suite.
 */
import { Component, signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';

import type { OfertaDeFarmacia } from '@core/data-access/public-marketplace/public-marketplace.types';
import { CARGADOR_DE_LEAFLET, type CargadorDeLeaflet } from '@shared/components/organisms/map/map';

import {
  hasCoordinates,
  PharmacyAvailabilityDialog,
  pinSubtitle,
  withCodes,
} from './pharmacy-availability-dialog';

/* ---- el doble de Leaflet -------------------------------------------------- */

function fakeLeaflet(): unknown {
  return {
    map: () => ({
      setView: () => undefined,
      fitBounds: () => undefined,
      remove: () => undefined,
      on: () => undefined,
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

/* ---- datos ---------------------------------------------------------------- */

function oferta(extra: Partial<OfertaDeFarmacia> = {}): OfertaDeFarmacia {
  return {
    pharmacySlug: 'farmacia-central',
    pharmacyName: 'Farmacia Central',
    addressText: 'Av. Busch 500',
    city: 'Santa Cruz de la Sierra',
    latitude: -17.7833,
    longitude: -63.1821,
    distanceKm: 1.24,
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

const SIN_COORDENADAS = oferta({
  pharmacySlug: 'farmacia-sur',
  pharmacyName: 'Farmacia Sur',
  latitude: 0,
  longitude: 0,
  distanceKm: null,
});

describe('hasCoordinates', () => {
  it('acepta un par real', () => {
    expect(hasCoordinates(oferta())).toBe(true);
  });

  it('rechaza el par en cero: es «sin geocodificar», no la isla Null', () => {
    expect(hasCoordinates(SIN_COORDENADAS)).toBe(false);
  });

  it('rechaza lo que no es número, venga como venga del cable', () => {
    expect(hasCoordinates(oferta({ latitude: Number.NaN }))).toBe(false);
  });
});

describe('pinSubtitle', () => {
  it('rotula la distancia como recta, nunca como trayecto (AC-06-15)', () => {
    expect(pinSubtitle(oferta())).toBe('1,2 km en línea recta · Av. Busch 500');
  });

  it('sin origen ni dirección no arma un subtítulo vacío', () => {
    expect(pinSubtitle(oferta({ distanceKm: null, addressText: null }))).toBeUndefined();
  });
});

describe('withCodes', () => {
  it('le da a cada oferta la letra con la que el mapa la nombra', () => {
    expect(withCodes([oferta(), SIN_COORDENADAS]).map((o) => o.codigo)).toEqual(['A', 'B']);
  });
});

/* ---- el componente -------------------------------------------------------- */

@Component({
  imports: [PharmacyAvailabilityDialog],
  template: `
    <button type="button" data-testid="abrir" (click)="abierto.set(true)">Ver farmacias</button>
    @if (abierto()) {
      <app-pharmacy-availability-dialog
        medicationName="Losartán"
        [offers]="ofertas()"
        (closed)="abierto.set(false)"
      />
    }
  `,
})
class HostComponent {
  readonly abierto = signal(false);
  readonly ofertas = signal<readonly OfertaDeFarmacia[]>([oferta(), SIN_COORDENADAS]);
}

describe('PharmacyAvailabilityDialog', () => {
  let fixture: ComponentFixture<HostComponent>;

  function root(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function dialogo(): HTMLElement | null {
    const element = document.querySelector('[data-testid="content-dialog"]');
    return element instanceof HTMLElement ? element : null;
  }

  function filas(): HTMLElement[] {
    return [...(dialogo()?.querySelectorAll<HTMLElement>('.farmacia') ?? [])];
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
    await TestBed.configureTestingModule({
      imports: [HostComponent],
      providers: [
        {
          provide: CARGADOR_DE_LEAFLET,
          useValue: (() => Promise.resolve(fakeLeaflet())) as CargadorDeLeaflet,
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

  it('abre un modal con la lista de farmacias y el mapa (AC-06-9)', async () => {
    await abrir();

    expect(dialogo()).not.toBeNull();
    expect(dialogo()?.querySelector('[data-testid="pharmacies-list"]')).not.toBeNull();
    expect(dialogo()?.querySelector('app-map')).not.toBeNull();
  });

  it('es una LISTA, no una grilla: es la alternativa textual del mapa', async () => {
    await abrir();

    const lista = dialogo()?.querySelector('[data-testid="pharmacies-list"]');
    expect(lista?.tagName).toBe('UL');
  });

  it('el mapa se monta después de abrir: Leaflet necesita layout (AC-06-11)', async () => {
    expect(document.querySelector('app-map')).toBeNull();

    await abrir();

    expect(dialogo()?.querySelector('app-map')).not.toBeNull();
  });

  it('la farmacia sin coordenadas se lista con aviso, no se omite (AC-06-12)', async () => {
    await abrir();

    expect(filas()).toHaveLength(2);
    expect(dialogo()?.textContent).toContain('Farmacia Sur');
    expect(dialogo()?.querySelector('[data-testid="pharmacies-unmapped"]')).not.toBeNull();
    expect(dialogo()?.textContent).toContain('Ubicación no disponible en el mapa');
  });

  it('resaltar una fila la marca, que es lo que el pin comparte (AC-06-10)', async () => {
    await abrir();

    const primera = filas()[0];
    primera.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false }));
    await fixture.whenStable();

    expect(primera.classList.contains('farmacia--elegida')).toBe(true);
    expect(filas()[1].classList.contains('farmacia--elegida')).toBe(false);
  });

  it('cada fila tiene el id con el que el mapa la busca al elegir su pin', async () => {
    await abrir();

    expect(filas().map((fila) => fila.id)).toEqual([
      'pharmacy-offer-A',
      'pharmacy-offer-B',
    ]);
  });

  it('cerrar avisa a la pantalla, que es la que desmonta el modal', async () => {
    await abrir();

    const cerrar = dialogo()?.querySelector('[data-testid="content-dialog-close"]');
    if (!(cerrar instanceof HTMLButtonElement)) {
      throw new Error('falta el botón de cerrar');
    }
    cerrar.click();
    await fixture.whenStable();

    expect(dialogo()).toBeNull();
  });
});
