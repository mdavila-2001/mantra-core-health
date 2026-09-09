import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UbicacionPicker, type Coordenadas, type IdsDePrueba } from './ubicacion-picker';

/**
 * Lo que se fija acá es la regla que da sentido al componente: **sólo sale lo
 * confirmado**. El GPS acierta la manzana, no la puerta, así que entre «esto es
 * lo que encontramos» y «esta es mi dirección» tiene que haber alguien mirando
 * el plano; y si no lo dice, el punto no viaja y la pantalla lo avisa en vez de
 * perderlo en silencio.
 */
const IDS: IdsDePrueba = {
  mapa: 'mapa',
  confirmada: 'confirmada',
  avisoGeocodificacion: 'aviso-geo',
  quitar: 'quitar',
  sinConfirmar: 'sin-confirmar',
  confirmar: 'confirmar',
  usarUbicacion: 'usar',
};

describe('UbicacionPicker', () => {
  let fixture: ComponentFixture<UbicacionPicker>;
  let component: UbicacionPicker;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [UbicacionPicker] }).compileComponents();

    fixture = TestBed.createComponent(UbicacionPicker);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('pinId', 'domicilio');
    fixture.componentRef.setInput('etiquetaConfirmada', 'Tu dirección');
    fixture.componentRef.setInput('pregunta', '¿Es acá donde vivís?');
    fixture.componentRef.setInput('etiquetaQuitar', 'Quitar la ubicación');
    fixture.componentRef.setInput('ids', IDS);
    fixture.detectChanges();
  });

  function raiz(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function emitidos(): (Coordenadas | null)[] {
    const recibidos: (Coordenadas | null)[] = [];
    component.confirmado.subscribe((valor) => recibidos.push(valor));
    return recibidos;
  }

  it('sin punto ofrece pedirlo, y nada más', () => {
    expect(raiz().querySelector(`[data-testid="${IDS.usarUbicacion}"]`)).not.toBeNull();
    expect(raiz().querySelector(`[data-testid="${IDS.mapa}"]`)).toBeNull();
  });

  it('con un punto sin confirmar avisa que no se va a guardar', () => {
    component.punto.set({ lat: -17.78, lng: -63.18 });
    fixture.detectChanges();

    expect(raiz().querySelector(`[data-testid="${IDS.sinConfirmar}"]`)).not.toBeNull();
    expect(raiz().querySelector(`[data-testid="${IDS.confirmada}"]`)).toBeNull();
  });

  it('no emite nada mientras el punto no se confirme', () => {
    const recibidos = emitidos();

    component.punto.set({ lat: -17.78, lng: -63.18 });
    fixture.detectChanges();

    expect(recibidos).toEqual([]);
  });

  it('confirmar emite el punto', () => {
    const recibidos = emitidos();
    component.punto.set({ lat: -17.78, lng: -63.18 });

    component.confirmarDireccionActual();

    expect(recibidos).toEqual([{ lat: -17.78, lng: -63.18 }]);
    expect(component.confirmada()).toBe(true);
  });

  it('confirmar sin punto no emite nada: no hay qué confirmar', () => {
    const recibidos = emitidos();

    component.confirmarDireccionActual();

    expect(recibidos).toEqual([]);
    expect(component.confirmada()).toBe(false);
  });

  it('quitar la ubicación se lleva también su confirmación, y lo avisa', () => {
    const recibidos = emitidos();
    component.punto.set({ lat: -17.78, lng: -63.18 });
    component.confirmarDireccionActual();

    component.quitarUbicacion();

    // El `null` es el aviso: quien lo consume tenía un punto guardado y tiene
    // que soltarlo. Sin esto, el alta viajaría con una dirección que la persona
    // acaba de borrar de la pantalla.
    expect(recibidos).toEqual([{ lat: -17.78, lng: -63.18 }, null]);
    expect(component.punto()).toBeNull();
    expect(component.confirmada()).toBe(false);
  });

  it('volver a pedir la ubicación desconfirma la anterior', () => {
    // Con geolocalización disponible: lo confirmado valía para el punto
    // anterior, no para el que está por llegar, así que se suelta al pedir.
    // jsdom no define `geolocation`, así que no hay getter que espiar: se
    // define la propiedad y se la quita al terminar.
    const geo = { getCurrentPosition: vi.fn() };
    Object.defineProperty(window.navigator, 'geolocation', {
      value: geo,
      configurable: true,
    });
    const recibidos = emitidos();
    component.punto.set({ lat: -17.78, lng: -63.18 });
    component.confirmarDireccionActual();

    component.usarMiUbicacion();

    expect(geo.getCurrentPosition).toHaveBeenCalled();
    expect(recibidos.at(-1)).toBeNull();
    expect(component.confirmada()).toBe(false);

    Reflect.deleteProperty(window.navigator, 'geolocation');
  });

  it('si el navegador no ofrece ubicación, lo confirmado sigue en pie', () => {
    // El camino del early-return. Nada cambió —no llegó ningún punto nuevo—,
    // así que soltar la confirmación anterior sería perder un dato bueno por
    // un intento que no ocurrió.
    const recibidos = emitidos();
    component.punto.set({ lat: -17.78, lng: -63.18 });
    component.confirmarDireccionActual();

    component.usarMiUbicacion();

    expect(component.confirmada()).toBe(true);
    expect(component.rechazado()).toBe(true);
    expect(recibidos).toEqual([{ lat: -17.78, lng: -63.18 }]);
  });

  it('sin geolocalización lo dice y no rompe el alta', () => {
    component.usarMiUbicacion();
    fixture.detectChanges();

    expect(component.rechazado()).toBe(true);
    expect(component.pidiendo()).toBe(false);
    expect(raiz().textContent).toContain('No pudimos obtener tu ubicación');
  });
});
