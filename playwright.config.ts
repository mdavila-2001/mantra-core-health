import { defineConfig, devices } from '@playwright/test';

/**
 * Suite de extremo a extremo sobre **Playwright y Chromium**.
 *
 * ## Por qué existe además de Cypress
 *
 * `cypress/` sigue en pie y no se toca: cubre el recorrido visual y los caminos
 * por actor, y borrarla para estrenar herramienta sería tirar cobertura real.
 * Esta suite responde otra pregunta, la de los carriles 01 y 19: **¿qué pinta
 * cada ruta, para cada rol, hoy?** — un barrido de todas las rutas declaradas,
 * con evidencia y con una matriz de salida.
 *
 * Eso pide dos cosas que Cypress no da cómodas: varios contextos de navegador
 * con sesiones distintas en la misma corrida, y escribir un informe a disco
 * desde el propio archivo de prueba.
 *
 * ## Un solo trabajador, a propósito
 *
 * `POST /iam/auth/login` y `POST /iam/auth/token/refresh` están limitados a
 * **diez por minuto y por IP** en el backend. Es una defensa contra fuerza
 * bruta que funciona, y una suite paralela la gasta en segundos: el `429` que
 * vuelve la aplicación trata —con razón— como sesión caída, y el barrido
 * entero se cae contra una protección sana. Con un trabajador cada rol entra
 * una sola vez y navega por el router.
 */
export default defineConfig({
  testDir: './playwright',
  // El barrido abre decenas de rutas por rol; el techo por prueba tiene que
  // dar para eso sin que cada ruta lenta invente un fallo.
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'artifacts/playwright/report', open: 'never' }],
  ],
  outputDir: 'artifacts/playwright/salida',
  use: {
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4200',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
    locale: 'es-BO',
    timezoneId: 'America/La_Paz',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
