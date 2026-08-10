/**
 * Tabla de datos.
 *
 * Se prueba sobre la vitrina del sistema de diseño, que es donde hoy vive la
 * única instancia con datos: ninguna pantalla de producto la usa todavía. Que la
 * prueba exista antes que la pantalla es deliberado — el día que se escriba el
 * primer listado real, el contrato de la tabla ya está fijado.
 *
 * Lo que se afirma es el contrato **observable**: qué filas hay, cómo se anuncia
 * el orden (`aria-sort`, no un color) y que la paginación por cursor solo ofrezca
 * anterior y siguiente, porque un cursor no conoce el total.
 */

/**
 * Afirma si un control de paginación está disponible.
 *
 * El sistema deshabilita con `aria-disabled`, no con el atributo nativo: el
 * botón sigue siendo enfocable y el lector anuncia el estado en vez de hacer
 * desaparecer el control. Por eso se mira el atributo y no `:disabled`.
 */
function afirmarDisponible(testId: string, disponible: boolean): void {
  cy.porTestId(testId).should(($boton) => {
    const deshabilitado = $boton.attr('aria-disabled') === 'true';
    expect(
      deshabilitado,
      `«${testId}» ${disponible ? 'tendría que estar disponible' : 'tendría que estar bloqueado'}`,
    ).to.equal(!disponible);
  });
}

export const Tabla = {
  esperarCargada(): void {
    cy.porTestId('tabla').should('be.visible');
  },

  cantidadDeFilas(): Cypress.Chainable<number> {
    return cy.porTestId('tabla-fila').its('length');
  },

  esperarFilas(cuantas: number): void {
    cy.porTestId('tabla-fila').should('have.length', cuantas);
  },

  /** El texto de cada fila, útil para comprobar que el orden cambió de verdad. */
  filasVisibles(): Cypress.Chainable<string[]> {
    return cy
      .porTestId('tabla-fila')
      .then(($filas) =>
        $filas.toArray().map((nodo) => (nodo.textContent ?? '').replace(/\s+/g, ' ').trim()),
      );
  },

  /** Claves de las columnas que ofrecen ordenar. */
  columnasOrdenables(): Cypress.Chainable<string[]> {
    return cy
      .porTestId('tabla-ordenar')
      .then(($nodos) =>
        $nodos
          .toArray()
          .map((nodo) => nodo.getAttribute('data-columna') ?? '')
          .filter((clave) => clave !== ''),
      );
  },

  ordenarPor(columna: string): void {
    cy.get(`[data-testid="tabla-ordenar"][data-columna="${columna}"]`).scrollIntoView().click();
  },

  /**
   * Cómo se anuncia el orden de una columna.
   *
   * `aria-sort` es lo que oye quien usa lector de pantalla. Sin él, la flechita
   * de la cabecera solo existe para quien ve.
   *
   * La cabecera **no decide** el orden: emite el pedido, el contenedor actualiza
   * su estado y la tabla lo vuelve a recibir por `input`. Ese viaje de ida y
   * vuelta pasa en el ciclo siguiente al clic, así que leer `aria-sort`
   * inmediatamente devolvería el valor de antes; el reintento de la aserción es
   * lo que lo resuelve.
   */
  ordenAnunciado(columna: string): Cypress.Chainable<string> {
    return cy
      .get(`[data-testid="tabla-ordenar"][data-columna="${columna}"]`)
      .closest('th')
      .invoke('attr', 'aria-sort')
      .then((valor) => valor ?? 'none');
  },

  /** Espera a que el orden anunciado sea uno de los dos sentidos reales. */
  esperarOrdenado(columna: string): Cypress.Chainable<string> {
    return cy
      .get(`[data-testid="tabla-ordenar"][data-columna="${columna}"]`)
      .closest('th')
      .invoke('attr', 'aria-sort')
      .should('match', /ascending|descending/)
      .then((sentido) => sentido ?? 'none');
  },

  /** Espera a que el orden anunciado cambie respecto del anterior. */
  esperarOrdenDistintoDe(columna: string, anterior: string): void {
    cy.get(`[data-testid="tabla-ordenar"][data-columna="${columna}"]`)
      .closest('th')
      .should(($celda) => {
        const actual = $celda.attr('aria-sort') ?? 'none';
        expect(actual, `el orden de «${columna}» se invirtió`).to.not.equal(anterior);
        expect(actual, 'sigue anunciando un sentido de orden').to.match(/ascending|descending/);
      });
  },

  /**
   * Afirma si un botón de paginación está disponible.
   *
   * El sistema deshabilita con `aria-disabled`, no con el atributo nativo: el
   * botón sigue siendo enfocable y el lector anuncia el estado en vez de hacer
   * desaparecer el control.
   */
  esperarPuedeIrAlSiguiente(puede: boolean): void {
    afirmarDisponible('tabla-siguiente', puede);
  },

  esperarPuedeIrAlAnterior(puede: boolean): void {
    afirmarDisponible('tabla-anterior', puede);
  },

  irAlSiguiente(): void {
    cy.porTestId('tabla-siguiente').scrollIntoView().click();
  },

  /** Cuántas filas están marcadas. */
  filasSeleccionadas(): Cypress.Chainable<number> {
    return cy
      .get('[data-testid="tabla-fila"]')
      .then(($filas) => $filas.find('.data-table__select-cell input:checked').length);
  },

  /**
   * Marca la casilla de selección de una fila.
   *
   * Se clica la etiqueta, no el `<input>`: el nativo mide cero —lo dibuja el
   * componente— y es la etiqueta la que se ve y se toca.
   */
  seleccionarFila(indice: number): void {
    cy.get('[data-testid="tabla-fila"] .data-table__select-cell label')
      .eq(indice)
      .scrollIntoView()
      .click();
  },
};
