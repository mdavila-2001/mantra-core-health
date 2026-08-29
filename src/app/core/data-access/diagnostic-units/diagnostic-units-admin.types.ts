/* ============================================================================
    Contratos de la consola de administración del laboratorio — CARRIL 16.

    Espejo de `DiagnosticUnitAdminListDto` / `DiagnosticUnitAdminDetailDto`
    (`GET /diagnostic-units/administration` y `/:id/administration`).

    Van en un archivo aparte de `diagnostic-units.types.ts` —el directorio
    público— porque son **respuestas distintas del mismo módulo**: el directorio
    sólo trae lo publicado y sin personal, la administración trae todo y con
    personal. Fundirlos obligaría al directorio, que es la vista del paciente, a
    arrastrar tipos de precios internos y de permisos de firma que no le
    corresponde conocer.

    Las fechas viajan como cadena ISO y **no** se convierten a `Date`: acá se
    muestran y se ordenan, nunca se hace aritmética con ellas — los días que
    faltan hasta un vencimiento o una calibración los calcula el servidor.
    ========================================================================== */

import type { DiagnosticConcept } from './diagnostic-units.types';

/** Unidad tal como la ve quien la administra. */
export interface DiagnosticUnitAdminItem {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly type: DiagnosticConcept;
  readonly status: DiagnosticConcept;
  readonly verificationStatus: DiagnosticConcept;
  /**
   * Si hoy aparece en el directorio público.
   *
   * Lo decide el servidor con la misma regla que aplica el directorio. La
   * consola lo muestra y no lo recalcula: dos implementaciones de la misma
   * regla acabarían diciendo cosas distintas.
   */
  readonly publiclyListed: boolean;
  readonly siteCount: number;
  readonly studyCount: number;
  readonly equipmentCount: number;
  readonly acceptsExternalOrders: boolean | null;
  readonly walkInAvailable: boolean | null;
  readonly homeCollectionAvailable: boolean | null;
}

/** Respuesta de `GET /diagnostic-units/administration`. */
export interface DiagnosticUnitAdminList {
  readonly items: readonly DiagnosticUnitAdminItem[];
  readonly count: number;
}

/** Sede del laboratorio. */
export interface DiagnosticUnitAdminSite {
  readonly id: string;
  readonly practiceSiteId: string;
  readonly code: string;
  readonly name: string;
  readonly role: DiagnosticConcept;
  readonly accessionPrefix: string | null;
  readonly sampleCollectionAvailable: boolean | null;
  readonly imagingAvailable: boolean | null;
  readonly status: DiagnosticConcept;
}

/** Equipo instalado, con su ventana de calibración. */
export interface DiagnosticUnitAdminEquipment {
  readonly id: string;
  readonly siteId: string;
  readonly type: DiagnosticConcept;
  readonly manufacturer: string | null;
  readonly model: string | null;
  readonly serialNumber: string | null;
  readonly modality: DiagnosticConcept | null;
  readonly operationalStatus: DiagnosticConcept;
  readonly lastCalibrationAt: string | null;
  readonly nextCalibrationDueAt: string | null;
  /** Días hasta la próxima calibración; negativo si ya se pasó. */
  readonly daysToCalibration: number | null;
}

/** Precio de un estudio dentro de un cronograma. */
export interface DiagnosticUnitAdminPrice {
  readonly id: string;
  readonly scheduleId: string;
  readonly scheduleCode: string;
  /** `false` en los cronogramas internos, que el directorio no publica. */
  readonly schedulePublic: boolean;
  readonly versionNumber: number;
  readonly baseAmount: string;
  readonly patientAmount: string | null;
  readonly insurerAmount: string | null;
  readonly currency: DiagnosticConcept | null;
  readonly effectiveFrom: string;
  readonly effectiveTo: string | null;
  readonly status: DiagnosticConcept;
}

/** Estudio del catálogo, en cualquier estado. */
export interface DiagnosticUnitAdminStudy {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly siteId: string | null;
  readonly modality: DiagnosticConcept | null;
  readonly specimenType: DiagnosticConcept | null;
  readonly preparationInstructions: string | null;
  readonly expectedDurationMinutes: number | null;
  readonly expectedTurnaroundMinutes: number | null;
  readonly requiresMedicalOrder: boolean | null;
  readonly requiresPriorAuthorization: boolean | null;
  readonly homeCollectionEligible: boolean | null;
  readonly status: DiagnosticConcept;
  readonly prices: readonly DiagnosticUnitAdminPrice[];
}

/** Acreditación o documento legal del laboratorio. */
export interface DiagnosticUnitAdminAccreditation {
  readonly id: string;
  readonly siteId: string | null;
  readonly type: DiagnosticConcept;
  readonly number: string | null;
  readonly evidenceFileId: string | null;
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly daysToExpiry: number | null;
  readonly verificationStatus: DiagnosticConcept;
}

/** Integrante del personal del laboratorio. */
export interface DiagnosticUnitAdminStaff {
  readonly id: string;
  readonly practitionerRoleAssignmentId: string;
  readonly practitionerProfileId: string | null;
  readonly practitionerName: string | null;
  readonly siteId: string | null;
  readonly assignmentRole: DiagnosticConcept | null;
  readonly specialty: DiagnosticConcept | null;
  /** Permiso que separa a un bioquímico de un técnico de toma de muestras. */
  readonly mayValidateResults: boolean | null;
  readonly maySignReports: boolean | null;
  readonly validFrom: string | null;
  readonly validTo: string | null;
  readonly status: DiagnosticConcept;
}

/** Respuesta de `GET /diagnostic-units/:id/administration`. */
export interface DiagnosticUnitAdminDetail extends DiagnosticUnitAdminItem {
  readonly sites: readonly DiagnosticUnitAdminSite[];
  readonly equipment: readonly DiagnosticUnitAdminEquipment[];
  readonly studies: readonly DiagnosticUnitAdminStudy[];
  readonly accreditations: readonly DiagnosticUnitAdminAccreditation[];
  readonly staff: readonly DiagnosticUnitAdminStaff[];
}

/* ============================================================================
    Cuerpos y respuestas de lo que la consola escribe: publicar la unidad,
    sumar y retirar estudios, crear tarifarios y versionar precios.

    Los cuerpos declaran **sólo los campos que esta consola manda**, con el
    nombre exacto del DTO de la API. Copiar el DTO entero tentaría a rellenar
    campos que ninguna pantalla llena, y un campo que nadie escribe es un
    contrato que nadie mantiene.

    Las respuestas devuelven los estados como **concept id crudo** —un uuid— y
    no como `DiagnosticConcept` con su etiqueta: es lo que emiten los DTO de
    escritura de la API. Por eso ninguna de estas respuestas se pinta en
    pantalla; lo que se muestra después de escribir es la ficha recargada, que
    sí trae los conceptos resueltos.
    ========================================================================== */

/** Cuerpo de `POST /diagnostic-units/{unitId}/study-offerings`. */
export interface CreateStudyOfferingInput {
  /** Código del estudio dentro de la unidad. Hasta 60 caracteres. */
  readonly studyCode: string;
  /** El estudio del catálogo, como `conceptId`. Nunca su etiqueta. */
  readonly studyConceptId: string;
  /** Nombre visible del estudio. Hasta 200 caracteres. */
  readonly displayName: string;
  readonly diagnosticUnitSiteId?: string;
  readonly preparationInstructions?: string;
  readonly requiresMedicalOrder?: boolean;
  readonly homeCollectionEligible?: boolean;
}

/** Cuerpo de `POST /diagnostic-units/{unitId}/price-schedules`. */
export interface CreatePriceScheduleInput {
  /** Código único del cronograma en la unidad. Hasta 60 caracteres. */
  readonly code: string;
  readonly diagnosticUnitSiteId?: string;
  /** Fecha y hora ISO. */
  readonly validFrom?: string;
  /** Fecha y hora ISO. */
  readonly validTo?: string;
  /** Si el directorio público puede mostrar sus precios. */
  readonly publicVisibility?: boolean;
}

/**
 * Cuerpo de `POST /price-schedules/{scheduleId}/study-prices`.
 *
 * Los importes viajan como **cadena numérica** y no como `number`: la API los
 * valida con `IsNumberString` y los persiste como decimal exacto. Pasarlos por
 * un `number` de JavaScript metería el redondeo binario en un importe.
 */
export interface CreateStudyPriceInput {
  readonly diagnosticStudyOfferingId: string;
  readonly baseAmount: string;
  readonly patientAmount?: string;
  readonly insurerAmount?: string;
  /** Entre 0 y 1, como cadena. */
  readonly discountFactor?: string;
  /** Fecha y hora ISO. */
  readonly effectiveFrom?: string;
}

/** Respuesta de `POST /diagnostic-units/{unitId}/verify-and-publish`. */
export interface DiagnosticUnitVerificationResult {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  /** Concept id del estado de verificación tras publicar. */
  readonly verificationStatus: string;
  /** Concept id del estado de la unidad. */
  readonly status: string;
  /** Perfil público proyectado, si la unidad no tenía uno. */
  readonly publicProfileId?: string;
  readonly siteCount: number;
  readonly accreditationCount: number;
}

/** Respuesta de `POST /diagnostic-units/{unitId}/study-offerings`. */
export interface StudyOfferingCreated {
  readonly id: string;
  readonly studyCode: string;
  /** Concept id del estado de la oferta. */
  readonly status: string;
  readonly componentCount: number;
}

/** Respuesta de `POST /diagnostic-units/{unitId}/price-schedules`. */
export interface PriceScheduleCreated {
  readonly id: string;
  readonly code: string;
  /** Concept id del estado del cronograma. */
  readonly status: string;
}

/** Respuesta de `POST /price-schedules/{scheduleId}/study-prices`. */
export interface StudyPriceCreated {
  readonly id: string;
  /** El precio es append-only: cada cambio es una versión nueva. */
  readonly versionNumber: number;
  /** Concept id del estado del precio. */
  readonly status: string;
  /** Fecha y hora ISO desde la que rige. */
  readonly effectiveFrom: string;
}

/** Resultado de las operaciones que sólo cambian un estado (cerrar, retirar). */
export interface AdminOperationResult {
  readonly ok: boolean;
}
