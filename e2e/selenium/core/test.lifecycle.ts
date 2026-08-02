import { beforeEach, onTestFailed, onTestFinished } from 'vitest';
import type { WebDriver } from 'selenium-webdriver';

import type { Viewport } from '../config/environment';
import { cerrarDriver, crearDriver } from './driver.factory';
import { recolectarEvidencia } from './evidence';

/**
 * Ciclo de vida de una prueba con navegador.
 *
 * Tres garantías, y las tres importan:
 *
 *  1. **Un navegador nuevo por prueba.** Perfil limpio: sin cookies, sin
 *     almacenamiento y sin sesión heredada. Es lo que permite que las pruebas
 *     corran en cualquier orden, en paralelo, y que la suite entera se pueda
 *     repetir sin limpiar nada en el medio.
 *  2. **Evidencia antes de cerrar.** La captura se toma con el navegador vivo y
 *     en el estado exacto del fallo. Después ya no hay nada que fotografiar.
 *  3. **El navegador se cierra siempre.** También cuando la prueba falla, se
 *     agota el tiempo o lanza fuera de un `await`. Un Chrome huérfano por
 *     prueba fallida deja al agente de CI sin memoria en pocas corridas.
 *
 * `onTestFailed` y `onTestFinished` se registran desde el `beforeEach` a
 * propósito: Vitest los asocia a la prueba en curso, corren en ese orden y no
 * hace falta que cada spec repita el `try/finally`.
 */

export interface OpcionesNavegador {
  /** Resolución de la ventana. Por defecto, la de la configuración. */
  readonly viewport?: Viewport;
}

/**
 * Declara que las pruebas de este bloque usan navegador.
 *
 * Devuelve un accesor y no el driver: en el momento de llamarla —al declarar el
 * `describe`— el navegador todavía no existe.
 *
 * ```ts
 * const navegador = usarNavegador();
 *
 * test('entra al panel', async () => {
 *   const login = new LoginPage(navegador());
 *   await login.abrir();
 * });
 * ```
 */
export function usarNavegador(opciones: OpcionesNavegador = {}): () => WebDriver {
  let driver: WebDriver | null = null;

  beforeEach(async (contexto) => {
    driver = await crearDriver({ viewport: opciones.viewport });
    const nombre = contexto.task.name;

    onTestFailed(async (contextoDelFallo) => {
      if (driver === null) {
        return;
      }
      // `errors` existe en el contexto que reciben estos manejadores pero no
      // está en el tipo público de Vitest 4; se lee con una forma acotada en
      // lugar de un `any`, para que un cambio de forma siga siendo seguro.
      const { errors } = contextoDelFallo as unknown as { errors?: readonly unknown[] };
      const error = errors?.[0] ?? new Error('La prueba falló sin error asociado.');
      const evidencia = await recolectarEvidencia(driver, nombre, error).catch(() => null);
      if (evidencia?.captura != null) {
        // Se imprime la ruta para que el fallo del reporte lleve a la imagen
        // sin tener que adivinar cómo se llamó el archivo.
        console.error(`[e2e] Evidencia de «${nombre}»: ${evidencia.captura}`);
      }
    });

    onTestFinished(async () => {
      await cerrarDriver(driver);
      driver = null;
    });
  });

  return () => {
    if (driver === null) {
      throw new Error(
        'El navegador todavía no existe: usarNavegador() solo sirve dentro de una prueba.',
      );
    }
    return driver;
  };
}
