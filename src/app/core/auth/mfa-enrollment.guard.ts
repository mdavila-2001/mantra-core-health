import { inject } from '@angular/core';
import { Router, type CanActivateChildFn } from '@angular/router';
import { stripInvitationCode } from './invitation-link';
import { MFA_ENROLLMENT_ROUTE } from './mfa-enrollment-route';
import { SessionStore } from './session.store';

/**
 * Lleva a dar de alta el segundo paso a quien entró con el **token de alcance limitado**.
 *
 * La API **lo impone**: a quien debe dar de alta su segundo factor le emite un token con el claim
 * `mfaEnrollment: true` (sin roles ni organizaciones) que solo llega a `/iam/me/mfa*`, al cierre de sesión y al
 * refresco; todo lo demás responde 403 `MFA_ENROLLMENT_REQUIRED`. Esta guarda ya no es la única barrera: es lo
 * que evita mostrar una aplicación entera que va a contestar 403 y lleva a la persona a la pantalla de alta, la
 * única útil. Hasta que confirma el factor, toda ruta del armazón la manda ahí.
 *
 * Quién está restringido lo dice el token (`SessionStore.limitedToEnrollment`, que fija `mfaEnrollment` al abrir
 * la sesión y al renovarla), así que ya no hace falta preguntar `GET /iam/me/mfa` tras una recarga. Con un token
 * **completo** no se restringe nada, aunque alguna organización niegue por falta del factor
 * (`MFA_ENROLLMENT_REQUIRED` en `deniedTenants`): esa persona puede trabajar en las demás y solo se le avisa.
 *
 * Al confirmar el factor la pantalla pide un refresco, que reemite el token completo, y el estado pasa a `done`.
 */
export const mfaEnrollmentGuard: CanActivateChildFn = (_route, state) => {
  const session = inject(SessionStore);
  const router = inject(Router);

  if (!session.isAuthenticated()) return true;
  if (state.url.split(/[?#]/)[0] === MFA_ENROLLMENT_ROUTE) return true;
  if (session.mfaEnrollment() !== 'required') return true;

  // La dirección de retorno **no lleva el código de una invitación** (`#code=…`, un secreto de portador): copiado a
  // `?returnUrl=` quedaría en los registros del servidor del front y viajaría en el `Referer`. Sin él, al volver
  // la persona vuelve a la pantalla, no al canje.
  const destino = stripInvitationCode(state.url).path;
  return router.createUrlTree([MFA_ENROLLMENT_ROUTE], { queryParams: { returnUrl: destino } });
};
