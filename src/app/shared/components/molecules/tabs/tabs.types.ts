/* ============================================================================
    Contratos de los Tabs — sistema ALOVIDA v1.0.

    Extensión propia: el spec del diseñador no declara pestañas. El indicador
    es la línea de marca bajo la pestaña activa. Pendiente de validación.
    ========================================================================== */

import { InjectionToken, type Signal } from '@angular/core';

export const TABS_ORIENTATIONS = ['horizontal', 'vertical'] as const;
export type TabsOrientation = (typeof TABS_ORIENTATIONS)[number];

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
