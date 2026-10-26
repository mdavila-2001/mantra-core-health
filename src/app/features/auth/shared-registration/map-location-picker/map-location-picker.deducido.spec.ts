import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';

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
});
