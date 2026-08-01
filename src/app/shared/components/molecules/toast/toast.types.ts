/* ============================================================================
    Contratos del sistema de avisos — sistema REDSAT v1.0.

    El tipo de aviso NO declara colores propios: reusa `StatusType`, la misma
    semántica de producto de los `--st-*` que ya pintan badges y toasts. Un
    catálogo de tipos propio sería una quinta frontera de deriva.
    ========================================================================== */

import type { StatusType } from '@core/tokens/design-tokens.types';

/** Milisegundos que un aviso permanece en pantalla si no se dice otra cosa. */
export const TOAST_DEFAULT_DURATION_MS = 5000;

/**
 * Cuántos avisos se muestran a la vez. Por encima, el más viejo sale para dejar
 * entrar al nuevo: una pila que crece sin techo tapa la pantalla y deja el
 * aviso más reciente —el que importa— fuera de la vista.
 */
export const TOAST_MAX_VISIBLE = 4;

/**
 * Un aviso ya encolado. El `id` lo asigna el servicio: es la única forma de
 * descartar el aviso correcto cuando hay varios con el mismo texto en cola.
 */
export interface ToastMessage {
  readonly id: number;
  readonly type: StatusType;
  /** Encabezado opcional; sin él, el aviso es solo el mensaje. */
  readonly title?: string;
  readonly message: string;
  /**
   * `null` = **fijo**: no se va solo, únicamente con el botón de cierre. Se
   * reserva para lo que el usuario no puede permitirse no leer.
   */
  readonly duration: number | null;
}

/** Lo que el llamador puede ajustar al lanzar un aviso. */
export interface ToastOptions {
  readonly title?: string;
  /** `null` lo vuelve fijo. Omitido, usa `TOAST_DEFAULT_DURATION_MS`. */
  readonly duration?: number | null;
}

/**
 * Nombre hablado del tipo. El color y el ícono no comunican solos: quien usa
 * lector de pantalla necesita la palabra — y quien no distingue estos tonos,
 * también.
 */
export const TOAST_TYPE_LABELS: Readonly<Record<StatusType, string>> = Object.freeze({
  success: 'Éxito',
  warning: 'Advertencia',
  error: 'Error',
  info: 'Información',
});
