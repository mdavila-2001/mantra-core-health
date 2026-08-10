import { ESCENARIO_POR_DEFECTO, type NombreEscenario } from '../fixtures/escenarios';

/**
 * Nueva contraseña (`/auth/nueva-clave?token=…`).
 *
 * Como la verificación de correo, el token viaja por la barra de direcciones.
 * A diferencia de aquélla, acá hay un formulario de por medio y una consecuencia
 * que la pantalla **tiene que decir en palabras**: guardar la contraseña cierra
 * las otras sesiones abiertas.
 */
export const ResetPasswordPage = {
  ruta: '/auth/nueva-clave',

  abrirConToken(token: string, escenario: NombreEscenario = ESCENARIO_POR_DEFECTO): void {
    cy.abrirEscenario(escenario, `${ResetPasswordPage.ruta}?token=${encodeURIComponent(token)}`);
  },

  abrirSinToken(escenario: NombreEscenario = ESCENARIO_POR_DEFECTO): void {
    cy.abrirEscenario(escenario, ResetPasswordPage.ruta);
  },

  esperarSinToken(): Cypress.Chainable<string> {
    return cy.porTestId('nueva-clave-sin-token').invoke('text').should('match', /\S/);
  },

  /** Afirma que la pantalla **no** ofrece el formulario. */
  sinFormulario(): void {
    // Un formulario que no puede funcionar es peor que no mostrarlo: se
    // completa, se envía y falla sin explicar por qué.
    cy.porTestId('nueva-clave-form').should('not.exist');
  },

  escribirPassword(valor: string): void {
    cy.porTestId('nueva-clave-password').clear().type(valor);
  },

  enviarFormulario(): void {
    cy.porTestId('nueva-clave-submit').click();
  },

  cambiarPassword(nueva: string): void {
    ResetPasswordPage.escribirPassword(nueva);
    ResetPasswordPage.enviarFormulario();
  },

  /** Espera la confirmación y devuelve su texto completo, con el aviso de sesiones. */
  esperarConfirmacion(): Cypress.Chainable<string> {
    cy.porTestId('nueva-clave-ok').should('be.visible');
    return cy
      .get('.nueva-clave__text')
      .invoke('text')
      .then((texto) => texto.trim());
  },

  esperarError(): Cypress.Chainable<string> {
    return cy.porTestId('nueva-clave-error').invoke('text').should('match', /\S/);
  },

  sinError(): void {
    cy.porTestId('nueva-clave-error').should('not.exist');
  },

  mensajesDeValidacion(minimo = 1): Cypress.Chainable<string[]> {
    return cy
      .get('.form-field-error')
      .should('have.length.at.least', minimo)
      .then(($mensajes) =>
        $mensajes
          .toArray()
          .map((nodo) => (nodo.textContent ?? '').trim())
          .filter((texto) => texto !== ''),
      );
  },

  irALogin(): void {
    cy.porTestId('nueva-clave-ir-login').click();
  },
};
