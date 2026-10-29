/**
 * Evidencia de navegador de la franja F3 (internación / ADT), contra la MAQUETA
 * (backend simulado en el navegador). Contra la API real NO: la API de F3 no
 * existe todavía en este árbol.
 *
 * Recorre y deja capturas en `docs/frontend/evidence/infra-f3/`:
 *   - ingreso con elección de cama, compatibilidad y «Forzar con justificación»
 *     (20 caracteres), el incidente que genera y la ficha de internación;
 *   - el rechazo por cama ocupada (BED_NOT_ASSIGNABLE) y por carrera
 *     (BED_DOUBLE_OCCUPANCY), el ingreso sin cama y la asignación posterior;
 *   - traslado, intercambio (A17) y egreso (cama sucia + orden de limpieza) y
 *     su vuelta a «asignable» al terminar el ciclo de limpieza;
 *   - censo diario: vista previa → cierre → ajuste → recarga dura;
 *   - indicadores: días sin cerrar, completos, fórmulas;
 *   - el bloque de internación del expediente;
 *   - los estados M34 de las cuatro pantallas;
 *   - 1440 / 768 / 390 px en claro y oscuro en las capturas clave.
 *
 * Uso: `node playwright/infra-f3-evidencia.mjs [urlBase] [ejecutable]`.
 * Sirve la salida de `ng build --configuration development,demo` con un
 * servidor estático con respaldo a index.html. NUNCA espera `networkidle`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4313';
const EJECUTABLE = process.argv[3] ?? process.env['PW_CHROMIUM'] ?? undefined;
const SALIDA = fileURLToPath(new URL('../docs/frontend/evidence/infra-f3/', import.meta.url));
const ANCHOS = [
  { w: 1440, h: 900 },
  { w: 768, h: 1000 },
  { w: 390, h: 844 },
];

function uuid(seed) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
  }
  const hex = (n) => n.toString(16).padStart(8, '0');
  const a = hex(h1);
  const b = hex(h2);
  const c = hex((h1 * 31 + h2) >>> 0);
  const d = hex((h2 * 17 + h1) >>> 0);
  const raw = `${a}${b}${c}${d}`;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-a${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
}

const resultados = [];
const ok = (nombre, cond, detalle = '') => {
  resultados.push({ nombre, ok: Boolean(cond), detalle });
  process.stdout.write(`${cond ? 'OK  ' : 'FALLA'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

mkdirSync(SALIDA, { recursive: true });
let contador = 0;
const capturadas = [];

const navegador = await chromium.launch({ ...(EJECUTABLE ? { executablePath: EJECUTABLE } : {}), args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });

/** Un día en la zona de la sede (UTC−4) respecto de hoy. */
const diaDeLaSede = (delta = 0) => new Date(Date.now() - 4 * 3_600_000 + delta * 86_400_000).toISOString().slice(0, 10);
const fmt = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

async function sesion(usuario = 'superadmin@alovida.mock', tenant = 2) {
  const contexto = await navegador.newContext({ viewport: { width: ANCHOS[0].w, height: ANCHOS[0].h } });
  const pagina = await contexto.newPage();
  pagina.errores = [];
  pagina.on('pageerror', (e) => pagina.errores.push(String(e)));
  // S2: el simulador responde a los 120 ms; con la marca `lento` esa espera pasa a 6 s.
  await pagina.addInitScript(() => {
    const si = window.setInterval.bind(window);
    window.setInterval = (f, ms, ...a) => si(f, ms === 120 && sessionStorage.getItem('lento') === '1' ? 6000 : ms, ...a);
  });
  await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.getByTestId('login-identifier').fill(usuario);
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').nth(tenant).click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
  return pagina;
}

const perfil = (p, valor) =>
  p.evaluate((v) => (v ? sessionStorage.setItem('mock:adt-perfil', v) : sessionStorage.removeItem('mock:adt-perfil')), valor);
const fallos = (p, lista) =>
  p.evaluate((l) => (l ? sessionStorage.setItem('mock:fallos', JSON.stringify(l)) : sessionStorage.removeItem('mock:fallos')), lista);

async function ir(p, ruta) {
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
}

/**
 * Captura el estado actual. `anchos` son índices de ANCHOS en claro y `oscuros` los que además
 * salen en oscuro. El viewport se ajusta a la altura del contenido: una captura de página
 * completa con el menú lateral fijo lo dibuja encima del contenido.
 */
async function foto(p, nombre, { anchos = [0], oscuros = [] } = {}) {
  contador += 1;
  const n = String(contador).padStart(2, '0');
  const tomas = [...anchos.map((i) => [i, false]), ...oscuros.map((i) => [i, true])];
  for (const [i, dark] of tomas) {
    await p.emulateMedia({ colorScheme: dark ? 'dark' : 'light' });
    // El tema lo fija `data-theme` en la raíz (la app lo lee al arrancar): se pone a mano para la captura.
    await p.evaluate((d) => document.documentElement.setAttribute('data-theme', d ? 'dark' : 'light'), dark);
    const { w, h } = ANCHOS[i];
    await p.setViewportSize({ width: w, height: h });
    await p.waitForTimeout(350);
    const alto = await p.evaluate(() => Math.max(...[...document.querySelectorAll('*')].map((e) => e.scrollHeight)));
    await p.setViewportSize({ width: w, height: Math.min(Math.max(alto + 8, h), 2300) });
    await p.waitForTimeout(250);
    const archivo = `${n}-${nombre}-${w}${dark ? '-oscuro' : ''}.png`;
    await p.screenshot({ path: `${SALIDA}${archivo}` });
    capturadas.push(archivo);
  }
  await p.emulateMedia({ colorScheme: 'light' });
  await p.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
  await p.setViewportSize({ width: ANCHOS[0].w, height: ANCHOS[0].h });
  await p.waitForTimeout(200);
}

const TRES = [0, 1, 2];
const texto = async (p, sel) => ((await p.locator(sel).first().textContent().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
/** Espera (sondeando) a que el texto de un selector case; devuelve si lo logró. Cada acción recarga la ficha del servidor. */
const esperaTexto = async (p, sel, rx, ms = 8000) => {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    if (rx.test(await texto(p, sel))) return true;
    await p.waitForTimeout(250);
  }
  return false;
};
const hay = async (p, testId) => (await p.getByTestId(testId).count()) > 0;

async function elegirOpcion(p, testId, nombre) {
  await p.getByTestId(testId).locator('button').first().click();
  const opcion = p.getByRole('option', { name: nombre }).first();
  await opcion.waitFor({ timeout: 15_000 });
  // La página comparte CPU con otros procesos: si el clic se demora, se elige con el teclado.
  await opcion.click({ timeout: 8000 }).catch(async () => {
    await p.keyboard.press('Enter');
  });
  await p.waitForTimeout(250);
}

async function siguiente(p) {
  await p.getByRole('button', { name: /Siguiente|Continuar/ }).first().click();
  await p.waitForTimeout(450);
}

async function buscarPaciente(p, texto, nombre) {
  const caja = p.getByTestId('ingreso-buscar-paciente').locator('input').first();
  await caja.click();
  await caja.fill(texto);
  await p.getByRole('option', { name: nombre }).first().waitFor({ timeout: 15_000 });
  await p.getByRole('option', { name: nombre }).first().click();
  await p.waitForTimeout(250);
}

/** Recorre el ingreso hasta el paso Cama. */
async function irAlPasoCama(p, { paciente, nombre, motivo = 'Dolor abdominal agudo', nivel, aislamiento }) {
  await ir(p, '/inpatient/admissions/new');
  await p.getByTestId('ingreso').waitFor({ timeout: 60_000 });
  await buscarPaciente(p, paciente, nombre);
  await elegirOpcion(p, 'ingreso-tratante', /.+/);
  await siguiente(p);
  if (nivel) await elegirOpcion(p, 'ingreso-nivel', nivel);
  if (aislamiento) await elegirOpcion(p, 'ingreso-aislamiento', aislamiento);
  await p.locator('textarea').first().fill(motivo);
  await siguiente(p);
  await p.getByTestId('ingreso-paso-cama').waitFor({ timeout: 20_000 });
}

const A = await sesion();
await perfil(A, 'SUPERVISION');
// El establecimiento con camas sembradas (Hospital San Lucas): la elección se recuerda entre pantallas.
await A.evaluate((id) => localStorage.setItem('inpatient.site', id), uuid('site-sanlucas'));

/* ============ 1 · Ingreso con compatibilidad forzada ============ */
await irAlPasoCama(A, { paciente: 'Sol', nombre: /Solíz/ });
ok('el paso Cama ofrece sólo camas asignables y avisa las que quedan afuera', (await hay(A, 'cama-303-B')) && !(await hay(A, 'cama-301-A')) && (await hay(A, 'selector-de-camas-todas')));
await foto(A, 'ingreso-paso-cama', { anchos: TRES, oscuros: [0] });
await A.getByTestId('selector-de-camas-todas').click();
await A.waitForTimeout(300);
ok('«ver también las no asignables» muestra la sucia con su motivo', /Pendiente de limpieza/.test(await texto(A, '[data-testid="cama-301-A"]')));
await A.getByTestId('selector-de-camas-todas').click();
await A.getByTestId('cama-303-B').click();
await A.getByTestId('compatibilidad-forzable').waitFor({ timeout: 15_000 });
ok('hombre a habitación de mujeres: advertencia forzable con «Forzar con justificación»', (await hay(A, 'compatibilidad-forzar')) && /mujeres/.test(await texto(A, '[data-testid="compatibilidad-forzable"]')));
await foto(A, 'ingreso-compatibilidad-forzable', { anchos: TRES, oscuros: [0] });
await A.getByTestId('compatibilidad-forzar').click();
const dialogo = A.getByRole('dialog').last();
await dialogo.waitFor();
const cuadro = dialogo.locator('textarea').first();
await cuadro.fill('muy corto');
const confirmar = dialogo.getByTestId('dialogo-confirmar');
await confirmar.click();
await A.waitForTimeout(400);
ok('con menos de 20 caracteres el diálogo no confirma (sigue abierto, sin forzar)', (await dialogo.isVisible()) && !(await hay(A, 'compatibilidad-forzada')));
await cuadro.fill('   Sin cama de hombres libre en la unidad esta noche   ');
await foto(A, 'ingreso-forzar-justificacion-valida');
await confirmar.click();
await A.getByTestId('compatibilidad-forzada').waitFor();
await siguiente(A);
await A.getByTestId('ingreso-resumen').waitFor();
ok('la confirmación avisa que quedará un incidente', await hay(A, 'ingreso-forzado'));
await A.getByTestId('ingreso-registrar').click();
await A.getByTestId('estancia').waitFor({ timeout: 30_000 });
const urlEstancia1 = A.url();
ok('el ingreso lleva a la ficha, en la cama 303-B, con el incidente abierto', /303-B/.test(await texto(A, '[data-testid="estancia-cama-actual"]')) && (await hay(A, 'estancia-incidente-abierto')));
await foto(A, 'estancia-cama-actual', { anchos: TRES, oscuros: [0] });
await A.getByRole('tab', { name: 'Compatibilidad e incidentes' }).click();
await A.getByTestId('estancia-incidentes').waitFor();
ok('la pestaña de incidentes muestra la regla y la justificación', /Sexo/.test(await texto(A, '[data-testid="estancia-incidentes"]')) && /Sin cama de hombres/.test(await texto(A, '[data-testid="estancia-incidentes"]')));
await foto(A, 'estancia-incidentes', { anchos: [0] });
await A.getByRole('tab', { name: 'Movimientos' }).click();
await A.waitForTimeout(400);
// recarga dura: sigue ahí
await A.reload({ waitUntil: 'domcontentloaded' });
await A.getByTestId('estancia').waitFor({ timeout: 30_000 });
ok('tras recargar, la internación sigue en 303-B', /303-B/.test(await texto(A, '[data-testid="estancia-cama-actual"]')));
const incidenteId = await A.evaluate(() => window.__adtSim.eventos().filter((e) => e.eventType === 'clinical.adt.placement_override').length);
ok('el simulador emitió el evento clinical.adt.placement_override', incidenteId === 1);
// supervisión revisa el incidente
await A.getByRole('tab', { name: 'Compatibilidad e incidentes' }).click();
await A.getByTestId('incidente-revisar').click();
const rev = A.getByRole('dialog').last();
await rev.locator('textarea').first().fill('Se verificó la razón clínica con el médico.');
await rev.getByRole('button', { name: /Marcar como revisado/ }).click();
await A.waitForTimeout(700);
ok('el incidente pasa a Revisado', /Revisado/.test(await texto(A, '[data-testid="estancia-incidentes"]')));

/* ============ 2 · Rechazo por cama ocupada y por carrera ============ */
await irAlPasoCama(A, { paciente: 'Quis', nombre: /Quispe/ });
await A.getByTestId('cama-302-B').click();
await A.getByTestId('compatibilidad-ok').waitFor({ timeout: 15_000 });
await A.evaluate(() => window.__adtSim.tomarCama('302-B'));
await siguiente(A);
await A.getByTestId('ingreso-registrar').click();
await A.getByTestId('adt-problema').waitFor({ timeout: 15_000 });
ok('cama tomada por otra persona: 409 BED_NOT_ASSIGNABLE dicho en palabras', /ya no se puede asignar/.test(await texto(A, '[data-testid="adt-problema"]')) && (await A.getByTestId('adt-problema').getAttribute('data-m34')) === 'S4');
ok('el rechazo trae código de soporte', await hay(A, 'adt-problema-request-id'));
await foto(A, 'rechazo-cama-ocupada-S4', { anchos: [0] });
// carrera: la validación previa pasa y la EXCLUDE de la base rechaza
await irAlPasoCama(A, { paciente: 'Med', nombre: /Medina/, nivel: /^Terapia intensiva$/ });
await A.getByTestId('cama-UTI-3').click();
await A.getByTestId('compatibilidad-ok').waitFor({ timeout: 15_000 });
await A.evaluate(() => sessionStorage.setItem('mock:adt-carrera', '1'));
await siguiente(A);
await A.getByTestId('ingreso-registrar').click();
await A.waitForTimeout(900);
ok('carrera de dos ingresos a la misma cama: BED_DOUBLE_OCCUPANCY', /Otra persona ocupó esta cama/.test(await texto(A, '[data-testid="adt-problema"]')));
await foto(A, 'rechazo-carrera-BED_DOUBLE_OCCUPANCY', { anchos: [0] });
// ingreso sin cama
await irAlPasoCama(A, { paciente: 'Quis', nombre: /Quispe/ });
await A.getByText('Sin cama por ahora').click();
await A.getByTestId('ingreso-sin-cama').waitFor();
await foto(A, 'ingreso-sin-cama', { anchos: [0] });
await siguiente(A);
await A.getByTestId('ingreso-registrar').click();
await A.getByTestId('estancia').waitFor({ timeout: 30_000 });
ok('ingreso sin cama: queda pendiente de cama', /Pendiente de cama/.test(await texto(A, '[data-testid="estancia-cama-actual"]')));
await foto(A, 'estancia-pendiente-de-cama', { anchos: [0] });
// asignar cama desde la ficha
await A.getByTestId('accion-asignar').click();
await A.getByTestId('accion-assign').waitFor();
await A.getByTestId('cama-304-A').click();
await A.getByTestId('compatibilidad-ok').waitFor({ timeout: 15_000 });
await A.getByTestId('accion-confirmar').click();
await A.getByTestId('acciones-resultado').waitFor({ timeout: 15_000 });
ok('asignar cama: la ficha lee 304-A del servidor', await esperaTexto(A, '[data-testid="estancia-cama-actual"]', /304-A/));

/* ============ 3 · Traslado, intercambio, egreso ============ */
const mamani = uuid('encounter-301-B');
await ir(A, `/inpatient/stays/${mamani}`);
await A.getByTestId('estancia').waitFor({ timeout: 30_000 });
await A.getByTestId('accion-trasladar').click();
await A.getByTestId('accion-transfer').waitFor();
await A.getByTestId('cama-302-B').waitFor().catch(() => undefined);
await A.getByTestId('cama-305-B').click();
await A.getByTestId('compatibilidad-ok').waitFor({ timeout: 15_000 });
ok('el traslado explica qué hace en una sola operación', /sola operación/.test(await texto(A, '[data-testid="traslado-efecto"]')));
await foto(A, 'accion-trasladar', { anchos: [0] });
await A.getByTestId('accion-confirmar').click();
await A.getByTestId('acciones-resultado').waitFor({ timeout: 15_000 });
const resTraslado = await texto(A, '[data-testid="acciones-resultado"]');
ok('traslado: origen sucio y orden de limpieza creada', /quedó sucia/.test(resTraslado) && /orden de limpieza/.test(resTraslado), resTraslado);
ok('traslado: la ficha lee 305-B', await esperaTexto(A, '[data-testid="estancia-cama-actual"]', /305-B/));
await A.getByRole('tab', { name: 'Movimientos' }).click();
await A.waitForTimeout(400);
const mov = await texto(A, '[data-testid="estancia-movimientos"]');
ok('movimientos: A01 completada, A02 en curso con la cama anterior', /Ingreso \(A01\)/.test(mov) && /Traslado \(A02\)/.test(mov) && /Traslado a otra cama/.test(mov));
await foto(A, 'estancia-movimientos-traslado', { anchos: [0, 2] });
const ocupacion1 = await A.evaluate(() => window.__adtSim.ocupacionPorCodigo());
ok('en el registro del simulador 301-B quedó libre y 305-B ocupada', ocupacion1['301-B'] === null && ocupacion1['305-B'] === mamani);
// intercambio con Torrez (305-A)
await A.getByRole('tab', { name: 'Cama actual' }).click();
await A.getByTestId('accion-intercambiar').click();
await A.getByTestId('accion-swap').waitFor();
await A.getByTestId('cama-305-A').click();
await A.getByTestId('intercambio-motivo').locator('textarea').fill('Cambio de cama por cercanía a la enfermería');
await A.getByTestId('accion-confirmar').click();
await A.getByTestId('acciones-resultado').waitFor({ timeout: 15_000 });
ok('intercambio A17: ahora está en 305-A', await esperaTexto(A, '[data-testid="estancia-cama-actual"]', /305-A/));
ok('intercambio: no se generó orden de limpieza (ninguna cama quedó libre)', /no se generó orden de limpieza/.test(await texto(A, '[data-testid="acciones-resultado"]')));
await foto(A, 'intercambio-resultado');
const ev = await A.evaluate(() => window.__adtSim.eventos().map((e) => e.hl7));
ok('eventos HL7: A01, A02, A17 y A20 emitidos', ['ADT^A01', 'ADT^A02', 'ADT^A17', 'ADT^A20'].every((x) => ev.includes(x)), [...new Set(ev)].join(','));
// egreso
await A.getByTestId('accion-alta').click();
await A.getByTestId('accion-discharge').waitFor();
const confirmarEgreso = A.getByTestId('accion-confirmar');
ok('el egreso exige disposición', await confirmarEgreso.isDisabled());
await elegirOpcion(A, 'egreso-disposicion', 'Alta a domicilio');
await foto(A, 'accion-egreso', { anchos: [0] });
await confirmarEgreso.click();
await A.getByTestId('acciones-resultado').waitFor({ timeout: 15_000 });
ok('egreso: la cama quedó sucia con su orden', /quedó sucia/.test(await texto(A, '[data-testid="acciones-resultado"]')));
ok('egreso: la internación figura finalizada', await esperaTexto(A, '[data-testid="estancia-estado"]', /Finalizado/));
await A.getByRole('tab', { name: 'Egreso' }).click();
await A.waitForTimeout(300);
// la cama no es asignable hasta terminar la limpieza; luego vuelve
await irAlPasoCama(A, { paciente: 'Rocha', nombre: /Rocha/ });
await A.getByTestId('selector-de-camas-todas').click();
ok('la cama del egreso aparece NO asignable y sucia', /Pendiente de limpieza/.test(await texto(A, '[data-testid="cama-305-A"]')));
await foto(A, 'cama-sucia-no-asignable', { anchos: [0] });
await A.evaluate(() => window.__adtSim.completarLimpieza('305-A'));
await irAlPasoCama(A, { paciente: 'Rocha', nombre: /Rocha/ });
ok('terminada la limpieza, la cama vuelve a ser asignable', await hay(A, 'cama-305-A'));
await foto(A, 'cama-vuelve-asignable', { anchos: [0] });

/* ============ 4 · Censo ============ */
const ayer = diaDeLaSede(-1);
await ir(A, `/inpatient/census?date=${ayer}`);
await A.getByTestId('censo').waitFor({ timeout: 30_000 });
await A.getByTestId('censo-unidad-MEDINT').waitFor();
ok('censo de ayer: abierto, vista previa calculada', /Abierto/.test(await texto(A, '[data-testid="censo-unidad-MEDINT"]')));
await foto(A, 'censo-abierto-vista-previa', { anchos: TRES, oscuros: [0] });
await A.getByTestId('censo-cerrar').click();
await A.getByRole('dialog').last().getByRole('button', { name: 'Cerrar el censo' }).click();
await A.getByTestId('censo-aviso').waitFor({ timeout: 15_000 });
ok('cerrar: el sello pasa a Cerrado y trae la huella', await esperaTexto(A, '[data-testid="censo-unidad-MEDINT"]', /Cerrado[\s\S]*Huella|Huella[\s\S]*Cerrado/));
await foto(A, 'censo-cerrado', { anchos: [0, 2], oscuros: [0] });
const valorPrevio = await texto(A, '[data-testid="censo-tabla-MEDINT"] tr:has-text("Días-paciente")');
await A.getByTestId('ajustar-MEDINT-patient_days').click();
const ajuste = A.getByTestId('ajuste');
await ajuste.waitFor();
await ajuste.getByTestId('ajuste-valor').fill('9').catch(async () => A.getByTestId('ajuste-valor').locator('input').fill('9'));
await ajuste.getByTestId('ajuste-motivo').locator('textarea').fill('Un ingreso de madrugada quedó sin registrar');
await foto(A, 'censo-ajuste-dialogo', { anchos: [0] });
await A.getByTestId('ajuste-confirmar').click();
await A.getByTestId('censo-ajustes-MEDINT').waitFor({ timeout: 15_000 });
ok('el ajuste se lista aparte y el original no se reescribe (original → ajustado)', (await hay(A, 'ajustado-patient_days')) && /Ajustes \(1\)/.test(await texto(A, '[data-testid="censo-unidad-MEDINT"]')));
await foto(A, 'censo-ajustado', { anchos: [0] });
await A.reload({ waitUntil: 'domcontentloaded' });
await A.getByTestId('censo-ajustes-MEDINT').waitFor({ timeout: 30_000 });
ok('tras recargar, el cierre y el ajuste persisten', /Cerrado/.test(await texto(A, '[data-testid="censo-unidad-MEDINT"]')) && (await hay(A, 'ajustado-patient_days')));
ok('un censo cerrado no ofrece cerrar de nuevo', !(await hay(A, 'censo-cerrar')));
// hoy: no se puede cerrar (CENSUS_DATE_NOT_ENDED)
await ir(A, '/inpatient/census');
await A.getByTestId('censo').waitFor({ timeout: 30_000 });
await A.getByTestId('censo-cerrar').click();
await A.getByRole('dialog').last().getByRole('button', { name: 'Cerrar el censo' }).click();
await A.getByTestId('adt-problema').waitFor({ timeout: 15_000 });
ok('cerrar el día de hoy: rechazado, el día no terminó', /todavía no terminó/.test(await texto(A, '[data-testid="adt-problema"]')));
await foto(A, 'censo-hoy-no-se-cierra-S4', { anchos: [0] });

/* ============ 5 · Indicadores ============ */
await ir(A, '/inpatient/indicators');
await A.getByTestId('indicadores').waitFor({ timeout: 30_000 });
ok('indicadores con el censo de ayer cerrado: período completo', !(await hay(A, 'indicadores-faltan')));
ok('los cuatro KPI traen valor', (await Promise.all(['ocupacion', 'estancia', 'giro', 'sustitucion'].map((k) => texto(A, `[data-testid="kpi-${k}"]`)))).every((t) => /\d/.test(t)));
await foto(A, 'indicadores', { anchos: TRES, oscuros: [0] });
ok('muestra el momento del cálculo', /calculado el/.test(await texto(A, '[data-testid="indicadores-calculo"]')));

/* ============ 6 · Expediente (la médica, con su propia pestaña y el hospital sembrado) ============ */
const B = await sesion('medica@alovida.mock', 2);
await B.evaluate((id) => localStorage.setItem('inpatient.site', id), uuid('site-sanlucas'));
await ir(B, '/inpatient/census');
await B.getByTestId('censo').waitFor({ timeout: 40_000 });
const idCondori = await B.evaluate(() => window.__adtSim.pacienteId('Condori'));
await ir(B, `/medical-records/${idCondori}`);
await B.getByRole('tab', { name: /Internaciones/ }).waitFor({ timeout: 60_000 });
await B.getByRole('tab', { name: /Internaciones/ }).click();
await B.getByTestId('expediente-nueva-internacion').click();
await B.getByTestId('internacion-cama').waitFor({ timeout: 20_000 });
ok('el expediente muestra la cama (UTI-1) y la unidad de la internación abierta', /UTI-1/.test(await texto(B, '[data-testid="internacion-cama"]')));
await foto(B, 'expediente-bloque-internacion', { anchos: [0, 2], oscuros: [0] });
await B.getByTestId('internacion-ver-ficha').click();
await B.getByTestId('estancia').waitFor({ timeout: 30_000 });
ok('«Ver ficha de internación» abre la ficha', /Condori/.test(await texto(B, 'app-stay')));
const idRocha = await B.evaluate(() => window.__adtSim.pacienteId('Rocha'));
await ir(B, `/medical-records/${idRocha}`);
await B.getByRole('tab', { name: /Internaciones/ }).waitFor({ timeout: 60_000 });
await B.getByRole('tab', { name: /Internaciones/ }).click();
await B.getByTestId('expediente-nueva-internacion').click();
await B.getByTestId('internacion-internar').waitFor({ timeout: 15_000 });
await B.getByTestId('internacion-internar').click();
await B.getByTestId('ingreso').waitFor({ timeout: 30_000 });
await B.waitForTimeout(800);
const elegido = await B.getByTestId('ingreso-buscar-paciente').locator('input').first().inputValue().catch(() => '');
ok('«Internar» abre el ingreso con la persona elegida', /Rocha/.test(elegido + (await B.locator('app-admission-new').textContent())), elegido);
await B.context().close();

/* ============ 7 · Estados M34 ============ */
const estado = async (nombre, anchos = [0]) => foto(A, nombre, { anchos });

// S5: Limpieza (y Admin de organización en el ingreso)
await perfil(A, 'LIMPIEZA');
await ir(A, '/inpatient/admissions/new');
await A.getByText(/No tiene acceso|no puede ingresar|Su rol/).first().waitFor({ timeout: 30_000 });
ok('ingreso S5: Limpieza no ve el formulario', !(await hay(A, 'ingreso')));
await estado('S5-ingreso-limpieza', TRES);
await ir(A, `/inpatient/stays/${mamani}`);
await A.getByText(/No tiene acceso|permiso/i).first().waitFor({ timeout: 30_000 });
await estado('S5-estancia-limpieza');
await ir(A, '/inpatient/census');
await A.getByText(/No tiene acceso|permiso/i).first().waitFor({ timeout: 30_000 });
await estado('S5-censo-limpieza');
await ir(A, '/inpatient/indicators');
await A.getByText(/No tiene acceso|permiso/i).first().waitFor({ timeout: 30_000 });
await perfil(A, 'ADMIN_ORG');
await ir(A, '/inpatient/admissions/new');
await A.getByText(/no puede ingresar|No tiene acceso/).first().waitFor({ timeout: 30_000 });
ok('Admin de organización: el ingreso es S5 (separación de funciones)', !(await hay(A, 'ingreso')));
await estado('S5-ingreso-admin-organizacion');
await ir(A, `/inpatient/census?date=${ayer}`);
await A.getByTestId('censo').waitFor({ timeout: 30_000 });
ok('Admin de organización sí ve el censo y puede ajustar (no ingresar)', await hay(A, 'ajustar-MEDINT-patient_days'));
await perfil(A, 'SUPERVISION');

// S6: internación inexistente / de otro tenant
await ir(A, `/inpatient/stays/${uuid('internacion-de-otro-tenant')}`);
await A.getByText(/No encontramos lo que busca/).waitFor({ timeout: 30_000 });
ok('S6: una internación ajena no revela nada', !/Condori|Mamani|cama/i.test(await texto(A, 'app-stay')));
await estado('S6-estancia', TRES);

// S8 / S9 por pantalla
const pantallas = [
  ['ingreso', '/inpatient/admissions/new', '/bed-board', 'app-admission-new'],
  ['estancia', `/inpatient/stays/${mamani}`, '/stay', 'app-stay'],
  ['censo', '/inpatient/census', '/census', 'app-census'],
  ['indicadores', '/inpatient/indicators', '/inpatient-indicators', 'app-indicators'],
];
for (const [nombre, ruta, patron, host] of pantallas) {
  for (const [modo, codigo, rx] of [['red', 'S8', /Sin conexión/], ['error', 'S9', /Algo salió mal/]]) {
    await fallos(A, [{ patron, modo }]);
    await ir(A, ruta);
    await A.getByText(rx).first().waitFor({ timeout: 40_000 }).catch(() => undefined);
    const t = await texto(A, host);
    ok(`${nombre} ${codigo}: ${modo}`, rx.test(t), t.slice(0, 80));
    if (codigo === 'S9') ok(`${nombre} S9 trae código de soporte`, /Código de soporte/.test(await A.locator(host).textContent()));
    if (codigo === 'S9' || nombre === 'censo') await estado(`${codigo}-${nombre}`);
  }
}
await fallos(A, null);

// S2: cargando
await A.evaluate(() => sessionStorage.setItem('lento', '1'));
for (const [nombre, ruta] of [['ingreso', '/inpatient/admissions/new'], ['estancia', `/inpatient/stays/${mamani}`], ['censo', '/inpatient/census'], ['indicadores', '/inpatient/indicators']]) {
  await A.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' });
  await A.waitForTimeout(1500);
  if (nombre === 'ingreso' || nombre === 'censo') await estado(`S2-${nombre}`);
}
await A.evaluate(() => sessionStorage.removeItem('lento'));

// S7: datos con antigüedad
await A.evaluate(() => sessionStorage.setItem('mock:infra-antiguedad', '12'));
for (const [nombre, ruta, testId] of [['estancia', `/inpatient/stays/${mamani}`, 'estancia'], ['censo', '/inpatient/census', 'censo'], ['indicadores', '/inpatient/indicators', 'indicadores']]) {
  await ir(A, ruta);
  await A.getByTestId(testId).waitFor({ timeout: 30_000 });
  const t = await texto(A, `app-${nombre === 'estancia' ? 'stay' : nombre === 'censo' ? 'census' : 'indicators'}`);
  ok(`${nombre} S7: dice la antigüedad del dato`, /12 min|pueden estar atrasados|hace 12/.test(t), t.slice(0, 100));
  if (nombre !== 'estancia') await estado(`S7-${nombre}`);
}
await A.evaluate(() => sessionStorage.removeItem('mock:infra-antiguedad'));

// S3
await ir(A, '/inpatient/indicators');
await A.getByTestId('indicadores').waitFor({ timeout: 30_000 });
// Un período sin ningún día cerrado: los indicadores aparecen tras el primer cierre de censo.
await ir(A, `/inpatient/indicators?from=${diaDeLaSede(-400)}&to=${diaDeLaSede(-395)}`);
await A.getByText(/aparecen tras el primer cierre/).waitFor({ timeout: 20_000 }).catch(() => undefined);
ok('indicadores S3: sin días cerrados dice cómo salir (cerrar un censo)', /primer cierre de censo/.test(await texto(A, 'app-indicators')));
await estado('S3-indicadores');
// S3 del censo: el otro establecimiento no tiene camas
await ir(A, '/inpatient/census');
await A.getByTestId('censo').waitFor({ timeout: 30_000 });
const sede = A.getByTestId('internacion-sede');
if (await sede.count()) {
  await sede.locator('button').first().click();
  await A.getByRole('option', { name: /Olivos|Norte/ }).first().click();
  await A.getByText(/no tiene camas censables/).waitFor({ timeout: 15_000 }).catch(() => undefined);
  ok('censo S3: un establecimiento sin camas ofrece crear camas', /no tiene camas censables/.test(await texto(A, 'app-census')));
  await estado('S3-censo');
}

writeFileSync(`${SALIDA}resultados.json`, JSON.stringify({ resultados, capturas: capturadas, erroresDePagina: A.errores }, null, 2));
const fallas = resultados.filter((r) => !r.ok);
process.stdout.write(`\n${resultados.length - fallas.length}/${resultados.length} comprobaciones en verde · ${capturadas.length} capturas · errores de página: ${A.errores.length}\n`);
await navegador.close();
process.exit(fallas.length > 0 ? 1 : 0);
