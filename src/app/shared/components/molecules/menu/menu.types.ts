/* ============================================================================
    Contratos del Menu — sistema ALOVIDA v1.0.

    Extensión propia: el spec no declara menú desplegable. Se arma con la
    superficie y la sombra del sistema. Pendiente de validación del diseñador.

    El panel se **reubica al `<body>`** mientras está abierto, igual que el
    globo del tooltip: dentro de una fila de tabla con `overflow`, un menú
    posicionado en su lugar queda recortado.
    ========================================================================== */

import { InjectionToken } from '@angular/core';

/** Separación entre el disparador y el panel. Espeja `--sp-1` (4 px). */
export const MENU_GAP_PX = 4;

/** Lo mínimo que un ítem necesita de su menú: poder cerrarlo al elegirse. */
export interface MenuHost {
  close(): void;
}

export const MENU_PARENT = new InjectionToken<MenuHost>('MenuHost');
