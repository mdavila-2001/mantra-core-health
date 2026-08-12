import { ESCENARIO_POR_DEFECTO, type NombreEscenario } from '../fixtures/escenarios';

/**
 * Recuperación de contraseña (`/auth/forgot-password`).
 *
 * La confirmación dice lo mismo exista o no la cuenta: lo contrario permitiría
 * averiguar quién está registrado probando direcciones. El Page Object expone
 * las dos mitades —el formulario y la confirmación— porque la pantalla las
 * intercambia y una prueba tiene que poder distinguirlas.
 */
export const ForgotPasswordPage = {
  ruta: '/auth/forgot-password',

  abrir(escenario: NombreEscenario = ESCENARIO_POR_DEFECTO): void {
    cy.abrirEscenario(escenario, ForgotPasswordPage.ruta);
    ForgotPasswordPage.esperarCargada();
  },

  esperarCargada(): void {
    cy.get('.recuperar__card').should('be.visible');
  },

  escribirIdentificador(valor: string): void {
    cy.porTestId('recuperar-identifier').clear().type(valor);
  },

  enviarFormulario(): void {
    cy.porTestId('recuperar-submit').click();
  },

  pedirEnlace(identificador: string): void {
    ForgotPasswordPage.escribirIdentificador(identificador);
    ForgotPasswordPage.enviarFormulario();
  },

  /** Espera la confirmación y devuelve su texto. */
  esperarConfirmacion(): Cypress.Chainable<string> {
    return cy.porTestId('recuperar-exito').invoke('text').should('match', /\S/);
  },

  sinConfirmacion(): void {
    cy.porTestId('recuperar-exito').should('not.exist');
  },

  sinError(): void {
    cy.porTestId('recuperar-error').should('not.exist');
  },

  /** El formulario ya no está: la pantalla pasó a su estado de confirmación. */
  esperarFormularioReemplazado(): void {
    cy.porTestId('recuperar-form').should('not.exist');
  },
};
