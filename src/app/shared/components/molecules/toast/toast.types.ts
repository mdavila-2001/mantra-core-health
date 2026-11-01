/**
 * Tono del aviso. Son los cuatro que la hoja de estilos ya define como
 * `:host(.toast--success|warning|error|info)`; no hay más.
 */
export type ToastType = 'success' | 'warning' | 'error' | 'info';

/**
 * Un aviso ya encolado.
 *
 * Se llama `ToastMessage` y no `Toast` porque `Toast` es el componente que lo
 * pinta (`toast.ts`), y el contenedor necesita importar los dos a la vez.
 */
export interface ToastMessage {
  readonly id: string;
  readonly type: ToastType;
  readonly message: string;
  /** Encabezado opcional; sin él el aviso es una sola línea. */
  readonly title?: string;
  /** Botón opcional que lleva a donde se resuelve el aviso. */
  readonly action?: ToastAction;
  /**
   * Milisegundos hasta el cierre automático, o `null` para que quede fijo hasta
   * que la persona lo cierre.
   */
  readonly durationMs: number | null;
  /** El origen del aviso, si quien lo lanzó lo declaró (ver {@link ToastInput.key}). */
  readonly key?: string;
}

/**
 * La acción de un aviso: un botón que navega dentro de la app y cierra el aviso.
 *
 * Es una URL de la app (puede llevar `?…`), no un callback: un aviso que
 * sobrevive a la pantalla que lo lanzó no puede llamar de vuelta a un
 * componente que ya no existe.
 */
export interface ToastAction {
  readonly label: string;
  /** URL interna, con su barra inicial: `/my-account/appointments?turno=…`. */
  readonly url: string;
}

/**
 * Lo que aporta quien lanza un aviso. El identificador y la duración por
 * defecto los pone {@link ToastService}: quien avisa no debería tener que
 * inventar un id ni recordar cuánto dura cada tono.
 */
export interface ToastInput {
  readonly type?: ToastType;
  readonly message: string;
  readonly title?: string;
  readonly action?: ToastAction;
  readonly durationMs?: number | null;
  /**
   * El origen del aviso: una pantalla o una sección (`'farmacia.sistema'`).
   * Un aviso nuevo con la misma clave **reemplaza** al que siga visible: el
   * «Guardado» de hace dos segundos ya no aplica cuando llega «Quitado», y
   * apilados tapaban la acción principal. Sin clave, los avisos se encolan
   * como siempre.
   */
  readonly key?: string;
}

/**
 * Cuánto queda en pantalla cada tono.
 *
 * Los errores son **fijos** a propósito: un error que se borra solo mientras la
 * persona lee es un error que nadie leyó. El resto se cierra solo porque son
 * confirmaciones, y una confirmación que hay que cerrar a mano estorba.
 *
 * > Decisión de esta implementación, pendiente de validación con el diseñador.
 */
export const TOAST_DEFAULT_DURATION_MS: Readonly<Record<ToastType, number | null>> = {
  success: 5000,
  info: 5000,
  warning: 7000,
  error: null,
} as const;

/**
 * El tono dicho con palabras. El color y el ícono no comunican solos: quien usa
 * un lector de pantalla necesita oír de qué tipo de aviso se trata.
 */
export const TOAST_TYPE_LABEL: Readonly<Record<ToastType, string>> = {
  success: 'Listo',
  info: 'Información',
  warning: 'Advertencia',
  error: 'Error',
} as const;
