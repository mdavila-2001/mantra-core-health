/**
 * Recorrido de C3 en navegador real contra `yarn dev --port 4220`, entrando
 * directo a la consulta de un paciente sembrado (`PACIENTE_ID`):
 * tabla de presuntivos → Confirmar (espejo del 422, luego decisión) → Rechazar → 375 px.
 */
import { chromium } from 'playwright';

const BASE = process.env.PW_BASE_URL ?? 'http://localhost:4220';
const SALIDA = process.env.SALIDA;
const PACIENTE_ID = process.env.PACIENTE_ID;

async function asentarse(page) {
  let anterior = '';
  let iguales = 0;
  for (let i = 0; i < 25; i += 1) {
    await page.waitForTimeout(300);
    const ahora = await page.evaluate(
      () =>
        `${document.querySelectorAll('app-card').length}:${document.body.scrollHeight}:${
          document.querySelectorAll('app-skeleton, app-spinner').length
        }`,
    );
    iguales = ahora === anterior ? iguales + 1 : 0;
    anterior = ahora;
    if (iguales >= 2 && ahora.endsWith(':0')) return;
  }
}

const estados = async (page) =>
  (await page.locator('[data-testid="diagnostico-tabla"] app-badge').allTextContents())
    .map((e) => e.trim())
    .join(' | ');

const navegador = await chromium.launch();
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await contexto.newPage();
const problemas = [];
page.on('pageerror', (e) => problemas.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') problemas.push(`console: ${m.text().slice(0, 200)}`);
});
const fallos = [];
page.on('response', (r) => {
  if (r.status() >= 400 && r.url().includes('/verification')) fallos.push(`${r.status()} ${r.url()}`);
});

await page.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded' });
await page.getByTestId('login-identifier').fill('medica@alovida.mock');
await page.getByTestId('login-password').fill('cualquiera');
await page.getByTestId('login-submit').click();
await page.waitForURL((u) => !u.pathname.startsWith('/auth') || u.pathname.includes('organization'), {
  timeout: 90_000,
});
if (page.url().includes('/auth/organization')) {
  await page.getByRole('button').first().click();
  await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60_000 });
}

await page.goto(`${BASE}/medical-records/${PACIENTE_ID}/consultation`, { waitUntil: 'domcontentloaded' });
await asentarse(page);
console.log('consulta:', page.url());
await page.screenshot({ path: `${SALIDA}/00-consulta.png`, fullPage: true });

const casilla = page.getByTestId('consulta-casilla-diagnosticos');
await casilla.waitFor({ state: 'visible', timeout: 30_000 });
await casilla.click();
await page.getByTestId('diagnostico-tabla').waitFor({ state: 'visible', timeout: 30_000 });
await asentarse(page);
await page.screenshot({ path: `${SALIDA}/01-tabla-presuntivos.png`, fullPage: true });
const filas = await page.locator('[data-testid^="diagnostico-fila-"]').allTextContents();
console.log('filas:', filas.map((f) => f.trim()).join(' | '));
console.log('estados:', await estados(page));

const confirmar = page.locator('[data-testid^="diagnostico-confirmar-"]');
console.log('presuntivos con acciones:', await confirmar.count());
if ((await confirmar.count()) === 0) {
  console.log('SIN PRESUNTIVO: no hay qué decidir');
  await navegador.close();
  process.exit(2);
}
const idConfirmar = (await confirmar.first().getAttribute('data-testid')).replace(
  'diagnostico-confirmar-',
  '',
);

await confirmar.first().click();
await page.getByTestId('verificar-formulario').waitFor({ state: 'visible', timeout: 30_000 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${SALIDA}/02-dialogo-confirmar.png`, fullPage: true });
const opciones = await page.getByTestId('verificar-evidencia').locator('option').allTextContents();
console.log('evidencias ofrecidas:', opciones.length, '·', opciones.slice(0, 4).join(' | '));

await page.getByTestId('verificar-enviar').click();
await page.waitForTimeout(400);
const textoDialogo = await page.locator('app-diagnosis-verify-dialog').innerText();
console.log(
  'espejo del 422:',
  textoDialogo.includes('Escribí el motivo o elegí una evidencia') ? 'marca el motivo' : 'NO MARCÓ EL MOTIVO',
  '·',
  textoDialogo.includes('Indicá hasta cuándo') ? 'marca el fin' : 'no marcó el fin',
);
await page.screenshot({ path: `${SALIDA}/03-validacion-antes-de-mandar.png`, fullPage: true });

await page
  .getByTestId('verificar-motivo')
  .locator('textarea')
  .fill('Cuadro clínico compatible; el informe de laboratorio lo respalda.');
const select = page.getByTestId('verificar-evidencia').locator('select');
if ((await select.locator('option').count()) > 1) await select.selectOption({ index: 1 });
const cronica = page.getByTestId('verificar-cronica').locator('input[type="checkbox"]');
const cronicaHabilitada = await cronica.isEnabled();
if (cronicaHabilitada) {
  // El input nativo va oculto detrás del control dibujado: se marca por el rótulo.
  await page.getByTestId('verificar-cronica').locator('label').click();
  if (!(await cronica.isChecked())) await cronica.check({ force: true });
} else {
  await page.getByTestId('verificar-fin').locator('input').fill('05/10/2026');
  await page.keyboard.press('Tab');
}
console.log('crónica habilitada:', cronicaHabilitada);
await page.waitForTimeout(300);
await page.screenshot({ path: `${SALIDA}/04-dialogo-completo.png`, fullPage: true });
await page.getByTestId('verificar-enviar').click();
await page.locator('app-diagnosis-verify-dialog').waitFor({ state: 'detached', timeout: 30_000 });
await asentarse(page);
// El expediente relee al recibir `cambio` y cierra la casilla: se vuelve a abrir para ver la tabla.
if ((await page.getByTestId('diagnostico-tabla').count()) === 0) {
  await page.getByTestId('consulta-casilla-diagnosticos').click();
  await page.getByTestId('diagnostico-tabla').waitFor({ state: 'visible', timeout: 30_000 });
  await asentarse(page);
}
await page.screenshot({ path: `${SALIDA}/05-confirmado-en-tabla.png`, fullPage: true });
console.log(
  'tras confirmar, sigue con acciones',
  idConfirmar,
  ':',
  await page.locator(`[data-testid="diagnostico-confirmar-${idConfirmar}"]`).count(),
);
console.log('estados ahora:', await estados(page));

const rechazar = page.locator('[data-testid^="diagnostico-rechazar-"]');
if ((await rechazar.count()) > 0) {
  const idRechazar = (await rechazar.first().getAttribute('data-testid')).replace(
    'diagnostico-rechazar-',
    '',
  );
  await rechazar.first().click();
  await page.getByTestId('verificar-formulario').waitFor({ state: 'visible', timeout: 30_000 });
  await page
    .getByTestId('verificar-motivo')
    .locator('textarea')
    .fill('Los resultados descartan este diagnóstico.');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SALIDA}/06-dialogo-rechazar.png`, fullPage: true });
  await page.getByTestId('verificar-enviar').click();
  await page.locator('app-diagnosis-verify-dialog').waitFor({ state: 'detached', timeout: 30_000 });
  await asentarse(page);
  if ((await page.getByTestId('diagnostico-tabla').count()) === 0) {
    await page.getByTestId('consulta-casilla-diagnosticos').click();
    await page.getByTestId('diagnostico-tabla').waitFor({ state: 'visible', timeout: 30_000 });
    await asentarse(page);
  }
  await page.screenshot({ path: `${SALIDA}/07-rechazado-en-tabla.png`, fullPage: true });
  console.log(
    'tras rechazar, sigue con acciones',
    idRechazar,
    ':',
    await page.locator(`[data-testid="diagnostico-rechazar-${idRechazar}"]`).count(),
  );
  console.log('estados ahora:', await estados(page));
} else {
  console.log('sin segundo presuntivo para rechazar');
}

await page.setViewportSize({ width: 375, height: 800 });
await page.waitForTimeout(600);
await page.screenshot({ path: `${SALIDA}/08-tabla-375.png`, fullPage: true });
console.log(
  'desborde horizontal a 375:',
  await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
);
console.log('fallos HTTP en /verification:', fallos.length ? fallos.join(' ; ') : 'ninguno');
console.log('errores de consola/página:', problemas.length ? problemas.join(' ;; ') : 'ninguno');
await navegador.close();
