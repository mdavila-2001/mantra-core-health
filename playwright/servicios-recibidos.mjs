/**
 * Evidencia de «Servicios recibidos» contra la maqueta (modo demo):
 *
 * - Historia del paciente: sexta pestaña, UNA tarjeta centrada y a lo ancho, con las
 *   dos intervenciones y las dos vacunas del escenario canónico, el costo y el
 *   «Sin cobro registrado» de las vacunas.
 * - Ficha del médico: la misma lista SIN importes, y sin un «sin cobro» falso.
 * - Sin desborde horizontal a 390 px, sin identificadores ni fechas ISO.
 *
 * Uso: `node playwright/servicios-recibidos.mjs [urlBase]`
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4333';
const SALIDA = fileURLToPath(new URL('../evidencias/servicios-recibidos-2026-10-25', import.meta.url));
const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond), detalle });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

async function entrar(pagina, usuario) {
  await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 240_000 });
  await pagina.getByTestId('login-identifier').fill(`${usuario}@alovida.mock`);
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 90_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 90_000 });
  }
}

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch(process.env['PW_CHROMIUM'] ? { executablePath: process.env['PW_CHROMIUM'] } : {});
  const errores = [];
  
  /* ── Paciente ─────────────────────────────────────────────────────────── */
  const ctxPaciente = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
  const paciente = await ctxPaciente.newPage();
  paciente.on('pageerror', (e) => errores.push(String(e)));
  await entrar(paciente, 'paciente');
  await paciente.goto(`${BASE}/my-account/medical-record?seccion=servicios`, { waitUntil: 'domcontentloaded', timeout: 240_000 });
  await paciente.getByTestId('received-services-table').waitFor({ timeout: 90_000 });
  await paciente.getByText('Infiltración articular').first().waitFor({ timeout: 30_000 });
  await paciente.waitForTimeout(500);

  const textoP = await paciente.locator('[data-testid="historia-servicios"]').innerText();
  const pestanas = (await paciente.locator('[data-testid="historia-tabs"] [role="tab"]').allTextContents()).map((t) => t.trim().split(' (')[0]);
  ok('seis pestañas, «Servicios recibidos» al final', pestanas.length === 6 && pestanas.at(-1) === 'Servicios recibidos', pestanas.join(' · '));
  ok('la pestaña abierta es «Servicios recibidos»', (await paciente.locator('[role="tab"][aria-selected="true"]').innerText()).includes('Servicios recibidos'));
  ok('intervención 1: infiltración articular', /Infiltración articular/.test(textoP));
  ok('intervención 2: apendicectomía', /Apendicectomía laparoscópica/.test(textoP));
  ok('vacunas: influenza y antitetánica', /Influenza estacional/.test(textoP) && /Antitetánica/.test(textoP));
  ok('los tipos se rotulan: Intervención médica y Vacunación', /Intervención médica/.test(textoP) && /Vacunación/.test(textoP));
  ok('el titular ve el costo de la intervención (350.00 Bs y 4200.00 Bs)', /350\.00 Bs/.test(textoP) && /4200\.00 Bs/.test(textoP));
  ok('las vacunas dicen «Sin cobro registrado», no cero', (textoP.match(/Sin cobro registrado/g) ?? []).length === 2);
  ok('profesional y sede resueltos', /Valeria Rojas Mendoza/.test(textoP) && /Clínica Los Olivos/.test(textoP));
  ok('sin identificadores ni fechas ISO', !/[0-9a-f]{8}-[0-9a-f]{4}-/i.test(textoP) && !/\d{4}-\d{2}-\d{2}T/.test(textoP));

  const main = await paciente.locator('.app-main__inner').first().boundingBox();
  const tarjeta = await paciente.locator('.historia__tarjeta').first().boundingBox();
  const izq = tarjeta.x - main.x;
  const der = main.x + main.width - (tarjeta.x + tarjeta.width);
  process.stdout.write(`  área ${Math.round(main.width)}px · tarjeta ${Math.round(tarjeta.width)}px · izq ${Math.round(izq)} · der ${Math.round(der)}\n`);
  ok('UNA tarjeta centrada (misma holgura a ambos lados)', Math.abs(izq - der) <= 2);
  ok('la tarjeta ocupa el ancho del área de contenido', tarjeta.width >= main.width * 0.85);
  ok('una sola tarjeta de historia', (await paciente.locator('.historia__tarjeta').count()) === 1);
  await paciente.screenshot({ path: `${SALIDA}/01-paciente-1440.png`, fullPage: true });

  // oscuro
  await paciente.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
  await paciente.waitForTimeout(300);
  await paciente.screenshot({ path: `${SALIDA}/02-paciente-1440-oscuro.png`, fullPage: true });
  await paciente.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));

  // las otras pestañas siguen donde estaban
  await paciente.goto(`${BASE}/my-account/medical-record?seccion=recetas`, { waitUntil: 'domcontentloaded' });
  await paciente.waitForTimeout(1500);
  ok('?seccion=recetas sigue abriendo Recetas', (await paciente.locator('[role="tab"][aria-selected="true"]').innerText()).includes('Recetas'));

  /* ── Paciente en móvil ────────────────────────────────────────────────── */
  await paciente.setViewportSize({ width: 390, height: 844 });
  await paciente.goto(`${BASE}/my-account/medical-record?seccion=servicios`, { waitUntil: 'domcontentloaded' });
  await paciente.getByText('Infiltración articular').first().waitFor({ timeout: 60_000 });
  await paciente.waitForTimeout(500);
  const desborde = await paciente.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('390 px: sin desborde horizontal del documento', desborde <= 1, `${desborde}px`);
  await paciente.screenshot({ path: `${SALIDA}/03-paciente-390.png`, fullPage: true });
  await ctxPaciente.close();

  /* ── Médica ───────────────────────────────────────────────────────────── */
  const ctxMedica = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
  const medica = await ctxMedica.newPage();
  medica.on('pageerror', (e) => errores.push(String(e)));
  await entrar(medica, 'medica');
  // Como llega una médica de verdad: busca a la paciente por nombre y abre su expediente.
  await medica.goto(`${BASE}/medical-records`, { waitUntil: 'domcontentloaded', timeout: 240_000 });
  await medica.getByLabel('Nombre o código').fill('Pérez Quiroga');
  const fila = medica.locator('tr[data-testid="tabla-fila"]').filter({ hasText: 'Ana Lucía Pérez Quiroga' }).first();
  await fila.waitFor({ timeout: 60_000 });
  await fila.getByTestId('paciente-ver-expediente').click();
  await medica.waitForURL(/\/medical-records\/[0-9a-f-]{36}/, { timeout: 60_000 });
  await medica.locator('[role="tab"]').first().waitFor({ timeout: 90_000 });
  await medica.waitForTimeout(1000);
  ok('la ficha NO monta el panel de servicios hasta abrir su pestaña', (await medica.getByTestId('expediente-servicios').count()) === 0);
  const tabsM = (await medica.locator('[role="tab"]').allTextContents()).map((t) => t.trim().split(' (')[0]);
  ok('«Servicios recibidos» es la última pestaña de la ficha', tabsM.at(-1) === 'Servicios recibidos', tabsM.join(' · '));
  await medica.locator('[role="tab"]').last().click();
  await medica.getByTestId('expediente-servicios').waitFor({ timeout: 60_000 });
  await medica.getByText('Infiltración articular').first().waitFor({ timeout: 30_000 });
  await medica.waitForTimeout(500);
  const textoM = await medica.locator('[data-testid="expediente-servicios"]').innerText();
  ok('la ficha monta el panel al abrir la pestaña', (await medica.getByTestId('expediente-servicios').count()) === 1);
  ok('el médico ve las cuatro filas', /Infiltración articular/.test(textoM) && /Apendicectomía/.test(textoM) && /Influenza/.test(textoM) && /Antitetánica/.test(textoM));
  ok('el médico NO ve importes ni columna de costo', !/\bBs\b/.test(textoM) && !/Costo/.test(textoM));
  ok('el médico NO ve un «Sin cobro registrado» falso', !/Sin cobro registrado/.test(textoM));
  await medica.screenshot({ path: `${SALIDA}/04-medica-1440.png`, fullPage: true });
  await ctxMedica.close();

  ok('sin errores de página en toda la corrida', errores.length === 0, errores.slice(0, 2).join(' | '));
  await navegador.close();
  const fallos = veredictos.filter((v) => !v.cond);
  process.stdout.write(`\n${veredictos.length - fallos.length}/${veredictos.length} verificaciones\n`);
  process.exit(fallos.length === 0 ? 0 : 1);
}

main().catch((e) => {
  process.stderr.write(`${e?.stack ?? e}\n`);
  process.exit(2);
});
