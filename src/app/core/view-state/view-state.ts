import {
  M34_CODE_BY_STATUS,
  type EmptyViewState,
  type ForbiddenViewState,
  type LoadingViewState,
  type M34Code,
  type NotFoundViewState,
  type OfflineViewState,
  type ReadyViewState,
  type RouteAuthPendingViewState,
  type StaleViewState,
  type UnexpectedErrorViewState,
  type ValidationViewState,
  type ViewState,
  type ViewStateIssue,
  type ViewStateNextAction,
  type ViewStateWithData,
} from './view-state.types';

// ---------------------------------------------------------------------------
// Constructores
//
// Uno por estado, en vez de literales sueltos repartidos por la aplicación: el
// tipo de retorno es el estado concreto (no la unión), así que quien construye
// un `stale` conserva el estrechamiento sin volver a comprobar `status`.
// ---------------------------------------------------------------------------

/** **S1** — la ruta todavía resuelve permiso, alcance y propósito de uso. */
export function routeAuthPending(): RouteAuthPendingViewState {
  return { status: 'route-auth-pending' };
}

/** **S2** — autorización resuelta, datos en camino. */
export function loading(): LoadingViewState {
  return { status: 'loading' };
}

/** **S3** — sin resultados. La próxima acción es obligatoria por contrato. */
export function empty(nextAction: ViewStateNextAction, message?: string): EmptyViewState {
  return message === undefined
    ? { status: 'empty', nextAction }
    : { status: 'empty', nextAction, message };
}

/** Camino feliz: datos frescos. */
export function ready<T>(data: T): ReadyViewState<T> {
  return { status: 'ready', data };
}

/** **S4** — validación, conflicto o límite de peticiones. */
export function validation(
  issues: readonly ViewStateIssue[],
  retryAfterSeconds?: number,
): ValidationViewState {
  return retryAfterSeconds === undefined
    ? { status: 'validation', issues }
    : { status: 'validation', issues, retryAfterSeconds };
}

/**
 * **S5** — acceso denegado sobre un recurso que la persona sí puede saber que
 * existe. Si no puede saberlo, corresponde {@link notFound}.
 */
export function forbidden(options?: {
  message?: string;
  nextAction?: ViewStateNextAction;
}): ForbiddenViewState {
  const state: ForbiddenViewState = { status: 'forbidden' };
  return {
    ...state,
    ...(options?.message === undefined ? {} : { message: options.message }),
    ...(options?.nextAction === undefined ? {} : { nextAction: options.nextAction }),
  };
}

/**
 * **S6** — no encontrado, sin filtrar existencia.
 *
 * No recibe nada del recurso a propósito: el mensaje debe ser idéntico tanto si
 * no existe como si existe y está oculto. La única variación permitida es hacia
 * dónde seguir, que no depende del recurso.
 */
export function notFound(nextAction?: ViewStateNextAction): NotFoundViewState {
  return nextAction === undefined ? { status: 'not-found' } : { status: 'not-found', nextAction };
}

/**
 * **S7** — datos que pueden estar atrasados. `asOf` no es opcional: es el
 * requisito explícito del M34 para las 14 proyecciones materializadas.
 */
export function stale<T>(data: T, asOf: Date): StaleViewState<T> {
  return { status: 'stale', data, asOf };
}

/** **S8** — la petición no llegó a destino; reintentar es una salida válida. */
export function offline(lastAttemptAt?: Date): OfflineViewState {
  return lastAttemptAt === undefined
    ? { status: 'offline' }
    : { status: 'offline', lastAttemptAt };
}

/**
 * **S9** — fallo inesperado. El identificador de la petición es obligatorio
 * porque es lo único que conecta el reporte de la persona con los registros del
 * servidor; si la respuesta no lo trae, quien la traduzca debe generarlo.
 */
export function unexpectedError(requestId: string, message?: string): UnexpectedErrorViewState {
  return message === undefined
    ? { status: 'error', requestId }
    : { status: 'error', requestId, message };
}

// ---------------------------------------------------------------------------
// Guardas de tipo
// ---------------------------------------------------------------------------

export function isRouteAuthPending<T>(state: ViewState<T>): state is RouteAuthPendingViewState {
  return state.status === 'route-auth-pending';
}

export function isLoading<T>(state: ViewState<T>): state is LoadingViewState {
  return state.status === 'loading';
}

export function isEmpty<T>(state: ViewState<T>): state is EmptyViewState {
  return state.status === 'empty';
}

export function isReady<T>(state: ViewState<T>): state is ReadyViewState<T> {
  return state.status === 'ready';
}

export function isValidation<T>(state: ViewState<T>): state is ValidationViewState {
  return state.status === 'validation';
}

export function isForbidden<T>(state: ViewState<T>): state is ForbiddenViewState {
  return state.status === 'forbidden';
}

export function isNotFound<T>(state: ViewState<T>): state is NotFoundViewState {
  return state.status === 'not-found';
}

export function isStale<T>(state: ViewState<T>): state is StaleViewState<T> {
  return state.status === 'stale';
}

export function isOffline<T>(state: ViewState<T>): state is OfflineViewState {
  return state.status === 'offline';
}

export function isUnexpectedError<T>(state: ViewState<T>): state is UnexpectedErrorViewState {
  return state.status === 'error';
}

// ---------------------------------------------------------------------------
// Consultas y transformaciones
// ---------------------------------------------------------------------------

/** Hay contenido para pintar: datos frescos (`ready`) o atrasados (`stale`). */
export function hasData<T>(state: ViewState<T>): state is ViewStateWithData<T> {
  return state.status === 'ready' || state.status === 'stale';
}

/** Los datos si los hay, `null` si el estado no transporta ninguno. */
export function dataOf<T>(state: ViewState<T>): T | null {
  return hasData(state) ? state.data : null;
}

/**
 * Aplica una transformación a los datos conservando el estado. Es lo que separa
 * el DTO del tipo de la vista sin repetir el `switch` en cada pantalla: los
 * estados sin datos pasan intactos.
 */
export function mapData<T, U>(state: ViewState<T>, transform: (data: T) => U): ViewState<U> {
  if (state.status === 'ready') {
    return ready(transform(state.data));
  }
  if (state.status === 'stale') {
    return stale(transform(state.data), state.asOf);
  }
  return state;
}

/**
 * Antigüedad del dato en milisegundos. Es la cifra que S7 obliga a mostrar;
 * darla ya calculada evita que cada pantalla reste fechas a mano.
 */
export function staleAgeMs<T>(state: StaleViewState<T>, now: Date = new Date()): number {
  return now.getTime() - state.asOf.getTime();
}

/**
 * Regla **S1 ≠ S2** del M34, expresada como pregunta: mientras la ruta no haya
 * terminado de autorizar, no se piden datos sensibles.
 *
 * Devuelve `false` únicamente para S1 — cualquier otro estado implica que la
 * autorización ya se resolvió, incluidos los de error.
 */
export function canRequestSensitiveData<T>(state: ViewState<T>): boolean {
  return state.status !== 'route-auth-pending';
}

/** Código del M34 del estado, o `null` para el camino feliz. */
export function m34CodeOf<T>(state: ViewState<T>): M34Code | null {
  return M34_CODE_BY_STATUS[state.status];
}
