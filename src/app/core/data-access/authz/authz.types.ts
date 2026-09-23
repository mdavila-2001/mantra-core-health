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
 * No lleva especialidades: las elige el **paciente** al aceptar (FT-07-R06),
 * no quien pide. El tipo de relación queda en el default del backend
 * (`TREATING`) porque la pantalla no ofrece otro.
 */
export interface CareRelationshipRequestInput {
  readonly tenantId: string;
  readonly patientProfileId: string;
  readonly reasonText?: string;
}

/** Las dos respuestas posibles del paciente, con los nombres del contrato. */
export type CareRelationshipDecision = 'ACCEPT' | 'REJECT';

/** Lo que manda el paciente al decidir (`POST /authz/care-relationships/:id/respond`). */
export interface CareRelationshipRespondInput {
  readonly decision: CareRelationshipDecision;
  /** Sólo con `ACCEPT`: qué áreas autoriza. Aceptar no es todo o nada. */
  readonly authorizedSpecialtyConceptIds?: readonly string[];
}
