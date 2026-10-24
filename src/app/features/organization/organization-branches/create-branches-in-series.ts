import { catchError, concatMap, from, map, of, toArray, type Observable } from 'rxjs';

import type { DirectoryClient } from '../../../core/data-access/directory/directory.client';
import type { NewBranch } from '../../../core/data-access/directory/directory.types';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import {
  branchCodeFromName,
  type BranchDraft,
} from '../../../shared/utils/branch-import/branch-import';

/** Una sucursal del lote que la API no creó, con su motivo en palabras de persona. */
export interface BranchRejection {
  readonly name: string;
  readonly reason: string;
}

/** Cómo terminó un lote: cuántas entraron y cuáles no. */
export interface BranchBatchResult {
  readonly created: number;
  readonly rejected: readonly BranchRejection[];
}

/**
 * Crea las sucursales de un lote **una por una**, en su orden.
 *
 * No hay alta masiva en la API (`POST /tenants/{id}/branches` es de a una), y
 * en serie —no en paralelo— porque el código es único por organización: dos
 * altas simultáneas con el mismo código derivado se pisarían. Una que falla no
 * frena a las demás; el resultado dice cuáles no entraron y por qué.
 *
 * La comparten la ficha de cualquier organización en administración y la
 * pestaña «Sucursales» de los portales de la farmacia y del laboratorio.
 */
export function createBranchesInSeries(
  directory: DirectoryClient,
  tenantId: string,
  drafts: readonly BranchDraft[],
  takenCodes: Iterable<string>,
): Observable<BranchBatchResult> {
  const taken = new Set(takenCodes);
  const requests = drafts.map((draft) => {
    const code = draft.code === '' ? branchCodeFromName(draft.name, taken) : draft.code;
    taken.add(code);
    return { name: draft.name, branch: newBranchFrom(draft, code) };
  });
  return from(requests).pipe(
    concatMap(({ name, branch }) =>
      directory.createBranch(tenantId, branch).pipe(
        map(() => ({ name, reason: null })),
        catchError((error: unknown) => of({ name, reason: branchRejectionReason(error) })),
      ),
    ),
    toArray(),
    map((results) => {
      const rejected = results.flatMap(({ name, reason }) =>
        reason === null ? [] : [{ name, reason }],
      );
      return { created: results.length - rejected.length, rejected };
    }),
  );
}

/** El cuerpo de `POST /tenants/{id}/branches` para una fila del archivo. */
function newBranchFrom(draft: BranchDraft, code: string): NewBranch {
  return {
    code,
    name: draft.name,
    ...(draft.coordinates === null
      ? {}
      : { latitude: draft.coordinates.latitude, longitude: draft.coordinates.longitude }),
    ...(draft.description === '' ? {} : { description: draft.description }),
    ...(draft.locationUrl === '' ? {} : { locationUrl: draft.locationUrl }),
  };
}

/**
 * El mensaje de la API para una sucursal rechazada, o uno genérico. Un 409
 * (código repetido) y un 400 llegan como `validation` con sus `issues`; el
 * resto de los fallos, con `message`.
 */
export function branchRejectionReason(error: unknown, fallback = 'No se pudo crear.'): string {
  const state = errorToViewState<null>(error);
  if (state.status === 'validation') {
    const messages = state.issues.map((issue) => issue.message).filter((m) => m !== '');
    if (messages.length > 0) {
      return messages.join(' ');
    }
  }
  return 'message' in state && typeof state.message === 'string' && state.message !== ''
    ? state.message
    : fallback;
}
