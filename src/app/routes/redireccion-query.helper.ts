import { inject } from '@angular/core';
import { Router, type RedirectFunction } from '@angular/router';

export interface DestinoRedirigido {
  readonly ruta: string;
  readonly query?: Readonly<Record<string, string>>;
}

/**
 * La redirección de una sección o ruta, conservando el query que traía.
 */
export function redireccionConQuery(destino: DestinoRedirigido): RedirectFunction {
  return ({ queryParams, fragment }) =>
    inject(Router).createUrlTree([destino.ruta], {
      queryParams: { ...queryParams, ...destino.query },
      ...(fragment === null || fragment === undefined ? {} : { fragment }),
    });
}
