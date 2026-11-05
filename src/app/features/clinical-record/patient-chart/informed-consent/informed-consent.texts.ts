import type {
  InformedConsent,
  InformedConsentChannel,
  InformedConsentException,
  InformedConsentGrantor,
  InformedConsentRuleViolation,
  InformedConsentTargetType,
} from '../../../../core/data-access/informed-consents/informed-consents.types';
import type { BadgeVariant } from '../../../../shared/components/atoms/badge/badge.types';

/* ============================================================================
    Las palabras del consentimiento, en un solo lugar.

    Etiquetas en vocabulario clínico (las lee quien atiende); la cita legal va
    en la ayuda, nunca en la etiqueta. Las citas son cortas y salen de
    `NORMATIVA_RESUMEN` (2026-10-28): la única literal es la CPE art. 44; las
    demás son paráfrasis y por eso no llevan comillas.
   ========================================================================== */

/** CPE 2009, art. 44.I — cita literal. */
export const CPE_44_QUOTE =
  'CPE, art. 44.I: «Ninguna persona será sometida a intervención quirúrgica, examen médico o de laboratorio sin su consentimiento o el de terceros legalmente autorizados, salvo peligro inminente de su vida.»';

/** Ley 3131 art. 10 y DS 28562 — paráfrasis. */
export const CHART_HELP =
  'Forma parte del expediente clínico (Ley 3131 y DS 28562): no se borra; si la persona cambia de decisión, se revoca.';

/** Qué se consiente, en palabras, por tipo de objeto. */
export const TARGET_NAME: Readonly<Record<InformedConsentTargetType, string>> = {
  MEDICATION_REQUEST: 'Receta',
  SERVICE_REQUEST: 'Orden de análisis o estudio',
  REFERRAL: 'Derivación',
  PROCEDURE: 'Procedimiento',
  CARE_PLAN: 'Plan de cuidados',
};

export const GRANTOR_NAME: Readonly<Record<InformedConsentGrantor, string>> = {
  PATIENT: 'La persona atendida',
  LEGAL_REPRESENTATIVE: 'Representante legal',
  GUARDIAN: 'Tutor o tutora',
  SUBSTITUTE_RELATIVE: 'Familiar responsable',
};

export const CHANNEL_NAME: Readonly<Record<InformedConsentChannel, string>> = {
  IN_PERSON: 'En persona',
  TELEHEALTH: 'Por telesalud',
};

export const EXCEPTION_NAME: Readonly<Record<InformedConsentException, string>> = {
  EMERGENCY: 'Urgencia con peligro inminente para la vida',
  PUBLIC_HEALTH_RISK: 'Riesgo para la salud pública',
  PATIENT_WAIVER: 'La persona renunció a recibir la información',
};

/**
 * El mensaje de cada regla, junto al campo y con la corrección: «Indicá…»,
 * nunca «Campo inválido».
 */
export const RULE_MESSAGE: Readonly<Record<InformedConsentRuleViolation, string>> = {
  TARGET_PAIR_INCOMPLETE: 'Falta identificar qué se consiente. Cierre y abra el consentimiento desde la indicación.',
  PURPOSE_REQUIRED: 'Explique en qué consiste y para qué se indica.',
  BENEFITS_REQUIRED: 'Indique qué beneficios se esperan.',
  RISKS_REQUIRED: 'Indique los riesgos frecuentes y los graves.',
  EXCEPTION_JUSTIFICATION_REQUIRED: 'Justificá por qué se aplica la excepción.',
  REPRESENTATIVE_NAME_REQUIRED: 'Indique el nombre de quien otorga en representación.',
  REPRESENTATIVE_RELATIONSHIP_REQUIRED: 'Indique el parentesco o la calidad del representante.',
  ASSENT_REQUIRED: 'Indique si la persona representada dio su asentimiento.',
  REVOCATION_RIGHT_REQUIRED: 'Deje constancia de que informó que puede revocar su decisión.',
};

/** En qué pestaña vive el campo de cada regla: el envío lleva el foco ahí. */
export const RULE_TAB: Readonly<Record<InformedConsentRuleViolation, number>> = {
  TARGET_PAIR_INCOMPLETE: 0,
  PURPOSE_REQUIRED: 0,
  BENEFITS_REQUIRED: 0,
  RISKS_REQUIRED: 0,
  REPRESENTATIVE_NAME_REQUIRED: 1,
  REPRESENTATIVE_RELATIONSHIP_REQUIRED: 1,
  ASSENT_REQUIRED: 1,
  EXCEPTION_JUSTIFICATION_REQUIRED: 2,
  REVOCATION_RIGHT_REQUIRED: 2,
};

/**
 * Los idiomas en que se informa. Los cuatro de mayor uso entre los 36
 * oficiales (CPE); el resto se escribe. Viaja el código ISO 639-1 cuando lo
 * hay y el nombre escrito cuando no.
 */
export const INFORMATION_LANGUAGES: readonly { readonly value: string; readonly label: string }[] = [
  { value: 'es', label: 'Castellano' },
  { value: 'qu', label: 'Quechua' },
  { value: 'ay', label: 'Aymara' },
  { value: 'gn', label: 'Guaraní' },
  { value: 'OTRO', label: 'Otro idioma' },
];

/** Paráfrasis (no cita literal): Código de Ética y Deontología Médica, sin número de artículo. */
export const WITNESS_HELP =
  'Opcional. Cuando la persona no puede consentir o no sabe firmar, el Código de Ética y Deontología Médica recomienda hacerlo ante testigos.';

/** Paráfrasis de la Norma Nacional de Referencia y Contrarreferencia (2013). */
export const REFERRAL_HELP =
  'En una derivación, la norma de referencia pide explicar el motivo, los riesgos y los beneficios, y que la persona o su familiar firme como parte del consentimiento.';

/** El estado de la firma, como se pinta. */
export function signatureState(c: InformedConsent | null): { etiqueta: string; variante: BadgeVariant } | null {
  if (c === null || c.status === 'WITHDRAWN') return null;
  return c.signatureStatus === 'SIGNED'
    ? { etiqueta: 'Firmado', variante: 'success' }
    : { etiqueta: 'Firma pendiente', variante: 'warning' };
}

/** El estado de un consentimiento —o su ausencia—, como se pinta en un ítem. */
export interface ConsentState {
  readonly clave: 'NONE' | 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN';
  readonly etiqueta: string;
  readonly variante: BadgeVariant;
}

export function consentState(c: InformedConsent | null): ConsentState {
  if (c === null) {
    return { clave: 'NONE', etiqueta: 'Sin consentimiento', variante: 'warning' };
  }
  if (c.status === 'WITHDRAWN') {
    return { clave: 'WITHDRAWN', etiqueta: 'Consentimiento revocado', variante: 'secondary' };
  }
  return c.decision === 'ACCEPTED'
    ? { clave: 'ACCEPTED', etiqueta: 'Consentimiento aceptado', variante: 'success' }
    : { clave: 'DECLINED', etiqueta: 'Consentimiento rechazado', variante: 'error' };
}

/** Las cuatro pestañas, en el orden en que se recorre el consentimiento. */
export const CONSENT_TABS = ['Información', 'Quién otorga', 'Decisión', 'Historial y revocación'] as const;

/** Cada regla, con la clave del campo que señala (para el foco y el `tocado`). */
export const FIELD_BY_RULE: Readonly<Record<InformedConsentRuleViolation, string>> = {
  TARGET_PAIR_INCOMPLETE: 'proposito',
  PURPOSE_REQUIRED: 'proposito',
  BENEFITS_REQUIRED: 'beneficios',
  RISKS_REQUIRED: 'riesgos',
  REPRESENTATIVE_NAME_REQUIRED: 'representante',
  REPRESENTATIVE_RELATIONSHIP_REQUIRED: 'parentesco',
  ASSENT_REQUIRED: 'asentimiento',
  EXCEPTION_JUSTIFICATION_REQUIRED: 'justificacion',
  REVOCATION_RIGHT_REQUIRED: 'revocabilidad',
};
