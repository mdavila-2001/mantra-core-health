import type { InvitationRedeemResult } from '../../../core/data-access/support-access/support-access.types';

/**
 * Lo que se le dice a quien acaba de canjear un código de afiliación.
 *
 * Un código **multiuso** no afilia solo: la organización decide. Por eso hay dos finales distintos y la
 * pantalla no confunde uno con el otro:
 *
 * - **Pendiente**: «Su solicitud quedó pendiente de aprobación de la organización». Para un doctor es una
 *   membresía pendiente (sin efecto hasta que la organización la apruebe); para el personal de apoyo, una
 *   solicitud que verá en «Mis accesos» cuando se decida. En ningún caso «quedó afiliado».
 * - **Afiliado**: un código dirigido a la persona, o quien ya era miembro activo.
 */
export function textoDelCanje(r: InvitationRedeemResult): string {
  const donde = r.organizationName === '' ? 'a la organización' : `a ${r.organizationName}`;
  switch (r.outcome) {
    case 'PRACTITIONER_PENDING_APPROVAL':
      return 'Su solicitud quedó pendiente de aprobación de la organización. Hasta que la apruebe, esta cuenta no tiene acceso a nada de ella: le avisaremos cuando decida.';
    case 'SUPPORT_REQUEST_CREATED':
      return 'Su solicitud quedó pendiente de aprobación de la organización. Cuando decida, la verá en «Mis accesos», en su historial de solicitudes.';
    case 'PRACTITIONER_AFFILIATED':
      return `Quedó afiliado ${donde} como doctor.`;
    case 'SUPPORT_JOINED':
      return `Se unió ${donde}. Todavía no tiene permisos: la organización decide qué puede hacer.`;
  }
}

/** Por qué la API rechazó el canje con 412 (no es el 422 opaco de un código malo): lo que la persona puede hacer al respecto. */
export type RedeemPrecondition = 'PROFILE_REQUIRED' | 'PRACTICE_MISSING';

export function redeemPreconditionOf(reason: unknown): RedeemPrecondition | null {
  if (reason === 'SUPPORT_PRACTITIONER_PROFILE_REQUIRED') return 'PROFILE_REQUIRED';
  if (reason === 'SUPPORT_AFFILIATION_PRACTICE_MISSING') return 'PRACTICE_MISSING';
  return null;
}

export const REDEEM_PRECONDITION_TEXT: Readonly<Record<RedeemPrecondition, string>> = {
  PROFILE_REQUIRED:
    'Su cuenta todavía no tiene un perfil profesional, y ese código es para doctores. Complete su perfil profesional y vuelva a canjearlo: el código sigue siendo válido.',
  PRACTICE_MISSING: 'Esa organización todavía no tiene una práctica activa a la que sumarlo. Pídale que la registre y vuelva a canjear el código.',
};
