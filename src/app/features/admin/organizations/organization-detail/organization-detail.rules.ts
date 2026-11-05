import { catchError, of, type Observable } from 'rxjs';

import { empty, ready } from '../../../../core/view-state/view-state';
import type { ViewState, ViewStateNextAction } from '../../../../core/view-state/view-state.types';

/** Una rama del `forkJoin` que se resolvió con fallo en vez de con datos. */
export interface Fallo {
  readonly error: unknown;
}

export function conFallo<T extends object>(fuente: Observable<T>): Observable<T | Fallo> {
  return fuente.pipe(catchError((error: unknown) => of<Fallo>({ error })));
}

export function esFallo(valor: object): valor is Fallo {
  return 'error' in valor;
}

export function conAccionPosible<T>(estado: ViewState<T>, puede: boolean): ViewState<T> {
  return estado.status === 'empty' && !puede
    ? { ...estado, nextAction: { label: 'Pídaselo a quien administra la organización' } }
    : estado;
}

/**
 * De la lista al estado. El vacío lleva su propio texto y su propia salida:
 * «no hay sucursales» y «no hay sub-organizaciones» son situaciones distintas,
 * y la tercera —una organización sin sub-organizaciones— es lo normal.
 */
export function estadoDeLista<T>(
  items: readonly T[],
  accion: ViewStateNextAction,
  mensaje: string,
): ViewState<readonly T[]> {
  return items.length === 0 ? empty(accion, mensaje) : ready(items);
}
