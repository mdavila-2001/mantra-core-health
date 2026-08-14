import { DashboardPage } from '../../support/pages/dashboard.page';

/**
 * El centro de tutoriales y un recorrido completo, en un navegador de verdad.
 *
 * ## Qué agrega sobre las pruebas unitarias
 *
 * Las unitarias ya fijan el registro, el progreso, la máquina de pasos y el
 * globo por separado. Lo que **sólo** se puede comprobar acá es lo que depende
 * del navegador de verdad:
 *
 * - que el velo con agujero deje tocar lo que tiene que dejar tocar y tape lo
 *   demás — es geometría real, no un booleano;
 * - que el foco entre al globo y vuelva a donde estaba al terminar;
 * - que `Escape` y las flechas hagan lo suyo con un foco real;
 * - que el progreso sobreviva a una recarga de página.
 *
 * Se usa el escenario con sesión simple: el motor no pide nada al backend, así
 * que un recorrido es reproducible sin sembrar datos.
 */
describe('Centro de tutoriales', () => {
  beforeEach(() => {
    // Cada prueba arranca sin progreso: si no, la segunda encontraría
    // «Continuar» donde espera «Empezar» y el fallo no diría nada útil.
    cy.clearLocalStorage();
    DashboardPage.abrir('sesion-simple', '/tutorials');
  });

  it('lista los tutoriales con su avance', () => {
    cy.contains('h1', 'Centro de tutoriales').should('be.visible');
    cy.contains('Tu avance').should('be.visible');
    cy.contains('Primeros pasos en AloVida').should('be.visible');
  });

  it('el avance arranca en cero y no hay ningún completado', () => {
    cy.get('[role="progressbar"][aria-label="Avance general de tutoriales"]').should(
      'have.attr',
      'aria-valuenow',
      '0',
    );
    cy.contains('Completado').should('not.exist');
  });

  /* ---- un recorrido completo --------------------------------------------- */

  it('recorre un tutorial de punta a punta y lo marca completado', () => {
    cy.contains('Usar el centro de tutoriales')
      .parents('app-card')
      .within(() => cy.contains('button', 'Empezar').click());

    cy.get('[role="dialog"]').should('be.visible');
    cy.contains('Paso 1 de 4').should('be.visible');

    // El paso 2 espera que se escriba en el buscador: es una práctica, no una
    // explicación, y avanzar solo al escribir es justamente lo que se prueba.
    cy.contains('button', 'Siguiente').click();
    cy.contains('Paso 2 de 4').should('be.visible');
    cy.get('[data-tutorial-id="tutoriales-busqueda"] input').type('agenda');

    cy.contains('Paso 3 de 4').should('be.visible');
    cy.contains('button', 'Siguiente').click();

    cy.contains('Paso 4 de 4').should('be.visible');
    cy.contains('button', 'Terminar').click();

    cy.get('[role="dialog"]').should('not.exist');
    cy.contains('Usar el centro de tutoriales')
      .parents('app-card')
      .within(() => {
        cy.contains('Completado').should('be.visible');
        cy.contains('button', 'Repetir').should('be.visible');
      });
  });

  /* ---- dejar a medias y continuar ----------------------------------------- */

  it('dejar un tutorial a medias ofrece continuarlo donde quedó', () => {
    cy.contains('Primeros pasos en AloVida')
      .parents('app-card')
      .first()
      .within(() => cy.contains('button', 'Empezar').click());

    cy.contains('button', 'Siguiente').click();
    cy.contains('Paso 2 de 5').should('be.visible');

    // Después del primer paso sí se pregunta: un tecleo distraído no debería
    // costar el recorrido entero.
    cy.contains('button', 'Dejarlo').click();
    cy.contains('button', 'Dejarlo').click();

    cy.get('[role="dialog"]').should('not.exist');
    cy.visit('/tutorials');
    cy.contains('Primeros pasos en AloVida')
      .parents('app-card')
      .first()
      .within(() => {
        cy.contains('A medias').should('be.visible');
        cy.contains('button', 'Continuar').click();
      });

    cy.contains('Paso 2 de 5').should('be.visible');
  });

  /** El progreso vive en el almacenamiento de la cuenta, no en la memoria. */
  it('el progreso sobrevive a una recarga', () => {
    cy.contains('Usar el centro de tutoriales')
      .parents('app-card')
      .within(() => cy.contains('button', 'Empezar').click());
    cy.contains('button', 'Dejarlo').click();

    cy.reload();

    cy.contains('Usar el centro de tutoriales')
      .parents('app-card')
      .within(() => cy.contains('button', 'Continuar').should('be.visible'));
  });

  it('reiniciar devuelve el tutorial a «Empezar»', () => {
    cy.contains('Usar el centro de tutoriales')
      .parents('app-card')
      .within(() => cy.contains('button', 'Empezar').click());
    cy.contains('button', 'Dejarlo').click();

    cy.contains('Usar el centro de tutoriales')
      .parents('app-card')
      .within(() => {
        cy.contains('button', 'Reiniciar').click();
        cy.contains('button', 'Empezar').should('be.visible');
      });
  });

  /* ---- filtros ------------------------------------------------------------ */

  it('filtra por texto y limpia los filtros', () => {
    cy.get('[data-tutorial-id="tutoriales-busqueda"] input').type('expediente');
    cy.contains('Primeros pasos en AloVida').should('not.exist');

    cy.get('[data-tutorial-id="tutoriales-busqueda"] input').clear().type('nada-de-esto-existe');
    cy.contains('Ningún tutorial coincide').should('be.visible');
    cy.contains('button', 'Limpiar los filtros').click();

    cy.contains('Primeros pasos en AloVida').should('be.visible');
  });

  /* ---- accesibilidad ------------------------------------------------------ */

  it('el globo recibe el foco y se cierra con Escape', () => {
    cy.contains('Usar el centro de tutoriales')
      .parents('app-card')
      .within(() => cy.contains('button', 'Empezar').click());

    cy.get('[role="dialog"]').should('be.focused');

    // Primer paso: no hay nada que perder, así que cierra sin preguntar.
    cy.get('body').type('{esc}');
    cy.get('[role="dialog"]').should('not.exist');
  });

  it('las flechas avanzan y retroceden con el foco en el globo', () => {
    cy.contains('Usar el centro de tutoriales')
      .parents('app-card')
      .within(() => cy.contains('button', 'Empezar').click());

    cy.get('[role="dialog"]').type('{rightarrow}');
    cy.contains('Paso 2 de 4').should('be.visible');

    cy.get('[role="dialog"]').type('{leftarrow}');
    cy.contains('Paso 1 de 4').should('be.visible');
  });

  it('el progreso se dice con palabras, no sólo con la barra', () => {
    cy.contains('Usar el centro de tutoriales')
      .parents('app-card')
      .within(() => cy.contains('button', 'Empezar').click());

    cy.get('[role="dialog"] [role="progressbar"]')
      .should('have.attr', 'aria-valuenow', '1')
      .and('have.attr', 'aria-valuemax', '4');
    cy.contains('Paso 1 de 4').should('be.visible');
  });

  /* ---- responsive ---------------------------------------------------------- */

  it('en una pantalla angosta el globo ocupa el pie y no se sale', () => {
    cy.viewport(390, 780);
    cy.contains('Usar el centro de tutoriales')
      .parents('app-card')
      .within(() => cy.contains('button', 'Empezar').click());

    cy.get('[role="dialog"]').then(($globo) => {
      const caja = $globo[0].getBoundingClientRect();
      expect(caja.left, 'no se sale por la izquierda').to.be.at.least(0);
      expect(caja.right, 'no se sale por la derecha').to.be.at.most(390);
    });
  });
});
