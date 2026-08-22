/**
 * Set de íconos de trazo propio de la navegación. Cerrado a propósito: un
 * string libre terminaría en nombres que no existen y en íconos mudos.
 *
 * ## Por qué vive acá y no en el nav lateral
 *
 * Lo declaraba `organisms/side-nav/side-nav.types.ts`, cuando el único que
 * dibujaba estos íconos era el menú. Desde el carril 02 los dibuja también
 * «Tus accesos» del panel, y el dueño del set tiene que ser el átomo que lo
 * pinta —si no, el panel importaría de un organismo para usar un ícono, que es
 * exactamente al revés de como se apilan las capas—.
 *
 * `side-nav.types.ts` lo re-exporta para no romper a quien ya lo importaba de
 * ahí.
 */
export const NAV_ICON_NAMES = [
  'home',
  'patients',
  'calendar',
  'orders',
  'results',
  'billing',
  'settings',
] as const;

export type NavIconName = (typeof NAV_ICON_NAMES)[number];
