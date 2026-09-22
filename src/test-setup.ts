/**
 * Preparación compartida de las pruebas.
 *
 * Corre una vez por archivo de prueba, después de que el builder inicializa los
 * polyfills y el `TestBed`. Es el lugar para lo transversal: si mañana hace
 * falta un doble global o una comprobación común, va acá y no repetido en cada
 * spec.
 *
 * Sostiene dos cosas, y las dos son del entorno: lo que el corredor promete y
 * no cumple.
 */

/**
 * Un `Storage` en memoria, con la semántica exacta de la interfaz del DOM.
 *
 * Guarda cadenas: `setItem(clave, 1)` devuelve `'1'`, igual que en el
 * navegador. Un doble que guardara el valor crudo dejaría pasar código que en
 * producción recibe texto y espera un número.
 */
function almacenEnMemoria(): Storage {
  const datos = new Map<string, string>();
  return {
    get length(): number {
      return datos.size;
    },
    key(indice: number): string | null {
      return [...datos.keys()][indice] ?? null;
    },
    getItem(clave: string): string | null {
      return datos.get(clave) ?? null;
    },
    setItem(clave: string, valor: string): void {
      datos.set(String(clave), String(valor));
    },
    removeItem(clave: string): void {
      datos.delete(String(clave));
    },
    clear(): void {
      datos.clear();
    },
  } as Storage;
}

/**
 * `localStorage`, que este corredor no expone.
 *
 * El entorno del builder `@angular/build:unit-test` da `sessionStorage` y la
 * clase `Storage`, pero **no** `localStorage`: medido acá, `typeof
 * globalThis.localStorage` es `'undefined'` y `document.defaultView` es el
 * mismo objeto global, así que tampoco lo tiene por esa vía.
 *
 * El síntoma no era una prueba en rojo sino algo peor, y es el mismo que
 * documenta `src/testing/tutorial-storage.ts`: un `localStorage.clear()` en un
 * `beforeEach`/`afterEach` tira `TypeError`, un throw en un hook marca fallada
 * **cada** prueba del archivo, y deja el `TestBed` instanciado — así que los
 * archivos que sigan en el **mismo worker** caen con un `Cannot configure the
 * test module` que no tiene nada que ver con lo que probaban. De ahí el ruido
 * no determinista de la suite completa: dos corridas seguidas daban 37 y 63
 * fallos sobre archivos distintos, y cada archivo aislado contaba otra
 * historia.
 *
 * Se instala uno de verdad en vez de parchear cada spec: el almacenamiento es
 * del entorno, no del caso de prueba, y las pruebas que fijan que algo
 * «sobrevive a una sesión nueva» necesitan que guardar y leer funcione. Queda
 * `configurable` para que un spec que necesite ausencia —el camino de SSR— lo
 * pueda quitar a propósito.
 */
if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: almacenEnMemoria(),
    configurable: true,
    writable: true,
  });
}

/**
 * `decodeAccessToken` decodifica el JWT con `atob` y `TextDecoder`. Los dos
 * existen tanto en el navegador como en Node, pero **si jsdom cambiara y alguno
 * faltara**, el síntoma sería un puñado de pruebas fallando por «token
 * ilegible» —porque la función devuelve `null` ante cualquier anomalía, que es
 * lo correcto en producción— y nadie miraría el entorno.
 *
 * Fallar acá, una vez y con el motivo escrito, ahorra esa cacería.
 */
if (typeof atob !== 'function' || typeof TextDecoder !== 'function') {
  throw new Error(
    'El entorno de pruebas no expone `atob` o `TextDecoder`, que la lectura del JWT necesita.',
  );
}
