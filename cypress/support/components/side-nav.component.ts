/**
 * Navegación lateral.
 *
 * En pantallas angostas se convierte en un cajón que se abre desde el
 * encabezado; en anchas es una columna fija. Es el mismo componente en los dos
 * casos, así que las pruebas responsive comprueban **el mismo** contrato de
 * navegación con el panel abierto de una forma o de la otra.
 */
export const SideNav = {
  raiz: 'nav[aria-label="Navegación principal"]',

  esperarVisible(): void {
    cy.get(SideNav.raiz).should('be.visible');
  },

  /** Etiquetas visibles de los ítems del menú, en orden. */
  elementos(): Cypress.Chainable<string[]> {
    return cy
      .porTestId('nav-enlace')
      .then(($nodos) =>
        $nodos
          .toArray()
          .map((nodo) => (nodo.textContent ?? '').trim())
          .filter((texto) => texto !== ''),
      );
  },

  /** Las rutas a las que lleva el menú. Es el contrato que no puede romperse. */
  rutas(): Cypress.Chainable<string[]> {
    return cy
      .porTestId('nav-enlace')
      .then(($nodos) =>
        $nodos
          .toArray()
          .map((nodo) => nodo.getAttribute('data-route') ?? '')
          .filter((ruta) => ruta !== ''),
      );
  },

  irA(ruta: string): void {
    cy.get(`[data-testid="nav-enlace"][data-route="${ruta}"]`).click();
  },

  /**
   * Afirma cuál es la ruta marcada como actual.
   *
   * `aria-current="page"` es lo que anuncia un lector de pantalla; comprobarlo
   * verifica de paso que la marca de «acá estás» no sea solo un color.
   */
  esperarRutaActual(ruta: string): void {
    cy.get('[data-testid="nav-enlace"][aria-current="page"]').should(
      'have.attr',
      'data-route',
      ruta,
    );
  },
};
