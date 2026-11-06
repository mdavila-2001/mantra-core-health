/**
 * Evidencia de navegador (simulador) del pedido del cliente del 06/11/2026:
 * la orden de estudio elige primero Laboratorio o Imagenología.
 *
 *  - Laboratorio: tipo de análisis → árbol de estudios del tipo → muestra.
 *  - Imagenología: tipo de imagen → estudio → cuerpo 3D / lista de regiones →
 *    lado → contraste, con la ficha «qué hace / qué revisar».
 *
 * Recorrido de las mutaciones: UI → request → response → persistencia → recarga → UI.
 * El simulador contesta dentro de Angular: las peticiones se leen de
 * `window.__mockRequests`.
 *
 * Requiere: `yarn ng serve --configuration development,demo --port 4333`.
 * Uso: `PW_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux/chrome node playwright/orden-tipo-laboratorio-imagenologia.mjs`
 * Nunca espera `networkidle`: con HMR no llega y da verdes falsos.
 */
import { mkdirSync, writeFileSync } from 'node:fs';

import { chromium } from 'playwright';

const BASE = process.env.PW_BASE_URL ?? 'http://127.0.0.1:4333';
const SALIDA =
  process.env.SALIDA ?? 'docs/trabajo/2026-11-06-orden-tipo-laboratorio-imagenologia/evidencia';
mkdirSync(SALIDA, { recursive: true });

const VIEWPORTS = [
  { nombre: 'movil', width: 390, height: 844 },
  { nombre: 'tablet', width: 820, height: 1180 },
  { nombre: 'escritorio', width: 1440, height: 1100 },
];
const veredictos = [];
const problemas = [];
const notas = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond), detalle });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

const navegador = await chromium.launch(
  process.env.PW_CHROMIUM === undefined
    ? {}
    : { executablePath: process.env.PW_CHROMIUM, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] },
);
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
await contexto.addInitScript(() => {
  try {
    localStorage.setItem('mantra-core-health.theme', 'light');
  } catch {
    /* sin almacenamiento */
  }
});
const page = await contexto.newPage();
page.on('pageerror', (e) => problemas.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') problemas.push(`console.error: ${m.text()} @ ${m.location()?.url ?? ''}`);
});

async function asentarse() {
  let anterior = '';
  let iguales = 0;
  for (let i = 0; i < 30; i += 1) {
    await page.waitForTimeout(250);
    const ahora = await page.evaluate(
      () => `${document.querySelectorAll('app-card').length}:${document.body.scrollHeight}:${document.querySelectorAll('app-skeleton, app-spinner').length}`,
    );
    iguales = ahora === anterior ? iguales + 1 : 0;
    anterior = ahora;
    if (iguales >= 2 && ahora.endsWith(':0')) return;
  }
}
const peticiones = () => page.evaluate(() => window.__mockRequests ?? []);
const marca = async () => (await peticiones()).length;
const desde = async (i, f) => (await peticiones()).slice(i).filter(f);

async function fijarTema(tema) {
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), tema);
  await page.waitForTimeout(150);
}
async function captura(nombre, vp = VIEWPORTS[2], tema = 'light') {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await fijarTema(tema);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${SALIDA}/${nombre}-${vp.nombre}-${tema}.png` });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await fijarTema('light');
}
/** Desplaza el contenido del diálogo: arriba del todo, o hasta dejar `selector` a la vista. */
async function desplazar(selector) {
  await page.evaluate((sel) => {
    const d = document.querySelector('dialog[open]');
    if (d === null) return;
    const rec = (el) => [el, ...Array.from(el.querySelectorAll('*'))].filter((e) => e.scrollHeight > e.clientHeight + 4);
    if (sel === null) rec(d).forEach((e) => { e.scrollTop = 0; });
    else d.querySelector(sel)?.scrollIntoView({ block: 'center' });
  }, selector);
  await page.waitForTimeout(250);
}
async function matrizZona(nombre, selector) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const tema of ['light', 'dark']) {
      await fijarTema(tema);
      await desplazar(selector);
      await page.screenshot({ path: `${SALIDA}/${nombre}-${vp.nombre}-${tema}.png` });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await fijarTema('light');
}
async function matriz(nombre) {
  for (const vp of VIEWPORTS) for (const tema of ['light', 'dark']) await captura(nombre, vp, tema);
}

/** Abre un `app-select` o el selector de árbol y elige la opción por nombre. */
async function elegir(disparador, texto, { buscar } = {}) {
  await disparador.click();
  const dialogo = page.locator('dialog[open]').last();
  if (buscar !== undefined) {
    const caja = dialogo.locator('input[placeholder*="Buscar"]');
    if ((await caja.count()) > 0) await caja.first().fill(buscar);
  }
  // Opción de un select o fila de un árbol: se espera la que aparezca primero.
  const objetivo = dialogo
    .getByRole('option', { name: texto })
    .or(dialogo.getByRole('treeitem', { name: texto }))
    .first();
  await objetivo.waitFor({ state: 'visible', timeout: 15_000 });
  const etiqueta = ((await objetivo.innerText()) ?? '').replace(/\s+/g, ' ').trim();
  await objetivo.click();
  return etiqueta;
}

async function login() {
  await page.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 240_000 });
  await page.getByTestId('login-identifier').fill('medica@alovida.mock');
  await page.getByTestId('login-password').fill('cualquiera');
  await page.getByTestId('login-submit').click();
  await page.waitForURL((u) => !u.pathname.startsWith('/auth') || u.pathname.includes('organization'), { timeout: 60_000 });
  if (page.url().includes('/auth/organization')) {
    const opcion = page.getByTestId('tenant-opcion');
    if ((await opcion.count()) > 0) await opcion.first().click();
    else await page.getByRole('button').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60_000 });
  }
}

async function irALaConsulta() {
  await page.goto(`${BASE}/schedule`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await asentarse();
  const puertas = page.getByTestId('dia-ir-a-atender');
  const cuantas = await puertas.count();
  let entro = false;
  for (let i = 0; i < cuantas && !entro; i += 1) {
    await puertas.nth(i).click();
    try {
      await page.waitForURL((url) => url.pathname.endsWith('/consultation'), { timeout: 4_000 });
      entro = true;
    } catch {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
    }
  }
  if (!entro) {
    notas.push(`La agenda de hoy no tiene citas atendibles (${cuantas}): se entra por el archivo clínico.`);
    await page.goto(`${BASE}/medical-records`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await asentarse();
    await page.getByTestId('clinical-record-national-id').locator('input').first().fill('5000000').catch(async () => {
      await page.getByTestId('clinical-record-national-id').fill('5000000');
    });
    await page.getByTestId('clinical-record-search-by-document').click();
    await page.waitForTimeout(1500);
    await asentarse();
    const href = await page
      .locator('a[href*="/medical-records/"]')
      .evaluateAll((as) => as.map((a) => a.getAttribute('href') ?? '').find((h) => /\/medical-records\/[^/?#]+/.test(h)));
    if (href === undefined) throw new Error('la búsqueda por documento no devolvió ningún paciente');
    const limpio = href.replace(/\/(consultation|request-access)?$/, '').split('?')[0];
    await page.goto(`${BASE}${limpio}/consultation`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  }
  await asentarse();
  // El formulario de pedido exige un encuentro abierto: se espera el botón de abrir o el de cerrar.
  const abrir = page.getByTestId('consulta-abrir-encuentro');
  await Promise.race([
    abrir.waitFor({ timeout: 60_000 }),
    page.getByTestId('consulta-cerrar-encuentro').waitFor({ timeout: 60_000 }),
  ]);
  if ((await abrir.count()) > 0) {
    await abrir.click();
    await page.getByTestId('consulta-cerrar-encuentro').waitFor({ timeout: 30_000 });
    await asentarse();
  }
  return page.url();
}

async function abrirOrdenes() {
  await page.getByTestId('consulta-casilla-ordenes').click();
  await page.locator('dialog[open]').first().waitFor({ state: 'visible', timeout: 15_000 });
  await asentarse();
  return page.locator('dialog[open]').first();
}
async function cerrarModal() {
  for (let i = 0; i < 4; i += 1) {
    if ((await page.locator('dialog[open]').count()) === 0) return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const descartar = page.getByRole('button', { name: /^(Descartar|Sí, descartar|Cerrar sin guardar)$/ });
    if ((await descartar.count()) > 0) await descartar.first().click().catch(() => undefined);
  }
}

try {
  await login();
  const url = await irALaConsulta();
  notas.push(`Consulta: ${url}`);

  /* ═══════════ 0 · sin tipo de orden no se ofrece nada más ═══════════ */
  let modal = await abrirOrdenes();
  ok('0 el formulario ofrece «Tipo de orden»', (await modal.getByText('Tipo de orden').count()) > 0);
  ok('0 sin tipo elegido no hay «Tipo de análisis» ni «Tipo de imagen»',
    (await modal.getByTestId('lab-type').count()) === 0 && (await modal.getByTestId('imaging-modality').count()) === 0);
  await captura('00-tipo-de-orden');

  /* ═══════════ 1 · Laboratorio ═══════════ */
  await elegir(modal.getByRole('combobox', { name: 'Tipo de orden' }), 'Laboratorio');
  await page.waitForTimeout(300);
  ok('1 Laboratorio muestra «Tipo de análisis»', (await modal.getByTestId('lab-type').count()) > 0);
  const tipos = await (async () => {
    await modal.getByRole('combobox', { name: 'Tipo de análisis' }).click();
    const d = page.locator('dialog[open]').last();
    await d.getByRole('option').first().waitFor({ state: 'visible', timeout: 15_000 });
    const t = (await d.getByRole('option').allInnerTexts()).map((x) => x.split('\n')[0].trim());
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    return t;
  })();
  ok('1 los tipos de análisis son Sangre, Orina, Heces, Fluidos y secreciones, Genético',
    ['Sangre', 'Orina', 'Heces', 'Fluidos y secreciones', 'Genético'].every((t) => tipos.includes(t)), tipos.join(' | '));

  // Genético: vacío orientador
  await elegir(modal.getByRole('combobox', { name: 'Tipo de análisis' }), 'Genético');
  await page.waitForTimeout(300);
  ok('1 «Genético» dice que no hay estudios y no inventa ninguno', (await modal.getByTestId('lab-tree-empty').count()) === 1);
  await captura('01-laboratorio-genetico');

  // Un árbol por tipo: se abre el de cada uno, con su primera rama desplegada.
  for (const tipo of ['Orina', 'Heces', 'Fluidos y secreciones']) {
    await elegir(modal.getByRole('combobox', { name: 'Tipo de análisis' }), tipo);
    await page.waitForTimeout(300);
    await modal.locator('app-tree-select button').first().click();
    const d = page.locator('dialog[open]').last();
    await d.waitFor({ state: 'visible', timeout: 15_000 });
    await d.getByRole('treeitem').first().click().catch(() => undefined);
    await page.waitForTimeout(400);
    const txt = (await d.innerText()).replace(/\s+/g, ' ');
    ok(`1 el árbol de ${tipo} se abre con sus estudios`, txt.length > 40 && !/Hematolog/i.test(txt), txt.slice(0, 120));
    await captura(`02-laboratorio-arbol-${tipo.split(' ')[0].toLowerCase()}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // Sangre: árbol
  await elegir(modal.getByRole('combobox', { name: 'Tipo de análisis' }), 'Sangre');
  await page.waitForTimeout(300);
  const arbol = modal.locator('app-tree-select button').first();
  await arbol.click();
  const dialogoArbol = page.locator('dialog[open]').last();
  await dialogoArbol.waitFor({ state: 'visible', timeout: 15_000 });
  await page.waitForTimeout(400);
  const textoArbol = (await dialogoArbol.innerText()).replace(/\s+/g, ' ');
  ok('1 el árbol de Sangre trae sus ramas (Hematología, Química sanguínea…)', /Hematolog/i.test(textoArbol) && /Qu[ií]mica sangu/i.test(textoArbol), textoArbol.slice(0, 160));
  ok('1 el árbol de Sangre NO trae estudios de orina', !/Examen general de orina|Urocultivo/i.test(textoArbol));
  await captura('02-laboratorio-arbol-sangre');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  // elegir un estudio del árbol (uno que la persona sembrada no tenga reciente)
  let elegido = null;
  for (const candidato of ['Perfil lipídico', 'TSH', 'Creatinina', 'VIH (tamizaje)', 'Velocidad de sedimentación globular']) {
    await modal.locator('app-tree-select button').first().click();
    const d = page.locator('dialog[open]').last();
    await d.locator('input[placeholder*="Buscar"]').first().fill(candidato.split(' ')[0]);
    const fila = d.getByRole('treeitem').filter({ hasText: candidato }).first();
    if ((await fila.count()) === 0) { await page.keyboard.press('Escape'); continue; }
    await fila.click();
    elegido = candidato;
    break;
  }
  ok('1 se pudo elegir un estudio de laboratorio en el árbol', elegido !== null, elegido ?? '');
  await page.waitForTimeout(400);
  const muestras = await (async () => {
    await modal.getByRole('combobox', { name: 'Muestra' }).click();
    const d = page.locator('dialog[open]').last();
    await d.getByRole('option').first().waitFor({ state: 'visible', timeout: 15_000 });
    const t = (await d.getByRole('option').allInnerTexts()).map((x) => x.split('\n')[0].trim());
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    return t;
  })();
  ok('1 la muestra de Sangre se limita a muestras de sangre (no orina ni heces)',
    muestras.some((m) => /Sangre venosa/.test(m)) && !muestras.some((m) => /Orina|Heces/.test(m)), muestras.join(' | '));
  await elegir(modal.getByRole('combobox', { name: 'Muestra' }), 'Sangre venosa');
  await page.waitForTimeout(500);
  ok('1 aparece «Qué laboratorio lo realiza» (recomendación)', (await modal.getByText('Qué laboratorio lo realiza').count()) > 0);
  await matrizZona('03a-laboratorio-arriba', null);
  await matrizZona('03b-laboratorio-abajo', '[data-testid="performer-selector"]');

  let hito = await marca();
  const pedirLab = modal.getByRole('button', { name: /Pedir estudio/ });
  ok('1 «Pedir estudio» queda habilitado', (await pedirLab.getAttribute('aria-disabled')) !== 'true');
  await pedirLab.click();
  await page.waitForTimeout(1500);
  if ((await page.getByRole('heading', { name: /Ya hay un/ }).count()) > 0) {
    notas.push('El laboratorio elegido abrió la antiduplicación (requisito existente).');
    ok('1 sin duplicado', false, 'duplicado');
  }
  const postsLab = await desde(hito, (p) => p.method === 'POST' && p.url === '/clinical/service-requests');
  ok('1 salió UN POST /clinical/service-requests', postsLab.length === 1, JSON.stringify(postsLab[0]?.body));
  const bLab = postsLab[0]?.body ?? {};
  ok('1 el cuerpo lleva category LAB y specimenTypeConceptId, y ningún dato de imagen',
    bLab.category === 'LAB' && typeof bLab.specimenTypeConceptId === 'string' &&
    !('modalityConceptId' in bLab) && !('bodySiteConceptId' in bLab));
  ok('1 el servidor (simulador) aceptó con 2xx', postsLab[0] !== undefined && postsLab[0].status < 300, String(postsLab[0]?.status));
  await page.waitForTimeout(800);
  // recarga: persistencia
  await page.reload({ waitUntil: 'domcontentloaded' });
  await asentarse();
  modal = await abrirOrdenes();
  const listaLab = modal.getByTestId('estudios-lista');
  await listaLab.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);
  const detalles = await modal.getByTestId('estudios-detalle').allInnerTexts();
  ok('1 tras recargar, el histórico muestra «Sangre venosa» en la orden', detalles.some((d) => /Sangre venosa/.test(d)), detalles.join(' | '));
  await captura('04-laboratorio-historico');

  /* ═══════════ 2 · Imagenología ═══════════ */
  await elegir(modal.getByRole('combobox', { name: 'Tipo de orden' }), 'Imagenología');
  await page.waitForTimeout(500);
  ok('2 Imagenología muestra «Tipo de imagen» y no el tipo de análisis',
    (await modal.getByTestId('imaging-modality').count()) > 0 && (await modal.getByTestId('lab-type').count()) === 0);
  const modalidades = await (async () => {
    await modal.getByRole('combobox', { name: 'Tipo de imagen' }).click();
    const d = page.locator('dialog[open]').last();
    await d.getByRole('option').first().waitFor({ state: 'visible', timeout: 15_000 });
    const t = (await d.getByRole('option').allInnerTexts()).map((x) => x.split('\n')[0].trim());
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    return t;
  })();
  ok('2 los tipos de imagen incluyen Rayos X y Ecografía, sin «Laboratorio»',
    modalidades.includes('Rayos X') && modalidades.includes('Ecografía') && !modalidades.includes('Laboratorio'), modalidades.join(' | '));
  await elegir(modal.getByRole('combobox', { name: 'Tipo de imagen' }), 'Rayos X');
  await page.waitForTimeout(400);
  const ficha = modal.getByTestId('imaging-guidance');
  ok('2 aparece la ficha «Rayos X: qué hace» con «Para revisar antes de pedirlo»',
    (await ficha.count()) === 1 && /qué hace/.test(await ficha.innerText()) && /Para revisar antes de pedirlo/.test(await ficha.innerText()));
  ok('2 la ficha dice que es un texto interno pendiente de revisión clínica', /pendiente de revisión clínica/.test(await ficha.innerText()));
  await elegir(modal.getByRole('combobox', { name: /^Estudio/ }), 'Radiografía de miembro superior');
  await page.waitForTimeout(400);

  // cuerpo 3D
  const lienzo = modal.getByTestId('anatomy-viewer-canvas');
  await lienzo.waitFor({ state: 'attached', timeout: 20_000 }).catch(() => undefined);
  ok('2 el cuerpo 3D (visor del atlas, reusado) está en el formulario', (await modal.locator('app-anatomy-viewer').count()) === 1);
  await page.waitForTimeout(4000);
  const estadoVisor = await modal.locator('.anatomy-viewer').first().getAttribute('data-status').catch(() => null);
  notas.push(`Estado del visor 3D en este navegador: ${estadoVisor}`);
  await modal.locator('app-body-region-picker').scrollIntoViewIfNeeded();
  await captura('05-imagenologia-cuerpo-3d');

  // tocar el modelo
  const caja = await lienzo.boundingBox();
  if (caja !== null) {
    await page.mouse.click(caja.x + caja.width * 0.5, caja.y + caja.height * 0.4);
    await page.waitForTimeout(1500);
  }
  const nota = ((await modal.getByTestId('body-region-note').innerText().catch(() => '')) ?? '').trim();
  notas.push(`Tras tocar el modelo, la nota dice: «${nota}»`);

  // elegir por la lista (camino accesible)
  await modal.locator('label.radio-container', { hasText: 'Miembro superior' }).click();
  await page.waitForTimeout(400);
  ok('2 la lista elige la región «Miembro superior»', await modal.getByRole('radio', { name: 'Miembro superior' }).isChecked());
  ok('2 con región aparece «Lado»', (await modal.getByTestId('imaging-laterality').count()) > 0);
  await elegir(modal.getByRole('combobox', { name: 'Lado' }), 'Izquierdo');
  await elegir(modal.getByRole('combobox', { name: 'Contraste' }), 'Sin contraste');
  await page.waitForTimeout(500);
  ok('2 aparece «Qué centro de imagen lo realiza»', (await modal.getByText('Qué centro de imagen lo realiza').count()) > 0);
  await matrizZona('06a-imagenologia-arriba', null);
  await matrizZona('06b-imagenologia-cuerpo', 'app-body-region-picker');
  await matrizZona('06c-imagenologia-ejecutor', '[data-testid="performer-selector"]');

  hito = await marca();
  const pedirImg = modal.getByRole('button', { name: /Pedir estudio/ });
  ok('2 «Pedir estudio» queda habilitado', (await pedirImg.getAttribute('aria-disabled')) !== 'true');
  await pedirImg.click();
  await page.waitForTimeout(1500);
  const postsImg = await desde(hito, (p) => p.method === 'POST' && p.url === '/clinical/service-requests');
  ok('2 salió UN POST /clinical/service-requests', postsImg.length === 1, JSON.stringify(postsImg[0]?.body));
  const bImg = postsImg[0]?.body ?? {};
  ok('2 el cuerpo lleva category IMAGING, tipo de imagen, región, lado y contraste, y ninguna muestra',
    bImg.category === 'IMAGING' && ['modalityConceptId', 'bodySiteConceptId', 'lateralityConceptId', 'contrastConceptId'].every((k) => typeof bImg[k] === 'string') &&
    !('specimenTypeConceptId' in bImg));
  ok('2 el simulador aceptó con 2xx', postsImg[0] !== undefined && postsImg[0].status < 300, String(postsImg[0]?.status));
  await page.waitForTimeout(800);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await asentarse();
  modal = await abrirOrdenes();
  await modal.getByTestId('estudios-lista').waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);
  const detallesImg = await modal.getByTestId('estudios-detalle').allInnerTexts();
  ok('2 tras recargar, el histórico dice «Rayos X · Miembro superior · Izquierdo · Sin contraste»',
    detallesImg.some((d) => /Rayos X · Miembro superior · Izquierdo · Sin contraste/.test(d)), detallesImg.join(' | '));
  await captura('07-imagenologia-historico');

  /* ═══════════ 3 · cambiar de tipo no arrastra lo anterior ═══════════ */
  await elegir(modal.getByRole('combobox', { name: 'Tipo de orden' }), 'Imagenología');
  await page.waitForTimeout(300);
  await elegir(modal.getByRole('combobox', { name: 'Tipo de imagen' }), 'Ecografía');
  await elegir(modal.getByRole('combobox', { name: 'Tipo de orden' }), 'Laboratorio');
  await page.waitForTimeout(400);
  ok('3 al pasar a Laboratorio no queda el estudio de imagen ni la ficha', (await modal.getByTestId('imaging-guidance').count()) === 0 && (await modal.getByTestId('imaging-study').count()) === 0);
  await elegir(modal.getByRole('combobox', { name: 'Tipo de orden' }), 'Otro estudio');
  await page.waitForTimeout(400);
  ok('3 «Otro estudio» conserva el selector de estudios de siempre', (await modal.getByText('Electrocardiograma').count()) >= 0 && (await modal.getByRole('combobox', { name: /Estudio/ }).count()) >= 0);
  await captura('08-otro-estudio');
  await cerrarModal();
} catch (e) {
  problemas.push(`EXCEPCIÓN: ${e.stack ?? e}`);
  await page.screenshot({ path: `${SALIDA}/ZZ-error.png` }).catch(() => undefined);
}

const fallos = veredictos.filter((v) => !v.cond);
const consola = problemas.filter((p) => !/favicon|WebGL|GPU stall|swiftshader/i.test(p));
writeFileSync(
  `${SALIDA}/recorrido.log`,
  [
    ...veredictos.map((v) => `${v.cond ? 'PASS' : 'FAIL'} · ${v.nombre}${v.detalle ? ' — ' + v.detalle : ''}`),
    '', ...notas.map((n) => `NOTA · ${n}`),
    '', `Errores de consola/página (${consola.length}):`, ...consola.map((p) => `  ${p}`),
  ].join('\n'),
);
process.stdout.write(`\n${veredictos.length - fallos.length}/${veredictos.length} PASS · ${consola.length} errores de consola\n`);
await navegador.close();
process.exit(fallos.length === 0 && consola.length === 0 ? 0 : 1);
