/**
 * Tipos de la vista para `health_context` (M44): recolección gobernada del
 * contexto sanitario de un país, con su evidencia.
 *
 * Los literales replican los `@IsIn` de los DTOs del backend
 * (`src/modules/health_context/dto/health-context.dto.ts`). No se unifican
 * aunque se parezcan: `ObservationStatus` y `ReviewOutcome` tienen los mismos
 * dos valores hoy y son conceptos distintos.
 *
 * ## Dos decisiones de tipo que no son evidentes
 *
 * - **Los puntajes son texto, no número.** El backend los declara
 *   `@IsNumberString` y los devuelve tal cual porque son `numeric` de Postgres.
 *   Convertirlos en la frontera perdería precisión decimal y ceros
 *   significativos, y nadie hace aritmética con ellos: se muestran.
 * - **Los contadores de una corrida cerrada también son texto.** Son `bigint`
 *   serializados; `Number` los rompería a partir de 2^53.
 */

/** Qué disparó una corrida de recolección. */
export type CollectionTrigger = 'SCHEDULED' | 'MANUAL';

/** Si una observación se aceptó o se descartó. */
export type ObservationStatus = 'ACCEPTED' | 'REJECTED';

/** Veredicto de una revisión de calidad. Un rechazo bloquea la publicación. */
export type ReviewOutcome = 'APPROVED' | 'REJECTED';

/** Cómo terminó una corrida. Se cierra una sola vez y no se reabre. */
export type RunOutcome = 'SUCCEEDED' | 'PARTIAL' | 'FAILED';

/**
 * Cómo se retira una versión publicada.
 *
 * `SUPERSEDED` exige reemplazo y el contexto sigue activo; `EXPIRED` lo deja
 * obsoleto. La diferencia es de negocio, no de nombre.
 */
export type SupersedeMode = 'SUPERSEDED' | 'EXPIRED';

/* -- Agentes y fuentes ----------------------------------------------------- */

/** Alta de un agente recolector. */
export interface NewAgent {
  readonly code: string;
  readonly name: string;
  readonly agentTypeConceptId: string;
  readonly providerId?: string;
  readonly implementationRef?: string;
  readonly ownerTenantId?: string;
}

export interface AgentCreated {
  readonly id: string;
  readonly code: string;
  readonly statusConceptId: string;
}

/** Alta de una fuente, con su nivel de confianza y su licencia. */
export interface NewSource {
  readonly code: string;
  readonly name: string;
  readonly sourceTypeConceptId: string;
  readonly trustTierConceptId: string;
  readonly ownerName?: string;
  readonly canonicalUrl?: string;
  readonly countryConceptId?: string;
  readonly licenseText?: string;
}

export interface SourceCreated {
  readonly id: string;
  readonly code: string;
  readonly statusConceptId: string;
}

/* -- Programación ---------------------------------------------------------- */

/** Cada cuánto un agente vuelve a mirar un país. */
export interface NewSchedule {
  readonly countryConceptId: string;
  readonly agentId: string;
  readonly scheduleExpression: string;
  readonly timezoneConceptId?: string;
  readonly lookbackDays?: number;
  readonly freshnessTtlSeconds?: number;
  /** ISO 8601. Se manda como texto; el backend lo valida con `@IsDateString`. */
  readonly nextRunAt?: string;
}

export interface ScheduleCreated {
  readonly id: string;
  readonly agentId: string;
  readonly statusConceptId: string;
  readonly nextRunAt?: Date;
}

/* -- Contextos y versiones ------------------------------------------------- */

/** Alta de un contexto de país, que nace en borrador. */
export interface NewContext {
  readonly countryConceptId: string;
  readonly contextDomainConceptId: string;
  readonly contextKey: string;
  readonly title: string;
  readonly description?: string;
}

export interface ContextCreated {
  readonly id: string;
  readonly contextKey: string;
  readonly statusConceptId: string;
}

/** Una observación que respalda un hecho. Debe ser aceptada y de la misma corrida. */
export interface FactEvidence {
  readonly sourceObservationId: string;
  readonly evidenceLocatorJson?: Record<string, unknown>;
  /** Texto: ver la nota de puntajes en la cabecera. */
  readonly relevanceScore?: string;
  readonly evidenceHash?: string;
}

/** Un hecho de la versión. Sin evidencia retenida, el backend lo rechaza. */
export interface ContextFact {
  readonly factKey: string;
  readonly valueType: string;
  readonly valueJson: Record<string, unknown>;
  readonly metricConceptId?: string;
  readonly unitConceptId?: string;
  readonly periodStart?: string;
  readonly periodEnd?: string;
  readonly confidenceScore?: string;
  readonly evidence: readonly FactEvidence[];
}

/** Redacción de una versión, siempre en borrador y desde una corrida. */
export interface NewContextVersion {
  readonly collectionRunId: string;
  readonly contextPayloadJson: Record<string, unknown>;
  readonly facts: readonly ContextFact[];
  readonly schemaVersion?: string;
  readonly summary?: string;
  readonly observedAt?: string;
  readonly expiresAt?: string;
  readonly confidenceScore?: string;
}

export interface ContextVersionDrafted {
  readonly id: string;
  readonly versionNumber: number;
  readonly statusConceptId: string;
  readonly contentHash: string;
  readonly factIds: readonly string[];
  readonly evidenceCount: number;
}

/* -- Recolección ----------------------------------------------------------- */

/**
 * Arranque de una corrida. `idempotencyKey` es lo que hace que el reintento del
 * scheduler no duplique observaciones: la respuesta trae `duplicate`.
 */
export interface NewCollectionRun {
  readonly idempotencyKey: string;
  readonly trigger: CollectionTrigger;
  readonly scheduleId?: string;
  readonly agentId?: string;
  readonly countryConceptId?: string;
  readonly nextRunAt?: string;
}

export interface CollectionRunStarted {
  readonly id: string;
  readonly statusConceptId: string;
  /** `true` si la clave ya existía: no se creó nada nuevo. */
  readonly duplicate: boolean;
}

/** Una observación inmutable, deduplicada por hash dentro de la corrida. */
export interface NewObservation {
  readonly sourceId: string;
  readonly contentHash: string;
  readonly status: ObservationStatus;
  readonly sourceLocator?: string;
  readonly publishedAt?: string;
  readonly retrievedAt?: string;
  readonly mediaType?: string;
  readonly rawPayloadFileId?: string;
  readonly extractedPayloadJson?: Record<string, unknown>;
}

export interface ObservationRecorded {
  readonly id: string;
  readonly statusConceptId: string;
  /** `true` si el hash ya estaba en la corrida. */
  readonly duplicate: boolean;
}

/** Cierre de una corrida. Una que falla tiene que declarar qué salió mal. */
export interface FinishRun {
  readonly outcome: RunOutcome;
  readonly continuationCursorJson?: Record<string, unknown>;
  readonly errorSummary?: string;
}

/**
 * Contadores **reconciliados** contra la tabla al cerrar, no los que la corrida
 * llevaba al vuelo. Texto porque son `bigint`.
 */
export interface RunFinished {
  readonly id: string;
  readonly statusConceptId: string;
  readonly observationsRead: string;
  readonly observationsAccepted: string;
  readonly observationsRejected: string;
  readonly sourceCount: number;
}

/* -- Revisión, publicación y retiro ---------------------------------------- */

export interface NewQualityReview {
  readonly reviewTypeConceptId: string;
  readonly outcome: ReviewOutcome;
  readonly reviewerAgentId?: string;
  readonly issuesJson?: Record<string, unknown>;
  readonly notes?: string;
}

export interface QualityReviewRecorded {
  readonly id: string;
  readonly contextVersionId: string;
  readonly versionStatusConceptId: string;
}

/** Publicar deja superseded a la anterior en la misma transacción. */
export interface VersionPublished {
  readonly id: string;
  readonly versionNumber: number;
  readonly statusConceptId: string;
  readonly countryHealthContextId: string;
  readonly supersededVersionId?: string;
}

/** Retiro de una versión publicada. */
export interface SupersedeVersion {
  readonly mode: SupersedeMode;
  readonly reason: string;
  /** Obligatorio cuando `mode` es `SUPERSEDED`; el backend responde 422 si falta. */
  readonly replacementVersionId?: string;
}

export interface VersionSuperseded {
  readonly id: string;
  readonly statusConceptId: string;
  readonly contextStatusConceptId: string;
  readonly currentVersionId?: string;
}

/* -- La única lectura ------------------------------------------------------ */

/** Un hecho de la versión vigente, con las observaciones que lo respaldan. */
export interface ResolvedFact {
  readonly id: string;
  readonly factKey: string;
  readonly valueType: string;
  readonly valueJson: unknown;
  readonly metricConceptId?: string;
  readonly unitConceptId?: string;
  readonly confidenceScore?: string;
  readonly evidenceObservationIds: readonly string[];
}

/**
 * La versión vigente de un contexto.
 *
 * Una versión caducada **no se oculta**: llega con `stale: true`. Es lo que
 * hace de esta la primera lectura del producto que produce el estado S7 del
 * M34 de verdad, y no como precaución.
 */
export interface ResolvedContext {
  readonly contextId: string;
  readonly versionId: string;
  readonly versionNumber: number;
  readonly contextPayloadJson: unknown;
  readonly observedAt?: Date;
  readonly expiresAt?: Date;
  readonly stale: boolean;
  readonly facts: readonly ResolvedFact[];
}

/** Los tres parámetros obligatorios de la resolución. */
export interface ContextQuery {
  /** Concepto de país (uuid). El backend lo pasa por `ParseUUIDPipe`. */
  readonly country: string;
  /** Concepto de dominio del contexto (uuid). */
  readonly domain: string;
  /** Clave del contexto dentro del dominio. */
  readonly key: string;
}
