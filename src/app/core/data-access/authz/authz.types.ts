/* ============================================================================
    Tipos de la vista para `authz` (M06) — las bases legítimas de acceso.

    No son permisos: son el **motivo** por el que alguien puede mirar la historia
    de otra persona. El PDP los consume; esta capa sólo los muestra.
    ========================================================================== */

/**
 * Una relación asistencial (C-06 / CAN-AUTH-001).
 *
 * Vigente no es un campo: se deriva de la ventana `validFrom`–`validTo` **y**
 * del estado. Ver `esVigente` en la pantalla que la consuma; poner un booleano
 * acá lo congelaría en el momento de la lectura.
 */
export interface CareRelationship {
  readonly id: string;
  readonly patientProfileId: string;
  readonly practitionerProfileId: string;
  readonly relationshipTypeConceptId: string;
  readonly statusConceptId: string;
  /** Propósito de uso al que queda acotada, si lo tiene. */
  readonly purposeConceptId?: string;
  readonly validFrom: Date;
  readonly validTo?: Date;
}

/** Una representación legal del paciente (C-07 / A-03). */
export interface LegalRepresentation {
  readonly id: string;
  readonly patientProfileId: string;
  readonly representativeUserId: string;
  readonly representationTypeConceptId: string;
  readonly statusConceptId: string;
  /** Referencia al documento que la respalda. */
  readonly documentRef?: string;
  readonly validFrom: Date;
  readonly validTo?: Date;
}

/** Ambas lecturas piden organización y paciente: no hay listado global. */
export interface AuthzScopeQuery {
  readonly tenantId: string;
  readonly patientProfileId: string;
}

/* ---- FT-07-R05/R06/R07 · el vínculo por consentimiento ------------------- */

/**
 * Lo que manda el profesional al pedir el vínculo
 * (`POST /authz/care-relationships/request`).
 *
 * No lleva especialidades: el pedido por especialidad es otro circuito
 * (`/consent/practitioner-access-requests`). Without `relationshipType` the
 * backend keeps its default (`TREATING`); `PRIMARY` asks to be the patient's
 * primary practitioner (cabecera).
 */
export interface CareRelationshipRequestInput {
  readonly tenantId: string;
  readonly patientProfileId: string;
  readonly reasonText?: string;
  readonly relationshipType?: 'PRIMARY';
}

/** Las dos respuestas posibles del paciente, con los nombres del contrato. */
export type CareRelationshipDecision = 'ACCEPT' | 'REJECT';

/** Lo que manda el paciente al decidir (`POST /authz/care-relationships/:id/respond`). */
export interface CareRelationshipRespondInput {
  readonly decision: CareRelationshipDecision;
  /** Sólo con `ACCEPT`: qué áreas autoriza. Aceptar no es todo o nada. */
  readonly authorizedSpecialtyConceptIds?: readonly string[];
}

/* ---- The unified inbox (`/authz/me/access-requests`) --------------------- */

/** What the request grants: primary practitioner, care episode, or some specialties only. */
export type AccessRequestKind = 'CABECERA' | 'GRANULAR' | 'ATENCION';

/** Seen from the session: the other side asked (`RECEIVED`) or the session did (`SENT`). */
export type AccessRequestDirection = 'RECEIVED' | 'SENT';

export type AccessRequestStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'REVOKED' | 'EXPIRED';

/** The session roles the practitioner's inbox (`/authz/practitioners/me/access-requests`) accepts. */
export const PRACTITIONER_INBOX_ROLES: readonly string[] = ['CLINICIAN', 'PRACTITIONER'];

/**
 * One row of the inbox, for the patient or for the practitioner. Only the
 * active tenant: the API does not mix organizations in one list.
 */
export interface AccessRequestItem {
  readonly id: string;
  readonly kind: AccessRequestKind;
  readonly direction: AccessRequestDirection;
  /** The other side: the practitioner for the patient, the patient for the practitioner. */
  readonly counterpart: { readonly profileId: string; readonly displayName: string };
  readonly requestedAt: Date;
  /** Absent while nobody decided. */
  readonly decidedAt?: Date;
  readonly status: AccessRequestStatus;
  readonly requestedSpecialtyConceptIds: readonly string[];
  readonly authorizedSpecialtyConceptIds: readonly string[];
}

/* ---- BR-20 · «Quién ve mi historia» -------------------------------------- */

/** Estado legible de un acceso, con la vigencia ya considerada por la API. */
export type AccessState = 'ACTIVE' | 'REVOKED' | 'EXPIRED' | 'OTHER';

/** Una relación asistencial vista por el paciente, con el nombre del profesional. */
export interface MyCareRelationship {
  readonly id: string;
  readonly tenantId: string;
  readonly practitionerProfileId: string;
  readonly practitionerName?: string;
  readonly state: AccessState;
  readonly validFrom: Date;
  readonly validTo?: Date;
  readonly purposeConceptId?: string;
}

/** Un acceso clínico concedido sobre la historia del paciente. */
export interface MyClinicalGrant {
  readonly id: string;
  readonly tenantId: string;
  readonly grantedUserId: string;
  readonly grantedName?: string;
  /** `true` si es un acceso de emergencia (break-the-glass). */
  readonly isEmergency: boolean;
  readonly state: AccessState;
  readonly validFrom: Date;
  readonly validTo: Date;
}

/** Lo que ve el titular en «Quién ve mi historia». */
export interface MyClinicalAccess {
  readonly careRelationships: readonly MyCareRelationship[];
  readonly grants: readonly MyClinicalGrant[];
}

/**
 * El acceso de emergencia (`POST /authz/patients/:id/break-the-glass`).
 *
 * `justification` es obligatoria y de al menos 10 caracteres: sin ella la API
 * responde 400 y no crea nada. La ventana es corta (60 minutos por defecto).
 */
export interface BreakTheGlassInput {
  readonly tenantId: string;
  readonly justification: string;
  readonly windowMinutes?: number;
  readonly encounterId?: string;
}
