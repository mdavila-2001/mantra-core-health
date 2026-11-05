// Browser evidence for proceso 4.2 against `yarn start:demo` (simulator):
// catalog → add → reload → «Ya está» → Precios with components → price → save → reload.
// Usage: node playwright/lab-catalogo-precios.mjs [baseUrl] [outDir] [chromiumPath]
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium, devices } = require('playwright');

const BASE = process.argv[2] ?? 'http://localhost:4200';
const OUT = process.argv[3] ?? 'evidencias/lab-catalogo-precios';
const EXECUTABLE = process.argv[4];
mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log('[evidence]', ...a);

const browser = await chromium.launch(EXECUTABLE ? { executablePath: EXECUTABLE } : {});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 240_000 });
await page.getByTestId('login-identifier').fill('laboratorio@alovida.mock');
await page.getByTestId('login-password').fill('mockup');
await page.getByTestId('login-submit').click();
await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 120_000 });

await page.goto(`${BASE}/administration/laboratory-prices`, { waitUntil: 'domcontentloaded' });
await page.getByTestId('lab-prices-table').waitFor({ timeout: 120_000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: `${OUT}/01-precios-antes.png`, fullPage: true });

await page.getByTestId('lab-prices-catalog').click();
await page.waitForURL(/laboratory-prices\/catalog/);
await page.getByTestId('lab-catalog-item').first().waitFor({ timeout: 60_000 });
await page.screenshot({ path: `${OUT}/02-catalogo.png`, fullPage: true });

await page.goto(`${BASE}/administration/laboratory-prices/catalog?q=hemograma`, { waitUntil: 'domcontentloaded' });
const hemo = page.locator('[data-testid="lab-catalog-item"][data-code="HEMOGRAMA"]');
await hemo.waitFor({ timeout: 60_000 });
await hemo.locator('summary').click();
await hemo.locator('app-checkbox').click();
await page.getByTestId('lab-catalog-add').scrollIntoViewIfNeeded();
await hemo.screenshot({ path: `${OUT}/03-hemograma-componentes.png` });
log('add button:', await page.getByTestId('lab-catalog-add').textContent());
await page.getByTestId('lab-catalog-add').click();
await page.getByTestId('lab-catalog-result').waitFor();
log('result:', (await page.getByTestId('lab-catalog-result').innerText()).replace(/\s+/g, ' '));
await page.screenshot({ path: `${OUT}/04-agregado.png`, fullPage: true });

// Persistence: a full reload still says it is in the price list.
await page.reload({ waitUntil: 'domcontentloaded' });
await hemo.waitFor({ timeout: 60_000 });
log('after reload, HEMOGRAMA:', (await hemo.innerText()).split('\n')[0]);

await page.goto(`${BASE}/administration/laboratory-prices`, { waitUntil: 'domcontentloaded' });
await page.getByTestId('lab-prices-table').waitFor({ timeout: 60_000 });
await page.getByRole('textbox', { name: 'Buscar un servicio' }).fill('hemograma');
await page.keyboard.press('Enter');
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/05-precios-con-componentes.png`, fullPage: true });
const rows = await page.locator('.prices__main').allInnerTexts();
log('rows:', JSON.stringify(rows));

// Price the component that came without a suggestion, save, reload.
await page.getByTestId('lab-prices-price-HEMOGRAMA.VCM').fill('12');
await page.getByTestId('lab-prices-save').click();
await page.waitForTimeout(1500);
await page.reload({ waitUntil: 'domcontentloaded' });
await page.getByTestId('lab-prices-table').waitFor({ timeout: 60_000 });
await page.getByRole('textbox', { name: 'Buscar un servicio' }).fill('volumen');
await page.keyboard.press('Enter');
await page.waitForTimeout(800);
log('VCM after reload:', await page.getByTestId('lab-prices-price-HEMOGRAMA.VCM').inputValue());
log('VCM row:', (await page.locator('tr', { hasText: 'Volumen corpuscular' }).innerText()).replace(/\s+/g, ' '));
await page.screenshot({ path: `${OUT}/06-vcm-guardado-y-recargado.png`, fullPage: true });

// Phone width.
const phone = await browser.newContext({ ...devices['iPhone 13'] });
const p2 = await phone.newPage();
await p2.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded' });
await p2.getByTestId('login-identifier').fill('laboratorio@alovida.mock');
await p2.getByTestId('login-password').fill('mockup');
await p2.getByTestId('login-submit').click();
await p2.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 120_000 });
await p2.goto(`${BASE}/administration/laboratory-prices/catalog?q=hemograma`, { waitUntil: 'domcontentloaded' });
await p2.getByTestId('lab-catalog-item').first().waitFor({ timeout: 60_000 });
const overflow = await p2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
log('phone horizontal overflow px:', overflow);
await p2.screenshot({ path: `${OUT}/07-catalogo-telefono.png`, fullPage: true });

// 320 px, the narrowest supported width.
await p2.setViewportSize({ width: 320, height: 900 });
await p2.goto(`${BASE}/administration/laboratory-prices`, { waitUntil: 'domcontentloaded' });
await p2.getByTestId('lab-prices-table').waitFor({ timeout: 60_000 });
log('320px horizontal overflow px:', await p2.evaluate(() => document.documentElement.scrollWidth - window.innerWidth));
await p2.screenshot({ path: `${OUT}/08-precios-320.png`, fullPage: true });

log('page errors:', JSON.stringify(errors.slice(0, 5)));
await browser.close();
