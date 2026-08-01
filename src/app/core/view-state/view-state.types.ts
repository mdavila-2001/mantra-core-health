/**
 * Los 9 estados de UX obligatorios del **M34**, tal como los declara el modelo
 * canónico (`SALUD/Arquitectura/angular-architecture-map.md` §3.18):
 *
 * ```text
 * S1  Route authorization pending      S6  Not found without data leakage
 * S2  Loading / skeleton               S7  Stale data / refresh
 * S3  Empty with next action           S8  Offline / retry
 * S4  Validation or conflict           S9  Unexpected error + request ID
 * S5  Forbidden / purpose denied
 * ```
 *
 * Son contrato para las 81 secciones del proyecto, no una sugerencia visual.
 *
 * ## Las tres distinciones que no son cosméticas
 *
 * - **S1 ≠ S2** — autorizar la ruta ocurre **antes** de pedir datos sensibles.
 *   Mostrar un esqueleto de contenido mientras todavía no se sabe si la persona
 *   puede ver la sección insinúa que hay algo que ver. Ver {@link canRequestSensitiveData}.
 * - **S5 ≠ S6** — prohibido vs. inexistente. Cuando quien mira no tiene derecho
 *   ni a saber que el recurso existe, la respuesta correcta es S6, no S5: un
 *   «no tenés permiso» sobre un identificador confirma que ese identificador es
 *   real. Por eso {@link NotFoundViewState} no transporta ningún dato del recurso.
 * - **S7 exige exponer la antigüedad del dato**, porque 14 proyecciones del
 *   modelo son materializadas y pueden ir atrasadas. Por eso `asOf` es
 *   obligatorio en {@link StaleViewState}: sin él el estado no se puede construir.
 */

/**
 * Discriminante de la unión. Se usan nombres semánticos en vez de `s1`…`s9`
 * porque son los que se leen en las plantillas (`@switch (state().status)`);
 * la trazabilidad al modelo la da {@link M34_CODE_BY_STATUS}, que sí está
 * fijada con una prueba contra los 9 códigos literales.
 */
export type ViewStateStatus =
  | 'route-auth-pending'
  | 'loading'
  | 'empty'
  | 'ready'
  | 'validation'
  | 'forbidden'
  | 'not-found'
  | 'stale'
  | 'offline'
  | 'error';

/** Código del M34, o `null` para el camino feliz — ver {@link ReadyViewState}. */
export type M34Code = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8' | 'S9';

/**
 * Próxima acción concreta que se le ofrece a la persona. El M34 llama al estado
 * vacío «Empty **with next action**»: un vacío sin salida es un callejón.
 */
export interface ViewStateNextAction {
  /** Texto del control, en imperativo y en el idioma del dominio. */
  readonly label: string;
  /** Ruta interna de Angular. Se omite cuando la acción abre un diálogo. */
  readonly route?: string;
}

/** Un problema puntual devuelto por la API, ya traducido a lenguaje de la vista. */
export interface ViewStateIssue {
  /** Campo del formulario al que se ancla, si el problema es de un campo. */
  readonly field?: string;
  /** Mensaje ya listo para mostrar. */
  readonly message: string;
  /** Código estable de la API, para telemetría o para ramificar sin comparar textos. */
  readonly code?: string;
}

/**
 * **S1 · Route authorization pending.** La ruta todavía está resolviendo
 * permiso, alcance de tenant/paciente y propósito de uso. No se pidió ningún
 * dato sensible todavía, y no debe pedirse: es la diferencia con S2.
 */
export interface RouteAuthPendingViewState {
  readonly status: 'route-auth-pending';
}

/**
 * **S2 · Loading / skeleton.** La autorización ya se resolvió y los datos están
 * en camino. Recién acá tiene sentido un esqueleto con la forma del contenido.
 */
export interface LoadingViewState {
  readonly status: 'loading';
}

/**
 * **S3 · Empty with next action.** No hay resultados y la consulta fue legítima.
 * `nextAction` es obligatorio a propósito: el nombre del estado en el modelo
 * incluye la acción, así que un vacío mudo no cumple el contrato.
 */
export interface EmptyViewState {
  readonly status: 'empty';
  readonly nextAction: ViewStateNextAction;
  /** Explicación breve de por qué está vacío («todavía no cargaste estudios»). */
  readonly message?: string;
}

/**
 * Camino feliz: datos frescos. **No tiene código S en el M34** porque esa lista
 * enumera los estados que exigen un tratamiento visual propio; mostrar el
 * contenido es el resto del tiempo. Se incluye en la unión porque sin él
 * `ViewState<T>` no podría representar una sección cargada.
 */
export interface ReadyViewState<T> {
  readonly status: 'ready';
  readonly data: T;
}

/**
 * **S4 · Validation or conflict.** Cubre la validación de campos, el conflicto
 * de concurrencia y el límite de peticiones — los tres se resuelven con la
 * misma forma: decir qué pasó y ofrecer reintentar o corregir.
 */
export interface ValidationViewState {
  readonly status: 'validation';
  readonly issues: readonly ViewStateIssue[];
  /** Presente cuando la API pidió esperar (429): segundos hasta poder reintentar. */
  readonly retryAfterSeconds?: number;
}

/**
 * **S5 · Forbidden / purpose denied.** Se sabe que el recurso existe y el acceso
 * está denegado por permiso, alcance o propósito de uso.
 *
 * `nextAction` distingue el muro de la puerta: un 403 por identidad no
 * verificada lleva al flujo de verificación, mientras que un 403 por rol
 * insuficiente no tiene salida propia.
 */
export interface ForbiddenViewState {
  readonly status: 'forbidden';
  readonly message?: string;
  readonly nextAction?: ViewStateNextAction;
}

/**
 * **S6 · Not found without data leakage.** Deliberadamente **sin campos de
 * datos**: cualquier detalle del recurso —su nombre, su dueño, la razón por la
 * que no aparece— confirmaría que existe. El mensaje, si se da, debe ser el
 * mismo tanto si el recurso no existe como si existe y está oculto.
 */
export interface NotFoundViewState {
  readonly status: 'not-found';
  readonly nextAction?: ViewStateNextAction;
}

/**
 * **S7 · Stale data / refresh.** Hay datos para mostrar, pero vienen de una
 * proyección materializada o de una caché y pueden estar atrasados.
 *
 * `asOf` es **obligatorio**: el contrato del M34 exige exponer la antigüedad, y
 * un tipo que la permita omitir deja que el olvido pase la compilación.
 */
export interface StaleViewState<T> {
  readonly status: 'stale';
  readonly data: T;
  /** Momento al que corresponden los datos. Ver {@link staleAgeMs}. */
  readonly asOf: Date;
}

/**
 * **S8 · Offline / retry.** No hubo respuesta: sin conexión, DNS caído o la
 * petición nunca llegó. Se distingue de S9 en que acá no falló el servidor,
 * así que reintentar es una salida razonable.
 */
export interface OfflineViewState {
  readonly status: 'offline';
  /** Último intento, para poder decir «reintentado hace un momento». */
  readonly lastAttemptAt?: Date;
}

/**
 * **S9 · Unexpected error + request ID.** El identificador es obligatorio: sin
 * él, quien reporta el problema y quien lo busca en los registros no tienen
 * cómo encontrarse.
 */
export interface UnexpectedErrorViewState {
  readonly status: 'error';
  readonly requestId: string;
  readonly message?: string;
}

/**
 * Estado de una sección de la interfaz. Unión discriminada por `status`, para
 * que `@switch` estreche el tipo sin conversiones en la plantilla:
 *
 * ```html
 * @switch (state().status) {
 *   @case ('ready') { <tabla [filas]="state().data" /> }
 *   @case ('stale') { <aviso [desde]="state().asOf" /> }
 * }
 * ```
 */
export type ViewState<T> =
  | RouteAuthPendingViewState
  | LoadingViewState
  | EmptyViewState
  | ReadyViewState<T>
  | ValidationViewState
  | ForbiddenViewState
  | NotFoundViewState
  | StaleViewState<T>
  | OfflineViewState
  | UnexpectedErrorViewState;

/** Los estados que transportan datos para pintar. */
export type ViewStateWithData<T> = ReadyViewState<T> | StaleViewState<T>;

/**
 * Trazabilidad al modelo. `ready` mapea a `null` porque el camino feliz no está
 * en la lista de los 9 — ver {@link ReadyViewState}.
 */
export const M34_CODE_BY_STATUS: Readonly<Record<ViewStateStatus, M34Code | null>> = {
  'route-auth-pending': 'S1',
  loading: 'S2',
  empty: 'S3',
  ready: null,
  validation: 'S4',
  forbidden: 'S5',
  'not-found': 'S6',
  stale: 'S7',
  offline: 'S8',
  error: 'S9',
} as const;
