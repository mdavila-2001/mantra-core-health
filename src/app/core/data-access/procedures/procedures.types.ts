/* ============================================================================
    Tipos de la vista para el **histórico de procedimientos** (punto 7):
    `procedures_perioperative` (M53) del lado quirúrgico y el registro
    odontológico, que vive en el mismo módulo del backend.

    Las fechas llegan como texto ISO y salen de acá como `Date`: la pantalla
    formatea, no interpreta cadenas.
    ========================================================================== */

import type { TurnoverCleaning } from '../operating-rooms/operating-rooms.types';

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
  /* ---- F4 · quirófanos (`CONTRATO-F2-F5.md` §F4.3), formas de `toSummary` +
     `CaseOrViewBuilder.fields` (API `3036730d2`). Opcionales: una API sin
     esos campos tiene que seguir pintándose, y nada se deriva de su ausencia. ---- */
  /** La sala resuelta (`{id, code, name}`). Sin ella, la pantalla la resuelve por `operatingRoomId`. */
  readonly operatingRoom?: CaseOperatingRoom;
  /** Inicio de la ventana reservada (inicio − preparación). */
  readonly reservedStartAt?: Date;
  /** Fin de la ventana reservada (fin + limpieza). */
  readonly reservedEndAt?: Date;
  readonly prepMinutes?: number;
  readonly cleanupMinutes?: number;
  /** El bloque en el que cae el caso (`{id, label}`), o ausente si va en agenda abierta. */
  readonly block?: CaseBlock;
  readonly encounterId?: string;
  /** Tipo de caso como concepto (`{code, display}`). */
  readonly caseType?: { readonly code: string; readonly display: string };
}

/** La sala de un caso, como la devuelve la API desde F4 (sin ruta del árbol). */
export interface CaseOperatingRoom {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  /** Sólo si alguna lectura la trae; la API de F4 no la manda. */
  readonly path?: string;
}

/** El bloque de un caso, con el rótulo de su dueño resuelto por la API. */
export interface CaseBlock {
  readonly id: string;
  readonly label: string;
}

/** Cuándo se completó cada fase del check-list (`CaseOrViewBuilder.detail`). */
export interface CaseChecklistSummary {
  readonly id: string;
  readonly signIn: { readonly completedAt: string | null };
  readonly timeOut: { readonly completedAt: string | null };
  readonly signOut: { readonly completedAt: string | null };
}

/** Tipo de caso del DTO de programación. */
export type SurgicalCaseType = 'ELECTIVE' | 'URGENT' | 'EMERGENCY';

/** Prioridad del DTO de programación. */
export type SurgicalCasePriority = 'ROUTINE' | 'URGENT' | 'STAT';

/** `POST /procedure-cases` (`ScheduleCaseDto`). */
export interface ScheduleCaseRequest {
  readonly custodianTenantId: string;
  readonly patientProfileId: string;
  readonly caseType: SurgicalCaseType;
  readonly priority: SurgicalCasePriority;
  readonly primarySurgeonProfileId: string;
  readonly practiceSiteId?: string;
  readonly operatingRoomId: string;
  readonly scheduledStartAt: string;
  readonly scheduledEndAt: string;
  readonly surgicalSpecialtyConceptId?: string;
  readonly urgencyReasonText?: string;
}

/** Lo que devuelve programar (`CaseResponseDto` + la ventana de F4). */
export interface ScheduledCase {
  readonly id: string;
  readonly caseNumber: string;
  readonly statusConceptId: string;
  readonly operatingRoomId: string;
  readonly reservedStartAt?: string;
  readonly reservedEndAt?: string;
}

/** Respuesta de un ítem del check-list, como se **manda** (`ChecklistResponseItemDto`). */
export type ChecklistResponseStatus = 'CONFIRMED' | 'NOT_APPLICABLE' | 'EXCEPTION';

/** Un ítem OMS con su respuesta, si ya la tiene (vista de `SafetyChecklistUseCases`). */
export interface ChecklistItem {
  readonly id: string;
  readonly code?: string;
  readonly prompt: string;
  readonly mandatory: boolean;
  /**
   * `status` llega como **UUID de concepto** (`responseStatusConceptId`); se
   * traduce con `checklistResponseCode` de `infra-concepts.ts`. La API no
   * devuelve el motivo de la excepción en esta vista.
   */
  readonly response: {
    readonly status: string;
    readonly respondedAt: string;
  } | null;
}

/** Una fase del check-list. */
export interface ChecklistPhaseView {
  readonly phase: 'SIGN_IN' | 'TIME_OUT' | 'SIGN_OUT';
  readonly completedAt: string | null;
  readonly items: readonly ChecklistItem[];
}

/** `POST /procedure-cases/:id/safety-checklists` y `GET …/:checklistId`. */
export interface SafetyChecklist {
  readonly id: string;
  readonly version: string;
  readonly phases: readonly ChecklistPhaseView[];
}

/** `POST …/safety-checklists/:checklistId/responses` (`SubmitChecklistPhaseDto`). */
export interface ChecklistPhaseSubmission {
  readonly phase: ChecklistPhaseView['phase'];
  readonly respondedByProfileId: string;
  readonly responses: readonly {
    readonly itemId: string;
    readonly status: ChecklistResponseStatus;
    readonly exceptionReason?: string;
  }[];
}

/** Lo que devuelve responder una fase. */
export interface ChecklistPhaseResult {
  readonly checklistId: string;
  readonly recorded: number;
  readonly phaseCompleted: boolean;
}

/** Un tiempo del caso ya registrado. */
export interface RoomEvent {
  readonly id: string;
  readonly eventCode: string;
  readonly occurredAt: string;
  readonly recordedByUserId?: string | null;
}

/** Lo que devuelve `POST /procedure-cases/:id/room-events`. */
export interface RoomEventResult {
  readonly utilizationEventId: string;
  readonly milestoneId: string | null;
  /** La orden de recambio que abrió la salida de sala (sólo en `PATIENT_OUT_OF_ROOM`). */
  readonly cleaningOrderId: string | null;
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
  /**
   * ¿La cabecera trajo el campo `checklist` (aunque sea `null`)? Distingue
   * «no tiene check-list» de «la API no lo informa» (pedido a A-F4).
   */
  readonly checklistReported?: boolean;
  /** El check-list del caso (detalle, no cabecera); `null` = no tiene. */
  readonly checklist?: CaseChecklistSummary | null;
  readonly team: readonly CaseTeamMember[];
  readonly operativeSteps: readonly OperativeStep[];
  readonly findings: readonly OperativeFinding[];
  readonly implants: readonly ProcedureImplant[];
  readonly operativeReports: readonly OperativeReport[];
  /**
   * Los tiempos de sala registrados (pedido a A-F4). **Ausente** = la API
   * todavía no los informa: la ficha lo dice y no deriva compuertas de un
   * arreglo vacío inventado.
   */
  readonly roomEvents?: readonly RoomEvent[];
  /**
   * La orden de recambio de la sala (pedido a A-F4). `null` = no hay;
   * ausente = la API no lo informa.
   */
  readonly turnoverCleaning?: TurnoverCleaning | null;
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

/**
 * Filtros de la **agenda quirúrgica**, la otra lectura de `GET
 * /procedure-cases`.
 *
 * Distinta de {@link PatientHistoryQuery} y no un supertipo suyo: aquélla es la
 * de la ficha de una persona y **exige** el paciente, ésta es la del profesional
 * y no lo admite como obligatorio. Fundirlas dejaría `patientProfileId`
 * opcional en la ficha, que es donde no puede faltar.
 */
export interface SurgicalAgendaQuery {
  readonly patientProfileId?: string;
  readonly primarySurgeonProfileId?: string;
  readonly operatingRoomId?: string;
  readonly statusConceptId?: string;
  /** Inicio de la ventana temporal, inclusive. */
  readonly from?: Date;
  /** Fin de la ventana temporal. */
  readonly to?: Date;
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Lo que el integrante contesta cuando **no** acepta (spec 164).
 *
 * Aceptar tiene camino propio porque es lo único que hace avanzar el caso;
 * estas tres comparten endpoint y se distinguen por el motivo que las acompaña.
 */
export type TeamParticipationResponse = 'DECLINE' | 'REQUEST_CHANGE' | 'UNAVAILABLE';

/** Lo que devuelve aceptar o responder a la participación. */
export interface TeamMemberResponse {
  readonly id: string;
  readonly procedureCaseId: string;
  readonly statusConceptId: string;
  readonly teamSize: number;
}
