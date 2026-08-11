/**
 * Preparación que corre antes de cada archivo de prueba.
 *
 * Cypress lo carga solo (`supportFile` en `cypress.config.ts`), así que acá va
 * lo que vale para **toda** la suite y nada más: los comandos propios y la
 * vigilancia de la consola.
 *
 * ## Sobre el aislamiento entre pruebas
 *
 * No hace falta declararlo: `testIsolation` viene en `true` por defecto y
 * Cypress limpia cookies, almacenamiento local y de sesión antes de cada
 * prueba. Es lo que la suite anterior conseguía abriendo un navegador nuevo por
 * prueba, sin pagar el arranque de un navegador por prueba.
 *
 * Es también lo que hace que la cookie del escenario no se herede: cada prueba
 * declara el suyo con `cy.abrirEscenario()` y empieza de cero.
 */

import './commands';
import { reiniciarConsola, vigilarConsola } from './consola';

/**
 * Engancha la vigilancia de la consola en cada carga de página.
 *
 * `window:before:load` corre antes de que el documento ejecute una sola línea,
 * que es la única forma de ver los errores del arranque — justo los que
 * importan cuando la CSP bloquea un script.
 */
Cypress.on('window:before:load', (ventana) => {
  vigilarConsola(ventana);
});

beforeEach(() => {
  reiniciarConsola();
});
