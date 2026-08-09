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
  readonly onsetAt?: Date;
  readonly resolvedAt?: Date;
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
  readonly limit: number;
  readonly truncated: readonly string[];
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
