import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../http/api-error';
import { errorToViewState } from '../../http/error-to-view-state';
import { validation } from '../../view-state/view-state';
import type { ViewState, ViewStateIssue } from '../../view-state/view-state.types';
import {
  INFRASTRUCTURE_REASONS,
  type InfrastructureErrorDetail,
  type InfrastructureReason,
  type RetireBlocker,
  type TypologyConflict,
} from './infrastructure.types';

/**
 * Lee de un fallo de la API lo que la infraestructura ramifica: el `reason` del
 * §3 (`SPACE_CODE_TAKEN`, `SPACE_RETIRE_BLOCKED`…), la lista de bloqueos de una
 * clausura y la de espacios que rompen una tipología.
 *
 * Devuelve `null` si no es un error de la API con la forma del contrato —un
 * proxy, una red caída—: quien lo reciba cae en `errorToViewState`, que ya sabe
 * qué hacer con eso. El `code` del contrato de errores (`CONFLICT`,
 * `PRECONDITION_FAILED`…) no se toca: sigue siendo lo que decide S4/S5/S6/S9.
 */
export function readInfrastructureError(error: unknown): InfrastructureErrorDetail | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const body = readApiError(error);
  if (body === null) return null;
  const details = body.details ?? {};
  const reason = details['reason'];
  return {
    status: error.status,
    reason:
      typeof reason === 'string' && (INFRASTRUCTURE_REASONS as readonly string[]).includes(reason)
        ? (reason as InfrastructureReason)
        : null,
    message: body.message,
    requestId: body.correlationId,
    blockers: listOf<RetireBlocker>(details['blockers'], esBloqueo),
    conflicts: listOf<TypologyConflict>(details['conflicts'], esConflicto),
  };
}

/**
 * Traduce un fallo a un estado M34, anclando a un campo los `reason` que son de
 * un campo (`SPACE_CODE_TAKEN` → `code`, `SPACE_IMMUTABLE_FIELD` → `code`).
 *
 * El resto va por `errorToViewState` sin cambios: 403 → S5, 404 → S6 (sin datos
 * del recurso), sin red → S8, lo demás → S4 o S9 con su `requestId`.
 */
export function infrastructureErrorToViewState<T>(error: unknown): ViewState<T> {
  const detalle = readInfrastructureError(error);
  if (detalle?.reason === 'SPACE_CODE_TAKEN') {
    return validation(
      [
        {
          field: 'code',
          code: 'SPACE_CODE_TAKEN',
          message:
            'Ese código ya se usó en este establecimiento. Un código no se reutiliza, ni siquiera el de un espacio clausurado.',
        },
      ],
      undefined,
      detalle.requestId,
    );
  }
  if (detalle?.reason === 'SPACE_IMMUTABLE_FIELD') {
    return validation(
      [
        {
          field: 'code',
          code: 'SPACE_IMMUTABLE_FIELD',
          message:
            'El código y la forma no se pueden cambiar cuando el espacio está activo. Para renombrarlo, cambie el nombre.',
        },
      ],
      undefined,
      detalle.requestId,
    );
  }
  if (detalle?.status === 412) {
    const issue: ViewStateIssue = {
      code: 'CONCURRENCY_CONFLICT',
      message: 'Otra persona cambió este dato mientras lo editaba. Recargue para ver la versión vigente.',
    };
    return validation([issue], undefined, detalle.requestId);
  }
  return errorToViewState<T>(error);
}

function listOf<T>(value: unknown, guard: (item: unknown) => item is T): readonly T[] {
  return Array.isArray(value) ? value.filter(guard) : [];
}

function esRegistro(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function esBloqueo(value: unknown): value is RetireBlocker {
  return (
    esRegistro(value) &&
    typeof value['kind'] === 'string' &&
    typeof value['count'] === 'number' &&
    typeof value['nextAction'] === 'string' &&
    Array.isArray(value['sampleIds'])
  );
}

function esConflicto(value: unknown): value is TypologyConflict {
  return esRegistro(value) && typeof value['spaceId'] === 'string' && typeof value['code'] === 'string';
}
