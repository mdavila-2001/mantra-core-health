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
