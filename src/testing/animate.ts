/* ============================================================================
    Reemplazar `HTMLElement.prototype.animate` en una prueba, y dejarlo como
    estaba.

    jsdom no trae `animate`. Guardar `HTMLElement.prototype.animate` y después
    reasignarlo parece restaurar, pero deja en `HTMLElement.prototype` una
    propiedad **propia** que vale `undefined`, donde antes no había ninguna.

    Esa propiedad tapa a cualquier doble que otra prueba ponga más arriba, en
    `Element.prototype`, y el builder de Angular corre Vitest con
    `isolate: false`: los archivos que caen en el mismo hilo comparten el
    `window`. Así fallaban las pruebas de la cascada en `motion.spec.ts`, sólo
    cuando alguno de estos specs corría antes en su mismo hilo.

    Por eso se guarda el descriptor propio, no el valor: si había uno se
    repone, y si no había se borra la propiedad.
    ========================================================================== */

/**
 * Pone `doble` en lugar de `HTMLElement.prototype.animate`.
 *
 * @param doble - Lo que devolverá `elemento.animate(...)` mientras dure el reemplazo.
 * @returns La función que deja `HTMLElement.prototype` exactamente como estaba.
 */
export function reemplazarAnimate(doble: () => unknown): () => void {
  const propio = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'animate');
  HTMLElement.prototype.animate = doble as unknown as typeof HTMLElement.prototype.animate;
  return () => {
    if (propio) {
      Object.defineProperty(HTMLElement.prototype, 'animate', propio);
    } else {
      delete (HTMLElement.prototype as { animate?: unknown }).animate;
    }
  };
}
