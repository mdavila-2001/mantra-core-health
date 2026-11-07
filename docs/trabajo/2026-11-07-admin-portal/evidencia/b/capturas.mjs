// Evidence script: one browser, serial captures, never waits for networkidle.
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] ?? 'http://localhost:4311';
const OUT = fileURLToPath(new URL('./capturas/', import.meta.url));
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH, args: ['--no-sandbox'] } : {});
const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'es-BO' })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 120000 });
await page.getByTestId('login-identifier').fill('admin@alovida.mock');
await page.getByTestId('login-password').fill('S3cret-passw0rd');
await page.getByTestId('login-submit').click();
await page.waitForTimeout(6000);

// BEFORE: what exists today next to the new screen (one practice only).
await page.goto(`${BASE}/administration/services-catalog`, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
await page.screenshot({ path: `${OUT}ANTES-services-catalog.png` });

// AFTER: each tab of the new screen.
await page.goto(`${BASE}/administration/services-grid`, { waitUntil: 'domcontentloaded' });
await page.getByTestId('services-grid-tabs').waitFor({ timeout: 30000 });
await page.waitForTimeout(2500);
const tabs = ['Médico', 'Laboratorio', 'Hospital', 'Farmacia / vademécum'];
for (const [i, name] of tabs.entries()) {
  await page.getByRole('tab', { name: new RegExp(name) }).click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}DESPUES-${i + 1}-${name.split(' ')[0].toLowerCase()}.png` });
}
await page.setViewportSize({ width: 390, height: 900 });
await page.getByRole('tab', { name: /Médico/ }).click();
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}DESPUES-5-medico-390.png` });
console.log('pageerrors:', JSON.stringify(errors));
await browser.close();
