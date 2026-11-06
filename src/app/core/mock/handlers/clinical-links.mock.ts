import { conditionList, encounterList } from '../fixtures/clinic';
import { reply, validation, type MockReply } from '../mock-router';

/* ============================================================================
    The clinical network's three new links (patch v4291) and their rules, as
    the API applies them (contract of 06/11/2026):

    - the study order's `reasonConditionId`,
    - the ruled-out diagnosis' `replacedByConditionId`,
    - the referral's `targetEncounterId`.

    All three share the main rule: what is linked must exist and belong **to
    the same person**. A violation is a 422 with its `reason`, shaped like the
    API's global filter; a non-text value is a 400, as the `ValidationPipe`
    would reject it. The `reason`s are the API's (commit 13d2c494,
    `ClinicalErrorReason`): a `PreconditionFailedException` with the field in
    `details.field`, which the front uses to mark the control.
    ========================================================================== */

/** The result of checking a link: its value (absent if it did not come) or the rejection. */
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

/** Absent or `null` is «no link»; anything else that is not text, 400. */
function rawId(raw: unknown, field: string): LinkCheck | string | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'string' || raw.trim() === '') {
    return { rejection: validation(`${field} debe ser un uuid.`, [{ field, message: 'Debe ser un uuid.' }]) };
  }
  return raw;
}

/**
 * Same custodian (API fbf18626): another tenant answers like a missing id.
 * The seeded rows declare no custodian and are not filtered.
 */
function sameCustodian(a: string | undefined, b: string | undefined): boolean {
  return a === undefined || b === undefined || a === b;
}

/** The diagnosis an order is requested for: same person and same custodian. */
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
 * The diagnosis replacing the rejected one: only when ruling out (`REFUTED`),
 * different from the rejected one and of the same person.
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

/** The destination's encounter where the person was received: of the same person. */
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
