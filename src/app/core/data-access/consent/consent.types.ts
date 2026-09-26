/* ============================================================================
    Tipos de la vista para `consent` (M07) — «Mi privacidad».

    Lo que el titular ve de sus consentimientos y lo poco que puede cambiar: los
    retira. Sin enums nuevos de dominio: el estado llega ya traducido a un código
    legible (`state`) y el propósito con su nombre, para que ninguna pantalla
    muestre un uuid de catálogo.
    ========================================================================== */

/** Estado legible de un registro de consentimiento o de autorización. */
export type ConsentRecordState = 'ACTIVE' | 'WITHDRAWN' | 'EXPIRED' | 'OTHER';

/** Para qué se trata el dato. Con el nombre, listo para mostrar. */
export interface ConsentPurpose {
  readonly id: string;
  readonly code?: string;
  readonly name?: string;
}

/** Un consentimiento del titular, vigente o retirado. */
export interface MyConsent {
  readonly id: string;
  readonly state: ConsentRecordState;
  readonly purpose: ConsentPurpose;
  readonly validFrom?: Date;
  /** Se cierra al retirarlo: la fila no se borra. */
  readonly validTo?: Date;
  readonly withdrawnAt?: Date;
  readonly policyVersion?: string;
  readonly createdAt: Date;
}

/** Una autorización de divulgación. */
export interface MyHipaaAuthorization {
  readonly id: string;
  readonly state: ConsentRecordState;
  readonly purpose: ConsentPurpose;
  readonly recipientDescription: string;
  readonly informationDescription: string;
  readonly expiresAt?: Date;
  readonly signedAt?: Date;
  readonly revokedAt?: Date;
}

/** Una objeción a un tratamiento de datos. */
export interface MyObjection {
  readonly id: string;
  readonly state: 'RAISED' | 'RESOLVED' | 'OTHER';
  readonly purpose: ConsentPurpose;
  readonly reasonText?: string;
  readonly raisedAt?: Date;
  readonly resolvedAt?: Date;
}

/** La decisión del titular sobre un tratamiento. */
export type TreatmentDecision = 'ACCEPTED' | 'DECLINED';

/** Un consentimiento informado de tratamiento, visto por el titular. */
export interface MyTreatmentConsent {
  readonly id: string;
  readonly encounterId: string;
  readonly decision: TreatmentDecision | 'OTHER';
  readonly informationVersion?: string;
  readonly signedAt?: Date;
  readonly withdrawnAt?: Date;
}

/**
 * Lo que registra el médico en la consulta
 * (`POST /consent/encounters/:encounterId/informed-consent`).
 *
 * No lleva paciente ni organización: los toma la API del encuentro.
 */
export interface NewEncounterInformedConsent {
  readonly decision: TreatmentDecision;
  readonly procedureCodeConceptId?: string;
  readonly informationVersion?: string;
  readonly interpreterUserId?: string;
  readonly witnessUserId?: string;
}

/** Lo que devuelve el registro del consentimiento informado. */
export interface InformedConsentRegistration {
  readonly id: string;
  readonly patientProfileId: string;
  readonly status: string;
  readonly decision: string;
  readonly createdAt: Date;
}
