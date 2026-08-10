import { ESCENARIO_POR_DEFECTO, type NombreEscenario } from '../fixtures/escenarios';

/**
 * Elección de organización (`/auth/organizacion`).
 *
 * Es una pantalla propia y no un paso del login porque **cambia qué datos se
 * ven**: mezclarla con las credenciales invita a pasarla por alto.
 */
export const TenantSelectionPage = {
  ruta: '/auth/organizacion',

  abrir(escenario: NombreEscenario = ESCENARIO_POR_DEFECTO): void {
    cy.abrirEscenario(escenario, TenantSelectionPage.ruta);
  },

  esperarCargada(): void {
    cy.get('.tenant__card').should('be.visible');
  },

  /** Nombres de las organizaciones ofrecidas, en el orden en que aparecen. */
  organizacionesOfrecidas(): Cypress.Chainable<string[]> {
    TenantSelectionPage.esperarCargada();
    return cy
      .porTestId('tenant-opcion')
      .then(($opciones) => $opciones.toArray().map((nodo) => (nodo.textContent ?? '').trim()));
  },

  /** Elige por nombre visible: es lo que hace una persona. */
  elegir(nombre: string): void {
    cy.porTestId('tenant-opcion').contains(nombre).click();
  },

  /** Elige por identificador, cuando lo que importa es el dato y no la etiqueta. */
  elegirPorId(tenantId: string): void {
    cy.get(`[data-testid="tenant-opcion"][data-tenant="${tenantId}"]`).click();
  },

  /** Afirma que la cuenta no declara ninguna organización. */
  esperarVacia(): Cypress.Chainable<string> {
    return cy.porTestId('tenant-vacio').invoke('text').should('match', /\S/);
  },
};
