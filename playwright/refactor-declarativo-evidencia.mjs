/**
 * Evidencia de navegador del refactor declarativo (2026-09-21).
 *
 * Tres cosas, contra el backend simulado de `mockup`:
 *
 * 1. Las cuatro pantallas que adoptaron `historialDeCursor` siguen paginando:
 *    la primera página no ofrece «Anterior», «Siguiente» pide el cursor que
 *    devolvió la API, y «Anterior» vuelve sin inventar uno.
 * 2. El banco monta los tres pilotos por escenario: `DataTable` con sus diez
 *    estados, `ContentDialog` con contenido proyectado y `ViewStateHost` con los
 *    nueve del M34. Las salidas se ven en la pestaña «Salidas».
 * 3. Al montar un escenario nada sale a la red. (El backend simulado responde
 *    en proceso, así que esto NO demuestra que nadie pidió: esa garantía es
 *    estática —los anfitriones no importan clientes—.)
 *
 * Uso: `yarn node playwright/refactor-declarativo-evidencia.mjs [urlBase] [carpeta]`
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4377';
const SALIDA = process.argv[3] ?? 'docs/frontend/evidence/refactor-declarativo';

const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, ok: Boolean(cond), detalle });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

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

/** El estado accesible de un `app-button`: `aria-disabled`, no el atributo nativo. */
async function apagado(locator) {
  return (await locator.getAttribute('aria-disabled')) === 'true';
}

async function listadoConCursor(pagina, ruta, nombre, capturar) {
  await pagina.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  const tabla = pagina.getByTestId('tabla');
  await tabla.first().waitFor({ timeout: 60_000 });
  await pagina.waitForTimeout(600);
  await capturar(`${nombre}-1440-pagina-1`);

  const siguiente = pagina.getByTestId('tabla-siguiente');
  const anterior = pagina.getByTestId('tabla-anterior');
  const hayPaginacion = (await siguiente.count()) > 0;
  if (!hayPaginacion) {
    ok(`${nombre}: una sola página, sin paginación dibujada`, true);
    return;
  }
  ok(`${nombre}: en la primera página «Anterior» está apagado`, await apagado(anterior));

  const filasAntes = await pagina.getByTestId('tabla-fila').allTextContents();
  // El backend simulado responde **en proceso**: la petición nunca sale a la
  // red y Playwright no la ve. Lo que se puede comprobar desde afuera es el
  // efecto: otras filas, «Anterior» encendido, y la vuelta a las mismas filas.
  await siguiente.click();
  await pagina.waitForTimeout(900);
  ok(`${nombre}: en la segunda página «Anterior» se enciende`, !(await apagado(anterior)));
  await capturar(`${nombre}-1440-pagina-2`);

  const filasDespues = await pagina.getByTestId('tabla-fila').allTextContents();
  ok(`${nombre}: la segunda página trae otras filas`, filasDespues.join() !== filasAntes.join());

  await anterior.click();
  await pagina.waitForTimeout(900);
  const filasVuelta = await pagina.getByTestId('tabla-fila').allTextContents();
  ok(`${nombre}: «Anterior» vuelve a las filas de la primera página`, filasVuelta.join() === filasAntes.join());
  ok(`${nombre}: de vuelta en la primera página «Anterior» se apaga`, await apagado(anterior));
}

/** Abre una pestaña del panel del banco y espera a que quede seleccionada. */
async function pestana(pag, nombre) {
  const tab = pag.getByRole('tab', { name: nombre });
  for (let intento = 0; intento < 3; intento += 1) {
    await tab.click();
    await pag.waitForTimeout(150);
    if ((await tab.getAttribute('aria-selected')) === 'true') return;
  }
  throw new Error(`la pestaña ${String(nombre)} no quedó seleccionada`);
}

async function escenario(pagina, clave, variante, nombre, capturar, comprobar) {
  const url = `${BASE}/design-system/stock/${clave}`;
  await pagina.goto(url, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  const selector = pagina.getByTestId('stock-escenario');
  await selector.waitFor({ timeout: 60_000 });
  await selector.selectOption(`${clave}#${variante}`);
  await pagina.getByTestId('stock-montaje').waitFor({ timeout: 60_000 });
  await pagina.waitForTimeout(800);
  const montaje = await pagina.getByTestId('stock-montaje').textContent();
  ok(`${nombre} · ${variante}: el banco dice que montó por escenario`, montaje?.includes(`escenario · ${variante}`), montaje?.trim());
  const marco = pagina.frameLocator('iframe.marco-zona__marco');
  await comprobar(marco, pagina);
  await capturar(`stock-${nombre}-${variante}`);
  // Y el marco solo, al tamaño del dispositivo: es lo que hay que comparar
  // contra la pantalla real.
  await pagina.locator('.marco-zona__caja').screenshot({ path: `${SALIDA}/stock-${nombre}-${variante}-marco.png` });
}

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'es-BO',
    timezoneId: 'America/La_Paz',
  });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(String(e)));
  // Siempre desde arriba: un clic en una pestaña del banco desplaza la página
  // y la captura mostraba la mitad vacía del marco en vez del componente.
  const capturar = async (n) => {
    await pagina.evaluate(() => window.scrollTo(0, 0));
    await pagina.waitForTimeout(150);
    await pagina.screenshot({ path: `${SALIDA}/${n}.png`, fullPage: false });
  };

  /* ── 1 · Las pantallas que adoptaron historialDeCursor ─────────────────── */
  await entrar(pagina, 'superadmin@alovida.mock');
  await listadoConCursor(pagina, '/administration/patients', 'pacientes', capturar);
  await listadoConCursor(pagina, '/administration/organizations', 'organizaciones', capturar);
  await listadoConCursor(pagina, '/administration/services-catalog', 'catalogo-servicios', capturar);
  await listadoConCursor(pagina, '/administration/insurance-claims', 'solicitudes-seguro', capturar);

  /* pacientes en móvil: las columnas de prioridad 2 se pliegan, no se ocultan */
  await pagina.setViewportSize({ width: 390, height: 844 });
  await pagina.goto(`${BASE}/administration/patients`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.getByTestId('tabla').first().waitFor({ timeout: 60_000 });
  await pagina.waitForTimeout(600);
  await capturar('pacientes-390');
  await pagina.setViewportSize({ width: 1440, height: 1000 });

  /* ── 2 · El banco monta los pilotos por escenario ───────────────────────── */
  const TABLA = 'shared/components/organisms/data-table/data-table';
  const MODAL = 'shared/components/organisms/content-dialog/content-dialog';
  const HOST = 'shared/components/organisms/view-state-host/view-state-host';

  await escenario(pagina, TABLA, 'ready', 'data-table', capturar, async (marco, pag) => {
    const filas = await marco.getByTestId('tabla-fila').count();
    ok('DataTable ready: seis filas montadas en el marco', filas === 6, `${filas} filas`);
    await marco.getByTestId('tabla-ordenar').first().click();
    await marco.getByTestId('tabla-siguiente').click();
    await pag.waitForTimeout(400);
    await pestana(pag, /Salidas/);
    const salidas = await pag.getByTestId('stock-salidas').textContent();
    ok('DataTable ready: la pestaña Salidas registró sortChanged y cursorChanged', salidas?.includes('sortChanged') && salidas?.includes('cursorChanged'), salidas?.replace(/\s+/g, ' ').trim());
  });
  await escenario(pagina, TABLA, 'error', 'data-table', capturar, async (marco) => {
    const texto = await marco.locator('body').textContent();
    ok('DataTable error: S9 con el código de soporte visible', texto?.includes('req-7f3a1c9e'));
  });
  await escenario(pagina, TABLA, 'empty', 'data-table', capturar, async (marco) => {
    const texto = await marco.locator('body').textContent();
    ok('DataTable empty: S3 con la próxima acción', texto?.includes('Registrar un paciente'));
  });
  await escenario(pagina, TABLA, 'stale', 'data-table', capturar, async (marco) => {
    const texto = await marco.locator('body').textContent();
    ok('DataTable stale: S7 con la antigüedad visible', texto?.includes('21/09/2026'));
  });

  await escenario(pagina, MODAL, 'descartable', 'content-dialog', capturar, async (marco) => {
    const abierto = await marco.locator('dialog[open]').count();
    ok('ContentDialog descartable: el <dialog> nativo está abierto en el marco', abierto === 1);
    const pie = await marco.getByTestId('content-dialog-actions').textContent();
    ok('ContentDialog descartable: «Guardar» proyectado en el pie', pie?.includes('Guardar'));
  });
  await escenario(pagina, MODAL, 'con-cambios', 'content-dialog', capturar, async (marco, pag) => {
    await marco.locator('dialog').press('Escape');
    await pag.waitForTimeout(300);
    const sigueAbierto = await marco.locator('dialog[open]').count();
    ok('ContentDialog con-cambios: Escape NO cierra con cambios pendientes', sigueAbierto === 1);
    const pregunta = await marco.getByTestId('escenario-descarte').count();
    ok('ContentDialog con-cambios: el anfitrión pregunta si se descarta', pregunta === 1);
    await pestana(pag, /Salidas/);
    const salidas = await pag.getByTestId('stock-salidas').textContent();
    ok('ContentDialog con-cambios: Salidas registró opened y dismissAttempt', salidas?.includes('opened') && salidas?.includes('dismissAttempt'));
  });

  for (const variante of ['ready', 'stale', 'validation', 'forbidden', 'not-found', 'offline', 'error', 'empty', 'loading', 'route-auth-pending']) {
    await escenario(pagina, HOST, variante, 'view-state-host', capturar, async (marco, pag) => {
      const texto = (await marco.locator('body').textContent()) ?? '';
      const proyectado = await marco.getByTestId('escenario-contenido').count();
      const deberia = variante === 'ready' || variante === 'stale';
      ok(`ViewStateHost ${variante}: contenido proyectado ${deberia ? 'visible' : 'ausente'}`, (proyectado === 1) === deberia);
      if (variante === 'route-auth-pending') ok('ViewStateHost S1: sin esqueleto, con «Verificando permisos»', texto.includes('Verificando permisos'));
      await pestana(pag, /^Red/);
      const red = await pag.locator('.panel__contenido').textContent();
      // Lo que el observador de recursos puede ver: nada salió a la red. Las
      // lecturas que el backend simulado resuelve en proceso no aparecen acá.
      ok(`ViewStateHost ${variante}: nada salió a la red al montar`, red?.includes('No pidió nada a la red'), red?.replace(/\s+/g, ' ').trim().slice(0, 80));
    });
  }

  ok('sin errores de página en toda la corrida', errores.length === 0, errores.join(' | ').slice(0, 300));

  writeFileSync(
    `${SALIDA}/veredictos.json`,
    JSON.stringify({ base: BASE, fecha: new Date().toISOString(), veredictos, errores }, null, 2),
  );
  await navegador.close();
  const fallidos = veredictos.filter((v) => !v.ok).length;
  process.stdout.write(`\n${veredictos.length - fallidos}/${veredictos.length} comprobaciones en verde · ${SALIDA}\n`);
  process.exit(fallidos === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
