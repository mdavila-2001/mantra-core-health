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
 * 8. Traslado (v4274): emitir con Crítico en vehículo particular → la
 *    pestaña explica y exige ambulancia, personal de salud y aviso, sin POST;
 *    corregido → POST con `transfer` → «Completar traslado» (PATCH) → F5 →
 *    sigue; como destino, «Registrar llegada» en la entrante → F5 → sigue;
 *    390 px con la pestaña Traslado y el detalle sin desborde.
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
/** Espera a que terminen las transiciones de los modales antes de capturar. */
const captura = async (nombre, opciones = {}) => {
  await pg.waitForTimeout(700);
  await pg.screenshot({ path: `${SALIDA}/${nombre}.png`, ...opciones });
};

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
await pg.getByTestId('referral-type').locator('button.select-trigger').click();
await pg.getByRole('option', { name: 'Terapia', exact: true }).click();
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
await panel.screenshot({ path: `${SALIDA}/05-decision-sin-premarcar.png` });
await decision.getByText('Acepta', { exact: true }).click();
await pg.getByTestId('consent-revocation-right').getByText(/Le informé que puede revocar/).click();
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

/* 8 · Traslado (v4274) ---------------------------------------------------- */
const traslado = `Internación en terapia intensiva (${Date.now() % 100000})`;
await pg.getByTestId('referral-kind').getByText('Externo', { exact: true }).click();
await pg.getByTestId('referral-external-name').fill('Hospital de Clínicas Universitario');
await pg.getByTestId('referral-type').locator('button.select-trigger').click();
await pg.getByRole('option', { name: 'Internación', exact: true }).click();
await pg.getByTestId('referral-requested-service').locator('textarea').fill(traslado);
await pg
  .getByTestId('referral-clinical-summary')
  .locator('textarea')
  .fill('Neumonía grave con insuficiencia respiratoria; requiere ventilación.');
await pg.getByRole('tab', { name: /Traslado/ }).click();
await pg.getByTestId('transfer-required').getByText(/se traslada físicamente/).click();
await pg.getByTestId('transfer-condition').getByText('Crítico', { exact: true }).click();
await pg.getByTestId('transfer-mode').getByText('Vehículo particular', { exact: true }).click();
const porque = await pg.getByTestId('transfer-unstable-why').innerText({ timeout: 10_000 });
ok('Crítico: la pantalla explica por qué exige ambulancia y personal de salud', /ambulancia/.test(porque) && /personal de salud/.test(porque), porque.slice(0, 80));
const antesTraslado = (await stored(REFERRALS)).length;
await pg.getByTestId('referral-submit').click();
await pg.getByTestId('referral-issues').waitFor({ timeout: 10_000 });
const resumen = await pg.getByTestId('referral-issues').innerText();
ok(
  'Crítico en vehículo particular: exige ambulancia, personal de salud y aviso al receptor, sin POST',
  /ambulancia/.test(resumen) && /personal de salud/.test(resumen) && /receptor/.test(resumen) &&
    (await stored(REFERRALS)).length === antesTraslado,
  resumen.replace(/\s+/g, ' ').slice(0, 160),
);
await captura('13-traslado-critico-exige', { fullPage: true });

await pg.getByTestId('transfer-mode').getByText(/Ambulancia avanzada/).click();
await pg.getByTestId('transfer-escort-name').fill('Dr. Marcelo Vaca');
await pg.getByTestId('transfer-escort-role').fill('Médico emergenciólogo');
await pg.getByTestId('transfer-vital-systolicBp').fill('88');
await pg.getByTestId('transfer-vital-diastolicBp').fill('52');
await pg.getByTestId('transfer-vital-heartRate').fill('124');
await pg.getByTestId('transfer-vital-oxygenSaturation').fill('89');
await pg.getByTestId('transfer-vital-temperatureC').fill('38,9');
await pg.getByTestId('transfer-vital-glasgow').fill('13');
await pg.getByTestId('transfer-receiver-contacted').getByText(/Se avisó al receptor/).click();
await pg.getByTestId('transfer-receiver-name').fill('Dra. Paz, terapia intensiva');
await captura('14-traslado-completo', { fullPage: true });
await pg.getByTestId('referral-submit').click();
await pg.getByTestId('referral-detail').waitFor({ timeout: 20_000 });
const conTraslado = await storedReferral(traslado);
ok(
  'POST /referrals persistido con transfer (crítico, ambulancia avanzada, personal, aviso y signos)',
  conTraslado?.transfer?.departureCondition === 'CRITICAL' &&
    conTraslado?.transfer?.transportMode === 'AMBULANCE_ADVANCED' &&
    conTraslado?.transfer?.escortProfessionalName === 'Dr. Marcelo Vaca' &&
    conTraslado?.transfer?.receiverContacted === true &&
    conTraslado?.transfer?.vitals?.temperatureC === 38.9,
  JSON.stringify(conTraslado?.transfer ?? null).slice(0, 160),
);
const bloqueTraslado = await pg.getByTestId('referral-transfer-data').innerText({ timeout: 10_000 });
ok('el detalle muestra el traslado', /Crítico/.test(bloqueTraslado) && /PA 88\/52 mmHg/.test(bloqueTraslado), bloqueTraslado.replace(/\s+/g, ' ').slice(0, 120));
await captura('15-detalle-traslado');

// Completar: quien la emitió agrega acompañante y unidad.
await pg.getByTestId('referral-transfer-complete').click();
await pg.getByTestId('transfer-companion-name').fill('María Quispe');
await pg.getByTestId('transfer-companion-relationship').fill('Hija');
await pg.getByTestId('transfer-detail').fill('Unidad 7 · placa 4521-LPZ');
await pg.getByTestId('referral-transfer-save').click();
await pg.getByTestId('referral-transfer-complete').waitFor({ timeout: 15_000 });
const completada = await storedReferral(traslado);
ok(
  'PATCH /referrals/:id/transfer persistido (acompañante y unidad, sin perder lo anterior)',
  completada?.transfer?.companionName === 'María Quispe' &&
    completada?.transfer?.transportDetail === 'Unidad 7 · placa 4521-LPZ' &&
    completada?.transfer?.escortProfessionalName === 'Dr. Marcelo Vaca',
);
await captura('16-traslado-completado');
await abrirDerivaciones(); // F5
await fila(traslado).getByTestId('referral-open').click();
const trasF5 = await pg.getByTestId('referral-transfer-data').innerText({ timeout: 15_000 });
ok(
  'tras F5: el traslado sigue (crítico, ambulancia, acompañante, unidad)',
  /Crítico/.test(trasF5) && /Ambulancia avanzada/.test(trasF5) && /María Quispe \(Hija\)/.test(trasF5) && /4521-LPZ/.test(trasF5),
  trasF5.replace(/\s+/g, ' ').slice(0, 160),
);
await captura('17-tras-f5-traslado');
await pg.keyboard.press('Escape');

// Como destino: la entrante (la Dra. Rojas es el destino) llega.
await fila('Interconsulta con cardiología').getByTestId('referral-open').click();
await pg.getByTestId('referral-arrival-start').click({ timeout: 15_000 });
await pg.getByTestId('referral-arrival-condition').getByText('Inestable', { exact: true }).click();
await pg.getByTestId('referral-arrival-notes').locator('textarea').fill('Llegó con SatO₂ 91 % con oxígeno por cánula.');
await captura('18-registrar-llegada');
await pg.getByTestId('referral-arrival-save').click();
await pg.getByTestId('referral-transfer-arrived').waitFor({ timeout: 15_000 });
const llegada = (await stored(REFERRALS)).find((f) => f.requestedServiceText?.startsWith('Interconsulta con cardiología'));
ok(
  'PATCH /referrals/:id/arrival persistido (fecha, Inestable, notas)',
  typeof llegada?.transfer?.arrivedAt === 'string' && llegada?.transfer?.arrivalCondition === 'UNSTABLE',
  llegada?.transfer?.arrivedAt,
);
await abrirDerivaciones(); // F5
await fila('Interconsulta con cardiología').getByTestId('referral-open').click();
const llegadaF5 = await pg.getByTestId('referral-transfer-arrived').innerText({ timeout: 15_000 });
ok('tras F5: la llegada sigue («Inestable»), y ya no se ofrece registrarla otra vez', /Inestable/.test(llegadaF5) && (await pg.getByTestId('referral-arrival-start').count()) === 0, llegadaF5);
await captura('19-tras-f5-llegada');
await pg.keyboard.press('Escape');

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
await pg.keyboard.press('Escape');
await fila(traslado).getByTestId('referral-open').click();
await pg.getByTestId('referral-transfer-data').waitFor({ timeout: 15_000 });
d = await desborde();
ok('390 px: detalle con traslado sin desborde', d <= 0, `${d}px`);
await captura('20-390-detalle-traslado', { fullPage: true });
await pg.keyboard.press('Escape');
await pg.getByRole('tab', { name: /Traslado/ }).click();
await pg.getByTestId('transfer-required').getByText(/se traslada físicamente/).click();
await pg.getByTestId('transfer-condition').getByText('Crítico', { exact: true }).click();
d = await desborde();
ok('390 px: pestaña Traslado (crítico, signos vitales) sin desborde', d <= 0, `${d}px`);
await captura('21-390-pestana-traslado', { fullPage: true });

const relevantes = errores.filter((e) => !/favicon|ERR_|Failed to load resource|Content Security Policy/.test(e));
ok('sin errores de página/consola', relevantes.length === 0, relevantes.slice(0, 3).join(' | '));
process.stdout.write(`${veredictos.filter((v) => v.cond).length}/${veredictos.length} verificaciones\n`);
await navegador.close();
process.exit(veredictos.every((v) => v.cond) ? 0 : 1);
