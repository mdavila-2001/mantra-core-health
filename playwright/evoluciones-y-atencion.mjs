/**
 * Verificación de las fases 2 y 3 del plan de evoluciones y atención.
 *
 * Lo que comprueba, contra la maqueta y con la sesión de la médica:
 *
 * - **Evoluciones** lista una fila por atención, no por persona; el buscador
 *   reduce las filas; el chip de período cambia el resumen; y «Ver evolución»
 *   abre un modal —no navega al expediente, que era el problema de fondo—.
 * - **El expediente** no despliega nada dentro de la tabla: la celda tiene un
 *   menú «Acciones» y sus dos ítems abren modales, y el alto de la tabla no
 *   cambia al usarlos.
 *
 * Sin `networkidle` en ninguna espera: con HMR nunca llega y produce verdes
 * falsos. Se espera por elementos concretos.
 *
 * Uso: `yarn node playwright/evoluciones-y-atencion.mjs [urlBase]`
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4346';
const SALIDA = fileURLToPath(new URL('../artifacts/playwright/evoluciones-y-atencion', import.meta.url));
const RUIDO = [/favicon/i, /Content Security Policy/i, /inline script/i, /socket\.io/i];

const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond), detalle });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
  const pagina = await contexto.newPage();

  const errores = [];
  pagina.on('console', (m) => {
    if (m.type() !== 'error') return;
    const texto = m.text();
    if (RUIDO.some((p) => p.test(texto))) return;
    errores.push(texto);
  });
  pagina.on('pageerror', (e) => errores.push(String(e)));

  let n = 0;
  const capturar = async (nombre, opciones = {}) => {
    n += 1;
    await pagina.screenshot({
      path: `${SALIDA}/${String(n).padStart(2, '0')}-${nombre}.png`,
      ...opciones,
    });
  };
  const esperar = (ms) => pagina.waitForTimeout(ms);

  /* ── Ingreso como la médica ──────────────────────────────────────────── */
  await pagina.goto(`${BASE}/auth`);
  await pagina.getByTestId('login-identifier').waitFor({ timeout: 60_000 });
  await pagina.waitForTimeout(1_500);
  await pagina.getByTestId('login-identifier').fill('medica@alovida.mock');
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }

  /* ── Fase 2 · Evoluciones ────────────────────────────────────────────── */
  await pagina.goto(`${BASE}/progress-notes`);
  await pagina.locator('app-progress-notes').waitFor({ timeout: 60_000 });
  await esperar(2_000);

  const filas = pagina.locator('[data-testid^="evoluciones-ver-"]');
  const cuantas = await filas.count();
  ok('evoluciones: hay una fila por atención', cuantas > 0, `${cuantas} filas`);
  ok(
    'evoluciones: ya no promete lo que no da',
    !/Por ahora lista a quién atendiste/i.test(await pagina.locator('body').innerText()),
  );
  await capturar('evoluciones-lista', { fullPage: true });

  // El período: tres botones, y cambiarlo cambia el resumen.
  const resumenAntes = await pagina.locator('.evoluciones__resumen').innerText();
  ok('evoluciones: están los tres períodos', (await pagina.getByTestId('evoluciones-periodo-7').count()) === 1);
  await pagina.getByTestId('evoluciones-periodo-7').click();
  await esperar(2_000);
  const resumenDespues = await pagina.locator('.evoluciones__resumen').innerText();
  ok(
    'evoluciones: cambiar el período cambia el resumen',
    resumenAntes !== resumenDespues,
    `«${resumenAntes.trim()}» → «${resumenDespues.trim()}»`,
  );
  await pagina.getByTestId('evoluciones-periodo-30').click();
  await esperar(2_000);

  // El buscador reduce las filas.
  const antesDeBuscar = await filas.count();
  await pagina.locator('app-filter-bar input[type="search"], app-filter-bar input').first().fill('zzzz');
  await esperar(1_200);
  const despuesDeBuscar = await filas.count();
  ok(
    'evoluciones: buscar reduce las filas',
    despuesDeBuscar < antesDeBuscar,
    `${antesDeBuscar} → ${despuesDeBuscar}`,
  );
  await capturar('evoluciones-busqueda-sin-resultados', { fullPage: true });
  await pagina.locator('app-filter-bar input[type="search"], app-filter-bar input').first().fill('');
  await esperar(1_200);

  // «Ver evolución» abre un modal y NO navega: era el problema de fondo.
  const urlAntes = pagina.url();
  await filas.first().click();
  await pagina.locator('[role="dialog"], dialog[open]').first().waitFor({ timeout: 20_000 });
  ok('evoluciones: «Ver evolución» abre un modal', true);
  ok('evoluciones: y NO se va al expediente', pagina.url() === urlAntes, pagina.url());
  await esperar(1_200);
  await capturar('evoluciones-modal');
  // El expediente completo se ofrece **una sola vez**: cuando no hay notas lo
  // ofrece la próxima acción del vacío, y cuando las hay, el enlace del pie.
  const salidas =
    (await pagina.getByTestId('evoluciones-abrir-expediente').count()) +
    (await pagina.getByRole('link', { name: /abrir el expediente completo/i }).count());
  ok('evoluciones: el modal ofrece el expediente completo, sin repetirlo', salidas === 1, `${salidas}`);
  await pagina.keyboard.press('Escape');
  await esperar(600);

  /* ── Fase 3 · El expediente no se deforma ────────────────────────────── */
  // El archivo clínico no lista nada hasta que se busca: es un buscador, no un
  // padrón. Mismo camino que `verificacion-pedidos.mjs`.
  await pagina.goto(`${BASE}/medical-records`);
  await esperar(2_000);
  await pagina.getByRole('textbox').first().fill('a');
  await esperar(1_500);
  const verExpediente = pagina.getByRole('link', { name: /ver expediente/i }).first();
  await verExpediente.waitFor({ timeout: 30_000 });
  await verExpediente.click();
  await pagina.locator('app-tabs').first().waitFor({ timeout: 60_000 });
  await esperar(2_000);

  ok(
    'expediente: no hay ningún subidor desplegado dentro de la tabla',
    (await pagina.locator('app-data-table app-attachment-uploader').count()) === 0,
  );

  const acciones = pagina.getByTestId('expediente-acciones').first();
  if ((await acciones.count()) === 0) {
    ok('expediente: hay diagnósticos con menú de acciones', false, 'ningún diagnóstico listado');
  } else {
    const tabla = pagina.locator('app-data-table').first();
    const altoAntes = (await tabla.boundingBox())?.height ?? 0;

    await acciones.click();
    await esperar(800);
    await capturar('expediente-menu-acciones');

    await pagina.getByText('Cambiar estado clínico…').first().click();
    await pagina.locator('[role="dialog"], dialog[open]').first().waitFor({ timeout: 20_000 });
    await esperar(800);
    ok('expediente: «Cambiar estado clínico…» abre un modal', true);
    await capturar('expediente-modal-estado');

    const altoConModal = (await tabla.boundingBox())?.height ?? 0;
    ok(
      'expediente: el alto de la tabla no cambia al abrirlo',
      Math.abs(altoConModal - altoAntes) <= 2,
      `${altoAntes} → ${altoConModal}`,
    );

    await pagina.keyboard.press('Escape');
    await esperar(800);

    await acciones.click();
    await esperar(800);
    await pagina.getByText('Adjuntar archivo…').first().click();
    // Se espera al `<dialog>` de adentro y no al host: `app-attachment-dialog`
    // no tiene caja propia —su único hijo es el diálogo nativo, posicionado—,
    // así que Playwright lo ve siempre «hidden».
    await pagina.locator('app-attachment-dialog dialog[open]').waitFor({ timeout: 20_000 });
    await esperar(800);
    ok('expediente: «Adjuntar archivo…» abre el modal compartido', true);
    ok(
      'expediente: el subidor vive dentro del modal',
      (await pagina.locator('app-attachment-dialog app-attachment-uploader').count()) === 1,
    );
    await capturar('expediente-modal-adjuntos');

    const altoConAdjuntos = (await tabla.boundingBox())?.height ?? 0;
    ok(
      'expediente: la tabla tampoco crece con los adjuntos',
      Math.abs(altoConAdjuntos - altoAntes) <= 2,
      `${altoAntes} → ${altoConAdjuntos}`,
    );
    await pagina.keyboard.press('Escape');
    await esperar(600);
  }

  ok('sin errores de página', errores.length === 0, errores.slice(0, 3).join(' | '));

  await navegador.close();

  const malas = veredictos.filter((v) => !v.cond);
  process.stdout.write(
    `\n${veredictos.length - malas.length}/${veredictos.length} verificaciones · capturas en ${SALIDA}\n`,
  );
  if (malas.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exitCode = 1;
});
