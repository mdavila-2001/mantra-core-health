import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../../core/http/api-error';
import { errorToViewState } from '../../../core/http/error-to-view-state';
import { forbidden, notFound } from '../../../core/view-state/view-state';
import type { ViewState } from '../../../core/view-state/view-state.types';

/**
 * Por qué no se pudo abrir la receta, con lo justo para elegir el texto.
 *
 * - `UNKNOWN_LINK`: el token no existe (404).
 * - `NO_PHARMACY`: la organización no tiene una farmacia verificada (404 con
 *   `reason` `PHARMACY_INVENTORY_RESOURCE_NOT_AVAILABLE`). No dice nada del
 *   enlace: es de la cuenta.
 * - `REVOKED` / `EXPIRED`: el enlace existió y ya no abre (410, S-5).
 * - `NOT_ALLOWED`: la sesión no es de farmacia (403 del guard de roles).
 */
export type OpenFailure = 'UNKNOWN_LINK' | 'NO_PHARMACY' | 'REVOKED' | 'EXPIRED' | 'NOT_ALLOWED';

/** Título y texto de cada motivo por el que la receta no abre. */
export const OPEN_FAILURE_COPY: Readonly<Record<OpenFailure, { readonly title: string; readonly body: string }>> = {
  UNKNOWN_LINK: {
    title: 'Este enlace no existe',
    body: 'Revise que la dirección esté completa o pídale al paciente que le vuelva a enviar el enlace.',
  },
  NO_PHARMACY: {
    title: 'Su organización no tiene una farmacia verificada',
    body: 'Las recetas compartidas se abren desde una farmacia verificada en AloVida.',
  },
  REVOKED: {
    title: 'El paciente dejó de compartir esta receta',
    body: 'Si la necesita, pídale al paciente que la comparta de nuevo.',
  },
  EXPIRED: {
    title: 'Esta receta venció',
    body: 'El paciente necesita una receta vigente de su médico.',
  },
  NOT_ALLOWED: {
    title: 'Esta cuenta no puede abrir recetas',
    body: 'Solo el personal de una farmacia abre las recetas que comparten los pacientes.',
  },
};

/** El estado de la pantalla y, si lo hay, el motivo con texto propio. */
export interface OpenFailureOutcome<T> {
  readonly state: ViewState<T>;
  readonly failure: OpenFailure | null;
}

const NO_PHARMACY_REASON = 'PHARMACY_INVENTORY_RESOURCE_NOT_AVAILABLE';
const REVOKED_REASON = 'PRESCRIPTION_SHARE_REVOKED';

/**
 * Traduce el fallo de `GET /pharmacy/prescription-shares/:token`.
 *
 * El 410 llega con `code` `PRECONDITION_FAILED` (la API no tiene código propio
 * para «ya no está»), que el mapeo común pintaría como «Revise lo ingresado».
 * Por eso se resuelve antes, por el estado HTTP y el `reason`, y va a S5: el
 * enlace existe y el paciente cerró el acceso (o venció). Lo demás va por el
 * mapeo común (`errorToViewState`), que ya da S6, S8 y S9 con su `requestId`.
 */
export function openFailureOf<T>(error: unknown): OpenFailureOutcome<T> {
  if (!(error instanceof HttpErrorResponse)) {
    return { state: errorToViewState<T>(error), failure: null };
  }

  const reason = reasonOf(error);
  const requestId = readApiError(error)?.correlationId;
  const withRequestId = requestId === undefined ? {} : { requestId };

  switch (error.status) {
    case 410:
      return {
        state: forbidden(withRequestId),
        failure: reason === REVOKED_REASON ? 'REVOKED' : 'EXPIRED',
      };
    case 404:
      return { state: notFound(), failure: reason === NO_PHARMACY_REASON ? 'NO_PHARMACY' : 'UNKNOWN_LINK' };
    case 403:
      return { state: errorToViewState<T>(error), failure: 'NOT_ALLOWED' };
    default:
      return { state: errorToViewState<T>(error), failure: null };
  }
}

/** El `reason` del cuerpo: arriba (estándar del repo, S-9) o en `details`. */
function reasonOf(error: HttpErrorResponse): string | null {
  const body: unknown = error.error;
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const record = body as Record<string, unknown>;
  if (typeof record['reason'] === 'string') {
    return record['reason'];
  }
  const details = record['details'];
  if (typeof details === 'object' && details !== null) {
    const nested = (details as Record<string, unknown>)['reason'];
    return typeof nested === 'string' ? nested : null;
  }
  return null;
}
