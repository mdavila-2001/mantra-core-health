import { defineConfig, devices } from '@playwright/test';

/**
 * El recorrido visual: una captura de cada pantalla y de cada estado al que se
 * llega accionando algo.
 *
 * ## Por qué una configuración aparte y no un proyecto más
 *
 * `playwright.config.ts` corre en cada cambio y tiene que terminar rápido; el
 * recorrido tarda minutos y produce cientos de archivos. Como proyecto dentro de
 * la misma configuración se ejecutaría con `yarn e2e` sin que nadie lo pidiera.
 * Separado, `yarn e2e` sigue siendo la suite de siempre y `yarn recorrido` es
 * una decisión explícita.
 *
 * ## Por qué contra el artefacto y no contra `ng serve`
 *
 * Por lo mismo que la suite de extremo a extremo: cuatro rutas se prerenderizan
 * en el build y el prerenderizado **sólo existe en el artefacto construido**.
 * Un recorrido hecho contra el servidor de desarrollo mostraría pantallas que no
 * son las que ve nadie en producción, que es justo lo contrario de lo que una
 * evidencia tiene que ser.
 */
export default defineConfig({
  testDir: './e2e/recorrido',

  // Vaciar las evidencias de la corrida anterior antes de la primera prueba.
  globalSetup: './e2e/recorrido/support/preparar.ts',

  // Sin paralelismo: las capturas se numeran con un contador por pantalla, y dos
  // workers escribiendo el mismo manifiesto lo dejarían intercalado. Además el
  // recorrido no tiene por qué ser rápido — tiene que ser completo.
  fullyParallel: false,
  workers: 1,

  // Sin reintentos: un reintento volvería a capturar la misma pantalla y el
  // reporte terminaría con estados duplicados sin forma de distinguirlos.
  retries: 0,

  // Generoso a propósito: la vitrina acciona sus más de doscientos controles en
  // una sola prueba, y cada acción espera a que la pantalla se estabilice y saca
  // una captura de página completa. Con los tres minutos de antes, subir su tope
  // de acciones habría cambiado un recorte anotado por un fallo por tiempo.
  timeout: 600_000,

  reporter: [['list']],

  use: {
    baseURL: 'http://127.0.0.1:4173',
    // Escritorio: es donde se diseñó la aplicación. El comportamiento en móvil
    // tiene su propia prueba, que cambia el viewport donde hace falta.
    viewport: { width: 1440, height: 900 },
    // Sin esto, dos corridas de la misma pantalla difieren en los decimales de
    // cualquier medida que dependa de la densidad de pantalla.
    deviceScaleFactor: 1,
    screenshot: 'off',
    trace: 'off',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: 'yarn build && PORT=4173 node dist/mantra-core-health/server/server.mjs',
    url: 'http://127.0.0.1:4173/auth',
    // Reutilizar el servidor ahorra un build por corrida, y en la suite de
    // extremo a extremo era una trampa —el servidor cachea el HTML
    // prerenderizado al arrancar—. Acá se admite **sólo si se pide**, porque
    // iterar sobre el recorrido reconstruyendo cada vez es insoportable y quien
    // pasa la variable sabe que el artefacto tiene que estar fresco.
    reuseExistingServer: process.env['RECORRIDO_REUSAR_SERVIDOR'] === 'true',
    timeout: 180_000,
  },
});
