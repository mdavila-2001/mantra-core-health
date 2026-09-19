import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { CrossTabLock } from './cross-tab-lock';

describe('CrossTabLock', () => {
  let lock: CrossTabLock;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    lock = TestBed.inject(CrossTabLock);
  });

  /**
   * jsdom (el entorno de estas pruebas) no implementa `navigator.locks`, igual
   * que Safari < 15.4 o el render del servidor. Es el camino que de verdad se
   * ejerce acá — el otro se prueba abajo simulando el soporte.
   */
  it('sin soporte de Web Locks, deja pasar el observable sin envolverlo', () => {
    const fuente = of('resultado');

    const resultado = lock.withLock('un-lock', fuente);

    expect(resultado).toBe(fuente);
  });

  it('con soporte de Web Locks, serializa a través de LockManager.request', async () => {
    const locksFalsos = {
      request: (async (_name: string, callback: (l: null) => Promise<unknown>) => callback(null)) as never,
    };
    Object.defineProperty(globalThis.navigator, 'locks', {
      value: locksFalsos,
      configurable: true,
    });

    try {
      const resultado = await new Promise((resolve, reject) => {
        lock.withLock('un-lock', of('resultado')).subscribe({ next: resolve, error: reject });
      });

      expect(resultado).toBe('resultado');
    } finally {
      // No se puede `delete navigator.locks` en jsdom sin romper otras pruebas
      // del mismo proceso: se restaura a `undefined`, que es lo que valen los
      // navegadores sin soporte.
      Object.defineProperty(globalThis.navigator, 'locks', {
        value: undefined,
        configurable: true,
      });
    }
  });
});
