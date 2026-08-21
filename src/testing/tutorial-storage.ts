import type { TutorialProgress } from '../app/core/tutorials/tutorial.types';

/**
 * Almacenamiento de progreso de tutoriales **en memoria**, para las pruebas.
 *
 * ## Por qué existe
 *
 * jsdom corre con origen opaco: tocar `localStorage` tira `SecurityError`. Tres
 * specs lo hacían igual —`localStorage.clear()` en su `afterEach`— y el efecto
 * no era una prueba en rojo sino algo bastante peor:
 *
 * 1. un throw en un hook marca fallado a **cada** prueba del archivo, y
 * 2. deja el `TestBed` instanciado, así que **los archivos que sigan en el
 *    mismo worker** también caen, con un `Cannot configure the test module`
 *    que no tiene nada que ver con lo que estaban probando.
 *
 * De ahí venía el ruido no determinista de la suite completa: dos corridas
 * seguidas daban 121 y 86 fallos sobre archivos distintos, según cómo el pool
 * repartiera los specs. Aislado, cada uno de esos archivos pasaba entero.
 *
 * ## Cómo se usa
 *
 * Se provee por el token, que existe justamente para esto:
 *
 * ```ts
 * TestBed.configureTestingModule({
 *   providers: [{ provide: TUTORIAL_STORAGE, useValue: new MemoriaDeTutoriales() }],
 * });
 * ```
 *
 * Nuevo por prueba: el progreso arranca vacío sin tener que vaciar nada, así
 * que el `afterEach` que causaba todo esto deja de hacer falta.
 */
export class MemoriaDeTutoriales {
  readonly datos = new Map<string, ReadonlyMap<string, TutorialProgress>>();

  read(clave: string): ReadonlyMap<string, TutorialProgress> {
    return this.datos.get(clave) ?? new Map();
  }

  write(clave: string, progreso: ReadonlyMap<string, TutorialProgress>): void {
    this.datos.set(clave, progreso);
  }
}
