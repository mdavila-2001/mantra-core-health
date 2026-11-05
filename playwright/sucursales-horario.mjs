/**
 * Browser evidence (05/11/2026): "Horario y turnos" merged into pharmacy
 * "Sucursales" as a tab, with per-branch and all-branches editing.
 *
 * Usage: `BASE=http://localhost:4313 node playwright/sucursales-horario.mjs`
 * against `ng serve --configuration development,demo`. Screenshots in
 * `evidencias/sucursales-horario-2026-11-05/`.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.env['BASE'] ?? 'http://localhost:4200';
const OUT = 'evidencias/sucursales-horario-2026-11-05';
mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

const browser = await chromium.launch(
  process.env['CHROMIUM'] ? { executablePath: process.env['CHROMIUM'] } : {},
);
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1500 } });
const page = await ctx.newPage();
const errors = [];
const badResponses = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('response', (r) => r.status() >= 500 && badResponses.push(`${r.status()} ${r.url()}`));

await page.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
await page.getByTestId('login-identifier').fill('farmacia@alovida.mock');
await page.getByTestId('login-password').fill('mockup');
await page.getByTestId('login-password').press('Enter');
await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60_000 });
await page.locator('#app-side-nav').waitFor({ timeout: 60_000 });

const menu = await page
  .locator('#app-side-nav [data-testid="nav-enlace"]')
  .evaluateAll((as) => as.map((a) => a.getAttribute('href')));
check(
  'menu has no "Horario y turnos" entry',
  !menu.includes('/administration/pharmacy-hours'),
  menu.join(', '),
);
check('menu keeps "Sucursales"', menu.includes('/administration/pharmacy-branches'));

// Old route redirects to the tab.
await page.goto(`${BASE}/administration/pharmacy-hours`, { waitUntil: 'domcontentloaded' });
await page.waitForURL(/pharmacy-branches\?tab=horario/, { timeout: 60_000 });
check(
  'old route redirects to ?tab=horario',
  page.url().includes('pharmacy-branches?tab=horario'),
  page.url(),
);
const hours = page.getByTestId('horario-card');
await hours.waitFor({ timeout: 60_000 });
await page.getByRole('tab', { name: 'Todas las sucursales' }).waitFor({ timeout: 60_000 });
check('bulk tab present', true);
await page.screenshot({ path: `${OUT}/01-horario-todas-1440.png` });

// Bulk: 24 h for every checked branch.
const sites = await page.locator('[data-testid="todas-sedes"] li').count();
await page.getByTestId('todas-24h').click();
await page.getByRole('option', { name: 'Sí, abre las 24 horas' }).click();
await page.getByTestId('todas-aplicar-24h').click();
await page.getByTestId('todas-ok').waitFor({ timeout: 30_000 });
check(
  'bulk 24h saved in all checked branches',
  (await page.getByTestId('todas-ok').textContent()).includes(String(sites)),
  `${sites} sites`,
);
await page.screenshot({ path: `${OUT}/02-horario-todas-24h-guardado-1440.png` });

// Re-fetch from the store: leaving the tab unmounts it, coming back issues a
// new GET (the simulator keeps hours in memory, so a full page reload resets it).
await page.getByRole('tab', { name: 'Sucursales', exact: true }).click();
await page.getByTestId('branches-table').waitFor({ timeout: 30_000 });
// The simulator is an in-app HTTP interceptor: the remount re-runs the GET
// through it, so the per-branch tab below reads what the store holds.
await page.getByRole('tab', { name: 'Horario y turnos' }).click();
await page.getByRole('tab', { name: 'Todas las sucursales' }).waitFor({ timeout: 60_000 });
await page.getByRole('tab', { name: 'Sucursal Equipetrol' }).click();
const selectText = await page
  .getByTestId('horario-24h')
  .locator('visible=true')
  .first()
  .textContent();
check(
  'after remount, per-branch tab shows 24h declared',
  selectText.includes('Sí, abre las 24 horas'),
  selectText.trim(),
);
await page.screenshot({ path: `${OUT}/03-horario-por-sucursal-1440.png` });

// Bulk shift: same shift on all branches.
const d = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
const d2 = new Date(Date.now() + 4 * 86_400_000).toISOString().slice(0, 10);
await page.getByRole('tab', { name: 'Todas las sucursales' }).click();
await page.getByTestId('todas-desde-fecha').fill(d);
await page.getByTestId('todas-desde-hora').fill('20:00');
await page.getByTestId('todas-hasta-fecha').fill(d2);
await page.getByTestId('todas-hasta-hora').fill('08:00');
await page.getByTestId('todas-cargar-turno').click();
await page.getByTestId('todas-ok').waitFor({ timeout: 30_000 });
check('bulk shift saved in all branches', true);
// Same shift again: every branch reports the overlap (409), nothing is hidden.
await page.getByTestId('todas-desde-fecha').fill(d);
await page.getByTestId('todas-desde-hora').fill('20:00');
await page.getByTestId('todas-hasta-fecha').fill(d2);
await page.getByTestId('todas-hasta-hora').fill('08:00');
await page.getByTestId('todas-cargar-turno').click();
await page.getByTestId('todas-fallidas').waitFor({ timeout: 30_000 });
const failText = await page.getByTestId('todas-fallidas').textContent();
check(
  'repeated bulk shift reports the overlap per branch',
  failText.includes('Sucursal Equipetrol') && failText.includes('turno activo'),
  failText.trim().slice(0, 120),
);
await page.screenshot({ path: `${OUT}/03b-horario-todas-solape-1440.png` });
await page.getByRole('tab', { name: 'Sucursal Plan 3000' }).click();
const planText = await page
  .getByTestId('horario-turnos')
  .locator('visible=true')
  .first()
  .textContent();
check(
  'per-branch tab lists the bulk-created shift',
  planText.includes('→'),
  planText.trim().slice(0, 80),
);

// Branches tab still works.
await page.getByRole('tab', { name: 'Sucursales', exact: true }).click();
await page
  .getByTestId('branches-table')
  .getByText('Sucursal Central')
  .first()
  .waitFor({ timeout: 30_000 });
check('branches tab renders the table', true, page.url());
await page.screenshot({ path: `${OUT}/04-sucursales-1440.png` });

for (const [w, h] of [
  [390, 844],
  [820, 1180],
]) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(`${BASE}/administration/pharmacy-branches?tab=horario`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByTestId('todas-sedes').waitFor({ timeout: 60_000 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  check(`no horizontal scroll at ${w}px`, !overflow);
  await page.screenshot({ path: `${OUT}/05-horario-todas-${w}.png`, fullPage: true });
}

// The deliberate overlap test logs its three 409s: expected, not a defect.
const unexpected = errors.filter(
  (e) => !(e.includes('on-call-shifts → 409') && e.includes('turno activo')),
);
check(
  'no unexpected page/console errors',
  unexpected.length === 0,
  unexpected.slice(0, 3).join(' | '),
);
check('no 5xx responses', badResponses.length === 0, badResponses.join(', '));
await browser.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} OK`);
process.exit(failed ? 1 : 0);
