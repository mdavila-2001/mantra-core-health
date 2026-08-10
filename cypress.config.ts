import { resolve } from 'node:path';

import { defineConfig } from 'cypress';

import { levantarArnes, esperarSalud, type ArnesEnMarcha } from './cypress/harness/servidor';
import { reubicarCaptura } from './cypress/harness/evidencia';
import { tareas } from './cypress/harness/tareas';
import { configuracion, credenciales, verificarEntornoSeguro } from './cypress/support/config';

/**
 * Suite de extremo a extremo.
 *
 * ## Por qué contra el artefacto de producción y no contra `ng serve`
 *
 * Cuatro rutas se prerenderizan **solo en el build**, y las cabeceras de
 * seguridad las emite **solo** el servidor de producción. Probar contra el
 * servidor de desarrollo dejaría fuera justo lo que más fácil se rompe: que el
 * HTML del servidor y el del cliente coincidan al hidratar, y que la CSP no
 * bloquee un script.
 *
 * ## Por qué el arnés se levanta acá y no con un comando aparte
 *
 * `setupNodeEvents` corre en el proceso de Node de Cypress y vive exactamente lo
 * que vive la corrida. Un servidor arrancado desde fuera —un `&` en un script,
 * un `start-server-and-test`— sobrevive a un `Ctrl+C` y deja el puerto tomado;
 * el siguiente intento falla con `EADDRINUSE` y nadie entiende por qué.
 *
 * ## Las dos formas de simular la API, y cuándo cada una
 *
 * - **Del lado del servidor** (`cypress/harness/api-simulada.ts`), elegida por
 *   cookie de escenario: la usa la suite funcional. La respuesta cruza todo lo
 *   que cruzaría en producción, incluido el renderizado del servidor.
 * - **Del lado del navegador** (`cy.intercept`, en `support/recorrido/`): la usa
 *   el recorrido visual, que necesita cubrir la superficie entera de la API sin
 *   que el arnés tenga que implementarla.
 */

/** El arnés de esta corrida. Se apaga en `after:run`. */
let arnes: ArnesEnMarcha | null = null;

const config = configuracion();

/** Carpeta de artefactos de esta corrida: capturas, videos y el informe. */
const artefactos = resolve(process.cwd(), config.artefactos, config.runId);

export default defineConfig({
  /**
   * `Cypress.env()` apagado.
   *
   * No queda una sola lectura en la suite —todo pasa por `expose`, abajo— así
   * que apagarlo no rompe nada y cierra dos cosas: el aviso de deprecación que
   * Cypress imprimía en cada corrida, y el agujero que ese aviso describe
   * (`Cypress.env()` deja que **cualquier** código del navegador, incluido el de
   * la aplicación, lea esos valores).
   *
   * Ojo: el valor por defecto es `true`. Quitar la opción no la desactiva; hay
   * que escribir el `false`.
   */
  allowCypressEnv: false,

  /**
   * Lo que las pruebas necesitan saber del entorno.
   *
   * Las pruebas corren **dentro del navegador**, donde no hay `process.env`, así
   * que lo que se lee del entorno de Node tiene que viajar por acá.
   *
   * ## Por qué `expose` y no `env`
   *
   * `Cypress.env()` quedó deprecado en la 15 —avisa en cada corrida que lo va a
   * quitar— y su reemplazo son dos cosas distintas: `cy.env()` para lo sensible
   * y `Cypress.expose()` para **configuración pública**, que es exactamente lo
   * de acá. Nada de esto es un secreto ni puede serlo: la API de la suite
   * funcional está simulada por el propio arnés y acepta cualquier credencial.
   *
   * `cy.env()` además no serviría: es un **comando**, se encola, y las funciones
   * que lo consumen —las de `support/fixtures/usuarios.ts`— arman un objeto
   * antes de que la cadena de comandos empiece.
   *
   * Se calcula acá arriba y no dentro de `setupNodeEvents` porque este archivo
   * ya corre en Node: `credenciales()` lee `process.env` al cargarse el módulo.
   */
  expose: {
    ...credenciales(),
    E2E_RUN_ID: config.runId,
    E2E_PUERTO: config.puerto,
    E2E_ARTEFACTOS: artefactos,
  },

  viewportWidth: config.viewport.ancho,
  viewportHeight: config.viewport.alto,

  defaultCommandTimeout: config.timeoutMs,
  pageLoadTimeout: config.timeoutMs * 4,
  requestTimeout: config.timeoutMs,
  responseTimeout: config.timeoutMs,

  screenshotsFolder: resolve(artefactos, 'capturas'),
  videosFolder: resolve(artefactos, 'videos'),
  downloadsFolder: resolve(artefactos, 'descargas'),

  /**
   * Video solo en CI.
   *
   * En local la captura del fallo alcanza y el video cuesta segundos por spec.
   * En CI es lo único que permite entender algo que solo pasó allá.
   */
  video: process.env['CI'] !== undefined,

  /**
   * Sin reintentos. Una prueba que pasa al segundo intento no es una prueba que
   * pasa: es una que esconde una condición de carrera. Si aparece
   * inestabilidad, se arregla la espera —para eso Cypress reintenta cada
   * aserción— y no se tapa con un reintento del caso entero.
   */
  retries: { runMode: 0, openMode: 0 },

  e2e: {
    baseUrl: config.baseUrl,

    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    fixturesFolder: 'cypress/fixtures',

    /**
     * El recorrido visual y la suite contra la API real quedan fuera de la
     * corrida por defecto, y cada uno tiene su comando.
     *
     * El recorrido captura cientos de imágenes y tarda minutos; la suite real
     * necesita el backend levantado y una base con datos, así que arrastrarla
     * acá haría fallar `yarn test:e2e` en cualquier máquina sin API — justo lo
     * que la simulación existe para evitar.
     *
     * `E2E_SUITE` es cómo sus lanzadores las habilitan. Sin esa puerta, un
     * `--spec cypress/e2e/recorrido/…` no encontraría nada: la exclusión gana
     * sobre el patrón que se pide por línea de comandos, y el mensaje —«no spec
     * files were found»— no menciona que hay una exclusión de por medio.
     */
    excludeSpecPattern:
      process.env['E2E_SUITE'] === undefined || process.env['E2E_SUITE'] === 'funcional'
        ? ['cypress/e2e/recorrido/**', 'cypress/e2e/real/**']
        : [],

    async setupNodeEvents(on, cypressConfig) {
      verificarEntornoSeguro(config);

      on('task', tareas());

      // Reubica las capturas con nombre a `artifacts/<recorrido|real>/`, que es
      // como las agrupa el generador del informe. Las de fallo no llevan nombre
      // y se quedan donde Cypress las puso.
      on('after:screenshot', (detalles) => reubicarCaptura(detalles));

      on('after:run', async () => {
        if (arnes === null) {
          return;
        }
        await arnes.detener();
        arnes = null;
        console.log('[e2e] Arnés detenido.');
      });

      if (config.levantarServidor) {
        arnes = await levantarArnes();
      } else {
        console.log(`[e2e] Servidor externo: ${config.baseUrl}`);
        // Un servidor ajeno no tiene la ruta de salud del arnés: alcanza con
        // que conteste la raíz.
        await esperarSalud(config.baseUrl, '/');
      }

      // Lo que las pruebas leen del entorno se declara en `expose`, arriba: acá
      // ya es tarde para pensarlo y además no hace falta tocarlo.
      return cypressConfig;
    },
  },
});
