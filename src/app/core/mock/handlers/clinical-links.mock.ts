import { conditionList, encounterList } from '../fixtures/clinic';
import { reply, validation, type MockReply } from '../mock-router';

/* ============================================================================
    Los tres vínculos nuevos de la red clínica (patch v4291) y sus reglas,
    como las aplica la API (contrato del 06/11/2026):

    - `reasonConditionId` de la orden de estudio,
    - `replacedByConditionId` del diagnóstico descartado,
    - `targetEncounterId` de la derivación.

    Las tres comparten la regla principal: lo vinculado tiene que existir y ser
    **de la misma persona**. Una violación es 422 con su `reason`, con la forma
    del filtro global de la API; un valor que no es texto es 400, como lo
    rechazaría el `ValidationPipe`. Los `reason` son los de la API (commit
    13d2c494, `ClinicalErrorReason`): un `PreconditionFailedException` con el
    campo en `details.field`, que el front usa para marcar el control.
    ========================================================================== */

/** El resultado de revisar un vínculo: su valor (ausente si no vino) o el rechazo. */
export type LinkCheck = { readonly value?: string } | { readonly rejection: MockReply };

export function isRejection(check: LinkCheck): check is { readonly rejection: MockReply } {
  return 'rejection' in check;
}

function linkRejection(reason: string, message: string, field: string): LinkCheck {
  return {
    rejection: reply(422, {
      statusCode: 422,
      code: 'PRECONDITION_FAILED',
      error: 'Unprocessable Entity',
      message,
      reason,
      details: { field, reason },
    }),
  };
}

/** Ausente o `null` es «sin vínculo»; cualquier otra cosa que no sea texto, 400. */
function rawId(raw: unknown, field: string): LinkCheck | string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { rejection: validation(`${field} debe ser un uuid.`, [{ field, message: 'Debe ser un uuid.' }]) };
  }
  return raw;
}

/**
 * Mismo custodio (API fbf18626): otro tenant responde igual que un id
 * inexistente. Las filas sembradas no declaran custodio y no se filtran.
 */
function sameCustodian(a: string | undefined, b: string | undefined): boolean {
  return a === undefined || b === undefined || a === b;
}

/** El diagnóstico para el que se pide una orden: de la misma persona y del mismo custodio. */
export function checkReasonCondition(
  raw: unknown,
  patientProfileId: string,
  custodianTenantId?: string,
): LinkCheck {
  const value = rawId(raw, 'reasonConditionId');
  if (value === undefined) return {};
  if (typeof value !== 'string') return value;
  const condition = conditionList.get(value);
  if (
    condition === undefined ||
    condition.patientProfileId !== patientProfileId ||
    !sameCustodian(condition.custodianTenantId, custodianTenantId)
  ) {
    return linkRejection(
      'SERVICE_REQUEST_REASON_CONDITION_INVALID',
      'El diagnóstico indicado no existe o no es de esta persona.',
      'reasonConditionId',
    );
  }
  return { value };
}

/**
 * El diagnóstico que reemplaza al que se rechaza: sólo al descartar
 * (`REFUTED`), distinto del rechazado y de la misma persona.
 */
export function checkReplacedByCondition(
  raw: unknown,
  refuted: { readonly id: string; readonly patientProfileId: string; readonly custodianTenantId?: string },
  outcome: 'CONFIRMED' | 'REFUTED',
): LinkCheck {
  const value = rawId(raw, 'replacedByConditionId');
  if (value === undefined) return {};
  if (typeof value !== 'string') return value;
  if (outcome !== 'REFUTED') {
    return linkRejection(
      'CONDITION_REPLACEMENT_REQUIRES_REFUTED',
      'Sólo un diagnóstico descartado puede indicar cuál se confirmó en su lugar.',
      'replacedByConditionId',
    );
  }
  if (value === refuted.id) {
    return linkRejection(
      'CONDITION_REPLACEMENT_SELF',
      'Un diagnóstico no puede reemplazarse a sí mismo.',
      'replacedByConditionId',
    );
  }
  const replacement = conditionList.get(value);
  if (
    replacement === undefined ||
    replacement.patientProfileId !== refuted.patientProfileId ||
    !sameCustodian(replacement.custodianTenantId, refuted.custodianTenantId)
  ) {
    return linkRejection(
      'CONDITION_REPLACEMENT_INVALID',
      'El diagnóstico indicado no existe o no es de esta persona.',
      'replacedByConditionId',
    );
  }
  return { value };
}

/** La atención del destino en la que se recibió a la persona: de la misma persona. */
export function checkTargetEncounter(raw: unknown, patientProfileId: string): LinkCheck {
  const value = rawId(raw, 'targetEncounterId');
  if (value === undefined) return {};
  if (typeof value !== 'string') return value;
  const encounter = encounterList.get(value);
  if (encounter === undefined || encounter.patientProfileId !== patientProfileId) {
    return linkRejection(
      'REFERRAL_TARGET_ENCOUNTER_INVALID',
      'La atención indicada no existe o no es de esta persona.',
      'targetEncounterId',
    );
  }
  return { value };
}
