// Evidencia de navegador de la derivación por servicio (consulta, modo maqueta).
// Uso: node referral-evidence.cjs <baseUrl> <carpetaDeSalida>
// Nunca espera `networkidle` (con HMR no llega): espera selectores concretos.
const { chromium } = require('/home/user/mantra-core-health/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');

const [base = 'http://localhost:4321', outDir] = process.argv.slice(2);
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
const runLog = { console: [], pageErrors: [], failed: [], network: [], assertions: [] };

function check(name, ok, detail = '') {
  runLog.assertions.push({ name, ok: Boolean(ok), detail: String(detail) });
  console.log(`${ok ? 'OK ' : 'FALLA'} ${name} ${detail}`);
}

async function horizontalOverflow(page) {
  return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
}

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') runLog.console.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => runLog.pageErrors.push(String(e)));
  page.on('requestfailed', (r) => runLog.failed.push(`${r.method()} ${r.url()} ${r.failure()?.errorText}`));
  page.on('request', (r) => {
    if (r.url().includes('/referrals')) runLog.network.push(`→ ${r.method()} ${new URL(r.url()).pathname}${new URL(r.url()).search} ${r.postData() ?? ''}`);
  });

  // La maqueta contesta dentro del interceptor: no hay respuesta de network que
  // escuchar, así que lo que se registra es la petición y lo que pinta.
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
  await page.getByTestId('consulta-rejilla').waitFor({ timeout: 120_000 });
  const tile = page.getByTestId('consulta-casilla-derivacion');
  await tile.waitFor();
  // La cifra llega con la lectura de derivaciones.
  await page.waitForFunction(
    () => /en la historia|\d/.test(document.querySelector('[data-testid="consulta-casilla-derivacion"]')?.textContent ?? ''),
    null,
    { timeout: 30_000 },
  ).catch(() => {});
  const tileText = (await tile.textContent()) ?? '';
  const before = Number((tileText.match(/(\d+)/) ?? [])[1] ?? NaN);
  check('la casilla «Derivar» está en la rejilla', await tile.isVisible());
  check('la casilla cuenta las derivaciones', Number.isFinite(before), tileText.replace(/\s+/g, ' ').trim());
  check('sin desborde horizontal a 1440', (await horizontalOverflow(page)) === 0);
  await page.getByTestId('consulta-rejilla').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(outDir, 'consultation-grid-1440.png') });

  // Abrir el encuentro: sin él no hay formulario (regla del bloque).
  const openEncounter = page.getByTestId('consulta-abrir-encuentro');
  if (await openEncounter.count()) {
    await openEncounter.click();
    await page.getByTestId('encuentros-en-curso').waitFor({ timeout: 30_000 });
  }

  await tile.click();
  const modal = page.getByRole('dialog');
  await modal.waitFor();
  await modal.getByTestId('referral-kind').waitFor();
  await modal.getByTestId('referral-list').waitFor({ timeout: 30_000 });
  const rowsBefore = await modal.getByTestId('referral-row').count();
  check('el modal muestra la lista de derivaciones', rowsBefore >= 1, `${rowsBefore} filas`);
  check('el tipo viene en Tratamiento', (await modal.getByTestId('referral-type').textContent())?.includes('Tratamiento'));
  await page.screenshot({ path: path.join(outDir, 'referral-modal-1440.png') });

  // Organización médica → un destino SIN servicios: S3 con próxima acción.
  await modal.getByRole('radio', { name: 'Organización médica' }).click();
  await modal.getByTestId('referral-organization').locator('input').fill('laboratorio');
  await page.getByRole('option', { name: /Laboratorio Central/ }).click();
  await modal.getByText('no tiene servicios publicados').waitFor({ timeout: 30_000 });
  check('un destino sin servicios es S3 con próxima acción', await modal.getByText('busque otro destino').isVisible());
  await modal.getByTestId('referral-services').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(outDir, 'referral-no-services-s3-1440.png') });

  // Otro destino → buscar → elegir → servicios.
  const searchInput = modal.getByTestId('referral-organization').locator('input');
  await searchInput.fill('lucas');
  await page.getByRole('option', { name: /Hospital San Lucas/ }).click();
  await modal.getByTestId('referral-service').waitFor({ timeout: 30_000 });
  await modal.getByTestId('referral-service').click();
  const options = page.getByRole('option');
  await options.nth(1).waitFor({ timeout: 15_000 });
  const optionCount = await options.count();
  check('el destino trae sus servicios', optionCount >= 2, `${optionCount} opciones`);
  await page.screenshot({ path: path.join(outDir, 'referral-services-1440.png') });
  const picked = (await options.nth(1).textContent())?.trim() ?? '';
  await options.nth(1).click();
  await modal.getByTestId('referral-reason').locator('textarea').fill('Rehabilitación de rodilla tras la consulta.');
  await page.screenshot({ path: path.join(outDir, 'referral-form-filled-1440.png') });

  await modal.getByTestId('referral-submit').click();
  await modal.getByTestId('referral-success').waitFor({ timeout: 30_000 });
  // Relectura: la lista crece en una y la fila nueva trae el servicio.
  await page.waitForFunction(
    (n) => document.querySelectorAll('[data-testid="referral-row"]').length === n + 1,
    rowsBefore,
    { timeout: 30_000 },
  );
  await modal.getByTestId('referral-row').first().getByText('Solicitada').waitFor({ timeout: 15_000 }).catch(() => {});
  const firstRow = (await modal.getByTestId('referral-row').first().textContent())?.replace(/\s+/g, ' ') ?? '';
  const pickedService = picked.split(' · ')[0];
  check('tras derivar, la relectura trae la nueva al principio', firstRow.includes('Tratamiento · Hospital San Lucas'), firstRow);
  check('la fila nueva trae el servicio elegido', firstRow.includes(pickedService), pickedService);
  check('la fila nueva está Solicitada', firstRow.includes('Solicitada'));
  await page.screenshot({ path: path.join(outDir, 'referral-after-submit-1440.png') });

  // Persistencia: recargar la página y volver a leer.
  await page.keyboard.press('Escape');
  await page.reload({ waitUntil: 'commit' });
  await page.getByTestId('consulta-casilla-derivacion').waitFor({ timeout: 120_000 });
  await page.waitForFunction(
    (n) => (document.querySelector('[data-testid="consulta-casilla-derivacion"]')?.textContent ?? '').includes(String(n)),
    before + 1,
    { timeout: 30_000 },
  ).catch(() => {});
  const after = Number(((await page.getByTestId('consulta-casilla-derivacion').textContent()) ?? '').match(/(\d+)/)?.[1] ?? NaN);
  check('tras recargar (F5), la casilla cuenta una más', after === before + 1, `${before} → ${after}`);
  await page.getByTestId('consulta-casilla-derivacion').click();
  await page.getByRole('dialog').getByTestId('referral-list').waitFor({ timeout: 30_000 });
  const afterReload = (await page.getByTestId('referral-row').first().textContent())?.replace(/\s+/g, ' ') ?? '';
  check('tras recargar, la derivación sigue en la lista', afterReload.includes(pickedService), afterReload);
  await page.screenshot({ path: path.join(outDir, 'referral-after-reload-1440.png') });

  // Angosto.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  const segments = await page.getByRole('dialog').getByRole('radio').evaluateAll((els) =>
    els.map((b) => { const r = b.querySelector('.segmentado__rotulo'); return r ? r.scrollWidth <= r.clientWidth + 1 : true; }),
  );
  check('a 390 los rótulos del selector de destino no se cortan', segments.every(Boolean), JSON.stringify(segments));
  check('sin desborde horizontal a 390 con el modal abierto', (await horizontalOverflow(page)) === 0);
  const box = await page.getByRole('dialog').boundingBox();
  check('el modal cabe a lo ancho a 390', box !== null && box.x >= 0 && box.x + box.width <= 390.5, JSON.stringify(box));
  await page.screenshot({ path: path.join(outDir, 'referral-modal-390.png') });
  await page.getByRole('dialog').getByTestId('referral-list').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(outDir, 'referral-list-390.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollTo(0, 0));
  await tile.scrollIntoViewIfNeeded();
  check('sin desborde horizontal a 390 en la rejilla', (await horizontalOverflow(page)) === 0);
  await page.screenshot({ path: path.join(outDir, 'consultation-grid-390.png') });

  fs.writeFileSync(path.join(outDir, 'run-log.json'), JSON.stringify(runLog, null, 2));
  await browser.close();
  const failures = runLog.assertions.filter((a) => !a.ok).length;
  console.log(`assertions: ${runLog.assertions.length - failures}/${runLog.assertions.length} · pageErrors: ${runLog.pageErrors.length} · console(err/warn): ${runLog.console.length} · failed: ${runLog.failed.length}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(async (e) => {
  console.error(e);
  fs.writeFileSync(path.join(outDir, 'run-log.json'), JSON.stringify({ ...runLog, error: String(e) }, null, 2));
  process.exit(2);
});
