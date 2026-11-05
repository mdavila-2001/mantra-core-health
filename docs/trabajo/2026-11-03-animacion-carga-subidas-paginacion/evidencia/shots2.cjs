const { chromium } = require('playwright');
const OUT = '/home/user/mantra-core-health/artifacts/evidencia-carga';
const SP = process.argv[2];
const slow = (page) => page.evaluate(() => { const o = window.setInterval.bind(window); window.setInterval = (fn, ms, ...a) => o(fn, ms >= 20 && ms <= 3000 ? ms * 30 : ms, ...a); });
async function entrar(b, who) {
  const page = await (await b.newContext({ viewport: { width: 1280, height: 860 } })).newPage();
  await page.goto('http://localhost:4200/auth');
  await page.getByTestId('login-identifier').fill(who + '@alovida.mock');
  await page.getByTestId('login-password').fill('x'); await page.getByTestId('login-submit').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/auth') || u.pathname.startsWith('/auth/organization'), { timeout: 60000 });
  if (page.url().includes('/auth/organization')) { await page.getByTestId('tenant-opcion').first().click(); await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60000 }); }
  await page.getByTestId('header-cuenta').waitFor({ timeout: 60000 });
  return page;
}
(async () => {
  const b = await chromium.launch();
  // Practitioner photo
  let page = await entrar(b, 'medica');
  await page.goto('http://localhost:4200/account/profile');
  await page.getByTestId('perfil-foto').waitFor({ state: 'attached', timeout: 60000 });
  await page.waitForTimeout(1500);
  await slow(page);
  await page.getByTestId('perfil-foto').setInputFiles(`${SP}/foto.png`);
  const up = page.getByTestId('perfil-foto-subiendo');
  try { await up.first().waitFor({ timeout: 8000 }); console.log('practitioner photo spinner visible'); await up.first().scrollIntoViewIfNeeded(); } catch { console.log('practitioner photo spinner NOT seen'); }
  await page.screenshot({ path: `${OUT}/3-perfil-medico-subiendo-foto.png` });
  // Patient photo (my-profile)
  page = await entrar(b, 'paciente');
  await page.goto('http://localhost:4200/account/profile');
  await page.getByTestId('mi-perfil-foto-boton').waitFor({ timeout: 60000 });
  await slow(page);
  await page.getByTestId('mi-perfil-foto').setInputFiles(`${SP}/foto.png`);
  const up2 = page.getByTestId('mi-perfil-foto-subiendo');
  try { await up2.waitFor({ timeout: 8000 }); console.log('patient photo spinner visible; button aria-busy=', await page.getByTestId('mi-perfil-foto-boton').getAttribute('aria-busy')); } catch { console.log('patient photo spinner NOT seen'); }
  await page.screenshot({ path: `${OUT}/4-perfil-paciente-subiendo-foto.png` });
  await up2.waitFor({ state: 'detached', timeout: 30000 }).then(() => console.log('patient spinner gone after response')).catch(() => console.log('patient spinner still there'));
  await b.close();
})().catch((e) => { console.error('FAIL', e.message); process.exit(1); });
