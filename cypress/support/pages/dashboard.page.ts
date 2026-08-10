import { ESCENARIO_POR_DEFECTO, type NombreEscenario } from '../fixtures/escenarios';

/**
 * Panel (`/panel`), la primera pantalla con sesión.
 *
 * Tiene dos mitades que se prueban por separado: los datos que salen del propio
 * token —sin ninguna petición detrás— y la lectura real del directorio público,
 * que cruza el interceptor y la traducción de errores y se pinta con los
 * estados de vista.
 */
/** Fuera del objeto para que el valor por defecto de `abrir` no se autorreferencie. */
const RUTA = '/panel';

export const DashboardPage = {
  ruta: RUTA,

  abrir(escenario: NombreEscenario = ESCENARIO_POR_DEFECTO, ruta = RUTA): void {
    cy.abrirEscenario(escenario, ruta);
  },

  esperarCargada(): void {
    cy.porTestId('panel-sesion').should('be.visible');
  },

  /** El identificador de la sesión, tal como lo declara el token. */
  identificadorDeSesion(): Cypress.Chainable<string> {
    return cy
      .porTestId('panel-user-id')
      .invoke('text')
      .then((texto) => texto.trim());
  },

  /** Roles mostrados como insignias. */
  rolesVisibles(): Cypress.Chainable<string[]> {
    return cy
      .get('[data-testid="panel-roles"] app-badge')
      .then(($insignias) =>
        $insignias
          .toArray()
          .map((nodo) => (nodo.textContent ?? '').trim())
          .filter((texto) => texto !== ''),
      );
  },

  /** Afirma el encabezado de la pantalla. */
  esperarTitulo(titulo: string): void {
    cy.get('h1').should('have.text', titulo);
  },

  esperarDirectorio(): void {
    cy.porTestId('panel-directorio').should('be.visible');
  },

  /**
   * Afirma cuántos registros dice el panel que hay.
   *
   * El conteo es la señal de que la lectura terminó bien.
   */
  esperarConteoDelDirectorio(cuantos: number): void {
    cy.porTestId('panel-directorio-conteo')
      .invoke('text')
      .should('match', new RegExp(`\\b${cuantos}\\b\\s*registro`));
  },

  /** Afirma que el panel **no** muestra ningún conteo. */
  sinConteoDelDirectorio(): void {
    cy.porTestId('panel-directorio-conteo').should('not.exist');
  },

  /**
   * El estado de error del directorio.
   *
   * Es una región con `role="alert"` dentro de la tarjeta: se localiza por rol y
   * no por su texto, que puede cambiar de redacción sin que el comportamiento
   * cambie.
   */
  esperarErrorDelDirectorio(): Cypress.Chainable<string> {
    return cy
      .get('[data-testid="panel-directorio"] [role="alert"]')
      .invoke('text')
      .should('match', /\S/);
  },

  /**
   * El botón de reintentar del estado de error.
   *
   * La tarjeta ofrece dos botones —copiar el código de soporte y reintentar— y
   * se elige por su texto porque es lo único que los distingue; el orden dentro
   * del bloque de acciones no es un contrato.
   */
  reintentarDirectorio(): void {
    cy.get('[data-testid="panel-directorio"] button').contains(/^\s*Reintentar\s*$/).click();
  },

  /**
   * Espera a que el esqueleto de carga se vaya.
   *
   * Es la afirmación que importa: un estado de carga que **no se resuelve** es
   * el defecto de verdad. Preguntarlo sin esperar mide el instante equivocado
   * —a veces antes de que la petición salga siquiera— y falla o pasa por azar.
   */
  esperarSinEsqueleto(): void {
    cy.get('[data-testid="panel-directorio"] app-skeleton').should('not.exist');
  },
};
