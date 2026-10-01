import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:4302';
const OUT = process.env.PUBLIC_SIGNUP_OUT || 'docs/work/Plan_Paciente_Laboratorio_2026-09-23_bb8a5f72a192/evidence/public-signups-after';
const ROUTES = [
  ['/auth/register', 'Crear cuenta', 'register-account-type'],
  ['/auth/register/patient', 'Crear cuenta de paciente', 'register-patient'],
  ['/auth/register/practitioner', 'Crear cuenta de profesional', 'register-practitioner'],
  ['/auth/register/organization', 'Registrá tu aseguradora', 'register-organization'],
  ['/auth/register/laboratory', 'Registrá tu laboratorio', 'register-laboratory'],
  ['/auth/register/imaging-center', 'Registrá tu centro de imagenología', 'register-imaging-center'],
];
const VIEWPORTS = [
  ['375-claro', 375, 812, 'light'],
  ['768-claro', 768, 1024, 'light'],
  ['1440-claro', 1440, 900, 'light'],
  ['1440-oscuro', 1440, 900, 'dark'],
];
const LAYERS = ['.auth-split__stage', '.auth-split__aurora', '.auth-split__brand'];

mkdirSync(join(OUT, 'fotos'), { recursive: true });
const browser = await chromium.launch({ headless: true });
const rows = [];

for (const [viewport, width, height, colorScheme] of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme,
    locale: 'es-BO',
    timezoneId: 'America/La_Paz',
  });
  for (const [route, expectedHeading, slug] of ROUTES) {
    const page = await context.newPage();
    const errors = [];
    const cspWarnings = [];
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      const detail = message.text();
      if (detail.includes('violates the following Content Security Policy directive')) {
        cspWarnings.push(detail);
      } else if (!detail.includes('socket.io')) {
        errors.push('console: ' + detail);
      }
    });
    page.on('response', (response) => {
      if (response.status() >= 500) errors.push('http ' + response.status() + ': ' + response.url());
    });

    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    const heading = page.getByRole('heading', { level: 1, name: expectedHeading, exact: true });
    await heading.waitFor({ state: 'visible', timeout: 20_000 });
    await page.waitForTimeout(250);
    const actualPath = new URL(page.url()).pathname;
    const file = join(OUT, 'fotos', slug + '-' + viewport + '.png');
    await page.screenshot({ path: file, fullPage: true });

    const metrics = await page.evaluate((layerSelectors) => {
      const scene = document.querySelector('.auth-split');
      const area = document.querySelector('.auth-split__content');
      const content = document.querySelector('.registro-conjunto, .registro, .tipos');
      if (!scene || !area || !content) throw new Error('Falta el área de alta pública.');
      const sceneRect = scene.getBoundingClientRect();
      const areaRect = area.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const visibleArtwork = layerSelectors.filter((selector) =>
        Array.from(scene.querySelectorAll(selector)).some(
          (element) => getComputedStyle(element).display !== 'none',
        ),
      );
      const sceneStyle = getComputedStyle(scene);
      return {
        h1: document.querySelector('h1')?.textContent?.trim() || '',
        theme: document.documentElement.getAttribute('data-tema') || '',
        sceneWidth: sceneRect.width,
        areaWidth: areaRect.width,
        contentWidth: contentRect.width,
        leftGap: contentRect.left - areaRect.left,
        rightGap: areaRect.right - contentRect.right,
        background: sceneStyle.backgroundColor,
        backgroundImage: sceneStyle.backgroundImage,
        visibleArtwork,
        documentWidth: document.documentElement.scrollWidth,
        viewportWidth: innerWidth,
      };
    }, LAYERS);

    rows.push({
      route, expectedHeading, actualHeading: metrics.h1, actualPath, viewport,
      colorScheme, ...metrics, errors, cspWarningCount: cspWarnings.length,
      cspWarningExample: cspWarnings[0] || '', screenshot: file,
    });
    await page.close();
  }
  await context.close();
}
await browser.close();

const totals = {
  captures: rows.length,
  routes: ROUTES.length,
  viewportModes: VIEWPORTS.length,
  unexpectedRoutes: rows.filter((row) => row.actualPath !== row.route).length,
  wrongHeadings: rows.filter((row) => row.actualHeading !== row.expectedHeading).length,
  lightBackgroundFailures: rows.filter((row) => row.colorScheme === 'light' &&
    (row.background !== 'rgb(255, 255, 255)' || row.backgroundImage !== 'none' || row.visibleArtwork.length > 0)).length,
  lightWidthFailures: rows.filter((row) => row.colorScheme === 'light' &&
    row.contentWidth / row.areaWidth < 0.85).length,
  uncentered: rows.filter((row) => Math.abs(row.leftGap - row.rightGap) > 2).length,
  horizontalOverflow: rows.filter((row) => row.documentWidth > row.viewportWidth + 1).length,
  unexpectedConsoleOrServerErrors: rows.filter((row) => row.errors.length > 0).length,
  cspWarningCells: rows.filter((row) => row.cspWarningCount > 0).length,
  cspWarningEvents: rows.reduce((sum, row) => sum + row.cspWarningCount, 0),
};
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ base: BASE, routes: ROUTES, viewports: VIEWPORTS, totals, captures: rows }, null, 2) + '\n');

const cell = (row) => {
  const routeHeading = row.actualPath === row.route && row.actualHeading === row.expectedHeading ? 'PASS' : 'FAIL';
  const centered = Math.abs(row.leftGap - row.rightGap) <= 2 ? 'PASS' : 'FAIL';
  const white = row.background === 'rgb(255, 255, 255)' && row.backgroundImage === 'none' && row.visibleArtwork.length === 0;
  const background = row.colorScheme === 'dark' ? '—' : white ? 'PASS' : 'FAIL';
  const width = row.colorScheme === 'dark' ? '—' :
    row.areaWidth > 0 && row.contentWidth / row.areaWidth >= 0.85 ? 'PASS' :
      'FAIL (' + Math.round(row.contentWidth / row.areaWidth * 100) + '%)';
  const overflow = row.documentWidth <= row.viewportWidth + 1 ? 'PASS' : 'FAIL';
  const consoleStatus = row.errors.length ? 'FAIL' : row.cspWarningCount ? 'CSP base (' + row.cspWarningCount + ')' : 'PASS';
  return '| ' + row.route + ' | ' + row.viewport + ' | ' + routeHeading + ' | ' + background + ' | ' + centered + ' | ' + width + ' | ' + overflow + ' | ' + consoleStatus + ' | [foto](fotos/' + row.screenshot.split('/').at(-1) + ') |';
};
const table = [
  '# Auditoría visual de altas públicas — CORR-34 — después',
  '',
  'Captura sin sesión ni envío de formularios. Las seis rutas salen de src/app/app.routes.ts. Para estas vistas autónomas, el área medida es .auth-split__content y el contenido ruteado; no existe .app-main__inner.',
  'La superficie blanca se mide en modo claro; en oscuro se comprueba que la escena existente siga presente. El criterio de ancho ≥85% se aplica en claro y se declara como n/a en oscuro para no alterar la composición anterior.',
  '',
  'Capturas: ' + totals.captures + '; rutas: ' + totals.routes + '; combinaciones: ' + totals.viewportModes + '. Errores: ruta=' + totals.unexpectedRoutes + ', H1=' + totals.wrongHeadings + ', fondo=' + totals.lightBackgroundFailures + ', ancho=' + totals.lightWidthFailures + ', centrado=' + totals.uncentered + ', scroll=' + totals.horizontalOverflow + ', consola/5xx inesperados=' + totals.unexpectedConsoleOrServerErrors + '. Avisos CSP conocidos: ' + totals.cspWarningEvents + ' en ' + totals.cspWarningCells + ' celdas.',
  '',
  '| Ruta | Viewport/tema | Ruta y H1 | Fondo claro | Centrado ≤2 px | Ancho claro ≥85% | Sin scroll H | Consola/5xx | Captura |',
  '|---|---|---|---|---|---|---|---|---|',
  ...rows.map(cell),
  '',
  'Los avisos CSP script-src se guardan en results.json por celda. La misma advertencia estaba presente en evidencias anteriores de otras rutas y ramas; este cambio no modifica la política CSP.',
].join('\n');
writeFileSync(join(OUT, 'MATRIZ-public-signups.md'), table + '\n');
console.log(JSON.stringify(totals, null, 2));
if (totals.unexpectedRoutes || totals.wrongHeadings || totals.lightBackgroundFailures ||
    totals.lightWidthFailures || totals.uncentered || totals.horizontalOverflow ||
    totals.unexpectedConsoleOrServerErrors) process.exitCode = 1;
