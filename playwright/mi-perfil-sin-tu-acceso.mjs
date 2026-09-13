/**
 * Evidencia del pedido del cliente del 13/09/2026 sobre «Mi perfil»:
 *
 * 1. La tarjeta «Tu acceso» —organización y roles— sale de la pantalla. Con
 *    ella se va la columna lateral, así que el perfil pasa a ocupar el ancho
 *    entero en vez de quedar pegado a la izquierda (REGLA DE LA CASA, §5 de
 *    `docs/components/composition-rules.md`).
 * 2. Sus dos enlaces —«Mi consultorio propio» y «Organización médica»— NO se
 *    van con ella: son los únicos accesos a esas dos pantallas desde que
 *    salieron del menú del médico, y ahora viven al pie del perfil.
 * 3. Los contadores de la pestaña «Actividad» dejan de ser renglones de ficha
 *    y pasan a ser tarjetas: cada uno su caja y el número al tamaño de un
 *    titular.
 *
 * Uso: `node playwright/mi-perfil-sin-tu-acceso.mjs [urlBase] [sufijo]`
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4333';
const SUFIJO = process.argv[3] ?? 'despues';
/* `fileURLToPath` y no `.pathname`: el repositorio vive bajo «Mantra Core
   Technologies», con espacios, y `pathname` los devuelve como `%20`. Los
   guiones vecinos que usan `.pathname` escriben sus capturas en una carpeta
   `Mantra%20Core%20Technologies` del escritorio sin que nadie se entere. */
const SALIDA = fileURLToPath(
  new URL('../docs/frontend/evidence/mi-perfil-sin-tu-acceso-2026-09-13', import.meta.url),
);

const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond) });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

/** Entra con una de las cuentas de la maqueta y deja la sesión abierta. */
async function entrar(pagina, correo) {
  await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.getByTestId('login-identifier').fill(correo);
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
}

/**
 * El navegador, a nivel de módulo para que lo alcance el cierre de emergencia.
 *
 * El 13/09/2026 una corrida de este guion se cortó a mitad y dejó **cuatro
 * procesos de Chromium vivos**, con la máquina en load 25 sobre 10 núcleos —
 * suficiente para que el guardián de recursos bloqueara toda prueba de
 * navegador de las demás sesiones. `await navegador.close()` al final del
 * camino feliz no se ejecuta cuando algo revienta antes, ni cuando llega un
 * Ctrl-C. La regla `20-resource-control.md` no se cumple sólo cuando todo sale
 * bien.
 */
let navegador;

async function cerrarNavegador() {
  await navegador?.close().catch(() => {});
  navegador = undefined;
}

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    void cerrarNavegador().then(() => process.exit(130));
  });
}

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  navegador = await chromium.launch();
  const errores = [];
  const respuestasFeas = [];

  /* ── El paciente: sin lateral, a todo el ancho ───────────────────────── */
  const contextoPaciente = await navegador.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'es-BO',
  });
  const paciente = await contextoPaciente.newPage();
  paciente.on('pageerror', (e) => errores.push(`paciente: ${e}`));
  paciente.on('response', (r) => {
    if (r.status() >= 400) respuestasFeas.push(`paciente ${r.status()} ${r.url()}`);
  });

  await entrar(paciente, 'paciente@alovida.mock');
  await paciente.goto(`${BASE}/my-account`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await paciente.getByTestId('mi-perfil-editar').waitFor({ timeout: 30_000 });
  await paciente.waitForTimeout(600);
  await paciente.screenshot({ path: `${SALIDA}/${SUFIJO}-paciente-1440.png`, fullPage: true });

  const cuerpoPaciente = (await paciente.locator('.mi-perfil').innerText()) ?? '';
  ok('paciente · «Tu acceso» ya no está', !cuerpoPaciente.includes('Tu acceso'));
  ok(
    'paciente · no queda columna lateral',
    (await paciente.locator('.mi-perfil__lateral').count()) === 0,
  );
  ok(
    'paciente · la rejilla no reserva la columna',
    (await paciente.locator('.mi-perfil--sin-lateral').count()) === 1,
  );

  const area = await paciente.locator('.app-main__inner').first().boundingBox();
  const tarjeta = await paciente.locator('.mi-perfil__principal').first().boundingBox();
  const izq = tarjeta.x - area.x;
  const der = area.x + area.width - (tarjeta.x + tarjeta.width);
  ok(
    'paciente · la ficha está centrada',
    Math.abs(izq - der) <= 2,
    `izq ${Math.round(izq)} · der ${Math.round(der)}`,
  );
  ok(
    'paciente · la ficha ocupa el ancho del área',
    tarjeta.width >= area.width * 0.85,
    `${Math.round(tarjeta.width)} de ${Math.round(area.width)}px`,
  );

  /* ── La médica: los dos enlaces y los contadores en tarjetas ─────────── */
  const contextoMedica = await navegador.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'es-BO',
  });
  const medica = await contextoMedica.newPage();
  medica.on('pageerror', (e) => errores.push(`médica: ${e}`));
  medica.on('response', (r) => {
    if (r.status() >= 400) respuestasFeas.push(`médica ${r.status()} ${r.url()}`);
  });

  await entrar(medica, 'medica@alovida.mock');
  await medica.goto(`${BASE}/my-account`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await medica.locator('nav[aria-label="Dónde ejercés"]').waitFor({ timeout: 30_000 });
  await medica.waitForTimeout(600);
  await medica.screenshot({ path: `${SALIDA}/${SUFIJO}-medica-1440.png`, fullPage: true });

  const enlaces = medica.locator('nav[aria-label="Dónde ejercés"] a');
  const textos = await enlaces.allInnerTexts();
  const destinos = await enlaces.evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  ok(
    'médica · conserva los dos accesos',
    textos.map((t) => t.trim()).join(' | ') === 'Mi consultorio propio | Organización médica',
    textos.map((t) => t.trim()).join(' | '),
  );
  ok(
    'médica · y llevan a donde deben',
    destinos.join(' | ') === '/administration/my-practice | /administration/medical-organization',
    destinos.join(' | '),
  );

  await medica.getByRole('tab', { name: 'Actividad' }).click();
  await medica.locator('.actividad').waitFor({ timeout: 15_000 });
  await medica.waitForTimeout(400);
  await medica.screenshot({
    path: `${SALIDA}/${SUFIJO}-medica-actividad-1440.png`,
    fullPage: true,
  });

  const bloques = await medica.locator('.actividad app-card').count();
  ok('médica · los contadores son tarjetas', bloques > 0, `${bloques} contadores`);
  ok(
    'médica · ya no son renglones de ficha',
    (await medica.locator('.actividad dt, .actividad dd').count()) === 0,
  );
  const primera = await medica.locator('.actividad app-card').first().boundingBox();
  const segunda = await medica.locator('.actividad app-card').nth(1).boundingBox();
  ok(
    'médica · reparten el ancho en una rejilla',
    segunda ? Math.abs(primera.width - segunda.width) <= 1 && segunda.x > primera.x : true,
    `${Math.round(primera.width)}px cada una`,
  );

  /* ── Modo oscuro y teléfono ──────────────────────────────────────────── */
  await medica.emulateMedia({ colorScheme: 'dark' });
  await medica.waitForTimeout(400);
  await medica.screenshot({
    path: `${SALIDA}/${SUFIJO}-medica-actividad-1440-oscuro.png`,
    fullPage: true,
  });
  await medica.emulateMedia({ colorScheme: 'light' });

  /* Tablet antes que teléfono: `30-testing.md` pide los tres anchos, y 768 es
     justo donde la rejilla `auto-fit` de los contadores decide si entran dos
     por fila o cuatro. Es el ancho donde un `minmax` mal puesto se nota, y el
     que faltaba. */
  await medica.setViewportSize({ width: 768, height: 1024 });
  await medica.waitForTimeout(500);
  await medica.screenshot({
    path: `${SALIDA}/${SUFIJO}-medica-actividad-768.png`,
    fullPage: true,
  });
  ok(
    'tablet · sin desborde horizontal',
    await medica.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );
  const enTablet = await medica.locator('.actividad app-card').first().boundingBox();
  const segundaEnTablet = await medica.locator('.actividad app-card').nth(1).boundingBox();
  ok(
    'tablet · los contadores siguen repartiendo el ancho',
    segundaEnTablet ? Math.abs(enTablet.width - segundaEnTablet.width) <= 1 : true,
    `${Math.round(enTablet.width)}px cada una`,
  );

  await medica.setViewportSize({ width: 375, height: 812 });
  await medica.waitForTimeout(500);
  await medica.screenshot({ path: `${SALIDA}/${SUFIJO}-medica-actividad-375.png`, fullPage: true });
  const enTelefono = await medica.locator('.actividad app-card').first().boundingBox();
  const segundaEnTelefono = await medica.locator('.actividad app-card').nth(1).boundingBox();
  ok(
    'teléfono · los contadores caen en una columna',
    segundaEnTelefono ? segundaEnTelefono.y > enTelefono.y : true,
  );
  ok(
    'teléfono · sin desborde horizontal',
    await medica.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );

  await paciente.setViewportSize({ width: 768, height: 1024 });
  await paciente.waitForTimeout(500);
  await paciente.screenshot({ path: `${SALIDA}/${SUFIJO}-paciente-768.png`, fullPage: true });
  ok(
    'tablet · el perfil del paciente sin desborde horizontal',
    await paciente.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );

  await paciente.setViewportSize({ width: 375, height: 812 });
  await paciente.waitForTimeout(500);
  await paciente.screenshot({ path: `${SALIDA}/${SUFIJO}-paciente-375.png`, fullPage: true });

  ok('sin errores de consola', errores.length === 0, errores.join(' · '));
  ok('sin respuestas 4xx/5xx', respuestasFeas.length === 0, respuestasFeas.slice(0, 3).join(' · '));

  await cerrarNavegador();

  const fallaron = veredictos.filter((v) => !v.cond);
  process.stdout.write(
    `\n${veredictos.length - fallaron.length}/${veredictos.length} comprobaciones en verde\n` +
      `capturas en ${SALIDA}\n`,
  );
  process.exit(fallaron.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  /* Cerrar ANTES de escribir el error: si el `write` falla, el navegador ya
     está muerto igual. */
  await cerrarNavegador();
  process.stderr.write(String(e) + '\n');
  process.exit(1);
});
