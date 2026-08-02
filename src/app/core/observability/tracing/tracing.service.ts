import { inject, Injectable } from '@angular/core';
import {
  context,
  SpanStatusCode,
  trace,
  type Attributes,
  type Span,
  type SpanKind,
  type Tracer,
} from '@opentelemetry/api';
import { ATTR_ERROR_TYPE } from '@opentelemetry/semantic-conventions';
import { Observable, defer, finalize, tap } from 'rxjs';

import { TELEMETRY_CONFIG } from '../config/telemetry.token';
import { sanitizeError } from '../errors/error-sanitizer';
import { ATTR, TRACER_NAME } from './tracing.constants';

/**
 * La única forma en que el resto de la aplicación abre un span.
 *
 * ## Por qué no hay una versión «no-op» aparte
 *
 * `@opentelemetry/api` ya la tiene. Mientras no haya un proveedor registrado
 * —telemetría apagada, SDK todavía cargando, o una prueba que no lo montó—
 * `trace.getTracer()` devuelve un trazador que crea spans que no registran
 * nada: sin coste, sin exportación, sin cambiar tiempos. La operación se
 * ejecuta igual y el resultado y los errores salen intactos.
 *
 * Escribir una clase paralela para lo mismo tendría el problema de siempre: dos
 * caminos que hay que mantener iguales, y uno de los dos sin probar de verdad.
 * Lo que sí hay es una prueba que fija ese comportamiento, para que no dependa
 * de una nota al pie.
 *
 * ## Qué hace y qué no
 *
 * Abre un span, lo mantiene activo mientras dura la operación, lo marca si algo
 * falla y lo cierra **una sola vez**. Nada más. No decide nombres, no adivina
 * atributos y no lee argumentos: quien llama sabe qué está haciendo y qué se
 * puede contar de ello.
 */
@Injectable({ providedIn: 'root' })
export class TracingService {
  private readonly config = inject(TELEMETRY_CONFIG);

  /**
   * Se pide una vez y se guarda.
   *
   * Es seguro pedirlo antes de que exista el SDK: la API devuelve un trazador
   * intermediario que resuelve al real en cuanto se registra un proveedor. Sin
   * eso habría que pedirlo en cada llamada, o retrasar la inyección del
   * servicio hasta que el fragmento cargara.
   */
  private readonly tracer: Tracer = trace.getTracer(TRACER_NAME, this.config.version);

  /**
   * Ejecuta algo síncrono dentro de un span.
   *
   * El span queda **activo** durante la operación, así que lo que se abra
   * dentro —otro span, una petición— cuelga de él sin que haya que pasarlo.
   */
  runInSpan<T>(name: string, attributes: Attributes, operation: (span: Span) => T): T {
    return this.tracer.startActiveSpan(name, { attributes }, (span) => {
      try {
        const result = operation(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error: unknown) {
        this.failSpan(span, error);
        // Se relanza siempre. Un span no cambia el comportamiento de nada: si
        // esto tragara el error, la telemetría habría alterado la aplicación.
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Lo mismo para una promesa.
   *
   * **Límite conocido, y es del modo zoneless:** el contexto activo no
   * sobrevive a un `await`. Un span que se abra *después* de un `await` dentro
   * de `operation` no será hijo de éste, sino una raíz nueva. Cuando haga falta
   * esa jerarquía, se pasa el `span` recibido y se usa {@link runInChildSpan}.
   * El desarrollo está en `docs/observability/angular/03-async-context-strategy.md`.
   */
  async runInAsyncSpan<T>(
    name: string,
    attributes: Attributes,
    operation: (span: Span) => Promise<T>,
  ): Promise<T> {
    const span = this.tracer.startSpan(name, { attributes });

    try {
      const result = await context.with(trace.setSpan(context.active(), span), () =>
        operation(span),
      );
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error: unknown) {
      this.failSpan(span, error);
      throw error;
    } finally {
      span.end();
    }
  }

  /**
   * Envuelve un Observable con un span que dura lo que dura la suscripción.
   *
   * Los cuatro detalles que hacen que esto sea correcto y no una fuente de
   * spans colgados:
   *
   *   1. **`defer`**: el span se abre al *suscribirse*, no al construir. Un
   *      Observable que nadie consume no produce nada.
   *   2. **La suscripción corre dentro del contexto**, no solo la construcción.
   *      Es lo que hace que la petición HTTP que arranca al suscribirse quede
   *      como hija. Envolver únicamente la fábrica no alcanza: con un
   *      Observable frío, el trabajo pasa al suscribirse.
   *   3. **`finalize`** cierra el span pase lo que pase — completado, error o
   *      desuscripción— y una sola vez.
   *   4. **Una emisión no cierra nada.** Un flujo con veinte emisiones produce
   *      un span, no veinte.
   *
   * Con `share` o `shareReplay` el span pertenece a la **primera** suscripción,
   * que es la que dispara el trabajo; las demás no abren uno propio. Con
   * `retry`, el reintento ocurre dentro del mismo span: por eso el interceptor
   * anota el reintento como evento y no como span nuevo.
   */
  traceObservable<T>(
    name: string,
    attributes: Attributes,
    sourceFactory: (span: Span) => Observable<T>,
  ): Observable<T> {
    return defer(() => {
      const span = this.tracer.startSpan(name, { attributes });
      const active = trace.setSpan(context.active(), span);
      const source = context.with(active, () => sourceFactory(span));

      /** Distingue «terminó» de «alguien se dio de baja antes». */
      let settled = false;

      return new Observable<T>((subscriber) =>
        context.with(active, () => source.subscribe(subscriber)),
      ).pipe(
        tap({
          error: (error: unknown) => {
            settled = true;
            this.failSpan(span, error);
          },
          complete: () => {
            settled = true;
            span.setStatus({ code: SpanStatusCode.OK });
          },
        }),
        finalize(() => {
          if (!settled) {
            // Una navegación que se abandona, un `switchMap` que descarta el
            // anterior, un componente que se destruye. No es un error, y
            // marcarlo como tal llenaría el panel de rojos que no lo son.
            span.setAttribute(ATTR.result, 'cancelled');
          }
          span.end();
        }),
      );
    });
  }

  /**
   * Un span suelto, para cuando el final no coincide con el fin de una función.
   *
   * Quien lo abre se compromete a cerrarlo. Es la forma más fácil de dejar un
   * span abierto, así que se usa solo donde las otras tres no encajan: el
   * arranque, la navegación del Router y la hidratación, que empiezan en un
   * evento y terminan en otro.
   */
  startSpan(name: string, attributes: Attributes = {}, kind?: SpanKind): Span {
    return this.tracer.startSpan(name, { attributes, kind });
  }

  /** Un span colgado de otro de forma explícita, sin depender del contexto. */
  runInChildSpan<T>(parent: Span, name: string, attributes: Attributes, operation: () => T): T {
    return context.with(trace.setSpan(context.active(), parent), () =>
      this.runInSpan(name, attributes, operation),
    );
  }

  /** El span activo, si hay alguno. */
  activeSpan(): Span | undefined {
    return trace.getActiveSpan();
  }

  /**
   * Marca un span como fallido sin volcar el error dentro.
   *
   * No usa `span.recordException`: registraría la traza de pila, que en Angular
   * lleva valores interpolados de plantillas. Ver `errors/error-sanitizer.ts`.
   */
  failSpan(span: Span, error: unknown): void {
    const { type, message } = sanitizeError(error);
    span.setAttribute(ATTR_ERROR_TYPE, type);
    span.setStatus({ code: SpanStatusCode.ERROR, message });
  }
}
