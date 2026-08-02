import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de extremo a extremo y de regresión visual.
 *
 * ## Por qué contra el artefacto de producción y no contra `ng serve`
 *
 * Cuatro rutas se prerenderizan en el build, y el prerenderizado **solo existe
 * en el artefacto construido**. Probar contra el servidor de desarrollo dejaría
 * fuera justamente lo que más fácil se rompe: que el HTML del servidor y el del
 * cliente coincidan al hidratar.
 *
 * Además el artefacto es el que emite las cabeceras de seguridad, así que la
 * CSP se verifica de paso: si bloqueara un script, la aplicación no arrancaría
 * y estas pruebas lo dirían.
 *
 * ## Por qué la red va simulada
 *
 * Los journeys que faltaban cubrir —login, recuperación, sesión persistente— son
 * de **navegación, estado y persistencia**, no de contrato. El contrato es otra
 * capa y otra herramienta.
 *
 * Con la red simulada, las pruebas son deterministas y no necesitan base de
 * datos, ni datos sembrados, ni una API levantada. Una suite E2E que falla al
 * azar es peor que no tenerla: se termina ignorando.
 */
export default defineConfig({
  testDir: './e2e',

  // La suite de Selenium vive en `e2e/selenium/` y la corre Vitest con su
  // propia configuración. El patrón por defecto de Playwright no la recogería
  // —sus archivos no terminan en `.spec.ts` por casualidad, sino que ESTÁN
  // dentro de esa carpeta— pero dejarlo explícito evita que un archivo nuevo
  // termine ejecutándose por los dos corredores a la vez.
  testIgnore: ['**/selenium/**'],

  // Sin paralelismo entre archivos: comparten el mismo servidor y el mismo
  // puerto, y el arranque del artefacto no es gratis.
  fullyParallel: false,
  workers: 1,

  // En CI, un `test.only` olvidado convierte la suite en una sola prueba.
  forbidOnly: !!process.env['CI'],

  // Un reintento en CI absorbe el fallo de infraestructura ocasional sin tapar
  // uno real: dos reintentos ya esconden una prueba inestable.
  retries: process.env['CI'] ? 1 : 0,

  reporter: process.env['CI'] ? [['github'], ['list']] : [['list']],

  use: {
    baseURL: 'http://127.0.0.1:4173',
    // Traza y captura solo del primer reintento: en verde no cuestan nada.
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /**
   * Construye y sirve el artefacto real, **siempre uno limpio**.
   *
   * `reuseExistingServer: true` parecía la optimización obvia —ahorra un build
   * por corrida— y era una trampa: el servidor de renderizado **lee el HTML
   * prerenderizado al arrancar y lo guarda en memoria**. Si alguien reconstruye
   * mientras uno viejo sigue vivo, ese HTML apunta a chunks cuyo hash ya cambió,
   * la aplicación no arranca, y las siete pruebas fallan por tiempo de espera
   * sin una sola pista de por qué.
   *
   * Con `false`, si el puerto está ocupado Playwright lo dice en una línea. Un
   * fallo legible vale más que los cuarenta segundos que ahorraba.
   */
  webServer: {
    command: 'yarn build && PORT=4173 node dist/mantra-core-health/server/server.mjs',
    url: 'http://127.0.0.1:4173/auth',
    reuseExistingServer: false,
    timeout: 180_000,
  },

  /**
   * Las capturas de regresión visual dependen del sistema donde se generaron:
   * las fuentes y el antialiasing de macOS no son los de Linux. Comparar entre
   * plataformas produce diferencias que no son regresiones, y una suite visual
   * que falla sin motivo se termina ignorando.
   *
   * Por eso las capturas se generan **en el contenedor** —ver
   * `docs/testing/visual-regression.md`— y el umbral admite el ruido de
   * compresión, no un cambio de diseño.
   */
  expect: {
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    },
  },
});
