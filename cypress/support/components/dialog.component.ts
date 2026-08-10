/**
 * Diálogo de confirmación.
 *
 * Está montado sobre el `<dialog>` **nativo**, y eso es justo lo que hay que
 * verificar en un navegador de verdad: `showModal()` trae el fondo, la
 * inertización de lo que queda detrás y el cierre con `Escape` sin que nadie
 * escriba una línea. En jsdom nada de eso existe —`showModal` no está
 * implementado— así que ninguna prueba unitaria puede afirmarlo.
 *
 * La regla que estas pruebas fijan: **cerrar nunca es confirmar**. Ni con
 * `Escape`, ni tocando el fondo, ni con el botón de cancelar.
 */
export const Dialogo = {
  esperarAbierto(): void {
    cy.porTestId('dialogo').should('be.visible');
  },

  tituloVisible(): Cypress.Chainable<string> {
    return cy
      .porTestId('dialogo-titulo')
      .invoke('text')
      .then((texto) => texto.trim());
  },

  confirmar(): void {
    cy.porTestId('dialogo-confirmar').click();
    Dialogo.esperarCerrado();
  },

  cancelar(): void {
    cy.porTestId('dialogo-cancelar').click();
    Dialogo.esperarCerrado();
  },

  /**
   * Cierra con `Escape`, que es el camino de teclado del `<dialog>` nativo.
   *
   * Tiene que ser una tecla **de verdad**: el componente no escucha `keydown`,
   * deja que el navegador cierre el diálogo y escucha el `cancel` que eso
   * dispara. Un evento sintético no lo cerraría y la prueba pasaría sin haber
   * probado nada. Por eso `cy.tecla()` y no `cy.type('{esc}')`.
   */
  cerrarConEscape(): void {
    cy.tecla('Escape');
    Dialogo.esperarCerrado();
  },

  esperarCerrado(): void {
    cy.porTestId('dialogo').should('not.exist');
  },

  /**
   * Afirma que el foco está dentro del diálogo.
   *
   * Un modal que no se lleva el foco deja a quien navega con teclado tabulando
   * por la página de atrás sin saber que hay algo abierto delante.
   */
  esperarConFoco(): void {
    cy.document({ log: false }).should((doc) => {
      const dialogo = doc.querySelector('[data-testid="dialogo"]');
      expect(dialogo, 'el diálogo está montado').to.not.equal(null);
      expect(
        dialogo?.contains(doc.activeElement),
        'el foco quedó dentro del diálogo',
      ).to.equal(true);
    });
  },

  /**
   * Afirma que lo que quedó detrás no se puede usar.
   *
   * `showModal()` marca el resto del documento como inerte: cualquier elemento
   * de fuera deja de recibir eventos de puntero. Se comprueba preguntándole al
   * navegador qué elemento hay en un punto del fondo — si es el `<dialog>` o su
   * contenido, el fondo está tapado de verdad.
   */
  esperarFondoBloqueado(): void {
    cy.document({ log: false }).should((doc) => {
      const dialogo = doc.querySelector('[data-testid="dialogo"]');
      const enLaEsquina = doc.elementFromPoint(4, 4);
      const bloqueado =
        dialogo !== null &&
        (enLaEsquina === null || dialogo === enLaEsquina || dialogo.contains(enLaEsquina));
      expect(bloqueado, 'el fondo del modal está inerte').to.equal(true);
    });
  },

  /** El identificador del elemento enfocado, para comprobar dónde aterriza el foco. */
  elementoEnfocado(): Cypress.Chainable<string> {
    return cy.document({ log: false }).then((doc) => {
      const activo = doc.activeElement;
      if (activo === null) {
        return '';
      }
      return activo.getAttribute('data-testid') ?? activo.tagName.toLowerCase();
    });
  },

  /** Los botones del diálogo, en el orden en que están en el DOM. */
  accionesEnOrden(): Cypress.Chainable<string[]> {
    return cy
      .get('[data-testid="dialogo"] button')
      .then(($botones) =>
        $botones
          .toArray()
          .map((nodo) => (nodo.textContent ?? '').trim())
          .filter((texto) => texto !== ''),
      );
  },
};
