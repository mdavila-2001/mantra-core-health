/* ============================================================================
    Derivaciones (`clinical_ext.referrals`): mandar a la persona a otro
    profesional, a otra organización o sede, o fuera de la plataforma, para
    un servicio concreto.

    Tipos de la vista, no DTOs: las fechas ya son `Date` y lo opcional es
    `undefined`, nunca `null` (se limpia en el cliente).

    La norma boliviana de referencia y contrarreferencia (Ministerio de Salud y
    Deportes) pide que la referencia viaje con resumen clínico, diagnóstico y
    tratamiento realizado, y que el destino devuelva la contrarreferencia. El
    modelo lo refleja campo por campo; ver el contrato §1.2.
    ========================================================================== */

/**
 * Qué clase de derivación es.
 *
 * El orden es el del formulario: de la consulta, que es lo más común, a la
 * internación, y «Otro» al final.
 */
export const REFERRAL_TYPES = [
  'CONSULTATION',
  'TREATMENT',
  'PROCEDURE',
  'DIAGNOSTIC',
  'THERAPY',
  'HOSPITALIZATION',
  'OTHER',
] as const;

export type ReferralType = (typeof REFERRAL_TYPES)[number];

/**
 * Los tipos que **ofrecen** el consentimiento informado dirigido a la
 * derivación: los que llevan a un acto sobre el cuerpo o a un estudio.
 *
 * Una interconsulta no consiente nada por sí misma —lo que se decida ahí se
 * consiente ahí— y «Otro» no dice qué se va a hacer.
 */
export const REFERRAL_TYPES_WITH_CONSENT: ReadonlySet<ReferralType> = new Set<ReferralType>([
  'TREATMENT',
  'PROCEDURE',
  'THERAPY',
  'HOSPITALIZATION',
  'DIAGNOSTIC',
]);

/** Estado legible que la API deriva de `statusConceptId`. */
export const REFERRAL_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'COMPLETED',
  'CANCELLED',
] as const;

export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

/** La decisión del destino. */
export type ReferralDecision = 'ACCEPT' | 'REJECT';

/** Una derivación, tal como la pinta la pantalla. */
export interface Referral {
  readonly id: string;
  readonly patientProfileId: string;
  readonly sourceEncounterId?: string;
  readonly referringProfileId?: string;

  /**
   * `undefined` en las filas anteriores al patch v4263: la columna es
   * nullable a propósito y la pantalla las rotula «Sin tipo».
   */
  readonly referralType?: ReferralType;

  /* -- El destino: al menos uno de los cuatro (lo valida la API) ---------- */
  readonly targetProfileId?: string;
  readonly targetTenantId?: string;
  readonly targetBranchId?: string;
  readonly targetExternalName?: string;
  readonly targetExternalContact?: string;
  /** Resueltos por la API cuando es barato; si no, la pantalla no inventa. */
  readonly targetProfileName?: string;
  readonly targetTenantName?: string;
  readonly targetBranchName?: string;

  /* -- Qué se pide y por qué --------------------------------------------- */
  readonly specialtyConceptId?: string;
  readonly requestedServiceText?: string;
  readonly requestedServiceConceptId?: string;
  readonly reasonConceptId?: string;
  readonly reasonText?: string;
  readonly diagnosisText?: string;
  readonly clinicalSummary?: string;
  readonly treatmentGivenText?: string;

  readonly priorityConceptId?: string;

  /**
   * El estado en palabras estables. `undefined` si la API todavía no lo deriva
   * (la versión anterior sólo devolvía `statusConceptId`).
   */
  readonly status?: ReferralStatus;
  readonly statusConceptId: string;

  /** Día de vencimiento (fecha, no instante). */
  readonly validUntil?: Date;
  readonly respondedAt?: Date;
  readonly rejectReason?: string;
  readonly counterReferralText?: string;
  readonly counterReferralAt?: Date;
  /**
   * El consentimiento ACEPTADO y vigente vinculado. Lo escribe la API al
   * registrarlo con `targetType=REFERRAL`; al revocarlo vuelve a vacío.
   */
  readonly informedConsentId?: string;
  readonly createdAt: Date;
}

/**
 * Lo que hace falta para emitir una derivación (`POST /referrals`).
 *
 * `referralType`, `requestedServiceText` y `clinicalSummary` son obligatorios
 * para toda derivación nueva —la API los exige juntos—, y el destino es al
 * menos uno de `targetProfileId` / `targetTenantId` / `targetBranchId` /
 * `targetExternalName`. Ver {@link problemasDeDerivacion}.
 */
export interface CreateReferralInput {
  readonly patientProfileId: string;
  readonly referralType: ReferralType;
  readonly sourceEncounterId?: string;
  readonly referringProfileId?: string;
  readonly targetProfileId?: string;
  readonly targetTenantId?: string;
  readonly targetBranchId?: string;
  readonly targetExternalName?: string;
  readonly targetExternalContact?: string;
  readonly specialtyConceptId?: string;
  readonly requestedServiceText: string;
  readonly requestedServiceConceptId?: string;
  readonly reasonText?: string;
  readonly diagnosisText?: string;
  readonly clinicalSummary: string;
  readonly treatmentGivenText?: string;
  readonly priorityConceptId?: string;
  /** Viaja como `YYYY-MM-DD` del día local. */
  readonly validUntil?: Date;
  // Sin `informedConsentId`: la API lo rechaza en el alta (400
  // REFERRAL_CONSENT_LINK_NOT_ALLOWED). El vínculo lo escribe la API al
  // registrar un consentimiento ACCEPTED con targetType=REFERRAL.
}

/** Cuerpo de `PATCH /referrals/:id/respond`. */
export interface RespondReferralInput {
  readonly decision: ReferralDecision;
  /** Obligatorio si `decision` es `REJECT`. */
  readonly rejectReason?: string;
}

/** Topes del DTO. Se repiten acá para cortar antes de mandar. */
export const REFERRAL_LIMITS = {
  requestedServiceText: 500,
  targetExternalName: 200,
  targetExternalContact: 200,
  reasonText: 1000,
  diagnosisText: 4000,
  clinicalSummary: 8000,
  treatmentGivenText: 4000,
  rejectReason: 4000,
  counterReferralText: 8000,
} as const;

/** Un problema de validación, atado al campo que lo corrige. */
export interface ProblemaDeDerivacion {
  readonly campo:
    | 'referralType'
    | 'destino'
    | 'targetExternalName'
    | 'targetExternalContact'
    | 'requestedServiceText'
    | 'clinicalSummary'
    | 'diagnosisText'
    | 'treatmentGivenText'
    | 'reasonText'
    | 'validUntil';
  readonly mensaje: string;
}

/**
 * Las mismas reglas que aplica la API, en el mismo orden que el formulario.
 *
 * No reemplazan a la API —que vuelve a validar y es la que decide—: evitan
 * mandar algo que se sabe que va a volver rechazado y dicen **qué** corregir
 * junto al campo, en vez de un 400 que no señala ninguno.
 *
 * @param entrada - Lo cargado, ya recortado.
 * @param hoy - El día de referencia para la vigencia (inyectable en pruebas).
 * @returns Los problemas, vacío si se puede emitir.
 */
export function problemasDeDerivacion(
  entrada: Partial<CreateReferralInput>,
  hoy: Date = new Date(),
): readonly ProblemaDeDerivacion[] {
  const problemas: ProblemaDeDerivacion[] = [];
  const lleno = (v: string | undefined): boolean => v !== undefined && v.trim() !== '';

  if (entrada.referralType === undefined) {
    problemas.push({ campo: 'referralType', mensaje: 'Elegí qué tipo de derivación es.' });
  }

  const tieneDestino =
    lleno(entrada.targetProfileId) ||
    lleno(entrada.targetTenantId) ||
    lleno(entrada.targetBranchId) ||
    lleno(entrada.targetExternalName);
  if (!tieneDestino) {
    problemas.push({
      campo: 'destino',
      mensaje: 'Indicá a quién derivás: un profesional, una organización o un destino externo.',
    });
  }

  if ((entrada.targetExternalName ?? '').length > REFERRAL_LIMITS.targetExternalName) {
    problemas.push({
      campo: 'targetExternalName',
      mensaje: `El nombre del destino admite hasta ${REFERRAL_LIMITS.targetExternalName} caracteres.`,
    });
  }
  if ((entrada.targetExternalContact ?? '').length > REFERRAL_LIMITS.targetExternalContact) {
    problemas.push({
      campo: 'targetExternalContact',
      mensaje: `El contacto admite hasta ${REFERRAL_LIMITS.targetExternalContact} caracteres.`,
    });
  }

  if (!lleno(entrada.requestedServiceText)) {
    problemas.push({
      campo: 'requestedServiceText',
      mensaje: 'Escribí qué servicio pedís, por ejemplo «Fisioterapia de rodilla, 10 sesiones».',
    });
  } else if ((entrada.requestedServiceText ?? '').length > REFERRAL_LIMITS.requestedServiceText) {
    problemas.push({
      campo: 'requestedServiceText',
      mensaje: `El servicio pedido admite hasta ${REFERRAL_LIMITS.requestedServiceText} caracteres.`,
    });
  }

  if (!lleno(entrada.clinicalSummary)) {
    problemas.push({
      campo: 'clinicalSummary',
      mensaje: 'Escribí el resumen clínico: la norma de referencia lo exige para que el destino sepa a quién recibe.',
    });
  } else if ((entrada.clinicalSummary ?? '').length > REFERRAL_LIMITS.clinicalSummary) {
    problemas.push({
      campo: 'clinicalSummary',
      mensaje: `El resumen clínico admite hasta ${REFERRAL_LIMITS.clinicalSummary} caracteres.`,
    });
  }

  if ((entrada.diagnosisText ?? '').length > REFERRAL_LIMITS.diagnosisText) {
    problemas.push({
      campo: 'diagnosisText',
      mensaje: `El diagnóstico admite hasta ${REFERRAL_LIMITS.diagnosisText} caracteres.`,
    });
  }
  if ((entrada.treatmentGivenText ?? '').length > REFERRAL_LIMITS.treatmentGivenText) {
    problemas.push({
      campo: 'treatmentGivenText',
      mensaje: `El tratamiento realizado admite hasta ${REFERRAL_LIMITS.treatmentGivenText} caracteres.`,
    });
  }

  if ((entrada.reasonText ?? '').length > REFERRAL_LIMITS.reasonText) {
    problemas.push({
      campo: 'reasonText',
      mensaje: `El motivo admite hasta ${REFERRAL_LIMITS.reasonText} caracteres.`,
    });
  }

  if (entrada.validUntil !== undefined) {
    const inicioDeHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    if (entrada.validUntil < inicioDeHoy) {
      problemas.push({
        campo: 'validUntil',
        mensaje: 'La vigencia no puede terminar antes de hoy.',
      });
    }
  }

  return problemas;
}
