import { SpanStatusCode, trace, type Attributes } from '@opentelemetry/api';
import { ATTR_ERROR_TYPE } from '@opentelemetry/semantic-conventions';

import { TRACER_NAME } from './tracing.constants';

/**
 * El puente entre «ya pasó algo que medir» y «todavía no hay SDK».
 *
 * El SDK vive en un fragmento aparte —el paquete inicial ya excede su
 * presupuesto, ver la auditoría— y llega unos milisegundos después de que
 * arranque la aplicación. Justo en esa ventana ocurre lo primero que hay que
 * medir: el arranque de Angular y, a veces, la primera navegación.
 *
 * Hay tres salidas posibles y dos son malas:
 *
 *   - **Perder esos spans.** Deja sin respuesta «¿cuánto tardó el arranque?»,
 *     que es media razón de existir de la fase de carga.
 *   - **Generar identificadores a mano** para abrir el span antes de tiempo.
 *     Prohibido, y con motivo: un `trace_id` fabricado no se correlaciona con
 *     nada y puede colisionar.
 *   - **Anotar el intervalo y emitirlo después.** Es lo que hace esto.
 *
 * OpenTelemetry admite `startTime` al crear el span y `endTime` al cerrarlo, así
 * que un span emitido tarde conserva la duración real. Lo que no conserva es el
 * padre: por eso acá solo entran spans **raíz** —el arranque y una navegación
 * lo son en el navegador— y nunca un span hijo.
 */

export interface DeferredSpanEvent {
  readonly name: string;
  /** Milisegundos desde época. */
  readonly time: number;
}

export interface DeferredSpan {
  readonly name: string;
  readonly startTime: number;
  readonly endTime: number;
  readonly attributes?: Attributes;
  readonly events?: readonly DeferredSpanEvent[];
  /** Clase del error, ya saneada, si la operación terminó mal. */
  readonly errorType?: string;
}

/**
 * Cuántos spans se guardan como mucho.
 *
 * Treinta y dos cubre el arranque y varias navegaciones tempranas con holgura.
 * El límite existe para el caso en que el fragmento no llegue nunca —red
 * caída, bloqueador de contenido— y algo siga registrando: sin tope, el búfer
 * crecería mientras la pestaña siga abierta.
 */
export const DEFERRED_LIMIT = 32;

/**
 * Cuánto se espera al fragmento antes de tirar lo guardado.
 *
 * Diez segundos es mucho más de lo que tarda un fragmento del mismo origen. Si
 * pasado ese tiempo no llegó, no va a llegar, y guardar el arranque de una
 * sesión que nunca va a exportarse solo ocupa memoria.
 */
export const DEFERRED_TTL_MS = 10_000;

let ready = false;
let pending: DeferredSpan[] = [];
let expiry: ReturnType<typeof setTimeout> | null = null;

/**
 * Anota un intervalo ya terminado.
 *
 * Con el SDK listo lo emite en el acto; sin él, lo guarda. Quien llama no tiene
 * que saber en cuál de los dos casos está, que es todo el punto.
 */
export function recordDeferredSpan(span: DeferredSpan): void {
  if (ready) {
    emit(span);
    return;
  }

  if (pending.length >= DEFERRED_LIMIT) {
    return;
  }

  pending.push(span);

  if (expiry === null) {
    expiry = setTimeout(discard, DEFERRED_TTL_MS);
    // Un temporizador pendiente no debe mantener vivo un proceso de Node al
    // terminar el render del servidor ni al acabar una prueba.
    expiry.unref?.();
  }
}

/**
 * El SDK ya está registrado: se emite lo guardado y se deja de guardar.
 *
 * Es idempotente porque el arranque también lo es: la recarga en caliente del
 * servidor de desarrollo puede volver a pasar por acá.
 */
export function flushDeferredSpans(): void {
  ready = true;
  clearExpiry();

  const queued = pending;
  pending = [];
  for (const span of queued) {
    emit(span);
  }
}

/**
 * Vuelve al estado inicial.
 *
 * Para las pruebas, que arrancan la aplicación varias veces en el mismo
 * proceso, y para la recarga en caliente.
 */
export function resetDeferredSpans(): void {
  ready = false;
  pending = [];
  clearExpiry();
}

/** Lo que hay en el búfer. Existe para poder afirmarlo en una prueba. */
export function pendingDeferredSpans(): readonly DeferredSpan[] {
  return pending;
}

/**
 * Si el SDK ya está registrado.
 *
 * Lo consulta quien puede elegir entre abrir un span **vivo** —que sirve de
 * padre a lo que ocurra dentro— y anotar el intervalo para emitirlo después. El
 * seguimiento de navegaciones es ese caso: un span vivo permite que las
 * peticiones de esa navegación cuelguen de él, y eso solo se puede hacer si hay
 * SDK en ese momento.
 */
export function isTelemetryReady(): boolean {
  return ready;
}

function discard(): void {
  pending = [];
  expiry = null;
}

function clearExpiry(): void {
  if (expiry !== null) {
    clearTimeout(expiry);
    expiry = null;
  }
}

/**
 * Crea el span con sus tiempos originales.
 *
 * `root: true` es deliberado: cuando esto corre, el contexto activo puede ser
 * cualquiera —el flujo lo dispara el arranque del SDK, no la operación que se
 * está describiendo— y colgarlo de un padre casual produciría una jerarquía
 * inventada.
 */
function emit(span: DeferredSpan): void {
  const created = trace.getTracer(TRACER_NAME).startSpan(span.name, {
    root: true,
    startTime: span.startTime,
    attributes: span.attributes,
  });

  for (const event of span.events ?? []) {
    created.addEvent(event.name, event.time);
  }

  if (span.errorType !== undefined) {
    created.setAttribute(ATTR_ERROR_TYPE, span.errorType);
    created.setStatus({ code: SpanStatusCode.ERROR });
  }

  created.end(span.endTime);
}
