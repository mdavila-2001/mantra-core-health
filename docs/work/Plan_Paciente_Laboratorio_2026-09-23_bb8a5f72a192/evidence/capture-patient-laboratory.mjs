import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from '@playwright/test';

const BASE = 'http://127.0.0.1:4200';
const OUT = 'docs/work/Plan_Paciente_Laboratorio_2026-09-23_bb8a5f72a192/evidence/visual';
function uuid(seed) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i += 1) {
    const char = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ char, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ char, 0x811c9dc5) >>> 0;
  }
  const hex = (value) => value.toString(16).padStart(8, '0');
  const raw = `${hex(h1)}${hex(h2)}${hex((h1 * 31 + h2) >>> 0)}${hex((h2 * 17 + h1) >>> 0)}`;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-a${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
}
const ROUTES = [
  ['/laboratory-directory', 'Directorio de laboratorios', 'H1-directorio'],
  [`/laboratory-directory/${uuid('unit-lab-central')}`, 'Laboratorio Central', 'H1-ficha-laboratorio'],
  ['/my-account/appointments', 'Mis citas', 'H2-citas'],
  ['/my-account/diagnostic-orders', 'Mis órdenes', 'H1-ordenes'],
  ['/my-account/diagnostic-results', 'Mis resultados', 'H4-resultados'],
  ['/my-account/loyalty', 'Mis puntos', 'H5-puntos'],
  ['/my-account/promotions', 'Promociones', 'H5-promociones'],
];
const VIEWPORTS = [
  ['375', 375, 812, 'light'],
  ['768', 768, 1024, 'light'],
  ['1440', 1440, 900, 'light'],
  ['1440-oscuro', 1440, 900, 'dark'],
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true });
const rows = [];
const supplemental = [];

for (const [viewportName, width, height, colorScheme] of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme,
    locale: 'es-BO',
    timezoneId: 'America/La_Paz',
  });
  const loginPage = await context.newPage();
  await loginPage.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded' });
  await loginPage.getByTestId('login-identifier').fill('paciente@alovida.mock');
  await loginPage.getByTestId('login-password').fill('cualquiera');
  await loginPage.getByTestId('login-submit').click();
  await loginPage.waitForURL((url) => !url.pathname.startsWith('/auth'));

  for (const [route, expectedHeading, name] of ROUTES) {
    // Mount a fresh shell for each route. Reusing the same shell preserves
    // menu-animation state across `goto()` and can put a stale drawer over the
    // next screenshot even after its width stops changing.
    const page = await context.newPage();
    let errors = 0;
    const onConsole = (message) => {
      if (message.type() === 'error' && !message.text().includes('socket.io')) errors += 1;
    };
    const onResponse = (response) => {
      if (response.status() >= 500) errors += 1;
    };
    page.on('console', onConsole);
    page.on('response', onResponse);
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { level: 1, name: expectedHeading, exact: true }).waitFor({
      state: 'visible',
      timeout: 15_000,
    });
    await page.waitForFunction(() => {
      const area = document.querySelector('.app-main__inner');
      return area !== null && area.innerText.trim().length > 0;
    });
    // The shell animates its navigation width when an authenticated route
    // mounts. Waiting for the route heading alone can capture the content
    // underneath the still-moving side navigation.
    await page.waitForTimeout(700);
    await page.evaluate(async () => {
      const sample = () => {
        const nav = document.querySelector('.app-side-nav')?.getBoundingClientRect();
        const area = document.querySelector('.app-main__inner')?.getBoundingClientRect();
        return [nav?.left, nav?.right, nav?.width, area?.left, area?.right, area?.width]
          .map((value) => Math.round(value ?? -1))
          .join(':');
      };
      let previous = '';
      let stableFrames = 0;
      while (stableFrames < 6) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const current = sample();
        stableFrames = current === previous ? stableFrames + 1 : 0;
        previous = current;
      }
    });
    const actualPath = new URL(page.url()).pathname;
    const file = join(OUT, `${name}-${viewportName}.png`);
    // Keep fixed navigation in its real viewport position. A full-page
    // screenshot stretches the document while the shell navigation stays
    // fixed, making it cover part of otherwise correctly laid out content.
    await page.screenshot({ path: file });
    const metrics = await page.evaluate(() => {
      const area = document.querySelector('.app-main__inner');
      const nav = document.querySelector('.app-side-nav');
      const body = getComputedStyle(document.body);
      const rect = area.getBoundingClientRect();
      const navRect = nav?.getBoundingClientRect();
      const cards = [...area.querySelectorAll('app-card')].filter((card) => card.getBoundingClientRect().width > 0);
      const root = cards.length ? cards : [...area.children].filter((child) => child.getBoundingClientRect().width > 0);
      const boxes = root.map((element) => element.getBoundingClientRect());
      const left = boxes.length ? Math.min(...boxes.map((box) => box.left)) : rect.left;
      const right = boxes.length ? Math.max(...boxes.map((box) => box.right)) : rect.left;
      return {
        background: body.backgroundColor,
        backgroundImage: body.backgroundImage !== 'none',
        leftGap: left - rect.left,
        rightGap: rect.right - right,
        contentWidth: right - left,
        areaWidth: rect.width,
        navigationOverlapPx: navRect
          ? Math.max(0, Math.min(navRect.right, rect.right) - Math.max(navRect.left, rect.left))
          : 0,
        horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        h1: document.querySelector('h1')?.textContent?.trim() ?? '',
      };
    });
    page.off('console', onConsole);
    page.off('response', onResponse);
    rows.push({
      route,
      viewport: viewportName,
      expectedHeading,
      actualHeading: metrics.h1,
      actualPath,
      background: metrics.background,
      backgroundImage: metrics.backgroundImage,
      centered: Math.abs(metrics.leftGap - metrics.rightGap) <= 2,
      widthRatio: metrics.areaWidth > 0 ? metrics.contentWidth / metrics.areaWidth : 0,
      horizontalOverflow: metrics.horizontalOverflow,
      navigationOverlapPx: metrics.navigationOverlapPx,
      errors,
      screenshot: file,
    });

    if (viewportName !== '1440-oscuro') {
      const extra = route.startsWith('/laboratory-directory/')
        ? { heading: 'Estudios y servicios', suffix: 'servicios' }
        : route === '/my-account/appointments'
          ? { heading: 'Agendar una cita', suffix: 'reserva' }
          : undefined;
      if (extra) {
        const target = page.getByRole('heading', { level: 2, name: extra.heading, exact: true });
        await target.scrollIntoViewIfNeeded();
        await page.waitForTimeout(150);
        const supplementalFile = join(OUT, `${name}-${extra.suffix}-${viewportName}.png`);
        await page.screenshot({ path: supplementalFile });
        supplemental.push({ route, viewport: viewportName, heading: extra.heading, screenshot: supplementalFile });
      }
      if (route === '/my-account/appointments') {
        const laboratoryMode = page.getByTestId('turnos-tipo-laboratorio');
        await laboratoryMode.click();
        await page.waitForFunction(() =>
          document.querySelector('[data-testid="turnos-tipo-laboratorio"]')?.getAttribute('aria-pressed') === 'true' &&
            document.querySelector('[data-testid="turnos-tipo-laboratorio"]')?.classList.contains('btn--primary') === true &&
            document.querySelector('[data-testid="turnos-tipo-profesional"]')?.classList.contains('btn--ghost') === true,
        );
        await page.getByText('Sin horarios para mostrar', { exact: true }).waitFor({ state: 'visible' });
        await page.mouse.move(width - 2, height - 2);
        await page.waitForTimeout(450);
        const supplementalFile = join(OUT, `H2-citas-laboratorio-${viewportName}.png`);
        await page.screenshot({ path: supplementalFile });
        supplemental.push({ route, viewport: viewportName, heading: 'En un laboratorio · sin horarios', screenshot: supplementalFile });
      }
    }
    await page.close();
  }
  await context.close();
}

await browser.close();
writeFileSync(join(OUT, 'results.json'), JSON.stringify({ captures: rows, supplemental }, null, 2) + '\n');
const table = [
  '# Evidencia visual — Paciente en el circuito de Laboratorio',
  '',
  'Capturada con Playwright y sesión de paciente simulada. La ruta y el encabezado esperado se comprueban antes de cada captura.',
  'Se capturaron 21 fotos claras y 7 fotos oscuras. Las oscuras se registran como comprobación informativa del modo preservado por TAREA-34 §3; el criterio de fondo blanco se mide en claro.',
  '',
  '| Hito | Ruta | Viewport | Encabezado/ruta | Fondo claro | Centrado | Ancho ≥85% | Sin scroll | Errores | Foto |',
  '|---|---|---|---|---|---|---:|---|---:|---|',
  ...rows.map((row) => {
    const routeName = ROUTES.find(([route]) => route === row.route)?.[2] ?? 'ruta';
    const expectedPath = row.actualPath === row.route;
    const expectedTitle = row.actualHeading === row.expectedHeading;
    const background = row.viewport === '1440-oscuro'
      ? 'n/a'
      : row.background === 'rgb(255, 255, 255)' && !row.backgroundImage ? 'PASS' : `FAIL (${row.background})`;
    const centered = row.centered ? 'PASS' : 'FAIL';
    const width = row.widthRatio >= 0.85 ? `PASS (${Math.round(row.widthRatio * 100)}%)` : `FAIL (${Math.round(row.widthRatio * 100)}%)`;
    const scroll = row.horizontalOverflow ? 'FAIL' : 'PASS';
    const navigation = row.navigationOverlapPx <= 1;
    const location = expectedPath && expectedTitle && navigation
      ? 'PASS'
      : `FAIL (${row.actualPath}: ${row.actualHeading}, overlap ${row.navigationOverlapPx}px)`;
    const screenshot = row.screenshot.replaceAll('\\', '/');
    return `| ${routeName} | \`${row.route}\` | ${row.viewport} | ${location} | ${background} | ${centered} | ${width} | ${scroll} | ${row.errors} | \`${screenshot}\` |`;
  }),
  '',
  '## Capturas complementarias desplazadas',
  '',
  '| Ruta | Viewport | Sección | Foto |',
  '|---|---|---|---|',
  ...supplemental.map((row) => `| \`${row.route}\` | ${row.viewport} | ${row.heading} | \`${row.screenshot.replaceAll('\\', '/')}\` |`),
  '',
];
writeFileSync(join(OUT, 'MATRIX.md'), table.join('\n'));
console.log(`Capturas principales: ${rows.length}; complementarias: ${supplemental.length}. Resultado: ${join(OUT, 'MATRIX.md')}`);
