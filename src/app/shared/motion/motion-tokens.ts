/* ============================================================================
    Referencias tipadas al sistema de movimiento.

    Fuente física: `src/styles.css` — ahí viven los VALORES; acá viven sólo los
    NOMBRES, igual que en `core/tokens/design-tokens.types.ts`. Este archivo no
    declara ni un milisegundo ni una curva: duplicar un valor sería abrir otra
    frontera de deriva.

    El espejo en Flutter es `MantraMotion` (`lib/theme/`).
    ========================================================================== */

/** Las tres duraciones del sistema. No hay una cuarta. */
export const MOTION_DURATIONS = ['fast', 'base', 'slow'] as const;

/** Una duración del sistema. */
export type MotionDuration = (typeof MOTION_DURATIONS)[number];

/** Las tres curvas del sistema. */
export const MOTION_EASINGS = ['standard', 'out', 'spring'] as const;

/** Una curva del sistema. */
export type MotionEasing = (typeof MOTION_EASINGS)[number];

/**
 * El nombre de la variable CSS de una duración.
 *
 * @param duration - `fast` (120 ms) · `base` (200 ms) · `slow` (320 ms).
 * @returns `var(--dur-…)`, listo para un estilo en línea o una animación.
 */
export function durationVar(duration: MotionDuration): string {
  return `var(--dur-${duration})`;
}

/**
 * El nombre de la variable CSS de una curva.
 *
 * `spring` es **sólo para confirmar una acción del dedo**, nunca para datos:
 * un rebote sobre una cifra clínica la hace parecer un juguete. Lo dice el
 * propio comentario de `styles.css` y acá se repite porque es lo que más fácil
 * se usa mal.
 *
 * @param easing - `standard` · `out` · `spring`.
 * @returns `var(--ease-…)`.
 */
export function easingVar(easing: MotionEasing): string {
  return `var(--ease-${easing})`;
}

/**
 * Los milisegundos reales de una duración, leídos del CSS.
 *
 * Hace falta porque la Web Animations API recibe números, no `var(…)`. Se lee
 * del documento en vez de escribirse acá para que siga habiendo **una sola
 * fuente**: si mañana `--dur-base` pasa a 240 ms, esto lo sigue solo.
 *
 * @param duration - Cuál de las tres.
 * @param element - Desde dónde resolver la variable. Por defecto, la raíz.
 * @returns Los milisegundos, o `0` si el CSS no está cargado (pruebas, SSR).
 */
export function durationMs(
  duration: MotionDuration,
  element: Element = document.documentElement,
): number {
  const crudo = leerVariable(`--dur-${duration}`, element);
  const numero = Number.parseFloat(crudo);
  return Number.isNaN(numero) ? 0 : numero;
}

/**
 * La curva real, leída del CSS.
 *
 * La Web Animations API recibe un valor de `easing`, no un `var(…)`: pasarle
 * el nombre de la variable no falla ruidosamente — **anima lineal y nadie se
 * entera**. Por eso se resuelve igual que `durationMs`, contra el documento.
 *
 * @param easing - Cuál de las tres.
 * @param element - Desde dónde resolver la variable. Por defecto, la raíz.
 * @returns La `cubic-bezier(...)`, o `ease-out` si el CSS no está cargado.
 */
export function easingValue(
  easing: MotionEasing,
  element: Element = document.documentElement,
): string {
  const crudo = leerVariable(`--ease-${easing}`, element);
  return crudo === '' ? 'ease-out' : crudo;
}

/**
 * Lee una variable CSS, cayendo a la raíz si el elemento no la resuelve.
 *
 * El respaldo no es defensivo porque sí: los tokens se declaran en `:root` y
 * **la herencia de variables no siempre se resuelve al consultar un
 * descendiente** —jsdom no la implementa, y en el navegador tampoco la
 * resuelve un elemento dentro de un shadow root sin heredar el tema—. Sin este
 * paso, una animación mediría 0 y se abstendría en silencio.
 */
function leerVariable(nombre: string, element: Element): string {
  const propio = getComputedStyle(element).getPropertyValue(nombre).trim();
  if (propio !== '') {
    return propio;
  }
  if (element === document.documentElement) {
    return '';
  }
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
}

/**
 * Si la persona pidió menos movimiento.
 *
 * **Se consulta en cada animación, no una sola vez al arrancar.** La
 * preferencia se puede cambiar con la aplicación abierta, y una copia guardada
 * al inicio seguiría animando después de que alguien la desactivó porque le
 * daba náuseas.
 *
 * Devuelve `false` sin `matchMedia` —servidor, jsdom viejo— porque en ese
 * contexto no hay animación que suprimir.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
