/* ============================================================================
    Validating a new referral before sending it: each problem tied to the field
    that fixes it (`referrals.types.ts` holds the contract).
    ========================================================================== */

import { REFERRAL_LIMITS, type NewReferral } from './referrals.types';

/** Un problema de validación, atado al campo que lo corrige. */
export interface ReferralIssue {
  readonly field:
    | 'target'
    | 'targetExternalName'
    | 'targetExternalContact'
    | 'requestedServiceText'
    | 'clinicalSummary'
    | 'diagnosisText'
    | 'treatmentGivenText'
    | 'validUntil';
  readonly message: string;
}

/**
 * Las mismas reglas que aplica la API (`assertTypedReferralRules`, v4266), en
 * el orden del formulario.
 *
 * No reemplazan a la API —que vuelve a validar y es la que decide—: evitan
 * mandar algo que se sabe que va a volver rechazado y dicen **qué** corregir
 * junto al campo, en vez de un 400 que no señala ninguno.
 *
 * Con un servicio del catálogo del destino (`targetServiceCatalogId`) el
 * servicio ya está identificado y la API no exige ni el texto del servicio ni
 * el resumen clínico; sin él, los dos.
 *
 * @param input - Lo cargado, ya recortado.
 * @param today - El día de referencia para la vigencia (inyectable en pruebas).
 * @returns Los problemas, vacío si se puede emitir.
 */
export function referralIssues(input: Partial<NewReferral>, today: Date = new Date()): readonly ReferralIssue[] {
  const issues: ReferralIssue[] = [];
  const filled = (v: string | undefined): boolean => v !== undefined && v.trim() !== '';
  const tooLong = (v: string | undefined, max: number): boolean => (v ?? '').length > max;

  if (
    !filled(input.targetProfileId) &&
    !filled(input.targetTenantId) &&
    !filled(input.targetBranchId) &&
    !filled(input.targetExternalName)
  ) {
    issues.push({
      field: 'target',
      message: 'Indique a quién deriva: un profesional, una organización o un destino externo.',
    });
  }
  if (tooLong(input.targetExternalName, REFERRAL_LIMITS.targetExternalName)) {
    issues.push({
      field: 'targetExternalName',
      message: `El nombre del destino admite hasta ${REFERRAL_LIMITS.targetExternalName} caracteres.`,
    });
  }
  if (tooLong(input.targetExternalContact, REFERRAL_LIMITS.targetExternalContact)) {
    issues.push({
      field: 'targetExternalContact',
      message: `El contacto admite hasta ${REFERRAL_LIMITS.targetExternalContact} caracteres.`,
    });
  }

  const describedByHand = input.referralType !== undefined && !filled(input.targetServiceCatalogId);
  if (describedByHand && !filled(input.requestedServiceText)) {
    issues.push({
      field: 'requestedServiceText',
      message: 'Escriba qué servicio pide, por ejemplo «Fisioterapia de rodilla, 10 sesiones», o elija uno del destino.',
    });
  } else if (tooLong(input.requestedServiceText, REFERRAL_LIMITS.requestedServiceText)) {
    issues.push({
      field: 'requestedServiceText',
      message: `El servicio pedido admite hasta ${REFERRAL_LIMITS.requestedServiceText} caracteres.`,
    });
  }
  if (describedByHand && !filled(input.clinicalSummary)) {
    issues.push({
      field: 'clinicalSummary',
      message: 'Escriba el resumen clínico: la norma de referencia lo exige para que el destino sepa a quién recibe.',
    });
  } else if (tooLong(input.clinicalSummary, REFERRAL_LIMITS.clinicalSummary)) {
    issues.push({
      field: 'clinicalSummary',
      message: `El resumen clínico admite hasta ${REFERRAL_LIMITS.clinicalSummary} caracteres.`,
    });
  }
  if (tooLong(input.diagnosisText, REFERRAL_LIMITS.diagnosisText)) {
    issues.push({
      field: 'diagnosisText',
      message: `El diagnóstico admite hasta ${REFERRAL_LIMITS.diagnosisText} caracteres.`,
    });
  }
  if (tooLong(input.treatmentGivenText, REFERRAL_LIMITS.treatmentGivenText)) {
    issues.push({
      field: 'treatmentGivenText',
      message: `El tratamiento realizado admite hasta ${REFERRAL_LIMITS.treatmentGivenText} caracteres.`,
    });
  }
  if (input.validUntil !== undefined) {
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (input.validUntil < startOfToday) {
      issues.push({ field: 'validUntil', message: 'La vigencia no puede terminar antes de hoy.' });
    }
  }
  return issues;
}
