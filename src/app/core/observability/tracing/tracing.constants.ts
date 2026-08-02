/**
 * Los nombres y las claves, en un solo sitio.
 *
 * No es organización por gusto: un nombre de span escrito a mano en dos
 * lugares se separa en el primer cambio, y el síntoma es un panel donde la
 * mitad de las navegaciones aparecen bajo `angular.navigation` y la otra mitad
 * bajo `angular.navigate`. Nadie lo nota hasta que hace falta una estadística.
 *
 * La justificación de cada nombre está en
 * `docs/observability/angular/02-naming-conventions.md`.
 */

/** Spans técnicos: los emite la infraestructura de observabilidad. */
export const SPAN_NAMES = {
  bootstrap: 'angular.bootstrap',
  documentLoad: 'angular.document.load',
  navigation: 'angular.navigation',
  lazyRouteLoad: 'angular.lazy-route.load',
  guardEvaluate: 'angular.guard.evaluate',
  httpRequest: 'angular.http.request',
  formSubmit: 'angular.form.submit',
  hydration: 'angular.hydration',
  /**
   * Solo para el fallo que ocurre **sin** ninguna traza abierta: una excepción
   * en el constructor de un componente, un `computed` que revienta al pintar.
   * Es el hueco que la documentación de este proyecto tenía marcado como
   * «imposible de correlacionar: no hubo petición».
   */
  error: 'angular.error',
} as const;

/** Instantes dentro de un span. Un evento no es un span hijo. */
export const SPAN_EVENTS = {
  otelInitialized: 'otel.initialized',
  bootstrapStarted: 'bootstrap.started',
  bootstrapCompleted: 'bootstrap.completed',
  applicationStable: 'application.stable',
  hydrationStarted: 'hydration.started',
  hydrationCompleted: 'hydration.completed',
  hydrationFailed: 'hydration.failed',
  httpRetry: 'http.retry',
  authRefreshStarted: 'auth.refresh.started',
  navigationRedirected: 'navigation.redirected',
  chunkLoadFailed: 'chunk.load.failed',
} as const;

/**
 * Atributos propios.
 *
 * Los de HTTP no están acá: salen de `@opentelemetry/semantic-conventions`,
 * porque son convención del ecosistema y no de este proyecto. Un
 * `http.method` propio en vez del `http.request.method` estándar rompería
 * cualquier panel prearmado de Jaeger.
 */
export const ATTR = {
  // De la aplicación
  feature: 'app.feature',
  operation: 'app.operation',
  routeTemplate: 'app.route.template',
  routeFrom: 'app.route.from',
  routeTo: 'app.route.to',
  apiRouteTemplate: 'app.api.route.template',
  release: 'app.release',
  buildId: 'app.build.id',
  environment: 'app.environment',

  // De Angular
  navigationId: 'angular.navigation.id',
  navigationTrigger: 'angular.navigation.trigger',
  navigationResult: 'angular.navigation.result',
  navigationRedirected: 'angular.navigation.redirected',
  lazyType: 'angular.lazy.type',
  lazyResult: 'angular.lazy.result',
  guardName: 'angular.guard.name',
  guardResult: 'angular.guard.result',
  component: 'angular.component',
  renderingMode: 'angular.rendering.mode',
  changeDetectionMode: 'angular.change_detection.mode',

  // De interfaz
  formName: 'ui.form.name',
  action: 'ui.action',
  result: 'ui.result',
  validationErrorCount: 'validation.error.count',

  // De autenticación — categorías, nunca datos
  authMethod: 'auth.method',
  authResult: 'auth.result',
  authFailureCategory: 'auth.failure.category',

  // De archivos — nunca el nombre ni el contenido
  fileExtension: 'file.extension',
  fileMimeType: 'file.mime.type',
  fileSizeBucket: 'file.size.bucket',

  // De errores
  errorSource: 'error.source',
  errorHandled: 'error.handled',
} as const;

/** Los únicos valores que `angular.navigation.result` puede tomar. */
export const NAVIGATION_RESULTS = ['completed', 'cancelled', 'failed', 'skipped'] as const;
export type NavigationResult = (typeof NAVIGATION_RESULTS)[number];

/** Los únicos valores que `angular.guard.result` puede tomar. */
export const GUARD_RESULTS = ['allowed', 'denied', 'redirected', 'error'] as const;
export type GuardResult = (typeof GUARD_RESULTS)[number];

/**
 * Los únicos valores que `ui.result` puede tomar.
 *
 * Es una lista cerrada porque el propósito es contar: «cuántos envíos del
 * formulario de registro terminaron en error» solo se puede responder si
 * «error» se escribe siempre igual.
 */
export const UI_RESULTS = ['success', 'validation_error', 'error', 'cancelled'] as const;
export type UiResult = (typeof UI_RESULTS)[number];

/**
 * Categorías de fallo de autenticación.
 *
 * Cerrada a propósito: el mensaje que devuelve la API puede cambiar de
 * redacción, venir traducido o describir algo interno del servidor. Una
 * categoría no.
 */
export const AUTH_FAILURE_CATEGORIES = [
  'invalid_credentials',
  'expired_session',
  'network_error',
  'server_error',
  'validation_error',
  'rate_limited',
  'unknown',
] as const;
export type AuthFailureCategory = (typeof AUTH_FAILURE_CATEGORIES)[number];

/** Nombre del instrumentador, el que Jaeger muestra como `otel.library.name`. */
export const TRACER_NAME = 'mantra-core-health/angular';
