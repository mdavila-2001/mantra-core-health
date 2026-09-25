#!/usr/bin/env node
/**
 * Captura reproducible de la pantalla de carga masiva: 3 viewports × 2 temas
 * × 4 estados = 24 PNG, para la doble revisión de H4 (regla 35.1).
 *
 * ## Por qué un script aparte y no un test de Playwright
 *
 * El objetivo no es afirmar nada (`expect`): es producir el mismo conjunto
 * de imágenes cada vez que se corre, para que la comparación entre corridas
 * (H4.S1.M3) tenga sentido. `@playwright/test` es la única dependencia — ver
 * `.gitignore:174`, el script hermano `capture_medica.mjs` no se versiona
 * porque `playwright` (el paquete suelto) no es una dependencia declarada
 * del proyecto; `@playwright/test` sí.
 *
 * ## Reglas duras (heredadas del spec del contrato)
 *
 * - Nunca `networkidle` con `ng serve` (`CLAUDE.md` §5): se espera por
 *   selector visible, nunca por quietud de red.
 * - Nunca `waitForTimeout` fijo: cada espera es por condición.
 * - Un solo `ng serve`, un solo navegador (regla 70).
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:4200';
const RUTA = '/administration/terminology/import';
const SALIDA = join(RAIZ, 'docs', 'trabajo', '2026-09-25-marcelo-calidad', 'evidencia', 'h4', 'capturas');
const FIXTURES = join(RAIZ, 'playwright', 'fixtures', 'carga-masiva');
const THEME_STORAGE_KEY = 'mantra-core-health.theme';

const VIEWPORTS = [
  { nombre: '375', width: 375, height: 812 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '1280', width: 1280, height: 800 },
];
const TEMAS = ['claro', 'oscuro'];
const ESTADOS = ['vacio', 'validando', 'con-errores', 'exito'];

if (!existsSync(SALIDA)) mkdirSync(SALIDA, { recursive: true });

/** Entra por la pantalla de ingreso con la cuenta admin del simulador. */
async function entrar(page) {
  await page.goto(`${BASE_URL}/auth`);
  await page.getByTestId('login-identifier').fill('admin@alovida.mock');
  await page.getByTestId('login-password').fill('mock');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 30_000 });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  }
}

/**
 * Va a la pantalla de carga masiva con `goto` directo.
 *
 * A diferencia del spec del contrato (que navega por el router para no
 * gastar el cupo de refresh de 10/min), acá cada contexto de navegador es
 * nuevo y arranca en `about:blank` — un `pushState` ahí falla con
 * `SecurityError` porque el origen todavía es `null`. `goto` es correcto: la
 * sesión viaja por `storageState`, así que no hay canje de refresh de por
 * medio.
 */
async function irALaPantalla(page) {
  await page.goto(`${BASE_URL}${RUTA}`);
  await page.getByTestId('carga-perfil').waitFor({ state: 'visible', timeout: 15_000 });
}

/** Deja la pantalla en el estado pedido, disparado por sus data-testid reales. */
async function ponerEnEstado(page, estado) {
  if (estado === 'vacio') return;

  await page.getByTestId('carga-perfil').locator('select').selectOption({ label: 'Conceptos' });
  await page.getByTestId('carga-sistema').locator('select').selectOption({ index: 1 });
  await page.getByTestId('carga-version').locator('select').selectOption({ index: 1 });

  if (estado === 'con-errores') {
    await page
      .getByTestId('carga-archivo')
      .locator('input[type=file]')
      .setInputFiles(join(FIXTURES, 'con-errores.xlsx'));
    await page.getByRole('button', { name: 'Validar sin guardar' }).click();
    await page.getByTestId('carga-errores').waitFor({ state: 'visible', timeout: 15_000 });
    return;
  }

  // 'validando' y 'exito' arrancan igual: ok-50.csv + Validar.
  await page
    .getByTestId('carga-archivo')
    .locator('input[type=file]')
    .setInputFiles(join(FIXTURES, 'ok-50.csv'));

  if (estado === 'validando') {
    // El doble responde en ~40 ms: se retrasa sólo la respuesta (no se
    // altera su contenido) para que el estado intermedio sea capturable.
    // Declarado en `evidencia/doble-revision.md` — no es un mock dentro de
    // un test, es una demora de la respuesta real para fotografiar un
    // estado real que existe pero dura muy poco.
    await page.route('**/import-file', async (route) => {
      await new Promise((resuelve) => setTimeout(resuelve, 2_000));
      await route.continue();
    });
    await page.getByRole('button', { name: 'Validar sin guardar' }).click();
    await page.getByTestId('carga-validando').waitFor({ state: 'visible', timeout: 5_000 });
    return;
  }

  // estado === 'exito'
  await page.getByRole('button', { name: 'Validar sin guardar' }).click();
  await page.getByTestId('carga-informe').waitFor({ state: 'visible', timeout: 15_000 });
  await page.getByTestId('carga-importar').click();
  await page.getByTestId('carga-resumen').waitFor({ state: 'visible', timeout: 15_000 });
}

async function capturarTodo() {
  const browser = await chromium.launch();
  const capturadas = [];

  // Sesión compartida (storageState) para no gastar el cupo de login (10/min).
  const paginaDeLogin = await (await browser.newContext()).newPage();
  await entrar(paginaDeLogin);
  const storageState = await paginaDeLogin.context().storageState();
  await paginaDeLogin.context().close();

  for (const viewport of VIEWPORTS) {
    for (const tema of TEMAS) {
      const contexto = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        colorScheme: tema === 'oscuro' ? 'dark' : 'light',
        reducedMotion: 'reduce',
        locale: 'es-BO',
        storageState,
      });
      await contexto.addInitScript(
        ({ clave, valor }) => window.localStorage.setItem(clave, valor),
        { clave: THEME_STORAGE_KEY, valor: tema === 'oscuro' ? 'dark' : 'light' },
      );
      const page = await contexto.newPage();

      for (const estado of ESTADOS) {
        const nombreDeArchivo = `${viewport.nombre}-${tema}-${estado}.png`;
        try {
          await irALaPantalla(page);
          await ponerEnEstado(page, estado);
          await page.evaluate(() => document.fonts.ready);
          await page.screenshot({ path: join(SALIDA, nombreDeArchivo), fullPage: true });
          capturadas.push(nombreDeArchivo);
          console.log(`ok  ${nombreDeArchivo}`);
        } catch (error) {
          // Un testid ausente en una pantalla más vieja se captura igual y
          // se marca, en vez de abortar el resto de la matriz (H4.S1 del
          // carril).
          const nombreMarcado = nombreDeArchivo.replace('.png', '-no-existe-aun.png');
          await page.screenshot({ path: join(SALIDA, nombreMarcado), fullPage: true }).catch(() => {});
          capturadas.push(nombreMarcado);
          console.warn(`marcado  ${nombreMarcado}  (${error.message.split('\n')[0]})`);
        }
      }

      await contexto.close();
    }
  }

  await browser.close();
  console.log(`\n${capturadas.length} capturas en ${SALIDA}`);
  return capturadas;
}

capturarTodo().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
