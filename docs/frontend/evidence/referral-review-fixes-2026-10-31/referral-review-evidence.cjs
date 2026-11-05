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
    if (m.type() === 'error' || m.type() === 'warning') runLog.console.push(`${m.type()}: ${m.text().slice(0, 600)}`);
  });
  page.on('pageerror', (e) => runLog.pageErrors.push(String(e)));
  const shot = (name) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
  // Reloj controlable: para dejar quieta la relectura y fotografiar S7.
  await page.clock.install();

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
  const submitHint = (await dialog.getByTestId('referral-submit-hint').innerText()).trim();
  check('8: el botón apagado dice qué falta (aria-describedby)', submitHint === 'Para derivar, elija el destino.' && (await dialog.getByTestId('referral-submit').getAttribute('aria-describedby')) === 'referral-submit-hint', submitHint);
  await pending.scrollIntoViewIfNeeded();
  await shot('04-service-pending-390');

  // 4: los rótulos de «¿A quién deriva?» enteros a 390 y a 360.
  const kindLabelsFit = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-testid="referral-kind"] .segmentado__rotulo')].map((e) => ({
        text: e.textContent?.trim(),
        fits: e.scrollWidth <= e.clientWidth,
        sw: e.scrollWidth,
        cw: e.clientWidth,
      })),
    );
  const fit390 = await kindLabelsFit();
  check('4: rótulos del selector enteros a 390', fit390.length === 3 && fit390.every((l) => l.fits), fit390);
  check('sin desborde horizontal a 390 (formulario)', (await overflow(page)) === 0);
  await dialog.getByTestId('referral-kind').scrollIntoViewIfNeeded();
  await shot('04b-kind-390');
  await page.setViewportSize({ width: 360, height: 780 });
  await page.waitForTimeout(400);
  const fit360 = await kindLabelsFit();
  check('4: rótulos del selector enteros a 360', fit360.length === 3 && fit360.every((l) => l.fits), fit360);
  check('sin desborde horizontal a 360', (await overflow(page)) === 0);
  await shot('04c-kind-360');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);

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
  const orgText = (await success.innerText()).replace(/\s+/g, ' ');
  check('1b: el éxito de organización no promete el aviso', orgText.includes('Derivación registrada') && orgText.includes('Quedó registrada la derivación a Hospital San Lucas. Si la persona tiene cuenta en el portal, puede recibir un aviso; la ve en su lista de derivaciones.'), orgText);
  check('1a: el botón dice «Derivar»', ((await dialog.getByTestId('referral-submit').innerText()).trim()) === 'Derivar');
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
  let created = 1;

  // 1b: el éxito de un profesional, sin prometer el aviso.
  await dialog.getByRole('radio', { name: /Profesional/ }).click();
  const proInput = dialog.getByTestId('referral-practitioner').locator('input');
  await proInput.fill('valeria');
  await page.getByRole('option').first().click();
  await page.waitForTimeout(800);
  const proService = dialog.getByTestId('referral-service');
  if (await proService.count()) {
    await proService.click();
    await page.getByRole('option').nth(1).click();
  } else {
    await dialog.getByTestId('referral-requested-service').locator('textarea').fill('Interconsulta de control');
    await dialog.getByTestId('referral-clinical-summary').locator('textarea').fill('Control evolutivo.');
  }
  await dialog.getByTestId('referral-type').click();
  await page.getByRole('option', { name: 'Interconsulta' }).click();
  check('1c: pista del motivo para un profesional', (await dialog.getByText('Puede aparecer en el aviso a la persona.').count()) === 1);
  await dialog.getByTestId('referral-submit').click();
  await success.waitFor({ timeout: 20_000 });
  await page.waitForTimeout(600);
  const proText = (await success.innerText()).replace(/\s+/g, ' ');
  check('1b: el éxito de profesional no promete el aviso', /Derivación registrada.*Quedó registrada la derivación a .+\. Si la persona tiene cuenta en el portal, puede recibir un aviso para ver la ficha y reservar\./.test(proText), proText);
  check('HIGH: el éxito de profesional se ve a 390', (await inViewport(success)).inside);
  await shot('08b-submit-success-practitioner-390');
  created += 1;

  // 1a/1b/1c: externo — «Registrar la derivación», sin aviso.
  async function fillExternal(name) {
    await dialog.getByRole('radio', { name: /fuera de la plataforma/ }).click();
    await dialog.getByTestId('referral-external-name').fill(name);
    await dialog.getByTestId('referral-requested-service').locator('textarea').fill('Hemodiálisis tres veces por semana');
    await dialog.getByTestId('referral-clinical-summary').locator('textarea').fill('ERC estadio 5.');
    await dialog.getByTestId('referral-type').click();
    await page.getByRole('option', { name: 'Interconsulta' }).click();
  }
  // final 6: sin nombre, el resumen de un externo se titula «Revise antes de registrar».
  await dialog.getByRole('radio', { name: /fuera de la plataforma/ }).click();
  await dialog.getByTestId('referral-external-name').fill('x');
  await dialog.getByTestId('referral-requested-service').locator('textarea').fill('');
  await dialog.getByTestId('referral-clinical-summary').locator('textarea').fill('');
  await dialog.getByTestId('referral-submit').click();
  const extIssues = dialog.getByTestId('referral-issues');
  await extIssues.waitFor({ timeout: 10_000 });
  check('final 6: el resumen de un externo dice «Revise antes de registrar»', (await extIssues.innerText()).includes('Revise antes de registrar'));
  check('LOW 10 (ronda 2): el resumen lleva viñetas', (await extIssues.locator('ul').evaluate((e) => getComputedStyle(e).listStyleType)) === 'disc');
  await extIssues.scrollIntoViewIfNeeded();
  await shot('08g-external-issues-390');
  await fillExternal('Centro de Hemodiálisis Norte');
  check('1a: el botón de externo dice «Registrar la derivación»', ((await dialog.getByTestId('referral-submit').innerText()).trim()) === 'Registrar la derivación');
  check('1c: pista del motivo para un externo', (await dialog.getByText('Queda en el registro; entréguele la derivación a la persona.').count()) === 1);
  await dialog.getByTestId('referral-submit').click();
  await success.waitFor({ timeout: 20_000 });
  await page.waitForTimeout(600);
  const extText = (await success.innerText()).replace(/\s+/g, ' ');
  check('1b: el éxito de externo dice que no hay aviso', extText.includes('no recibe aviso'), extText);
  await shot('08c-submit-success-external-390');
  created += 1;

  // L-2: S7 con la relectura quieta (reloj en pausa): «Actualizando · lista de las HH:MM».
  await fillExternal('Centro de Diálisis Sur');
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
  await dialog.getByTestId('referral-submit').click();
  await page.clock.runFor(150);
  const refreshing = dialog.getByTestId('referral-list-refreshing');
  await refreshing.waitFor({ timeout: 5_000 });
  const refreshingText = (await refreshing.innerText()).trim();
  check('L-2: S7 «Actualizando · lista de las HH:MM» al releer', /^Actualizando · lista de las \d{2}:\d{2}$/.test(refreshingText), refreshingText);
  check('L-2: la lista sigue a la vista durante la relectura', (await dialog.getByTestId('referral-row').count()) > 0);
  await refreshing.scrollIntoViewIfNeeded();
  await shot('08d-list-s7-refreshing-390');
  await page.clock.resume();
  await page.waitForFunction(() => !document.querySelector('[data-testid="referral-list-refreshing"]'), null, { timeout: 10_000 });
  created += 1;

  // L-4: la relectura falla con la lista a la vista: no se borra, se dice en línea.
  await fillExternal('Centro de Nefrología Este');
  await page.evaluate(() =>
    sessionStorage.setItem('mock:fallos', JSON.stringify([{ patron: '/referrals', modo: 'error', metodos: ['GET'] }])),
  );
  await dialog.getByTestId('referral-submit').click();
  const refreshError = dialog.getByTestId('referral-list-refresh-error');
  await refreshError.waitFor({ timeout: 10_000 });
  check('L-4: la relectura fallida no borra la lista', (await dialog.getByTestId('referral-row').count()) > 0);
  const tileDuring = (await tile.innerText()).replace(/\s+/g, ' ');
  check('L-4 / 3: la casilla conserva la cifra y avisa que puede faltar una («al menos N»)', /al menos \d+\s+derivaci/.test(tileDuring) && !tileDuring.includes('No se pudo contar'), tileDuring);
  check('final 3: el aviso de relectura muestra el «Código de soporte» con copiar', (await refreshError.locator('app-support-code code').innerText()) === 'mock-fallo' && (await refreshError.getByRole('button', { name: 'Copiar código' }).count()) === 1);
  await refreshError.scrollIntoViewIfNeeded();
  await shot('08e-list-refresh-error-390');
  await page.evaluate(() => sessionStorage.removeItem('mock:fallos'));
  // Con teclado, para que el anillo de foco del título se vea (`:focus-visible`).
  await refreshError.getByRole('button', { name: 'Reintentar' }).focus();
  await page.keyboard.press('Enter');
  await refreshError.waitFor({ state: 'detached', timeout: 10_000 });
  await page.waitForTimeout(400);
  const afterRetry = await page.evaluate(() => {
    const a = document.activeElement;
    return { id: a?.id ?? null, inDialog: !!a?.closest('dialog') };
  });
  check('2: tras «Reintentar» el foco queda en el título de la lista, dentro del diálogo', afterRetry.id === 'referral-list-title' && afterRetry.inDialog, afterRetry);
  const ring = await page.evaluate(() => {
    const cs = getComputedStyle(document.getElementById('referral-list-title'));
    return { style: cs.outlineStyle, width: cs.outlineWidth, offset: cs.outlineOffset };
  });
  check('final 5: el título enfocado con teclado lleva el anillo de 2 px con offset', ring.style === 'solid' && ring.width === '2px' && ring.offset !== '0px', ring);
  await shot('08f-list-retry-focus-390');
  created += 1;

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
  check(`persistencia: tras F5 la casilla cuenta ${created} más`, after === before + created, `${before} → ${after}`);
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

  /* -- final 3/4: S9 con «Código de soporte»: el de la lista y el de view-state-host -- */
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() =>
    sessionStorage.setItem('mock:fallos', JSON.stringify([{ patron: '/referrals', modo: 'error', metodos: ['GET'] }])),
  );
  await page.reload({ waitUntil: 'commit' });
  await tile.waitFor({ timeout: 120_000 });
  await tile.click();
  const listError = dialog.getByTestId('referral-list-error');
  await listError.waitFor({ timeout: 30_000 });
  const listErrorText = (await listError.innerText()).replace(/\s+/g, ' ');
  check('final 4: el S9 de la lista dice que falló la lista, con su código', listErrorText.includes('No pudimos cargar la lista') && listErrorText.includes('Código de soporte:'), listErrorText);
  await listError.scrollIntoViewIfNeeded();
  await shot('15-list-s9-390');
  await dialog.getByRole('button', { name: 'Cerrar', exact: true }).first().click();
  await dialog.waitFor({ state: 'detached', timeout: 10_000 });
  await page.evaluate(() =>
    sessionStorage.setItem('mock:fallos', JSON.stringify([{ patron: '/clinical/patients', modo: 'error', metodos: ['GET'] }])),
  );
  await page.reload({ waitUntil: 'commit' });
  const vshError = page.locator('app-view-state-host app-support-code').first();
  await vshError.waitFor({ timeout: 60_000 });
  check('final 3: view-state-host pinta el código con el mismo componente', (await vshError.locator('code').innerText()).length > 0);
  await vshError.scrollIntoViewIfNeeded();
  await shot('16-view-state-host-s9-390');
  await page.evaluate(() => sessionStorage.removeItem('mock:fallos'));

  /* -- La campana de la persona: ORGANIZATION_PROFILE → /o/{slug} (L-3) ---- */
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByTestId('header-cuenta').click();
  await page.getByTestId('header-cerrar-sesion').first().click();
  const confirmLogout = page.getByRole('button', { name: /Cerrar sesión/ }).last();
  await page.waitForTimeout(500);
  if (!page.url().includes('/auth') && (await confirmLogout.count())) await confirmLogout.click();
  await page.waitForURL(/\/auth|\/$/, { timeout: 30_000 }).catch(() => {});
  await page.goto(`${base}/auth`, { waitUntil: 'commit' });
  await page.getByTestId('login-identifier').waitFor({ timeout: 60_000 });
  await page.getByTestId('login-identifier').fill('paciente@alovida.mock');
  await page.getByTestId('login-password').fill('mock');
  await page.getByTestId('login-submit').click();
  await page.getByTestId('campana').first().waitFor({ timeout: 60_000 });
  await page.getByTestId('campana').first().click();
  const orgNotice = page.getByTestId('campana-item').filter({ hasText: 'Su médico le derivó a Hospital San Lucas' }).first();
  await orgNotice.waitFor({ timeout: 15_000 });
  const noticeText = (await orgNotice.innerText()).replace(/\s+/g, ' ');
  check('L-3: el aviso de la organización llega con el texto de la API', noticeText.includes('Puede ver su ficha y reservar una cita desde su portal.'), noticeText);
  check('L-3: el aviso es un enlace (botón que navega)', (await orgNotice.evaluate((e) => e.tagName)) === 'BUTTON');
  await shot('13-bell-organization-1440');
  await orgNotice.click();
  await page.waitForURL(/\/o\/hospital-san-lucas$/, { timeout: 30_000 }).catch(() => {});
  check('L-3: abre la ficha pública /o/hospital-san-lucas', new URL(page.url()).pathname === '/o/hospital-san-lucas', page.url());
  await page.waitForTimeout(1500);
  await shot('14-bell-opens-organization-1440');

  check('13: sin NG0955 (claves de @for duplicadas) en la consola', !runLog.console.some((c) => c.includes('NG0955')));
  check('13: sin el 403 de las sedes de una organización ajena', !runLog.console.some((c) => c.includes('/branches') && c.includes('403')));
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
