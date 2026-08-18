import { apiViva } from '../../support/real/actores';
import { estable } from '../../support/real/sesion';

/**
 * Carril P4 — el directorio público, sin sesión.
 *
 * ## Por qué esta prueba no llama a `entrar`
 *
 * Porque su tesis es que **no hace falta**. Es la única suite del directorio
 * `real/` que no abre sesión: cada caso navega en frío y el primero comprueba
 * que el navegador quedó sin token, para que «se ve sin sesión» no pueda pasar
 * a verde por una sesión que dejó otra prueba.
 *
 * ## Es el adaptador Cypress de los mismos journeys que corre Playwright
 *
 * `playwright/carril-p4-buscador-publico.spec.ts` cubre P4-E2E-001 y
 * P4-E2E-002 con la misma precondición y las mismas afirmaciones. No es
 * duplicación por descuido: el catálogo del carril pide los dos adaptadores, y
 * cada herramienta corre en un arnés distinto —Cypress contra el artefacto de
 * producción con sus cabeceras de seguridad, Playwright contra el servidor SSR—
 * así que un fallo en uno y no en el otro señala el arnés, que es información.
 *
 * ## Los datos son los que sembró el producto
 *
 * `doctor-uno-e2e` y `doctor-dos-e2e` los publicó su propia titular con su
 * sesión durante `yarn seed:e2e`; `doctor-oculto-e2e` existe y **no** está
 * publicado, a propósito: sin él, «lo despublicado no se distingue de lo
 * inexistente» no se puede demostrar, sólo afirmar.
 */

/** Los slugs que siembra `tools/e2e/seed-e2e.mjs`. */
const PUBLICADO = 'doctor-uno-e2e';
const DESPUBLICADO = 'doctor-oculto-e2e';
const INEXISTENTE = 'no-existe-en-ninguna-parte-e2e';

describe('Directorio público · sin sesión', () => {
  before(() => {
    apiViva().should('equal', true);
  });

  beforeEach(() => {
    // Sin sesión y sin restos de una anterior: es la precondición de todo el
    // archivo, no un detalle de limpieza.
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  // ─── P4-E2E-001 ────────────────────────────────────────────────────────────

  it('P4-E2E-001 · buscar, encontrar y abrir una ficha sin cuenta', () => {
    cy.visit('/buscar');
    estable();

    cy.contains('a', /Marisol Quispe/i).should('be.visible').click();

    cy.location('pathname').should('eq', `/p/${PUBLICADO}`);
    cy.get('h1').should('contain.text', 'Marisol Quispe');

    // No quedó sesión: la ficha se vio en frío.
    cy.window().then((ventana) => {
      expect(Object.keys(ventana.localStorage)).to.not.include('refreshToken');
    });
  });

  it('el texto buscado viaja en `?q=` y acota la lista', () => {
    cy.visit('/buscar?q=Mamani');
    estable();

    cy.contains('a', /Iván Mamani/i).should('be.visible');
    cy.contains('a', /Marisol Quispe/i).should('not.exist');
  });

  it('la ficha no ofrece entrar para poder leerse', () => {
    cy.visit(`/p/${PUBLICADO}`);
    estable();

    // Cobrar peaje en la puerta es la forma más rápida de que nadie entre: la
    // cuenta aparece recién en la acción que deja rastro en otra persona.
    cy.get('h1').should('contain.text', 'Marisol Quispe');
    cy.location('pathname').should('not.include', '/auth');
  });

  // ─── P4-E2E-002 ────────────────────────────────────────────────────────────

  it('P4-E2E-002 · lo despublicado da la misma pantalla que lo inexistente', () => {
    cy.visit(`/p/${DESPUBLICADO}`, { failOnStatusCode: false });
    estable();
    cy.get('h1')
      .invoke('text')
      .then((despublicado) => {
        cy.visit(`/p/${INEXISTENTE}`, { failOnStatusCode: false });
        estable();
        cy.get('h1').invoke('text').should('eq', despublicado);
      });
  });

  it('la pantalla no revela que el perfil existe', () => {
    cy.visit(`/p/${DESPUBLICADO}`, { failOnStatusCode: false });
    estable();

    cy.get('body')
      .invoke('text')
      .then((texto: string) => {
        expect(texto.toLowerCase()).to.not.match(/privad|despublicad|no publicad|oculto/);
      });
  });

  it('el perfil despublicado no aparece en la búsqueda anónima', () => {
    cy.visit('/buscar');
    estable();

    cy.contains(/oculto/i).should('not.exist');
  });
});
