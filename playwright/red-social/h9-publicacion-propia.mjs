import { chromium } from 'playwright';
const BASE = process.argv[2];
const res = []; const ok = (n, c, d = '') => { res.push(!!c); console.log(`${c ? '✔' : '✘'} ${n}${d ? ' — ' + d : ''}`); };
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await p.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180000 });
await p.getByTestId('login-identifier').fill('medica@alovida.mock');
await p.getByTestId('login-password').fill('mockup');
await p.getByTestId('login-submit').click();
await p.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60000 });
for (const [modo, url] of [['Recientes', '/posts'], ['Siguiendo', '/posts?feed=siguiendo']]) {
  await p.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' });
  await p.locator('app-public-post-card').first().waitFor({ timeout: 60000 });
  const texto = `Sólo para seguidores ${modo} ${Date.now()}`;
  await p.getByTestId('feed-crear-abrir').click();
  await p.getByTestId('post-composer-visibility').locator('select').selectOption({ label: 'Sólo quienes me siguen' });
  await p.getByTestId('post-composer-body').locator('textarea').fill(texto);
  await p.getByTestId('post-composer-submit').click();
  await p.getByRole('dialog').waitFor({ state: 'detached', timeout: 30000 }).catch(() => {});
  await p.waitForFunction((t) => document.querySelector('app-public-post-card')?.textContent?.includes(t), texto, { timeout: 30000 }).catch(() => {});
  ok(`${modo} · la publicación para seguidores queda primera`, (await p.locator('app-public-post-card').first().innerText()).includes(texto));
  ok(`${modo} · sin duplicar`, (await p.locator('app-public-post-card', { hasText: texto }).count()) === 1);
  ok(`${modo} · no cambió de pestaña`, p.url().endsWith(url), p.url().replace(BASE, ''));
}
await b.close();
console.log(`\n${res.filter(Boolean).length}/${res.length} en verde`);
