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

/** Writing observations and diagnostic reports lives apart; re-exported so its importers stay as they were. */
export type * from './clinical-observation-writes.types';

/** Decisión terminal de C3 (P41). */
export type DiagnosisOutcome = 'CONFIRMED' | 'REFUTED';

/** Evidencia que respalda la decisión; C3 resuelve sus vínculos (P41). */
export interface DiagnosisEvidence {
  readonly kind: 'NOTE' | 'ANALYSIS';
  readonly noteId?: string;
  readonly encounterId?: string;
  readonly serviceRequestId?: string;
  readonly diagnosticReportId?: string;
}

/** Decisión registrada por C3; los instantes viajan como ISO (P41). */
export interface DiagnosisVerification {
  readonly outcome: DiagnosisOutcome;
  readonly decidedAt: string;
  readonly decidedByProfileId: string;
  readonly reasonText: string | null;
  readonly basedOn: DiagnosisEvidence | null;
}

/** Entrada de C3 para confirmar o rechazar (P41). */
export interface NewDiagnosisVerification {
  readonly outcome: DiagnosisOutcome;
  /** Hasta 500 caracteres; se exige motivo o evidencia. */
  readonly reasonText?: string;
  readonly basedOn?: DiagnosisEvidence;
  /** Obligatorio al confirmar si el diagnóstico todavía no declara inicio. */
  readonly onsetAt?: string;
  /** Obligatorio al confirmar salvo curso crónico. */
  readonly expectedResolutionAt?: string;
  /** Un curso crónico se confirma sin fin esperado. */
  readonly clinicalCourseConceptId?: string;
  /**
   * Only with `outcome: 'REFUTED'`: the diagnosis confirmed in its place
   * (patch v4291, differential resolved). Same patient and different from the
   * one rejected; otherwise, 422.
   */
  readonly replacedByConditionId?: string;
}

/**
 * The same for `POST /clinical/conditions/:id/verification`: patch v4291 adds
 * `replacedByConditionId` and the generated contract does not bring it yet.
 */
export const DIAGNOSIS_VERIFICATION_CONTRACT_PENDING_KEYS: readonly string[] = ['replacedByConditionId'];

/** Un diagnóstico o problema del paciente. */
export interface Condition {
  readonly id: string;
  readonly codeConceptId: string;
  readonly categoryConceptId?: string;
  readonly clinicalStatusConceptId?: string;
  readonly verificationStatusConceptId?: string;
  /** Decisión y evidencia de C3 (P41); `null` si nunca se decidió. */
  readonly verification?: DiagnosisVerification | null;
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
  /**
   * Only on a ruled-out one (REFUTED): the diagnosis that replaced it (patch
   * v4291). Absent if the rejection resolved no differential.
   */
  readonly replacedByConditionId?: string;
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
  /**
   * La consulta en la que se prescribió, si nació de una.
   *
   * El backend lo devuelve y este tipo no lo declaraba, así que el dato llegaba
   * y nadie podía leerlo con tipos: la ficha no tenía cómo agrupar las líneas
   * de una misma receta.
   */
  readonly encounterId?: string;
  /**
   * El motivo escrito a mano, cuando no hay condición registrada detrás.
   *
   * Es lo que el cliente pidió para los casos psiquiátricos y para quien «sólo
   * fue a que le receten». La API lo guarda en `medication_requests`
   * (`indicationText`, P24).
   */
  readonly indicationText?: string;
  readonly prescriberProfileId?: string;
  readonly doseText?: string;
  readonly frequencyText?: string;
  /** La cantidad que declara la receta, en la unidad que recetó el médico; ausente si no la declara. */
  readonly quantityDecimal?: number;
  readonly validFrom?: Date;
  readonly validTo?: Date;
  /** Indicaciones al paciente impresas en la receta (Patch v4.1.3). */
  readonly patientInstructionsText?: string;
  /**
   * El diagnóstico que motiva la receta — «para qué es» (Patch v4.1.6).
   *
   * ## Se escribía y no se leía
   *
   * El alta lo manda desde v4.1.6 (`NewMedicationRequest.indicationConditionId`)
   * y `GET /clinical/patients/:id/summary` lo devuelve —está en
   * `MedicationRequestSummaryDto` y en `clinical-read.service.ts`—, pero este
   * tipo no lo declaraba: el vínculo quedaba guardado en la base y desaparecía
   * de la pantalla en cuanto se recargaba. Es exactamente el síntoma de
   * «relación sólo visual» que la corrección del 10/09/2026 manda cerrar, y se
   * cierra declarándolo: los mapeadores del cliente propagan por `...resto`.
   *
   * Es un `clinical.conditions.id`, no un concepto de terminología: se resuelve
   * contra la lista de diagnósticos del propio expediente y no con
   * `TerminologyClient`.
   *
   * Ausente cuando la receta no tiene diagnóstico detrás, que es un caso
   * legítimo del contrato: una prescripción sintomática o profiláctica.
   */
  readonly indicationConditionId?: string;
  /**
   * The prescription that replaced this one (dose or drug change).
   *
   * `GET /clinical/patients/:id/summary` publishes it since 06/11/2026
   * (`MedicationRequestSummaryDto.replacedByRequestId`, absent if it was not
   * replaced). It is a `medication_requests.id` of the same record. The
   * summary does not publish the inverse side (`replacesRequestId`): whoever
   * needs «what it replaces» deduces it from this list.
   */
  readonly replacedByRequestId?: string;
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

/** Una fila de la nota médica de C1 (P39: `entries_json` de la versión). */
export interface MedicalNoteEntry {
  readonly label: string;
  readonly value: string;
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
  /**
   * Filas estructuradas de C1 de la versión vigente (P39). Ausente en las
   * notas SOAP de antes de C1, que se leen por su texto.
   */
  readonly entries?: readonly MedicalNoteEntry[];
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
  /** El diagnóstico del que cuelga, cuando el motivo es uno ya registrado. */
  readonly conditionId?: string;
  /**
   * El motivo escrito a mano, cuando no cuelga de un diagnóstico.
   *
   * Todavía sólo lo devuelve la maqueta: la lectura real de `chart` no lo trae.
   */
  readonly reasonText?: string;
  readonly goalText?: string;
  readonly startDate?: Date;
  readonly endDate?: Date;
  readonly activities: readonly CarePlanActivity[];
  readonly createdAt: Date;
}

/**
 * Un archivo gobernado de un documento del expediente (`ChartDocumentFileItemDto`
 * de la API). Se descarga por `GET /charts/documents/:id/files/:fileId/content`.
 */
export interface ChartDocumentFile {
  readonly fileId: string;
  /** El documento en sí (`PRIMARY`) o lo que lo acompaña (`ATTACHMENT`). */
  readonly contentRole: 'PRIMARY' | 'ATTACHMENT';
  readonly ordinal?: number;
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
  /**
   * Los archivos del documento, ordenados por `ordinal` (CL-27). Antes
   * `toDocument` los descartaba y el expediente no podía volver a abrir lo que se
   * había subido.
   */
  readonly files?: readonly ChartDocumentFile[];
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
  /**
   * La respuesta del formulario médico de la que sale (instancia de `forms`).
   * En la cita es obligatoria (P43).
   */
  readonly formInstanceId?: string;
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
  /**
   * La condición clínica que motiva la receta — «para qué es» (Patch v4.1.6).
   *
   * Opcional de verdad: una receta sintomática o profiláctica no tiene
   * diagnóstico detrás y se registra igual. Cuando viaja, el servidor **exige
   * que la condición sea del mismo paciente** y responde `422
   * PRECONDITION_FAILED` si no lo es o no existe: una indicación que apunta al
   * diagnóstico de otra persona no es un dato incompleto sino uno falso, y
   * termina impreso en el papel.
   */
  readonly indicationConditionId?: string;
  /**
   * El motivo de la receta escrito a mano, para cuando no hay un diagnóstico
   * registrado detrás.
   *
   * El cliente lo pidió por su caso: «puede existir el caso que sólo se fue a
   * hacer recetar y no necesitaría diagnóstico existente previo, sobre todo
   * casos psiquiátricos».
   *
   * **Excluyente con `indicationConditionId`**, y el concepto gana si llegaran
   * los dos — el mismo criterio que `occupation_free_text` frente a
   * `occupation_concept_id` en `persons`.
   *
   * ⚠️ **Contra la API de hoy da 400**: `CreateMedicationRequestDto` no declara
   * la clave y el backend valida con `forbidNonWhitelisted`. Ver P24.
   */
  readonly indicationText?: string;
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
  /**
   * Certeza con la que nace. Sin declarar, el servidor lo registra confirmado;
   * un diagnóstico que sale de una sugerencia nace `PROVISIONAL` (presuntivo,
   * «en estudio») y el profesional lo confirma o lo descarta después.
   */
  readonly verificationStatus?: 'CONFIRMED' | 'PROVISIONAL';
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

/* FT-22 · Aspectos médicos del titular: contrato aparte, en su archivo. */
export * from './own-medical-aspects.types';
