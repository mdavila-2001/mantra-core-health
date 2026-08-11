/**
 * Avisos (toasts).
 *
 * ## Por qué se prueban sobre la vitrina y no sobre una cola viva
 *
 * En el artefacto de producción **no hay ninguna cola**: el aviso es una pieza
 * presentacional y el único disparador que existe hoy —el panel de desarrollo—
 * vive tras un `@defer (when isDev)`, así que su fragmento ni siquiera se
 * descarga. Montar una cola artificial para probarla sería probar el andamio.
 *
 * Lo que sí se puede fijar, y es lo que se rompe sin que nadie mire, es el
 * contrato de accesibilidad de cada aviso: **un error interrumpe
 * (`role="alert"`) y el resto espera turno (`role="status"`)**. Poner `alert` en
 * un aviso de éxito le pisa la frase a quien esté escuchando un lector de
 * pantalla, y eso no se ve en ninguna captura.
 */
export const Avisos = {
  raiz: '.toast-gallery',

  esperarAlguno(): void {
    cy.get(`${Avisos.raiz} app-toast`).should('have.length.at.least', 1);
  },

  esperarCantidadMinima(minimo: number): void {
    cy.get(`${Avisos.raiz} app-toast`).should('have.length.at.least', minimo);
  },

  /** Mensajes visibles, en el orden en que están. */
  mensajes(): Cypress.Chainable<string[]> {
    return cy
      .get(`${Avisos.raiz} [data-testid="toast-mensaje"]`)
      .then(($nodos) =>
        $nodos
          .toArray()
          .map((nodo) => (nodo.textContent ?? '').trim())
          .filter((texto) => texto !== ''),
      );
  },

  /** Afirma el `role` del aviso de un tipo: `alert` interrumpe, `status` espera turno. */
  esperarRolDelTipo(tipo: string, rol: 'alert' | 'status'): void {
    cy.get(`${Avisos.raiz} app-toast.toast--${tipo}`).should('have.attr', 'role', rol);
  },

  /**
   * El tipo dicho en palabras, oculto a la vista.
   *
   * El color y el ícono no comunican solos: un aviso de error tiene que decir
   * «Error» para quien no ve ninguno de los dos.
   */
  tipoEnPalabras(tipo: string): Cypress.Chainable<string> {
    return cy
      .get(`${Avisos.raiz} app-toast.toast--${tipo} .sr-only`)
      .invoke('text')
      .then((texto) => texto.trim());
  },

  /** Los nombres accesibles de los botones de cierre. */
  nombresDeCierre(): Cypress.Chainable<string[]> {
    return cy
      .get(`${Avisos.raiz} [data-testid="toast-cerrar"]`)
      .then(($nodos) => $nodos.toArray().map((nodo) => nodo.getAttribute('aria-label') ?? ''));
  },
};
