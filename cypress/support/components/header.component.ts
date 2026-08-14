/**
 * Encabezado de la aplicación: cuenta, tema y organización activa.
 *
 * El cierre de sesión vive **dentro del menú de cuenta** y no suelto en la
 * barra: es una acción destructiva y no debe estar a un clic de distancia de
 * nada. Por eso `cerrarSesion()` abre el menú antes; una prueba que clicara
 * directo el elemento del menú pasaría aunque el menú estuviera roto.
 */
export const Header = {
  /** Nombre de quien tiene la sesión, tal como lo muestra el encabezado. */
  nombreDeUsuario(): Cypress.Chainable<string> {
    return cy
      .get('.app-header__account-name')
      .invoke('text')
      .then((texto) => texto.trim());
  },

  abrirMenuDeCuenta(): void {
    cy.porTestId('header-cuenta').click();
    cy.porTestId('header-cerrar-sesion').should('be.visible');
  },

  cerrarSesion(): void {
    Header.abrirMenuDeCuenta();
    cy.porTestId('header-cerrar-sesion').click();
  },

  /**
   * Afirma si el botón de navegación en cajón está a la vista (pantalla angosta).
   *
   * Se comprueba **visibilidad** y no existencia. Con el marco REDSAT el botón
   * se inyecta una sola vez y es la hoja la que decide en qué ancho se muestra,
   * por `@media`: en escritorio el elemento está en el DOM pero no se ve. Y es
   * la pregunta correcta de todos modos — lo que importa es si alguien puede
   * usarlo, no si el nodo existe.
   */
  esperarBotonDeMenu(hayBoton: boolean): void {
    cy.porTestId('header-menu').should(hayBoton ? 'be.visible' : 'not.be.visible');
  },

  abrirNavegacion(): void {
    cy.porTestId('header-menu').click();
  },

  /** Afirma si aparece el selector de organización (solo con más de una). */
  esperarSelectorDeOrganizacion(hay: boolean): void {
    cy.porTestId('header-organizacion').should(hay ? 'exist' : 'not.exist');
  },

  /** Cierra el menú de cuenta con Escape, que es como lo cierra el teclado. */
  cerrarMenuConEscape(): void {
    cy.tecla('Escape');
    cy.porTestId('header-cerrar-sesion').should('not.exist');
  },
};
