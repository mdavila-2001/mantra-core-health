import { ESCENARIO_POR_DEFECTO, type NombreEscenario } from '../fixtures/escenarios';

/**
 * Pantalla de dirección inexistente.
 *
 * No tiene ruta propia: la sirve el comodín del router para cualquier dirección
 * que no exista. Antes esto redirigía a la raíz, que mandaba al panel —o al
 * login— a quien escribiera mal una dirección **sin decirle que se había
 * equivocado**; que ahora lo diga es justo lo que esta pantalla prueba.
 */
/** Fuera del objeto para que el valor por defecto de `abrir` no se autorreferencie. */
const RUTA = '/esta-ruta-no-existe';

export const NotFoundPage = {
  ruta: RUTA,

  abrir(escenario: NombreEscenario = ESCENARIO_POR_DEFECTO, ruta = RUTA): void {
    cy.abrirEscenario(escenario, ruta);
    NotFoundPage.esperarCargada();
  },

  esperarCargada(): void {
    cy.porTestId('no-encontrado').should('be.visible');
  },

  mensaje(): Cypress.Chainable<string> {
    return cy
      .get('[data-testid="no-encontrado"] .empty-state__title')
      .invoke('text')
      .then((texto) => texto.trim());
  },

  volverAlInicio(): void {
    cy.get('[data-testid="no-encontrado"] a').click();
  },
};
