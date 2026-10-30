/**
 * Evidencia de la pestaña «Derivaciones» del expediente (consentimiento
 * dirigido + derivación a servicio específico, API v4266).
 *
 * El bloque es el de `dev` (`app-referral-block`, el mismo de la casilla
 * «Derivar» de la consulta) con lo de v4266 encima: destino sede o externo,
 * servicio en texto, resumen clínico, detalle con respuesta, contrarreferencia
 * y anulación, y el consentimiento informado dirigido a la derivación.
 *
 * 1. Abre la atención en la consulta (sin atención abierta no se deriva).
 * 2. Emitir sin servicio ni resumen: errores junto al campo y sin POST.
 * 3. Emitir a un destino externo: UI → POST → respuesta → detalle abierto
 *    con el consentimiento como próximo paso.
 * 4. Consentir: ACCEPTED → «Aceptado y vinculado» → F5 → sigue vinculado.
 * 5. Responder la entrante: aceptar → F5 → «Aceptada».
 * 6. Anular la emitida con confirmación → F5 → «Anulada».
 * 7. 390 px sin desborde horizontal (lista, formulario y detalle).
 *
 * Uso: `node playwright/derivaciones-expediente.mjs [urlBase] [carpeta]`.
 * Nunca espera `networkidle` (HMR): espera selectores concretos.
 */
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../package.json', import.meta.url));
const { chromium } = require('playwright');

const BASE = process.argv[2] ?? 'http://127.0.0.1:4300';
const SALIDA = process.argv[3] ?? 'evidencias/derivaciones';
mkdirSync(SALIDA, { recursive: true });

const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond) });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

/** El chromium preinstalado de la sesión, si está; si no, el de Playwright. */
function chromiumLocal() {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
  if (!existsSync('/opt/pw-browsers')) return undefined;
  const dir = readdirSync('/opt/pw-browsers').find((d) => /^chromium-\d+$/.test(d));
  const exe = dir ? `/opt/pw-browsers/${dir}/chrome-linux64/chrome` : undefined;
  return exe && existsSync(exe) ? exe : undefined;
}

/** El mismo `uuid(semilla)` determinista del simulador (`mock-store.ts`). */
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

const navegador = await chromium.launch({ executablePath: chromiumLocal(), args: ['--disable-dev-shm-usage'] });
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
const pg = await contexto.newPage();
const errores = [];
pg.on('pageerror', (e) => errores.push(String(e)));
pg.on('console', (m) => {
  if (m.type() === 'error') errores.push(m.text());
});
/**
 * La maqueta responde en el interceptor de Angular (sin red): lo escrito se
 * lee de la tabla persistida del simulador en `sessionStorage`, que es lo
 * que la relectura (F5) vuelve a servir.
 */
const stored = (key) =>
  pg.evaluate((k) => {
    try {
      return JSON.parse(sessionStorage.getItem(k) ?? '{"filas":[]}').filas;
    } catch {
      return [];
    }
  }, key);
const REFERRALS = 'mock.clinical.derivaciones';
const CONSENTS = 'mock.consent.treatmentInformedConsents';
const storedReferral = async (service) => (await stored(REFERRALS)).find((f) => f.requestedServiceText === service);
const captura = (nombre, opciones = {}) => pg.screenshot({ path: `${SALIDA}/${nombre}.png`, ...opciones });

await pg.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 240_000 });
await pg.getByTestId('login-identifier').fill('medica@alovida.mock');
await pg.getByTestId('login-password').fill('mockup');
await pg.getByTestId('login-submit').click();
await pg.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 120_000, waitUntil: 'commit' });
if (pg.url().includes('/auth/organization')) {
  await pg.getByTestId('tenant-opcion').first().click();
  await pg.waitForURL(/\/dashboard/, { timeout: 60_000 });
}

/* 1 · Abrir la atención en la consulta ------------------------------------ */
await pg.goto(`${BASE}/medical-records/${PACIENTE}/consultation`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
const abrir = pg.getByTestId('consulta-abrir-encuentro');
await Promise.race([
  abrir.waitFor({ timeout: 60_000 }),
  pg.getByTestId('consulta-cerrar-encuentro').waitFor({ timeout: 60_000 }),
]);
if ((await abrir.count()) > 0) {
  await abrir.click();
  await pg.getByTestId('consulta-cerrar-encuentro').waitFor({ timeout: 30_000 });
}
ok('hay una atención abierta para esta persona', (await pg.getByTestId('consulta-cerrar-encuentro').count()) > 0);

const bloque = pg.locator('app-referral-block');
async function abrirDerivaciones() {
  await pg.goto(`${BASE}/medical-records/${PACIENTE}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pg.getByRole('tab', { name: 'Derivaciones', exact: true }).click({ timeout: 60_000 });
  await pg.getByTestId('referral-list').waitFor({ timeout: 30_000 });
  await pg.waitForTimeout(500);
}
const fila = (texto) => pg.getByTestId('referral-row').filter({ hasText: texto }).first();

await abrirDerivaciones();
const lista = await bloque.innerText();
ok('la lista trae el destino externo (corpus boliviano)', /\(externo\)/.test(lista));
ok('la lista dice los estados en palabras', /Solicitada|Aceptada|Con contrarreferencia/.test(lista));
ok('ningún uuid en pantalla', !/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-/.test(lista));
const area = await pg.locator('.app-main__inner').first().boundingBox();
const tarjeta = await bloque.locator('app-card').first().boundingBox();
if (area && tarjeta) {
  const izq = tarjeta.x - area.x;
  const der = area.x + area.width - (tarjeta.x + tarjeta.width);
  ok('tarjeta a lo ancho (≥ 85 % del área)', tarjeta.width / area.width >= 0.85, `${Math.round((tarjeta.width / area.width) * 100)} %`);
  ok('tarjeta centrada (|izq − der| ≤ 2 px)', Math.abs(izq - der) <= 2, `izq ${izq.toFixed(1)} · der ${der.toFixed(1)}`);
}
await captura('01-derivaciones-1440', { fullPage: true });

/* 2 · Emitir sin servicio ni resumen: no hay POST -------------------------- */
await pg.getByTestId('referral-kind').getByText('Externo', { exact: true }).click();
await pg.getByTestId('referral-external-name').fill('Centro de Rehabilitación Física Santa Cruz');
const antes = (await stored(REFERRALS)).length;
await pg.getByTestId('referral-submit').click();
await pg.getByTestId('referral-issues').waitFor({ timeout: 10_000 });
ok('vacío: resumen de errores y nada escrito', (await stored(REFERRALS)).length === antes);
await captura('02-errores-junto-al-campo', { fullPage: true });

/* 3 · Emitir a un destino externo ---------------------------------------- */
const servicio = `Fisioterapia de hombro, 8 sesiones (${Date.now() % 100000})`;
await pg.getByTestId('referral-external-contact').fill('3 3345678');
await pg.getByTestId('referral-type').locator('select').selectOption({ label: 'Terapia' });
await pg.getByTestId('referral-requested-service').locator('textarea').fill(servicio);
await pg
  .getByTestId('referral-clinical-summary')
  .locator('textarea')
  .fill('Tendinopatía del supraespinoso derecho, 3 meses, sin respuesta a AINE.');
await pg.getByTestId('referral-diagnosis').locator('textarea').fill('Tendinitis del manguito rotador (M75.1)');
await captura('03-formulario-externo', { fullPage: true });
await pg.getByTestId('referral-submit').click();
await pg.getByTestId('referral-next-step').waitFor({ timeout: 20_000 });
const emitida = await storedReferral(servicio);
ok(
  'POST /referrals persistido con tipo, destino externo, servicio, resumen y encuentro',
  emitida?.referralType === 'THERAPY' &&
    emitida?.targetExternalName === 'Centro de Rehabilitación Física Santa Cruz' &&
    emitida?.clinicalSummary?.startsWith('Tendinopatía') &&
    typeof emitida?.sourceEncounterId === 'string',
  emitida?.id,
);
ok('emitida: el detalle se abre con el consentimiento como próximo paso', true);
await captura('04-emitida-proximo-paso');

/* 4 · Consentir la derivación: ACCEPTED → vinculado → F5 ----------------- */
const panel = pg.getByTestId('consent-panel');
await panel.waitFor({ timeout: 15_000 });
ok('el panel tiene una atención a la que atarse (no S3)', (await pg.getByTestId('consent-no-encounter').count()) === 0);
await pg.getByTestId('consent-benefits').locator('textarea').fill('Recuperar la movilidad del hombro y disminuir el dolor.');
await pg.getByTestId('consent-risks').locator('textarea').fill('Dolor muscular transitorio; rara vez, empeoramiento.');
await panel.getByRole('tab', { name: /Decisión/ }).click();
// Límite ético: «Acepta» y «No acepta» con el mismo peso y nada premarcado.
const decision = pg.getByTestId('consent-decision');
const marcadas = await decision.locator('input:checked').count();
ok('la decisión no viene premarcada', marcadas === 0, String(marcadas));
await captura('05-decision-sin-premarcar');
await decision.getByText('Acepta', { exact: true }).click();
await pg.getByTestId('consent-revocation-right').locator('input').first().check();
await pg.getByTestId('consent-record').click();
await pg.getByTestId('referral-detail-consent').filter({ hasText: 'Aceptado y vinculado' }).waitFor({ timeout: 15_000 });
const consentimiento = (await stored(CONSENTS)).find((c) => c.targetType === 'REFERRAL' && c.targetId === emitida?.id);
ok(
  'consentimiento persistido (ACCEPTED, REFERRAL, con encuentro) y vínculo escrito en la derivación',
  consentimiento?.decision === 'ACCEPTED' &&
    typeof consentimiento?.encounterId === 'string' &&
    (await storedReferral(servicio))?.informedConsentId === consentimiento?.id,
  `${consentimiento?.id} · encuentro ${consentimiento?.encounterId}`,
);
await captura('06-consentimiento-vinculado');

await abrirDerivaciones(); // F5: página entera
ok(
  'tras F5: la fila muestra «Consentimiento aceptado y vinculado»',
  (await fila(servicio).getByTestId('referral-consent-linked').count()) === 1,
);
await fila(servicio).getByTestId('referral-open').click();
const tras = await pg.getByTestId('referral-detail-consent').innerText({ timeout: 15_000 });
ok('tras F5: el detalle sigue «Aceptado y vinculado»', tras.includes('Aceptado y vinculado'), tras);
await captura('07-tras-f5-vinculado');

/* 6 · Anular con confirmación → F5 → «Anulada» -------------------------- */
await pg.getByTestId('referral-cancel').click({ timeout: 15_000 });
await pg.getByRole('dialog', { name: 'Anular derivación' }).getByRole('button', { name: 'Anular derivación' }).click();
await pg.getByTestId('referral-cancel').waitFor({ state: 'detached', timeout: 15_000 });
ok('anulada en el simulador (REF_CANCELLED)', (await storedReferral(servicio))?.statusConceptId !== emitida?.statusConceptId);
await captura('08-anulada');
await abrirDerivaciones();
ok('tras F5: la fila dice «Anulada»', (await fila(servicio).innerText()).includes('Anulada'));

/* 5 · Responder la entrante: aceptar → F5 → «Aceptada» ------------------- */
const entrante = fila('Interconsulta con cardiología');
if ((await entrante.innerText()).includes('Solicitada')) {
  await entrante.getByTestId('referral-open').click();
  await pg.getByTestId('referral-accept').click({ timeout: 15_000 });
  await pg.getByRole('dialog', { name: 'Aceptar derivación' }).getByRole('button', { name: 'Aceptar derivación' }).click();
  await pg.getByTestId('referral-accept').waitFor({ state: 'detached', timeout: 15_000 });
  const respondida = (await stored(REFERRALS)).find((f) => f.requestedServiceText?.startsWith('Interconsulta con cardiología'));
  ok('respondida en el simulador (respondedAt)', typeof respondida?.respondedAt === 'string');
  await captura('09-entrante-aceptada');
  await abrirDerivaciones();
}
ok('tras F5: la entrante dice «Aceptada»', (await entrante.innerText()).includes('Aceptada'));
await captura('10-tras-f5-aceptada', { fullPage: true });

/* 7 · 390 px sin desborde horizontal ----------------------------------- */
await pg.setViewportSize({ width: 390, height: 844 });
await abrirDerivaciones();
const desborde = () =>
  pg.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
let d = await desborde();
ok('390 px: lista y formulario sin desborde horizontal', d <= 0, `${d}px`);
await captura('11-390-lista', { fullPage: true });
await pg.getByTestId('referral-kind').getByText('Externo', { exact: true }).click();
d = await desborde();
ok('390 px: formulario externo sin desborde', d <= 0, `${d}px`);
await fila(servicio).getByTestId('referral-open').click();
await pg.getByTestId('referral-detail').waitFor({ timeout: 15_000 });
d = await desborde();
ok('390 px: detalle sin desborde', d <= 0, `${d}px`);
await captura('12-390-detalle');

const relevantes = errores.filter((e) => !/favicon|ERR_|Failed to load resource|Content Security Policy/.test(e));
ok('sin errores de página/consola', relevantes.length === 0, relevantes.slice(0, 3).join(' | '));
process.stdout.write(`${veredictos.filter((v) => v.cond).length}/${veredictos.length} verificaciones\n`);
await navegador.close();
process.exit(veredictos.every((v) => v.cond) ? 0 : 1);
