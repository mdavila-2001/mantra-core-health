/* ============================================================================
    Teclado del lienzo (CONTRATO-PLANO §5.6, «Teclado completo»): qué hace cada
    tecla. Función pura: el componente ejecuta la acción que se devuelve.
    ========================================================================== */

import type { NavDirection } from './spatial-nav';

export type KeyAction =
  | { readonly type: 'dismiss' }
  | { readonly type: 'zoomIn' }
  | { readonly type: 'zoomOut' }
  | { readonly type: 'fit' }
  | { readonly type: 'frameSelected' }
  | { readonly type: 'search' }
  | { readonly type: 'floor'; readonly step: 1 | -1 }
  | { readonly type: 'pan'; readonly dx: number; readonly dy: number }
  | { readonly type: 'move'; readonly direction: NavDirection }
  | { readonly type: 'edge'; readonly which: 'first' | 'last' }
  | { readonly type: 'open' };

export interface KeyInput {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
}

/** Paso del desplazamiento por teclado, en píxeles. */
export const KEY_PAN_STEP_PX = 80;

const DIRECTIONS: Readonly<Record<string, NavDirection>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

/**
 * `Escape` descarta la tarjeta; `+ − 0 .` hacen zoom y encuadre; `/` enfoca la
 * búsqueda; `Av Pág`/`Re Pág` cambian de lienzo; las flechas van al vecino
 * espacial (con `Alt` desplazan la vista; en el editor empujan la figura y las resuelve el editor); `Inicio`/`Fin` van
 * al primero y al último; `Enter` y `Espacio` abren la ficha (en el editor, Espacio elige la figura y
 * Entrar queda para el editor).
 */
export function keyAction(input: KeyInput, editMode: boolean): KeyAction | null {
  const { key } = input;
  if (key === 'Escape') return { type: 'dismiss' };
  if (key === '+' || key === '=') return { type: 'zoomIn' };
  if (key === '-' || key === '_') return { type: 'zoomOut' };
  if (key === '0') return { type: 'fit' };
  if (key === '.') return { type: 'frameSelected' };
  if (key === '/') return { type: 'search' };
  if (key === 'PageDown') return { type: 'floor', step: 1 };
  if (key === 'PageUp') return { type: 'floor', step: -1 };
  const direction = DIRECTIONS[key];
  if (direction !== undefined) {
    if (input.altKey) {
      return {
        type: 'pan',
        dx: direction === 'left' ? KEY_PAN_STEP_PX : direction === 'right' ? -KEY_PAN_STEP_PX : 0,
        dy: direction === 'up' ? KEY_PAN_STEP_PX : direction === 'down' ? -KEY_PAN_STEP_PX : 0,
      };
    }
    // En el editor las flechas empujan la figura (lo resuelve el editor): el lienzo no las intercepta.
    return editMode ? null : { type: 'move', direction };
  }
  if (key === 'Home') return { type: 'edge', which: 'first' };
  if (key === 'End') return { type: 'edge', which: 'last' };
  // En el editor, Entrar cierra el trazo en curso o elige la figura enfocada (lo resuelve el editor); Espacio la elige.
  if (((key === 'Enter' && !editMode) || key === ' ') && !(input.ctrlKey || input.metaKey)) return { type: 'open' };
  return null;
}
