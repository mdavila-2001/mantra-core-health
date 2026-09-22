/* ============================================================================
    Hacer fallar una petición del backend simulado, a propósito.

    ## Por qué existe

    La maqueta intercepta **dentro** de Angular (`mockBackendInterceptor`), así
    que ninguna petición llega a la red. Eso es lo que la hace rápida y
    desplegable sin API detrás, y también lo que dejaba **un tercio de cada
    pantalla sin forma de mirarse**: el camino feliz se recorre entero, y los
    avisos de «tu rol no permite», «ya no existe» o «no pudimos conectarnos»
    sólo existían en las pruebas unitarias.

    No es una distinción académica. El defecto que trajo este archivo —
    `allergy-block` se quedaba mudo cuando la petición no llegaba— vivió meses
    en una pantalla que se revisó muchas veces: nadie podía verlo porque nadie
    podía provocarlo. Cortar `fetch` o `XMLHttpRequest` desde la consola no
    sirve, y comprobarlo cuesta más que escribir esto: como el interceptor
    responde antes de la red, la petición se resuelve igual y parece que el
    corte no hizo nada.

    ## Cómo se usa

    Desde la consola del navegador, o desde un guion de Playwright:

    ```js
    sessionStorage.setItem('mock:fallos', JSON.stringify([
      { patron: '/clinical/allergy-intolerances', modo: 'red' },
    ]));
    ```

    `patron` casa por subcadena contra la ruta —no contra la URL entera— y
    `modo` elige cuál de los nueve estados del M34 se quiere mirar. Se lee en
    **cada** petición, así que encenderlo y apagarlo no exige recargar.

    ## Tres decisiones deliberadas

    1. **Vive en `sessionStorage` y muere con la pestaña.** Un interruptor que
       sobrevive a la recarga es un interruptor que alguien deja encendido sin
       querer y que después nadie encuentra. Mismo criterio que `modo-api.ts`.
    2. **Sólo afecta al backend simulado.** Si la maqueta está apagada, este
       archivo no se consulta: no hay forma de que se cuele en producción
       —`environment.mockBackend` lo decide antes—.
    3. **Tolera basura sin romper nada.** Un JSON inválido, un modo que no
       existe o el almacenamiento bloqueado se leen como «sin fallos». Una
       herramienta de desarrollo que tumba la aplicación al escribirse mal es
       peor que no tenerla.
   ========================================================================== */

/** La clave del almacenamiento de sesión. Única y con prefijo. */
const CLAVE = 'mock:fallos';

/**
 * Qué clase de fallo se quiere provocar.
 *
 * Los cinco que una escritura puede encontrarse, en los términos del M34:
 * `red` es S8 —la petición no llegó—, y los otros cuatro son los estados HTTP
 * que el modelo de error del backend declara.
 */
export const MODOS_DE_FALLO = ['red', 'forbidden', 'not-found', 'conflict', 'error'] as const;
export type ModoDeFallo = (typeof MODOS_DE_FALLO)[number];

/** Un fallo declarado: a qué rutas alcanza y de qué clase es. */
export interface FalloSimulado {
  /** Subcadena de la ruta, p. ej. `/clinical/allergy-intolerances`. */
  readonly patron: string;
  readonly modo: ModoDeFallo;
  /**
   * A qué métodos alcanza. Sin él, a todos.
   *
   * Sirve para lo corriente: hacer fallar el alta sin tumbar la lectura que
   * pinta la pantalla donde está el formulario.
   */
  readonly metodos?: readonly string[];
}

/**
 * El fallo declarado para esta petición, si lo hay.
 *
 * @param method - Método HTTP, en mayúsculas.
 * @param path - La ruta ya normalizada, sin el origen ni la query.
 * @returns El fallo que corresponde, o `null` si la petición sigue su curso.
 */
export function falloPara(method: string, path: string): FalloSimulado | null {
  for (const fallo of declarados()) {
    if (!path.includes(fallo.patron)) {
      continue;
    }
    if (fallo.metodos !== undefined && !fallo.metodos.map((m) => m.toUpperCase()).includes(method)) {
      continue;
    }
    return fallo;
  }
  return null;
}

/**
 * El cuerpo con el que responde un fallo, en la forma del modelo de error del
 * backend.
 *
 * `code` es lo que importa: `errorToViewState` mapea por el código del
 * contrato y no por el estado HTTP —dos códigos distintos comparten el 403—, y
 * un cuerpo sin él caería en «error inesperado» y no en el estado que se quería
 * mirar.
 */
export function cuerpoDelFallo(fallo: FalloSimulado, path: string): { status: number; body: unknown } {
  const base = { timestamp: new Date().toISOString(), path, correlationId: 'mock-fallo' };
  switch (fallo.modo) {
    case 'forbidden':
      return { status: 403, body: { ...base, code: 'FORBIDDEN', message: '' } };
    case 'not-found':
      return { status: 404, body: { ...base, code: 'NOT_FOUND', message: '' } };
    case 'conflict':
      return {
        status: 409,
        body: { ...base, code: 'CONFLICT', message: 'Simulado: ya existe un registro así.' },
      };
    default:
      // `INTERNAL`, no `INTERNAL_ERROR`: el código tiene que ser uno de los que
      // `API_ERROR_CODES` declara o `readApiError` devuelve `null`, y entonces
      // el `correlationId` se pierde y el aviso sale con «sin-id». Un simulador
      // que no reproduce el contrato enseña a leer mal el error de verdad.
      return {
        status: 500,
        body: { ...base, code: 'INTERNAL', message: 'Simulado: fallo del servidor.' },
      };
  }
}

/**
 * Lo declarado en esta sesión, o nada.
 *
 * Tolerante a propósito: el almacenamiento puede estar bloqueado —modo
 * privado, política del navegador— o traer algo que no es la lista esperada.
 * En cualquiera de los dos casos se sigue sin fallos, que es el estado normal.
 */
function declarados(): readonly FalloSimulado[] {
  if (typeof sessionStorage === 'undefined') {
    return [];
  }
  try {
    const crudo = sessionStorage.getItem(CLAVE);
    if (crudo === null) {
      return [];
    }
    const leido: unknown = JSON.parse(crudo);
    return Array.isArray(leido) ? leido.filter(esFallo) : [];
  } catch {
    return [];
  }
}

function esFallo(valor: unknown): valor is FalloSimulado {
  if (typeof valor !== 'object' || valor === null) {
    return false;
  }
  const candidato = valor as Record<string, unknown>;
  return (
    typeof candidato['patron'] === 'string' &&
    candidato['patron'] !== '' &&
    typeof candidato['modo'] === 'string' &&
    (MODOS_DE_FALLO as readonly string[]).includes(candidato['modo'])
  );
}
