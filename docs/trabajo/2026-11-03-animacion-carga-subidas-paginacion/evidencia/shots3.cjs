const { chromium } = require('playwright');
const OUT = '/home/user/mantra-core-health/artifacts/evidencia-carga';
const SP = process.argv[2];
const slow = (page) => page.evaluate(() => { const o = window.setInterval.bind(window); window.setInterval = (fn, ms, ...a) => o(fn, ms >= 20 && ms <= 3000 ? ms * 30 : ms, ...a); });
(async () => {
  const b = await chromium.launch();
  const page = await (await b.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
  await page.goto('http://localhost:4200/auth');
  await page.getByTestId('login-identifier').fill('medica@alovida.mock');
  await page.getByTestId('login-password').fill('x'); await page.getByTestId('login-submit').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/auth') || u.pathname.startsWith('/auth/organization'), { timeout: 60000 });
  if (page.url().includes('/auth/organization')) { await page.getByTestId('tenant-opcion').first().click(); await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60000 }); }
  await page.getByTestId('header-cuenta').waitFor({ timeout: 60000 });
  await page.goto('http://localhost:4200/my-account/edit');
  const input = page.locator('input[data-testid="edicion-logo-archivo"]');
  await input.waitFor({ state: 'attached', timeout: 60000 });
  await page.getByTestId('edicion-logo').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);
  await slow(page);
  await input.setInputFiles(`${SP}/foto.png`);
  const ov = page.getByTestId('edicion-logo').getByTestId('file-input-uploading');
  try { await ov.waitFor({ timeout: 8000 }); console.log('logo dropzone overlay visible:', (await ov.textContent()).trim(), '| role=', await ov.getAttribute('role')); } catch { console.log('overlay NOT seen'); }
  console.log('logo preview overlay:', await page.getByTestId('logo-consultorio-subiendo').count());
  await page.getByTestId('edicion-logo').screenshot({ path: `${OUT}/5-edicion-logo-subiendo.png` });
  await ov.waitFor({ state: 'detached', timeout: 30000 }).then(() => console.log('overlay gone after response')).catch(() => console.log('overlay stuck'));
  await page.getByTestId('edicion-logo').screenshot({ path: `${OUT}/6-edicion-logo-subido.png` });
  await b.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
