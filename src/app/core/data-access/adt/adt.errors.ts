import { HttpErrorResponse } from '@angular/common/http';

import { readApiError } from '../../http/api-error';
import { errorToViewState } from '../../http/error-to-view-state';
import { validation } from '../../view-state/view-state';
import type { ViewState } from '../../view-state/view-state.types';
import {
  ADT_REASONS,
  COMPATIBILITY_RULES,
  type AdtErrorDetail,
  type AdtReason,
  type CompatibilityViolation,
} from './adt.types';

/**
 * Lee de un fallo de la API lo que ADT ramifica: el `reason` del contrato, la
 * lista de violaciones de compatibilidad y los roles que exigía la acción.
 * Devuelve `null` si no es un error con la forma del contrato.
 */
export function readAdtError(error: unknown): AdtErrorDetail | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const body = readApiError(error);
  if (body === null) return null;
  const details = body.details ?? {};
  const reason = details['reason'];
  return {
    status: error.status,
    reason: typeof reason === 'string' && (ADT_REASONS as readonly string[]).includes(reason) ? (reason as AdtReason) : null,
    message: body.message,
    requestId: body.correlationId,
    violations: violationsOf(details['violations']),
    requiredRoles: Array.isArray(details['requiredRoles'])
      ? (details['requiredRoles'] as unknown[]).filter((x): x is string => typeof x === 'string')
      : [],
  };
}

function violationsOf(value: unknown): readonly CompatibilityViolation[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is CompatibilityViolation =>
      typeof v === 'object' &&
      v !== null &&
      (COMPATIBILITY_RULES as readonly string[]).includes((v as { rule?: string }).rule ?? '') &&
      typeof (v as { detail?: unknown }).detail === 'string',
  );
}

const MENSAJES: Readonly<Partial<Record<AdtReason, string>>> = {
  PATIENT_ALREADY_ADMITTED: 'Esta persona ya tiene una internación en curso. Abra su ficha de internación en lugar de ingresarla otra vez.',
  BED_NOT_ASSIGNABLE: 'La cama ya no se puede asignar. Elija otra: el tablero cambió mientras decidía.',
  BED_DOUBLE_OCCUPANCY: 'Otra persona ocupó esta cama un instante antes. No se cambió nada: elija otra cama.',
  BED_COMPATIBILITY_OVERRIDE_REQUIRED: 'La cama no es compatible. Solo supervisión de enfermería puede forzarla, con una justificación.',
  OVERRIDE_JUSTIFICATION_TOO_SHORT: 'La justificación debe tener al menos 20 caracteres.',
  OVERRIDE_RULE_NOT_OVERRIDABLE: 'Esa regla no se puede forzar.',
  SPACE_NOT_A_BED: 'El espacio elegido no es una cama.',
  ENCOUNTER_ALREADY_HAS_BED: 'La internación ya tiene cama. Para moverla use «Trasladar».',
  ENCOUNTER_HAS_NO_BED: 'La internación no tiene cama: primero asigne una.',
  TRANSFER_TO_SAME_BED: 'El destino es la misma cama que ocupa hoy.',
  OCCURRED_AT_IN_FUTURE: 'La hora del movimiento no puede ser futura.',
  OCCURRED_AT_BEFORE_CURRENT_START: 'La hora del movimiento es anterior al inicio de la ubicación actual.',
  SWAP_REQUIRES_TWO_OCCUPIED_BEDS: 'Un intercambio necesita dos camas ocupadas, cada una con su paciente.',
  SWAP_SAME_ENCOUNTER: 'Eligió dos veces a la misma persona.',
  ENCOUNTER_NOT_IN_PROGRESS: 'La internación ya no está en curso.',
  DISCHARGE_DISPOSITION_REQUIRED: 'Indique cómo egresa la persona.',
  PREVIOUS_BED_NO_LONGER_AVAILABLE: 'La cama anterior ya no está libre: no se puede deshacer el traslado.',
  ADT_CANCEL_WINDOW_EXPIRED: 'Pasó el plazo para cancelar este movimiento.',
  LOCATION_NOT_CANCELLABLE: 'Este movimiento no se puede cancelar.',
  CENSUS_ALREADY_CLOSED: 'Ese censo ya estaba cerrado. Un censo cerrado no se cierra de nuevo ni se edita: se ajusta.',
  CENSUS_DATE_NOT_ENDED: 'El día todavía no terminó: el censo se cierra pasada la medianoche.',
  CENSUS_NOT_CLOSED: 'Solo un censo cerrado admite ajustes.',
  ADJUSTMENT_REASON_REQUIRED: 'El ajuste necesita un motivo.',
  ADJUSTMENT_FIELD_INVALID: 'Ese dato del censo no se puede ajustar.',
  INDICATOR_RANGE_TOO_LONG: 'El período no puede superar 366 días.',
  BED_ASSIGNMENT_REQUIRES_ADT: 'Las camas solo se ocupan desde Internación.',
};

/** Mensaje en castellano de un `reason`; `null` si no hay uno propio. */
export function adtMessage(reason: AdtReason | null): string | null {
  return reason === null ? null : (MENSAJES[reason] ?? null);
}

/**
 * Traduce un fallo a un estado M34. Los rechazos del contrato (409/422) pasan a
 * S4 con el texto del `reason`; 403/404/0/5xx siguen por `errorToViewState`
 * (S5, S6, S8, S9). Un 412 es S4 con «recargue».
 */
export function adtErrorToViewState<T>(error: unknown): ViewState<T> {
  const d = readAdtError(error);
  if (d === null) return errorToViewState<T>(error);
  if (d.status === 412) {
    return validation(
      [{ code: 'CONCURRENCY_CONFLICT', message: 'Otra persona cambió esta internación mientras la miraba. Recargue para ver la versión vigente.' }],
      undefined,
      d.requestId,
    );
  }
  const propio = adtMessage(d.reason);
  if (propio !== null && (d.status === 409 || d.status === 422)) {
    return validation([{ code: d.reason ?? undefined, message: propio }], undefined, d.requestId);
  }
  return errorToViewState<T>(error);
}
