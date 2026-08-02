import { inject, Injectable } from '@angular/core';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import { ATTR_ERROR_TYPE } from '@opentelemetry/semantic-conventions';

import { TELEMETRY_CONFIG } from '../config/telemetry.token';
import { ATTR, SPAN_NAMES } from '../tracing/tracing.constants';
import { TracingService } from '../tracing/tracing.service';
import { ErrorDeduplicator } from './error-deduplicator';
import { sanitizeError } from './error-sanitizer';

/** De dónde vino el fallo. Lista cerrada: sirve para contar, no para narrar. */
export type ErrorSource = 'error-handler' | 'router' | 'http' | 'hydration' | 'chunk';

/**
 * El destino remoto que `ErrorReporter` llevaba tiempo esperando.
 *
 * Su comentario lo anunciaba: *«que exista un punto único al que enchufar el
 * destino el día que se elija»*. Éste es el enchufe, y llega con la decisión
 * que faltaba tomada: **el destino es propio, del mismo origen**, no un
 * servicio de terceros. Era el reparo escrito en ese mismo archivo —un tercero
 * vería la ruta que cada persona visita, y la sección visitada ya es
 * información de salud— y con un Collector propio deja de aplicar.
 *
 * ## Qué hace con un fallo
 *
 * Si hay un span abierto —dentro de una navegación, de un envío de formulario,
 * de una petición— **lo marca a él**. Es lo que convierte «hubo un error» en
 * «hubo un error durante esto», que es lo único accionable.
 *
 * Si no hay ninguno, abre una traza corta propia. Es el caso del fallo de
 * render, el que hoy no tiene forma de correlacionarse porque nunca hubo
 * petición que numerar.
 *
 * ## Qué no viaja
 *
 * La traza de pila, el objeto original, el cuerpo de la respuesta y el mensaje
 * sin sanear. Ver `error-sanitizer.ts`.
 */
@Injectable({ providedIn: 'root' })
export class ErrorTelemetry {
  private readonly config = inject(TELEMETRY_CONFIG);
  private readonly tracing = inject(TracingService);
  private readonly deduplicator = inject(ErrorDeduplicator);

  /**
   * @param supportId El identificador dictable que `ErrorReporter` ya generó.
   *   Va como atributo para que quien recibe la llamada de soporte pueda buscar
   *   ese código y encontrar la traza — que es lo que hasta ahora solo
   *   funcionaba para los fallos de API, gracias al `correlationId`.
   */
  report(error: unknown, source: ErrorSource, supportId: string, route: string): void {
    if (!this.config.enabled) {
      return;
    }

    /**
     * Un mismo fallo llega por varios caminos a la vez. Sin esto, el panel
     * contaría cinco errores donde hubo uno. Ver `error-deduplicator.ts`.
     */
    if (!this.deduplicator.shouldReport(error)) {
      return;
    }

    const { type, message } = sanitizeError(error);
    const attributes = {
      [ATTR_ERROR_TYPE]: type,
      [ATTR.errorSource]: isHydrationError(message) ? 'hydration' : source,
      /**
       * `false` porque estos son los que **nadie** capturó: llegaron al
       * manejador global. Un error tratado por la pantalla —un 422 que se
       * convierte en el estado de validación— no pasa por acá.
       */
      [ATTR.errorHandled]: false,
      [ATTR.routeTemplate]: route,
      'app.support.id': supportId,
      [ATTR.release]: this.config.version,
      [ATTR.buildId]: this.config.buildId,
    };

    const active = trace.getActiveSpan();
    if (active !== undefined && active.isRecording()) {
      active.setAttributes(attributes);
      active.setStatus({ code: SpanStatusCode.ERROR, message });
      return;
    }

    /**
     * Sin contexto activo: el fallo de render, el que hasta hoy era invisible.
     * Se abre y se cierra en el acto — el intervalo no significa nada, lo que
     * importa es que el error exista como traza consultable con su código de
     * soporte.
     */
    const span = this.tracing.startSpan(SPAN_NAMES.error, attributes);
    span.setStatus({ code: SpanStatusCode.ERROR, message });
    span.end();
  }
}

/**
 * Los fallos de hidratación de Angular llegan con su propio código.
 *
 * Se reconocen por el prefijo `NG05`, que es el bloque reservado a hidratación
 * (`NG0500` en adelante). Distinguirlos importa porque su causa y su arreglo no
 * se parecen a los de un error normal: son diferencias entre el HTML del
 * servidor y lo que el navegador esperaba, y el runbook que los cubre es otro.
 */
function isHydrationError(message: string): boolean {
  return /\bNG05\d\d\b/.test(message);
}
