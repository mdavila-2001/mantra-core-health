import { describeApiFailure } from '../../../../../core/http/api-failure';
import { rejectionReason } from '../../../../../core/data-access/authz-admin/authz-admin.client';
import type {
  InternalUser,
  RoleAssignment,
  RoleAssignmentReason,
} from '../../../../../core/data-access/authz-admin/authz-admin.types';

/* ============================================================================
    Lo que la pantalla de usuarios y roles explica, sin decidir nada.

    Un rechazo se explica por su motivo estable (`reason`), nunca por el texto
    del mensaje. Un motivo que no está acá cae en la descripción genérica del
    error, que conserva el código de soporte.
    ========================================================================== */

const REASON_MESSAGES: Readonly<Record<RoleAssignmentReason, string>> = {
  ROLE_ASSIGNMENT_GLOBAL_ROLE_WITH_SCOPE:
    'Este rol es de ámbito global: se asigna sin organización, sede ni consultorio. Atado a una organización dejaría de autorizar en las pantallas de plataforma. Elija «Toda la plataforma».',
  ROLE_ASSIGNMENT_ALREADY_ACTIVE: 'La persona ya tiene este rol activo en ese mismo alcance.',
  ROLE_ASSIGNMENT_ROLE_NOT_ASSIGNABLE: 'Este rol no se puede asignar a una persona.',
  ROLE_ASSIGNMENT_ROLE_NOT_FOUND: 'El rol ya no existe. Cierre el formulario y vuelva a abrirlo.',
  ROLE_ASSIGNMENT_INVALID_VALIDITY_WINDOW: 'El inicio de la vigencia tiene que ser anterior a su fin.',
  ROLE_ASSIGNMENT_MISSING_ROLE_REFERENCE: 'Elija el rol que va a asignar.',
  ROLE_ASSIGNMENT_NOT_FOUND: 'Esa asignación ya no existe o es de otra persona. La lista se actualizó.',
  ROLE_ASSIGNMENT_NOT_ACTIVE: 'Esa asignación ya no estaba activa. La lista se actualizó.',
  ROLE_ASSIGNMENT_USER_NOT_FOUND: 'Esa persona ya no existe.',
};

/** El texto de un rechazo de asignar o revocar, leído por su motivo. */
export function assignmentFailure(error: unknown, fallback: string): string {
  const reason = rejectionReason(error);
  if (reason !== null && reason in REASON_MESSAGES) {
    return REASON_MESSAGES[reason as RoleAssignmentReason];
  }
  return describeApiFailure(error, fallback);
}

/** ¿Este rechazo deja la lista vieja? Entonces hay que volver a leerla. */
export function failureNeedsReload(error: unknown): boolean {
  const reason = rejectionReason(error);
  return reason === 'ROLE_ASSIGNMENT_NOT_FOUND' || reason === 'ROLE_ASSIGNMENT_NOT_ACTIVE';
}

/**
 * Dónde vale una asignación, en palabras. Los identificadores de la
 * organización, la sede o el consultorio no se muestran: no le dicen nada a
 * una persona y la API todavía no devuelve sus nombres.
 */
export function scopeSummary(a: Pick<RoleAssignment, 'tenantId' | 'branchId' | 'practiceId' | 'appliesGlobally'>): string {
  if (a.practiceId !== null) return 'En un consultorio';
  if (a.branchId !== null) return 'En una sede';
  if (a.tenantId !== null) return 'En una organización';
  return a.appliesGlobally ? 'En toda la plataforma' : 'Sin organización';
}

/** Un rol global atado a una organización no autoriza en las rutas de plataforma: vale avisarlo. */
export function globalRoleTiedToTenant(a: Pick<RoleAssignment, 'roleScope' | 'appliesGlobally' | 'status'>): boolean {
  return a.roleScope === 'GLOBAL' && !a.appliesGlobally && a.status === 'ACTIVE';
}

/** Las asignaciones activas primero; dentro de cada grupo, la más nueva arriba. */
export function byRelevance(a: RoleAssignment, b: RoleAssignment): number {
  const active = Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE');
  return active !== 0 ? active : b.createdAt.getTime() - a.createdAt.getTime();
}

/** Los roles de una persona, para una celda: globales de plataforma y asignados. */
export function roleCodesOf(user: InternalUser): readonly string[] {
  return [...new Set([...user.globalRoles, ...user.assignments.map((a) => a.roleCode)])];
}
