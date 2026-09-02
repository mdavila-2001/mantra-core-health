import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';

import { LOGIN_ROUTE } from '../http/auth.interceptor';
import { tracedGuard } from '../observability/routing/guard-tracing';
import { SessionStore } from './session.store';

/**
 * Ruta donde se elige organización cuando el token trae más de una.
 *
 * La pantalla la aporta J9; la constante vive acá porque es el guard quien
 * decide cuándo hace falta.
 */
export const TENANT_SELECTION_ROUTE = '/auth/organization';

/**
 * Autorización de ruta — el estado **S1** del contrato del M34.
 *
 * Corre **antes** de que la pantalla pida ningún dato sensible, que es la razón
 * de que S1 y S2 sean estados distintos: mostrar un esqueleto de contenido
 * mientras todavía no se sabe si la persona puede ver la sección ya insinúa que
 * hay algo que ver.
 *
 * Por eso decide solo con lo que hay en memoria —el token ya decodificado— y no
 * consulta a la API: una llamada acá volvería a mezclar autorizar con pedir.
 *
 * Tres caminos:
 * 1. sin sesión → al login;
 * 2. con sesión y varias organizaciones sin elegir → al selector;
 * 3. con sesión resuelta → pasa.
 */
export const authGuard: CanActivateFn = tracedGuard('authGuard', () => {
  const session = inject(SessionStore);
  const router = inject(Router);

  if (!session.isAuthenticated()) {
    return router.createUrlTree([LOGIN_ROUTE]);
  }

  if (session.needsTenantSelection()) {
    return router.createUrlTree([TENANT_SELECTION_ROUTE]);
  }

  return true;
});

/**
 * A dónde manda la raíz (`/`), según haya o no sesión.
 *
 * Antes de este guard, `/` vivía dentro del árbol guardado por `authGuard`
 * como `redirectTo: 'dashboard'` — así que quien llegaba sin sesión, ni
 * siquiera de visita, caía directo al login. Un enlace compartido a secas
 * («mirá esta app») no debería pedir cuenta antes de dejar ver nada: la
 * superficie pública es la puerta de entrada, el login es lo que pide una
 * acción concreta.
 *
 * El destino sin sesión es `/posts` —el compilado de lo último que
 * escribieron los profesionales— y no `/search`. Quien entra por primera vez no
 * trae el nombre de un médico en la cabeza, así que un buscador le pide de
 * entrada justamente el dato que no tiene; un feed se lee sin saber nada de
 * antemano, y de cada publicación se llega a la ficha de quien la escribió.
 *
 * Con sesión sigue yendo al panel: no le cambia nada a quien ya inició sesión.
 *
 * Siempre devuelve un `UrlTree` y nunca `true`: Angular no deja combinar
 * `redirectTo` con `canActivate` en la misma ruta («redirects happen before
 * guards are executed»), así que la ruta de `/` no declara `redirectTo` — es
 * este guard, con los dos destinos posibles, el que hace todo el trabajo.
 */
export const homeGuard: CanActivateFn = tracedGuard('homeGuard', () => {
  const session = inject(SessionStore);
  const router = inject(Router);

  return router.createUrlTree([session.isAuthenticated() ? '/dashboard' : '/posts']);
});
