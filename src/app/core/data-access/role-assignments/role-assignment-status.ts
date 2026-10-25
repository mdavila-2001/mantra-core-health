/**
 * Códigos de estado de una afiliación (`practice.concepts.ts` de la API, con el
 * INVITED que agrega CM-03). Terminología puede devolver el código simple o con
 * el prefijo del módulo (`practice:ROLE_ASG_ACTIVE`): se aceptan las dos formas.
 */
export const ROLE_ASSIGNMENT_STATUS_CODE = {
  INVITED: 'ROLE_ASG_INVITED',
  PENDING: 'ROLE_ASG_PENDING',
  ACTIVE: 'ROLE_ASG_ACTIVE',
  REJECTED: 'ROLE_ASG_REJECTED',
  SUSPENDED: 'ROLE_ASG_SUSPENDED',
  ENDED: 'ROLE_ASG_ENDED',
} as const;

export type RoleAssignmentState = keyof typeof ROLE_ASSIGNMENT_STATUS_CODE;

const LABELS: Readonly<Record<RoleAssignmentState, string>> = {
  INVITED: 'Pendiente de aceptación del médico',
  PENDING: 'Pendiente del centro',
  ACTIVE: 'Activa',
  REJECTED: 'Rechazada',
  SUSPENDED: 'Suspendida',
  ENDED: 'Finalizada',
};

/** El estado que nombra un código, con o sin prefijo de módulo; `null` si no lo conoce. */
export function roleAssignmentState(statusCode: string): RoleAssignmentState | null {
  const bare = statusCode.slice(statusCode.lastIndexOf(':') + 1);
  const found = (Object.keys(ROLE_ASSIGNMENT_STATUS_CODE) as RoleAssignmentState[]).find(
    (state) => ROLE_ASSIGNMENT_STATUS_CODE[state] === bare,
  );
  return found ?? null;
}

/** La etiqueta en castellano de un código de estado. Un código desconocido nunca se lee «Activa». */
export function roleAssignmentStatusText(statusCode: string): string {
  const state = roleAssignmentState(statusCode);
  return state === null ? 'Estado desconocido' : LABELS[state];
}

/** El tono de la etiqueta de un estado; lo desconocido nunca se pinta como éxito. */
export function roleAssignmentStatusTone(statusCode: string): 'success' | 'warning' | 'error' | 'info' {
  switch (roleAssignmentState(statusCode)) {
    case 'ACTIVE':
      return 'success';
    case 'INVITED':
    case 'PENDING':
      return 'warning';
    case 'REJECTED':
    case 'SUSPENDED':
      return 'error';
    default:
      return 'info';
  }
}

/** El texto de quién inició la afiliación. */
export function roleAssignmentInitiatorText(initiatedBy: 'PRACTICE' | 'PRACTITIONER'): string {
  return initiatedBy === 'PRACTICE' ? 'Invitado por el centro' : 'Pedido por el médico';
}
