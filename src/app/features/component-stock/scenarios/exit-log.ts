import { signal, type Signal } from '@angular/core';

import type { RegisteredOutput } from './scenario.types';

/**
 * El cuaderno donde un anfitrión anota lo que el componente emite.
 *
 * Es lo único que los anfitriones comparten: cada uno monta un organismo
 * distinto, pero todos tienen que poder decir «se emitió `sortChanged` con
 * `apellido asc`» de la misma forma, para que la pestaña de salidas del banco
 * los lea igual.
 */
export interface OutputsRecord {
  readonly salidas: Signal<readonly RegisteredOutput[]>;
  /** Anota una emisión. `detalle` ya legible: no se serializa nada acá. */
  anotar(salida: string, detalle?: string): void;
  limpiar(): void;
}

export function outputsRecord(): OutputsRecord {
  const salidas = signal<readonly RegisteredOutput[]>([]);
  return {
    salidas,
    anotar: (salida, detalle = '') =>
      salidas.update((previas) => [...previas, { salida, detalle, momento: performance.now() }]),
    limpiar: () => salidas.set([]),
  };
}
