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
 * Qué se le pide al destino. Los cinco códigos que acepta `POST /referrals`,
 * en el orden en que se ofrecen.
 */
export const REFERRAL_TYPES = [
  'TREATMENT',
  'CONSULTATION',
  'DIAGNOSTIC_STUDY',
  'PROCEDURE',
  'SECOND_OPINION',
] as const;

export type ReferralType = (typeof REFERRAL_TYPES)[number];

/** Si el destino es una persona o una organización médica. */
export type ReferralTargetKind = 'PRACTITIONER' | 'ORGANIZATION';

/**
 * Claves del alta que la API agrega con la derivación por servicio y que el
 * `openapi.json` del que sale el contrato de la maqueta todavía no declara.
 *
 * **No** son «sólo simulador»: van también a la API real, que es la que las
 * publica. Se registran en `core/mock/contract/simulator-extensions.ts` para
 * que la maqueta no las rechace mientras tanto, y esa entrada se borra en
 * cuanto `scripts/gen-mock-contract.mjs` regenere el contrato con ellas.
 */
export const REFERRAL_CONTRACT_PENDING_KEYS: readonly string[] = [
  'referralType',
  'targetServiceCatalogId',
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
  /** El servicio concreto del catálogo del destino. */
  readonly targetServiceCatalogId?: string;
  readonly referralType?: ReferralType;
  /** Por qué se la recomienda; lo lee la persona en su aviso. */
  readonly reasonText?: string;
  /** Hasta cuándo vale. Viaja como `YYYY-MM-DD` del día local. */
  readonly validUntil?: Date;
  readonly priorityConceptId?: string;
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
   * El arancel **tal como llega**. Un `numeric` de Postgres viaja como texto y
   * no se convierte: se muestra, no se calcula con él.
   */
  readonly price: string | number | null;
  readonly currency: string | null;
  readonly tenantId: string | null;
  readonly practiceName: string | null;
}

/** Una derivación de la persona — `GET /referrals?patientProfileId=`. */
export interface Referral {
  readonly id: string;
  readonly patientProfileId: string;
  readonly statusConceptId: string;
  readonly createdAt: Date;
  readonly sourceEncounterId?: string;
  readonly targetProfileId?: string;
  readonly targetTenantId?: string;
  readonly targetServiceCatalogId?: string;
  /** Ausente en las anteriores al tipo, o con un código que esta versión no conoce. */
  readonly referralType?: ReferralType;
  readonly reasonText?: string;
  readonly validUntil?: Date;
  readonly respondedAt?: Date;
  /** El nombre del destino, resuelto por el servidor. */
  readonly targetDisplayName?: string;
  /** El nombre del servicio elegido, resuelto por el servidor. */
  readonly targetServiceName?: string;
}
