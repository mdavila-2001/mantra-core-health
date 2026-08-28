import { DOCUMENT, PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { BrowserPermissionsService } from './browser-permissions.service';

/**
 * Lo que estas pruebas fijan.
 *
 * Las dos reglas que hacen honesta a esta pantalla: que **no saber no es estar
 * denegado** —Safari no responde `permissions.query` para la cámara, y ahí el
 * estado es `desconocido`, no `sin-decidir`— y que **un permiso ya resuelto no
 * se vuelve a pedir**, porque el navegador ignora esa petición en silencio y un
 * botón «Permitir» prometería un cartel que no aparece.
 *
 * Y una consecuencia que es fácil romper sin darse cuenta: pedir la cámara
 * **cierra el flujo** que abrió. Dejarlo abierto deja la luz encendida.
 */
describe('BrowserPermissionsService', () => {
  interface Ventana {
    Notification?: { permission: string; requestPermission: () => Promise<string> };
    navigator: {
      permissions?: { query: (d: { name: string }) => Promise<{ state: string }> };
      geolocation?: { getCurrentPosition: (ok: () => void, mal: () => void) => void };
      mediaDevices?: { getUserMedia: (c: unknown) => Promise<{ getTracks: () => unknown[] }> };
    };
  }

  const pistasDetenidas: string[] = [];

  function armar(ventana: Partial<Ventana>): BrowserPermissionsService {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: DOCUMENT, useValue: { defaultView: { navigator: {}, ...ventana } } },
      ],
    });
    return TestBed.inject(BrowserPermissionsService);
  }

  /** Un `permissions.query` que contesta lo mismo para todo. */
  const queryQueDice = (state: string) => ({
    query: () => Promise.resolve({ state }),
  });

  beforeEach(() => {
    pistasDetenidas.length = 0;
    TestBed.resetTestingModule();
  });

  it('lee los avisos de `Notification.permission`, que es fiable en todos lados', async () => {
    const servicio = armar({
      Notification: { permission: 'granted', requestPermission: () => Promise.resolve('granted') },
      navigator: {},
    });
    await servicio.refrescar();

    expect(servicio.estado().avisos).toBe('concedido');
  });

  it('sin la función, el estado es «este navegador no lo ofrece»', async () => {
    const servicio = armar({ navigator: {} });
    await servicio.refrescar();

    // No hay `Notification`, ni `geolocation`, ni `mediaDevices`: no es que
    // estén denegados, es que no existen.
    expect(servicio.estado()).toEqual({
      avisos: 'no-disponible',
      ubicacion: 'no-disponible',
      camara: 'no-disponible',
    });
  });

  it('con la función pero sin forma de consultarla, el estado es «desconocido»', async () => {
    const servicio = armar({
      navigator: {
        geolocation: { getCurrentPosition: (ok) => ok() },
        // Sin `permissions`: es el caso de varios navegadores.
      },
    });
    await servicio.refrescar();

    // La diferencia con `no-disponible` importa: acá la ubicación SÍ se puede
    // pedir, sólo que nadie sabe en qué estado está.
    expect(servicio.estado().ubicacion).toBe('desconocido');
    expect(servicio.sePuedePedir('ubicacion')).toBe(true);
  });

  it('un `query` que rechaza el nombre tampoco es una denegación', async () => {
    const servicio = armar({
      navigator: {
        mediaDevices: { getUserMedia: () => Promise.resolve({ getTracks: () => [] }) },
        permissions: { query: () => Promise.reject(new TypeError('nombre no soportado')) },
      },
    });
    await servicio.refrescar();

    // Es Safari con la cámara: la función existe y la consulta no.
    expect(servicio.estado().camara).toBe('desconocido');
  });

  it('lo concedido y lo denegado no se vuelven a pedir', async () => {
    const concedido = armar({
      navigator: {
        geolocation: { getCurrentPosition: (ok) => ok() },
        permissions: queryQueDice('granted'),
      },
    });
    await concedido.refrescar();

    expect(concedido.estado().ubicacion).toBe('concedido');
    expect(concedido.sePuedePedir('ubicacion')).toBe(false);

    TestBed.resetTestingModule();
    const denegado = armar({
      navigator: {
        geolocation: { getCurrentPosition: (ok) => ok() },
        permissions: queryQueDice('denied'),
      },
    });
    await denegado.refrescar();

    expect(denegado.estado().ubicacion).toBe('denegado');
    expect(denegado.sePuedePedir('ubicacion')).toBe(false);
  });

  it('pedir la cámara cierra el flujo que abrió: si no, queda la luz encendida', async () => {
    const servicio = armar({
      navigator: {
        mediaDevices: {
          getUserMedia: () =>
            Promise.resolve({
              getTracks: () => [{ stop: () => pistasDetenidas.push('video') }],
            }),
        },
        permissions: queryQueDice('granted'),
      },
    });

    await servicio.pedir('camara');

    expect(pistasDetenidas).toEqual(['video']);
  });

  it('que la persona diga que no es una respuesta, no un fallo', async () => {
    const servicio = armar({
      navigator: {
        geolocation: { getCurrentPosition: (_ok, mal) => mal() },
        permissions: queryQueDice('denied'),
      },
    });

    // No lanza: rechazar es una respuesta válida, y el estado nuevo lo cuenta
    // el refresco que hace `pedir` al terminar.
    await servicio.pedir('ubicacion');

    expect(servicio.estado().ubicacion).toBe('denegado');
  });

  it('bajo SSR no toca el navegador ni afirma nada sobre él', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'server' },
        { provide: DOCUMENT, useValue: { defaultView: null } },
      ],
    });
    const servicio = TestBed.inject(BrowserPermissionsService);
    await servicio.refrescar();

    // `desconocido` y no `sin-decidir`: en el servidor nadie comprobó nada.
    expect(servicio.estado().avisos).toBe('desconocido');
  });
});
