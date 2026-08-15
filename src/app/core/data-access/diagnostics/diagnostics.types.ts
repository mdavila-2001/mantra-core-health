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
  readonly patientProfileId: string;
  readonly encounterId?: string;
  readonly codeConceptId: string;
  readonly categoryConceptId?: string;
  readonly statusConceptId: string;
  readonly priorityConceptId?: string;
  readonly requesterProfileId?: string;
  readonly createdAt: Date;
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
export interface NewDiagnosticOrder {
  readonly custodianTenantId: string;
  readonly patientProfileId: string;
  readonly codeConceptId: string;
  readonly encounterId?: string;
  readonly categoryConceptId?: string;
  readonly priorityConceptId?: string;
  readonly requesterProfileId?: string;
  readonly performerTenantId?: string;
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
  readonly status: string;
  readonly intent: string;
  readonly createdAt: Date;
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
  readonly validFrom: Date;
  readonly validTo?: Date;
  readonly active: boolean;
}

/** Compartir un resultado: con quién y hasta cuándo. */
export interface NewDiagnosticResultShare {
  readonly practitionerUserId: string;
  /** Obligatorio: no existe compartir sin plazo. */
  readonly validUntil: Date;
  readonly reason?: string;
}
