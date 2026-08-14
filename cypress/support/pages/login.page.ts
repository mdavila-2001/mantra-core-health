import { ESCENARIO_POR_DEFECTO, type NombreEscenario } from '../fixtures/escenarios';
import type { UsuarioPrueba } from '../fixtures/usuarios';

/**
 * Pantalla de inicio de sesión (`/auth`).
 *
 * Un solo campo de identificador porque el backend acepta correo **o**
 * documento y nunca los dos; la pantalla decide cuál es por la arroba. El Page
 * Object no repite esa regla: manda el texto tal cual y deja que la aplicación
 * la aplique, que es lo que hay que probar.
 *
 * ## Por qué un objeto de funciones y no una clase
 *
 * Una clase existía para llevar el `WebDriver` adentro. En Cypress el sujeto es
 * `cy`, que es global, así que la clase sería un envoltorio vacío. Lo que sí se
 * conserva es la regla: la spec **no conoce selectores**, solo acciones de
 * negocio y aserciones sobre lo que la pantalla dice.
 */
export const LoginPage = {
  ruta: '/auth',

  abrir(escenario: NombreEscenario = ESCENARIO_POR_DEFECTO): void {
    cy.abrirEscenario(escenario, LoginPage.ruta);
    LoginPage.esperarCargada();
  },

  /** Espera a que la pantalla esté pintada. Es la postcondición de `abrir`. */
  esperarCargada(): void {
    cy.porTestId('login-form').should('be.visible');
  },

  escribirIdentificador(valor: string): void {
    // `clear()` de Cypress dispara los eventos de entrada que Angular escucha,
    // así que a diferencia de la suite anterior no hace falta vaciar el campo a
    // fuerza de teclas.
    cy.porTestId('login-identifier').clear().type(valor);
  },

  escribirPassword(valor: string): void {
    cy.porTestId('login-password').clear().type(valor);
  },

  escribirCodigoMfa(valor: string): void {
    cy.porTestId('login-mfa').clear().type(valor);
  },

  enviarFormulario(): void {
    cy.porTestId('login-submit').click();
  },

  /** El camino completo: credenciales y envío. Es el que usan casi todas las pruebas. */
  entrar(usuario: UsuarioPrueba): void {
    LoginPage.escribirIdentificador(usuario.identificador);
    LoginPage.escribirPassword(usuario.password);
    LoginPage.enviarFormulario();
  },

  /**
   * Envía desde el campo de contraseña con Enter.
   *
   * Es otro camino, no el mismo con otra tecla: si el botón dejara de ser
   * `type="submit"`, el clic seguiría funcionando y esto no.
   */
  enviarConEnter(): void {
    cy.porTestId('login-password').type('{enter}');
  },

  /** El mensaje de error de la pantalla. Falla si no aparece. */
  esperarError(): Cypress.Chainable<string> {
    return cy.porTestId('login-error').invoke('text').should('match', /\S/);
  },

  /** Afirma que la pantalla **no** muestra ningún error general. */
  sinError(): void {
    cy.porTestId('login-error').should('not.exist');
  },

  /**
   * Mensajes de campo obligatorio.
   *
   * `.form-field-error` es la clase que pinta `app-form-field`, y esos nodos
   * llevan `role="alert"`: se localizan por la clase del sistema de diseño para
   * no arrastrar también el error general de la pantalla, que es otra cosa.
   *
   * La espera no es un detalle: los mensajes los pinta Angular en el ciclo
   * siguiente al envío. Acá la resuelve el reintento de la aserción, que es lo
   * que hace innecesaria la espera explícita que llevaba la suite anterior.
   */
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

  /**
   * Afirma que el botón se marcó ocupado.
   *
   * El estado ocupado no es cosmético: es lo que impide que dos clics seguidos
   * abran dos sesiones y dejen una huérfana del lado del servidor.
   */
  esperarEnviando(): void {
    cy.porTestId('login-submit').should('have.attr', 'aria-busy', 'true');
  },

  irARecuperarPassword(): void {
    cy.porTestId('login-recuperar').click();
  },

  irARegistro(): void {
    cy.porTestId('login-registro').click();
  },

  /** Tipo real del campo de contraseña: `password` oculta, `text` revela. */
  esperarTipoDelCampoPassword(esperado: 'password' | 'text'): void {
    cy.porTestId('login-password').should('have.attr', 'type', esperado);
  },

  /** El botón de mostrar/ocultar que vive dentro del campo de contraseña. */
  alternarVisibilidadPassword(): void {
    cy.get('[data-testid="login-password"] ~ button').click();
  },

  /** Espera a haber salido del login: la señal de que la sesión se abrió. */
  esperarSalidaDelLogin(): void {
    cy.location('pathname').should('match', /^\/(dashboard|auth\/organization)$/);
  },
};
