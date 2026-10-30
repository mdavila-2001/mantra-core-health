import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';

/**
 * Evidencia visual del portal de reportería (MAQUETA con datos de EJEMPLO).
 *
 * Recorre, para cada viewport (390, 768, 1440) y cada tema (claro, oscuro): la
 * elección de portal, el grid de reportes y las siete pestañas del dashboard
 * comercial, y deja las capturas en `evidencia/capturas/`. Aparte, en escritorio,
 * ejercita las interacciones que la disciplina de cada gráfico promete
 * (tooltip, clic que filtra, «cómo se calcula», velas, ver en grande, el
 * asistente) y los estados (vacío, error, sin permiso, atrasado) que el
 * servidor simulado fuerza con una llave de `localStorage`.
 *
 * Una captura NO es evidencia hasta que alguien la mira: esta prueba solo las
 * produce y registra consola y red en `consola-red.json`.
 *
 * Corre en serie y con un solo navegador (CLAUDE.md, regla de la casa).
 */

const EVIDENCIA = join(
  process.cwd(),
  'docs/trabajo/2026-10-30-reporteria-comercial-alovida/evidencia',
);
const CAPTURAS = join(EVIDENCIA, 'capturas');
mkdirSync(CAPTURAS, { recursive: true });

const REPORTS = process.env['E2E_REPORTS_BASE'] ?? '/reports';
const TABS = [
  'resumen',
  'suscripciones',
  'publicidad',
  'comisiones',
  'cobros',
  'adquisicion',
  'calidad',
] as const;
const VIEWPORTS = [
  { nombre: 'movil', ancho: 390, alto: 844 },
  { nombre: 'tableta', ancho: 768, alto: 1024 },
  { nombre: 'escritorio', ancho: 1440, alto: 900 },
] as const;
const TEMAS = [
  { nombre: 'claro', valor: 'light' },
  { nombre: 'oscuro', valor: 'dark' },
] as const;
const THEME_STORAGE_KEY = 'mantra-core-health.theme';
const STATE_KEY = 'mock:reporting:estado';

interface Hallazgo {
  readonly pantalla: string;
  readonly tipo: 'consola' | 'error-de-pagina' | 'red';
  readonly detalle: string;
}
const hallazgos: Hallazgo[] = [];

test.describe.configure({ mode: 'serial' });
test.setTimeout(240_000);

function vigilar(page: Page, pantalla: () => string): void {
  page.on('console', (m) => {
    if (m.type() === 'error') {
      hallazgos.push({ pantalla: pantalla(), tipo: 'consola', detalle: m.text().slice(0, 300) });
    }
  });
  page.on('pageerror', (e) => {
    hallazgos.push({ pantalla: pantalla(), tipo: 'error-de-pagina', detalle: e.message.slice(0, 300) });
  });
  page.on('response', (r) => {
    if (r.status() >= 400) {
      hallazgos.push({ pantalla: pantalla(), tipo: 'red', detalle: `${r.status()} ${r.url().slice(0, 200)}` });
    }
  });
}

async function newSession(
  browser: import('@playwright/test').Browser,
  ancho: number,
  alto: number,
  tema: 'light' | 'dark',
  viewState?: string,
): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({
    viewport: { width: ancho, height: alto },
    locale: 'es-BO',
    timezoneId: 'America/La_Paz',
    reducedMotion: 'reduce',
  });
  await context.addInitScript(
    ([clave, valor, llaveEstado, estadoForzado]) => {
      try {
        localStorage.setItem(clave, valor);
        if (estadoForzado) {
          localStorage.setItem(llaveEstado, estadoForzado);
        }
      } catch {
        /* sin almacenamiento */
      }
    },
    [THEME_STORAGE_KEY, tema, STATE_KEY, viewState ?? ''],
  );
  const page = await context.newPage();
  return { context, page };
}

async function signInAsAdmin(page: Page): Promise<void> {
  await page.goto('/auth');
  await page.getByTestId('login-identifier').fill('admin@alovida.mock');
  await page.getByTestId('login-password').fill('password123');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(portal-selector|auth\/organization|dashboard)/, { timeout: 60_000 });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/(portal-selector|dashboard)/, { timeout: 60_000 });
  }
}

async function esperarGraficos(page: Page): Promise<void> {
  await expect(page.getByTestId('tab-view')).toBeVisible({ timeout: 30_000 });
  await page.waitForFunction(
    () => document.querySelectorAll('app-chart-panel [role="img"] svg').length > 0,
    undefined,
    { timeout: 30_000 },
  );
  // Las pistas de ECharts pintan en el siguiente cuadro.
  await page.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => r())));
}

async function capturar(page: Page, nombre: string): Promise<void> {
  await page.screenshot({ path: join(CAPTURAS, `${nombre}.png`), fullPage: true });
}

for (const vp of VIEWPORTS) {
  for (const tema of TEMAS) {
    test(`recorrido ${vp.nombre} · ${tema.nombre}`, async ({ browser }) => {
      const { context, page } = await newSession(browser, vp.ancho, vp.alto, tema.valor);
      let pantalla = 'login';
      vigilar(page, () => `${vp.nombre}-${tema.nombre}-${pantalla}`);
      try {
        await signInAsAdmin(page);

        pantalla = 'selector';
        await expect(page.getByTestId('portal-reporteria')).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId('portal-administracion')).toBeVisible();
        await capturar(page, `${vp.nombre}-${tema.nombre}-01-selector-de-portal`);

        await page.getByTestId('portal-reporteria').click();
        pantalla = 'grid';
        await expect(page.getByTestId('report-grid')).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId('report-grid-loading')).toHaveCount(0, { timeout: 30_000 });
        await capturar(page, `${vp.nombre}-${tema.nombre}-02-grid-de-reportes`);

        let n = 3;
        for (const tab of TABS) {
          pantalla = `tab-${tab}`;
          await page.goto(`${REPORTS}/commercial/${tab}`);
          await esperarGraficos(page);
          await capturar(page, `${vp.nombre}-${tema.nombre}-${String(n).padStart(2, '0')}-${tab}`);
          n += 1;
        }
      } finally {
        await context.close();
      }
    });
  }
}

/** El panel de un gráfico que cumple la condición, o falla con un mensaje claro. */
function panelWith(page: Page, filtro: { hasText?: string; has?: Locator }): Locator {
  return page.locator('app-chart-panel', filtro).first();
}

for (const tema of TEMAS) {
  test(`interacciones de los gráficos · escritorio · ${tema.nombre}`, async ({ browser }) => {
    const { context, page } = await newSession(browser, 1440, 900, tema.valor);
    let pantalla = 'login';
    vigilar(page, () => `interaccion-${tema.nombre}-${pantalla}`);
    try {
      await signInAsAdmin(page);
      await page.getByTestId('portal-reporteria').click();
      await page.goto(`${REPORTS}/commercial/suscripciones`);
      await esperarGraficos(page);
      const prefijo = `escritorio-${tema.nombre}-interaccion`;

      // 4) Tooltip: se ve al pasar el puntero por el gráfico.
      pantalla = 'tooltip';
      const primero = page.locator('app-chart-panel').first();
      const lienzo = primero.locator('[role="img"]');
      await lienzo.scrollIntoViewIfNeeded();
      const caja = await lienzo.boundingBox();
      expect(caja).not.toBeNull();
      if (caja !== null) {
        await page.mouse.move(caja.x + caja.width * 0.55, caja.y + caja.height * 0.45);
        await page.mouse.move(caja.x + caja.width * 0.56, caja.y + caja.height * 0.46);
      }
      await page.waitForTimeout(400); // el tooltip de ECharts entra con una transición corta
      await primero.screenshot({ path: join(CAPTURAS, `${prefijo}-01-tooltip.png`) });

      // 6) Cómo se calcula.
      pantalla = 'como-se-calcula';
      const withInfo = panelWith(page, { has: page.getByTestId('chart-how-calculated') });
      await withInfo.getByTestId('chart-how-calculated').click();
      await expect(withInfo.getByTestId('chart-info')).toBeVisible();
      await withInfo.screenshot({ path: join(CAPTURAS, `${prefijo}-02-como-se-calcula.png`) });

      // 7) Velas.
      pantalla = 'velas';
      const withCandles = panelWith(page, { has: page.getByRole('radio', { name: 'Velas' }) });
      await withCandles.scrollIntoViewIfNeeded();
      await withCandles.getByRole('radio', { name: 'Velas' }).click();
      await expect(withCandles.getByTestId('chart-candles-note')).toBeVisible();
      await page.waitForTimeout(400);
      await withCandles.screenshot({ path: join(CAPTURAS, `${prefijo}-03-velas.png`) });
      await withCandles.getByRole('radio', { name: 'Gráfico' }).click();

      // 5) Clic que filtra: el KPI de MRR cambia y aparece la ficha del filtro.
      pantalla = 'filtro-por-clic';
      const kpiAntes = (await page.getByTestId('kpi-mrr').first().innerText()).trim();
      const filtrable = panelWith(page, { hasText: 'Haga clic en un elemento del gráfico' });
      await filtrable.scrollIntoViewIfNeeded();
      const indice = await filtrable.locator('[role="img"] svg path').evaluateAll((els) => {
        const svg = els[0]?.closest('svg');
        const total = svg ? svg.getBoundingClientRect().width * svg.getBoundingClientRect().height : 0;
        let mejor = -1;
        let area = 0;
        els.forEach((e, i) => {
          const r = e.getBoundingClientRect();
          const a = r.width * r.height;
          const fill = e.getAttribute('fill');
          if (fill && fill !== 'none' && fill !== 'transparent' && a > 150 && a < total * 0.6 && a > area) {
            area = a;
            mejor = i;
          }
        });
        return mejor;
      });
      expect(indice, 'no se encontró un elemento clicable en el gráfico filtrable').toBeGreaterThanOrEqual(0);
      await filtrable.locator('[role="img"] svg path').nth(indice).click({ force: true });
      await expect(page.getByTestId('filter-chip').first()).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(600);
      const kpiDespues = (await page.getByTestId('kpi-mrr').first().innerText()).trim();
      expect(kpiDespues, 'el filtro no movió el MRR').not.toBe(kpiAntes);
      await page.screenshot({ path: join(CAPTURAS, `${prefijo}-04-filtro-por-clic.png`), fullPage: false });
      await page.getByTestId('filters-clear').click();

      // Ver en grande + tabla de respaldo.
      pantalla = 'ver-en-grande';
      const panel = page.locator('app-chart-panel').first();
      await panel.scrollIntoViewIfNeeded();
      await panel.getByTestId('chart-more').click();
      await page.getByRole('menuitem', { name: 'Ver en grande' }).click();
      await expect(page.getByTestId('content-dialog')).toBeVisible();
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(CAPTURAS, `${prefijo}-05-ver-en-grande.png`) });
      await page.keyboard.press('Escape');

      // Asistente.
      pantalla = 'asistente';
      await page.getByTestId('reporting-asistente-boton').click();
      await expect(page.getByTestId('reporting-asistente')).toBeVisible();
      await page.screenshot({ path: join(CAPTURAS, `${prefijo}-06-asistente-abierto.png`) });
      const entrada = page.getByTestId('reporting-asistente').getByRole('textbox');
      await entrada.fill('¿Cuál es el MRR?');
      await entrada.press('Enter');
      await expect(page.getByTestId('reporting-asistente').getByRole('log')).toContainText(/MRR/i, {
        timeout: 30_000,
      });
      await page.waitForTimeout(500);
      await page.screenshot({ path: join(CAPTURAS, `${prefijo}-07-asistente-responde.png`) });
      await entrada.fill('dame los pacientes de la clínica');
      await entrada.press('Enter');
      await page.waitForTimeout(800);
      await page.screenshot({ path: join(CAPTURAS, `${prefijo}-08-asistente-rechaza-personas.png`) });
    } finally {
      await context.close();
    }
  });
}

const ESTADOS = ['vacio', 'error', 'sin-permiso', 'atrasado'] as const;
for (const viewState of ESTADOS) {
  for (const vp of [VIEWPORTS[0], VIEWPORTS[2]]) {
    test(`estado ${viewState} · ${vp.nombre} · claro`, async ({ browser }) => {
      const { context, page } = await newSession(browser, vp.ancho, vp.alto, 'light', viewState);
      let pantalla = 'login';
      vigilar(page, () => `estado-${viewState}-${vp.nombre}-${pantalla}`);
      try {
        await signInAsAdmin(page);
        await page.getByTestId('portal-reporteria').click();
        pantalla = 'grid';
        await page.waitForTimeout(1500);
        await capturar(page, `${vp.nombre}-claro-estado-${viewState}-grid`);
        pantalla = 'dashboard';
        await page.goto(`${REPORTS}/commercial/suscripciones`);
        await page.waitForTimeout(1800);
        await capturar(page, `${vp.nombre}-claro-estado-${viewState}-dashboard`);
      } finally {
        await context.close();
      }
    });
  }
}

test('autorización negativa · una cuenta sin reportería no entra al portal', async ({ browser }) => {
  const { context, page } = await newSession(browser, 1440, 900, 'light');
  vigilar(page, () => 'sin-permiso-ruta');
  try {
    await page.goto('/auth');
    await page.getByTestId('login-identifier').fill('paciente@alovida.mock');
    await page.getByTestId('login-password').fill('password123');
    await page.getByTestId('login-submit').click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
    await page.goto(REPORTS);
    await expect(page).not.toHaveURL(new RegExp(`${REPORTS}$`));
    await capturar(page, 'negativo-paciente-intenta-reportes');
    await page.goto('/portal-selector');
    await expect(page.getByTestId('portal-reporteria')).toHaveCount(0);
    await capturar(page, 'negativo-paciente-intenta-selector');
  } finally {
    await context.close();
  }
});

test.afterAll(() => {
  writeFileSync(join(EVIDENCIA, 'consola-red.json'), JSON.stringify(hallazgos, null, 2), 'utf-8');
});
