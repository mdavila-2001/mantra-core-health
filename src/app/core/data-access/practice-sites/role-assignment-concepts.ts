/**
 * Estados del ciclo de vida de una vinculación profesional-organización
 * (Carril 18, `practice.practitioner_role_assignments.status_concept_id`).
 *
 * Son UUIDv5 deterministas derivados de
 * una clave legible en el backend (`practice.concepts.ts`), no datos que se
 * piden en tiempo de ejecución. Confirmado contra el backend el 2026-08-15.
 * Si la clave de origen cambia allá, esto queda desincronizado — no hay
 * verificación automática cruzando los dos repositorios.
 */
export const ROLE_ASSIGNMENT_STATUS = {
  PENDING: '9705765a-52a0-5c34-b666-a71fda4d9a16',
  ACTIVE: '15fb063e-479c-56e6-b5d1-ebd5a36b62db',
  SUSPENDED: 'fd22afc5-1841-51ec-987b-630ee48a4a10',
  REJECTED: 'a6caee55-265d-54cd-a966-97ac762891d9',
  ENDED: '18506270-2c10-5ca4-ba5d-650d4102431d',
} as const;

export function roleAssignmentStatusLabel(statusConceptId: string): string {
  switch (statusConceptId) {
    case ROLE_ASSIGNMENT_STATUS.PENDING:
      return 'Pendiente de aprobación';
    case ROLE_ASSIGNMENT_STATUS.ACTIVE:
      return 'Activa';
    case ROLE_ASSIGNMENT_STATUS.SUSPENDED:
      return 'Suspendida';
    case ROLE_ASSIGNMENT_STATUS.REJECTED:
      return 'Rechazada';
    case ROLE_ASSIGNMENT_STATUS.ENDED:
      return 'Finalizada';
    default:
      return 'Estado desconocido';
  }
}

/** El cargo por defecto (`PRAC.ROLE_ATTENDING`) cuando el profesional no elige otro. */
export const ROLE_CONCEPT_ATTENDING = '11fbd446-3e81-594d-b450-164d7c496c46';
