const { chromium } = require('playwright');
const OUT = '/home/user/mantra-core-health/artifacts/evidencia-carga';
const SP = process.argv[2];
const slow = (page) => page.evaluate(() => {
  const o = window.setInterval.bind(window);
  window.setInterval = (fn, ms, ...a) => o(fn, ms >= 20 && ms <= 3000 ? ms * 30 : ms, ...a);
});
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 860 } });
  const page = await ctx.newPage();
  const log = (...m) => console.log(...m);
  await page.goto('http://localhost:4200/auth');
  await page.getByTestId('login-identifier').fill('medica@alovida.mock');
  await page.getByTestId('login-password').fill('cualquiera');
  await page.getByTestId('login-submit').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/auth') || u.pathname.startsWith('/auth/organization'), { timeout: 60000 });
  if (page.url().includes('/auth/organization')) { await page.getByTestId('tenant-opcion').first().click(); await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60000 }); }
  await page.getByTestId('header-cuenta').waitFor({ timeout: 60000 });
  log('logged in', page.url());

  // 1) Glossary: server-side pagination
  await page.goto('http://localhost:4200/glossary');
  await page.locator('app-pagination').first().waitFor({ timeout: 60000 });
  await slow(page);
  await page.locator('app-pagination').first().getByRole('button', { name: 'Página 2' }).click();
  const sp = page.locator('[data-testid="pagination-loading"]');
  await sp.waitFor({ timeout: 5000 });
  log('pagination spinner visible:', await sp.isVisible());
  await page.locator('app-pagination').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${OUT}/1-glosario-paginando.png`, fullPage: false });
  const sk = page.locator('app-skeleton').first();
  if (await sk.count()) { await sk.scrollIntoViewIfNeeded(); await page.screenshot({ path: `${OUT}/2-glosario-esqueleto.png` }); log('skeleton shot'); }
  await sp.waitFor({ state: 'detached', timeout: 30000 });
  log('pagination spinner gone after response');

  // 2) Profile photo upload
  await page.goto('http://localhost:4200/account/profile');
  await page.getByTestId('mi-perfil-foto-boton').waitFor({ timeout: 60000 });
  await slow(page);
  await page.getByTestId('mi-perfil-foto').setInputFiles(`${SP}/foto.png`);
  const up = page.getByTestId('mi-perfil-foto-subiendo');
  try { await up.waitFor({ timeout: 8000 }); log('photo spinner visible:', await up.isVisible()); } catch { log('photo spinner NOT seen'); }
  log('button aria-busy:', await page.getByTestId('mi-perfil-foto-boton').getAttribute('aria-busy'));
  await page.screenshot({ path: `${OUT}/3-perfil-subiendo-foto.png` });
  await b.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
