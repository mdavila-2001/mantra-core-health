import { ErrorHandler, inject, Injectable, isDevMode } from '@angular/core';

import { BUILD_INFO } from '../build/build-info';
import { ErrorReporter } from './error-reporter';

/**
 * Punto único por el que pasa **todo** fallo no capturado de la aplicación.
 *
 * Antes existía solo `provideBrowserGlobalErrorListeners()`, cuyo manejador por
 * defecto escribe en la consola y nada más: una excepción en el constructor de
 * un componente dejaba la pantalla en blanco y **nadie se enteraba**.
 *
 * Este manejador no arregla el fallo —eso es de quien lo provoca— pero hace las
 * tres cosas que faltaban:
 *
 * 1. **Le pone contexto**: versión y commit del artefacto, y la ruta. Sin eso,
 *    un reporte no se puede correlacionar con un commit.
 * 2. **Le da un identificador**, para que la persona pueda reportarlo. Es el
 *    equivalente al `requestId` que S9 exige para los fallos de API — con la
 *    diferencia de que acá no hubo petición, así que hay que generarlo.
 * 3. **Lo entrega a {@link ErrorReporter}**, que hoy solo escribe en consola y
 *    mañana tendrá destino remoto sin que haya que tocar esto.
 */
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private readonly build = inject(BUILD_INFO);
  private readonly reporter = inject(ErrorReporter);

  handleError(error: unknown): void {
    const id = this.reporter.report(error, {
      version: this.build.version,
      commit: this.build.commit,
      // `location` puede no existir bajo SSR: el fallo del servidor se registra
      // igual, sin ruta, en vez de fallar al registrar el fallo.
      route: typeof location === 'undefined' ? '(servidor)' : location.pathname,
    });

    // En desarrollo se conserva la traza completa en consola: es lo que hace
    // falta para depurar, y el identificador solo estorbaría.
    if (isDevMode()) {
      console.error(`[${id}]`, error);
    }
  }
}
