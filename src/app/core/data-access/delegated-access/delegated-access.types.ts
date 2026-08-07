/**
 * Tipos de la vista para `delegated_access` (M29): delegación de acceso con
 * alcance, sets de permisos versionados y grants temporales.
 *
 * Los literales replican los `@IsIn` de los DTOs del backend. Los tres
 * conjuntos de roles son parecidos pero **no iguales** (uno tiene `STAFF`,
 * otro no tiene `BILLING`): unificarlos dejaría pasar valores que el backend
 * rechaza con 400.
 */

/** Propósito de uso de un grant o de una evaluación. */
export type PurposeOfUse = 'TREATMENT' | 'BILLING' | 'OPERATIONS';

/** Tipo de recurso que acota un grant. */
export type GrantResourceType = 'CLINICAL_NOTE' | 'APPOINTMENT' | 'PRESCRIPTION';

/** Veredicto del aprobador sobre una solicitud de acceso. */
export type AccessRequestDecision = 'APPROVED' | 'DENIED';

/** Alcance de una asignación de usuario de organización. */
export type OrgAccessScope = 'TENANT' | 'PRACTICE' | 'SITE' | 'UNIT';

/** Rol de una asignación de usuario de organización. */
export type OrgAssignmentRole = 'STAFF' | 'SECRETARY' | 'ASSISTANT' | 'NURSE' | 'BILLING';

/** Tipo de delegado de un set de permisos. Sin `STAFF`. */
export type PermissionSetDelegateType = 'SECRETARY' | 'ASSISTANT' | 'NURSE' | 'BILLING';

/** Rol del delegado de un practitioner. Sin `STAFF` ni `BILLING`. */
export type DelegateRole = 'ASSISTANT' | 'SECRETARY' | 'NURSE';

/** Qué pacientes alcanza la delegación. */
export type PatientScope = 'ASSIGNED' | 'ALL';

/** Qué citas alcanza la delegación. */
export type AppointmentScope = 'TODAY' | 'ALL';

/** Alta de una asignación de usuario de organización. Todo es opcional. */
export interface NewOrgUserAssignment {
  readonly role?: OrgAssignmentRole;
  readonly accessScope?: OrgAccessScope;
  readonly practiceId?: string;
  readonly practiceSiteId?: string;
  readonly clinicalUnitId?: string;
  readonly careSpaceId?: string;
  readonly diagnosticUnitId?: string;
  readonly pharmacyId?: string;
  readonly supervisorUserId?: string;
  readonly validFrom?: string;
  readonly validTo?: string;
}

/**
 * Reasignación o suspensión de una asignación. El backend exige al menos uno
 * de `supervisorUserId`, `accessScope` o `suspend`; `expectedRowVersion` es la
 * concurrencia optimista (409 si no coincide).
 */
export interface OrgUserAssignmentUpdate {
  readonly supervisorUserId?: string;
  readonly accessScope?: OrgAccessScope;
  readonly suspend?: boolean;
  readonly expectedRowVersion?: number;
}

/** Alta de una delegación de practitioner. */
export interface NewPractitionerDelegate {
  readonly practitionerRoleAssignmentId: string;
  readonly delegateUserAssignmentId: string;
  readonly delegatedPermissionSetId: string;
  readonly delegateRole?: DelegateRole;
  readonly patientScope?: PatientScope;
  readonly appointmentScope?: AppointmentScope;
  readonly mayViewClinicalContent?: boolean;
  readonly mayEditDrafts?: boolean;
  readonly validFrom?: string;
  readonly validTo?: string;
}

/** Solicitud de acceso delegado, sujeta a aprobación previa. */
export interface NewAccessRequest {
  readonly requestedPermissionId: string;
  readonly patientProfileId?: string;
  readonly encounterId?: string;
  readonly reasonText?: string;
}

/** Grant delegado por propósito. `validTo` es obligatorio: siempre expira. */
export interface NewGrant {
  readonly purpose: PurposeOfUse;
  readonly validTo: string;
  readonly validFrom?: string;
  readonly patientProfileId?: string;
  readonly encounterId?: string;
  readonly resourceType?: GrantResourceType;
}

/** Revocación de una delegación. El motivo queda en la auditoría. */
export interface DelegationRevocation {
  readonly reason?: string;
}

/** Resolución de una solicitud: si aprueba, estos campos acotan el grant. */
export interface AccessRequestResolution {
  readonly decision: AccessRequestDecision;
  readonly purpose?: PurposeOfUse;
  readonly resourceType?: GrantResourceType;
  readonly validTo?: string;
  readonly encounterId?: string;
}

/** Consulta de qué puede hacer un delegado, por propósito. */
export interface ActorEvaluation {
  readonly practitionerDelegateAssignmentId: string;
  readonly purpose: PurposeOfUse;
  readonly permissionId?: string;
  readonly patientProfileId?: string;
  readonly encounterId?: string;
  readonly resourceType?: GrantResourceType;
}

/** Ítem de permiso de una versión de set. */
export interface PermissionSetItem {
  readonly permissionId: string;
  readonly constraintJson?: Record<string, unknown>;
  readonly requiresStepUpAuthentication?: boolean;
}

/** Alta de un set de permisos delegados con su versión 1. */
export interface NewPermissionSet {
  readonly tenantId: string;
  readonly code: string;
  readonly name: string;
  readonly delegateType?: PermissionSetDelegateType;
  readonly description?: string;
  readonly items: readonly PermissionSetItem[];
}

/** Nueva versión de un set: reemplazo all-or-nothing de sus ítems. */
export interface NewSetVersion {
  readonly items: readonly PermissionSetItem[];
}

/**
 * Recurso recién creado. `status` es un UUID de concepto opaco (el módulo no
 * expone cómo resolverlo a texto); se muestra como dato técnico, no se traduce.
 */
export interface CreatedResource {
  readonly id: string;
  readonly status: string;
  readonly createdAt: Date;
}

/** Versión de set publicada. */
export interface PermissionSetVersion {
  readonly id: string;
  readonly versionNumber: number;
  readonly itemCount: number;
}

/** Resultado plano de una operación sin recurso nuevo. */
export interface OperationResult {
  readonly ok: boolean;
}

/** Resultado de resolver una solicitud. `grantId` solo si fue aprobada. */
export interface AccessRequestDecisionResult {
  readonly requestId: string;
  readonly decision: string;
  readonly grantId?: string;
}

/** Resultado del barrido de expiración. */
export interface ExpirySweepResult {
  readonly expiredGrants: number;
  readonly expiredDelegations: number;
  readonly expiredOrgAssignments: number;
}

/** Veredicto de la evaluación del actor efectivo. */
export interface ActorEvaluationResult {
  readonly allowed: boolean;
  readonly requiresStepUp: boolean;
  readonly reason?: string;
}
