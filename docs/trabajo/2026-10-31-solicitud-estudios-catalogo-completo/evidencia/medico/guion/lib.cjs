const { chromium } = require('/home/user/mantra-core-health/node_modules/playwright');
const BASE = 'http://localhost:4200';
async function launch() {
  return chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}
function watch(page, sink) {
  page.on('console', (m) => sink.push({ k: 'console.' + m.type(), t: m.text().slice(0, 400) }));
  page.on('pageerror', (e) => sink.push({ k: 'pageerror', t: e.message }));
  page.on('response', (r) => { if (r.status() >= 400) sink.push({ k: 'http' + r.status(), t: r.url() }); });
  page.on('requestfailed', (r) => sink.push({ k: 'reqfailed', t: r.url() + ' ' + r.failure()?.errorText }));
}
async function login(page, email = 'medica@alovida.mock') {
  await page.goto(BASE + '/auth');
  await page.getByTestId('login-identifier').waitFor();
  await page.waitForTimeout(1500);
  await page.getByTestId('login-identifier').fill(email);
  await page.getByTestId('login-password').fill('mock');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/dashboard|portal-selector|organization/, { timeout: 60000 });
  if (page.url().includes('/auth/organization')) { await page.getByTestId('tenant-opcion').first().click(); await page.waitForURL(/dashboard|portal-selector/, { timeout: 60000 }); }
  if (page.url().includes('/portal-selector')) { await page.getByRole('link', { name: /Portal de administración/ }).click(); await page.waitForURL(/dashboard/, { timeout: 60000 }); }
}
async function openConsultation(page) {
  await page.evaluate((d) => { history.pushState({}, '', d); dispatchEvent(new PopStateEvent('popstate', { state: {} })); }, '/schedule');
  const cards = page.locator('.dia__bloque[data-tipo="cita"]');
  await cards.first().waitFor({ timeout: 30000 });
  const ongoing = cards.filter({ has: page.locator('.dia__estado').filter({ hasText: /en (curso|consulta)/i }) });
  const card = (await ongoing.count()) > 0 ? ongoing.first() : cards.filter({ has: page.locator('.dia__estado').filter({ hasText: /confirmad/i }) }).first();
  await card.getByTestId('dia-ir-a-atender').focus();
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/medical-records\/[^/]+\/consultation\?/, { timeout: 30000 });
  await page.getByTestId('consulta-rejilla').waitFor();
  const open = page.getByTestId('consulta-abrir-encuentro');
  if (await open.isVisible()) await open.click();
  await page.getByTestId('encuentros-en-curso').waitFor();
}
async function goPatientConsultation(page, name = 'Elena') {
  await page.evaluate((d) => { history.pushState({}, '', d); dispatchEvent(new PopStateEvent('popstate', { state: {} })); }, '/medical-records');
  await page.locator('input.native-input').first().waitFor();
  await page.locator('input.native-input').first().fill(name); await page.waitForTimeout(2000);
  const href = await page.getByTestId('paciente-ver-expediente').first().getAttribute('href');
  const id = href.split('/').pop();
  await page.evaluate((d) => { history.pushState({}, '', d); dispatchEvent(new PopStateEvent('popstate', { state: {} })); }, '/medical-records/' + id + '/consultation');
  await page.getByTestId('consulta-rejilla').waitFor({ timeout: 30000 });
  const open = page.getByTestId('consulta-abrir-encuentro');
  await page.waitForTimeout(1500);
  if (await open.isVisible()) await open.click();
  await page.getByTestId('encuentros-en-curso').waitFor({ timeout: 30000 });
  return id;
}
module.exports = { goPatientConsultation, launch, watch, login, openConsultation, BASE };
