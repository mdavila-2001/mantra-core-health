/**
 * «Horarios y equipos» of a diagnostic center with each device as a
 * production line (owner request, 04/11/2026): the center registers a device
 * from the type catalog, gives it its own hours, and sees the day of each
 * device. Proves each mutation UI → request → response → reload → UI, and
 * captures the three tabs at 1440 and 390 px.
 *
 * Usage: `BASE=http://localhost:4300 OUT=evidencias/centro-equipos-2026-11-05 node playwright/centro-equipos-linea-de-produccion.mjs`
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';

const B = process.env.BASE ?? 'http://localhost:4300';
const OUT = process.env.OUT ?? 'artifacts/centro-equipos';
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const log = [];
const note = (line) => {
  log.push(line);
  console.log(line);
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

/** Waits for the response of a request whose method and path match. */
const answer = (page, method, path) =>
  page.waitForResponse((r) => r.request().method() === method && new URL(r.url()).pathname.endsWith(path), { timeout: 30000 });

const errors = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await signIn(page);
await openPage(page);
await page.screenshot({ path: `${OUT}/01-horarios-1440.png`, fullPage: true });

// 1. Register a scanner from the catalog: the CT section shows it after a reload.
await openTab(page, 'Equipos');
await page.screenshot({ path: `${OUT}/02-equipos-antes-1440.png`, fullPage: true });
await page.getByTestId('equipment-add-open').click();
await page.getByTestId('equipment-add-type').locator('.select-trigger').click();
await page.getByRole('option', { name: 'Tomógrafo' }).click();
await page.getByTestId('equipment-add-manufacturer').fill('Canon');
await page.getByTestId('equipment-add-model').fill('Aquilion Lightning');
await page.getByTestId('equipment-add-serial').fill('TC-2026-01');
await page.screenshot({ path: `${OUT}/03-alta-desde-catalogo-1440.png`, fullPage: true });
const added = answer(page, 'POST', '/equipment');
await page.getByTestId('equipment-add-submit').click();
const addResponse = await added;
note(`POST …/equipment → ${addResponse.status()} body ${addResponse.request().postData()}`);
const addedDevice = (await addResponse.json()).equipment.find((e) => e.serialNumber === 'TC-2026-01');
note(`  device in response: ${addedDevice?.id} ${addedDevice?.name} ${addedDevice?.status}`);

// 2. Give the new scanner its own hours: afternoons only.
await page.getByTestId(`equipment-own-${addedDevice.id}`).getByRole('radio', { name: 'Sí' }).click();
for (const day of [1, 2, 3, 4, 5]) {
  await page.getByTestId(`equipment-${addedDevice.id}-desde-${day}`).locator('.select-trigger').click();
  await page.getByRole('option', { name: '14:00', exact: true }).click();
  await page.getByTestId(`equipment-${addedDevice.id}-hasta-${day}`).locator('.select-trigger').click();
  await page.getByRole('option', { name: '20:00', exact: true }).click();
}
const saved = answer(page, 'PUT', `/equipment/${addedDevice.id}/schedule`);
await page.getByTestId(`equipment-save-${addedDevice.id}`).click();
const saveResponse = await saved;
note(`PUT …/equipment/${addedDevice.id}/schedule → ${saveResponse.status()} body ${saveResponse.request().postData()}`);

// 3. Reload: both changes come back from the (simulated) server.
await page.reload({ waitUntil: 'commit' });
await page.getByTestId('centro-horarios').waitFor({ timeout: 120000 });
await openTab(page, 'Equipos');
const card = page.getByTestId(`centro-equipo-${addedDevice.id}`);
await card.waitFor();
note(`after reload, card text: ${(await card.innerText()).replace(/\s+/g, ' ').slice(0, 160)}`);
note(`after reload, own hours on: ${await card.getByRole('radio', { name: 'Sí' }).getAttribute('aria-checked')}`);
await card.scrollIntoViewIfNeeded();
await page.screenshot({ path: `${OUT}/04-equipo-con-horario-propio-tras-recarga-1440.png`, fullPage: true });

await openTab(page, 'Horarios');
const summary = await page.getByTestId('centro-resumen').innerText();
note(`summary mentions the new line: ${summary.includes('Aquilion') || summary.includes('Tomógrafo Canon')}`);
await page.screenshot({ path: `${OUT}/05-asi-queda-por-equipo-1440.png`, fullPage: true });

await openTab(page, 'Ocupación');
await page.getByTestId('occupancy-lines').waitFor({ timeout: 30000 });
await page.screenshot({ path: `${OUT}/06-ocupacion-1440.png`, fullPage: true });

// 4. Phone width: the three tabs without horizontal scroll.
await page.setViewportSize({ width: 390, height: 844 });
for (const [label, file] of [['Horarios', '07-horarios-390'], ['Equipos', '08-equipos-390'], ['Ocupación', '09-ocupacion-390']]) {
  await openTab(page, label);
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  note(`390 px · ${label}: horizontal overflow ${overflow}px`);
  await page.screenshot({ path: `${OUT}/${file}.png`, fullPage: true });
}

note(`console errors: ${errors.length}${errors.length ? ` — ${errors.slice(0, 3).join(' | ')}` : ''}`);
writeFileSync(`${OUT}/recorrido.txt`, `${log.join('\n')}\n`);
await browser.close();
