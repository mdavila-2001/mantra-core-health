import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
const BASE = process.argv[2], OUT = process.argv[3];
mkdirSync(OUT, { recursive: true });
const res = []; const ok = (n, c, d = '') => { res.push(!!c); console.log(`${c ? '✔' : '✘'} ${n}${d ? ' — ' + d : ''}`); };
const consola = []; let csp = 0;
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
for (const [w, h] of [[1440, 900], [390, 860]]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  p.on('pageerror', (e) => consola.push('pageerror: ' + e));
  p.on('console', (m) => { if (m.type() !== 'error') return; if (/Content Security Policy directive: "script-src/.test(m.text())) { csp++; return; } consola.push(m.text()); });
  await p.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await p.getByTestId('login-identifier').fill('medica@alovida.mock');
  await p.getByTestId('login-password').fill('mockup');
  await p.getByTestId('login-submit').click();
  await p.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60000 });
  if (p.url().includes('/auth/organization')) { await p.getByTestId('tenant-opcion').first().click(); await p.waitForURL(/\/dashboard/); }
  await p.goto(`${BASE}/posts`, { waitUntil: 'domcontentloaded' });
  await p.locator('[data-group="social"]').waitFor({ timeout: 60000 });
  // Las dos bandejas llegan por separado: se espera a que ambas hablen.
  await p.waitForFunction(() => ['/messaging', '/notification-center'].every((r) => /sin leer/.test(document.querySelector(`a[data-route="${r}"]`)?.getAttribute('aria-label') ?? '')), null, { timeout: 30000 }).catch(() => {});
  const avisos = await p.locator('a[data-route="/notification-center"]').getAttribute('aria-label');
  const chats = await p.locator('a[data-route="/messaging"]').getAttribute('aria-label');
  ok(`${w} · Notificaciones dice cuántas sin leer`, /Notificaciones, \d+ sin leer/.test(avisos), avisos);
  ok(`${w} · Mensajes dice cuántos sin leer`, /Mensajes, \d+ sin leer/.test(chats), chats);
  ok(`${w} · hay contador visible`, (await p.getByTestId('public-nav-rail-contador').count()) > 0);
  ok(`${w} · sin scroll horizontal de página`, await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await p.screenshot({ path: `${OUT}/rail-${w}.png` });
  if (w === 1440) {
    await p.locator('a[data-route="/notification-center"]').click();
    await p.waitForURL(/notification-center/, { timeout: 60000 });
    ok('Notificaciones abre el centro de notificaciones', p.url().includes('/notification-center'));
  }
  await p.context().close();
}
console.log(`(CSP inline-script aparte: ${csp})`);
ok('sin errores de página ni de consola (salvo CSP)', consola.length === 0, consola.slice(0, 3).join(' || '));
await b.close();
console.log(`\n${res.filter(Boolean).length}/${res.length} en verde`);
