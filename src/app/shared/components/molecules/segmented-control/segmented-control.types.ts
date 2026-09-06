/* ============================================================================
    Contratos del control segmentado — FT-04.
    ========================================================================== */

import type { NavIconName } from '../../atoms/nav-icon/nav-icon.types';

/**
 * Una de las opciones del control.
 *
 * `value` es lo que viaja al consumidor —normalmente el valor que va a la URL—
 * y `label` lo que se lee. El ícono es opcional: hay selectores donde el dibujo
 * ayuda a reconocer la vista de un vistazo («lista» y «calendario» son el caso
 * de manual) y otros donde sólo agregaría ruido.
 */
export interface SegmentedOption<T extends string = string> {
  readonly value: T;
  readonly label: string;
  readonly icon?: NavIconName;
  /**
   * Qué hace esta opción, para el nombre accesible cuando el rótulo no alcanza.
   * Opcional: sin él, el nombre accesible es el rótulo.
   */
  readonly description?: string;
  readonly disabled?: boolean;
}
