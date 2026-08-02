import {
  HttpErrorResponse,
  HttpResponse,
  type HttpEvent,
  type HttpInterceptorFn,
  type HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import {
  context,
  propagation,
  SpanKind,
  SpanStatusCode,
  trace,
  type Context,
  type Span,
} from '@opentelemetry/api';
import {
  ATTR_ERROR_TYPE,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_SERVER_ADDRESS,
  ATTR_URL_PATH,
  ATTR_URL_SCHEME,
} from '@opentelemetry/semantic-conventions';
import { Observable, defer, finalize, tap } from 'rxjs';

import { API_BASE_URL } from '../../data-access/api';
import { TELEMETRY_CONFIG } from '../config/telemetry.token';
import { typeOf } from '../errors/error-sanitizer';
import { apiRouteTemplate, hostOf, sanitizeUrl, schemeOf } from '../privacy/sanitize-url';
import { ATTR, SPAN_NAMES } from '../tracing/tracing.constants';
import { TracingService } from '../tracing/tracing.service';
import { shouldPropagateTrace } from './propagation-allowlist';

/**
 * Un span por petición de `HttpClient`, y el `traceparent` que une el frontend
 * con el backend.
 *
 * ## Por qué acá y no con instrumentación automática de `fetch`
 *
 * La decisión está razonada en `docs/observability/angular/01-architecture-design.md`,
 * pero el motivo corto es que instrumentar `fetch` globalmente **trazaría la
 * propia exportación de trazas** —el exportador OTLP usa `fetch`— y produciría
 * un lazo: cada envío de spans genera un span, que se envía, que genera otro.
 * Además duplicaría con este interceptor, y este sabe cosas que `fetch` no: si
 * la ruta es pública, si el destino es la API o un tercero, cuál es la
 * plantilla de la ruta.
 *
 * ## Dónde va en la cadena
 *
 * **Primero**, antes de `authInterceptor`. Así:
 *
 *   - Un span cubre la *petición lógica*, con el refresco de sesión y el
 *     reintento incluidos. Ponerlo después produciría dos spans para lo que la
 *     pantalla vive como una sola llamada.
 *   - El `traceparent` se pone antes de que `authInterceptor` clone la petición
 *     para añadir `Authorization`, y las dos cabeceras sobreviven.
 *
 * ## Qué se registra
 *
 * Método, ruta **sin query**, plantilla de la ruta de la API, host y esquema.
 * Al terminar, el código de estado. Y nada más: no se lee `request.body`, no se
 * leen las cabeceras, no se lee el cuerpo de la respuesta. Un span de una
 * subida de archivo no puede saber qué archivo era.
 */
export const tracingInterceptor: HttpInterceptorFn = (request, next) => {
  const config = inject(TELEMETRY_CONFIG);
  if (!config.enabled) {
    // Ni un span, ni una cabecera, ni un `defer` de más en la cadena.
    return next(request);
  }

  const tracing = inject(TracingService);
  const apiBaseUrl = inject(API_BASE_URL);

  /**
   * `defer` es lo que ata el span a la **suscripción**.
   *
   * Un interceptor se ejecuta al construir el Observable, no al consumirlo. Sin
   * `defer`, un `HttpClient.get(...)` guardado y nunca suscrito abriría un span
   * de una petición que jamás salió, y quedaría abierto para siempre.
   */
  return defer(() => {
    /**
     * `CLIENT` no es decorativo: es lo que le dice a Jaeger que este span y el
     * `SERVER` que el backend abre con el mismo `traceparent` son los dos
     * extremos de la misma llamada. Sin él, la vista de dependencias entre
     * servicios no dibuja la flecha.
     */
    const span = tracing.startSpan(SPAN_NAMES.httpRequest, attributesOf(request), SpanKind.CLIENT);

    const active = trace.setSpan(context.active(), span);
    const outgoing = shouldPropagateTrace(request.url, apiBaseUrl)
      ? withTraceHeaders(request, active)
      : request;

    let settled = false;

    /**
     * La suscripción corre **dentro** del contexto, no solo la construcción.
     * Es lo que hace que un span que la aplicación abra alrededor de esta
     * llamada quede como padre, y lo que garantiza que el `traceparent`
     * inyectado y el span sean el mismo.
     */
    return new Observable<HttpEvent<unknown>>((subscriber) =>
      context.with(active, () => next(outgoing).subscribe(subscriber)),
    ).pipe(
      tap({
        next: (event) => {
          /**
           * `HttpClient` emite eventos de progreso además de la respuesta. Solo
           * la respuesta cierra la cuenta: anotar cada evento de progreso de una
           * subida convertiría un archivo de 20 MB en cientos de anotaciones.
           */
          if (event instanceof HttpResponse) {
            span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, event.status);
            span.setStatus({ code: SpanStatusCode.OK });
            settled = true;
          }
        },
        error: (error: unknown) => {
          settled = true;
          failSpanFromHttp(span, error);
        },
      }),
      finalize(() => {
        if (!settled) {
          /**
           * Nadie sigue esperando esta respuesta: un `switchMap` descartó la
           * anterior, la persona navegó, el componente se destruyó. No es un
           * error y no se marca como tal — pero sí se distingue, porque una
           * petición cancelada y una que respondió no son lo mismo al mirar
           * latencias.
           */
          span.setAttribute(ATTR.result, 'cancelled');
        }
        span.end();
      }),
    );
  });
};

/**
 * Pone `traceparent` (y `tracestate` si existe) usando la API oficial.
 *
 * Nunca se arma la cabecera a mano. El formato de W3C Trace Context tiene
 * versión, banderas y un `trace_id` que debe salir del propio SDK; escribirlo
 * a mano es la forma de generar identificadores inválidos que el backend
 * descarta en silencio, dejando dos trazas inconexas que parecen una.
 */
function withTraceHeaders<T>(request: HttpRequest<T>, active: Context): HttpRequest<T> {
  const carrier: Record<string, string> = {};
  propagation.inject(active, carrier);

  return Object.keys(carrier).length === 0 ? request : request.clone({ setHeaders: carrier });
}

function attributesOf<T>(request: HttpRequest<T>): Record<string, string | number> {
  const attributes: Record<string, string | number> = {
    [ATTR_HTTP_REQUEST_METHOD]: request.method,
    /** Sin query. Dos rutas de esta aplicación llevan un token ahí. */
    [ATTR_URL_PATH]: sanitizeUrl(request.url),
    /** `/profiles/:id`, para que las peticiones al mismo endpoint agrupen. */
    [ATTR.apiRouteTemplate]: apiRouteTemplate(request.url),
  };

  const host = hostOf(request.url);
  if (host !== null) {
    attributes[ATTR_SERVER_ADDRESS] = host;
  }

  const scheme = schemeOf(request.url);
  if (scheme !== null) {
    attributes[ATTR_URL_SCHEME] = scheme;
  }

  return attributes;
}

/**
 * Marca el span con lo que se puede contar de un fallo HTTP.
 *
 * De un `HttpErrorResponse` se toman **el código de estado y nada más**. El
 * cuerpo no: el contrato de error de esta API trae `message` y `correlationId`,
 * y un `message` de validación puede citar el valor que falló —un correo, un
 * documento de identidad—. Ese identificador de correlación ya viaja por su
 * propio camino, el que `errorToViewState` muestra como código de soporte.
 */
function failSpanFromHttp(span: Span, error: unknown): void {
  if (error instanceof HttpErrorResponse) {
    span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, error.status);
    span.setAttribute(ATTR_ERROR_TYPE, httpErrorType(error));
    span.setStatus({ code: SpanStatusCode.ERROR });
    return;
  }

  span.setAttribute(ATTR_ERROR_TYPE, typeOf(error));
  span.setStatus({ code: SpanStatusCode.ERROR });
}

/**
 * La clase del fallo, en términos que agrupan.
 *
 * Un `status` de 0 no es un código de estado: es lo que Angular pone cuando la
 * petición no llegó a salir o no volvió —sin red, DNS caído, CORS bloqueado,
 * petición abortada—. Llamarlo `0` en un atributo de tipo de error no diría
 * nada; `network_error` sí, y es la misma categoría que
 * `errorToViewState` usa para pintar el estado S8.
 */
function httpErrorType(error: HttpErrorResponse): string {
  if (error.status === 0) return 'network_error';
  if (error.status >= 500) return 'server_error';
  if (error.status >= 400) return 'client_error';
  return `http_${error.status}`;
}
