import type { PatientSettlementFields } from '../insurance/patient-insurance-settlement.types';
import type {
  ServiceRequestPerformerFields,
  ServiceRequestPerformerInput,
} from './service-request-performer.types';

/**
 * Clasificación de la orden de análisis (C2, P40). La API la deriva de
 * `categoryConceptId` (laboratorio, imagen; cualquier otra categoría declarada
 * es `OTHER`) y la acepta en el alta; ausente = la orden no declara categoría.
 */
export type AnalysisCategory = 'LAB' | 'IMAGING' | 'OTHER';

/** Un componente marcado de un panel de laboratorio, tal como vuelve de la API. */
export interface ServiceRequestComponent {
  readonly conceptId: string;
  /** Nombre legible (castellano si existe). */
  readonly display: string;
  /** Posición, desde 1, en el orden en que se marcó. */
  readonly ordinal: number;
}

/** El detalle de imagen de una orden: ids y nombre legible; cada par puede ser `null`. */
export interface ServiceRequestImaging {
  readonly modalityConceptId: string | null;
  readonly modalityDisplay: string | null;
  readonly bodySiteConceptId: string | null;
  readonly bodySiteDisplay: string | null;
  readonly lateralityConceptId: string | null;
  readonly lateralityDisplay: string | null;
  readonly contrastConceptId: string | null;
  readonly contrastDisplay: string | null;
}

/**
 * El detalle que la orden guarda desde v4.2.80 (muestra, componentes, imagen).
 * Todo opcional: una orden anterior no lo tiene, y `componentsSpecified:false`
 * significa «estudio completo, sin detalle», no «ningún componente».
 */
export interface ServiceRequestDetailFields {
  /** Agrupa lo pedido junto en una sola requisición. */
  readonly requisitionId?: string | null;
  readonly codeDisplay?: string;
  readonly specimenTypeConceptId?: string | null;
  readonly specimenTypeDisplay?: string | null;
  readonly components?: readonly ServiceRequestComponent[];
  readonly componentsSpecified?: boolean;
  readonly imaging?: ServiceRequestImaging | null;
}

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
export interface DiagnosticOrder extends ServiceRequestDetailFields {
  readonly id: string;
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
  /** Muestra pedida (`specimen-type`); sólo laboratorio o anatomía patológica. */
  readonly specimenTypeConceptId?: string;
  /** Componentes MARCADOS del panel; obligatorio y no vacío si el estudio es un panel desplegable. */
  readonly componentConceptIds?: readonly string[];
  /** Detalle de imagen; sólo en estudios de imagen. */
  readonly imaging?: NewImagingDetail;
  /**
   * Antiduplicación de estudios (v4.2.17). Presente sólo cuando el chequeo
   * previo detectó un duplicado y el médico decidió: junto con
   * `reusePreviousReport` (reutilizar) o `duplicateOverrideReason` (repetir
   * con justificación), nunca los dos a la vez.
   */
  readonly previousDiagnosticReportId?: string;
  readonly reusePreviousReport?: boolean;
  readonly duplicateOverrideReason?: string;
}

/** Modalidad, región, lateralidad y contraste de un estudio de imagen; cada uno se omite si no hay valor. */
export interface NewImagingDetail {
  readonly modalityConceptId?: string;
  readonly bodySiteConceptId?: string;
  readonly lateralityConceptId?: string;
  readonly contrastConceptId?: string;
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
  /** V10: con región y lateralidad, «mano izquierda» no duplica «mano derecha». */
  readonly bodySiteConceptId?: string;
  readonly lateralityConceptId?: string;
  /** V10: los componentes que el informe previo no cubre no son duplicado. */
  readonly componentConceptIds?: readonly string[];
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
}

/** Filtros de la cola del laboratorio. Todos opcionales: sin ninguno, es la cola entera. */
export interface LabWorkOrderQuery {
  readonly laboratoryAccessionId?: string;
  readonly statusConceptId?: string;
  readonly assignedProfileId?: string;
  readonly limit?: number;
  readonly offset?: number;
}

/* ============================================================================
    Los resultados vistos por la persona a la que pertenecen.

    Lo de arriba es la mirada de quien atiende: exige rol clínico, se acota a la
    organización del contexto y muestra órdenes e informes **estén liberados o
    no**, que es lo correcto para el circuito y lo que no se le puede mostrar a
    un paciente. Estos tipos son la otra mitad, la del portal:
    `GET /diagnostics/me/diagnostic-results` y sus operaciones.

    No hay identificador de paciente en ninguno de estos contratos, y es a
    propósito: el backend resuelve al titular por el vínculo de su cuenta, así
    que no hay nada que la pantalla pueda pedir de otra persona.
    ========================================================================== */

/** Un archivo del informe: lo que se descarga. */
export interface DiagnosticResultFile {
  readonly id: string;
  /** Se descarga por `GET /common/files/{id}/content`. */
  readonly fileId: string;
  readonly contentRoleConceptId: string;
  readonly presentationFormatConceptId?: string;
  readonly ordinal?: number;
}

/**
 * Un resultado que el paciente puede ver.
 *
 * Es el informe **y** su versión liberada juntos: lo que una persona llama «mi
 * resultado» es el texto firmado y sus archivos, y ésos viven en la versión. Un
 * informe sin versión liberada no llega acá — no está escondido por error, es
 * que todavía no lo validó nadie.
 */
export interface PatientDiagnosticResult {
  readonly reportId: string;
  readonly versionId: string;
  readonly versionNumber: number;
  readonly serviceRequestId?: string;
  readonly codeConceptId: string;
  readonly categoryConceptId?: string;
  readonly custodianTenantId: string;
  readonly conclusionText?: string;
  readonly issuedAt?: Date;
  readonly releasedAt: Date;
  readonly clinicalStatusConceptId: string;
  readonly observationIds: readonly string[];
  readonly files: readonly DiagnosticResultFile[];
}

/** Página de resultados propios. */
export interface PatientDiagnosticResults {
  readonly patientProfileId: string;
  readonly items: readonly PatientDiagnosticResult[];
  readonly limit: number;
  readonly truncated: boolean;
}

/**
 * Una orden diagnóstica que el paciente tiene pendiente o cumplida.
 *
 * Es la otra mitad de {@link PatientDiagnosticResult}: aquélla es «qué me
 * volvió» y ésta «qué me pidieron y qué tengo que hacer para cumplirlo».
 *
 * `hasReleasedResult` lo decide el servidor y no se recalcula acá: que exista un
 * informe no quiere decir que haya un resultado que esta persona pueda leer.
 */
export interface PatientOrder
  extends PatientSettlementFields,
    ServiceRequestPerformerFields,
    ServiceRequestDetailFields {
  readonly id: string;
  readonly encounterId?: string;
  readonly codeConceptId: string;
  readonly categoryConceptId?: string;
  /**
   * Categoría de análisis (P40); ausente = sin clasificar. Las notas que
   * motivan la orden no llegan al portal: una nota puede no estar liberada.
   */
  readonly category?: AnalysisCategory;
  readonly statusConceptId: string;
  readonly priorityConceptId?: string;
  readonly createdAt: Date;
  /** Ayunas, horarios, qué llevar. Ausente = ningún centro publicó preparación. */
  readonly preparationInstructions?: string;
  readonly hasReleasedResult: boolean;
  readonly reportId?: string;
  /**
   * Una línea con lo pedido («Hemograma · 4 componentes», «Rayos X · Mano ·
   * Izquierda»). Ausente = la API no extendida: la fila muestra sólo el nombre.
   */
  readonly summary?: string;
}

/** Página de órdenes propias. */
export interface PatientOwnOrders {
  readonly patientProfileId: string;
  readonly items: readonly PatientOrder[];
  readonly limit: number;
  readonly truncated: boolean;
}

/**
 * Con quién está compartido un resultado, y hasta cuándo.
 *
 * `active` lo decide el servidor contra su propio reloj, no la pantalla: dos
 * relojes distintos dan dos respuestas distintas a «¿todavía vale?», y la que
 * importa es la del que después autoriza el acceso.
 */
export interface DiagnosticResultShare {
  readonly id: string;
  readonly reportId: string;
  readonly practitionerUserId: string;
  /**
   * El nombre del profesional, para que «Compartido con» no muestre un uuid.
   * Ausente si la cuenta perdió su vínculo con la persona (caso raro).
   */
  readonly practitionerName?: string;
  readonly validFrom: Date;
  readonly validTo?: Date;
  readonly active: boolean;
}

/**
 * Compartir un resultado: con quién y hasta cuándo.
 *
 * `practitionerProfileId` (CL-48), no una cuenta: es el mismo id que ya trae
 * `MyCareRelationship.practitionerProfileId` (`GET /authz/me/access`, BR-20).
 * El paciente elige de esa lista —sus relaciones asistenciales reales—, nunca
 * tipea un identificador. El servidor exige que la relación esté vigente antes
 * de resolver la cuenta y crear el acceso.
 *
 * `reason` se retiró (CL-50): `authz.resource_scope_grants` no tiene columna
 * para guardarlo y el backend ya lo ignoraba en silencio.
 */
export interface NewDiagnosticResultShare {
  readonly practitionerProfileId: string;
  /** Obligatorio: no existe compartir sin plazo. */
  readonly validUntil: Date;
}

/* ============================================================================
    Requisición (`POST /clinical/requisitions`): varios estudios pedidos juntos.
    La API crea un renglón de `service_requests` por estudio, atómicos, y los
    agrupa con `requisitionId`.
    ========================================================================== */

/** La decisión del médico ante un duplicado, por renglón. */
export interface RequisitionDuplicateDecision {
  readonly previousDiagnosticReportId: string;
  readonly reusePreviousReport?: boolean;
  readonly duplicateOverrideReason?: string;
}

/** Un estudio de la requisición. */
export interface RequisitionItem {
  readonly codeConceptId: string;
  readonly category?: AnalysisCategory;
  readonly categoryConceptId?: string;
  readonly specimenTypeConceptId?: string;
  readonly componentConceptIds?: readonly string[];
  readonly imaging?: NewImagingDetail;
  readonly duplicateDecision?: RequisitionDuplicateDecision;
}

/** Lo que hace falta para pedir 1 a 30 estudios juntos. */
export interface NewRequisition extends ServiceRequestPerformerInput {
  readonly custodianTenantId: string;
  readonly patientProfileId: string;
  readonly encounterId?: string;
  readonly formInstanceId?: string;
  readonly requesterProfileId?: string;
  readonly priorityConceptId?: string;
  readonly basedOnNoteIds?: readonly string[];
  readonly performerTenantId?: string;
  /** De 1 a 30. */
  readonly items: readonly RequisitionItem[];
}

/** Un renglón creado: la forma de `GET /clinical/service-requests/:id`. */
export interface ServiceRequestRecord extends ServiceRequestDetailFields {
  readonly id: string;
  readonly patientProfileId: string;
  readonly formInstanceId?: string | null;
  readonly category?: AnalysisCategory;
  readonly basedOnNoteIds: readonly string[];
  readonly status: string;
  readonly intent: string;
  readonly createdAt: Date;
}

/** La requisición creada. `replayed` es `true` si la respuesta repite un envío anterior con la misma clave. */
export interface RequisitionCreated {
  readonly requisitionId: string;
  readonly replayed: boolean;
  readonly items: readonly ServiceRequestRecord[];
}
