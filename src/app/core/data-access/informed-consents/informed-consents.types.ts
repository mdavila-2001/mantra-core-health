/* ============================================================================
    El consentimiento informado DIRIGIDO: a qué se consiente, quién lo otorga,
    qué se le explicó y si sigue vigente.

    Antes vivía colgado sólo de la consulta y de un código de procedimiento, y
    en la pantalla era nada más que la ficha transversal genérica. La persona
    no consiente «una consulta»: consiente **esta receta**, **este estudio**,
    **esta derivación**, **este procedimiento** o **este plan de cuidados**.
    Por eso cada consentimiento nuevo nombra su objeto (`targetType` +
    `targetId`) y guarda una instantánea legible de lo consentido
    (`targetLabel`), que es lo que se lee cuando el objeto cambió o se anuló.

    Los elementos que pide la norma boliviana —Ley 3131 art. 12 y su
    reglamento DS 28562; CPE art. 44— y los que la práctica regional exige
    (riesgos personalizados, alternativas, consecuencias de no aceptar,
    revocabilidad, profesional que informa) están acá como campos, no como
    texto libre de un solo bloque.
   ========================================================================== */

/** A qué se consiente. Coincide con el CHECK de `consent.treatment_informed_consents.target_type`. */
export const INFORMED_CONSENT_TARGET_TYPES = [
  'MEDICATION_REQUEST',
  'SERVICE_REQUEST',
  'REFERRAL',
  'PROCEDURE',
  'CARE_PLAN',
] as const;
export type InformedConsentTargetType = (typeof INFORMED_CONSENT_TARGET_TYPES)[number];

/** Quién otorga el consentimiento. El titular, o alguien legalmente autorizado. */
export const INFORMED_CONSENT_GRANTORS = [
  'PATIENT',
  'LEGAL_REPRESENTATIVE',
  'GUARDIAN',
  'SUBSTITUTE_RELATIVE',
] as const;
export type InformedConsentGrantor = (typeof INFORMED_CONSENT_GRANTORS)[number];

/** Por dónde se informó y se obtuvo. */
export const INFORMED_CONSENT_CHANNELS = ['IN_PERSON', 'TELEHEALTH'] as const;
export type InformedConsentChannel = (typeof INFORMED_CONSENT_CHANNELS)[number];

/**
 * Las excepciones legales al consentimiento previo.
 *
 * La CPE art. 44 exceptúa el «peligro inminente de su vida»; las otras dos son
 * las que reconoce la práctica regional (riesgo para la salud pública,
 * renuncia expresa del paciente a ser informado). Una excepción **no** es un
 * consentimiento: exige su justificación escrita.
 */
export const INFORMED_CONSENT_EXCEPTIONS = [
  'EMERGENCY',
  'PUBLIC_HEALTH_RISK',
  'PATIENT_WAIVER',
] as const;
export type InformedConsentException = (typeof INFORMED_CONSENT_EXCEPTIONS)[number];

/** La decisión de la persona. Rechazar también se registra: es el disentimiento. */
export type InformedConsentDecision = 'ACCEPTED' | 'DECLINED';

/** Derivado por el servidor: un consentimiento revocado deja de valer. */
export type InformedConsentStatus = 'ACTIVE' | 'WITHDRAWN';

/** Si el consentimiento ya tiene su firma (evidencia) registrada. */
export type InformedConsentSignatureStatus = 'SIGNED' | 'PENDING';

/** Una evidencia del consentimiento: documento firmado escaneado, firma electrónica… */
export interface InformedConsentEvidence {
  readonly id: string;
  readonly evidenceTypeConceptId: string | null;
  readonly capturedChannelConceptId: string | null;
  readonly recordedAt: Date;
}

/** Lo que hace falta para registrar un consentimiento (`POST /consent/treatment-informed-consents`). */
export interface CreateInformedConsentInput {
  readonly patientProfileId: string;
  /** Requerido por el contrato: el consentimiento se obtiene dentro de una atención. */
  readonly encounterId: string;
  readonly decision: InformedConsentDecision;
  /** Va junto con `targetId`: los dos o ninguno. */
  readonly targetType?: InformedConsentTargetType;
  readonly targetId?: string;
  readonly targetLabel?: string;
  readonly diagnosisText?: string;
  /** Naturaleza y objetivo. Obligatorio con objeto y sin excepción. */
  readonly purposeText?: string;
  /** Obligatorio con objeto y sin excepción. */
  readonly benefitsText?: string;
  /** Riesgos frecuentes y graves. Obligatorio con objeto y sin excepción. */
  readonly risksText?: string;
  readonly personalizedRisksText?: string;
  readonly alternativesText?: string;
  readonly refusalConsequencesText?: string;
  readonly patientQuestionsText?: string;
  readonly grantedBy?: InformedConsentGrantor;
  /** Obligatorio si `grantedBy` no es `PATIENT`. */
  readonly representativeName?: string;
  readonly representativeDocument?: string;
  /** Obligatorio si `grantedBy` no es `PATIENT`. */
  readonly representativeRelationship?: string;
  readonly incapacityReason?: string;
  readonly informedByProfileId?: string;
  readonly channel?: InformedConsentChannel;
  readonly exceptionType?: InformedConsentException;
  /** Obligatorio si hay `exceptionType`. */
  readonly exceptionJustification?: string;
  /** Testigo que no es usuario de la plataforma (un familiar), §4.1. */
  readonly witnessName?: string;
  readonly witnessDocument?: string;
  /** Idioma en que se brindó la información (CPE: 36 idiomas oficiales). */
  readonly informationLanguage?: string;
  /** Asentimiento de la persona representada. Obligatorio (sí o no) si otorga un representante. */
  readonly assentObtained?: boolean;
  readonly assentNotes?: string;
  /** Constancia de que se informó el derecho a revocar. `true` para aceptar con objeto, salvo urgencia. */
  readonly revocationRightInformed?: boolean;
}

/** Un consentimiento tal como lo devuelve el servidor, con los instantes ya como `Date`. */
export interface InformedConsent {
  readonly id: string;
  readonly patientProfileId: string;
  readonly encounterId: string | null;
  readonly targetType: InformedConsentTargetType | null;
  readonly targetId: string | null;
  readonly targetLabel: string | null;
  readonly decision: InformedConsentDecision;
  readonly status: InformedConsentStatus;
  readonly diagnosisText: string | null;
  readonly purposeText: string | null;
  readonly benefitsText: string | null;
  readonly risksText: string | null;
  readonly personalizedRisksText: string | null;
  readonly alternativesText: string | null;
  readonly refusalConsequencesText: string | null;
  readonly patientQuestionsText: string | null;
  readonly grantedBy: InformedConsentGrantor | null;
  readonly representativeName: string | null;
  readonly representativeDocument: string | null;
  readonly representativeRelationship: string | null;
  readonly incapacityReason: string | null;
  readonly informedByProfileId: string | null;
  readonly channel: InformedConsentChannel | null;
  readonly exceptionType: InformedConsentException | null;
  readonly exceptionJustification: string | null;
  readonly withdrawalReason: string | null;
  readonly witnessName: string | null;
  readonly witnessDocument: string | null;
  readonly informationLanguage: string | null;
  readonly assentObtained: boolean | null;
  readonly assentNotes: string | null;
  readonly revocationRightInformed: boolean | null;
  /** Cuándo se informó a posteriori, tras una excepción por urgencia. */
  readonly postEmergencyInformedAt: Date | null;
  /** La firma y demás evidencia, leída de `consent.consent_evidence`. */
  readonly evidence: readonly InformedConsentEvidence[];
  /** Derivado: `SIGNED` si hay al menos una evidencia de firma. */
  readonly signatureStatus: InformedConsentSignatureStatus;
  readonly signedAt: Date | null;
  readonly withdrawnAt: Date | null;
  readonly createdAt: Date;
}

/** Filtros de la lista (`GET /consent/treatment-informed-consents`). */
export interface InformedConsentFilter {
  readonly patientProfileId: string;
  readonly targetType?: InformedConsentTargetType;
  readonly targetId?: string;
}

/**
 * Por qué un registro sería rechazado, con el mismo `reason` que devuelve la
 * API en su 400. La pantalla valida igual que el servidor para señalar el
 * campo antes de enviar; el servidor sigue siendo la autoridad.
 */
export type InformedConsentRuleViolation =
  | 'TARGET_PAIR_INCOMPLETE'
  | 'PURPOSE_REQUIRED'
  | 'BENEFITS_REQUIRED'
  | 'RISKS_REQUIRED'
  | 'EXCEPTION_JUSTIFICATION_REQUIRED'
  | 'REPRESENTATIVE_NAME_REQUIRED'
  | 'REPRESENTATIVE_RELATIONSHIP_REQUIRED'
  | 'ASSENT_REQUIRED'
  | 'REVOCATION_RIGHT_REQUIRED';

/**
 * Las reglas del contrato §2 y de la enmienda 1 §4.2, en una función pura que comparten el panel y
 * el simulador. Devuelve las violaciones en el orden del formulario.
 */
export function violacionesDelConsentimiento(
  input: Partial<CreateInformedConsentInput>,
): InformedConsentRuleViolation[] {
  const violaciones: InformedConsentRuleViolation[] = [];
  const lleno = (valor: string | undefined): boolean => (valor ?? '').trim() !== '';
  const conTipo = input.targetType !== undefined;
  const conId = lleno(input.targetId);
  if (conTipo !== conId) violaciones.push('TARGET_PAIR_INCOMPLETE');

  if (input.exceptionType === undefined) {
    if (conTipo) {
      if (!lleno(input.purposeText)) violaciones.push('PURPOSE_REQUIRED');
      if (!lleno(input.benefitsText)) violaciones.push('BENEFITS_REQUIRED');
      if (!lleno(input.risksText)) violaciones.push('RISKS_REQUIRED');
    }
  } else if (!lleno(input.exceptionJustification)) {
    violaciones.push('EXCEPTION_JUSTIFICATION_REQUIRED');
  }

  if (input.grantedBy !== undefined && input.grantedBy !== 'PATIENT') {
    if (!lleno(input.representativeName)) violaciones.push('REPRESENTATIVE_NAME_REQUIRED');
    if (!lleno(input.representativeRelationship)) {
      violaciones.push('REPRESENTATIVE_RELATIONSHIP_REQUIRED');
    }
    // Enmienda 1 §4.2: con representante, el asentimiento se declara (sí o
    // no); omitirlo es no haberlo preguntado.
    if (input.assentObtained === undefined) violaciones.push('ASSENT_REQUIRED');
  }

  // Enmienda 1 §4.2: aceptar algo concreto exige constancia de que se informó
  // que se puede revocar, salvo la urgencia (no hubo con quién conversarlo).
  if (
    input.decision === 'ACCEPTED' &&
    conTipo &&
    input.exceptionType !== 'EMERGENCY' &&
    input.revocationRightInformed !== true
  ) {
    violaciones.push('REVOCATION_RIGHT_REQUIRED');
  }
  return violaciones;
}

/**
 * El consentimiento que hoy decide sobre un objeto: el más reciente.
 *
 * La lista llega «más reciente primero», pero no se confía en el orden: dos
 * escrituras del mismo segundo y un simulador que ordena distinto bastan para
 * pintar un estado viejo.
 */
export function vigenteDe(
  consentimientos: readonly InformedConsent[],
  targetType: InformedConsentTargetType,
  targetId: string,
): InformedConsent | null {
  let vigente: InformedConsent | null = null;
  for (const c of consentimientos) {
    if (c.targetType !== targetType || c.targetId !== targetId) continue;
    if (vigente === null || c.createdAt.getTime() > vigente.createdAt.getTime()) vigente = c;
  }
  return vigente;
}

/**
 * El `reason` estable con que la API rechaza cada regla (400,
 * `ConsentErrorReason` en `consent.error-reasons.ts`).
 */
export const RAZON_DE_LA_API: Readonly<Record<InformedConsentRuleViolation, string>> = {
  TARGET_PAIR_INCOMPLETE: 'INFORMED_CONSENT_TARGET_INCOMPLETE',
  PURPOSE_REQUIRED: 'INFORMED_CONSENT_INFORMATION_INCOMPLETE',
  BENEFITS_REQUIRED: 'INFORMED_CONSENT_INFORMATION_INCOMPLETE',
  RISKS_REQUIRED: 'INFORMED_CONSENT_INFORMATION_INCOMPLETE',
  EXCEPTION_JUSTIFICATION_REQUIRED: 'INFORMED_CONSENT_EXCEPTION_UNJUSTIFIED',
  REPRESENTATIVE_NAME_REQUIRED: 'INFORMED_CONSENT_REPRESENTATIVE_INCOMPLETE',
  REPRESENTATIVE_RELATIONSHIP_REQUIRED: 'INFORMED_CONSENT_REPRESENTATIVE_INCOMPLETE',
  ASSENT_REQUIRED: 'INFORMED_CONSENT_ASSENT_REQUIRED',
  REVOCATION_RIGHT_REQUIRED: 'INFORMED_CONSENT_REVOCATION_RIGHT_NOT_INFORMED',
};

/** El campo del DTO que la API nombra en `details.fields` para cada regla. */
export const CAMPO_DE_LA_API: Readonly<Record<InformedConsentRuleViolation, string>> = {
  TARGET_PAIR_INCOMPLETE: 'targetId',
  PURPOSE_REQUIRED: 'purposeText',
  BENEFITS_REQUIRED: 'benefitsText',
  RISKS_REQUIRED: 'risksText',
  EXCEPTION_JUSTIFICATION_REQUIRED: 'exceptionJustification',
  REPRESENTATIVE_NAME_REQUIRED: 'representativeName',
  REPRESENTATIVE_RELATIONSHIP_REQUIRED: 'representativeRelationship',
  ASSENT_REQUIRED: 'assentObtained',
  REVOCATION_RIGHT_REQUIRED: 'revocationRightInformed',
};

/**
 * De un 400 de la API (`details.fields`) a las reglas de la pantalla, para
 * señalar cada campo con su mensaje en vez de un aviso genérico.
 */
export function violacionesDeLosCampos(fields: readonly string[]): InformedConsentRuleViolation[] {
  return (Object.keys(CAMPO_DE_LA_API) as InformedConsentRuleViolation[]).filter((regla) =>
    fields.includes(CAMPO_DE_LA_API[regla]),
  );
}
