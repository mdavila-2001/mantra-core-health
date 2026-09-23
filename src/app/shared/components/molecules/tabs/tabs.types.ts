/* ============================================================================
    Contratos de los Tabs — sistema ALOVIDA v1.0.

    Extensión propia: el spec del diseñador no declara pestañas. El indicador
    es la línea de marca bajo la pestaña activa. Pendiente de validación.
    ========================================================================== */

import { InjectionToken, type Signal } from '@angular/core';

export const TABS_ORIENTATIONS = ['horizontal', 'vertical'] as const;
export type TabsOrientation = (typeof TABS_ORIENTATIONS)[number];

/**
 * Cómo se dibujan las pestañas.
 *
 * - `underline` — la línea de marca bajo la pestaña activa. Es la del sistema
 *   y sigue siendo la de siempre: dos o tres secciones dentro de una tarjeta
 *   que ya trae su propio marco.
 * - `browser` — marco de ventana: la tira sobre un fondo hundido y el panel
 *   como superficie continuada debajo, con la pestaña activa empalmando con
 *   él. Nace del expediente clínico, que tiene ocho: una fila de rótulos
 *   sueltos sobre el fondo de la página no dejaba ver dónde empieza ni dónde
 *   termina lo que se está mirando, y el desborde lo resolvía la barra de
 *   scroll cruda del navegador —que dejaba la primera pestaña cortada por la
 *   mitad, y eso se lee como un error de dibujo, no como «hay más a la
 *   izquierda»—.
 */
export const TABS_APPEARANCES = ['underline', 'browser'] as const;
export type TabsAppearance = (typeof TABS_APPEARANCES)[number];

/**
 * Teclas que mueven el foco entre pestañas. La **selección no las sigue**:
 * WAI-ARIA lo llama activación manual y es lo correcto acá, porque cada panel
 * de una ficha clínica puede disparar una consulta al servidor — recorrer las
 * pestañas con las flechas no debería lanzar seis búsquedas.
 */
export const TAB_NAVIGATION_KEYS = ['ArrowRight', 'ArrowLeft', 'Home', 'End'] as const;

/** Teclas que sí seleccionan la pestaña enfocada. */
export const TAB_ACTIVATION_KEYS = ['Enter', ' '] as const;

/**
 * Lo único que una pestaña necesita saber de su contenedor. El token vive acá
 * —y no en `tabs.ts`— para que el hijo no tenga que importar al padre, que
 * importa al hijo: sin esto, ciclo de imports.
 */
export interface TabsHost {
  /** La pestaña activa, comparada por identidad contra `this` en cada hijo. */
  readonly activeTab: Signal<unknown>;
}

export const TABS_PARENT = new InjectionToken<TabsHost>('TabsHost');
