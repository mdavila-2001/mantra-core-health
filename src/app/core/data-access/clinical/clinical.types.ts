/* ============================================================================
    Tipos de la vista para el archivo clínico: `clinical` (M08) y `chart` (M15).

    Son dos módulos del backend y **una sola pantalla**, porque la separación es
    de escritura, no de lectura: `clinical` guarda lo estructurado —condiciones,
    alergias, medicación, observaciones, encuentros— y `chart` lo narrativo
    —notas, planes de cuidados, documentos—. Quien atiende no piensa en dos
    módulos: piensa en el expediente de una persona.

    Van juntos en un archivo por eso mismo, y no porque compartan endpoint: son
    `GET /clinical/patients/:id/summary` y `GET /charts/patients/:id/chart`, dos
    peticiones que la pantalla lanza en paralelo.

    ## Los `*ConceptId` no se traducen acá

    Igual que en `profiles`: llegan como uuid porque los estados son catálogo, y
    quien los muestre los resuelve con `TerminologyClient.readConceptLabels`. Un
    cliente que tradujera de paso obligaría a pedir terminología aunque la
    pantalla sólo quiera contar cuántas alergias hay.
    ========================================================================== */

/** Un diagnóstico o problema del paciente. */
export interface Condition {
  readonly id: string;
  readonly codeConceptId: string;
  readonly categoryConceptId?: string;
  readonly clinicalStatusConceptId?: string;
  readonly verificationStatusConceptId?: string;
  readonly severityConceptId?: string;
  readonly encounterId?: string;
  /** Curso clínico: agudo/crónico/subagudo/recurrente (Patch v4.0.8). */
  readonly clinicalCourseConceptId?: string;
  readonly onsetAt?: Date;
  /** Fecha esperada de resolución o próxima revisión (Patch v4.0.8). */
  readonly expectedResolutionAt?: Date;
  readonly resolvedAt?: Date;
  /** Hallazgos y justificación clínica (Patch v4.1.3). */
  readonly noteText?: string;
  readonly createdAt: Date;
}

/** Una alergia o intolerancia registrada. */
export interface Allergy {
  readonly id: string;
  readonly substanceConceptId: string;
  readonly typeConceptId?: string;
  readonly categoryConceptId?: string;
  readonly criticalityConceptId?: string;
  readonly clinicalStatusConceptId?: string;
  readonly createdAt: Date;
}

/** Una indicación de medicación. */
export interface MedicationRequest {
  readonly id: string;
  readonly medicationConceptId: string;
  readonly statusConceptId: string;
  readonly prescriberProfileId?: string;
  readonly doseText?: string;
  readonly frequencyText?: string;
  readonly validFrom?: Date;
  readonly validTo?: Date;
  /** Indicaciones al paciente impresas en la receta (Patch v4.1.3). */
  readonly patientInstructionsText?: string;
  readonly signedAt?: Date;
  readonly issuedAt?: Date;
  readonly createdAt: Date;
}

/**
 * Una medición u observación.
 *
 * El valor puede venir por cinco caminos distintos y **excluyentes** — decimal,
 * texto, booleano, concepto o cantidad con unidad— porque así lo modela el
 * contrato. Quien lo muestre elige el primero presente; no hay un campo
 * «valor» que el backend calcule.
 */
export interface Observation {
  readonly id: string;
  readonly codeConceptId: string;
  readonly statusConceptId: string;
  readonly interpretationConceptId?: string;
  readonly valueDecimal?: string;
  readonly valueText?: string;
  readonly valueBoolean?: boolean;
  readonly valueConceptId?: string;
  readonly quantityValue?: string;
  readonly quantityUnitConceptId?: string;
  readonly effectiveStartAt?: Date;
  readonly encounterId?: string;
}

/** Un encuentro asistencial: la consulta, la internación, la urgencia. */
export interface Encounter {
  readonly id: string;
  readonly episodeId?: string;
  readonly statusConceptId: string;
  readonly classConceptId?: string;
  readonly primaryPractitionerId?: string;
  readonly reasonText?: string;
  readonly startAt?: Date;
  readonly endAt?: Date;
}

/**
 * Lo que hace falta para abrir un encuentro (UC-08-02).
 *
 * Sólo dos campos obligatorios, y no es una simplificación de este lado: el DTO
 * del backend declara opcionales el episodio, la sucursal, el profesional y las
 * dos clasificaciones, y aplica «ambulatorio» y «en curso» cuando no se los
 * manda. Un formulario que los pidiera todos estaría inventando requisitos que
 * el contrato no tiene.
 *
 * ## Los dos que ya no se omiten
 *
 * `appointmentId` y `primaryPractitionerId` **estuvieron fuera** —anotados como
 * P11 y P12— no por decisión de diseño sino porque el dato no existía de este
 * lado: la reserva no exponía su cita clínica y la sesión no conocía su perfil
 * profesional. Con las dos lecturas abiertas, el encuentro ya puede decir de qué
 * turno viene y quién atendió, que es lo que lo vuelve un registro y no una
 * marca de tiempo suelta.
 *
 * Siguen siendo opcionales, y su ausencia es corriente: se entra al expediente
 * sin pasar por la agenda, y hay cuentas sin perfil profesional. Se omiten
 * cuando no hay dato, nunca se rellenan con algo parecido — las dos son claves
 * foráneas reales.
 */
export interface NewEncounter {
  readonly patientProfileId: string;
  readonly tenantId: string;
  /** Motivo de consulta, en palabras. */
  readonly reasonText?: string;
  /**
   * La cita clínica que originó la atención.
   *
   * Es el `appointmentId` que trae la reserva de agenda —**no** el `id` de la
   * reserva, que apunta a otra tabla—. La agenda lo pasa por la URL al abrir el
   * expediente, y con él el encuentro queda atado al turno.
   */
  readonly appointmentId?: string;
  readonly episodeId?: string;
  readonly branchId?: string;
  readonly primaryPractitionerId?: string;
  readonly classConceptId?: string;
  readonly typeConceptId?: string;
}

/**
 * El encuentro recién abierto o recién cerrado, tal como lo devuelven las dos
 * escrituras.
 *
 * `status` viaja sin el sufijo `ConceptId` porque así lo nombra el contrato,
 * pero es un uuid de concepto igual que el resto: quien lo muestre lo traduce.
 */
export interface EncounterRegistration {
  readonly id: string;
  readonly patientProfileId: string;
  readonly episodeId: string | null;
  readonly status: string;
  readonly participantIds: readonly string[];
  readonly locationIds: readonly string[];
  readonly startAt: Date | null;
  readonly endAt: Date | null;
  readonly createdAt: Date;
}

/**
 * El historial clínico de un paciente en una lectura (UC-39-20).
 *
 * `truncated` nombra **los bloques** que quedaron recortados por el tope, no un
 * booleano global: saber que faltan observaciones no es lo mismo que saber que
 * falta algo.
 */
export interface ClinicalSummary {
  readonly patientProfileId: string;
  readonly conditions: readonly Condition[];
  readonly allergies: readonly Allergy[];
  readonly medicationRequests: readonly MedicationRequest[];
  readonly observations: readonly Observation[];
  readonly encounters: readonly Encounter[];
  readonly careEpisodes: readonly CareEpisode[];
  readonly limit: number;
  readonly truncated: readonly string[];
}

/* ---- el episodio de cuidado: la internación (UC-08-01) ------------------- */

/**
 * Un episodio de cuidado: la internación o la estancia que agrupa encuentros.
 *
 * ## Por qué aparece recién ahora
 *
 * El backend abría episodios desde siempre (`POST /clinical/care-episodes`),
 * pero ninguna lectura los devolvía: la ficha sólo veía el `episodeId` colgado
 * de un encuentro, y un uuid sin fila detrás no dice ni cuándo empezó ni si
 * sigue abierta. Dar de alta una internación era, para la interfaz, un acto sin
 * consecuencias visibles.
 *
 * ## `endAt` en `null` es la pregunta que importa
 *
 * Es la única que se hace quien reabre el expediente al día siguiente: «¿esta
 * persona sigue internada?». Se deriva de la fecha y no del estado, por lo
 * mismo que «encuentro en curso»: el estado es un uuid de catálogo y ramificar
 * por su valor ataría la pantalla a un identificador que un re-seed puede mover.
 */
export interface CareEpisode {
  readonly id: string;
  readonly tenantId: string;
  readonly typeConceptId?: string;
  readonly statusConceptId: string;
  readonly responsiblePractitionerId?: string;
  readonly startAt?: Date;
  readonly endAt?: Date;
  readonly createdAt: Date;
}

/**
 * Lo que hace falta para abrir una internación (UC-08-01).
 *
 * `tenantId` es obligatorio y no se deduce del paciente: es quién queda como
 * custodio del episodio, y una persona puede estar atendida en más de una
 * organización. Sale de la sesión activa, que es donde ya se eligió.
 */
export interface NewCareEpisode {
  readonly patientProfileId: string;
  readonly tenantId: string;
  /** Quién queda a cargo. Del claim de la sesión cuando lo abre quien atiende. */
  readonly responsiblePractitionerId?: string;
  /** Tipo de episodio; se resuelve contra `terminology`. */
  readonly typeConceptId?: string;
  /** Inicio. El backend usa «ahora» si no se declara. */
  readonly startAt?: Date;
}

/**
 * El episodio recién abierto.
 *
 * `startAt` llega `null` sólo si el backend no lo fijó, que hoy no ocurre: lo
 * declara `nullable` en el contrato y se respeta esa forma en vez de suponer.
 */
export interface CareEpisodeRegistration {
  readonly id: string;
  readonly patientProfileId: string;
  readonly tenantId: string;
  readonly status: string;
  readonly startAt: Date | null;
  readonly createdAt: Date;
}

/** Una nota del expediente, con su versión vigente. */
export interface ChartNote {
  readonly noteId: string;
  readonly encounterId?: string;
  readonly noteTypeConceptId?: string;
  readonly lifecycleStatusConceptId: string;
  readonly currentVersionId?: string;
  readonly versionNumber?: number;
  readonly authorProfileId?: string;
  readonly chiefComplaintText?: string;
  readonly subjectiveText?: string;
  readonly objectiveText?: string;
  readonly assessmentText?: string;
  readonly planText?: string;
  readonly signedAt?: Date;
  /** Derivado por el backend: si hay una versión liberada al portal. */
  readonly releasedToPatient: boolean;
  readonly createdAt: Date;
}

/** Una actividad concreta de un plan de cuidados. */
export interface CarePlanActivity {
  readonly id: string;
  readonly statusConceptId?: string;
  readonly detailText?: string;
  readonly scheduledAt?: Date;
}

/** Un plan de cuidados con sus actividades. */
export interface CarePlan {
  readonly id: string;
  readonly statusConceptId: string;
  readonly intentConceptId?: string;
  readonly goalText?: string;
  readonly startDate?: Date;
  readonly endDate?: Date;
  readonly activities: readonly CarePlanActivity[];
  readonly createdAt: Date;
}

/** Un documento del expediente. */
export interface ChartDocument {
  readonly id: string;
  readonly title?: string;
  readonly categoryConceptId?: string;
  readonly statusConceptId: string;
  readonly authorText?: string;
  readonly isExternal?: boolean;
  readonly documentDate?: Date;
  readonly createdAt: Date;
}

/** El expediente narrativo de un paciente en una lectura (UC-40-14). */
export interface PatientChart {
  readonly patientProfileId: string;
  readonly notes: readonly ChartNote[];
  readonly carePlans: readonly CarePlan[];
  readonly documents: readonly ChartDocument[];
  readonly limit: number;
  readonly truncated: readonly string[];
}

/* ============================================================================
    Las escrituras del registro clínico estructurado.

    ## `custodianTenantId` está en los cuatro y no se deduce

    Es el **custodio** del registro, no el lugar donde se atendió: una persona
    puede tener historia en más de una organización, y quién responde por el
    dato es una decisión de sesión, no del paciente. Sale de
    `auth.activeTenantId()` en todas las pantallas que escriben acá.

    El encuentro (`NewEncounter`) es la excepción aparente: su DTO lo llama
    `tenantId`. Son el mismo dato con dos nombres en el contrato, y se respeta
    cada nombre en vez de unificarlo de este lado — un alias silencioso es un
    400 que nadie encuentra.

    ## Las fechas van como `Date` y se serializan en la frontera

    El contrato las declara `format: 'date-time'` y las quiere en ISO. Aceptar
    `Date` acá —y no el texto ya armado— es lo que evita que cada formulario
    invente su propio `toISOString`, que es donde se cuelan los corrimientos de
    huso. El cliente lo convierte al enviar.

    ## Lo opcional se omite, nunca viaja vacío

    El backend valida con `forbidNonWhitelisted`: una clave declarada en
    `undefined` no es «no la mandé», es «la mandé vacía», y vuelve `400`. Por
    eso todos los opcionales son `?:` —no `| null`— y el cliente borra la clave
    antes de enviar.
    ========================================================================== */

/**
 * Lo que hace falta para prescribir una medicación (UC-08-10).
 *
 * Tres obligatorios y diez opcionales. `doseText` y `frequencyText` son
 * **texto libre** en el contrato: no hay value set detrás, y ofrecer un
 * selector inventado ahí sería empobrecer una indicación médica para que entre
 * en una lista que nadie acordó.
 *
 * La receta nace en **borrador**: prescribir no es emitir. El ciclo se cierra
 * con {@link MedicationRequestRegistration} pasando por firmar y emitir.
 */
export interface NewMedicationRequest {
  readonly custodianTenantId: string;
  readonly patientProfileId: string;
  /** El medicamento, como uuid de concepto. Nunca texto tecleado. */
  readonly medicationConceptId: string;
  readonly encounterId?: string;
  readonly prescriberProfileId?: string;
  /** Dosis, en palabras: «500 mg». Texto libre del contrato. */
  readonly doseText?: string;
  readonly routeConceptId?: string;
  /** Frecuencia, en palabras: «cada 8 horas». Texto libre del contrato. */
  readonly frequencyText?: string;
  readonly quantityDecimal?: number;
  readonly unitConceptId?: string;
  readonly substanceAtcConceptId?: string;
  readonly validFrom?: Date;
  readonly validTo?: Date;
  /**
   * Indicaciones al paciente (Patch v4.1.3). Narrativa separada de `doseText`
   * a propósito: la posología la lee farmacia y no debe llevarla concatenada.
   */
  readonly patientInstructionsText?: string;
}

/**
 * La receta tal como vuelve de prescribir, firmar y emitir.
 *
 * Las tres escrituras devuelven **la misma proyección**, y no es casualidad del
 * backend: firmar y emitir son transiciones de la misma entidad, así que la
 * pantalla que las encadena siempre recibe el estado nuevo completo.
 *
 * `signedAt` en `null` es el dato que decide si emitir va a responder `200` o
 * `422` bajo la política de firma D-05. Llega `null` —no ausente— porque el
 * servicio lo proyecta con `?? null`, igual que los tres vínculos de
 * corrección.
 */
export interface MedicationRequestRegistration {
  readonly id: string;
  readonly patientProfileId: string;
  /** Estado, como uuid de concepto. Se traduce con terminología. */
  readonly status: string;
  readonly replacesRequestId: string | null;
  readonly replacedByRequestId: string | null;
  readonly renewedFromRequestId: string | null;
  /** Instante de la firma, o `null` si la receta sigue sin firmar. */
  readonly signedAt: Date | null;
  readonly createdAt: Date;
}

/** Lo que hace falta para registrar un diagnóstico o problema (UC-08-08). */
export interface NewCondition {
  readonly custodianTenantId: string;
  readonly patientProfileId: string;
  readonly codeConceptId: string;
  readonly encounterId?: string;
  readonly categoryConceptId?: string;
  readonly severityConceptId?: string;
  readonly lateralityConceptId?: string;
  /**
   * Curso clínico (Patch v4.0.8). Sin declarar es un dato legítimo —el
   * catálogo trae `CONDITION_COURSE_UNKNOWN` para eso—, no un olvido.
   */
  readonly clinicalCourseConceptId?: string;
  readonly onsetAt?: Date;
  /** Fecha esperada de resolución. Sólo tiene sentido en curso agudo/subagudo. */
  readonly expectedResolutionAt?: Date;
  /** Hallazgos y justificación clínica (Patch v4.1.3). Narrativa libre. */
  readonly noteText?: string;
}

/**
 * La condición recién registrada.
 *
 * El backend fija el estado clínico y el de verificación —no los recibe— y los
 * devuelve para que la pantalla no tenga que suponerlos. El curso clínico sí
 * se manda (es del alta) y por eso también vuelve.
 */
export interface ConditionRegistration {
  readonly id: string;
  readonly patientProfileId: string;
  readonly clinicalStatus: string | null;
  readonly verificationStatus: string | null;
  readonly clinicalCourse: string | null;
  readonly createdAt: Date;
}

/* ---- Patch v4.0.8: transición del estado clínico ------------------------- */

/**
 * Lo que hace falta para transicionar el estado clínico de una condición ya
 * registrada (`POST /clinical/conditions/:id/change-status`).
 *
 * El motivo es obligatorio en el contrato: es el dato regulado que explica,
 * después, por qué un diagnóstico dejó de contar como vigente.
 */
export interface ChangeConditionClinicalStatus {
  readonly newClinicalStatusConceptId: string;
  readonly reasonText: string;
}

/**
 * Una reacción de una alergia.
 *
 * La manifestación es obligatoria y las otras dos no: una alergia se registra
 * sabiendo **qué pasó**; con qué gravedad y en qué palabras puede completarse
 * después.
 */
export interface NewAllergyReaction {
  readonly manifestationConceptId: string;
  readonly severityConceptId?: string;
  readonly description?: string;
}

/** Lo que hace falta para registrar una alergia o intolerancia (UC-08-09). */
export interface NewAllergyIntolerance {
  readonly custodianTenantId: string;
  readonly patientProfileId: string;
  readonly substanceConceptId: string;
  readonly typeConceptId?: string;
  readonly categoryConceptId?: string;
  readonly criticalityConceptId?: string;
  readonly reactions?: readonly NewAllergyReaction[];
}

/** La alergia recién registrada, con los identificadores de sus reacciones. */
export interface AllergyIntoleranceRegistration {
  readonly id: string;
  readonly patientProfileId: string;
  readonly clinicalStatus: string | null;
  readonly reactionIds: readonly string[];
  readonly createdAt: Date;
}

/**
 * Quién ejecutó la observación.
 *
 * `performerId` es el perfil del profesional —el claim `hpid` de la sesión
 * cuando lo registra quien atiende—, no el identificador de la cuenta. Son dos
 * tablas distintas y la clave foránea apunta a la primera.
 */
export interface NewObservationPerformer {
  readonly performerTypeConceptId: string;
  readonly performerId: string;
  readonly performerRoleConceptId?: string;
}

/**
 * La familia de valor de una observación, tal como la declara el contrato.
 *
 * Los seis caminos son **excluyentes**: se manda uno. Van en un tipo aparte
 * porque el DTO también los reparte entre la observación y cada uno de sus
 * componentes, y duplicarlos a mano garantizaría que se separen.
 */
export interface ObservationValue {
  readonly valueTypeConceptId?: string;
  readonly valueDecimal?: number;
  readonly valueBoolean?: boolean;
  readonly valueText?: string;
  readonly valueConceptId?: string;
  readonly quantityValue?: number;
  readonly quantityUnitConceptId?: string;
}

/** Un componente de una observación: la sistólica de una presión, por ejemplo. */
export interface NewObservationComponent extends ObservationValue {
  readonly codeConceptId: string;
  readonly interpretationConceptId?: string;
}

/** Un rango de referencia con el que se lee el valor. */
export interface NewObservationReferenceRange {
  readonly lowValue?: number;
  readonly highValue?: number;
  readonly unitConceptId?: string;
  readonly text?: string;
}

/**
 * Lo que hace falta para registrar una observación (UC-08-03).
 *
 * ## `performers` es obligatorio acá y opcional en el DTO
 *
 * Es una restricción **de este lado**, deliberada: el contrato admite una
 * observación sin ejecutante, pero una medición sin autor no es un registro
 * clínico —no se puede repreguntar, ni auditar, ni desestimar—. La pantalla
 * siempre sabe quién la está tomando, así que no hay caso legítimo en el que
 * omitirlo, y dejarlo opcional invitaba a olvidarlo.
 */
export interface NewObservation extends ObservationValue {
  readonly custodianTenantId: string;
  readonly patientProfileId: string;
  readonly codeConceptId: string;
  readonly performers: readonly NewObservationPerformer[];
  readonly encounterId?: string;
  readonly basedOnServiceRequestId?: string;
  readonly categoryConceptId?: string;
  readonly interpretationConceptId?: string;
  readonly methodConceptId?: string;
  readonly bodySiteConceptId?: string;
  readonly sourceDeviceId?: string;
  readonly effectiveStartAt?: Date;
  readonly issuedAt?: Date;
  readonly components?: readonly NewObservationComponent[];
  readonly referenceRanges?: readonly NewObservationReferenceRange[];
  readonly notes?: readonly string[];
}

/**
 * La observación recién registrada.
 *
 * Trae `rowVersion` porque la enmienda (UC-08-04) lo exige para el bloqueo
 * optimista: quien acaba de crearla ya tiene la versión con la que corregirla,
 * sin releer.
 */
export interface ObservationRegistration {
  readonly id: string;
  readonly patientProfileId: string;
  readonly status: string;
  readonly componentIds: readonly string[];
  readonly rowVersion: number;
  readonly createdAt: Date;
}

/**
 * Lo que hace falta para emitir un informe diagnóstico (UC-08-06).
 *
 * ## Existe el contrato y no la pantalla, a propósito
 *
 * El informe **no aparece en ninguna lectura**: no está en el bloque de
 * `getSummary`, no está en `getChart`, y el backend no expone ningún `GET` de
 * reportes. Construir el formulario hoy sería exactamente lo que el resto de
 * este archivo evita —tragarse el dato y no mostrarlo—: quien lo emitiera no
 * tendría forma de comprobar que existe, ni al recargar.
 *
 * El tipo y sus dos métodos entran igual porque el contrato **sí** está
 * verificado, y así el día que el backend publique la lectura la pantalla es lo
 * único que falta. Hasta entonces, la ficha del vault lo dice con el mismo
 * aviso: «Tabla ⚠︎ — la pantalla necesita un listado que el backend todavía no
 * expone».
 */
export interface NewDiagnosticReport {
  readonly custodianTenantId: string;
  readonly patientProfileId: string;
  readonly codeConceptId: string;
  readonly serviceRequestId?: string;
  readonly encounterId?: string;
  readonly categoryConceptId?: string;
  readonly currentVersionId?: string;
}

/**
 * El informe recién emitido o recién liberado.
 *
 * Dos estados y no uno: `lifecycleStatus` dice en qué punto está el informe
 * —parcial, preliminar, final— y `resultReleaseStatus` si el resultado ya se
 * le liberó a la persona. Son decisiones distintas: un informe final puede
 * seguir retenido, y esa diferencia es justamente la que la liberación cambia.
 */
export interface DiagnosticReportRegistration {
  readonly id: string;
  readonly patientProfileId: string;
  readonly lifecycleStatus: string;
  readonly resultReleaseStatus: string | null;
  readonly serviceRequestId: string | null;
  readonly createdAt: Date;
}

/**
 * Lo que hace falta para pedir el chequeo de interacciones (UC-18-04).
 *
 * `substanceConceptIds` va con **todo** lo activo más el que se está por
 * agregar — el backend exige al menos dos, porque una interacción es entre
 * dos sustancias y con una sola no hay nada que comparar.
 */
export interface InteractionCheckRequest {
  readonly patientProfileId: string;
  readonly substanceConceptIds: readonly string[];
  readonly encounterId?: string;
  readonly medicationRequestId?: string;
}

/**
 * Una alerta generada por el motor de decisión clínica.
 *
 * `alertTypeConceptId` y `severityConceptId` son conceptos de catálogo, no
 * texto: quien los muestre los resuelve con `TerminologyClient`, igual que
 * cualquier otro `*ConceptId` de la aplicación.
 */
export interface InteractionAlert {
  readonly id: string;
  readonly alertTypeConceptId: string;
  readonly severityConceptId: string;
  readonly ruleId?: string;
}

/** Resultado del chequeo: puede no encontrar ninguna. */
export interface InteractionCheckResult {
  readonly alerts: readonly InteractionAlert[];
  readonly count: number;
}
