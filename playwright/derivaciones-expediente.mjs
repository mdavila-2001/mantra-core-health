/**
 * Evidencia de la pestaña «Derivaciones» del expediente (contrato §2/§3,
 * consentimiento dirigido + derivación a servicio específico).
 *
 * - UNA tarjeta con pestañas, centrada y a lo ancho (composition-rules §5).
 * - Lista con tipo, destino, servicio, prioridad, estado, vigencia y
 *   consentimiento; detalle en modal con el consentimiento dirigido.
 * - Emitir vacío: resumen de errores y foco al primero; no hay POST.
 * - Mutación completa: UI → POST → respuesta → recarga → UI.
 * - Cinco viewports sin desborde horizontal.
 *
 * Uso: `yarn node playwright/derivaciones-expediente.mjs [urlBase] [carpeta]`.
 * Nunca espera `networkidle` (HMR): espera selectores concretos.
 */
import { mkdirSync } from 'node:fs';
import { chromium } from '@playwright/test';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4300';
const SALIDA = process.argv[3] ?? 'evidencias/derivaciones';
mkdirSync(SALIDA, { recursive: true });

const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond) });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

const navegador = await chromium.launch(
  process.env.PW_CHROMIUM
    ? { executablePath: process.env.PW_CHROMIUM, args: ['--disable-dev-shm-usage'] }
    : {},
);
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
const pg = await contexto.newPage();
const errores = [];
pg.on('pageerror', (e) => errores.push(String(e)));
pg.on('console', (m) => {
  if (m.type() === 'error') errores.push(m.text());
});

await pg.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
await pg.getByTestId('login-identifier').fill('medica@alovida.mock');
await pg.getByTestId('login-password').fill('mockup');
await pg.getByTestId('login-submit').click();
await pg.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
if (pg.url().includes('/auth/organization')) {
  await pg.getByTestId('tenant-opcion').first().click();
  await pg.waitForURL(/\/dashboard/, { timeout: 60_000 });
}

await pg.goto(`${BASE}/medical-records`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
await pg.locator('input.native-input').first().waitFor({ timeout: 60_000 });
await pg.locator('input.native-input').first().fill('Ana');
await pg.locator('a[href*="/medical-records/"]').first().waitFor({ timeout: 30_000 });
const hrefs = await pg
  .locator('a[href*="/medical-records/"]')
  .evaluateAll((as) => as.map((a) => a.getAttribute('href')));
const id = (hrefs.find((h) => /\/medical-records\/[0-9a-f-]{36}$/.test(h ?? '')) ?? '').split('/medical-records/')[1];
const RUTA = `${BASE}/medical-records/${id}`;

async function abrirDerivaciones() {
  await pg.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pg.getByRole('tab', { name: 'Derivaciones', exact: true }).click({ timeout: 60_000 });
  await pg.getByTestId('derivaciones').waitFor({ timeout: 30_000 });
  await pg.getByTestId('derivacion-ver').first().waitFor({ timeout: 30_000 });
}

/* 1 · Lista y geometría ------------------------------------------------- */
await abrirDerivaciones();
const lista = await pg.getByTestId('derivaciones').innerText();
ok('la lista trae el destino externo del corpus boliviano', /\(externo\)/.test(lista));
ok('la lista trae organización · sede resuelta', lista.includes('Hospital San Lucas · Hospital central'));
ok('la lista muestra estados en palabras', /Pendiente|Aceptada|Con contrarreferencia/.test(lista));
ok('ningún uuid en pantalla', !/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-/.test(lista));
const area = await pg.locator('.app-main__inner').first().boundingBox();
const tarjeta = await pg.getByTestId('derivaciones').boundingBox();
const izq = tarjeta.x - area.x;
const der = area.x + area.width - (tarjeta.x + tarjeta.width);
ok('tarjeta a lo ancho (≥ 85 % del área)', tarjeta.width / area.width >= 0.85, `${Math.round((tarjeta.width / area.width) * 100)} %`);
ok('tarjeta centrada (|izq − der| ≤ 2 px)', Math.abs(izq - der) <= 2, `izq ${izq.toFixed(1)} · der ${der.toFixed(1)}`);
await pg.screenshot({ path: `${SALIDA}/01-lista-1440.png`, fullPage: true });

/* 2 · Detalle con consentimiento dirigido -------------------------------- */
await pg.locator('[data-testid="derivacion-ver"][aria-label^="Ver derivación: Terapia"]').first().click();
await pg.getByTestId('derivacion-detalle').waitFor({ timeout: 15_000 });
await pg.waitForTimeout(800);
const detalle = await pg.getByTestId('derivacion-detalle').innerText();
ok('el detalle ofrece el consentimiento dirigido (terapia)', detalle.includes('Consentimiento informado de esta derivación'));
await pg.screenshot({ path: `${SALIDA}/02-detalle-consentimiento.png`, fullPage: false });
await pg.keyboard.press('Escape');
await pg.getByTestId('derivacion-detalle').waitFor({ state: 'detached', timeout: 10_000 });

/* 2b · Responder una entrante: aceptar → recarga → «Aceptada» ---------- */
await pg.locator('[data-testid="derivacion-ver"][aria-label^="Ver derivación: Consulta"]').first().click();
await pg.getByTestId('derivacion-aceptar').click({ timeout: 15_000 });
await pg.getByTestId('dialogo').getByRole('button', { name: 'Aceptar derivación' }).click();
await pg.getByTestId('derivacion-aceptar').waitFor({ state: 'detached', timeout: 15_000 });
ok('aceptar: el detalle ya no ofrece responder', true);
await pg.screenshot({ path: `${SALIDA}/02b-aceptada.png`, fullPage: false });
await abrirDerivaciones();
const filaConsulta = await pg
  .locator('tr', { has: pg.locator('[aria-label^="Ver derivación: Consulta"]') })
  .first()
  .innerText();
ok('aceptar: tras recargar la fila dice «Aceptada»', filaConsulta.includes('Aceptada'), filaConsulta.replace(/\s+/g, ' '));

/* 3 · Emitir vacío -------------------------------------------------------- */
await pg.getByRole('tab', { name: 'Nueva derivación' }).click();
await pg.getByText('Paso 1 de 5').waitFor({ timeout: 10_000 });
await pg.screenshot({ path: `${SALIDA}/03-formulario-1440.png`, fullPage: true });
// La maqueta resuelve en el interceptor (sin red): lo escrito se mira en
// la tabla persistida del simulador, `sessionStorage['mock.derivaciones']`.
const filasGuardadas = () =>
  pg.evaluate(() => {
    try {
      return JSON.parse(sessionStorage.getItem('mock.derivaciones') ?? '{"filas":[]}').filas;
    } catch {
      return [];
    }
  });
const antes = (await filasGuardadas()).length;
await pg.getByRole('button', { name: 'Emitir derivación' }).click();
await pg.getByTestId('derivacion-resumen-errores').waitFor({ timeout: 10_000 });
const foco = await pg.evaluate(() => document.activeElement?.closest('[data-campo]')?.getAttribute('data-campo'));
ok('vacío: no se escribió nada', (await filasGuardadas()).length === antes);
ok('vacío: foco en el primer error (tipo)', foco === 'referralType', String(foco));
await pg.screenshot({ path: `${SALIDA}/04-errores.png`, fullPage: true });

/* 4 · Emitir de verdad: UI → POST → respuesta → recarga → UI ------------ */
const servicio = `Fisioterapia de hombro, 8 sesiones (${Date.now() % 100000})`;
await pg.getByTestId('derivacion-tipo').locator('select').selectOption({ label: 'Terapia' });
await pg.getByText('A un destino fuera de la plataforma', { exact: true }).click();
await pg.getByTestId('derivacion-externo-nombre').fill('Centro de Rehabilitación Física Santa Cruz');
await pg.getByTestId('derivacion-externo-contacto').fill('3 3345678');
await pg.getByTestId('derivacion-servicio').fill(servicio);
// La consulta donde se decidió: la más reciente. A ella se ata también el
// consentimiento (la API exige `encounterId`).
// índice 0: el marcador oculto; 1: «Sin consulta asociada»; 2: la más reciente.
await pg.getByTestId('derivacion-cita').locator('select').selectOption({ index: 2 });
await pg.getByTestId('derivacion-resumen').locator('textarea').fill('Tendinopatía del supraespinoso derecho, 3 meses, sin respuesta a AINE.');
await pg.getByRole('button', { name: 'Emitir derivación' }).click();
await pg.getByTestId('derivacion-proximo-paso').waitFor({ timeout: 15_000 });
const guardada = (await filasGuardadas()).find((f) => f.requestedServiceText === servicio);
ok('POST /referrals persistido por el simulador', guardada !== undefined, guardada?.id);
ok(
  'lo persistido lleva tipo, destino externo, servicio, resumen y estado',
  guardada?.referralType === 'THERAPY' &&
    guardada?.targetExternalName === 'Centro de Rehabilitación Física Santa Cruz' &&
    guardada?.clinicalSummary?.startsWith('Tendinopatía') &&
    guardada?.status === 'PENDING' &&
    typeof guardada?.sourceEncounterId === 'string',
);
ok('emitida: se abre el detalle con el próximo paso (consentimiento)', true);
await pg.screenshot({ path: `${SALIDA}/05-emitida-proximo-paso.png`, fullPage: false });

/* 4b · Consentimiento dirigido: panel → ACCEPTED → vínculo → F5 -------- */
const panel = pg.getByTestId('consentimiento-panel');
await panel.waitFor({ timeout: 15_000 });
await pg.getByTestId('consentimiento-beneficios').waitFor({ timeout: 15_000 });
await pg.screenshot({ path: `${SALIDA}/05a-panel.png`, fullPage: false });
ok('el panel tiene una atención a la que atarse', (await pg.getByTestId('consentimiento-sin-encuentro').count()) === 0);
await pg.getByTestId('consentimiento-beneficios').locator('textarea').fill('Recuperar la movilidad del hombro y disminuir el dolor.');
await pg.getByTestId('consentimiento-riesgos').locator('textarea').fill('Dolor muscular transitorio; rara vez, empeoramiento de la tendinopatía.');
await panel.getByRole('tab', { name: /Decisión/ }).click();
await panel.getByText('Acepta', { exact: true }).click();
await pg.getByTestId('consentimiento-revocabilidad').getByText(/Le informé que puede revocar/).click();
await pg.screenshot({ path: `${SALIDA}/05b-consentimiento-decision.png`, fullPage: false });
await pg.getByTestId('consentimiento-registrar').click();
await pg
  .getByTestId('derivacion-detalle-consentimiento')
  .filter({ hasText: 'Aceptado y vinculado' })
  .waitFor({ timeout: 15_000 });
ok('tras registrar: el detalle dice «Aceptado y vinculado» (releído de la API)', true);
await pg.screenshot({ path: `${SALIDA}/05c-consentimiento-vinculado.png`, fullPage: false });

await abrirDerivaciones(); // F5: recarga la página entera
const filaConConsentimiento = pg.locator('tr', { hasText: servicio }).first();
ok(
  'tras F5: la fila muestra el consentimiento vinculado',
  (await filaConConsentimiento.getByTestId('derivacion-consentimiento-vinculado').count()) === 1,
);
await filaConConsentimiento.getByTestId('derivacion-ver').click();
const tras = await pg.getByTestId('derivacion-detalle-consentimiento').innerText({ timeout: 15_000 });
ok('tras F5: el detalle sigue diciendo «Aceptado y vinculado»', tras.includes('Aceptado y vinculado'), tras);
await pg.screenshot({ path: `${SALIDA}/05d-tras-f5-vinculado.png`, fullPage: false });

/* 4c · Cancelar derivación: confirmación → CANCELLED → recarga ---------- */
await pg.getByTestId('derivacion-cancelar').click({ timeout: 15_000 });
await pg.getByTestId('dialogo').getByRole('button', { name: 'Cancelar derivación' }).click();
await pg.getByTestId('derivacion-cancelar').waitFor({ state: 'detached', timeout: 15_000 });
ok('cancelar: CANCELLED en el simulador', (await filasGuardadas()).find((f) => f.requestedServiceText === servicio)?.status === 'CANCELLED');

await abrirDerivaciones();
const recargada = await pg.getByTestId('derivaciones').innerText();
ok('tras recargar, la derivación sigue en la lista', recargada.includes(servicio));
const filaNueva = await pg.locator('tr', { hasText: servicio }).first().innerText();
ok('tras recargar, la fila dice «Anulada»', filaNueva.includes('Anulada'));
await pg.screenshot({ path: `${SALIDA}/06-tras-recarga.png`, fullPage: true });

/* 5 · Viewports ----------------------------------------------------------- */
for (const [w, h] of [[390, 844], [768, 1024], [1024, 768], [1440, 900], [1920, 1080]]) {
  await pg.setViewportSize({ width: w, height: h });
  await abrirDerivaciones();
  const desborde = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`${w}x${h}: sin desborde horizontal de página`, desborde <= 0, `${desborde}px`);
  await pg.getByTestId('derivaciones').screenshot({ path: `${SALIDA}/vp-${w}x${h}-lista.png` });
  await pg.getByRole('tab', { name: 'Nueva derivación' }).click();
  await pg.getByText('Paso 1 de 5').waitFor({ timeout: 10_000 });
  await pg.getByText('A un destino fuera de la plataforma', { exact: true }).click();
  const desborde2 = await pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(`${w}x${h}: formulario sin desborde`, desborde2 <= 0, `${desborde2}px`);
  await pg.getByTestId('derivaciones').screenshot({ path: `${SALIDA}/vp-${w}x${h}-formulario.png` });
}

// La CSP del `ng serve` bloquea los scripts en línea del propio servidor de
// desarrollo (HMR): no son de esta pantalla y se informan aparte.
const csp = errores.filter((e) => e.includes('Content Security Policy'));
if (csp.length > 0) process.stdout.write(`(nota) ${csp.length} avisos de CSP del servidor de desarrollo\n`);
const relevantes = errores.filter(
  (e) => !/favicon|ERR_|Failed to load resource|Content Security Policy/.test(e),
);
ok('sin errores de página/consola', relevantes.length === 0, relevantes.slice(0, 3).join(' | '));
process.stdout.write(`${veredictos.filter((v) => v.cond).length}/${veredictos.length} verificaciones\n`);
await navegador.close();
process.exit(veredictos.every((v) => v.cond) ? 0 : 1);
