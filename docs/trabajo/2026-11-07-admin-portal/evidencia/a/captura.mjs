// Captures the platform home (dashboard) for the admin account. Usage: node captura.mjs <base> <ANTES|DESPUES>
import { chromium } from 'playwright';
const [BASE, ETIQUETA] = [process.argv[2] ?? 'http://localhost:4300', process.argv[3] ?? 'DESPUES'];
const salida = new URL('.', import.meta.url).pathname;
const nav = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
const page = await (await nav.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
const errores = [];
page.on('pageerror', (e) => errores.push(String(e)));
await page.goto(`${BASE}/auth`);
await page.getByTestId('login-identifier').waitFor({ timeout: 90_000 });
await page.getByTestId('login-identifier').fill('admin@alovida.mock');
await page.getByTestId('login-password').fill('S3cret-passw0rd');
await page.getByTestId('login-submit').click();
await page.waitForURL(/\/(dashboard|auth\/organization|portal-selector)/, { timeout: 60_000 });
if (page.url().includes('/auth/organization')) { await page.getByTestId('tenant-opcion').first().click(); await page.waitForURL(/\/(dashboard|portal-selector)/); }
if (page.url().includes('/portal-selector')) { await page.getByRole('link', { name: /Portal de administración/ }).click(); await page.waitForURL(/\/dashboard/); }
await page.getByTestId('platform-home-portales').waitFor({ timeout: 60_000 });
await page.waitForTimeout(1500);
const m = await page.evaluate(() => {
  const p = document.querySelector('[data-testid="platform-home-portales"]');
  return { cards: p.querySelectorAll('app-card').length + (p.tagName === 'APP-CARD' ? 1 : 0), tabs: p.querySelectorAll('[role="tab"]').length, links: p.querySelectorAll('a').length };
});
console.log(ETIQUETA, JSON.stringify(m), 'pageerrors:', errores.length);
await page.screenshot({ path: `${salida}portada-${ETIQUETA}.png`, fullPage: true });
const botones = page.locator('[role="tab"]');
if ((await botones.count()) > 1) { await botones.nth(1).click(); await page.waitForTimeout(400); await page.screenshot({ path: `${salida}portada-${ETIQUETA}-pestana2.png`, fullPage: true }); }
await page.locator('nav, header').first().screenshot({ path: `${salida}menu-${ETIQUETA}.png` }).catch(() => {});
await nav.close();
