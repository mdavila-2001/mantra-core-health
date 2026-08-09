import { Injectable } from '@angular/core';

import { sanitizeError } from './error-sanitizer';

/**
 * Un mismo fallo puede llegar por cinco caminos a la vez.
 *
 * Un error dentro de un `subscribe` de una plantilla sube al `ErrorHandler`;
 * `provideBrowserGlobalErrorListeners` lo ve además como `window.error`; si
 * venía de una promesa, también como `unhandledrejection`; si era HTTP, el
 * interceptor ya lo marcó en su span; y si ocurrió durante una navegación, el
 * Router lo emite como `NavigationError`.
 *
 * Sin deduplicar, un solo fallo produce hasta cinco spans idénticos y el panel
 * dice que hay cinco veces más errores de los que hay. Es peor que un número
 * pequeño: hace que la métrica de errores deje de ser comparable consigo misma.
 *
 * ## Cómo se decide que dos errores son «el mismo»
 *
 * Por clase y mensaje saneado, dentro de una ventana de tiempo corta. No por
 * identidad del objeto: los cinco caminos de arriba **no** entregan siempre la
 * misma referencia —`unhandledrejection` entrega el motivo, no el error—.
 *
 * La ventana es de dos segundos. Los cinco caminos ocurren en el mismo tick o
 * en el siguiente; dos segundos los cubre con holgura y sigue siendo lo
 * bastante corta como para que un fallo que se repite de verdad —un botón que
 * la persona pulsa cinco veces— se cuente cinco veces, que es lo correcto.
 */
@Injectable({ providedIn: 'root' })
export class ErrorDeduplicator {
  /** Clave del error → momento en que se vio por última vez. */
  private readonly seen = new Map<string, number>();

  /**
   * `true` la primera vez que se ve este error, `false` en las repeticiones
   * dentro de la ventana.
   *
   * El nombre está en afirmativo a propósito: quien llama escribe
   * `if (dedup.shouldReport(error))`, que se lee como lo que hace.
   */
  shouldReport(error: unknown, now: number = Date.now()): boolean {
    this.forget(now);

    const key = keyOf(error);
    const last = this.seen.get(key);
    this.seen.set(key, now);

    return last === undefined || now - last > WINDOW_MS;
  }

  /** Vacía el registro. Para las pruebas. */
  reset(): void {
    this.seen.clear();
  }

  /**
   * Olvida lo que salió de la ventana.
   *
   * Sin esto, un mapa en una sesión larga acumularía una entrada por cada
   * mensaje de error distinto que haya ocurrido. Se limpia al consultar y no
   * con un temporizador para no dejar trabajo periódico corriendo en una
   * pestaña que quizá esté en segundo plano.
   */
  private forget(now: number): void {
    if (this.seen.size < MAX_TRACKED) {
      return;
    }

    for (const [key, at] of this.seen) {
      if (now - at > WINDOW_MS) {
        this.seen.delete(key);
      }
    }
  }
}

const WINDOW_MS = 2_000;

/**
 * A partir de cuántas entradas se limpia. Por debajo de esto, recorrer el mapa
 * en cada error costaría más que lo que ocupa.
 */
const MAX_TRACKED = 64;

/**
 * La clave de agrupación.
 *
 * Usa el mensaje **ya saneado**, que es lo que hace que dos apariciones del
 * mismo fallo con identificadores distintos —`no se encontró 8a3f…` y
 * `no se encontró b71c…`— cuenten como el mismo error, porque el saneador ya
 * sustituyó ambos por `«id»`.
 */
function keyOf(error: unknown): string {
  const { type, message } = sanitizeError(error);
  return `${type}::${message}`;
}
