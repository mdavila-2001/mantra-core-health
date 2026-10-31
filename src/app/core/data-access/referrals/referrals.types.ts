import type { ReferralTransfer, ReferralTransferInput } from './referral-transfer.types';

/* ============================================================================
    Derivaciones (`/referrals`, módulo `clinical_ext`).

    El médico deriva a la persona a otro profesional (pedido del propietario,
    24/10/2026) o a una organización médica, por un servicio concreto de su
    catálogo («derivación de servicios específicos… tipo tratamiento», pedido
    del cliente, 28/10/2026).

    Son los tipos de la vista: el cliente normaliza en la frontera
    (`core/data-access/wire.ts`) y acá no llegan ni `null` ni fechas en texto.
    ========================================================================== */

/**
 * Qué se le pide al destino. Los ocho códigos que acepta `POST /referrals`
 * (`REFERRAL_TYPES` de `clinical_ext/dto/referral.dto.ts`, API v4266), en el
 * orden en que se ofrecen. La API los guarda como conceptos `REF_TYPE_*`.
 */
export const REFERRAL_TYPES = [
  'TREATMENT',
  'CONSULTATION',
  'DIAGNOSTIC_STUDY',
  'PROCEDURE',
  'SECOND_OPINION',
  'THERAPY',
  'HOSPITALIZATION',
  'OTHER',
] as const;

export type ReferralType = (typeof REFERRAL_TYPES)[number];

/**
 * Los tipos que **ofrecen** el consentimiento informado dirigido a la
 * derivación: los que llevan a un acto sobre el cuerpo o a un estudio.
 *
 * Una interconsulta o una segunda opinión no consienten nada por sí mismas
 * —lo que se decida ahí se consiente ahí— y «Otro» no dice qué se va a hacer.
 */
export const REFERRAL_TYPES_WITH_CONSENT: ReadonlySet<ReferralType> = new Set<ReferralType>([
  'TREATMENT',
  'PROCEDURE',
  'DIAGNOSTIC_STUDY',
  'THERAPY',
  'HOSPITALIZATION',
]);

/** Estado legible que la API deriva del concepto de estado (`ReferralResponseDto.status`). */
export const REFERRAL_STATUSES = [
  'PENDING',
  'ACCEPTED',
  'REJECTED',
  'COMPLETED',
  'CANCELLED',
] as const;

export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

/** La decisión del destino (`PATCH /referrals/:id/respond`). */
export type ReferralDecision = 'ACCEPT' | 'REJECT';

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
  diagnosisText: 4000,
  clinicalSummary: 8000,
  treatmentGivenText: 4000,
  rejectReason: 4000,
  counterReferralText: 8000,
} as const;

/** Si el destino es una persona o una organización médica. */
export type ReferralTargetKind = 'PRACTITIONER' | 'ORGANIZATION';

/**
 * Claves del alta que la API agrega con la derivación por servicio y que el
 * `openapi.json` del que sale el contrato de la maqueta todavía no declara.
 *
 * **No** son «sólo simulador»: van también a la API real, que es la que las
 * publica. Se registran en `mock/contract/simulator-extensions.ts` del simulador para
 * que la maqueta no las rechace mientras tanto, y esa entrada se borra en
 * cuanto `scripts/gen-mock-contract.mjs` regenere el contrato con ellas.
 */
export const REFERRAL_CONTRACT_PENDING_KEYS: readonly string[] = [
  'referralType',
  'targetServiceCatalogId',
  'targetBranchId',
  'targetExternalName',
  'targetExternalContact',
  'requestedServiceText',
  'diagnosisText',
  'clinicalSummary',
  'treatmentGivenText',
  // v4274: los datos de traslado (`referral-transfer.types.ts`).
  'transfer',
];

/**
 * Cuerpo de `POST /referrals`.
 *
 * `referringProfileId` no se manda: la API lo toma del token, porque un campo
 * que el cliente puede falsear no dice quién recomienda.
 *
 * Al menos un destino —profesional u organización—: el servidor lo exige y la
 * pantalla no deja enviar sin él. Los opcionales sin elegir se **omiten**,
 * nunca viajan en `null`: el backend valida con `forbidNonWhitelisted`.
 */
export interface NewReferral {
  /** La persona derivada. */
  readonly patientProfileId: string;
  /**
   * El encuentro desde el que se deriva. Es lo que le permite a la API
   * comprobar la relación asistencial y avisarle a la persona: sin encuentro la
   * derivación se guarda, pero **no** se avisa.
   */
  readonly sourceEncounterId?: string;
  /** El profesional recomendado (`profileId` del directorio de médicos). */
  readonly targetProfileId?: string;
  /** La organización médica destino. */
  readonly targetTenantId?: string;
  /** Una sede concreta de la organización destino. */
  readonly targetBranchId?: string;
  /** Doctor u organización **fuera** de la plataforma (no recibe aviso). */
  readonly targetExternalName?: string;
  /** Teléfono, correo o dirección del destino externo. */
  readonly targetExternalContact?: string;
  /** El servicio concreto del catálogo del destino. */
  readonly targetServiceCatalogId?: string;
  readonly referralType?: ReferralType;
  /**
   * El servicio pedido en texto libre. Con `referralType` y sin
   * `targetServiceCatalogId`, la API lo exige junto con `clinicalSummary`.
   */
  readonly requestedServiceText?: string;
  readonly diagnosisText?: string;
  /** Resumen clínico: la norma de referencia lo pide para que el destino sepa a quién recibe. */
  readonly clinicalSummary?: string;
  /** Lo que se hizo antes de derivar. */
  readonly treatmentGivenText?: string;
  // Sin `informedConsentId`: la API lo rechaza en el alta (400
  // REFERRAL_CONSENT_LINK_NOT_ALLOWED). El vínculo lo escribe la API al
  // registrar un consentimiento ACCEPTED con targetType=REFERRAL.
  /** Por qué se la recomienda; lo lee la persona en su aviso. */
  readonly reasonText?: string;
  /** Hasta cuándo vale. Viaja como `YYYY-MM-DD` del día local. */
  readonly validUntil?: Date;
  readonly priorityConceptId?: string;
  /** Datos de traslado (v4274). Se omite si no se cargó nada. */
  readonly transfer?: ReferralTransferInput;
}

/** Lo que responde `POST /referrals`. */
export interface ReferralCreated {
  readonly id: string;
  readonly patientProfileId: string;
  readonly statusConceptId: string;
  readonly createdAt: string;
}

/** Un destino posible — `GET /referrals/targets`. */
export interface ReferralTarget {
  readonly kind: ReferralTargetKind;
  readonly id: string;
  readonly displayName: string;
  /** La organización del destino; `null` para quien no declara una. */
  readonly tenantId: string | null;
  /** Especialidad, ciudad o tipo de organización: lo que desambigua homónimos. */
  readonly subtitle: string | null;
}

/** Un servicio concreto que el destino ofrece — `GET /referrals/target-services`. */
export interface ReferralTargetService {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  /**
   * El arancel de lista. La API lo manda siempre como número
   * (`Number(defaultPrice)`, columna NOT NULL): un `0` es «nadie declaró el
   * arancel», no «es gratis».
   */
  readonly price: number;
  readonly currency: string | null;
  readonly tenantId: string | null;
  readonly practiceName: string | null;
}

/**
 * Una derivación de la persona — `GET /referrals?patientProfileId=` y
 * `GET /referrals/:id` (`ReferralResponseDto`, API v4266).
 */
export interface Referral {
  readonly id: string;
  readonly patientProfileId: string;
  readonly statusConceptId: string;
  /** Estado legible; ausente si la API todavía no lo deriva (versiones previas). */
  readonly status?: ReferralStatus;
  readonly createdAt: Date;
  readonly sourceEncounterId?: string;
  readonly referringProfileId?: string;
  readonly targetProfileId?: string;
  readonly targetTenantId?: string;
  readonly targetTenantName?: string;
  readonly targetBranchId?: string;
  readonly targetBranchName?: string;
  readonly targetExternalName?: string;
  readonly targetExternalContact?: string;
  readonly targetServiceCatalogId?: string;
  readonly requestedServiceText?: string;
  readonly diagnosisText?: string;
  readonly clinicalSummary?: string;
  readonly treatmentGivenText?: string;
  readonly rejectReason?: string;
  readonly counterReferralText?: string;
  readonly counterReferralAt?: Date;
  /**
   * El consentimiento ACEPTADO y vigente vinculado. Lo escribe la API al
   * registrarlo con `targetType=REFERRAL`; al revocarlo vuelve a vacío.
   */
  readonly informedConsentId?: string;
  /** Ausente en las anteriores al tipo, o con un código que esta versión no conoce. */
  readonly referralType?: ReferralType;
  readonly reasonText?: string;
  readonly validUntil?: Date;
  readonly respondedAt?: Date;
  /** El nombre del destino, resuelto por el servidor. */
  readonly targetDisplayName?: string;
  /** El nombre del servicio elegido, resuelto por el servidor. */
  readonly targetServiceName?: string;
  readonly priorityConceptId?: string;
  /** El traslado y la llegada (v4274); ausente si nunca se registró. */
  readonly transfer?: ReferralTransfer;
}

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

/**
 * Lo mismo para `PATCH /referrals/:id/respond`: el contrato generado sólo
 * declara `decision`, y la API v4266 suma `rejectReason`.
 */
export const REFERRAL_RESPOND_CONTRACT_PENDING_KEYS: readonly string[] = ['rejectReason'];
