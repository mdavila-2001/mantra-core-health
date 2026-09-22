import { signal, type Signal } from '@angular/core';

import type { SalidaRegistrada } from './escenario.types';

/**
 * El cuaderno donde un anfitrión anota lo que el componente emite.
 *
 * Es lo único que los anfitriones comparten: cada uno monta un organismo
 * distinto, pero todos tienen que poder decir «se emitió `sortChanged` con
 * `apellido asc`» de la misma forma, para que la pestaña de salidas del banco
 * los lea igual.
 */
export interface RegistroDeSalidas {
  readonly salidas: Signal<readonly SalidaRegistrada[]>;
  /** Anota una emisión. `detalle` ya legible: no se serializa nada acá. */
  anotar(salida: string, detalle?: string): void;
  limpiar(): void;
}

export function registroDeSalidas(): RegistroDeSalidas {
  const salidas = signal<readonly SalidaRegistrada[]>([]);
  return {
    salidas,
    anotar: (salida, detalle = '') =>
      salidas.update((previas) => [...previas, { salida, detalle, momento: performance.now() }]),
    limpiar: () => salidas.set([]),
  };
}
