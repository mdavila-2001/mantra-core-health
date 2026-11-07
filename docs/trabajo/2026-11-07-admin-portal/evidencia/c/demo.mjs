// Evidence run for the catalog bulk load against the simulator (one browser, serial, no networkidle).
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = 'http://localhost:4200';
const OUT = new URL('.', import.meta.url).pathname;
const log = [];
const note = (s) => { log.push(s); console.log(s); };
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
const requests = [];
page.on('response', async (r) => {
  if (r.url().includes('/bulk')) {
    const req = r.request();
    requests.push({ url: r.url(), status: r.status(), req: JSON.parse(req.postData() ?? '{}'), res: await r.json().catch(() => null) });
  }
});
const shot = (n) => page.screenshot({ path: `${OUT}${n}.png`, fullPage: true });
async function pick(testId, label) {
  await page.getByTestId(testId).click();
  await page.getByRole('option', { name: label }).first().click();
}
async function login() {
  await page.goto(`${BASE}/auth`);
  await page.getByTestId('login-identifier').waitFor({ timeout: 90000 });
  await page.getByTestId('login-identifier').fill('admin@alovida.mock');
  await page.getByTestId('login-password').fill('S3cret-passw0rd');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/portal-selector/, { timeout: 90000 });
  await page.getByTestId('portal-administracion').click();
  await page.waitForTimeout(1500);
}
async function flow(file) {
  await page.goto(`${BASE}/superadmin/catalog-bulk`);
  await page.getByTestId('cb-pharmacy').waitFor({ timeout: 60000 });
  await pick('cb-pharmacy', /./);
  await pick('cb-kind', 'Categorías');
  await page.locator('input[type=file]').setInputFiles(file);
  await page.getByTestId('cb-rows-read').waitFor();
}
await login();
// BEFORE: the only bulk screen that existed is users-only.
await page.goto(`${BASE}/superadmin/bulk-imports`);
await page.getByText('Cargas masivas').first().waitFor({ timeout: 60000 });
await shot('ANTES-bulk-imports-solo-usuarios');

await flow(`${OUT}categorias.csv`);
await shot('DESPUES-1-archivo-leido');
await page.getByTestId('cb-simulate').click();
await page.getByTestId('cb-count-CREATED').waitFor();
await shot('DESPUES-2-simulacion');
note('simulation counts: ' + JSON.stringify(await page.locator('[data-testid^=cb-count-]').allInnerTexts()));
await page.getByTestId('cb-confirm').click();
await page.getByTestId('cb-snapshot').waitFor({ timeout: 30000 });
await shot('DESPUES-3-informe-y-recarga');
note('snapshot rows after load: ' + (await page.getByTestId('cb-snapshot').innerText()).replace(/\s+/g, ' ').slice(0, 300));

// RELOAD the whole app and load the same file again: persisted rows must come back as "Sin cambio".
await page.reload();
await flow(`${OUT}categorias.csv`);
await page.getByTestId('cb-simulate').click();
await page.getByTestId('cb-count-UNCHANGED').waitFor();
await shot('DESPUES-4-tras-recargar-sin-cambio');
note('after reload counts: ' + JSON.stringify(await page.locator('[data-testid^=cb-count-]').allInnerTexts()));
writeFileSync(`${OUT}requests.json`, JSON.stringify(requests, null, 2));
writeFileSync(`${OUT}demo.log`, log.join('\n') + '\n');
await browser.close();
