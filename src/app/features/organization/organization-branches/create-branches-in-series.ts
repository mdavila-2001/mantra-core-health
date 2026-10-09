import { catchError, concatMap, from, map, of, toArray, type Observable } from 'rxjs';

import type { DirectoryClient } from '../../../core/data-access/directory/directory.client';
import {
  BRANCH_SIMULATOR_EXTENSIONS,
  type NewBranch,
} from '../../../core/data-access/directory/directory.types';
import { droppedSimulatorExtensions } from '../../../core/data-access/simulator-only';
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
  /**
   * El aviso de lo que el archivo traía y la API real todavía no guarda
   * (descripción y enlace de mapa, P54), o `null` si no se perdió nada.
   */
  readonly unsavedNotice: string | null;
}

const UNSAVED_BRANCH_FIELD_LABELS: Readonly<Record<string, string>> = {
  description: 'la descripción',
  locationUrl: 'el enlace de ubicación',
};

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
  const unsaved = new Set(
    requests.flatMap(({ branch }) =>
      droppedSimulatorExtensions(branch, BRANCH_SIMULATOR_EXTENSIONS),
    ),
  );
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
      return {
        created: results.length - rejected.length,
        rejected,
        unsavedNotice: unsavedNoticeOf(unsaved),
      };
    }),
  );
}

function unsavedNoticeOf(fields: ReadonlySet<string>): string | null {
  if (fields.size === 0) return null;
  const labels = [...fields]
    .map((field) => UNSAVED_BRANCH_FIELD_LABELS[field] ?? field)
    .join(' y ');
  return `Las sucursales se crearon sin ${labels}: el servidor todavía no guarda esos datos.`;
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
