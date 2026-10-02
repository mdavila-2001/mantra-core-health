import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const BASE = process.env.E2E_BASE_URL || 'http://127.0.0.1:4300';
const OUT = process.env.PUBLIC_SIGNUP_OUT || 'docs/work/Plan_Paciente_Laboratorio_2026-09-23_bb8a5f72a192/evidence/public-signups';
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
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().includes('socket.io')) {
        errors.push('console: ' + message.text());
      }
    });
    page.on('response', (response) => {
      if (response.status() >= 500) errors.push('http ' + response.status() + ': ' + response.url());
    });
    await page.goto(BASE + route, { waitUntil: 'domcontentloaded' });
    const heading = page.getByRole('heading', { level: 1, name: expectedHeading, exact: true });
    await heading.waitFor({ state: 'visible', timeout: 20_000 });
    await page.waitForTimeout(300);
    const actualPath = new URL(page.url()).pathname;
    const file = join(OUT, 'fotos', slug + '-' + viewport + '.png');
    await page.screenshot({ path: file, fullPage: true });
    const metrics = await page.evaluate(() => {
      const scene = document.querySelector('.auth-split');
      const panel = document.querySelector('.auth-split__panel');
      const content = document.querySelector('.registro, .tipos');
      const sceneRect = scene?.getBoundingClientRect();
      const panelRect = panel?.getBoundingClientRect();
      const contentRect = content?.getBoundingClientRect();
      const panelStyle = panel ? getComputedStyle(panel) : null;
      const sceneStyle = scene ? getComputedStyle(scene) : null;
      return {
        h1: document.querySelector('h1')?.textContent?.trim() || '',
        viewportWidth: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        pageBackground: sceneStyle?.backgroundColor || '',
        pageBackgroundImage: sceneStyle?.backgroundImage || '',
        panelBackground: panelStyle?.backgroundColor || '',
        sceneWidth: sceneRect?.width || 0,
        panelWidth: panelRect?.width || 0,
        contentWidth: contentRect?.width || 0,
        contentLeftGap: panelRect && contentRect ? contentRect.left - panelRect.left : null,
        contentRightGap: panelRect && contentRect ? panelRect.right - contentRect.right : null,
      };
    });
    rows.push({
      route, expectedHeading, actualHeading: metrics.h1, actualPath, viewport,
      colorScheme, ...metrics, errors, screenshot: file,
    });
    await page.close();
  }
  await context.close();
}
await browser.close();

const totals = {
  captures: rows.length,
  routeCount: ROUTES.length,
  viewportModes: VIEWPORTS.length,
  unexpectedRoutes: rows.filter((row) => row.actualPath !== row.route).length,
  wrongHeadings: rows.filter((row) => row.actualHeading !== row.expectedHeading).length,
  horizontalOverflow: rows.filter((row) => row.documentWidth > row.viewportWidth + 1).length,
  consoleOrServerErrors: rows.filter((row) => row.errors.length > 0).length,
};
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ base: BASE, routes: ROUTES, viewports: VIEWPORTS, totals, captures: rows }, null, 2) + '\n');

const cell = (row) => {
  const gap = row.contentLeftGap !== null && Math.abs(row.contentLeftGap - row.contentRightGap) <= 2 ? 'PASS' : 'FAIL';
  const width = row.panelWidth > 0 && row.contentWidth / row.panelWidth >= 0.85
    ? 'PASS (' + Math.round(row.contentWidth / row.panelWidth * 100) + '%)'
    : 'FAIL (' + (row.panelWidth ? Math.round(row.contentWidth / row.panelWidth * 100) : 0) + '%)';
  const overflow = row.documentWidth <= row.viewportWidth + 1 ? 'PASS' : 'FAIL (' + row.documentWidth + 'px)';
  const routeHeading = row.actualPath === row.route && row.actualHeading === row.expectedHeading ? 'PASS' : 'FAIL';
  return '| ' + row.route + ' | ' + row.viewport + ' | ' + routeHeading + ' | ' + gap + ' | ' + width + ' | ' + overflow + ' | ' + (row.errors.length ? 'FAIL' : 'PASS') + ' | [foto](fotos/' + row.screenshot.split('/').at(-1) + ') |';
};
const table = [
  '# Auditoría visual de altas públicas — CORR-34',
  '',
  'Captura sin sesión autenticada. Las rutas se tomaron de src/app/app.routes.ts en el HEAD auditado; no se enviaron formularios.',
  'Las pantallas de alta usan el organismo app-auth-split y no montan .app-main__inner. Por eso centrado y ancho se miden contra .auth-split__panel, y el fondo registra tanto el color base como la imagen decorativa.',
  '',
  'Capturas: ' + totals.captures + '; rutas: ' + totals.routeCount + '; combinaciones viewport/tema: ' + totals.viewportModes + '. Ruta inesperada: ' + totals.unexpectedRoutes + '; H1 inesperado: ' + totals.wrongHeadings + '; overflow horizontal: ' + totals.horizontalOverflow + '; capturas con error de consola/5xx: ' + totals.consoleOrServerErrors + '.',
  '',
  '| Ruta | Viewport/tema | Ruta y H1 | Centrado ≤2 px | Ancho ≥85% del panel | Sin scroll H | Consola/5xx | Captura |',
  '|---|---|---|---|---|---|---|---|',
  ...rows.map(cell),
  '',
  'La Ficha TAREA-34 exige fondo blanco en modo claro. Las altas públicas usan la escena visual propia de autenticación (app-auth-split); el informe separa el color de base de la imagen decorativa para no marcar el fondo como blanco por medir únicamente body.',
].join('\n');
writeFileSync(join(OUT, 'MATRIZ-public-signups.md'), table + '\n');
console.log(JSON.stringify(totals, null, 2));
if (totals.unexpectedRoutes || totals.wrongHeadings || totals.horizontalOverflow || totals.consoleOrServerErrors) process.exitCode = 1;
