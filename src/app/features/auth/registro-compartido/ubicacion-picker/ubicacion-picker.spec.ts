import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UbicacionPicker, type Coordenadas, type IdsDePrueba } from './ubicacion-picker';
import { parseCoordinate } from './ubicacion-picker';

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
  confirmar: 'confirmar',
  usarUbicacion: 'usar',
  marcarEnMapa: 'marcar',
};

describe('UbicacionPicker', () => {
  let fixture: ComponentFixture<UbicacionPicker>;
  let component: UbicacionPicker;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [UbicacionPicker] }).compileComponents();

    fixture = TestBed.createComponent(UbicacionPicker);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('pinId', 'domicilio');
    fixture.componentRef.setInput('etiquetaConfirmada', 'Su dirección');
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

  it('sin punto ofrece las dos puertas —el navegador y el mapa— y ningún mapa todavía', () => {
    expect(raiz().querySelector(`[data-testid="${IDS.usarUbicacion}"]`)).not.toBeNull();
    expect(raiz().querySelector(`[data-testid="${IDS.marcarEnMapa}"]`)).not.toBeNull();
    expect(raiz().querySelector(`[data-testid="${IDS.mapa}"]`)).toBeNull();
  });

  /**
   * La segunda puerta: la casa casi nunca se declara desde la casa, y quien
   * negó el permiso del navegador también tiene que poder poner su pin.
   */
  it('«Marcar en el mapa» abre el mapa vacío, sin pin y sin pedir nada al navegador', () => {
    const geo = { getCurrentPosition: vi.fn() };
    Object.defineProperty(window.navigator, 'geolocation', { value: geo, configurable: true });

    component.marcarEnMapa();
    fixture.detectChanges();

    expect(geo.getCurrentPosition).not.toHaveBeenCalled();
    expect(component.marcando()).toBe(true);
    expect(component.punto()).toBeNull();
    expect(raiz().querySelector(`[data-testid="${IDS.mapa}"]`)).not.toBeNull();
    expect(raiz().querySelector(`[data-testid="${IDS.marcarEnMapa}-indicacion"]`)).not.toBeNull();
    expect(raiz().querySelector(`[data-testid="${IDS.confirmar}"]`)).toBeNull();

    Reflect.deleteProperty(window.navigator, 'geolocation');
  });

  it('tocar el mapa pone el pin, sin confirmarlo: es la persona quien tiene que decir que sí', () => {
    const recibidos = emitidos();
    component.marcarEnMapa();

    component.fijarPunto({ lat: -16.5, lng: -68.15 });
    fixture.detectChanges();

    expect(component.punto()).toEqual({ lat: -16.5, lng: -68.15 });
    expect(component.marcando()).toBe(false);
    expect(component.confirmada()).toBe(false);
    expect(recibidos).toEqual([]);
    expect(raiz().querySelector(`[data-testid="${IDS.confirmar}"]`)).not.toBeNull();
    // El pin puesto a mano no se llama «Acá te encontramos»: eso sería mentir.
    expect(component['pines']()[0].titulo).toBe('El punto que marcó');
  });

  it('tocar el mapa con un punto ya confirmado lo corre y suelta la confirmación', () => {
    const recibidos = emitidos();
    component.punto.set({ lat: -17.78, lng: -63.18 });
    component.confirmarDireccionActual();

    component.fijarPunto({ lat: -17.79, lng: -63.19 });

    // El `null` avisa a quien consume que el punto que tenía guardado ya no vale.
    expect(recibidos).toEqual([{ lat: -17.78, lng: -63.18 }, null]);
    expect(component.punto()).toEqual({ lat: -17.79, lng: -63.19 });
    expect(component.confirmada()).toBe(false);

    component.confirmarDireccionActual();
    expect(recibidos.at(-1)).toEqual({ lat: -17.79, lng: -63.19 });
  });

  /**
   * D-06: cada toque sobre el mapa avisa al padre para que vacíe la dirección
   * escrita. Tres niveles: el toque normal, el toque sobre un pin que ya
   * estaba (sigue siendo un toque), y lo que NO es un toque.
   */
  describe('«puntoElegido»: el aviso de que tocaron el mapa (D-06)', () => {
    function elegidos(): Coordenadas[] {
      const recibidos: Coordenadas[] = [];
      component.puntoElegido.subscribe((valor) => recibidos.push(valor));
      return recibidos;
    }

    it('tocar el mapa vacío lo emite con el punto, aunque no esté confirmado', () => {
      const elegido = elegidos();
      const confirmados = emitidos();
      component.marcarEnMapa();

      component.fijarPunto({ lat: -16.5, lng: -68.15 });

      expect(elegido).toEqual([{ lat: -16.5, lng: -68.15 }]);
      // Elegir no es confirmar: por el otro canal no sale nada todavía.
      expect(confirmados).toEqual([]);
    });

    it('tocar sobre un pin que ya estaba, confirmado o no, también lo emite', () => {
      const elegido = elegidos();
      component.punto.set({ lat: -17.78, lng: -63.18 });
      component.confirmarDireccionActual();

      component.fijarPunto({ lat: -17.79, lng: -63.19 });
      component.fijarPunto({ lat: -17.79, lng: -63.19 });

      // Dos toques, dos avisos: cada uno es «tocaron una dirección en el mapa».
      expect(elegido).toEqual([
        { lat: -17.79, lng: -63.19 },
        { lat: -17.79, lng: -63.19 },
      ]);
    });

    it('pedir la ubicación al navegador, confirmar o quitar no lo emiten: nadie tocó el mapa', () => {
      // Misma técnica que más abajo: jsdom no define `geolocation`.
      const geo = {
        getCurrentPosition: (ok: (p: { coords: { latitude: number; longitude: number } }) => void) =>
          ok({ coords: { latitude: -17.78, longitude: -63.18 } }),
      };
      Object.defineProperty(window.navigator, 'geolocation', { value: geo, configurable: true });
      const elegido = elegidos();

      component.usarMiUbicacion();
      expect(component.punto()).toEqual({ lat: -17.78, lng: -63.18 });
      component.confirmarDireccionActual();
      component.quitarUbicacion();

      expect(component.punto()).toBeNull();
      expect(elegido).toEqual([]);

      Reflect.deleteProperty(window.navigator, 'geolocation');
    });
  });

  it('el mapa abierto para marcar avisa al organismo que espera un toque', () => {
    component.marcarEnMapa();
    fixture.detectChanges();

    expect(raiz().querySelector('.mapa--seleccionable')).not.toBeNull();
  });

  it('quitar la ubicación con el mapa vacío abierto vuelve al principio', () => {
    component.marcarEnMapa();
    fixture.detectChanges();

    component.quitarUbicacion();
    fixture.detectChanges();

    expect(component.marcando()).toBe(false);
    expect(raiz().querySelector(`[data-testid="${IDS.mapa}"]`)).toBeNull();
    expect(raiz().querySelector(`[data-testid="${IDS.marcarEnMapa}"]`)).not.toBeNull();
  });

  it('con un punto sin confirmar ofrece confirmarlo', () => {
    component.punto.set({ lat: -17.78, lng: -63.18 });
    fixture.detectChanges();

    expect(raiz().querySelector(`[data-testid="${IDS.confirmar}"]`)).not.toBeNull();
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

  it('la confirmación no se ve, pero el lector de pantalla la recibe (D-07)', () => {
    component.punto.set({ lat: -17.78, lng: -63.18 });
    component.confirmarDireccionActual();
    fixture.detectChanges();

    const confirmacion = raiz().querySelector<HTMLElement>(`[data-testid="${IDS.confirmada}"]`);
    expect(confirmacion).not.toBeNull();
    expect(confirmacion?.textContent).toContain('Listo, guardamos esta dirección');
    // Sólo para lectores: fuera de la vista, pero anunciada y en el DOM.
    expect(confirmacion?.classList.contains('solo-lectores')).toBe(true);
    expect(confirmacion?.getAttribute('aria-live')).toBe('assertive');
    // Lo que sí se ve es el pin con su nombre y el aviso de la calle.
    expect(component['pines']()[0].titulo).toBe('Su dirección');
    expect(raiz().querySelector(`[data-testid="${IDS.avisoGeocodificacion}"]`)).not.toBeNull();
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
    expect(raiz().textContent).toContain('No pudimos obtener su ubicación');
  });
  /* ---- sin puntero (WCAG 2.1.1) ------------------------------------------ */

  describe('«Escribir coordenadas»: el pin sin puntero', () => {
    function byTestId(id: string): HTMLElement | null {
      return raiz().querySelector(`[data-testid="${id}"]`);
    }

    function escribir(id: string, valor: string): HTMLInputElement {
      const campo = byTestId(id) as HTMLInputElement;
      campo.value = valor;
      campo.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      return campo;
    }

    function abrirCampos(): void {
      component.marcarEnMapa();
      fixture.detectChanges();
      byTestId('location-coordinates-toggle')?.click();
      fixture.detectChanges();
    }

    it('está plegado y se despliega con su botón, que dice si está abierto', () => {
      component.marcarEnMapa();
      fixture.detectChanges();
      const boton = byTestId('location-coordinates-toggle') as HTMLElement;
      expect(boton.getAttribute('aria-expanded')).toBe('false');
      expect(byTestId('location-coordinates-lat')).toBeNull();

      boton.click();
      fixture.detectChanges();
      expect(boton.getAttribute('aria-expanded')).toBe('true');
      expect(byTestId('location-coordinates-lat')).not.toBeNull();
    });

    it('con coma o con punto decimal, pone el pin y lo avisa como un toque (D-06)', () => {
      const elegidos: Coordenadas[] = [];
      component.puntoElegido.subscribe((p) => elegidos.push(p));
      abrirCampos();

      escribir('location-coordinates-lat', '-16,5');
      escribir('location-coordinates-lng', '-68.15');
      byTestId('location-coordinates-apply')?.click();
      fixture.detectChanges();

      expect(component.punto()).toEqual({ lat: -16.5, lng: -68.15 });
      expect(elegidos).toEqual([{ lat: -16.5, lng: -68.15 }]);
      // Sin confirmar, igual que el toque: la persona tiene que mirarlo.
      expect(component.confirmada()).toBe(false);
      expect(byTestId('location-announcement')?.textContent).toContain(
        'Pin en latitud -16,50000, longitud -68,15000',
      );
    });

    it('fuera de rango o no numérico no mueve nada y dice qué escribir', () => {
      const elegidos: Coordenadas[] = [];
      component.puntoElegido.subscribe((p) => elegidos.push(p));
      abrirCampos();

      escribir('location-coordinates-lat', '95');
      escribir('location-coordinates-lng', 'oeste');
      byTestId('location-coordinates-apply')?.click();
      fixture.detectChanges();

      expect(component.punto()).toBeNull();
      expect(elegidos).toEqual([]);
      expect(raiz().textContent).toContain('Escriba un número entre −90 y 90');
      expect(raiz().textContent).toContain('Escriba un número entre −180 y 180');
      expect(byTestId('location-coordinates-lat')?.getAttribute('aria-invalid')).toBe('true');
    });

    it('Enter en un campo aplica y no envía el formulario de alta', () => {
      abrirCampos();
      escribir('location-coordinates-lat', '-17.7833');
      const campo = escribir('location-coordinates-lng', '-63.1821');

      const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      campo.dispatchEvent(enter);
      fixture.detectChanges();

      expect(enter.defaultPrevented).toBe(true);
      expect(component.punto()).toEqual({ lat: -17.7833, lng: -63.1821 });
    });

    it('abiertos con un pin puesto, llegan llenos con su punto', () => {
      component.fijarPunto({ lat: -17.78, lng: -63.18 });
      fixture.detectChanges();
      byTestId('location-coordinates-toggle')?.click();
      fixture.detectChanges();

      expect((byTestId('location-coordinates-lat') as HTMLInputElement).value).toBe('-17,78000');
      expect((byTestId('location-coordinates-lng') as HTMLInputElement).value).toBe('-63,18000');
    });

    it('cada punto nuevo se anuncia, también el de un toque o de las flechas del mapa', () => {
      component.marcarEnMapa();
      fixture.detectChanges();
      const region = byTestId('location-announcement') as HTMLElement;
      expect(region.getAttribute('role')).toBe('status');
      expect(region.textContent?.trim()).toBe('');

      component.fijarPunto({ lat: -17.5, lng: -63.49 });
      fixture.detectChanges();
      expect(region.textContent).toContain('longitud -63,49000');
    });
  });

  describe('parseCoordinate', () => {
    it('correcto: coma, punto, signo menos tipográfico y espacios', () => {
      expect(parseCoordinate('-17,7833', 90)).toBe(-17.7833);
      expect(parseCoordinate(' -63.1821 ', 180)).toBe(-63.1821);
      expect(parseCoordinate('−17.5', 90)).toBe(-17.5);
      expect(parseCoordinate('+12', 90)).toBe(12);
    });

    it('límite: los extremos entran, un paso más allá no', () => {
      expect(parseCoordinate('90', 90)).toBe(90);
      expect(parseCoordinate('-180', 180)).toBe(-180);
      expect(parseCoordinate('90.00001', 90)).toBeNull();
      expect(parseCoordinate('-180,1', 180)).toBeNull();
    });

    it('inválido: vacío, texto, dos números o notación rara', () => {
      expect(parseCoordinate('', 90)).toBeNull();
      expect(parseCoordinate('sur', 90)).toBeNull();
      expect(parseCoordinate('-17,78, -63,18', 90)).toBeNull();
      expect(parseCoordinate('1e2', 180)).toBeNull();
      expect(parseCoordinate('17.', 90)).toBeNull();
    });
  });
});
