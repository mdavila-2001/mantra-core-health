import { defineConfig, devices } from '@playwright/test';

/**
 * Recorrido con **usuarios reales contra la API viva**.
 *
 * ## Por qué es una configuración aparte y no un proyecto más
 *
 * Las otras dos suites simulan la red a propósito: `playwright.config.ts` para
 * ser determinista en cada cambio, `playwright.recorrido.config.ts` para que las
 * capturas se puedan comparar entre corridas. Ésta hace lo contrario —no simula
 * nada— y por eso **necesita una API levantada y una base con datos**. Como
 * proyecto dentro de cualquiera de las otras dos, `yarn e2e` empezaría a fallar
 * en la máquina de quien no tenga el backend corriendo, que es justo lo que las
 * suites simuladas evitan.
 *
 * ## Por qué contra `ng serve` y no contra el artefacto construido
 *
 * Por CORS. La API arranca con `app.enableCors({ origin: false })`, así que el
 * navegador no puede llamarla desde otro origen: hace falta un proxy en el mismo
 * origen, y el que existe es el de `ng serve` (`proxy.conf.json`). El servidor
 * de SSR no proxea nada.
 *
 * Lo que se pierde es el prerenderizado de las cuatro rutas públicas — que ya
 * cubren las otras dos suites — y lo que se gana es lo único que esta suite
 * puede dar: saber si el producto funciona con los permisos de verdad.
 *
 * ## Sin reintentos y con un solo worker
 *
 * Cada actor se registra de verdad en la base. Reintentar volvería a registrar y
 * el segundo intento chocaría con el `409` de «ese documento ya existe», que se
 * leería como un defecto del producto. Un solo worker por lo mismo que en el
 * recorrido visual: las capturas se numeran con un contador por pantalla.
 */
export default defineConfig({
  testDir: './e2e/real',

  globalSetup: './e2e/real/support/preparar.ts',

  fullyParallel: false,
  workers: 1,
  retries: 0,

  // Generoso: cada prueba entra por la pantalla de ingreso —una petición de
  // verdad— y después encadena las lecturas de cada sección.
  timeout: 180_000,

  reporter: [['list']],

  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://127.0.0.1:4300',
    viewport: { width: 1440, height: 900 },
    // Sin esto, dos corridas de la misma pantalla difieren en los decimales de
    // cualquier medida que dependa de la densidad de pantalla.
    deviceScaleFactor: 1,
    // Las capturas las saca la evidencia, no el corredor: acá sólo interesa la
    // del fallo.
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    // `ng serve` con el proxy: es lo que pone la API en el mismo origen.
    //
    // Puerto 4300 y no 4200 a propósito: el 4200 lo suele ocupar el contenedor
    // de desarrollo (`docker compose`), que sirve la aplicación con el proxy de
    // Docker. Correr esta suite ahí la ataría a la configuración de ese
    // contenedor, y matarlo para hacerle lugar rompería el entorno de quien lo
    // esté usando.
    // `--host 127.0.0.1` no es cosmético: por omisión `ng serve` escucha en
    // `localhost`, que en macOS resuelve a `::1`, y la comprobación de arranque
    // contra `127.0.0.1` no conecta nunca. El síntoma es un tiempo de espera de
    // tres minutos que no menciona la palabra IPv6 por ningún lado.
    command: 'yarn start --port 4300 --host 127.0.0.1',
    url: 'http://127.0.0.1:4300/auth',
    // Reutilizar el servidor es lo normal acá: iterar sobre esta suite
    // reconstruyendo cada vez es insoportable, y el servidor de desarrollo
    // recompila solo cuando el código cambia.
    reuseExistingServer: process.env['E2E_REUSAR_SERVIDOR'] !== 'false',
    timeout: 180_000,
  },
});
