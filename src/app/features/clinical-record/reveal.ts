import { afterNextRender, type Injector } from '@angular/core';

/**
 * Pone un elemento a la vista y le pasa el foco, sin que el foco vuelva a
 * desplazar la página. Para lo que aparece lejos del control que lo provocó:
 * el resultado de un envío a 390 px, o el control al que lleva una salida.
 */
export function reveal(element: HTMLElement): void {
  // `scrollIntoView` no existe en jsdom.
  if (typeof element.scrollIntoView === 'function') {
    element.scrollIntoView({ block: 'center' });
  }
  element.focus({ preventScroll: true });
}

/**
 * {@link reveal}, después del próximo dibujo: lo que hay que mostrar recién
 * existe cuando Angular lo pinta. `find` puede devolver `null` (no había nada
 * que mostrar) y entonces no hace nada.
 */
export function revealAfterRender(injector: Injector, find: () => HTMLElement | null): void {
  afterNextRender(
    () => {
      const element = find();
      if (element !== null) reveal(element);
    },
    { injector },
  );
}
