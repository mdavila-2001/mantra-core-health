import { ESCENARIO_POR_DEFECTO, type NombreEscenario } from '../fixtures/escenarios';

/**
 * Reenviar la verificación de correo (`/auth/reenviar-verificacion`).
 *
 * Comparte la regla de privacidad de la recuperación de contraseña —responde lo
 * mismo exista o no la cuenta— y suma una propia: **un límite de intentos no es
 * un error**. El endpoint admite cinco por minuto, y decirle «error» a quien
 * simplemente fue rápido lo invita a insistir, que es justo lo contrario de lo
 * que conviene. Por eso la espera tiene su propio estado, con los segundos
 * escritos.
 */
const RUTA = '/auth/reenviar-verificacion';

export const ResendVerificationPage = {
  ruta: RUTA,

  abrir(escenario: NombreEscenario = ESCENARIO_POR_DEFECTO): void {
    cy.abrirEscenario(escenario, RUTA);
    ResendVerificationPage.esperarCargada();
  },

  esperarCargada(): void {
    cy.porTestId('reenviar-form').should('be.visible');
  },

  escribirIdentificador(valor: string): void {
    cy.porTestId('reenviar-identificador').clear().type(valor);
  },

  enviarFormulario(): void {
    cy.porTestId('reenviar-submit').click();
  },

  pedirReenvio(identificador: string): void {
    ResendVerificationPage.escribirIdentificador(identificador);
    ResendVerificationPage.enviarFormulario();
  },

  esperarConfirmacion(): Cypress.Chainable<string> {
    return cy.porTestId('reenviar-ok').invoke('text').should('match', /\S/);
  },

  /** El aviso de esperar, que lleva los segundos adentro. */
  esperarLimite(): Cypress.Chainable<string> {
    return cy.porTestId('reenviar-espera').invoke('text').should('match', /\S/);
  },

  sinConfirmacion(): void {
    cy.porTestId('reenviar-ok').should('not.exist');
  },

  /**
   * Afirma que la pantalla **no** trata el límite como un error.
   *
   * Es la mitad que se rompe sin que nadie mire: el aviso de espera puede
   * aparecer y, si además apareciera el error genérico, la pantalla estaría
   * diciendo las dos cosas a la vez.
   */
  sinError(): void {
    cy.porTestId('reenviar-error').should('not.exist');
  },

  /** Vuelve al formulario para probar con otro identificador. */
  probarConOtro(): void {
    cy.porTestId('reenviar-otro').click();
  },
};
