/* ============================================================================
    Contratos del carril 17 — laboratorio farmacéutico y visitadores médicos.

    Espejan lo que devuelve `src/modules/pharma_lab` de la API. Los campos que
    viajan como texto ISO se convierten a `Date` en el cliente, así que acá ya
    figuran con su tipo final.

    **No hay ningún tipo de paciente, receta ni diagnóstico en este archivo, y no
    puede haberlo.** El visitador no accede a información clínica (spec 5316-5318);
    que su superficie de datos no la nombre es la mitad de esa garantía — la otra
    mitad la pone el backend.
    ========================================================================== */

/** Organización de tipo laboratorio farmacéutico. */
export interface PharmaLab {
  readonly id: string;
  readonly tenantId: string;
  readonly labTypeConceptId: string;
  readonly legalName: string;
  readonly tradeName?: string;
  readonly taxId?: string;
  readonly description?: string;
  readonly researchAreas?: readonly string[];
  readonly statusConceptId: string;
}

/** Colaborador del laboratorio. */
export interface PharmaLabStaff {
  readonly id: string;
  readonly pharmaLabId: string;
  readonly userId: string;
  readonly staffTypeConceptId: string;
  readonly position?: string;
  readonly area?: string;
  readonly hiredOn: string;
  readonly endedOn?: string;
  readonly permissions?: readonly string[];
  readonly statusConceptId: string;
}

/** Visitador médico y su vinculación. */
export interface MedicalVisitor {
  readonly id: string;
  readonly pharmaLabId: string;
  readonly userId: string;
  readonly fullName: string;
  readonly internalCode: string;
  readonly position?: string;
  readonly region?: string;
  readonly commercialArea?: string;
  readonly assignedZone?: string;
  readonly startedOn: string;
  readonly endedOn?: string;
  readonly identityVerificationConceptId: string;
  readonly contractVerificationConceptId: string;
  readonly credentialVerificationConceptId: string;
  readonly statusConceptId: string;
  readonly publiclyListed: boolean;
  readonly unlinkReason?: string;
}

/** Resultado de desvincular a un visitador: qué se revocó, además del estado. */
export interface UnlinkResult {
  readonly id: string;
  readonly statusConceptId: string;
  readonly revokedSessions: number;
  readonly revokedRefreshTokens: number;
  readonly cancelledVisitRequests?: number;
}

/** Medicamento del catálogo del laboratorio. */
export interface PharmaProduct {
  readonly id: string;
  readonly pharmaLabId: string;
  readonly tradeName: string;
  readonly activeIngredient: string;
  readonly presentation?: string;
  readonly concentration?: string;
  readonly authorizedIndication?: string;
  readonly regulatoryStatusConceptId: string;
  readonly sanitaryRegistryNumber?: string;
  readonly registryExpiresOn?: string;
  readonly disclosureLevelConceptId: string;
  readonly versionNo: number;
}

/** Material informativo para doctores. */
export interface InformationalMaterial {
  readonly id: string;
  readonly pharmaLabId: string;
  readonly pharmaProductId?: string;
  readonly title: string;
  readonly kindConceptId: string;
  readonly version: string;
  readonly authorName?: string;
  readonly validFrom?: string;
  readonly validTo?: string;
  readonly statusConceptId: string;
  readonly approvedAt?: Date | null;
}

/** Ventana semanal en la que un doctor recibe visitadores. */
export interface VisitWindow {
  readonly weekday: number;
  readonly startTime: string;
  readonly endTime: string;
  readonly slotDurationMinutes: number;
  readonly modalityConceptId: string;
  readonly location?: string;
}

/** Agenda de visitas publicada de un doctor. */
export interface PublishedAgenda {
  readonly doctorUserId: string;
  readonly timeZone: string;
  readonly autoConfirm: boolean;
  readonly minNoticeHours: number;
  readonly rescheduleCutoffHours: number;
  readonly maxDurationMinutes?: number;
  readonly allowedSpecialtyConceptIds?: readonly string[];
  readonly windows: readonly VisitWindow[];
}

/** Solicitud de visita médica. */
export interface VisitRequest {
  readonly id: string;
  readonly medicalVisitorId: string;
  readonly pharmaLabId: string;
  readonly doctorUserId: string;
  readonly doctorTenantId?: string;
  readonly reason: string;
  readonly requestedStartAt: Date;
  readonly durationMinutes: number;
  readonly timeZone: string;
  readonly modalityConceptId: string;
  readonly location?: string;
  readonly observations?: string;
  readonly statusConceptId: string;
  readonly proposedStartAt?: Date | null;
  readonly confirmedAt?: Date | null;
}

/** Registro de una visita realizada. */
export interface VisitRecord {
  readonly id: string;
  readonly visitRequestId: string;
  readonly doctorUserId: string;
  readonly medicalVisitorId: string;
  readonly pharmaLabId: string;
  readonly occurredAt: Date;
  readonly location?: string;
  readonly topicsDiscussed?: string;
  readonly nextAction?: string;
  readonly visitorAttendanceConceptId: string;
  readonly doctorAttendanceConceptId: string;
  readonly confirmationConceptId: string;
}

/** Promedios de las calificaciones de un laboratorio. */
export interface RatingAggregate {
  readonly sampleSize: number;
  readonly punctuality: number | null;
  readonly informationQuality: number | null;
  readonly clarity: number | null;
  readonly relevance: number | null;
  readonly professionalConduct: number | null;
  readonly materialUsefulness: number | null;
  readonly overallSatisfaction: number | null;
}

/** Reporte de farmacovigilancia. */
export interface PharmacovigilanceReport {
  readonly id: string;
  readonly pharmaLabId: string;
  readonly pharmaProductId: string;
  readonly caseCode: string;
  readonly batchNumber?: string;
  readonly eventDate: string;
  readonly eventTypeConceptId: string;
  readonly description: string;
  readonly severityConceptId: string;
  readonly statusConceptId: string;
}

/** Documento del repositorio legal y regulatorio. */
export interface RegulatoryDocument {
  readonly id: string;
  readonly pharmaLabId: string;
  readonly name: string;
  readonly documentTypeConceptId: string;
  readonly code?: string;
  readonly currentVersion: string;
  readonly issuerName?: string;
  readonly issuedOn?: string;
  readonly expiresOn?: string;
  readonly statusConceptId: string;
}

/** Cuerpo de una solicitud de visita. */
export interface CreateVisitRequestBody {
  readonly doctorUserId: string;
  readonly doctorTenantId?: string;
  readonly reason: string;
  readonly requestedStartAt: string;
  readonly durationMinutes: number;
  readonly modalityConceptId: string;
  readonly location?: string;
  readonly observations?: string;
  readonly topics: readonly { readonly pharmaProductId?: string; readonly topic?: string }[];
}

/** Cuerpo de la configuración de agenda de visitas del doctor. */
export interface PutVisitPolicyBody {
  readonly tenantId?: string;
  readonly timeZone?: string;
  readonly autoConfirm?: boolean;
  readonly maxVisitsPerDay?: number;
  readonly minNoticeHours?: number;
  readonly rescheduleCutoffHours?: number;
  readonly maxDurationMinutes?: number;
  readonly windows: readonly VisitWindow[];
}

/** Respuesta estándar de creación. */
export interface CreatedResource {
  readonly id: string;
}

/** Respuesta estándar de una transición de estado. */
export interface TransitionResult {
  readonly id: string;
  readonly statusConceptId: string;
}
