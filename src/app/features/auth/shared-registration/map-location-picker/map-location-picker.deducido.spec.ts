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

  function campoCalle(): HTMLInputElement {
    return raiz().querySelector('[data-testid="calle"]') as HTMLInputElement;
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

    expect(campoCalle().value).toBe('Calle Guapay 3861, Equipetrol');
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
  function campoDistrito(): HTMLInputElement {
    return raiz().querySelector('[data-testid="mapa-distrito"]') as HTMLInputElement;
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
    expect(campoCalle().value).toContain('No pudimos traer');
    expect(campoDistrito().value).toContain('No pudimos traer');

    falla = false;
    const reintentar = raiz().querySelector(
      '[data-testid="mapa-reintentar-calle"] button, [data-testid="mapa-reintentar-calle"]',
    ) as HTMLElement;
    reintentar.click();
    fixture.detectChanges();
    expect(pedidos).toHaveLength(2);
    expect(campoCalle().value).toBe('Calle Q, Centro');
    expect(campoDistrito().value).toBe('Centro');
  });

  it('fuera de Bolivia no dibuja el mapa de Bolivia: lo dice, y la calle se sigue buscando', () => {
    component.pinPunto({ lat: 40.4168, lng: -3.7038 });
    fixture.detectChanges();
    expect(pedidos).toEqual([{ lat: 40.4168, lng: -3.7038 }]);
    expect(raiz().querySelector('[data-testid="mapa-fuera-de-bolivia"]')).not.toBeNull();
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
});
