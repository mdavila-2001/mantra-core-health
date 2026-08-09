/**
 * Puntos de quiebre del sistema, para código.
 *
 * Son los mismos que `--bp-*` de `styles.css` y **hay que mantenerlos a la
 * par**: CSS no admite custom properties dentro de una consulta de medios
 * —`@media (min-width: var(--bp-md))` no funciona en ningún navegador—, así que
 * la escala vive necesariamente en dos lugares. Hay una prueba que compara los
 * dos archivos y falla si se separan, igual que la que ya cuida los colores.
 *
 * La escala está **extraída** de lo que el código ya usaba, no inventada:
 * 780 px era el corte de facto con 30 usos y 1024 px el secundario con 2.
 * Pendiente de que el diseñador la confirme.
 */
export const BREAKPOINTS = {
  /** Teléfono grande. */
  sm: 650,
  /** Tableta y el corte principal del sistema. */
  md: 780,
  /** Escritorio. */
  lg: 1024,
} as const;

export type BreakpointName = keyof typeof BREAKPOINTS;

/**
 * Consulta de medios **mobile-first** para un punto de quiebre.
 *
 * Siempre `min-width`: el teléfono es el caso base y cada corte agrega, nunca
 * quita. Es la regla del proyecto y por eso no hay una función equivalente para
 * `max-width` — escribirla invitaría a seguir haciéndolo al revés.
 */
export function mediaFrom(name: BreakpointName): string {
  return `(min-width: ${BREAKPOINTS[name]}px)`;
}
