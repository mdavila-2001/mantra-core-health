import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../http/api-error';
import { errorToViewState } from '../../http/error-to-view-state';
import { forbidden, validation } from '../../view-state/view-state';
import type { ViewState, ViewStateIssue } from '../../view-state/view-state.types';
import {
  OPS_REASONS,
  type FutureCommitment,
  type OpsErrorDetail,
  type OpsReason,
} from './infrastructure-ops.types';

/**
 * Lee de un fallo de la API de operación lo que la pantalla ramifica: el
 * `reason` de F2.3, los compromisos futuros de un bloqueo, lo que le falta al
 * local de aislamiento, la transición inválida y la orden de limpieza que ya
 * estaba abierta.
 *
 * Devuelve `null` si no es un error de la API con la forma del contrato —un
 * proxy, una red caída—: quien lo reciba cae en `errorToViewState`. El `code`
 * del contrato de errores (`CONFLICT`, `PRECONDITION_FAILED`…) no se toca: es
 * lo que decide S4/S5/S6/S9.
 */
export function readOpsError(error: unknown): OpsErrorDetail | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const body = readApiError(error);
  if (body === null) return null;
  const details = body.details ?? {};
  const reason = details['reason'];
  return {
    status: error.status,
    reason:
      typeof reason === 'string' && (OPS_REASONS as readonly string[]).includes(reason) ? (reason as OpsReason) : null,
    message: body.message,
    requestId: body.correlationId,
    conflicts: listOf<FutureCommitment>(details['conflicts'], isCommitment),
    missing: stringsOf(details['missing']),
    from: typeof details['from'] === 'string' ? details['from'] : null,
    to: typeof details['to'] === 'string' ? details['to'] : null,
    requiredRoles: stringsOf(details['requiredRoles']),
    openOrderId: typeof details['openOrderId'] === 'string' ? details['openOrderId'] : null,
  };
}

const MISSING_LABEL: Readonly<Record<string, string>> = {
  AIIR: 'el local no es de aislamiento aéreo (AIIR)',
  NEGATIVE_PRESSURE: 'no tiene presión negativa',
  HVAC_VALIDATION: 'su validación de climatización venció o no existe',
  PROTECTIVE_ENV: 'el local no es un ambiente protector',
  POSITIVE_PRESSURE: 'no tiene presión positiva',
};

/** Qué dice cada rechazo de negocio, en lenguaje de quien lo lee. */
function messageOf(detail: OpsErrorDetail): { field?: string; code: string; message: string } | null {
  switch (detail.reason) {
    case 'BLOCK_REASON_REQUIRED':
      return { field: 'Motivo', code: 'reasonCode', message: 'Elija un motivo: un bloqueo sin motivo no se acepta.' };
    case 'BLOCK_REASON_TEXT_REQUIRED':
      return { field: 'Detalle', code: 'reasonText', message: 'El motivo «Otro» necesita una explicación escrita.' };
    case 'BLOCK_EXPECTED_END_REQUIRED':
      return {
        field: 'Fecha estimada',
        code: 'expectedEndAt',
        message: 'El mantenimiento necesita una fecha estimada de fin.',
      };
    case 'BLOCK_REASON_KIND_MISMATCH':
      return { field: 'Motivo', code: 'reasonCode', message: 'Ese motivo no corresponde a este tipo de bloqueo.' };
    case 'SPACE_NOT_ACTIVE':
      return { code: 'SPACE_NOT_ACTIVE', message: 'El espacio no está activo: no admite cambios operativos.' };
    case 'SPACE_OCCUPIED':
      return {
        code: 'SPACE_OCCUPIED',
        message: 'La cama está ocupada o reservada. Traslade al paciente o registre su egreso antes de bloquearla o cerrarla.',
      };
    case 'BLOCK_OVERLAP':
      return { code: 'BLOCK_OVERLAP', message: 'Ya hay un bloqueo vigente en ese tramo. Termine o cancele el anterior.' };
    case 'BLOCK_ALREADY_ENDED':
      return { code: 'BLOCK_ALREADY_ENDED', message: 'Ese bloqueo ya terminó.' };
    case 'OPS_VERSION_MISMATCH':
      return {
        code: 'OPS_VERSION_MISMATCH',
        message: 'Otra persona cambió el estado de esta cama mientras usted lo miraba. Se muestra el estado vigente; revise y repita.',
      };
    case 'CLEANING_ORDER_ALREADY_OPEN':
      return { code: 'CLEANING_ORDER_ALREADY_OPEN', message: 'Esta cama ya tiene una orden de limpieza abierta.' };
    case 'TERMINAL_CLEANING_REQUIRED':
      return {
        code: 'TERMINAL_CLEANING_REQUIRED',
        message: 'La cama exige limpieza terminal: no se puede pedir una limpieza de rutina.',
      };
    case 'CLEANING_ORDER_INVALID_TRANSITION':
      return {
        code: 'CLEANING_ORDER_INVALID_TRANSITION',
        message:
          detail.from !== null && detail.to !== null
            ? `La orden no puede pasar de «${detail.from}» a «${detail.to}». Otra persona pudo haberla movido; actualice la cola.`
            : 'Esa transición no es válida para el estado actual de la orden. Actualice la cola.',
      };
    case 'INSPECTION_REASON_REQUIRED':
      return { field: 'Motivo', code: 'reasonText', message: 'Rechazar una limpieza exige explicar qué falló.' };
    case 'INSPECTION_BY_CLEANER_NOT_ALLOWED':
      return {
        code: 'INSPECTION_BY_CLEANER_NOT_ALLOWED',
        message: 'Quien terminó la limpieza no puede inspeccionarla: la inspección la hace otra persona.',
      };
    case 'ISOLATION_ROOM_NOT_CAPABLE':
      return {
        code: 'ISOLATION_ROOM_NOT_CAPABLE',
        message:
          detail.missing.length > 0
            ? `Este local no sirve para ese aislamiento: ${detail.missing.map((m) => MISSING_LABEL[m] ?? m).join('; ')}.`
            : 'Este local no sirve para ese aislamiento.',
      };
    case 'ISOLATION_REASON_REQUIRED':
      return { field: 'Motivo', code: 'reasonText', message: 'Un aislamiento exige explicar el motivo clínico.' };
    default:
      return null;
  }
}

/**
 * Traduce un fallo de la operación a un estado M34.
 *
 * - Las reglas de negocio con `reason` conocido salen como S4 con **su** frase
 *   y el campo al que se anclan (`code` = clave del campo del formulario).
 * - 403 → S5 con los roles que sí podrían, si la API los dice; 404 → S6 sin
 *   datos; sin red → S8; lo demás por `errorToViewState`.
 * - 412 se lee como S4 de concurrencia: la causa es `OPS_VERSION_MISMATCH` (o el
 *   `If-Match` de la orden) y se resuelve releyendo.
 */
export function opsErrorToViewState<T>(error: unknown): ViewState<T> {
  const detail = readOpsError(error);
  if (detail === null) return errorToViewState<T>(error);

  if (detail.status === 403) {
    const roles = detail.requiredRoles.length > 0 ? ` Roles que pueden hacerlo: ${detail.requiredRoles.join(', ')}.` : '';
    return forbidden({
      message: `Su rol no permite esta acción sobre este espacio.${roles}`,
      ...(detail.requestId === undefined ? {} : { requestId: detail.requestId }),
    });
  }

  const known = messageOf(detail);
  if (known !== null) {
    const issue: ViewStateIssue = {
      code: known.code,
      message: known.message,
      ...(known.field === undefined ? {} : { field: known.field }),
    };
    return validation([issue], undefined, detail.requestId);
  }

  if (detail.status === 412) {
    return validation(
      [
        {
          code: 'OPS_VERSION_MISMATCH',
          message: 'Otra persona cambió este dato mientras usted lo miraba. Actualice para ver la versión vigente.',
        },
      ],
      undefined,
      detail.requestId,
    );
  }
  return errorToViewState<T>(error);
}

function listOf<T>(value: unknown, guard: (item: unknown) => item is T): readonly T[] {
  return Array.isArray(value) ? value.filter(guard) : [];
}

function stringsOf(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCommitment(value: unknown): value is FutureCommitment {
  return (
    isRecord(value) &&
    typeof value['kind'] === 'string' &&
    typeof value['id'] === 'string' &&
    typeof value['startsAt'] === 'string' &&
    typeof value['nextAction'] === 'string'
  );
}
