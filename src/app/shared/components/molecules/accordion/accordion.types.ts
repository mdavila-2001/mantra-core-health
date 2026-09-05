/* ============================================================================
    Contratos del Accordion — sistema ALOVIDA v1.0.

    Extensión propia: el spec no lo declara. Se arma con el borde decorativo y
    la tipografía del sistema. Pendiente de validación del diseñador.
    ========================================================================== */

import { InjectionToken } from '@angular/core';

/**
 * Lo único que un panel necesita de su contenedor. El token vive acá para que
 * el hijo no importe al padre —que importa al hijo— y no haya ciclo.
 */
export interface AccordionHost {
  /**
   * Un panel avisa que se abrió. Con `multi=false` el contenedor cierra los
   * demás; el panel no conoce a sus hermanos ni tiene por qué.
   */
  panelOpened(panel: unknown): void;
}

export const ACCORDION_PARENT = new InjectionToken<AccordionHost>('AccordionHost');
