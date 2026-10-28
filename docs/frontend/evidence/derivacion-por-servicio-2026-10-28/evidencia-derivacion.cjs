// Evidencia de navegador de la derivación por servicio (consulta, modo maqueta).
// Uso: node evidencia-derivacion.cjs <baseUrl> <carpetaDeSalida>
// Nunca espera `networkidle` (con HMR no llega): espera selectores concretos.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const [base = 'http://localhost:4321', salida] = process.argv.slice(2);
fs.mkdirSync(salida, { recursive: true });

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

const PACIENTE = uuid('pid-paciente');
const registro = { consola: [], pageErrors: [], fallidas: [], red: [], aserciones: [] };

function afirmar(nombre, cond, detalle = '') {
  registro.aserciones.push({ nombre, ok: Boolean(cond), detalle: String(detalle) });
  console.log(`${cond ? 'OK ' : 'FALLA'} ${nombre} ${detalle}`);
}

async function desborde(page) {
  return page.evaluate(() => Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth));
}

(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') registro.consola.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => registro.pageErrors.push(String(e)));
  page.on('requestfailed', (r) => registro.fallidas.push(`${r.method()} ${r.url()} ${r.failure()?.errorText}`));
  page.on('request', (r) => {
    if (r.url().includes('/referrals')) registro.red.push(`→ ${r.method()} ${new URL(r.url()).pathname}${new URL(r.url()).search} ${r.postData() ?? ''}`);
  });

  // La maqueta contesta dentro del interceptor: no hay respuesta de red que
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

  await page.goto(`${base}/medical-records/${PACIENTE}/consultation`, { waitUntil: 'commit' });
  await page.getByTestId('consulta-rejilla').waitFor({ timeout: 120_000 });
  const casilla = page.getByTestId('consulta-casilla-derivacion');
  await casilla.waitFor();
  // La cifra llega con la lectura de derivaciones.
  await page.waitForFunction(
    () => /en la historia|\d/.test(document.querySelector('[data-testid="consulta-casilla-derivacion"]')?.textContent ?? ''),
    null,
    { timeout: 30_000 },
  ).catch(() => {});
  const textoCasilla = (await casilla.textContent()) ?? '';
  const antes = Number((textoCasilla.match(/(\d+)/) ?? [])[1] ?? NaN);
  afirmar('la casilla «Derivar» está en la rejilla', await casilla.isVisible());
  afirmar('la casilla cuenta las derivaciones', Number.isFinite(antes), textoCasilla.replace(/\s+/g, ' ').trim());
  afirmar('sin desborde horizontal a 1440', (await desborde(page)) === 0);
  await page.getByTestId('consulta-rejilla').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(salida, 'consulta-rejilla-1440.png') });

  // Abrir el encuentro: sin él no hay formulario (regla del bloque).
  const abrir = page.getByTestId('consulta-abrir-encuentro');
  if (await abrir.count()) {
    await abrir.click();
    await page.getByTestId('encuentros-en-curso').waitFor({ timeout: 30_000 });
  }

  await casilla.click();
  const modal = page.getByRole('dialog');
  await modal.waitFor();
  await modal.getByTestId('derivacion-clase').waitFor();
  await modal.getByTestId('derivacion-lista').waitFor({ timeout: 30_000 });
  const filasAntes = await modal.getByTestId('derivacion-fila').count();
  afirmar('el modal muestra la lista de derivaciones', filasAntes >= 1, `${filasAntes} filas`);
  afirmar('el tipo viene en Tratamiento', (await modal.getByTestId('derivacion-tipo').textContent())?.includes('Tratamiento'));
  await page.screenshot({ path: path.join(salida, 'derivacion-modal-1440.png') });

  // Organización médica → un destino SIN servicios: S3 con próxima acción.
  await modal.getByRole('radio', { name: 'Organización médica' }).click();
  await modal.getByTestId('derivacion-organizacion').locator('input').fill('laboratorio');
  await page.getByRole('option', { name: /Laboratorio Central/ }).click();
  await modal.getByText('no tiene servicios publicados').waitFor({ timeout: 30_000 });
  afirmar('un destino sin servicios es S3 con próxima acción', await modal.getByText('busque otro destino').isVisible());
  await modal.getByTestId('derivacion-servicios').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(salida, 'derivacion-sin-servicios-s3-1440.png') });

  // Otro destino → buscar → elegir → servicios.
  const buscador = modal.getByTestId('derivacion-organizacion').locator('input');
  await buscador.fill('lucas');
  await page.getByRole('option', { name: /Hospital San Lucas/ }).click();
  await modal.getByTestId('derivacion-servicio').waitFor({ timeout: 30_000 });
  await modal.getByTestId('derivacion-servicio').click();
  const opciones = page.getByRole('option');
  await opciones.nth(1).waitFor({ timeout: 15_000 });
  const nOpciones = await opciones.count();
  afirmar('el destino trae sus servicios', nOpciones >= 2, `${nOpciones} opciones`);
  await page.screenshot({ path: path.join(salida, 'derivacion-servicios-1440.png') });
  const elegida = (await opciones.nth(1).textContent())?.trim() ?? '';
  await opciones.nth(1).click();
  await modal.getByTestId('derivacion-motivo').locator('textarea').fill('Rehabilitación de rodilla tras la consulta.');
  await page.screenshot({ path: path.join(salida, 'derivacion-formulario-lleno-1440.png') });

  await modal.getByTestId('derivacion-enviar').click();
  await modal.getByTestId('derivacion-exito').waitFor({ timeout: 30_000 });
  // Relectura: la lista crece en una y la fila nueva trae el servicio.
  await page.waitForFunction(
    (n) => document.querySelectorAll('[data-testid="derivacion-fila"]').length === n + 1,
    filasAntes,
    { timeout: 30_000 },
  );
  await modal.getByTestId('derivacion-fila').first().getByText('Solicitada').waitFor({ timeout: 15_000 }).catch(() => {});
  const primera = (await modal.getByTestId('derivacion-fila').first().textContent())?.replace(/\s+/g, ' ') ?? '';
  const servicioElegido = elegida.split(' · ')[0];
  afirmar('tras derivar, la relectura trae la nueva al principio', primera.includes('Tratamiento · Hospital San Lucas'), primera);
  afirmar('la fila nueva trae el servicio elegido', primera.includes(servicioElegido), servicioElegido);
  afirmar('la fila nueva está Solicitada', primera.includes('Solicitada'));
  await page.screenshot({ path: path.join(salida, 'derivacion-tras-emitir-1440.png') });

  // Persistencia: recargar la página y volver a leer.
  await page.keyboard.press('Escape');
  await page.reload({ waitUntil: 'commit' });
  await page.getByTestId('consulta-casilla-derivacion').waitFor({ timeout: 120_000 });
  await page.waitForFunction(
    (n) => (document.querySelector('[data-testid="consulta-casilla-derivacion"]')?.textContent ?? '').includes(String(n)),
    antes + 1,
    { timeout: 30_000 },
  ).catch(() => {});
  const despues = Number(((await page.getByTestId('consulta-casilla-derivacion').textContent()) ?? '').match(/(\d+)/)?.[1] ?? NaN);
  afirmar('tras recargar (F5), la casilla cuenta una más', despues === antes + 1, `${antes} → ${despues}`);
  await page.getByTestId('consulta-casilla-derivacion').click();
  await page.getByRole('dialog').getByTestId('derivacion-lista').waitFor({ timeout: 30_000 });
  const trasRecarga = (await page.getByTestId('derivacion-fila').first().textContent())?.replace(/\s+/g, ' ') ?? '';
  afirmar('tras recargar, la derivación sigue en la lista', trasRecarga.includes(servicioElegido), trasRecarga);
  await page.screenshot({ path: path.join(salida, 'derivacion-tras-recargar-1440.png') });

  // Angosto.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  const segmentos = await page.getByRole('dialog').getByRole('radio').evaluateAll((els) =>
    els.map((b) => { const r = b.querySelector('.segmentado__rotulo'); return r ? r.scrollWidth <= r.clientWidth + 1 : true; }),
  );
  afirmar('a 390 los rótulos del selector de destino no se cortan', segmentos.every(Boolean), JSON.stringify(segmentos));
  afirmar('sin desborde horizontal a 390 con el modal abierto', (await desborde(page)) === 0);
  const caja = await page.getByRole('dialog').boundingBox();
  afirmar('el modal cabe a lo ancho a 390', caja !== null && caja.x >= 0 && caja.x + caja.width <= 390.5, JSON.stringify(caja));
  await page.screenshot({ path: path.join(salida, 'derivacion-modal-390.png') });
  await page.getByRole('dialog').getByTestId('derivacion-lista').scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(salida, 'derivacion-lista-390.png') });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.evaluate(() => window.scrollTo(0, 0));
  await casilla.scrollIntoViewIfNeeded();
  afirmar('sin desborde horizontal a 390 en la rejilla', (await desborde(page)) === 0);
  await page.screenshot({ path: path.join(salida, 'consulta-rejilla-390.png') });

  fs.writeFileSync(path.join(salida, 'registro.json'), JSON.stringify(registro, null, 2));
  await browser.close();
  const fallas = registro.aserciones.filter((a) => !a.ok).length;
  console.log(`aserciones: ${registro.aserciones.length - fallas}/${registro.aserciones.length} · pageErrors: ${registro.pageErrors.length} · consola(err/warn): ${registro.consola.length} · fallidas: ${registro.fallidas.length}`);
  process.exit(fallas === 0 ? 0 : 1);
})().catch(async (e) => {
  console.error(e);
  fs.writeFileSync(path.join(salida, 'registro.json'), JSON.stringify({ ...registro, error: String(e) }, null, 2));
  process.exit(2);
});
