const { chromium } = require('playwright');
const OUT = '/tmp/claude-0/-home-user/85c35165-122e-5963-8896-04d9349a56b7/scratchpad/e2e';
const H = 'registration-lab-hours';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 });
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  await page.goto('http://localhost:4200/auth/register/laboratory');
  await page.waitForSelector('app-register-laboratory app-paginated-form');
  const stamp = Date.now().toString().slice(-7);
  // Fields that are not under test: filled through Angular's dev hooks.
  await page.evaluate((stamp) => {
    const el = document.querySelector('app-register-laboratory');
    const c = window.ng.getComponent(el);
    c.form.patchValue({
      legalName: `Laboratorio Horario ${stamp} S.R.L.`, companyType: 'UNIPERSONAL', taxId: `10${stamp}`,
      legalRepName: { name: 'Lucía', lastName: 'Vargas' }, legalRepIdNumber: '7654321', legalRepEmail: `horario-${stamp}@example.test`,
      password: 'S3cret-passw0rd', addressLines: 'Av. Cañoto 456',
    });
    c.fijarGpsCentral({ lat: -17.7833, lng: -63.1821 });
    c.agregarSucursal();
    const id = c.sucursales()[0].id;
    c.escribirNombreDeSucursal(id, 'Sucursal Norte');
    c.fijarGpsDeSucursal(id, { lat: -17.7652, lng: -63.1961 });
    window.ng.applyChanges(el);
  }, stamp);
  const title = () => page.locator('app-paginated-form h2, app-paginated-form legend').first().innerText().catch(() => '');
  for (let i = 0; i < 12 && !(await page.locator(`[data-testid="${H}-headquarters"]`).isVisible()); i++) {
    await page.click('[data-testid="paginated-form-continuar"]');
    await page.waitForTimeout(300);
  }
  await page.locator(`[data-testid="${H}-headquarters"]`).waitFor();
  await page.screenshot({ path: `${OUT}/1-hours-template.png`, fullPage: true });
  // Monday: add an afternoon shift; with 08:00–18:00 it overlaps and the row says so.
  await page.click(`[data-testid="${H}-hq-add-shift-0"]`);
  await page.locator(`[data-testid="${H}-hq-error-0"]`).waitFor();
  const overlap = await page.locator(`[data-testid="${H}-hq-error-0"]`).innerText();
  await page.screenshot({ path: `${OUT}/2-overlap-error.png`, fullPage: true });
  await page.fill(`[data-testid="${H}-hq-closes-0-0"]`, '12:00');
  await page.click(`[data-testid="${H}-hq-copy-0"]`);
  // Saturday closed.
  await page.locator(`[data-testid="${H}-hq-open-5"] button`, { hasText: 'Cerrado' }).click();
  // Branch: own hours, open 24 h.
  await page.click(`[data-testid="${H}-same-sucursal-1"] .switch-container`);
  await page.click(`[data-testid="${H}-sucursal-1-24h"] .switch-container`);
  await page.screenshot({ path: `${OUT}/3-hours-edited.png`, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: `${OUT}/4-hours-mobile.png`, fullPage: true });
  const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  await page.setViewportSize({ width: 1440, height: 1000 });
  // To the end and submit through the UI.
  let response;
  const pending = page.waitForResponse((r) => r.url().endsWith('/iam/auth/register-organization'), { timeout: 60000 });
  pending.then((r) => { response = r; }).catch(() => {});
  for (let i = 0; i < 15 && !response; i++) {
    await page.click('[data-testid="paginated-form-continuar"]').catch(() => {});
    await page.waitForTimeout(700);
  }
  await pending.catch(() => {});
  const body = response ? JSON.parse(response.request().postData()) : null;
  const res = response ? await response.json() : null;
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/5-after-submit.png`, fullPage: true });
  console.log(JSON.stringify({
    overlap, scrollWidthAt390: scrollW, status: response?.status(), tenantId: res?.tenantId,
    centralHours: body?.organization?.openingHours, branchHours: body?.organization?.diagnosticUnit?.branches?.[0]?.openingHours,
    consoleErrors,
  }, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
