import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { throwError, type Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { forcedRealApi } from '../mock/api-mode';

/* ============================================================================
    Lo que sólo existe en el simulador, dicho en código y no sólo en un JSDoc.

    El informe B de deriva de contratos (2026-10-08) encontró dos formas de que
    una pantalla funcione en `mockup` y se rompa contra la API real:

    1. **Rutas que la API no publica.** Contra la API real son un 404 que la
       pantalla mostraba como «no pudimos guardar», sin decir que la función
       no existe todavía. `simulatorOnly()` no deja salir la petición: entrega
       un error que nombra la función que falta.
    2. **Claves que el DTO no declara.** La API valida con
       `forbidNonWhitelisted`, así que una sola clave de más es un 400 que
       tira abajo el guardado entero. `withSimulatorExtensions()` las manda
       sólo a la maqueta y las quita del cuerpo que va a la API real.

    La maqueta, a su vez, rechaza con 400 toda clave que ni el contrato ni el
    registro de extensiones declara (`core/mock/contract/`): la deriva se ve en
    `mockup`, no recién en producción.
    ========================================================================== */

/** `details.reason` del error que entrega una ruta que la API no publica. */
export const NOT_AVAILABLE_IN_API = 'NOT_AVAILABLE_IN_API';

/**
 * Si las rutas y claves «sólo simulador» llegan a destino.
 *
 * Es `false` contra la API real y también con el interruptor del stock de
 * componentes (`forcedRealApi`), que manda la petición a la red.
 */
export function simulatorAvailable(): boolean {
  return environment.mockBackend && !forcedRealApi();
}

/** El aviso, en usted, de una función que la API todavía no ofrece. */
export function unavailableMessage(feature: string): string {
  return `${feature}: todavía no está disponible. El servidor aún no ofrece esta función.`;
}

/**
 * El error de una ruta que la API no publica.
 *
 * Es un `HttpErrorResponse` con el cuerpo del contrato de errores
 * (`PRECONDITION_FAILED`, la precondición «el servidor ofrece esto» no se
 * cumple) para que los caminos de error que ya existen —`errorToViewState`,
 * los avisos que leen `message`— muestren el motivo sin tocarlos. El 501 es
 * el estado HTTP de «no implementado».
 */
export function unavailableInApiError(feature: string, url: string): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 501,
    statusText: 'Not Implemented',
    url,
    headers: new HttpHeaders(),
    error: {
      statusCode: 501,
      code: 'PRECONDITION_FAILED',
      message: unavailableMessage(feature),
      details: { reason: NOT_AVAILABLE_IN_API, feature },
      timestamp: new Date().toISOString(),
      path: url,
    },
  });
}

/**
 * Hace la petición sólo si va a la maqueta.
 *
 * @param feature - Cómo se llama la función para la persona («Importar
 *   servicios del laboratorio»). Es lo que dice el aviso.
 * @param url - La ruta, para el error.
 * @param request - La petición, que no se arma contra la API real.
 */
export function simulatorOnly<T>(
  feature: string,
  url: string,
  request: () => Observable<T>,
): Observable<T> {
  return simulatorAvailable() ? request() : throwError(() => unavailableInApiError(feature, url));
}

/** El aviso de una ruta «sólo simulador» que no salió, o `null` si el fallo es otro. */
export function unavailableMessageOf(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const body: unknown = error.error;
  if (typeof body !== 'object' || body === null) return null;
  const { details, message } = body as { details?: { reason?: unknown }; message?: unknown };
  return details?.reason === NOT_AVAILABLE_IN_API && typeof message === 'string' ? message : null;
}

/**
 * El cuerpo que va a la API, con las extensiones del simulador sólo cuando
 * van a la maqueta.
 *
 * @param body - El cuerpo completo que arma la pantalla.
 * @param extensions - Las claves que el DTO real no declara. Son las mismas
 *   que la maqueta tiene registradas como extensión de esa ruta.
 */
export function withSimulatorExtensions<T extends object>(
  body: T,
  extensions: readonly string[],
): T {
  if (simulatorAvailable()) return body;
  return Object.fromEntries(Object.entries(body).filter(([key]) => !extensions.includes(key))) as T;
}

/**
 * Las extensiones que la persona completó y que la API real no va a guardar.
 *
 * Es lo que la pantalla nombra en su aviso («La descripción todavía no se
 * guarda…»). Contra la maqueta siempre está vacío: ahí sí se guardan.
 */
export function droppedSimulatorExtensions<T extends object>(
  body: T,
  extensions: readonly string[],
): string[] {
  if (simulatorAvailable()) return [];
  return Object.entries(body)
    .filter(([key, value]) => extensions.includes(key) && hasContent(value))
    .map(([key]) => key);
}

function hasContent(value: unknown): boolean {
  if (value === undefined || value === null || value === '' || value === false) return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}
