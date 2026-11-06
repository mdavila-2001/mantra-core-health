import type { OrderAppointment } from '../diagnostic-units/center-schedule.types';
import type { PatientSettlementFields } from '../insurance/patient-insurance-settlement.types';
import type { AnalysisCategory } from './analysis-category.types';
import type { ServiceRequestPerformerFields } from './service-request-performer.types';
import type { StudyDetailRead } from './study-detail.types';

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
export interface PatientOrder extends PatientSettlementFields, ServiceRequestPerformerFields, StudyDetailRead {
  readonly id: string;
  readonly encounterId?: string;
  /**
   * The own diagnosis it was ordered for (patch v4291). The API publishes it
   * in `PatientOrderSummaryDto` since 06/11/2026; absent if the order did not
   * state it. It is a `clinical.conditions.id`: resolved against the diagnoses
   * the patient already sees in their summary.
   */
  readonly reasonConditionId?: string;
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
   * El turno que el paciente reservó en un centro para hacer este estudio.
   * `null` o ausente: todavía no reservó. Contrato del simulador, pendiente de
   * backend (P-CENTRO-HORARIOS).
   */
  readonly appointment?: OrderAppointment | null;
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
  /** La cuenta del profesional con acceso; la API la resuelve del perfil. */
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
