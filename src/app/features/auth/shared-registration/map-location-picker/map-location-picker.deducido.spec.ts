import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import {
  ReverseGeocodingClient,
  type StreetFromPoint,
} from '../../../../core/data-access/geo/reverse-geocoding.client';
import { BoMunicipalitiesCatalog } from '../../../../core/data-access/terminology/bo-municipalities.service';
import { MapLocationPicker, type LocalityFromPoint, type TestIds } from './map-location-picker';

/**
 * Pedido del cliente (26/10/2026): la persona sólo elige el punto; la calle, el
 * mapa de Bolivia acercado y la localidad salen de él, en sólo lectura.
 */
const IDS: TestIds = {
  mapa: 'mapa',
  confirmada: 'confirmada',
  avisoGeocodificacion: 'calle',
  quitar: 'quitar',
  confirmar: 'confirmar',
  usarUbicacion: 'usar',
  marcarEnMapa: 'marcar',
};

describe('MapLocationPicker — lo deducido del punto', () => {
  let fixture: ComponentFixture<MapLocationPicker>;
  let component: MapLocationPicker;
  let respuestas: Subject<StreetFromPoint>;
  let pedidos: { lat: number; lng: number }[];

  beforeEach(async () => {
    respuestas = new Subject<StreetFromPoint>();
    pedidos = [];
    await TestBed.configureTestingModule({
      imports: [MapLocationPicker],
      providers: [
        {
          provide: ReverseGeocodingClient,
          useValue: {
            streetAt: (lat: number, lng: number) => {
              pedidos.push({ lat, lng });
              return respuestas;
            },
          },
        },
        { provide: BoMunicipalitiesCatalog, useValue: { listar: () => of([]) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MapLocationPicker);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('pinId', 'casa');
    fixture.componentRef.setInput('etiquetaConfirmada', 'Su casa');
    fixture.componentRef.setInput('etiquetaQuitar', 'Quitar la ubicación');
    fixture.componentRef.setInput('ids', IDS);
    fixture.detectChanges();
  });

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function campoCalle(): HTMLTextAreaElement {
    return raiz().querySelector('[data-testid="calle"] textarea') as HTMLTextAreaElement;
  }

  it('tocar el mapa pide la calle de ese punto y la escribe en un campo de sólo lectura', async () => {
    component.pinPunto({ lat: -17.78, lng: -63.18 });
    fixture.detectChanges();
    expect(pedidos).toEqual([{ lat: -17.78, lng: -63.18 }]);
    expect(campoCalle().value).toContain('Buscando');

    respuestas.next({
      found: true,
      line: 'Calle Guapay 3861, Equipetrol',
      road: 'Calle Guapay',
      houseNumber: '3861',
      neighbourhood: 'Equipetrol',
      attribution: 'OSM',
    });
    fixture.detectChanges();
    await fixture.whenStable();

    // Calle y número: el distrito va en su campo, justo debajo, no dos veces.
    expect(campoCalle().value).toBe('Calle Guapay 3861');
    expect(campoCalle().value).not.toContain('Equipetrol');
    expect(campoCalle().readOnly).toBe(true);
    expect(component.zone()).toBe('Equipetrol');
  });

  it('avisa a quien lo monta la calle, la calle sola y la zona deducidas', () => {
    const recibidos: (LocalityFromPoint | null)[] = [];
    component.localidad.subscribe((l) => recibidos.push(l));

    component.pinPunto({ lat: -17.78, lng: -63.18 });
    fixture.detectChanges();
    respuestas.next({
      found: true,
      line: 'Calle Guapay 3861, Equipetrol',
      road: 'Calle Guapay',
      houseNumber: '3861',
      neighbourhood: 'Equipetrol',
      attribution: 'OSM',
    });
    fixture.detectChanges();

    const ultimo = recibidos.at(-1);
    expect(ultimo?.calle).toBe('Calle Guapay 3861, Equipetrol');
    expect(ultimo?.calleSola).toBe('Calle Guapay 3861');
    expect(ultimo?.zona).toBe('Equipetrol');
  });

  it('una respuesta que llega para un punto viejo se descarta', () => {
    component.pinPunto({ lat: -17.78, lng: -63.18 });
    component.pinPunto({ lat: -16.5, lng: -68.15 });
    fixture.detectChanges();
    expect(pedidos).toHaveLength(2);
    respuestas.next({ found: true, line: 'Av. Arce 2000', attribution: 'OSM' });
    fixture.detectChanges();
    expect(campoCalle().value).toBe('Av. Arce 2000');
  });

  it('si el proveedor no conoce calle, lo dice sin inventarla', () => {
    component.pinPunto({ lat: -17.78, lng: -63.18 });
    respuestas.next({ found: false, attribution: 'OSM' });
    fixture.detectChanges();
    expect(campoCalle().value).toContain('no tiene un nombre de calle');
  });

  it('con el punto aparece el mapa de Bolivia, fijo, debajo de la calle', () => {
    component.pinPunto({ lat: -17.78, lng: -63.18 });
    fixture.detectChanges();
    const deducido = raiz().querySelector('[data-testid="mapa-deducido"]');
    expect(deducido).not.toBeNull();
    expect(deducido?.querySelector('app-location-picker app-department-map[inert]')).not.toBeNull();
  });

  it('quitar la ubicación borra todo lo deducido', () => {
    component.pinPunto({ lat: -17.78, lng: -63.18 });
    respuestas.next({ found: true, line: 'Calle X', neighbourhood: 'Zona Y', attribution: 'OSM' });
    component.removeLocation();
    fixture.detectChanges();
    expect(component.street()).toBeNull();
    expect(component.zone()).toBeNull();
    expect(raiz().querySelector('[data-testid="mapa-deducido"]')).toBeNull();
  });
  function campoDistrito(): HTMLTextAreaElement {
    return raiz().querySelector('[data-testid="mapa-distrito"] textarea') as HTMLTextAreaElement;
  }

  it('el distrito se ve siempre junto a la calle: buscando, con dato y sin dato', () => {
    component.pinPunto({ lat: -17.78, lng: -63.18 });
    fixture.detectChanges();
    expect(campoDistrito().value).toContain('Buscando');
    expect(campoDistrito().readOnly).toBe(true);
    respuestas.next({
      found: true,
      line: 'Calle X, Equipetrol',
      neighbourhood: 'Equipetrol',
      attribution: 'OSM',
    });
    fixture.detectChanges();
    expect(campoDistrito().value).toBe('Equipetrol');

    component.pinPunto({ lat: -17.7, lng: -63.1 });
    respuestas.next({ found: true, line: 'Calle Z', attribution: 'OSM' });
    fixture.detectChanges();
    expect(campoDistrito().value).toContain('no tiene un distrito');
  });

  it('si la API cae, lo dice en calle y distrito, y deja volver a buscar', () => {
    let falla = true;
    const geocoder = TestBed.inject(ReverseGeocodingClient) as unknown as {
      streetAt: (lat: number, lng: number) => unknown;
    };
    geocoder.streetAt = (lat: number, lng: number) => {
      pedidos.push({ lat, lng });
      if (falla) return throwError(() => new Error('503'));
      return of({
        found: true,
        line: 'Calle Q, Centro',
        neighbourhood: 'Centro',
        attribution: 'OSM',
      });
    };
    component.pinPunto({ lat: -17.78, lng: -63.18 });
    fixture.detectChanges();
    expect(campoCalle().value).toBe('No disponible por ahora.');
    expect(campoDistrito().value).toBe('No disponible por ahora.');
    expect(
      raiz().querySelector('app-alert[data-testid="mapa-calle-caida"]')?.textContent,
    ).toContain('No pudimos traer la calle ni el distrito');

    falla = false;
    const reintentar = raiz().querySelector(
      '[data-testid="mapa-reintentar-calle"] button, [data-testid="mapa-reintentar-calle"]',
    ) as HTMLElement;
    reintentar.click();
    fixture.detectChanges();
    expect(pedidos).toHaveLength(2);
    expect(campoCalle().value).toBe('Calle Q, Centro');
    expect(campoDistrito().value).toBe('Centro');
    expect(raiz().querySelector('[data-testid="mapa-calle-caida"]')).toBeNull();
  });

  it('fuera de Bolivia no dibuja el mapa de Bolivia: lo dice, y la calle se sigue buscando', () => {
    component.pinPunto({ lat: 40.4168, lng: -3.7038 });
    fixture.detectChanges();
    expect(pedidos).toEqual([{ lat: 40.4168, lng: -3.7038 }]);
    expect(raiz().querySelector('app-alert[data-testid="mapa-fuera-de-bolivia"]')).not.toBeNull();
    expect(raiz().querySelector('app-location-picker')).toBeNull();
    respuestas.next({
      found: true,
      line: 'Calle Mayor 1, Sol',
      neighbourhood: 'Sol',
      attribution: 'OSM',
    });
    fixture.detectChanges();
    expect(campoCalle().value).toBe('Calle Mayor 1, Sol');
    expect(campoDistrito().value).toBe('Sol');
    expect(component.municipality()).toBeNull();

    component.pinPunto({ lat: -17.78, lng: -63.18 });
    fixture.detectChanges();
    expect(raiz().querySelector('[data-testid="mapa-fuera-de-bolivia"]')).toBeNull();
    expect(raiz().querySelector('app-location-picker')).not.toBeNull();
  });
  it('el país lo decide la API: un punto en Perú dentro del recuadro de Bolivia muestra el aviso', () => {
    // Puno: cae dentro del recuadro de Bolivia, pero no es Bolivia.
    component.pinPunto({ lat: -15.84, lng: -69.6 });
    fixture.detectChanges();
    expect(raiz().querySelector('[data-testid="mapa-fuera-de-bolivia"]')).toBeNull();
    respuestas.next({
      found: true,
      line: 'Jirón Lima 100, Centro',
      countryCode: 'PE',
      adminAreas: { level1: 'Puno', level3: 'Puno', district: 'Centro' },
      attribution: 'OSM',
    });
    fixture.detectChanges();
    const aviso = raiz().querySelector('[data-testid="mapa-fuera-de-bolivia"]');
    expect(aviso?.textContent).toContain('Por el momento sólo operamos en Bolivia');
    expect(raiz().querySelector('app-location-picker')).toBeNull();
    expect(campoDistrito().value).toBe('Centro');
  });

  it('avisa a quien lo monta el país y los niveles, para cualquier país', () => {
    const emitidos: (LocalityFromPoint | null)[] = [];
    component.localidad.subscribe((l) => emitidos.push(l));
    component.pinPunto({ lat: -17.78, lng: -63.18 });
    respuestas.next({
      found: true,
      line: 'Calle Guapay 3861, Equipetrol',
      countryCode: 'BO',
      adminAreas: {
        level1: 'Santa Cruz',
        level2: 'Provincia Andrés Ibáñez',
        level3: 'Santa Cruz de la Sierra',
        district: 'Distrito 2',
      },
      neighbourhood: 'Equipetrol',
      attribution: 'OSM',
    });
    fixture.detectChanges();
    const ultimo = emitidos.at(-1);
    expect(ultimo?.paisCodigo).toBe('BO');
    expect(ultimo?.niveles?.level2).toBe('Provincia Andrés Ibáñez');
    // El distrito administrativo manda sobre el barrio.
    expect(ultimo?.zona).toBe('Distrito 2');
    expect(raiz().querySelector('[data-testid="mapa-fuera-de-bolivia"]')).toBeNull();
  });
  it('fuera de donde se opera no deja confirmar el punto (ni por botón ni por el método)', () => {
    const confirmados: unknown[] = [];
    component.confirmado.subscribe((c) => confirmados.push(c));
    component.pinPunto({ lat: 40.4168, lng: -3.7038 });
    fixture.detectChanges();
    const boton = raiz().querySelector('[data-testid="confirmar"]') as HTMLElement;
    expect(boton.getAttribute('aria-disabled')).toBe('true');
    boton.click();
    component.confirmAddressActual();
    expect(component.confirmed()).toBe(false);
    expect(confirmados.filter((c) => c !== null)).toEqual([]);

    // De vuelta en Bolivia, sí.
    component.pinPunto({ lat: -17.78, lng: -63.18 });
    fixture.detectChanges();
    expect(boton.getAttribute('aria-disabled')).not.toBe('true');
    component.confirmAddressActual();
    expect(component.confirmed()).toBe(true);
  });
});
