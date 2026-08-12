import { ESCENARIO_POR_DEFECTO, type NombreEscenario } from '../fixtures/escenarios';

/**
 * Verificación de correo (`/auth/verify-email?token=…`).
 *
 * El token llega por la barra de direcciones, así que la pantalla se prueba
 * **navegando con query string**: es la única forma de reproducir lo que hace
 * quien abre el enlace del correo. Ninguna prueba unitaria puede hacerlo, porque
 * el token se lee del snapshot de la ruta al construir el componente.
 *
 * Los cuatro estados son excluyentes y cada uno tiene su identificador, así que
 * afirmar sobre ellos no depende de la redacción del texto.
 */
export const VerifyEmailPage = {
  ruta: '/auth/verify-email',

  /** Abre el enlace tal como llega en el correo. */
  abrirConToken(token: string, escenario: NombreEscenario = ESCENARIO_POR_DEFECTO): void {
    cy.abrirEscenario(escenario, `${VerifyEmailPage.ruta}?token=${encodeURIComponent(token)}`);
  },

  /** Abre el enlace incompleto: sin token en la dirección. */
  abrirSinToken(escenario: NombreEscenario = ESCENARIO_POR_DEFECTO): void {
    cy.abrirEscenario(escenario, VerifyEmailPage.ruta);
  },

  esperarVerificado(): Cypress.Chainable<string> {
    return cy.porTestId('verificar-ok').invoke('text').should('match', /\S/);
  },

  esperarSinToken(): Cypress.Chainable<string> {
    return cy.porTestId('verificar-sin-token').invoke('text').should('match', /\S/);
  },

  esperarInvalido(): Cypress.Chainable<string> {
    return cy.porTestId('verificar-invalido').invoke('text').should('match', /\S/);
  },

  /**
   * El cuerpo del mensaje, que es donde vive el tono.
   *
   * Se lee aparte del título porque es lo que se puede perder sin que nada más
   * cambie: el título seguiría diciendo «ya no sirve» aunque el texto de abajo
   * se hubiera convertido en una alarma.
   */
  mensajeTranquilizador(): Cypress.Chainable<string> {
    return cy
      .get('.verificacion__text')
      .invoke('text')
      .then((texto) => texto.trim());
  },

  irALogin(): void {
    cy.porTestId('verificar-ir-login').click();
  },
};
