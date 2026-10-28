import { ROLE_ASSIGNMENT_STATUS } from '@core/data-access/practice-sites/role-assignment-concepts';
import type { MyRoleAssignment, PracticeSite } from '@core/data-access/practice-sites/practice-sites.types';
import { roleAssignmentState } from '@core/data-access/role-assignments/role-assignment-status';

import type { PractitionerOrganization } from './organization-select.types';

/**
 * Las organizaciones donde el médico puede publicar, con su consultorio propio
 * primero.
 *
 * - **Solo afiliaciones activas.** En una pendiente, rechazada o finalizada la
 *   organización todavía no lo aceptó, o ya no: ofrecerla sería ofrecer una
 *   puerta que la API va a cerrar.
 * - **Una por organización.** La API devuelve una fila por procedimiento, así
 *   que la misma clínica puede llegar varias veces. Queda la primera.
 * - **El consultorio propio no se repite.** Su práctica también tiene una
 *   afiliación activa (la crea el alta del consultorio); esa fila es «Mi
 *   consultorio» y no una organización más.
 *
 * @param assignments - Las afiliaciones del médico, en cualquier estado.
 * @param ownSite - Su sede propia, o `null` si no registró ninguna.
 */
export function practitionerOrganizationsOf(
  assignments: readonly MyRoleAssignment[],
  ownSite: PracticeSite | null,
): readonly PractitionerOrganization[] {
  const affiliated = uniqueByPractice(
    assignments.filter((assignment) => isActive(assignment) && !isOwnPractice(assignment, ownSite)),
  );
  return ownSite === null ? affiliated : [ownOfficeOf(ownSite), ...affiliated];
}

/**
 * Se decide por el código del estado. Las afiliaciones anteriores a las filas
 * por procedimiento no lo traen: para ellas queda el concepto.
 */
function isActive(assignment: MyRoleAssignment): boolean {
  return assignment.statusCode === undefined
    ? assignment.status === ROLE_ASSIGNMENT_STATUS.ACTIVE
    : roleAssignmentState(assignment.statusCode) === 'ACTIVE';
}

function isOwnPractice(assignment: MyRoleAssignment, ownSite: PracticeSite | null): boolean {
  return ownSite !== null && assignment.practiceId === ownSite.practiceId;
}

function uniqueByPractice(assignments: readonly MyRoleAssignment[]): readonly PractitionerOrganization[] {
  const byPractice = new Map<string, PractitionerOrganization>();
  for (const assignment of assignments) {
    if (!byPractice.has(assignment.practiceId)) {
      byPractice.set(assignment.practiceId, affiliatedOf(assignment));
    }
  }
  return [...byPractice.values()];
}

function affiliatedOf(assignment: MyRoleAssignment): PractitionerOrganization {
  return {
    practiceId: assignment.practiceId,
    practiceSiteId: assignment.practiceSiteId ?? null,
    name: assignment.practiceName,
    isOwnOffice: false,
  };
}

function ownOfficeOf(site: PracticeSite): PractitionerOrganization {
  return {
    practiceId: site.practiceId,
    practiceSiteId: site.id,
    name: site.name,
    isOwnOffice: true,
  };
}
