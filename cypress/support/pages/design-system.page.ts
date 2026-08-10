import { ESCENARIO_POR_DEFECTO, type NombreEscenario } from '../fixtures/escenarios';

/**
 * Vitrina del sistema de diseño (`/design-system`).
 *
 * Es la única pantalla donde hoy existen, con datos y funcionando, el diálogo
 * de confirmación, los avisos flotantes y la tabla de datos. Probarlos acá no es
 * probar una demo: son **los mismos componentes** que van a usar las pantallas
 * de producto, y el contrato que se fija ahora es el que heredarán.
 *
 * La ruta además está **diferida**: entrar verifica de paso que el fragmento se
 * descargue. Si no bajara, el router muestra la pantalla de recuperación en vez
 * de dejar la navegación muerta.
 */
export const DesignSystemPage = {
  ruta: '/design-system',

  abrir(escenario: NombreEscenario = ESCENARIO_POR_DEFECTO): void {
    cy.abrirEscenario(escenario, DesignSystemPage.ruta);
    DesignSystemPage.esperarCargada();
  },

  esperarCargada(): void {
    cy.get('app-design-system-sample').should('exist');
  },

  /** Abre el diálogo de confirmación no destructivo. */
  pedirConfirmacionDeGuardado(): void {
    cy.porTestId('demo-confirmar-guardado').scrollIntoView().click();
  },

  /** Abre el diálogo de una acción destructiva, que se ve distinto y enfoca distinto. */
  pedirConfirmacionDestructiva(): void {
    cy.porTestId('demo-confirmar-anulacion').scrollIntoView().click();
  },

  /**
   * Afirma lo que la vitrina anotó de la última confirmación.
   *
   * Cerrar el `<dialog>` y anotar el resultado son dos cosas distintas: la
   * segunda ocurre cuando se resuelve la promesa de `confirm()`, en el ciclo
   * siguiente. Leerla justo después de que el diálogo desaparece devolvería el
   * valor inicial —«—»— una de cada tantas veces; el reintento de la aserción
   * es lo que cierra esa carrera.
   */
  esperarUltimaConfirmacion(patron: RegExp): Cypress.Chainable<string> {
    return cy.porTestId('demo-ultima-confirmacion').invoke('text').should('match', patron);
  },

  /**
   * Baja hasta los avisos de muestra.
   *
   * El panel de desarrollo que los lanzaba **no existe en el artefacto**: vive
   * tras un `@defer (when isDev)` y su fragmento no se descarga en producción.
   * Lo que sí está, y es lo que se prueba, son las muestras de los cuatro tipos.
   */
  irALosAvisos(): void {
    cy.get('.toast-gallery').scrollIntoView();
  },

  /** Baja hasta la tabla: sin esto queda fuera de la ventana y el clic no llega. */
  irALaTabla(): void {
    cy.porTestId('tabla').scrollIntoView();
  },
};
