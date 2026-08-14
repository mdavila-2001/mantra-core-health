/* ============================================================================
    Tipos de la vista para el **histórico de procedimientos** (punto 7):
    `procedures_perioperative` (M53) del lado quirúrgico y el registro
    odontológico, que vive en el mismo módulo del backend.

    Las fechas llegan como texto ISO y salen de acá como `Date`: la pantalla
    formatea, no interpreta cadenas.
    ========================================================================== */

/** Cabecera de un caso quirúrgico, tal como sale de la agenda. */
export interface SurgicalCase {
  readonly id: string;
  readonly caseNumber: string;
  readonly patientProfileId: string;
  readonly primarySurgeonProfileId?: string;
  readonly operatingRoomId?: string;
  readonly statusConceptId: string;
  readonly scheduledStartAt?: Date;
  readonly scheduledEndAt?: Date;
}

/** Un integrante del equipo del caso. */
export interface CaseTeamMember {
  readonly id: string;
  readonly practitionerProfileId: string;
  readonly teamRoleConceptId: string;
  readonly statusConceptId: string;
}

/** Un paso de la intervención. */
export interface OperativeStep {
  readonly id: string;
  readonly stepNumber: number;
  readonly stepCodeConceptId: string;
  readonly description: string;
  readonly performedByProfileId?: string;
  readonly bodySiteConceptId?: string;
  readonly lateralityConceptId?: string;
  readonly statusConceptId: string;
  readonly startedAt?: Date;
  readonly endedAt?: Date;
}

/** Un hallazgo intraoperatorio. */
export interface OperativeFinding {
  readonly id: string;
  readonly operativeStepId?: string;
  readonly findingCodeConceptId: string;
  readonly findingText: string;
  readonly bodySiteConceptId?: string;
  readonly lateralityConceptId?: string;
  readonly severityConceptId?: string;
  readonly recordedByProfileId?: string;
  readonly recordedAt: Date;
}

/**
 * Un identificador de implante: UDI, lote o número de serie.
 *
 * Es lo que hace trazable a un implante. Una alerta de retiro del mercado se
 * resuelve por lote, no por modelo.
 */
export interface ImplantIdentifier {
  readonly id: string;
  readonly identifierTypeConceptId: string;
  readonly identifierValue: string;
  readonly issuingSystem?: string;
  readonly lotNumber?: string;
  readonly serialNumber?: string;
  readonly expirationDate?: Date;
}

/** Un implante colocado en la intervención, con sus identificadores. */
export interface ProcedureImplant {
  readonly id: string;
  readonly procedureId: string;
  readonly implantDeviceId: string;
  readonly implantRoleConceptId: string;
  readonly bodySiteConceptId?: string;
  readonly lateralityConceptId?: string;
  readonly implantedAt: Date;
  readonly explantedAt?: Date;
  readonly statusConceptId?: string;
  readonly identifiers: readonly ImplantIdentifier[];
}

/** Una versión del informe operatorio. */
export interface OperativeReport {
  readonly id: string;
  readonly reportVersion: number;
  readonly statusConceptId: string;
  readonly signedAt?: Date;
}

/**
 * El detalle agregado de un caso quirúrgico.
 *
 * Llega en una sola respuesta a propósito: quien abre un caso necesita a la vez
 * su equipo, sus pasos, sus hallazgos y sus implantes, y encadenar ocho lecturas
 * desde la pantalla la dejaría mostrando el caso a medias si una fallara.
 */
export interface SurgicalCaseDetail {
  readonly case: SurgicalCase;
  readonly team: readonly CaseTeamMember[];
  readonly operativeSteps: readonly OperativeStep[];
  readonly findings: readonly OperativeFinding[];
  readonly implants: readonly ProcedureImplant[];
  readonly operativeReports: readonly OperativeReport[];
}

/** Una página de la agenda quirúrgica, con su total sin paginar. */
export interface SurgicalCasePage {
  readonly items: readonly SurgicalCase[];
  readonly total: number;
}

/** El sitio tratado de un procedimiento odontológico: pieza o cuadrante. */
export interface DentalSite {
  readonly id: string;
  readonly bodySiteConceptId: string;
  readonly description?: string;
}

/** Un procedimiento odontológico del histórico. */
export interface DentalProcedure {
  readonly id: string;
  readonly patientProfileId: string;
  readonly procedureCodeConceptId: string;
  readonly statusConceptId: string;
  readonly performerProfileId?: string;
  readonly encounterId?: string;
  readonly noteText?: string;
  readonly performedAt?: Date;
  readonly createdAt: Date;
  readonly sites: readonly DentalSite[];
}

/** Una página del histórico odontológico, con su total sin paginar. */
export interface DentalProcedurePage {
  readonly items: readonly DentalProcedure[];
  readonly total: number;
}

/** Una opción del catálogo odontológico. */
export interface DentalCatalogEntry {
  readonly conceptId: string;
  readonly code: string;
  readonly display: string;
}

/**
 * El catálogo odontológico.
 *
 * Lo sirve el backend desde su seed de conceptos. La alternativa —llevar los
 * uuid escritos acá— los desincronizaría el día que se agregue un código, y son
 * identificadores derivados que ningún humano puede verificar de un vistazo.
 */
export interface DentalCatalog {
  readonly procedureCodes: readonly DentalCatalogEntry[];
  readonly teeth: readonly DentalCatalogEntry[];
  readonly quadrants: readonly DentalCatalogEntry[];
}

/** Cuerpo del alta de un procedimiento odontológico. */
export interface NewDentalProcedure {
  readonly patientProfileId: string;
  readonly procedureCodeConceptId: string;
  readonly performerProfileId?: string;
  /** Pieza en notación FDI o cuadrante; del catálogo, no cualquier concepto. */
  readonly toothSiteConceptId?: string;
  readonly siteDetail?: string;
  readonly noteText?: string;
  readonly encounterId?: string;
  readonly performedAt?: string;
}

/** Lo que devuelve el alta. */
export interface DentalProcedureRegistration {
  readonly id: string;
  readonly patientProfileId: string;
  readonly statusConceptId: string;
  readonly createdAt: Date;
}

/** Filtros del histórico: los dos endpoints comparten forma. */
export interface PatientHistoryQuery {
  readonly patientProfileId: string;
  /** Tope de la página. La API aplica 50 si se omite. */
  readonly limit?: number;
}
