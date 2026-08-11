import { ESCENARIO_POR_DEFECTO, type NombreEscenario } from '../fixtures/escenarios';

/**
 * Activación de cuenta (`/auth/activar`).
 *
 * Es la salida del **alta asistida**: alguien crea la cuenta a nombre de otro y
 * le entrega un código. Por eso el token tiene dos caminos —el enlace del correo
 * (`?token=…`) y el campo escrito a mano— y los dos importan: el alta asistida
 * muestra el código en pantalla para pasarlo por teléfono o en papel, y obligar
 * a armar una URL sería devolverle el problema a quien menos herramientas tiene.
 *
 * El desenlace que hay que proteger es el del código que no sirve. La API
 * responde **401**, que en cualquier otra pantalla significaría «se te venció la
 * sesión»; acá tiene que leerse como «pedí otro código», con esa salida y no con
 * una invitación a reintentar algo que no va a funcionar.
 */
const RUTA = '/auth/activar';

export const ActivateAccountPage = {
  ruta: RUTA,

  /** Abre el enlace tal como llega en el correo. */
  abrirConToken(token: string, escenario: NombreEscenario = ESCENARIO_POR_DEFECTO): void {
    cy.abrirEscenario(escenario, `${RUTA}?token=${encodeURIComponent(token)}`);
    ActivateAccountPage.esperarCargada();
  },

  /** Abre la pantalla sin token: el código se escribe a mano. */
  abrirSinToken(escenario: NombreEscenario = ESCENARIO_POR_DEFECTO): void {
    cy.abrirEscenario(escenario, RUTA);
    ActivateAccountPage.esperarCargada();
  },

  esperarCargada(): void {
    cy.porTestId('activar-form').should('be.visible');
  },

  /**
   * Afirma si la pantalla pide el código.
   *
   * **No lo pide cuando vino por el enlace**, y eso es la decisión, no un
   * descuido: mostrar el campo relleno sería pedirle a la persona que revise
   * algo que ya está resuelto, y mostrarlo vacío la obligaría a copiar de la
   * barra de direcciones. Con el código dictado a mano, en cambio, el campo
   * tiene que estar o el trámite no existe.
   */
  esperarCampoDeToken(sePide: boolean): void {
    cy.porTestId('activar-token').should(sePide ? 'be.visible' : 'not.exist');
  },

  escribirToken(valor: string): void {
    cy.porTestId('activar-token').clear().type(valor);
  },

  escribirPassword(valor: string): void {
    cy.porTestId('activar-password').clear().type(valor);
  },

  enviarFormulario(): void {
    cy.porTestId('activar-submit').click();
  },

  /** El camino completo cuando el código se escribe a mano. */
  activar(token: string, password: string): void {
    ActivateAccountPage.escribirToken(token);
    ActivateAccountPage.escribirPassword(password);
    ActivateAccountPage.enviarFormulario();
  },

  esperarConfirmacion(): Cypress.Chainable<string> {
    return cy.porTestId('activar-ok').invoke('text').should('match', /\S/);
  },

  /**
   * El aviso del código que no sirve.
   *
   * Tiene identificador propio —distinto del error general— porque es un estado
   * distinto: no hay nada que reintentar, hay que conseguir otro código.
   */
  esperarTokenInvalido(): Cypress.Chainable<string> {
    return cy.porTestId('activar-token-malo').invoke('text').should('match', /\S/);
  },

  /** Afirma que la pantalla **no** muestra el error genérico. */
  sinErrorGenerico(): void {
    cy.porTestId('activar-error').should('not.exist');
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
    cy.porTestId('activar-ir-login').click();
  },
};
