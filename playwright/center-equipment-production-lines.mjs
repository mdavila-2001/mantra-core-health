/**
 * «Horarios y equipos» of a diagnostic center with each device as a
 * production line (owner request, 04/11/2026): the center registers a device
 * from the type catalog, gives it its own hours, and sees the day of each
 * device. Proves each mutation UI → request → response → reload → UI, and
 * captures the three tabs at 1440 and 390 px.
 *
 * Usage: `BASE=http://localhost:4300 OUT=evidencias/center-equipment-2026-11-05 node playwright/center-equipment-production-lines.mjs`
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const B = process.env.BASE ?? 'http://localhost:4300';
const OUT = process.env.OUT ?? 'artifacts/center-equipment';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const log = [];
const note = (line) => {
  log.push(line);
  console.log(line);
};
const failures = [];
const check = (ok, what) => {
  note(`${ok ? 'PASS' : 'FAIL'} · ${what}`);
  if (!ok) failures.push(what);
};

async function signIn(page) {
  await page.goto(`${B}/auth`, { waitUntil: 'commit', timeout: 180000 });
  const target = /\/(dashboard|auth\/organization|laboratory|administration)/;
  for (let i = 0; i < 6 && !target.test(page.url()); i += 1) {
    await page.getByTestId('login-identifier').fill('imagen@alovida.mock');
    await page.getByTestId('login-password').fill('Alovida123!');
    await page.getByTestId('login-submit').click({ timeout: 5000 }).catch(() => {});
    await page.waitForURL(target, { timeout: 10000 }).catch(() => {});
  }
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60000 });
  }
}

async function openTab(page, label) {
  await page.getByRole('tab', { name: label }).click();
}

async function openPage(page) {
  await page.goto(`${B}/administration/center-schedule`, { waitUntil: 'commit' });
  await page.getByTestId('centro-horarios').waitFor({ timeout: 120000 });
}

/**
 * The simulator answers inside the browser: there is no network traffic.
 * `window.__mockRequests` records what was sent and answered; this waits for
 * the next entry matching method and path after `click` runs.
 */
async function answer(page, method, path, click) {
  const before = await page.evaluate(() => (window.__mockRequests ?? []).length);
  await click();
  const handle = await page.waitForFunction(
    ([n, m, p]) => (window.__mockRequests ?? []).slice(n).find((r) => r.method === m && r.url.split('?')[0].endsWith(p)) ?? false,
    [before, method, path],
    { timeout: 30000 },
  );
  return handle.jsonValue();
}

const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await signIn(page);
await openPage(page);
await page.screenshot({ path: `${OUT}/01-schedule-1440.png`, fullPage: true });

// 1. Register a scanner from the catalog: the CT section shows it after a reload.
await openTab(page, 'Equipos');
await page.screenshot({ path: `${OUT}/02-equipment-before-1440.png`, fullPage: true });
await page.getByTestId('equipment-add-open').click();
await page.getByTestId('equipment-add-type').locator('.select-trigger').click();
await page.getByRole('option', { name: 'Tomógrafo' }).click();
await page.getByTestId('equipment-add-manufacturer').fill('Canon');
await page.getByTestId('equipment-add-model').fill('Aquilion Lightning');
await page.getByTestId('equipment-add-serial').fill('TC-2026-01');
await page.screenshot({ path: `${OUT}/03-add-from-catalog-1440.png`, fullPage: true });
const addResponse = await answer(page, 'POST', '/equipment', () => page.getByTestId('equipment-add-submit').click());
note(`POST …/equipment → ${addResponse.status} body ${JSON.stringify(addResponse.body)}`);
check(addResponse.status === 201, 'the add request answers 201');
const addedDevice = addResponse.respuesta.equipment.find((e) => e.serialNumber === 'TC-2026-01');
note(`  device in response: ${addedDevice?.id} ${addedDevice?.name} ${addedDevice?.status}`);
check(addedDevice?.status === 'OPERATIONAL' && addedDevice?.typeCode === 'CT', 'the response carries the new CT device, operational');

// 2. Give the new scanner its own hours: afternoons only.
await page.getByTestId(`equipment-own-${addedDevice.id}`).getByRole('radio', { name: 'Sí' }).click();
for (const day of [1, 2, 3, 4, 5]) {
  await page.getByTestId(`equipment-${addedDevice.id}-desde-${day}`).locator('.select-trigger').click();
  await page.getByRole('option', { name: '14:00', exact: true }).click();
  await page.getByTestId(`equipment-${addedDevice.id}-hasta-${day}`).locator('.select-trigger').click();
  await page.getByRole('option', { name: '20:00', exact: true }).click();
}
const saveResponse = await answer(page, 'PUT', `/equipment/${addedDevice.id}/schedule`, () =>
  page.getByTestId(`equipment-save-${addedDevice.id}`).click(),
);
note(`PUT …/equipment/${addedDevice.id}/schedule → ${saveResponse.status} body ${JSON.stringify(saveResponse.body)}`);
check(saveResponse.status === 200, 'the own-hours request answers 200');
check(saveResponse.body.schedule.windows.every((w) => w.startTime === '14:00' && w.endTime === '20:00'), 'the request carries 14:00–20:00');

// 3. Reload: both changes come back from the (simulated) server.
await page.reload({ waitUntil: 'commit' });
await page.getByTestId('centro-horarios').waitFor({ timeout: 120000 });
await openTab(page, 'Equipos');
const card = page.getByTestId(`centro-equipo-${addedDevice.id}`);
await card.waitFor();
note(`after reload, card text: ${(await card.innerText()).replace(/\s+/g, ' ').slice(0, 160)}`);
check((await card.innerText()).includes('TC-2026-01'), 'after reload the device is still there, with its serial');
check((await page.getByTestId(`equipment-own-${addedDevice.id}`).getByRole('radio', { name: 'Sí' }).getAttribute('aria-checked')) === 'true', 'after reload its own hours are on');
check((await page.getByTestId(`equipment-${addedDevice.id}-desde-1`).innerText()).includes('14:00'), 'after reload Monday opens at 14:00');
await card.scrollIntoViewIfNeeded();
await page.screenshot({ path: `${OUT}/04-device-own-hours-after-reload-1440.png`, fullPage: true });

await openTab(page, 'Horarios');
const summary = await page.getByTestId('centro-resumen').innerText();
check(summary.includes('Aquilion') && summary.includes('Horario propio'), 'the summary shows the new line with its own hours');
await page.screenshot({ path: `${OUT}/05-summary-per-device-1440.png`, fullPage: true });

await openTab(page, 'Ocupación');
await page.getByTestId('occupancy-lines').waitFor({ timeout: 30000 });
await page.screenshot({ path: `${OUT}/06-occupancy-1440.png`, fullPage: true });

// 4. Phone width: the three tabs without horizontal scroll.
await page.setViewportSize({ width: 390, height: 844 });
for (const [label, file] of [['Horarios', '07-schedule-390'], ['Equipos', '08-equipment-390'], ['Ocupación', '09-occupancy-390']]) {
  await openTab(page, label);
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(overflow <= 0, `390 px · ${label}: no horizontal scroll (${overflow}px)`);
  await page.screenshot({ path: `${OUT}/${file}.png`, fullPage: true });
}

check(errors.length === 0, `no console errors${errors.length ? ` — ${errors.slice(0, 3).join(' | ')}` : ''}`);
writeFileSync(`${OUT}/walkthrough.txt`, `${log.join('\n')}\n`);
await browser.close();
if (failures.length > 0) {
  console.error(`${failures.length} check(s) failed`);
  process.exit(1);
}
