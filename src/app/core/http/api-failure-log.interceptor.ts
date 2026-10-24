import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject, isDevMode, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { tap } from 'rxjs';

import { readApiError, readFieldViolations } from './api-error';
import { supportCodeOf } from './api-failure';
import { sanitizeUrl } from '../observability/privacy/sanitize-url';

/**
 * Clave de `localStorage` que enciende el registro fuera de desarrollo.
 *
 * Para el entorno de prueba del VPS, que corre un build de producción: quien
 * está probando un formulario la enciende en **su** navegador con
 * `localStorage.setItem('alovida.debugApi', 'on')` y recarga. No viaja a
 * ningún lado; sólo cambia lo que ve su propia consola.
 */
export const API_DEBUG_STORAGE_KEY = 'alovida.debugApi';

/** Prefijo de cada línea, para filtrar la consola. */
export const API_FAILURE_LOG_PREFIX = '[API]';

/**
 * Escribe en la consola cada respuesta fallida de la API, con lo que hace falta
 * para entenderla.
 *
 * ## Por qué un interceptor
 *
 * Porque el defecto está en cientos de pantallas: manejadores
 * `error: () => toast('No se pudo guardar')` que tiran el objeto de error. Se
 * van a corregir de a uno, pero mientras tanto un fallo no debe ser invisible
 * para quien prueba. Este interceptor ve **todas** las respuestas antes que la
 * pantalla, así que la información queda en la consola aunque el manejador la
 * descarte.
 *
 * ## Qué se escribe, y qué no
 *
 * Método, ruta **sin query** (dos rutas llevan un token ahí), estado, `code`,
 * `message`, `correlationId`, los campos rechazados con su restricción y el
 * bloque `diagnostics` cuando la API lo manda (`API_ERROR_DIAGNOSTICS`). Nunca
 * el cuerpo enviado: es el formulario de una persona.
 *
 * Sólo en desarrollo o con {@link API_DEBUG_STORAGE_KEY} encendida. En
 * producción, por defecto, la consola de un paciente no cuenta nada.
 */
export const apiFailureLogInterceptor: HttpInterceptorFn = (request, next) => {
  if (!apiFailureLogEnabled(isPlatformBrowser(inject(PLATFORM_ID)))) {
    return next(request);
  }

  return next(request).pipe(
    tap({
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse) {
          console.error(...describeForConsole(request.method, request.url, error));
        }
      },
    }),
  );
};

/** Desarrollo siempre; fuera de él, sólo con la clave del navegador encendida. */
export function apiFailureLogEnabled(inBrowser: boolean): boolean {
  if (isDevMode()) {
    return true;
  }
  if (!inBrowser) {
    return false;
  }
  try {
    return globalThis.localStorage?.getItem(API_DEBUG_STORAGE_KEY) === 'on';
  } catch {
    // Almacenamiento bloqueado (modo privado, política del navegador): apagado.
    return false;
  }
}

/**
 * Los argumentos de `console.error`: una línea legible y el detalle como
 * objeto, para expandirlo en las herramientas del navegador.
 */
export function describeForConsole(method: string, url: string, error: HttpErrorResponse): [string, Record<string, unknown>] {
  const path = sanitizeUrl(url);

  if (error.status === 0) {
    return [`${API_FAILURE_LOG_PREFIX} ${method} ${path} → sin respuesta (red, CORS o servidor caído)`, {}];
  }

  const body = readApiError(error);
  const supportCode = supportCodeOf(error, body);
  const fields = readFieldViolations(body).map(({ field, constraints, messages }) => ({ field, constraints, messages }));
  const diagnostics: unknown = isRecord(error.error) ? error.error['diagnostics'] : undefined;

  const headline = [
    `${API_FAILURE_LOG_PREFIX} ${method} ${path} → ${error.status}`,
    body?.code ?? 'sin cuerpo de la API',
    body?.message ? `«${body.message}»` : '',
    supportCode ? `correlationId=${supportCode}` : '',
  ]
    .filter((part) => part !== '')
    .join(' · ');

  return [
    headline,
    {
      status: error.status,
      ...(body ? { code: body.code, message: body.message } : {}),
      ...(supportCode ? { correlationId: supportCode } : {}),
      ...(fields.length > 0 ? { fields } : {}),
      ...(body?.details && fields.length === 0 ? { details: body.details } : {}),
      ...(diagnostics === undefined ? {} : { diagnostics }),
    },
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
