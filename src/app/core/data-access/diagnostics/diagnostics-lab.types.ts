/* ============================================================================
    El circuito del laboratorio propio: acesión, espécimen, versión de informe
    y liberación (CV-02, CL-47). Antes tenían endpoint y no tenían cliente —
    `DiagnosticsClient` documenta por qué no vivían ahí: son actos del
    laboratorio sobre su propio instrumental, sin lectura del lado de quien
    pide el estudio.

    La cola (`GET /diagnostics/work-orders`) sigue en `DiagnosticsClient`: ya
    tenía cliente y pantalla, y duplicarla acá sería una segunda fuente de
    verdad para la misma lectura.
    ========================================================================== */

/** Respuesta genérica al crear un recurso: id y el concepto de estado resultante. */
export interface ResourceCreated {
  readonly id: string;
  readonly status: string;
}

/** Alta de un espécimen (soporte de la acesión). */
export interface NewSpecimen {
  readonly patientProfileId: string;
  readonly custodianTenantId: string;
  readonly specimenTypeConceptId: string;
  readonly serviceRequestId?: string;
  readonly encounterId?: string;
  readonly bodySiteConceptId?: string;
  readonly collectionMethodConceptId?: string;
  readonly collectorProfileId?: string;
}

/** Acesionar uno o más especímenes recibidos en el laboratorio (UC-20-01). */
export interface NewAccession {
  readonly patientProfileId: string;
  /** Por defecto, el tenant del token. */
  readonly custodianTenantId?: string;
  readonly specimenIds: readonly string[];
  /** Se genera del lado del servidor si se omite. */
  readonly accessionNumber?: string;
  readonly priorityConceptId?: string;
  readonly serviceRequestId?: string;
}

/** Respuesta de acesionar: el id de la acesión y de cada item creado. */
export interface AccessionCreated {
  readonly id: string;
  readonly status: string;
  readonly accessionSpecimenIds: readonly string[];
}

/** Rechazar un espécimen y, opcionalmente, pedir una nueva recolección (UC-20-02). */
export interface RejectSpecimen {
  readonly rejectionReasonConceptId: string;
  readonly notes?: string;
  readonly recollectionRequired?: boolean;
  readonly recollectionServiceRequestId?: string;
  readonly rejectedByProfileId?: string;
}

/** Alta de un contenedor de espécimen (soporte de la cadena de custodia). */
export interface NewContainer {
  readonly containerIdentifier: string;
  readonly containerTypeConceptId: string;
  readonly additiveConceptId?: string;
  readonly parentContainerId?: string;
}

/** Registrar el traslado/custodia de un contenedor (UC-20-03). */
export interface NewCustodyEvent {
  readonly specimenId: string;
  readonly eventTypeConceptId?: string;
  readonly toPartyTypeConceptId?: string;
  readonly toPartyId?: string;
  readonly temperatureCelsius?: string;
  readonly sealIdentifier?: string;
  readonly evidenceHash?: string;
  readonly destinationStatusConceptId?: string;
  readonly notes?: string;
}

/** Un evento de la cadena de custodia, tal como quedó registrado (append-only). */
export interface SpecimenCustodyEvent {
  readonly id: string;
  readonly specimenContainerId?: string;
  readonly custodyEventTypeConceptId: string;
  readonly occurredAt: Date;
  readonly fromPartyTypeConceptId?: string;
  readonly toPartyTypeConceptId?: string;
  readonly sealIdentifier?: string;
  readonly signedByUserId?: string;
}

/** Un contenedor del espécimen. */
export interface SpecimenContainer {
  readonly id: string;
  readonly containerIdentifier: string;
  readonly containerTypeConceptId: string;
  readonly statusConceptId: string;
}

/**
 * Detalle de un espécimen: sus datos, sus contenedores y su cadena de
 * custodia (CL-47). Antes no había ningún `GET` para abrirlo: la única
 * lectura del circuito era la cola.
 */
export interface SpecimenDetail {
  readonly id: string;
  readonly patientProfileId: string;
  readonly specimenTypeConceptId: string;
  readonly statusConceptId: string;
  readonly collectedAt?: Date;
  readonly receivedAt?: Date;
  readonly containers: readonly SpecimenContainer[];
  readonly custodyEvents: readonly SpecimenCustodyEvent[];
}

/** Un espécimen dentro de una acesión, con su detalle. */
export interface AccessionSpecimenDetail {
  readonly accessionSpecimenId: string;
  readonly sequenceNumber: number;
  readonly statusConceptId: string;
  readonly specimen: SpecimenDetail;
}

/** Detalle de una acesión de laboratorio (CL-47). */
export interface AccessionDetail {
  readonly id: string;
  readonly custodianTenantId: string;
  readonly patientProfileId: string;
  readonly accessionNumber: string;
  readonly receivedAt: Date;
  readonly priorityConceptId: string;
  readonly statusConceptId: string;
  readonly specimens: readonly AccessionSpecimenDetail[];
}

/** Un resultado (observación) a enlazar en una versión de informe. */
export interface NewReportResultItem {
  readonly observationId: string;
  readonly resultRoleConceptId?: string;
  readonly ordinal?: number;
}

/** Un archivo a adjuntar a una versión de informe. */
export interface NewReportFileItem {
  readonly fileId: string;
  readonly contentRoleConceptId?: string;
  readonly ordinal?: number;
}

/**
 * Crear (o enmendar) una versión del informe diagnóstico (UC-20-07).
 *
 * `supersedesVersionId` es lo que hace de esto una enmienda y no un informe
 * nuevo: las versiones son inmutables, así que corregir un valor ya liberado
 * es siempre una versión que apunta a la que reemplaza, nunca un `PATCH`.
 */
export interface NewReportVersion {
  readonly custodianTenantId?: string;
  readonly conclusionText?: string;
  readonly authorProfileId?: string;
  readonly supersedesVersionId?: string;
  readonly amendmentReasonConceptId?: string;
  readonly amendmentReasonText?: string;
  readonly results?: readonly NewReportResultItem[];
  readonly files?: readonly NewReportFileItem[];
}

/**
 * Liberar una versión del informe (UC-20-08, D-E).
 *
 * Es el **único** camino que hace que el paciente vea el resultado en «Mis
 * resultados»: registra el evento de liberación con esta visibilidad, en la
 * misma transacción que la versión y el informe (ver D-E en
 * `docs/progress/DECISIONS.md`).
 */
export interface ReleaseReportVersion {
  /** Por defecto `VISIBLE`. */
  readonly patientVisibility?: 'VISIBLE' | 'HIDDEN';
  readonly reasonConceptId?: string;
  readonly policyVersion?: string;
}

/* ---- la recepción de muestras --------------------------------------------
   La bandeja de órdenes que otras organizaciones le dirigieron al laboratorio
   del tenant activo y que todavía no tienen acesión
   (`POST /diagnostics/service-requests/inbox`). */

/**
 * El campo cuyo catálogo ofrece los tipos de espécimen
 * (`GET /system-context/dynamic-enums?target=…`, enumeración `specimen-type`).
 */
export const SPECIMEN_TYPE_TARGET = 'diagnostics.specimens.specimen_type_concept_id';

/**
 * El campo cuyo catálogo ofrece los tipos de contenedor (enumeración
 * `specimen-container-type`): tubos por color de tapa, frascos e hisopos.
 */
export const CONTAINER_TYPE_TARGET = 'diagnostics.specimen_containers.container_type_concept_id';

/**
 * Qué se le pide a la bandeja. Viaja en el **cuerpo**, no en la URL: la
 * búsqueda por paciente es un nombre o un código de historia clínica, y en
 * una query string terminaría en logs de acceso e historial del navegador.
 */
export interface LabInboxQuery {
  /** Cursor opaco de la página anterior (`nextCursor`). */
  readonly cursor?: string;
  /** Tope de filas: 1 a 100, 25 por defecto. */
  readonly limit?: number;
  /** Nombre o código del paciente, 2 a 80 caracteres. */
  readonly patientQuery?: string;
}

/** Una orden de la bandeja de recepción. */
export interface LabInboxItem {
  readonly serviceRequestId: string;
  readonly patientProfileId: string;
  readonly patientDisplayName: string | null;
  readonly patientCode: string | null;
  /** Estudio pedido (concept id) y su nombre de catálogo. */
  readonly codeConceptId: string;
  readonly codeDisplay: string | null;
  readonly categoryConceptId: string | null;
  readonly priorityConceptId: string | null;
  readonly statusConceptId: string;
  readonly requesterProfileId: string | null;
  /**
   * Quién pidió la orden, en palabras («Nombre · Especialidad»). 4.2: «el
   * laboratorio tendrá la orden médica, donde verá el requerimiento y qué
   * médico realizó la solicitud». El DTO real todavía no lo publica
   * (P-LAB-SOLICITANTE): opcional, y sin él la pantalla no lo dice.
   */
  readonly requesterDisplayName?: string | null;
  /** La organización que emitió la orden. */
  readonly requestingTenantId: string;
  readonly requestingTenantName: string | null;
  readonly requestedAt: Date;
  /**
   * Muestras que este laboratorio ya recibió para la orden y todavía no
   * acesionó —con sus contenedores y su cadena de custodia—. Un espécimen
   * rechazado sigue acá con su estado.
   */
  readonly specimens: readonly SpecimenDetail[];
}

/**
 * Una página de la bandeja. Puede traer menos filas que `limit` **y** un
 * `nextCursor`: el servidor acota cuánto recorre por pedido, así que mientras
 * haya cursor hay más para cargar.
 */
export interface LabInboxPage {
  readonly items: readonly LabInboxItem[];
  readonly count: number;
  readonly limit: number;
  readonly nextCursor: string | null;
}
