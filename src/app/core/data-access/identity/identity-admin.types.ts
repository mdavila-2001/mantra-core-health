/**
 * Tipos de la vista para el lado administrativo de `identity_assurance` (M27):
 * autoridades, políticas y el ciclo completo del caso de verificación —
 * evidencia, checks, señales de fraude, revisión manual y aserciones.
 *
 * Los literales replican los `@IsIn` de los DTOs del backend. Los campos
 * `…Json` son `Record<string, unknown>` porque el backend valida con
 * `@IsObject` y el modelo no declara su esquema interior. Los puntajes
 * (`confidenceScore`, `matchScore`) son **strings numéricos**: el DTO valida
 * con `@IsNumberString`, no con `@IsNumber`.
 */

/** Resultado técnico del intento contra la autoridad externa. */
export type AttemptOutcome = 'SUCCESS' | 'PENDING' | 'FAILED';

/** Veredicto del check, registrado de forma inmutable. */
export type CheckResultOutcome = 'MATCH' | 'NO_MATCH';

/** Decisión del revisor sobre una revisión manual. */
export type ReviewDecision = 'APPROVED' | 'REJECTED';

/** Alta de una autoridad de identidad (UC-27-01). */
export interface NewIdentityAuthority {
  readonly tenantId: string;
  readonly authorityCode: string;
  readonly name: string;
  readonly authorityTypeConceptId: string;
  readonly jurisdictionConceptId?: string;
  readonly assuranceFrameworkConceptId?: string;
}

/** Autoridad registrada. `status` es el concepto de estado inicial. */
export interface RegisteredAuthority {
  readonly id: string;
  readonly authorityCode: string;
  readonly status: string;
  readonly createdAt: Date;
}

/** Publicación de un endpoint de verificación de la autoridad (UC-27-01). */
export interface NewAuthorityEndpoint {
  readonly integrationEndpointId: string;
  readonly capabilityConceptId: string;
  readonly assuranceLevelConceptId?: string;
  readonly requestContractVersion?: string;
  readonly responseContractVersion?: string;
}

/** Endpoint de autoridad publicado. */
export interface PublishedAuthorityEndpoint {
  readonly id: string;
  readonly identityAuthorityId: string;
  readonly status: string;
  readonly createdAt: Date;
}

/**
 * Alta de una política de verificación (soporte de UC-27-02). Una política
 * vigente es precondición para abrir un caso.
 */
export interface NewVerificationPolicy {
  readonly policyCode: string;
  readonly subjectTypeConceptId: string;
  readonly transactionRiskConceptId: string;
  readonly requiredIdentityAssuranceLevelConceptId: string;
  readonly requiredAuthenticatorAssuranceLevelConceptId?: string;
  readonly requiredFederationAssuranceLevelConceptId?: string;
  readonly evidenceRequirementsJson?: Record<string, unknown>;
  readonly fraudControlsJson?: Record<string, unknown>;
  readonly versionNumber?: number;
}

/** Política creada. */
export interface CreatedVerificationPolicy {
  readonly id: string;
  readonly policyCode: string;
  readonly status: string;
  readonly createdAt: Date;
}

/** Apertura de un caso de verificación (UC-27-02). */
export interface NewVerificationCase {
  readonly identityVerificationPolicyId: string;
  readonly subjectTypeConceptId: string;
  readonly subjectEntityId: string;
  readonly requestedAssuranceLevelConceptId?: string;
  readonly correlationId?: string;
  readonly expiresInHours?: number;
}

/** Caso abierto. `expiresAt` sale del TTL (por defecto 72 horas). */
export interface OpenedCase {
  readonly id: string;
  readonly status: string;
  readonly openedAt?: Date;
  readonly expiresAt?: Date;
}

/**
 * Aporte de evidencia documental bajo consentimiento (UC-27-03). El payload
 * no viaja acá: se referencia por archivo, hash o referencia cifrada
 * (minimización de datos).
 */
export interface NewCaseEvidence {
  readonly evidenceTypeConceptId: string;
  readonly issuerAuthorityId?: string;
  readonly evidenceIdentifierHash?: string;
  readonly evidenceFileId?: string;
  readonly encryptedEvidenceReference?: string;
  readonly evidenceQualityConceptId?: string;
  readonly collectedUnderConsentId?: string;
}

/** Evidencia registrada. */
export interface SubmittedEvidence {
  readonly id: string;
  readonly verificationStatus: string;
  readonly createdAt: Date;
}

/** Un check requerido dentro del plan (UC-27-04). */
export interface PlannedCheck {
  readonly checkTypeConceptId: string;
  readonly authorityId?: string;
  readonly required?: boolean;
}

/** Plan de checks del caso: al menos uno. */
export interface CheckPlan {
  readonly checks: readonly PlannedCheck[];
}

/** Checks planificados. */
export interface PlannedChecksResult {
  readonly caseId: string;
  readonly checkIds: readonly string[];
  readonly caseStatus: string;
}

/** Registro de una señal de fraude sobre el caso (UC-27-07). */
export interface NewFraudSignal {
  readonly signalTypeConceptId: string;
  readonly severityConceptId: string;
  readonly confidenceScore?: string;
  readonly sourceConceptId?: string;
  readonly evidenceReference?: string;
}

/** Señal de fraude registrada. */
export interface RaisedFraudSignal {
  readonly id: string;
  readonly resolution: string;
  readonly caseStatus: string;
}

/** Escalamiento del caso a revisión manual (UC-27-08). */
export interface NewManualReview {
  readonly reviewReasonConceptId: string;
  readonly assignedToUserId?: string;
}

/** Revisión manual abierta. */
export interface OpenedManualReview {
  readonly id: string;
  readonly status: string;
  readonly caseStatus: string;
}

/** Decisión de una revisión manual (UC-27-09). */
export interface ManualReviewDecision {
  readonly decision: ReviewDecision;
  readonly decisionReason?: string;
}

/** Revisión manual decidida. */
export interface DecidedManualReview {
  readonly id: string;
  readonly status: string;
  readonly caseStatus: string;
}

/** Emisión de una aserción de identidad sobre el caso (UC-27-10). */
export interface NewIdentityAssertion {
  readonly issuerIdentityAuthorityId: string;
  readonly assertionTypeConceptId?: string;
  readonly assuranceLevelConceptId?: string;
  readonly expiresInHours?: number;
}

/** Aserción emitida. */
export interface IssuedAssertion {
  readonly id: string;
  readonly assertionIdentifier?: string;
  readonly assuranceLevel: string;
  readonly issuedAt?: Date;
  readonly caseStatus: string;
}

/** Revocación de una aserción (UC-27-11). Puede derivar una señal de fraude. */
export interface AssertionRevocation {
  readonly revocationReasonConceptId?: string;
  readonly fraudSignalTypeConceptId?: string;
  readonly fraudSeverityConceptId?: string;
  readonly raiseFraudSignal?: boolean;
}

/** Aserción revocada: se revoca, no se borra. */
export interface RevokedAssertion {
  readonly id: string;
  readonly revokedAt: Date;
  readonly caseStatus: string;
}

/** Registro de un intento contra la autoridad externa (UC-27-05). */
export interface NewCheckAttempt {
  readonly identityAuthorityEndpointId: string;
  readonly outcome?: AttemptOutcome;
  readonly idempotencyKey?: string;
  readonly requestMessageId?: string;
  readonly responseMessageId?: string;
  readonly technicalErrorCode?: string;
  readonly retryEligible?: boolean;
}

/** Intento registrado. */
export interface RecordedAttempt {
  readonly id: string;
  readonly attemptNumber: number;
  readonly outcome: string;
  readonly checkStatus: string;
}

/** Registro del resultado inmutable del check (UC-27-06). */
export interface NewCheckResult {
  readonly result: CheckResultOutcome;
  readonly matchScore?: string;
  readonly discrepancyCodes?: readonly string[];
  readonly sourceResponseHash?: string;
}

/** Resultado registrado. `caseStatus` solo llega si este resultado cerró el caso. */
export interface RecordedCheckResult {
  readonly id: string;
  readonly resultVersion: number;
  readonly result: string;
  readonly checkStatus: string;
  readonly caseStatus?: string;
}

/** Desenlace del barrido de casos vencidos (UC-27-12). */
export interface ExpireSweepResult {
  readonly expiredCount: number;
  readonly caseIds: readonly string[];
}

/**
 * Un caso esperando la decisión de un revisor, tal como lo lista la cola.
 *
 * Trae lo justo para priorizar y abrir el caso: el expediente completo se pide
 * por id. Los `*ConceptId` son uuid de terminología, no etiquetas — mostrarlos
 * como texto exige resolverlos contra el catálogo.
 */
export interface QueuedCase {
  readonly id: string;
  readonly status: string;
  readonly subjectTypeConceptId: string;
  readonly subjectEntityId: string;
  readonly identityVerificationPolicyId: string;
  readonly riskScore?: string;
  readonly openedAt?: Date;
  readonly expiresAt?: Date;
}

/**
 * Filtro de la cola. Sin `status`, el backend devuelve los estados que esperan
 * revisión; pedir uno concreto acota a ése.
 */
export interface CaseQueueQuery {
  readonly status?: string;
  readonly limit?: number;
}
