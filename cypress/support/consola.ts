/**
 * Vigilancia de la consola del navegador.
 *
 * La consola vacía no es cosmética: la CSP del artefacto declara los hashes de
 * sus scripts en línea, y si alguno no cuadrara el navegador lo bloquearía **y
 * solo lo diría acá**. La aplicación arrancaría a medias sin que ninguna otra
 * prueba lo notara.
 *
 * ## Por qué se envuelve `console.error` en vez de usar `cy.spy`
 *
 * Un espía se instala dentro de una prueba, y para entonces la página ya
 * arrancó: los errores del arranque —que son los que importan— ya se
 * escribieron. Esto se engancha en `window:before:load`, que corre antes de que
 * el documento ejecute una sola línea.
 *
 * Se envuelve y **se deja pasar** la llamada original: silenciar la consola del
 * navegador escondería el mensaje justo en la corrida donde hay que leerlo.
 */

/** Un mensaje recogido de la consola o de un error no capturado. */
export interface MensajeDeConsola {
  readonly tipo: 'error' | 'excepcion' | 'promesa';
  readonly texto: string;
}

let recogidos: MensajeDeConsola[] = [];

/** Todo lo que la consola dijo desde el último reinicio. */
export function mensajesDeConsola(): readonly MensajeDeConsola[] {
  return recogidos;
}

/**
 * Ruidos del navegador que no dicen nada del producto.
 *
 * La lista es corta a propósito: cada patrón que se agrega es una familia de
 * fallos que la suite deja de ver. El favicon y el aviso de las DevTools de
 * Angular están porque los escribe el navegador o el framework, no la
 * aplicación, y aparecen en toda corrida.
 */
const RUIDO: readonly RegExp[] = [/favicon/i, /Download the Angular DevTools/i];

/**
 * Lo que cuenta como error grave.
 *
 * Los tres tipos lo son: un `console.error`, una excepción que nadie atrapó y
 * una promesa rechazada sin manejador significan lo mismo para quien usa la
 * aplicación —algo no funcionó— y el equivalente en la suite anterior (el nivel
 * `SEVERE` del registro de Chrome) los agrupaba igual.
 */
export function erroresDeConsola(): readonly MensajeDeConsola[] {
  return recogidos.filter((mensaje) => !RUIDO.some((patron) => patron.test(mensaje.texto)));
}

export function reiniciarConsola(): void {
  recogidos = [];
}

function anotar(tipo: MensajeDeConsola['tipo'], texto: string): void {
  if (texto.trim() === '') {
    return;
  }
  recogidos.push({ tipo, texto: texto.trim() });
}

function describir(argumentos: readonly unknown[]): string {
  return argumentos
    .map((valor) => {
      if (valor instanceof Error) {
        return valor.message;
      }
      if (typeof valor === 'string') {
        return valor;
      }
      try {
        return JSON.stringify(valor);
      } catch {
        return String(valor);
      }
    })
    .join(' ');
}

/**
 * Engancha la vigilancia en la ventana de la aplicación.
 *
 * Se llama desde `support/e2e.ts` una vez, y Cypress la vuelve a invocar en
 * cada carga de página: por eso el enganche tiene que ser idempotente respecto
 * de la ventana, y lo es porque cada carga trae una ventana nueva.
 */
export function vigilarConsola(ventana: Cypress.AUTWindow): void {
  const original = ventana.console.error.bind(ventana.console);
  ventana.console.error = (...argumentos: unknown[]): void => {
    anotar('error', describir(argumentos));
    original(...argumentos);
  };

  ventana.addEventListener('error', (evento: ErrorEvent) => {
    anotar('excepcion', evento.message);
  });

  ventana.addEventListener('unhandledrejection', (evento: PromiseRejectionEvent) => {
    const razon: unknown = evento.reason;
    anotar('promesa', razon instanceof Error ? razon.message : String(razon));
  });
}
