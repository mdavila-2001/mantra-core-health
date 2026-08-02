import { DestroyRef, Injectable, inject } from '@angular/core';
import {
  NavigationCancel,
  NavigationCancellationCode,
  NavigationEnd,
  NavigationError,
  NavigationSkipped,
  NavigationStart,
  Router,
  RouteConfigLoadEnd,
  RouteConfigLoadStart,
  type Event as RouterEvent,
  type Route,
} from '@angular/router';
import { context, trace, type Span } from '@opentelemetry/api';

import { typeOf } from '../errors/error-sanitizer';
import { isTelemetryReady, recordDeferredSpan } from '../tracing/deferred-spans';
import { ATTR, SPAN_EVENTS, SPAN_NAMES, type NavigationResult } from '../tracing/tracing.constants';
import { TracingService } from '../tracing/tracing.service';
import {
  ChunkLoadStore,
  cancellationName,
  isChunkError,
  type NavigationTrace,
} from './navigation-span.store';
import { routeTemplate } from './route-template';

/**
 * Un span por navegación del Router, de principio a fin.
 *
 * Responde las preguntas que hasta ahora no tenían respuesta: cuánto tardó la
 * navegación, si un guard la desvió, si el fragmento diferido fue lo lento, y
 * —lo más importante— **de qué navegación cuelga cada petición HTTP**.
 *
 * ## Vivo cuando se puede, diferido cuando no
 *
 * El span se abre en `NavigationStart` y se cierra en el evento final. Mientras
 * está abierto queda **activo**, así que las peticiones que salgan durante la
 * navegación cuelgan de él sin que nadie las conecte a mano. Eso solo funciona
 * si el SDK ya está registrado.
 *
 * Si todavía no lo está —la primerísima navegación puede adelantarse al
 * fragmento del SDK— se anota el intervalo y se emite después
 * (`tracing/deferred-spans.ts`). Se pierde la paternidad, no la medición.
 *
 * ## Lo que no se registra
 *
 * Ninguna URL entra tal cual. Todo pasa por `routeTemplate`, que la convierte a
 * la plantilla declarada en el Router: dos rutas de esta aplicación llevan un
 * token de un solo uso en el query string, y sin esa conversión acabarían en
 * Jaeger.
 */
@Injectable({ providedIn: 'root' })
export class RouterTracing {
  private readonly router = inject(Router);
  private readonly tracing = inject(TracingService);
  private readonly destroyRef = inject(DestroyRef);

  /** Navegaciones en curso, por identificador del Router. */
  private readonly navigations = new Map<number, NavigationTrace>();

  /** Las cargas de fragmento diferido en curso. Ver `navigation-span.store.ts`. */
  private readonly chunkLoads = new ChunkLoadStore();

  private started = false;

  /**
   * Empieza a escuchar. Lo llama un inicializador de aplicación.
   *
   * Idempotente: en pruebas el inicializador puede correr más de una vez sobre
   * el mismo inyector, y dos suscripciones producirían dos spans por navegación.
   */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    const subscription = this.router.events.subscribe((event) => this.onEvent(event));

    /**
     * La baja va en el `DestroyRef` de la raíz y no en un `takeUntilDestroyed`
     * porque esto arranca desde un inicializador, fuera de un contexto de
     * inyección con destrucción propia. Sin ella, cada aplicación creada en una
     * prueba dejaría una suscripción viva sobre un Router ya desechado.
     */
    this.destroyRef.onDestroy(() => {
      subscription.unsubscribe();
      this.abandonOpenSpans();
    });
  }

  private onEvent(event: RouterEvent): void {
    if (event instanceof NavigationStart) {
      this.begin(event);
      return;
    }

    if (event instanceof RouteConfigLoadStart) {
      this.beginChunkLoad(event.route);
      return;
    }

    if (event instanceof RouteConfigLoadEnd) {
      this.chunkLoads.close(event.route, 'loaded');
      return;
    }

    if (event instanceof NavigationEnd) {
      this.finish(event.id, 'completed');
      return;
    }

    if (event instanceof NavigationCancel) {
      this.finishCancelled(event);
      return;
    }

    if (event instanceof NavigationError) {
      this.finishFailed(event);
      return;
    }

    if (event instanceof NavigationSkipped) {
      this.finish(event.id, 'skipped');
    }
  }

  private begin(event: NavigationStart): void {
    const from = routeTemplate(this.router, this.router.url);
    const to = routeTemplate(this.router, event.url);

    const attributes = {
      [ATTR.routeTemplate]: to,
      [ATTR.routeFrom]: from,
      [ATTR.routeTo]: to,
      [ATTR.navigationId]: event.id,
      /** `imperative`, `popstate` o `hashchange`. Nunca la URL. */
      [ATTR.navigationTrigger]: event.navigationTrigger ?? 'imperative',
    };

    this.navigations.set(event.id, {
      startTime: Date.now(),
      attributes,
      span: isTelemetryReady()
        ? this.tracing.startSpan(SPAN_NAMES.navigation, attributes)
        : null,
    });
  }

  /**
   * Cierra la navegación con su resultado.
   *
   * Un identificador desconocido se ignora en silencio: puede llegar un evento
   * de una navegación que empezó antes de que esto se suscribiera, y anotar un
   * final sin principio produciría un span de duración inventada.
   */
  private finish(id: number, result: NavigationResult, errorType?: string): void {
    const navigation = this.navigations.get(id);
    if (navigation === undefined) {
      return;
    }
    this.navigations.delete(id);

    // Un fragmento cuya carga nunca terminó: la navegación murió con él.
    this.chunkLoads.failAll(errorType ?? 'NavigationCancelled');

    const attributes = { ...navigation.attributes, [ATTR.navigationResult]: result };

    if (navigation.span !== null) {
      navigation.span.setAttributes(attributes);
      if (errorType !== undefined) {
        navigation.span.setAttribute('error.type', errorType);
      }
      navigation.span.end();
      return;
    }

    recordDeferredSpan({
      name: SPAN_NAMES.navigation,
      startTime: navigation.startTime,
      endTime: Date.now(),
      attributes,
      errorType,
    });
  }

  /**
   * Una cancelación no es un error.
   *
   * Pasa constantemente y por motivos sanos: un guard devuelve un `UrlTree`,
   * alguien pulsa dos enlaces seguidos, una redirección encadena. Marcarlas
   * como error llenaría el panel de rojos que nadie puede accionar.
   *
   * El **código** sí se registra, y se traduce a un nombre estable. El campo
   * `reason` que trae el evento no: es un texto pensado para leer en la consola
   * durante el desarrollo, cambia entre versiones de Angular y puede incluir la
   * URL entera —con su query string—.
   */
  private finishCancelled(event: NavigationCancel): void {
    const navigation = this.navigations.get(event.id);
    if (navigation !== undefined) {
      const redirected = event.code === NavigationCancellationCode.Redirect;
      navigation.attributes[ATTR.navigationRedirected] = redirected;
      navigation.attributes['angular.navigation.cancellation.code'] = cancellationName(event.code);

      if (redirected) {
        navigation.span?.addEvent(SPAN_EVENTS.navigationRedirected);
      }
    }

    this.finish(event.id, 'cancelled');
  }

  private finishFailed(event: NavigationError): void {
    const errorType = typeOf(event.error);
    const navigation = this.navigations.get(event.id);

    /**
     * El fallo más habitual acá es el fragmento que no bajó: se desplegó una
     * versión nueva y alguien tenía la anterior abierta. `app.routes.ts` ya lo
     * atrapa y muestra la pantalla de recuperación; esto lo hace contable.
     */
    if (navigation !== undefined && isChunkError(errorType)) {
      navigation.span?.addEvent(SPAN_EVENTS.chunkLoadFailed);
      navigation.attributes[ATTR.lazyResult] = 'failed';
    }

    this.finish(event.id, 'failed', errorType);
  }

  private beginChunkLoad(route: Route): void {
    const template = route.path === undefined ? 'desconocida' : `/${route.path}`;
    const attributes = {
      [ATTR.routeTemplate]: template,
      [ATTR.lazyType]: route.loadChildren === undefined ? 'component' : 'children',
    };

    /**
     * El span de carga cuelga de la navegación en curso, que es el contexto
     * activo si hay una abierta. Con el SDK todavía cargando no hay span vivo y
     * la carga se anota como raíz: el intervalo se conserva, la jerarquía no.
     */
    this.chunkLoads.open(route, {
      startTime: Date.now(),
      attributes,
      span: isTelemetryReady()
        ? this.startChildOfActiveNavigation(SPAN_NAMES.lazyRouteLoad, attributes)
        : null,
    });
  }

  /** Abre un span colgado de la navegación abierta más reciente, si la hay. */
  private startChildOfActiveNavigation(
    name: string,
    attributes: Record<string, string | number | boolean>,
  ): Span {
    const parent = [...this.navigations.values()].at(-1)?.span;
    if (parent === undefined || parent === null) {
      return this.tracing.startSpan(name, attributes);
    }

    return context.with(trace.setSpan(context.active(), parent), () =>
      this.tracing.startSpan(name, attributes),
    );
  }

  /**
   * Cierra lo que quedara abierto al desecharse la aplicación.
   *
   * Un span sin cerrar no se exporta nunca: se queda en memoria hasta que la
   * pestaña muere. Marcarlos como abandonados es lo que evita que una prueba o
   * una recarga en caliente vaya dejando spans colgados.
   */
  private abandonOpenSpans(): void {
    for (const { span } of this.navigations.values()) {
      span?.setAttribute(ATTR.navigationResult, 'cancelled');
      span?.end();
    }
    this.navigations.clear();

    this.chunkLoads.abandonAll();
  }
}
