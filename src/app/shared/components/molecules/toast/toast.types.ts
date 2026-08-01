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
  /**
   * Milisegundos hasta el cierre automático, o `null` para que quede fijo hasta
   * que la persona lo cierre.
   */
  readonly durationMs: number | null;
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
  readonly durationMs?: number | null;
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
