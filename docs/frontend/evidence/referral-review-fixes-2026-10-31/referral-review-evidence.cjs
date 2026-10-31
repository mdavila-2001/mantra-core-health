// Evidencia de navegador de las correcciones de la revisión de «Derivar»
// (consulta, modo maqueta). Uso:
//   node referral-review-evidence.cjs <baseUrl> <carpetaDeSalida>
// Nunca espera `networkidle` (con HMR no llega): espera selectores concretos.
// Un solo navegador, capturas en serie.
const { chromium } = require('/home/user/mantra-core-health/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');

const [base = 'http://localhost:4321', outDir = __dirname] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

function uuid(seed) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
  }
  const hex = (n) => n.toString(16).padStart(8, '0');
  const raw = `${hex(h1)}${hex(h2)}${hex((h1 * 31 + h2) >>> 0)}${hex((h2 * 17 + h1) >>> 0)}`;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-a${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
}

const PATIENT_ID = uuid('pid-paciente');
const runLog = { console: [], pageErrors: [], requests: [], assertions: [], measures: {} };

function check(name, ok, detail = '') {
  runLog.assertions.push({ name, ok: Boolean(ok), detail: typeof detail === 'string' ? detail : JSON.stringify(detail) });
  console.log(`${ok ? 'OK   ' : 'FALLA'} ${name} ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
}

const overflow = (page) =>
  page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));

/** Si el elemento está entero dentro del viewport. */
const inViewport = (locator) =>
  locator.evaluate((e) => {
    const r = e.getBoundingClientRect();
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, inside: r.top >= 0 && r.bottom <= innerHeight };
  });

const activeTestId = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    return a?.getAttribute('data-testid') ?? a?.closest('[data-testid]')?.getAttribute('data-testid') ?? a?.tagName ?? null;
  });

(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.PW_CHROMIUM ??
      '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell',
  });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') runLog.console.push(`${m.type()}: ${m.text().slice(0, 240)}`);
  });
  page.on('pageerror', (e) => runLog.pageErrors.push(String(e)));
  const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });

  await page.goto(`${base}/auth`, { waitUntil: 'commit' });
  await page.getByTestId('login-identifier').waitFor({ timeout: 180_000 });
  await page.getByTestId('login-identifier').fill('medica@alovida.mock');
  await page.getByTestId('login-password').fill('mock');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 120_000 });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }

  await page.goto(`${base}/medical-records/${PATIENT_ID}/consultation`, { waitUntil: 'commit' });
  const tile = page.getByTestId('consulta-casilla-derivacion');
  await tile.waitFor({ timeout: 120_000 });
  await page.waitForFunction(
    () => /\d/.test(document.querySelector('[data-testid="consulta-casilla-derivacion"]')?.textContent ?? ''),
    null,
    { timeout: 30_000 },
  );
  const tileText = (await tile.innerText()).replace(/\s+/g, ' ').trim();
  const before = Number((tileText.match(/(\d+)\s+derivaci/) ?? [])[1] ?? NaN);
  check('L: la casilla nombra lo que cuenta («N derivaciones»)', Number.isFinite(before) && !tileText.includes('en la historia'), tileText);
  await tile.scrollIntoViewIfNeeded();
  await shot('01-grid-390');

  const dialog = page.getByRole('dialog');

  /* -- Sin encuentro: la salida ------------------------------------------ */
  check('arranca sin encuentro abierto', (await page.getByTestId('consulta-abrir-encuentro').count()) === 1);
  await tile.click();
  await dialog.getByTestId('referral-no-encounter').waitFor();
  await dialog.getByTestId('referral-list').waitFor({ timeout: 30_000 });
  const listText = await dialog.getByTestId('referral-list').innerText();
  check('L: ninguna fila se titula «Sin tipo»', !listText.includes('Sin tipo'));
  await shot('02-no-encounter-390');
  await dialog.getByTestId('referral-open-encounter').click();
  await dialog.waitFor({ state: 'detached', timeout: 10_000 });
  await page.waitForTimeout(300);
  check('M: «Ir a abrir el encuentro» cierra el modal y enfoca «Abrir encuentro»', (await activeTestId(page)) === 'consulta-abrir-encuentro', await activeTestId(page));
  check('«Abrir encuentro» queda a la vista', (await inViewport(page.getByTestId('consulta-abrir-encuentro'))).inside);
  await shot('03-no-encounter-focus-390');

  await page.getByTestId('consulta-abrir-encuentro').click();
  await page.getByTestId('encuentros-en-curso').waitFor({ timeout: 30_000 });

  /* -- El formulario: Servicio apagado, sin servicios en línea ------------- */
  await tile.click();
  await dialog.getByTestId('referral-kind').waitFor();
  const pending = dialog.getByTestId('referral-service-pending');
  check('M: sin destino, el campo «Servicio» ya está, apagado', await pending.isVisible());
  await pending.scrollIntoViewIfNeeded();
  await shot('04-service-pending-390');

  await dialog.getByRole('radio', { name: 'Organización médica' }).click();
  const orgInput = dialog.getByTestId('referral-organization').locator('input');
  await orgInput.fill('laboratorio');
  await page.getByRole('option', { name: /Laboratorio/ }).first().click();
  const noServices = dialog.getByTestId('referral-no-services');
  await noServices.waitFor({ timeout: 30_000 });
  const noServicesBox = await noServices.boundingBox();
  runLog.measures.noServicesHeight390 = Math.round(noServicesBox?.height ?? -1);
  check('M: sin servicios es un aviso en línea con título específico', (await noServices.innerText()).includes('Este destino no tiene servicios publicados'));
  // Antes: el S3 de página, ~290 px con «Todavía no hay nada acá».
  check('M: el aviso es más bajo que el S3 de página (< 290 px a 390)', (noServicesBox?.height ?? 999) < 290, `${Math.round(noServicesBox?.height ?? -1)} px`);
  check('M: no es el S3 genérico', !(await dialog.innerText()).includes('Todavía no hay nada'));
  check('M: ofrece las dos salidas', (await noServices.getByTestId('referral-without-service').count()) === 1 && (await noServices.getByTestId('referral-search-another').count()) === 1);
  await noServices.scrollIntoViewIfNeeded();
  await shot('05-no-services-390');
  await noServices.getByTestId('referral-search-another').click();
  await page.waitForTimeout(300);
  check('«Buscar otro destino» vuelve al buscador', (await activeTestId(page)) === 'referral-organization', await activeTestId(page));

  /* -- Éxito, 409 y error a 390 ------------------------------------------- */
  // «Interconsulta»: no ofrece consentimiento, así que tras derivar no se abre
  // el detalle encima y lo que queda a la vista es el resultado del envío.
  // (Con «Tratamiento» el próximo paso es el consentimiento: se abre el detalle.)
  async function pickHospitalService() {
    await orgInput.fill('lucas');
    await page.getByRole('option', { name: /Hospital San Lucas/ }).click();
    await dialog.getByTestId('referral-service').waitFor({ timeout: 30_000 });
    await dialog.getByTestId('referral-service').click();
    await page.getByRole('option').nth(1).click();
    await dialog.getByTestId('referral-type').click();
    await page.getByRole('option', { name: 'Interconsulta' }).click();
  }
  await pickHospitalService();
  // Mientras se relee tras derivar, la lista no vuelve a «Buscando…» (S2): se
  // queda a la vista como S7. Un observador anota si el esqueleto aparece.
  await page.evaluate(() => {
    window.__listFlashed = false;
    const root = document.querySelector('dialog') ?? document.body;
    new MutationObserver(() => {
      if ((root.textContent ?? '').includes('Buscando las derivaciones')) window.__listFlashed = true;
    }).observe(root, { subtree: true, childList: true, characterData: true });
  });
  await dialog.getByTestId('referral-submit').scrollIntoViewIfNeeded();
  await dialog.getByTestId('referral-submit').click();
  const success = dialog.getByTestId('referral-success');
  await success.waitFor({ timeout: 20_000 });
  await page.waitForTimeout(600);
  const successBox = await inViewport(success);
  check('HIGH: el éxito se ve a 390 tras enviar', successBox.inside, successBox);
  check('HIGH: el foco va al resultado', (await activeTestId(page)) === 'referral-outcome', await activeTestId(page));
  check('H1: el texto de organización dice que se le avisó', (await success.innerText()).includes('Le avisamos a la persona que la derivó a Hospital San Lucas'), (await success.innerText()).replace(/\s+/g, ' '));
  await shot('06-submit-success-390');
  await dialog.getByTestId('referral-list').waitFor();
  await page.waitForFunction(() => !(document.querySelector('dialog')?.textContent ?? '').includes('Actualizando'), null, { timeout: 15_000 });
  runLog.measures.rowsAfterSubmit = await dialog.getByTestId('referral-row').count();
  check('M: al releer la lista no vuelve a «Buscando…»', !(await page.evaluate(() => window.__listFlashed)));

  // La misma derivación otra vez: 409 REFERRAL_ALREADY_EXISTS real de la maqueta.
  await orgInput.scrollIntoViewIfNeeded();
  await pickHospitalService();
  await dialog.getByTestId('referral-submit').click();
  const duplicate = dialog.getByTestId('referral-duplicate');
  await duplicate.waitFor({ timeout: 20_000 });
  await page.waitForTimeout(600);
  const dupBox = await inViewport(duplicate);
  check('HIGH: el 409 se ve a 390 tras enviar', dupBox.inside, dupBox);
  check('HIGH: el foco va al resultado (409)', (await activeTestId(page)) === 'referral-outcome', await activeTestId(page));
  await shot('07-submit-409-390');

  // Un 404 sin sub-código (fallo simulado): texto genérico, sin culpar al encuentro.
  await page.evaluate(() =>
    sessionStorage.setItem('mock:fallos', JSON.stringify([{ patron: '/referrals', modo: 'not-found', metodos: ['POST'] }])),
  );
  await dialog.getByTestId('referral-submit').click();
  const error = dialog.getByTestId('referral-error');
  await error.waitFor({ timeout: 20_000 });
  await page.waitForTimeout(600);
  const errBox = await inViewport(error);
  check('HIGH: el error se ve a 390 tras enviar', errBox.inside, errBox);
  check('M5: un 404 sin sub-código no culpa al encuentro', (await error.innerText()).includes('El encuentro, el destino o el servicio ya no están disponibles'), (await error.innerText()).trim());
  await shot('08-submit-error-390');
  await page.evaluate(() => sessionStorage.removeItem('mock:fallos'));
  check('sin desborde horizontal a 390 (modal)', (await overflow(page)) === 0);

  /* -- Relectura sin salto y recarga --------------------------------------- */
  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached', timeout: 10_000 });
  await page.reload({ waitUntil: 'commit' });
  await tile.waitFor({ timeout: 120_000 });
  await page.waitForFunction(
    () => /\d/.test(document.querySelector('[data-testid="consulta-casilla-derivacion"]')?.textContent ?? ''),
    null,
    { timeout: 30_000 },
  );
  const afterText = (await tile.innerText()).replace(/\s+/g, ' ').trim();
  const after = Number((afterText.match(/(\d+)\s+derivaci/) ?? [])[1] ?? NaN);
  check('persistencia: tras F5 la casilla cuenta una más', after === before + 1, `${before} → ${after}`);
  await tile.click();
  await dialog.getByTestId('referral-list').waitFor({ timeout: 30_000 });
  const reloadedRows = await dialog.getByTestId('referral-row').allInnerTexts();
  check('persistencia: tras F5 la fila nueva sigue en la lista', reloadedRows.some((t) => t.includes('Hospital San Lucas') && t.includes('Solicitada')), `${reloadedRows.length} filas`);
  await dialog.getByTestId('referral-list').scrollIntoViewIfNeeded();
  await shot('09-after-reload-390');

  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached', timeout: 10_000 });

  /* -- Otros anchos -------------------------------------------------------- */
  for (const [w, h] of [
    [768, 1024],
    [1440, 900],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(400);
    await tile.scrollIntoViewIfNeeded();
    await shot(`10-grid-${w}`);
    await tile.click();
    await dialog.getByTestId('referral-kind').waitFor();
    await dialog.getByTestId('referral-list').waitFor({ timeout: 30_000 });
    check(`sin desborde horizontal a ${w}`, (await overflow(page)) === 0);
    // Vigencia y Tipo alineados: misma altura de control (sin el ícono doble).
    // Se miden los rótulos visibles: los anfitriones de los dos controles no
    // envuelven lo mismo y su caja no es la del borde que se ve.
    // En una sola lectura: el modal todavía puede estar desplazándose.
    await page.waitForTimeout(500);
    const [typeBox, dateBox] = await page.evaluate(() =>
      ['referral-type', 'referral-valid-until'].map((tid) => {
        const field = document.querySelector(`[data-testid="${tid}"]`)?.closest('app-form-field');
        const r = field?.getBoundingClientRect();
        return r ? { y: r.y, height: r.height } : null;
      }),
    );
    runLog.measures[`typeVsValidUntil${w}`] = { type: typeBox, validUntil: dateBox };
    if (w >= 768) check(`L: «Vigencia» alineada con «Tipo» a ${w}`, Math.abs((typeBox?.y ?? 0) - (dateBox?.y ?? 99)) <= 2, `${typeBox?.y} vs ${dateBox?.y}`);
    await shot(`11-modal-${w}`);
    await dialog.getByRole('radio', { name: 'Organización médica' }).click();
    await dialog.getByTestId('referral-organization').locator('input').fill('laboratorio');
    await page.getByRole('option', { name: /Laboratorio/ }).first().click();
    await dialog.getByTestId('referral-no-services').waitFor({ timeout: 30_000 });
    await dialog.getByTestId('referral-no-services').scrollIntoViewIfNeeded();
    await shot(`12-no-services-${w}`);
    // Escape lo toma primero el combobox; se cierra con «Cerrar».
    await dialog.getByRole('button', { name: 'Cerrar', exact: true }).first().click();
    await dialog.waitFor({ state: 'detached', timeout: 10_000 });
  }

  runLog.pageErrorsCount = runLog.pageErrors.length;
  fs.writeFileSync(path.join(outDir, 'run-log.json'), JSON.stringify(runLog, null, 2));
  const failed = runLog.assertions.filter((a) => !a.ok).length;
  console.log(`${runLog.assertions.length - failed}/${runLog.assertions.length} aserciones; ${runLog.pageErrors.length} pageerror`);
  await browser.close();
  process.exit(failed === 0 && runLog.pageErrors.length === 0 ? 0 : 1);
})().catch((e) => {
  console.error(e);
  fs.writeFileSync(path.join(outDir, 'run-log.json'), JSON.stringify({ ...runLog, error: String(e) }, null, 2));
  process.exit(2);
});
