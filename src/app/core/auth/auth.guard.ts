import { inject } from '@angular/core';
import { Router, type CanActivateFn, type UrlTree } from '@angular/router';

import { AuthService } from './auth.service';

/** Pantalla de ingreso. La comparte `authInterceptor` cuando la sesión muere. */
export const LOGIN_PATH = '/auth/login';

/** Pantalla de elección de organización, cuando el token trae más de una. */
export const TENANT_SELECTION_PATH = '/auth/organizacion';

/** Solicitud de restablecimiento de contraseña. */
export const FORGOT_PASSWORD_PATH = '/auth/recuperar';

/** Destino del enlace del correo, con el token en `?token=`. */
export const RESET_PASSWORD_PATH = '/auth/restablecer';

/** Primera pantalla de la aplicación autenticada. */
export const HOME_PATH = '/panel';

/**
 * Parámetro con el que el login sabe adónde volver. Se llama `volverA` y no `returnUrl` porque
 * queda a la vista en la barra de direcciones y el resto de la aplicación está en castellano.
 */
export const RETURN_URL_PARAM = 'volverA';

/**
 * Guards de sesión.
 *
 * ## Los tres esperan a `ensureRestored()` antes de mirar nada
 *
 * Al recargar, la sesión no existe todavía: hay un refresh token guardado y una petición en camino
 * que lo cambia por un par nuevo. Un guard que leyera el estado en el primer turno vería «sin
 * sesión» y mandaría al login a alguien que sí la tiene — un cierre de sesión espontáneo en cada
 * F5, y encima intermitente, porque depende de si la petición llegó a tiempo.
 *
 * `ensureRestored()` es idempotente y comparte una sola petición entre todos los que la esperen,
 * así que esperarla en los tres guards no multiplica nada.
 *
 * ## Estos guards no autorizan: encaminan
 *
 * La autoridad es la API, que valida el token en cada petición. Acá solo se decide qué pantalla
 * mostrar, y por eso `authGuard` no mira roles: esconder una ruta no protege un dato. Para lo que
 * sí es una regla de pantalla —«esta sección es de administradores»— está {@link roleGuard}, y
 * sigue sin ser control de acceso: es no ofrecer una puerta que la API va a cerrar igual.
 */

/**
 * Exige sesión abierta. Sin ella manda al login recordando adónde se quería ir, para poder
 * devolver a la persona a la pantalla que pidió en vez de dejarla en la portada.
 */
export const authGuard: CanActivateFn = async (_route, state): Promise<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.ensureRestored();

  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree([LOGIN_PATH], {
    queryParams: { [RETURN_URL_PARAM]: state.url },
  });
};

/**
 * Lo contrario: solo para quien **no** tiene sesión.
 *
 * Sin esto, el botón «atrás» después de entrar deja el formulario de login en pantalla con la
 * sesión ya abierta, y volver a enviarlo gasta un intento del límite de la API contra una persona
 * que ya está adentro.
 */
export const guestGuard: CanActivateFn = async (): Promise<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.ensureRestored();

  if (!auth.isAuthenticated()) {
    return true;
  }

  // Con varias organizaciones y ninguna elegida, la pantalla siguiente es la elección, no el panel.
  return router.parseUrl(auth.needsTenantSelection() ? TENANT_SELECTION_PATH : HOME_PATH);
};

/**
 * Exige que haya una organización activa.
 *
 * Va **después** de `authGuard` sobre el área protegida. Con una sola organización el store la
 * resuelve solo y esto no interrumpe a nadie; con varias, obliga a elegir antes de mostrar
 * cualquier dato.
 *
 * Es una decisión de seguridad, no de comodidad: `authInterceptor` **no manda `X-Tenant-Id`**
 * mientras no haya una elegida, así que entrar sin elegir mostraría lo que la API devuelva sin
 * contexto de organización. Preguntar es más honesto que adivinar.
 */
export const tenantSelectedGuard: CanActivateFn = async (
  _route,
  state,
): Promise<boolean | UrlTree> => {
  const auth = inject(AuthService);
  const router = inject(Router);

  await auth.ensureRestored();

  if (auth.activeTenantId() !== null) {
    return true;
  }

  return router.createUrlTree([TENANT_SELECTION_PATH], {
    queryParams: { [RETURN_URL_PARAM]: state.url },
  });
};

/**
 * Exige alguno de los roles indicados.
 *
 * ```ts
 * { path: 'usuarios', canActivate: [authGuard, roleGuard(['SECURITY_ADMIN'])], … }
 * ```
 *
 * Devuelve `false` y no un `UrlTree` a propósito: rebotar a la portada a quien escribió una URL
 * que no le corresponde deja la impresión de que la ruta no existe. Cancelar la navegación deja a
 * la persona donde estaba, y quien llegó por el menú nunca ve este caso porque el menú no le
 * ofreció el ítem.
 */
export function roleGuard(required: readonly string[]): CanActivateFn {
  return async (): Promise<boolean> => {
    const auth = inject(AuthService);
    await auth.ensureRestored();
    return auth.hasAnyRole(required);
  };
}
