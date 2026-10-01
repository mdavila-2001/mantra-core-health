import { effect, inject, Injectable, PLATFORM_ID, untracked } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, type ActivatedRouteSnapshot } from '@angular/router';

import { LOGIN_ROUTE } from '../http/auth.interceptor';
import { authGuard } from './auth.guard';
import { SessionStore } from './session.store';

/**
 * Manda al login a quien **pierde** la sesión estando dentro del área privada.
 *
 * ## El problema que resuelve
 *
 * `authGuard` sólo corre al navegar. Si la sesión se cierra mientras una
 * pantalla privada ya está pintada, nadie la saca de ahí:
 *
 * · el cierre por inactividad (`IdleLogout` → `AuthService.logout()`),
 * · el cierre desde otra pestaña (`watchSessionClosedElsewhere`),
 * · cualquier otro `SessionStore.clear()` que no navegue por su cuenta.
 *
 * La pantalla queda en pie con el armazón y el menú, pero sin token: cada
 * petición sale sin credencial, la API responde 401 y el interceptor —que ya no
 * ve sesión que renovar— deja subir el error sin cerrar nada. Para la persona,
 * «sigue adentro» pero ninguna acción funciona. Pasaba igual con todos los
 * roles, porque el área privada es una sola.
 *
 * ## Qué hace
 *
 * Observa la **transición** de «con sesión» a «sin sesión». Si en ese momento
 * la ruta activa cuelga de `authGuard`, navega al login. Así cualquier forma de
 * perder la sesión, presente o futura, termina en el mismo lugar sin que cada
 * quien que limpie el store tenga que acordarse de navegar.
 *
 * No toca a quien está en la superficie pública (la vitrina, las fichas, el
 * feed): ahí no hace falta sesión y expulsarlo sería peor que dejarlo leer.
 * Tampoco hace nada bajo SSR, donde no hay sesión que perder.
 *
 * Navegar dos veces al login —el interceptor o el botón «Salir» ya lo hacen—
 * es inocuo: el destino es el mismo.
 */
@Injectable({
  providedIn: 'root',
})
export class SessionEndedRedirect {
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Si en la última lectura había sesión. Sólo importa el cambio. */
  private habiaSesion = false;

  constructor() {
    effect(() => {
      const haySesion = this.session.isAuthenticated();
      const habia = this.habiaSesion;
      this.habiaSesion = haySesion;

      if (habia && !haySesion) {
        untracked(() => this.alLogin());
      }
    });
  }

  private alLogin(): void {
    if (!this.isBrowser || !enAreaPrivada(this.router.routerState.snapshot.root)) {
      return;
    }

    void this.router.navigateByUrl(LOGIN_ROUTE);
  }
}

/**
 * Si alguna ruta de la cadena activa está protegida por `authGuard`.
 *
 * Se mira la configuración y no la URL: el área privada no tiene un prefijo
 * propio (cuelga de `path: ''`), así que el único dato fiable de «esto pide
 * sesión» es el guard declarado.
 */
function enAreaPrivada(raiz: ActivatedRouteSnapshot): boolean {
  for (let ruta: ActivatedRouteSnapshot | null = raiz; ruta !== null; ruta = ruta.firstChild) {
    if (ruta.routeConfig?.canActivate?.includes(authGuard) === true) {
      return true;
    }
  }
  return false;
}
