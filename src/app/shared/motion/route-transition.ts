import type { ViewTransitionsFeatureOptions } from '@angular/router';

/**
 * Opciones de `withViewTransitions` para la transición entre rutas.
 *
 * ## Por qué NO se llama a `transition.skipTransition()` con movimiento reducido
 *
 * `skipTransition()` rechaza la promesa `ready` de la transición con
 * `AbortError: Transition was skipped` (así lo define la especificación de View
 * Transitions). El router de Angular engancha un `.catch` a `ready`, `finished`
 * y `updateCallbackDone` de **cada** transición que crea y, fuera de
 * producción, escribe el motivo con `console.error`. Resultado de saltarla para
 * respetar `prefers-reduced-motion`: una línea roja en la consola por cada
 * navegación de quien pidió menos movimiento (issue #1449) — y ningún spec de
 * Playwright puede exigir «cero errores de consola» con esa preferencia
 * emulada.
 *
 * Con la transición sin saltar, `ready` resuelve y no hay nada que registrar.
 * El movimiento se suprime donde ocurre: `styles.css` apaga la animación de
 * las pseudo-capas (`::view-transition-*`) dentro de
 * `@media (prefers-reduced-motion: reduce)`. Esa media query la evalúa el
 * navegador **en cada transición**, así que un cambio de la preferencia con la
 * aplicación abierta se respeta sin volver a consultar nada desde TypeScript.
 *
 * Quien necesite saltar una transición por otra razón tiene que contar con ese
 * mismo rechazo de `ready`: el router sólo lo registra, no lo silencia. La
 * prueba `route-transition.spec.ts` fija esta decisión.
 */
export const ROUTE_VIEW_TRANSITION_OPTIONS: ViewTransitionsFeatureOptions = {
  // La primera pintura no se anima: no hay página anterior que fundir.
  skipInitialTransition: true,
};
