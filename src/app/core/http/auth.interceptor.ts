import {
  HttpErrorResponse,
  type HttpInterceptorFn,
  type HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';

import { isAccessTokenExpired } from '../auth/access-token';
import { SessionStore } from '../auth/session.store';
import { TokenRefreshService } from './token-refresh.service';

/** Ruta a la que se manda a quien se quedó sin sesión. */
export const LOGIN_ROUTE = '/auth';

/**
 * Cabecera con la que la API sabe de qué organización se habla. Exportada para
 * que las pantallas que consultan una organización distinta de la activa la
 * declaren con este mismo nombre y no con una copia literal.
 */
export const TENANT_HEADER = 'X-Tenant-Id';

/**
 * Rutas que la API declara `@Public()` y que por definición se piden sin
 * sesión. Mandarles un `Authorization` no rompe nada, pero intentar refrescar
 * cuando una de ellas responde 401 sí: el 401 de un login son credenciales
 * inválidas, y reaccionar con un refresco sería un bucle contra el límite de
 * 10 intentos por minuto.
 *
 * Verificadas una por una contra `iam-auth.controller.ts`.
 */
const PUBLIC_PATHS: readonly string[] = [
  '/iam/auth/login',
  '/iam/auth/token/refresh',
  '/iam/auth/register-patient',
  '/iam/auth/register-organization',
  '/iam/auth/register-practitioner',
  '/iam/auth/verify-email',
  // Verificado contra la API viva: responde 401 con un token de activación
  // inválido, así que sin declararla el interceptor intentaría refrescar una
  // sesión que en esta pantalla no existe.
  '/iam/auth/activate',
  '/iam/auth/resend-verification',
  // Las dos de recuperación: quien las usa no tiene sesión —justamente por eso
  // las usa—. Sin declararlas, alguien con sesión abierta que abriera el enlace
  // del correo dispararía un refresco ante su 401, que es el bucle que esta
  // lista existe para evitar.
  '/iam/auth/forgot-password',
  '/iam/auth/reset-password',
];

/**
 * Rutas de **credencial opcional**: la API las declara `@Public()`, pero se
 * piden tanto con sesión como sin ella, así que la credencial sí viaja cuando
 * existe — lo que no puede pasar es que su 401 se lleve la sesión por delante.
 *
 * Hoy sólo el catálogo de terminología: `GET /terminology/value-sets` y
 * `GET /terminology/value-sets/{id}/$expand`. El registro público las pide para
 * su desplegable de departamentos (`VS_BO_DEPARTMENT`) antes de que exista una
 * sesión, y el glosario y los formularios clínicos las piden ya dentro.
 *
 * Sin esta lista, el 401 del registro entraba por el camino reactivo de abajo
 * y, como en esa pantalla no hay refresh token, terminaba en `endSession()`:
 * limpiaba la sesión y navegaba a `/auth`. Abrir el registro expulsaba del
 * registro.
 *
 * Van por prefijo y no por igualdad porque la expansión lleva el identificador
 * del conjunto en el camino.
 */
const OPTIONAL_AUTH_PREFIXES: readonly string[] = ['/terminology/value-sets'];

/**
 * Añade la credencial a cada petición y renueva la sesión **una sola vez**
 * cuando la API responde 401.
 *
 * El reintento no recursa a propósito: si la petición reintentada vuelve a dar
 * 401, el error sube. Un interceptor que reintenta en bucle agota el límite de
 * peticiones y deja la interfaz colgada sin decir nada.
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (isPublic(request.url)) {
    return next(request);
  }

  const session = inject(SessionStore);
  const refresher = inject(TokenRefreshService);
  const router = inject(Router);

  /**
   * Refresco **proactivo**: si el token ya venció, se renueva antes de mandar.
   *
   * Antes el refresco era solo reactivo —se esperaba al 401— y cada expiración
   * costaba una petición condenada de antemano. La comprobación es local y sin
   * red: `isAccessTokenExpired` mira el claim `exp` con 10 segundos de margen,
   * para no mandar en vuelo uno que expira durante el viaje.
   *
   * El camino reactivo de abajo **no se toca**: sigue cubriendo el token
   * revocado del lado del servidor, que `exp` no puede anticipar.
   */
  const claims = session.claims();
  if (claims !== null && isAccessTokenExpired(claims) && session.refreshToken() !== null) {
    return refresher.refresh().pipe(
      switchMap(() => next(withCredentials(request, session))),
      catchError((refreshError: unknown) => endSession(session, router, refreshError)),
    );
  }

  return next(withCredentials(request, session)).pipe(
    catchError((error: unknown) => {
      if (!isUnauthorized(error)) {
        return throwError(() => error);
      }

      // Catálogo de credencial opcional: su 401 no dice nada de la sesión, así
      // que sube tal cual. Quien lo pidió ya sabe qué hacer sin él —el registro
      // ofrece reintentar y deja seguir sin departamento—, y renovar o cerrar
      // la sesión por una lectura de catálogo sería confundir dos cosas.
      if (isOptionalAuth(request.url)) {
        return throwError(() => error);
      }

      // Sin refresh token no hay nada que renovar: se corta acá en vez de
      // gastar una petición que ya sabemos que va a fallar.
      if (session.refreshToken() === null) {
        return endSession(session, router, error);
      }

      return refresher.refresh().pipe(
        switchMap(() => next(withCredentials(request, session))),
        catchError((refreshError: unknown) => endSession(session, router, refreshError)),
      );
    }),
  );
};

/**
 * Pone `Authorization` y `X-Tenant-Id`.
 *
 * El tenant sale del propio token —la API no expone `/me`— y solo viaja cuando
 * está resuelto: con varias organizaciones y ninguna elegida todavía, no se
 * manda. Adivinar una podría mostrar datos de la organización equivocada.
 *
 * Si la petición ya trae `X-Tenant-Id`, se respeta. Lo necesitan las pantallas
 * de plataforma que consultan una organización **distinta** de la activa (la
 * ficha de `/tenants/{id}/…`): la API rechaza con 403 la petición privilegiada
 * cuyo tenant de la ruta contradice el de la cabecera, así que pisar aquí lo
 * que la pantalla declaró dejaría esas fichas inservibles.
 */
function withCredentials<T>(request: HttpRequest<T>, session: SessionStore): HttpRequest<T> {
  const accessToken = session.accessToken();
  if (accessToken === null) {
    return request;
  }

  const tenantId = request.headers.has(TENANT_HEADER) ? null : session.activeTenantId();

  return request.clone({
    setHeaders: {
      Authorization: `Bearer ${accessToken}`,
      ...(tenantId === null ? {} : { [TENANT_HEADER]: tenantId }),
    },
  });
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 401;
}

/** Cierra la sesión y manda al login, propagando el error original. */
function endSession(session: SessionStore, router: Router, error: unknown) {
  session.clear();
  void router.navigateByUrl(LOGIN_ROUTE);

  return throwError(() => error);
}

/**
 * Compara solo la ruta: `apiBaseUrl` puede estar vacío en desarrollo (rutas
 * relativas, las resuelve el proxy) o ser una raíz absoluta en producción, y en
 * ambos casos la ruta es la misma.
 */
function isPublic(url: string): boolean {
  const path = pathOf(url);
  return PUBLIC_PATHS.includes(path) || path.startsWith('/public/');
}

/** Igual que `isPublic`, pero por prefijo y sin quitarle la credencial. */
function isOptionalAuth(url: string): boolean {
  const path = pathOf(url);
  return OPTIONAL_AUTH_PREFIXES.some((prefijo) => path.startsWith(prefijo));
}

function pathOf(url: string): string {
  if (!url.includes('://')) {
    return url.split('?')[0] ?? url;
  }

  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
