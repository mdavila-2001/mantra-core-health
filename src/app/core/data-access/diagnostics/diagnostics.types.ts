import type { CollectionPointRef } from './sample-collection.types';
import type { ServiceRequestPerformerInput } from './service-request-performer.types';

/** The patient's own view of their results lives apart; re-exported so its importers stay as they were. */
export type * from './diagnostics-patient.types';

/**
 * Clasificación de la orden de análisis (C2, P40). La API la deriva de
 * `categoryConceptId` (laboratorio, imagen; cualquier otra categoría declarada
 * es `OTHER`) y la acepta en el alta; ausente = la orden no declara categoría.
 */
export type AnalysisCategory = 'LAB' | 'IMAGING' | 'OTHER';

/* ============================================================================
    Tipos de la vista para el circuito diagnóstico: `diagnostics` (M20) y la
    orden de servicio de `clinical` (M08).

    ## Por qué el alta vive en otro módulo que la lectura

    Porque la orden diagnóstica **es** una orden de servicio: la escribe
    `POST /clinical/service-requests`, donde viven sus invariantes, y lo único
    que la vuelve «de laboratorio» o «de imagenología» es su categoría. Un
    endpoint de alta propio en `diagnostics` habría sido una segunda puerta a la
    misma tabla, con dos lugares donde equivocarse.

    La lectura sí es de `diagnostics`
    (`GET /diagnostics/patients/:id/orders`), porque la pregunta es de este
    dominio: «¿qué le pedí a esta persona y qué volvió?».

    ## Los `*ConceptId` no se traducen acá

    Igual que en `clinical` y en `profiles`: llegan como uuid porque los estados
    son catálogo, y quien los muestre los resuelve con
    `TerminologyClient.readConceptLabels`.
    ========================================================================== */

/**
 * Una orden de laboratorio o imagenología.
 *
 * `categoryConceptId` es lo que separa una de otra, y es opcional en el
 * contrato: una orden vieja puede no tenerla. Quien la muestre trata la
 * ausencia como «sin clasificar», nunca la adivina por el código.
 */
export interface DiagnosticOrder {
  readonly id: string;
  /** F5b: el punto de toma sugerido, ya resuelto. */
  readonly suggestedCareSpace?: CollectionPointRef | null;
  readonly patientProfileId: string;
  readonly encounterId?: string;
  readonly codeConceptId: string;
  readonly categoryConceptId?: string;
  /** Categoría de análisis (P40); ausente = sin clasificar. */
  readonly category?: AnalysisCategory;
  /**
   * Notas médicas que motivan la orden, en el orden citado (P40). La API
   * siempre la manda (vacía si no hay); opcional por las órdenes del simulador
   * anteriores al campo.
   */
  readonly basedOnNoteIds?: readonly string[];
  readonly statusConceptId: string;
  readonly priorityConceptId?: string;
  readonly requesterProfileId?: string;
  readonly createdAt: Date;
  /**
   * Antiduplicación de estudios (v4.2.17). El informe previo que satisface
   * esta orden, si el médico eligió reutilizarlo o repetir el estudio con
   * justificación. Ausente en cualquier otro caso.
   */
  readonly previousDiagnosticReportId?: string;
  /** La justificación del médico, si repitió un estudio duplicado. */
  readonly duplicateOverrideReason?: string;
  /**
   * La orden activa, aún sin informe, sobre la que se repitió el estudio
   * (v4.2.47). Ausente en cualquier otro caso.
   */
  readonly previousServiceRequestId?: string;
  /**
   * The diagnosis the order wants to confirm, rule out or follow (patch
   * v4291, `service_requests.reason_condition_id`). Absent if ordered with no
   * diagnosis behind it.
   */
  readonly reasonConditionId?: string;
}

/**
 * Un informe diagnóstico.
 *
 * `currentVersionId` y `currentReleasedVersionId` no son lo mismo y la
 * diferencia importa: el primero dice que hay algo redactado, el segundo que hay
 * algo **validado y liberado**. Mostrar un informe con versión vigente pero sin
 * liberar como si fuera un resultado sería mostrar un borrador como diagnóstico.
 */
export interface DiagnosticReport {
  readonly id: string;
  readonly patientProfileId: string;
  readonly serviceRequestId?: string;
  readonly encounterId?: string;
  readonly codeConceptId: string;
  readonly categoryConceptId?: string;
  readonly lifecycleStatusConceptId: string;
  readonly currentVersionId?: string;
  readonly currentReleasedVersionId?: string;
  readonly resultReleaseStatusConceptId?: string;
  readonly createdAt: Date;
}

/**
 * El circuito diagnóstico de un paciente en una lectura.
 *
 * `truncated` nombra **los bloques** recortados por el tope, no un booleano
 * global: saber que faltan informes no es lo mismo que saber que falta algo.
 */
export interface PatientDiagnostics {
  readonly patientProfileId: string;
  readonly orders: readonly DiagnosticOrder[];
  readonly reports: readonly DiagnosticReport[];
  readonly limit: number;
  readonly truncated: readonly string[];
}

/**
 * Lo que hace falta para pedir un estudio (UC-08-05).
 *
 * Tres campos obligatorios y ninguno inventado: los tres los declara así el DTO
 * del backend. `encounterId` es opcional en el contrato —se puede pedir un
 * estudio fuera de una consulta— pero la ficha sólo ofrece el formulario con un
 * encuentro abierto, por la misma razón que la receta: un pedido suelto, sin la
 * consulta que lo motivó, es un dato que después nadie sabe explicar.
 */
export interface NewDiagnosticOrder extends ServiceRequestPerformerInput {
  readonly custodianTenantId: string;
  readonly patientProfileId: string;
  readonly codeConceptId: string;
  readonly encounterId?: string;
  readonly categoryConceptId?: string;
  /**
   * Categoría de análisis (P40). Sola, la API la guarda como su concepto; con
   * `categoryConceptId`, tienen que coincidir (422
   * `SERVICE_REQUEST_CATEGORY_MISMATCH`).
   */
  readonly category?: AnalysisCategory;
  /**
   * Notas médicas que motivan la orden (P40): del mismo paciente y, con
   * encuentro, de la misma consulta (422 `BASED_ON_NOTE_NOT_FOUND` /
   * `BASED_ON_NOTE_ENCOUNTER_MISMATCH`). Hasta 20, sin repetidos.
   */
  readonly basedOnNoteIds?: readonly string[];
  /**
   * La respuesta del formulario médico de la que sale (instancia de `forms`).
   * En la cita es obligatoria (P43).
   */
  readonly formInstanceId?: string;
  readonly priorityConceptId?: string;
  readonly requesterProfileId?: string;
  readonly performerTenantId?: string;
  /** F5b: sede y punto de toma sugeridos (`SAMPLE_COLLECTION` de esa sede). */
  readonly suggestedPracticeSiteId?: string;
  readonly suggestedCareSpaceId?: string;
  /**
   * Antiduplicación de estudios (v4.2.17). Presente sólo cuando el chequeo
   * previo detectó un duplicado y el médico decidió: junto con
   * `reusePreviousReport` (reutilizar) o `duplicateOverrideReason` (repetir
   * con justificación), nunca los dos a la vez.
   */
  readonly previousDiagnosticReportId?: string;
  readonly reusePreviousReport?: boolean;
  readonly duplicateOverrideReason?: string;
  /**
   * Which diagnosis it is ordered for (patch v4291): a condition of the same
   * patient; otherwise, 422. Optional: a control study hangs from none.
   */
  readonly reasonConditionId?: string;
}

/**
 * La orden recién creada, tal como vuelve del alta.
 *
 * `status` e `intent` viajan sin el sufijo `ConceptId` porque así los nombra el
 * contrato, pero son uuid de concepto igual que el resto.
 */
export interface DiagnosticOrderCreated {
  readonly id: string;
  readonly patientProfileId: string;
  /** Categoría de análisis que quedó guardada (P40); ausente = sin clasificar. */
  readonly category?: AnalysisCategory;
  /** Notas vinculadas a la orden (P40). */
  readonly basedOnNoteIds?: readonly string[];
  /** The linked diagnosis (patch v4291); absent if ordered without one. */
  readonly reasonConditionId?: string;
  readonly status: string;
  readonly intent: string;
  readonly createdAt: Date;
}

/* ============================================================================
    Antiduplicación de estudios (v4.2.17, subtarea 3.2, T-26). El chequeo
    previo al alta: «¿el paciente ya se hizo este estudio hace poco?».
    ========================================================================== */

/** Lo que hace falta para pre-validar duplicidad antes de pedir un estudio. */
export interface DuplicateStudyCheck {
  readonly patientProfileId: string;
  readonly codeConceptId?: string;
  readonly diagnosticStudyOfferingId?: string;
  readonly encounterId: string;
  readonly windowDays?: number;
}

/** El estudio previo que satisface (o casi satisface) el pedido nuevo. */
export interface PreviousStudy {
  /** Ausente cuando lo que consta es una orden activa que todavía no tiene informe. */
  readonly reportId?: string;
  readonly serviceRequestId?: string;
  readonly studyName: string;
  readonly providerName: string;
  readonly performedAt: Date;
  readonly daysAgo: number;
  readonly resultsAvailable: boolean;
  /** `undefined` salvo que el informe sea de la misma organización de quien pide. */
  readonly conclusionText?: string;
  /** Sin endpoint de descarga para el profesional hoy: siempre ausente. */
  readonly reportDownloadUrl?: string;
  readonly sameOrganization: boolean;
}

/** Respuesta del chequeo de duplicidad. */
export interface DuplicateStudyCheckResult {
  readonly isDuplicate: boolean;
  readonly previousStudy?: PreviousStudy;
  /** Texto en castellano listo para mostrar, si hubo duplicado. */
  readonly warningMessage?: string;
  readonly requiresJustification: boolean;
  /** Si hay un informe del mismo estudio todavía sin liberar dentro de la ventana. */
  readonly pendingReport: boolean;
  readonly windowDays: number;
}

/**
 * Un estudio de imagen del paciente.
 *
 * Lectura aparte de la del circuito porque es otra tabla y otro momento: la
 * orden es lo que se pidió, el estudio es lo que la máquina efectivamente
 * produjo, y puede haber uno sin el otro en los dos sentidos.
 */
export interface ImagingStudy {
  readonly id: string;
  readonly patientProfileId: string;
  readonly serviceRequestId?: string;
  readonly statusConceptId: string;
  readonly studyInstanceUid?: string;
}

/**
 * Una orden de trabajo de la cola del laboratorio.
 *
 * **No trae paciente**, y no es una omisión de este cliente: el contrato del
 * backend no lo expone. La cola es la vista del laboratorio sobre su propio
 * trabajo —qué hay pendiente, con qué prioridad, quién lo tiene— y se recorre
 * por número de orden, no por persona. Quien necesite el paciente entra por su
 * ficha, que es la lectura que sí lo tiene.
 */
export interface LabWorkOrder {
  readonly id: string;
  readonly workOrderNumber: string;
  readonly laboratoryAccessionId: string;
  readonly statusConceptId: string;
  readonly priorityConceptId: string;
  readonly assignedProfileId?: string;
  readonly scheduledAt?: Date;
  readonly completedAt?: Date;
  /** F5b: dónde se tomó la muestra (`collection_care_space_id`); `null` si no se registró. */
  readonly collectionPoint?: CollectionPointRef | null;
}

/** Filtros de la cola del laboratorio. Todos opcionales: sin ninguno, es la cola entera. */
export interface LabWorkOrderQuery {
  readonly laboratoryAccessionId?: string;
  readonly statusConceptId?: string;
  readonly assignedProfileId?: string;
  /** F5b: sólo las órdenes tomadas en este punto. */
  readonly collectionCareSpaceId?: string;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Order creation keys (`POST /clinical/service-requests`) the API adds with
 * patch v4291 and the mockup contract's `openapi.json` does not declare yet.
 * The client DOES send them to the real API; the entry in
 * `core/mock/contract/simulator-extensions.ts` goes away on regenerating it.
 */
export const DIAGNOSTIC_ORDER_CONTRACT_PENDING_KEYS: readonly string[] = ['reasonConditionId'];
