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
    hallazgos.push({
      pantalla: pantalla(),
      tipo: 'error-de-pagina',
      detalle: e.message.slice(0, 300),
    });
  });
  page.on('response', (r) => {
    if (r.status() >= 400) {
      hallazgos.push({
        pantalla: pantalla(),
        tipo: 'red',
        detalle: `${r.status()} ${r.url().slice(0, 200)}`,
      });
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
    baseURL: process.env['E2E_BASE_URL'] ?? 'http://localhost:4200',
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
  // Una captura a media transición (la pantalla de acceso todavía debajo) no es evidencia:
  // se espera a que la vista anterior salga y a que terminen las animaciones y las fuentes.
  await expect(page.locator('app-login')).toHaveCount(0);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)));
  });
  await esperarLayoutEstable(page);
  await page.screenshot({ path: join(CAPTURAS, `${nombre}.png`), fullPage: true });
}

/**
 * Espera a que la geometría de la página deje de cambiar durante varios cuadros seguidos. Cubre lo que
 * `getAnimations()` no ve: una tarjeta que sigue escalándose por una transición de ruta, o un gráfico que
 * se redimensiona tras abrir un panel. Sin esto, la evidencia salía a media transición.
 */
async function esperarLayoutEstable(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolver) => {
        const firma = (): string =>
          [
            document.documentElement.scrollHeight,
            ...Array.from(
              document.querySelectorAll('main, [data-testid="portal-reporteria"], app-chart-panel'),
            ).map((e) => {
              const r = e.getBoundingClientRect();
              return `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`;
            }),
          ].join('|');
        let anterior = firma();
        let iguales = 0;
        let cuadros = 0;
        const paso = (): void => {
          const actual = firma();
          iguales = actual === anterior ? iguales + 1 : 0;
          anterior = actual;
          cuadros += 1;
          // 8 cuadros iguales seguidos; tope de 240 para no colgar la prueba si algo nunca se aquieta.
          if (iguales >= 8 || cuadros >= 240) {
            resolver();
          } else {
            requestAnimationFrame(paso);
          }
        };
        requestAnimationFrame(paso);
      }),
  );
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
        await capturar(page, `${vp.nombre}-${tema.nombre}-01-portal-selector`);

        await page.getByTestId('portal-reporteria').click();
        pantalla = 'grid';
        await expect(page.getByTestId('report-grid')).toBeVisible({ timeout: 30_000 });
        await expect(page.getByTestId('report-grid-loading')).toHaveCount(0, { timeout: 30_000 });
        await capturar(page, `${vp.nombre}-${tema.nombre}-02-reports-grid`);

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
      pantalla = 'how-calculated';
      const withInfo = panelWith(page, { has: page.getByTestId('chart-how-calculated') });
      await withInfo.getByTestId('chart-how-calculated').click();
      await expect(withInfo.getByTestId('chart-info')).toBeVisible();
      await withInfo.screenshot({ path: join(CAPTURAS, `${prefijo}-02-how-calculated.png`) });

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
      pantalla = 'click-filter';
      const kpiAntes = (await page.getByTestId('kpi-mrr').first().innerText()).trim();
      const filtrable = panelWith(page, { hasText: 'Haga clic en un elemento del gráfico' });
      await filtrable.scrollIntoViewIfNeeded();
      const objetivo = await filtrable.locator('[role="img"] svg path').evaluateAll((els) => {
        // Una marca del gráfico cuyo centro de verdad recibe el clic (no un fondo ni un adorno).
        for (const e of els) {
          const r = e.getBoundingClientRect();
          const fill = e.getAttribute('fill');
          if (!fill || fill === 'none' || fill === 'transparent' || r.width < 8 || r.height < 8) {
            continue;
          }
          const x = r.x + r.width / 2;
          const y = r.y + r.height / 2;
          if (
            document.elementFromPoint(x, y) === e ||
            e.contains(document.elementFromPoint(x, y))
          ) {
            return { x, y };
          }
        }
        return null;
      });
      expect(
        objetivo,
        'no se encontró un elemento clicable en el gráfico filtrable',
      ).not.toBeNull();
      if (objetivo !== null) {
        await page.mouse.move(objetivo.x, objetivo.y);
        await page.mouse.click(objetivo.x, objetivo.y);
      }
      await expect(page.getByTestId('filter-chip').first()).toBeVisible({ timeout: 15_000 });
      // La ficha nombra un plan real, no la fecha del eje (regresión: salía «Plan: 2026-10-01»).
      await expect(page.getByTestId('filter-chip').first()).toContainText(
        /Plan: (Esencial|Profesional|Clínica)/,
      );
      await page.waitForTimeout(600);
      const kpiDespues = (await page.getByTestId('kpi-mrr').first().innerText()).trim();
      expect(kpiDespues, 'el filtro no movió el MRR').not.toBe(kpiAntes);
      await page.screenshot({
        path: join(CAPTURAS, `${prefijo}-04-click-filter.png`),
        fullPage: false,
      });
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
      await page.screenshot({
        path: join(CAPTURAS, `${prefijo}-08-asistente-rechaza-personas.png`),
      });
    } finally {
      await context.close();
    }
  });
}

const ESTADOS = ['vacio', 'error', 'sin-permiso', 'atrasado'] as const;
/** Nombre en inglés para el archivo de la captura (regla 29); la clave del mock sigue siendo la del estado. */
const STATE_FILE: Record<(typeof ESTADOS)[number], string> = {
  vacio: 'empty',
  error: 'error',
  'sin-permiso': 'forbidden',
  atrasado: 'stale',
};
for (const viewState of ESTADOS) {
  for (const vp of VIEWPORTS) {
    for (const tema of TEMAS) {
      test(`estado ${viewState} · ${vp.nombre} · ${tema.nombre}`, async ({ browser }) => {
        const { context, page } = await newSession(
          browser,
          vp.ancho,
          vp.alto,
          tema.valor,
          viewState,
        );
        let pantalla = 'login';
        vigilar(page, () => `estado-${viewState}-${vp.nombre}-${tema.nombre}-${pantalla}`);
        try {
          await signInAsAdmin(page);
          await page.getByTestId('portal-reporteria').click();
          pantalla = 'grid';
          await page.waitForTimeout(1500);
          await capturar(page, `${vp.nombre}-${tema.nombre}-state-${STATE_FILE[viewState]}-grid`);
          pantalla = 'dashboard';
          await page.goto(`${REPORTS}/commercial/suscripciones`);
          await page.waitForTimeout(1800);
          await capturar(
            page,
            `${vp.nombre}-${tema.nombre}-state-${STATE_FILE[viewState]}-dashboard`,
          );
        } finally {
          await context.close();
        }
      });
    }
  }
}

test('teclado · foco visible y Escape que no cierra de más · escritorio · claro', async ({
  browser,
}) => {
  const { context, page } = await newSession(browser, 1440, 900, 'light');
  let pantalla = 'login';
  vigilar(page, () => `teclado-${pantalla}`);
  try {
    await signInAsAdmin(page);
    await page.getByTestId('portal-reporteria').click();
    await page.goto(`${REPORTS}/commercial/suscripciones`);
    await esperarGraficos(page);

    // El asistente abre con el foco en el campo de la pregunta, con indicador visible.
    pantalla = 'asistente';
    await page.getByTestId('reporting-asistente-boton').click();
    const entrada = page.getByTestId('reporting-asistente').getByRole('textbox');
    await expect(entrada).toBeFocused();
    await capturar(page, 'escritorio-claro-teclado-01-focus-in-assistant');

    // El menú «Más» se opera con teclado: Enter lo abre y el foco entra en la primera opción.
    pantalla = 'menu-mas';
    const panel = page.locator('app-chart-panel').first();
    await panel.scrollIntoViewIfNeeded();
    await panel.getByTestId('chart-more').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Ver en grande' })).toBeFocused();
    await page.screenshot({ path: join(CAPTURAS, 'escritorio-claro-teclado-02-menu-mas.png') });

    // Tab dentro del menú lo cierra y deja el foco en «Más» (no en el body).
    await page.keyboard.press('Tab');
    await expect(page.getByRole('menu')).toHaveCount(0);
    await expect(panel.getByTestId('chart-more')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('menuitem', { name: 'Ver en grande' })).toBeFocused();

    // «Ver en grande» y Escape: se cierra el diálogo, NO el asistente, y el foco vuelve al botón «Más».
    pantalla = 'escape';
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('content-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('content-dialog')).toBeHidden();
    await expect(page.getByTestId('reporting-asistente')).toBeVisible();
    await expect(panel.getByTestId('chart-more')).toBeFocused();
    await page.screenshot({
      path: join(CAPTURAS, 'escritorio-claro-teclado-03-escape-keeps-assistant.png'),
    });
  } finally {
    await context.close();
  }
});

test('asistente como hoja superpuesta · móvil · claro: el fondo queda inerte', async ({
  browser,
}) => {
  const { context, page } = await newSession(browser, 390, 844, 'light');
  let pantalla = 'login';
  vigilar(page, () => `asistente-movil-${pantalla}`);
  try {
    await signInAsAdmin(page);
    await page.getByTestId('portal-reporteria').click();
    await page.goto(`${REPORTS}/commercial/suscripciones`);
    await esperarGraficos(page);
    pantalla = 'asistente';
    await page.getByTestId('reporting-asistente-boton').click();
    await expect(page.getByTestId('reporting-asistente')).toBeVisible();
    await expect(page.locator('main')).toHaveAttribute('inert', '');
    await expect(page.locator('nav#reporting-nav')).toHaveAttribute('inert', '');
    await expect(page.locator('.rep__cabecera [inert]').first()).toBeAttached();
    // Ida y vuelta con Tab y Shift+Tab: el foco solo puede estar en la hoja o fuera de la página, nunca en un
    // control escondido detrás de ella (cabecera, navegación, contenido).
    const focusInSheetOrOutside = (): Promise<{ dentro: boolean; quien: string }> =>
      page.evaluate(() => {
        const activo = document.activeElement;
        const dentro =
          activo === null ||
          activo === document.body ||
          activo.closest('#reporting-asistente') !== null ||
          // El aviso «Datos de prueba» es de la maqueta, no del portal: queda fuera de la hoja a propósito.
          activo.closest('app-mock-banner') !== null;
        const quien = `<${activo?.tagName.toLowerCase()}> «${(activo?.textContent ?? '').trim().slice(0, 40)}»`;
        return { dentro, quien };
      });
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Shift+Tab');
      const f = await focusInSheetOrOutside();
      expect(f.dentro, `Shift+Tab #${i + 1} → ${f.quien}`).toBe(true);
    }
    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press('Tab');
      const f = await focusInSheetOrOutside();
      expect(f.dentro, `Tab #${i + 1} → ${f.quien}`).toBe(true);
    }
    await capturar(page, 'movil-claro-interaccion-asistente-abierto');
  } finally {
    await context.close();
  }
});

test('autorización negativa · una cuenta sin reportería no entra al portal', async ({
  browser,
}) => {
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
    // Una captura en blanco no prueba nada: se espera a que la pantalla a la que lo mandaron esté pintada.
    await expect(page.locator('main').first()).toBeVisible();
    await capturar(page, 'negative-patient-tries-reports');
    await page.goto('/portal-selector');
    await expect(page).not.toHaveURL(/\/portal-selector/);
    await expect(page.getByTestId('portal-reporteria')).toHaveCount(0);
    await expect(page.locator('main').first()).toBeVisible();
    await capturar(page, 'negative-patient-tries-selector');
  } finally {
    await context.close();
  }
});

const ejecutadas: string[] = [];

// Playwright exige el patrón de desestructuración aunque no se pida ninguna fixture (pedir `page` abriría otra página).
// eslint-disable-next-line no-empty-pattern
test.afterEach(({}, info) => {
  ejecutadas.push(`${info.title} → ${info.status}`);
});

test.afterAll(() => {
  // Con metadatos: un `[]` pelado no distingue «consola y red limpias» de «no se recolectó», y una corrida
  // parcial (`-g`) no debe poder hacerse pasar por la completa.
  const informe = {
    generadoEn: new Date().toISOString(),
    pruebasEjecutadas: ejecutadas,
    nota: 'Solo se recolectan los hallazgos de las pruebas listadas. Los de los estados error y sin-permiso son errores forzados a propósito.',
    hallazgos,
  };
  writeFileSync(join(EVIDENCIA, 'consola-red.json'), JSON.stringify(informe, null, 2), 'utf-8');
});
