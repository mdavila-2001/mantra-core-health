/**
 * Comprobación de que las pantallas portadas desde la bóveda se montan de
 * verdad: el marco correcto, el contenido de la maqueta adentro, y ninguna
 * ruta muerta.
 *
 * No compara píxeles contra la maqueta —para eso está el recorrido visual—
 * sino que verifica lo que el port podría romper en silencio: que la ruta
 * exista, que el marco sea el que la ficha declara, y que el CSS de ALOVIDA
 * haya llegado (si `alovida.css` no cargara, la pantalla se vería como HTML
 * plano y estas clases no tendrían caja).
 */

const PRIVADAS = [
  '/directorio/organizaciones-listado',
  '/datos-compartidos/archivos-listado',
  '/terminologia/sistemas-de-codigos-listado',
  '/personas/profesionales-listado',
  '/accesos/relaciones-de-cuidado-listado',
];

describe('Pantallas portadas de la bóveda', () => {
  it('la portada pública se monta como lienzo propio, sin marco', () => {
    cy.visit('/inicio');
    cy.get('.landing, .landing-lienzo, .landing-hero').should('exist');
    cy.get('.app-side-nav').should('not.exist');
  });

  it('el buscador se monta bajo el marco público, con su pie de declaraciones', () => {
    cy.visit('/buscar/buscador-listado');
    cy.get('.app-public-shell').should('exist');
    cy.get('.app-public-header__marca').should('contain.text', 'AloVida');
    cy.get('.app-public-pie p').should('have.length.at.least', 4);
    cy.get('.app-side-nav').should('not.exist');
  });

  PRIVADAS.forEach((ruta) => {
    it(`${ruta} se monta bajo el marco de sesión, con su módulo desplegado`, () => {
      cy.visit(ruta);
      cy.get('.app-shell').should('exist');
      cy.get('.app-side-nav').should('exist');
      cy.get('.app-main__inner').should('not.be.empty');
      // El nav despliega el módulo de la pantalla y marca la sección activa.
      cy.get('.app-side-nav__sub .app-side-nav__item').should('have.length.at.least', 1);
      cy.get('.app-side-nav__item[aria-current="true"]').should('exist');
      // Si alovida.css no hubiera cargado, el nav no tendría sus 264 px.
      cy.get('.app-side-nav').invoke('outerWidth').should('be.greaterThan', 200);
    });
  });

  it('el conmutador de tema del marco cambia el tema de verdad', () => {
    cy.visit('/directorio/organizaciones-listado');
    cy.get('html').then(($html) => {
      const antes = $html.attr('data-tema');
      cy.get('[app-theme-toggle]').first().click();
      cy.get('html').should('not.have.attr', 'data-tema', antes);
    });
  });

  it('un formulario por etapas navega entre pasos por la URL', () => {
    cy.visit('/directorio/organizaciones-hijas-formulario');
    cy.get('.app-view-state-host [data-estado]:not([hidden])').should('have.length', 1);
    cy.visit('/directorio/organizaciones-hijas-formulario?estado=paso2');
    cy.get('.app-view-state-host [data-estado="paso2"]').should('be.visible');
  });
});
