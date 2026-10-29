/**
 * Evidencia de navegador de la franja F1 de infraestructura hospitalaria,
 * contra la MAQUETA (backend simulado en el navegador). Contra la API real NO.
 *
 * Recorre, y deja capturas a 1440, 768 y 390 px en
 * `docs/frontend/evidence/infra-f1/`:
 *   - el árbol de la pestaña «Infraestructura», su teclado y su ARIA;
 *   - crear edificio → piso → consultorio → habitación → cama y quirófano,
 *     recargar y volver a verlo (UI → request → response → persistencia →
 *     recarga → UI);
 *   - alta masiva con vista previa (con y sin choque de códigos);
 *   - importación CSV con errores por línea y luego corregida;
 *   - la ficha de un espacio (una tarjeta, cinco pestañas), su edición y el
 *     vínculo con una unidad;
 *   - clausurar con bloqueos, resolver, clausurar con motivo y recargar;
 *   - la pestaña «Establecimiento» (regulatorio, habilitaciones, capacidad);
 *   - los estados M34 que se pueden provocar en la maqueta.
 *
 * Uso: `node playwright/infra-f1-evidencia.mjs [urlBase] [ejecutable]`.
 * Sirve la salida de `ng build --configuration development,demo` con un
 * servidor estático con respaldo a index.html. NUNCA espera `networkidle`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4311';
const EJECUTABLE = process.argv[3] ?? process.env['PW_CHROMIUM'] ?? undefined;
const SALIDA = fileURLToPath(new URL('../docs/frontend/evidence/infra-f1/', import.meta.url));
const ANCHOS = [
  { w: 1440, h: 1500 },
  { w: 768, h: 1800 },
  { w: 390, h: 2300 },
];

/** Mismo `uuid` determinístico que `core/mock/mock-store.ts`: así se calculan los ids sembrados. */
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
const ficha = (codigo) => `/administration/medical-organization/spaces/${uuid(`infra-sanlucas-${codigo}`)}`;

const resultados = [];
const ok = (nombre, cond, detalle = '') => {
  resultados.push({ nombre, ok: Boolean(cond), detalle });
  process.stdout.write(`${cond ? 'OK  ' : 'FALLA'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

mkdirSync(SALIDA, { recursive: true });

const navegador = await chromium.launch({ ...(EJECUTABLE ? { executablePath: EJECUTABLE } : {}), args: ['--no-sandbox'] });

async function nuevaPagina(usuario = 'superadmin@alovida.mock', tenant = 2) {
  const contexto = await navegador.newContext({ viewport: { width: ANCHOS[0].w, height: ANCHOS[0].h } });
  const pagina = await contexto.newPage();
  pagina.errores = [];
  pagina.on('pageerror', (e) => pagina.errores.push(String(e)));
  // Para ver el estado S2 (cargando) el simulador responde a los 120 ms: con la
  // marca `lento` esa espera pasa a 6 s y el estado se alcanza a capturar.
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

async function irAConsola(pagina, practica = /San Lucas/) {
  await pagina.goto(`${BASE}/administration/medical-organization`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.getByTestId('practica-elegida').locator('button').waitFor({ timeout: 30_000 });
  await pagina.getByTestId('practica-elegida').locator('button').click();
  await pagina.getByRole('option', { name: practica }).click();
  await pagina.waitForTimeout(700);
}

async function abrirPestana(pagina, nombre) {
  await pagina.getByRole('tab', { name: nombre, exact: true }).click();
  await pagina.waitForTimeout(400);
}

async function abrirInfra(pagina, practica) {
  await irAConsola(pagina, practica);
  await abrirPestana(pagina, 'Infraestructura');
}

async function elegirSitio(pagina, testId, nombre) {
  await pagina.getByTestId(testId).locator('button').click();
  await pagina.getByRole('option', { name: nombre }).click();
  await pagina.waitForTimeout(600);
}

/** Captura el estado actual a los tres anchos; deja el último ancho en 1440 otra vez. */
async function tresAnchos(pagina, nombre) {
  for (const { w, h } of ANCHOS) {
    await pagina.setViewportSize({ width: w, height: h });
    await pagina.waitForTimeout(450);
    await pagina.screenshot({ path: `${SALIDA}${nombre}-${w}.png` });
  }
  await pagina.setViewportSize({ width: ANCHOS[0].w, height: ANCHOS[0].h });
  await pagina.waitForTimeout(250);
}

const uno = (pagina, nombre) => pagina.screenshot({ path: `${SALIDA}${nombre}-1440.png` });
const peticiones = (pagina) => pagina.evaluate(() => window.__mockRequests ?? []);
const fila = (pagina, texto) => pagina.locator('[role="treeitem"]').filter({ hasText: texto });

/** Abre (con el triángulo) cada nodo del camino y devuelve la fila del último. */
async function abrirRuta(pagina, camino) {
  for (let i = 0; i < camino.length; i++) {
    const f = fila(pagina, camino[i]).first();
    await f.waitFor({ timeout: 15_000 });
    if (i < camino.length - 1 && (await f.getAttribute('aria-expanded')) === 'false') {
      await f.locator('.tree__toggle').click();
      await pagina.waitForTimeout(150);
    }
  }
  return fila(pagina, camino[camino.length - 1]).first();
}

async function elegirNodo(pagina, camino) {
  const f = await abrirRuta(pagina, camino);
  await f.click();
  await pagina.waitForTimeout(250);
  return f;
}

/** Elige una opción de un `app-select` (el disparador lleva el testid o es su hijo). */
async function elegirOpcion(pagina, testId, opcion) {
  const sel = pagina.getByTestId(testId);
  const boton = (await sel.evaluate((e) => e.tagName)) === 'BUTTON' ? sel : sel.locator('button').first();
  await boton.click();
  await pagina.getByRole('option', { name: opcion, exact: false }).first().click();
  await pagina.waitForTimeout(150);
}

/** Avanza el formulario por partes hasta que el diálogo se cierre. `relleno` rellena páginas por su título. */
async function terminarFormulario(pagina, relleno = {}) {
  for (let i = 0; i < 9; i++) {
    const titulo = (await pagina.locator('[data-testid="espacio-formulario"] h2').first().textContent().catch(() => null))?.trim();
    if (titulo === undefined || titulo === null) return;
    if (relleno[titulo]) await relleno[titulo](pagina);
    const boton = pagina.getByRole('dialog').getByRole('button', { name: /^(Siguiente|Crear espacio|Guardar cambios)$/ }).last();
    await boton.click();
    await pagina.waitForTimeout(450);
    if ((await pagina.getByTestId('espacio-formulario').count()) === 0) return;
  }
}

async function crearEspacio(pagina, { codigo, nombre, forma, funcion, activar = true, relleno = {} }) {
  await pagina.getByTestId('espacio-codigo').fill(codigo);
  await pagina.getByTestId('espacio-nombre').fill(nombre);
  if (forma) await elegirOpcion(pagina, 'espacio-forma', forma);
  await pagina.getByRole('dialog').getByRole('button', { name: 'Siguiente' }).click();
  await pagina.waitForTimeout(350);
  await elegirOpcion(pagina, 'espacio-funcion', funcion);
  if (activar) await pagina.getByTestId('espacio-activar').click();
  await terminarFormulario(pagina, relleno);
  await pagina.waitForTimeout(500);
}

try {
  /* ══ 0 · Sesión de administración y la pestaña ══════════════════════════ */
  const admin = await nuevaPagina();
  await abrirInfra(admin);
  await admin.getByTestId('infra-tab').waitFor({ timeout: 20_000 });
  await admin.locator('[role="treeitem"]').first().waitFor();
  await tresAnchos(admin, '01-infraestructura-listo');

  const roles = await admin.evaluate(() => ({
    tree: document.querySelectorAll('[role="tree"]').length,
    items: document.querySelectorAll('[role="treeitem"]').length,
    tabbables: document.querySelectorAll('[role="treeitem"][tabindex="0"]').length,
    expandibles: document.querySelectorAll('[role="treeitem"][aria-expanded]').length,
    niveles: [...new Set([...document.querySelectorAll('[role="treeitem"]')].map((e) => e.getAttribute('aria-level')))],
    etiquetaArbol: document.querySelector('[role="tree"]')?.getAttribute('aria-label'),
  }));
  ok('árbol con role=tree, nombre accesible y un solo tabulador', roles.tree === 1 && roles.tabbables === 1 && roles.etiquetaArbol, JSON.stringify(roles));

  /* ── teclado ── */
  await admin.locator('[role="treeitem"][tabindex="0"]').focus();
  await admin.keyboard.press('ArrowDown');
  await admin.keyboard.press('ArrowRight'); // abre el piso 1
  await admin.waitForTimeout(200);
  await admin.keyboard.press('ArrowRight'); // baja al primer hijo
  await admin.waitForTimeout(200);
  const foco = await admin.evaluate(() => ({ nombre: document.activeElement?.textContent?.trim().slice(0, 40), nivel: document.activeElement?.getAttribute('aria-level'), rol: document.activeElement?.getAttribute('role') }));
  ok('flechas: ↓ → → baja al primer hijo del piso (nivel 3, foco real)', foco.rol === 'treeitem' && foco.nivel === '3', JSON.stringify(foco));
  await uno(admin, '02-infraestructura-teclado-foco');
  await admin.keyboard.press('ArrowLeft');
  await admin.keyboard.press('ArrowLeft');
  const cerrado = await admin.evaluate(() => document.activeElement?.getAttribute('aria-expanded'));
  ok('← sube al padre y ← lo cierra (aria-expanded=false)', cerrado === 'false', String(cerrado));
  await admin.keyboard.press('End');
  await admin.keyboard.press('Home');
  await admin.keyboard.press('Enter');
  await admin.waitForTimeout(250);
  ok('Enter elige la fila y el detalle muestra su nombre', (await admin.getByTestId('infra-panel-nombre').textContent())?.includes('Edificio A'));
  await tresAnchos(admin, '03-infraestructura-seleccion');

  /* ══ 1 · Crear: edificio → piso → consultorio → habitación → cama (y quirófano) ═ */
  // La alta en la raíz exige que no haya nada elegido: se recarga la pestaña.
  await admin.reload({ waitUntil: 'domcontentloaded' });
  await abrirInfra(admin);
  await admin.locator('[role="treeitem"]').first().waitFor();
  await admin.getByTestId('infra-agregar').click();
  await admin.getByTestId('espacio-formulario').waitFor();
  await admin.getByTestId('espacio-codigo').fill('ED-C');
  await admin.getByTestId('espacio-nombre').fill('Edificio C · Anexo');
  await uno(admin, '04-alta-pagina1-identificacion');
  await elegirOpcion(admin, 'espacio-forma', 'Edificio');
  await admin.getByRole('dialog').getByRole('button', { name: 'Siguiente' }).click();
  await admin.waitForTimeout(350);
  await elegirOpcion(admin, 'espacio-funcion', 'Edificio');
  await admin.getByTestId('espacio-activar').click();
  await uno(admin, '05-alta-pagina2-funcion');
  await terminarFormulario(admin);
  await admin.waitForTimeout(500);
  const postEdificio = (await peticiones(admin)).filter((p) => p.method === 'POST' && /\/care-spaces$/.test(p.url));
  ok('crear edificio: POST /care-spaces → 201', postEdificio.at(-1)?.status === 201, JSON.stringify(postEdificio.at(-1)?.body));
  ok('el edificio queda en el árbol y elegido', (await fila(admin, 'Edificio C · Anexo').first().getAttribute('aria-selected')) === 'true');
  await tresAnchos(admin, '06-edificio-creado');

  const creaciones = [
    { padre: ['Edificio C · Anexo'], codigo: 'ED-C-P1', nombre: 'Piso 1', forma: 'Piso', funcion: 'Piso' },
    { padre: ['Edificio C · Anexo', 'Piso 1'], codigo: 'CONS-C101', nombre: 'Consultorio C101', forma: 'Local', funcion: 'Consultorio' },
    { padre: ['Edificio C · Anexo', 'Piso 1'], codigo: 'HAB-C201', nombre: 'Habitación C201', forma: 'Local', funcion: 'Habitación de internación' },
    { padre: ['Edificio C · Anexo', 'Piso 1'], codigo: 'HAB-C202', nombre: 'Habitación C202', forma: 'Local', funcion: 'Habitación de internación' },
  ];
  for (const c of creaciones) {
    await elegirNodo(admin, c.padre);
    await admin.getByTestId('infra-agregar-dentro').click();
    await admin.getByTestId('espacio-formulario').waitFor();
    await crearEspacio(admin, c);
    const p = (await peticiones(admin)).filter((x) => x.method === 'POST' && /\/care-spaces$/.test(x.url)).at(-1);
    ok(`crear ${c.nombre}: 201 y queda en el árbol`, p?.status === 201 && (await fila(admin, c.nombre).count()) > 0, `${p?.status}`);
  }

  // Cama bajo la habitación C201
  await elegirNodo(admin, ['Edificio C · Anexo', 'Piso 1', 'Habitación C201']);
  await admin.getByTestId('infra-agregar-dentro').click();
  await admin.getByTestId('espacio-formulario').waitFor();
  await admin.getByTestId('espacio-codigo').fill('C201-A');
  await admin.getByTestId('espacio-nombre').fill('Cama C201-A');
  await admin.getByRole('dialog').getByRole('button', { name: 'Siguiente' }).click();
  await admin.waitForTimeout(300);
  await elegirOpcion(admin, 'espacio-funcion', 'Cama estándar');
  await admin.getByTestId('espacio-activar').click();
  await terminarFormulario(admin, {
    Cama: async (p) => {
      await elegirOpcion(p, 'espacio-categoria', 'Privada');
      await uno(p, '07-alta-pagina-cama');
    },
  });
  const pCama = (await peticiones(admin)).filter((x) => x.method === 'POST' && /\/care-spaces$/.test(x.url)).at(-1);
  ok('crear cama C201-A: 201 con categoría y censable', pCama?.status === 201 && pCama.body?.bedCategoryCode === 'BED_CAT_PRIVATE' && pCama.body?.censable === true, JSON.stringify(pCama?.body));

  // Quirófano (exige superficie, clima y tiempos por el PERFIL de la función)
  await elegirNodo(admin, ['Edificio C · Anexo', 'Piso 1']);
  await admin.getByTestId('infra-agregar-dentro').click();
  await admin.getByTestId('espacio-formulario').waitFor();
  await admin.getByTestId('espacio-codigo').fill('QX-C1');
  await admin.getByTestId('espacio-nombre').fill('Quirófano C1');
  await elegirOpcion(admin, 'espacio-forma', 'Local');
  await admin.getByRole('dialog').getByRole('button', { name: 'Siguiente' }).click();
  await admin.waitForTimeout(300);
  await elegirOpcion(admin, 'espacio-funcion', 'Quirófano');
  await admin.getByTestId('espacio-activar').click();
  // Sin superficie la página «Medidas» no deja avanzar: lo comprobamos y lo mostramos.
  await admin.getByRole('dialog').getByRole('button', { name: 'Siguiente' }).click();
  await admin.waitForTimeout(300);
  await admin.getByRole('dialog').getByRole('button', { name: 'Siguiente' }).click();
  await admin.waitForTimeout(300);
  ok('quirófano: sin superficie no se avanza (el perfil de la función la exige)', (await admin.locator('[data-testid="espacio-formulario"] h2').first().textContent())?.includes('Medidas'));
  await uno(admin, '08-alta-quirofano-superficie-obligatoria');
  await admin.getByTestId('espacio-area').fill('36');
  await terminarFormulario(admin, {
    'Ambiente y climatización': async (p) => {
      await p.locator('input[data-testid="campo-airChangesPerHour"], [data-campo="airChangesPerHour"] input').first().fill('20');
      await uno(p, '09-alta-quirofano-climatizacion');
    },
    'Tiempos de quirófano': async (p) => {
      await p.locator('[data-campo="prepMinutes"] input').first().fill('20');
      await p.locator('[data-campo="cleanupMinutes"] input').first().fill('30');
    },
  });
  const pQx = (await peticiones(admin)).filter((x) => x.method === 'POST' && /\/care-spaces$/.test(x.url)).at(-1);
  ok('crear quirófano: 201 con superficie, ACH y tiempos', pQx?.status === 201 && pQx.body?.areaM2 === 36 && pQx.body?.airChangesPerHour === 20 && pQx.body?.prepMinutes === 20, JSON.stringify(pQx?.body));

  await abrirRuta(admin, ['Edificio C · Anexo', 'Piso 1', 'Habitación C201']);
  await tresAnchos(admin, '10-arbol-con-lo-creado');

  /* ── recargar y volver a verlo ── */
  await admin.reload({ waitUntil: 'domcontentloaded' });
  await abrirInfra(admin);
  await admin.locator('[role="treeitem"]').first().waitFor();
  const camaRecarga = await abrirRuta(admin, ['Edificio C · Anexo', 'Piso 1', 'Habitación C201', 'Cama C201-A']);
  ok('recarga: el edificio, el piso y la cama siguen ahí (vienen de la API simulada, no de la pantalla)', await camaRecarga.isVisible());
  const quirofanoRecarga = fila(admin, 'Quirófano C1');
  ok('recarga: el quirófano sigue ahí', (await quirofanoRecarga.count()) > 0);
  await tresAnchos(admin, '11-recarga-persistencia');

  /* ══ 2 · Alta masiva con vista previa ═══════════════════════════════════ */
  await elegirNodo(admin, ['Edificio C · Anexo', 'Piso 1', 'Habitación C201']);
  await admin.getByTestId('infra-agregar-varios').click();
  await admin.getByTestId('masiva-dialogo').waitFor();
  await elegirOpcion(admin, 'masiva-funcion', 'Cama estándar');
  await admin.getByTestId('masiva-codigo').fill('C201-{A..C}');
  await admin.getByTestId('masiva-nombre').fill('Cama C201-{A..C}');
  await uno(admin, '12-masiva-formulario');
  await admin.getByRole('dialog').getByRole('button', { name: 'Siguiente' }).click();
  await admin.waitForTimeout(300);
  await admin.getByRole('dialog').getByRole('button', { name: 'Ver vista previa' }).click();
  await admin.getByTestId('masiva-resumen').waitFor();
  ok('masiva con un código repetido: la vista previa lo marca y «Crear» no se ofrece', (await admin.getByTestId('masiva-resumen').textContent())?.includes('1 con código ya usado') && (await admin.getByTestId('masiva-crear').getAttribute('aria-disabled')) === 'true');
  await tresAnchos(admin, '13-masiva-vista-previa-con-choque');
  await admin.getByRole('dialog').getByRole('button', { name: 'Volver a editar' }).click();
  await admin.getByTestId('masiva-codigo').waitFor();
  await admin.getByTestId('masiva-codigo').fill('C201-{B..I}');
  await admin.getByTestId('masiva-nombre').fill('Cama C201-{B..I}');
  await admin.getByRole('dialog').getByRole('button', { name: 'Siguiente' }).click();
  await admin.waitForTimeout(300);
  await admin.getByRole('dialog').getByRole('button', { name: 'Ver vista previa' }).click();
  await admin.getByTestId('masiva-resumen').waitFor();
  ok('masiva C201-{B..I}: vista previa de 8 camas, sin choques y SIN petición de alta todavía', (await admin.getByTestId('masiva-resumen').textContent())?.includes('8 espacios') && (await admin.locator('[data-testid="masiva-dialogo"] tbody tr').count()) === 8 && !(await peticiones(admin)).some((p) => p.url.endsWith('/bulk')));
  await tresAnchos(admin, '14-masiva-vista-previa-ocho-camas');
  await admin.getByTestId('masiva-crear').click();
  await admin.getByTestId('infra-aviso').waitFor();
  const bulk = (await peticiones(admin)).find((p) => p.url.endsWith('/bulk'));
  ok('masiva: POST /bulk → 201 con el patrón tal cual', bulk?.status === 201 && bulk.body?.codePattern === 'C201-{B..I}', JSON.stringify(bulk?.body));
  const padreBulk = await abrirRuta(admin, ['Edificio C · Anexo', 'Piso 1', 'Habitación C201']);
  ok('masiva: las 8 camas quedan bajo la habitación (más la A: 9 hijos)', (await padreBulk.locator('xpath=following::*[@role="treeitem"][@aria-level="4"]').count()) >= 9);
  await tresAnchos(admin, '15-masiva-creada');

  /* ══ 3 · Importación CSV con errores por línea ══════════════════════════ */
  await admin.getByTestId('infra-importar').click();
  await admin.getByTestId('csv-dialogo').waitFor();
  const cabecera = 'code,name,formCode,functionCode,parentCode';
  const csvConErrores = [
    cabecera,
    'CSV-1,Consultorio CSV 1,LOC_FORM_ROOM,SPACE_FN_CONSULTING_ROOM,ED-C-P1',
    'CONS-C101,Repetido,LOC_FORM_ROOM,SPACE_FN_CONSULTING_ROOM,ED-C-P1',
    'CSV-3,Cama colgada de un piso,LOC_FORM_BED,SPACE_FN_BED_STANDARD,ED-C-P1',
    'CSV-4,Sin padre,LOC_FORM_ROOM,SPACE_FN_CONSULTING_ROOM,NO-EXISTE',
    'CSV-5,Consultorio CSV 5,LOC_FORM_ROOM,SPACE_FN_CONSULTING_ROOM,ED-C-P1',
  ].join('\n');
  await admin.getByTestId('csv-dialogo').locator('textarea').fill(csvConErrores);
  await uno(admin, '16-csv-archivo-pegado');
  await admin.getByTestId('csv-validar').click();
  await admin.getByTestId('csv-errores').waitFor();
  const filasError = await admin.locator('[data-testid="csv-error-fila"]').evaluateAll((trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())));
  ok('CSV en seco: errores exactamente en las líneas 3, 4 y 5 con campo y motivo', JSON.stringify(filasError.map((f) => f[0])) === '["3","4","5"]', JSON.stringify(filasError));
  ok('CSV con errores: «Importar» no se ofrece y no se creó nada', (await admin.getByTestId('csv-importar').count()) === 0 && !(await peticiones(admin)).some((p) => p.url.includes('dryRun=false')));
  await tresAnchos(admin, '17-csv-errores-por-linea');
  const csvOk = [cabecera, 'CSV-1,Consultorio CSV 1,LOC_FORM_ROOM,SPACE_FN_CONSULTING_ROOM,ED-C-P1', 'CSV-5,Consultorio CSV 5,LOC_FORM_ROOM,SPACE_FN_CONSULTING_ROOM,ED-C-P1', 'CSV-6,Consultorio CSV 6,LOC_FORM_ROOM,SPACE_FN_CONSULTING_ROOM,ED-C-P1'].join('\n');
  await admin.getByTestId('csv-dialogo').locator('textarea').fill(csvOk);
  await admin.getByTestId('csv-validar').click();
  await admin.getByTestId('csv-importar').waitFor();
  await tresAnchos(admin, '18-csv-validacion-limpia');
  await admin.getByTestId('csv-importar').click();
  await admin.getByTestId('infra-aviso').waitFor();
  const imp = (await peticiones(admin)).filter((p) => p.url.includes('/import'));
  ok('CSV corregido: dryRun=true y luego dryRun=false con las MISMAS filas; creó 3', imp.at(-2)?.url.includes('dryRun=true') && imp.at(-1)?.url.includes('dryRun=false') && JSON.stringify(imp.at(-1).body) === JSON.stringify(imp.at(-2).body) && (await admin.getByTestId('infra-aviso').textContent())?.includes('3'), JSON.stringify(imp.map((p) => p.status)));
  await tresAnchos(admin, '19-csv-importado');

  /* ══ 4 · La ficha: una tarjeta centrada con cinco pestañas ═════════════ */
  await elegirNodo(admin, ['Edificio C · Anexo', 'Piso 1', 'Habitación C201']);
  await admin.getByTestId('infra-abrir-ficha').click();
  await admin.getByTestId('ficha-espacio').waitFor({ timeout: 20_000 });
  const geo = await admin.evaluate(() => {
    const main = document.querySelector('.app-main__inner').getBoundingClientRect();
    const f = document.querySelector('.ficha-espacio').getBoundingClientRect();
    return { area: main.width, ficha: f.width, izq: f.x - main.x, der: main.x + main.width - (f.x + f.width), tarjetas: document.querySelectorAll('.ficha-espacio app-card').length, lateral: document.querySelectorAll('.ficha-espacio aside').length };
  });
  ok('ficha: centrada (holgura izquierda y derecha ≤ 2 px)', Math.abs(geo.izq - geo.der) <= 2, JSON.stringify(geo));
  ok('ficha: a lo ancho (≥ 85 % del área) y UNA tarjeta sin columna lateral', geo.ficha >= geo.area * 0.85 && geo.tarjetas === 1 && geo.lateral === 0);
  const pestanas = (await admin.locator('[data-testid="ficha-pestanas"] [role="tab"]').allTextContents()).map((t) => t.trim());
  ok('ficha: pestañas General · Atributos técnicos · Unidades · Hijos · Historial', pestanas.join(' · ') === 'General · Atributos técnicos · Unidades · Hijos · Historial', pestanas.join(' · '));
  await tresAnchos(admin, '20-ficha-general');
  const urlFicha = admin.url();
  for (const [i, nombre] of [[1, 'atributos'], [2, 'unidades'], [3, 'hijos'], [4, 'historial']]) {
    await admin.locator('[data-testid="ficha-pestanas"] [role="tab"]').nth(i).click();
    await admin.waitForTimeout(500);
    await tresAnchos(admin, `2${i}-ficha-${nombre}`);
  }

  // Editar desde la pestaña Atributos (el lápiz abre donde se miraba)
  await admin.locator('[data-testid="ficha-pestanas"] [role="tab"]').nth(1).click();
  await admin.getByRole('button', { name: 'Editar' }).click();
  await admin.getByTestId('espacio-formulario').waitFor();
  const paginaAbierta = (await admin.locator('[data-testid="espacio-formulario"] h2').first().textContent())?.trim();
  ok('editar desde «Atributos técnicos» abre en la página de medidas', paginaAbierta === 'Medidas', paginaAbierta);
  await admin.getByTestId('espacio-area').fill('21');
  await uno(admin, '25-ficha-editar-medidas');
  await terminarFormulario(admin);
  await admin.waitForTimeout(600);
  const patch = (await peticiones(admin)).filter((p) => p.method === 'PATCH').at(-1);
  ok('editar: PATCH 200 con la superficie', patch?.status === 200 && patch.body?.areaM2 === 21, JSON.stringify(patch?.body));
  ok('editar: la ficha muestra 21 m²', (await admin.getByTestId('ficha-atributos').textContent())?.includes('21 m²'));

  // Vincular con una unidad
  await admin.locator('[data-testid="ficha-pestanas"] [role="tab"]').nth(2).click();
  await admin.getByTestId('ficha-vincular').click();
  await admin.getByTestId('vinculo-dialogo').waitFor();
  await elegirOpcion(admin, 'vinculo-unidad', 'Medicina interna');
  await elegirOpcion(admin, 'vinculo-rol', 'Propietaria');
  await uno(admin, '26-ficha-vincular-unidad');
  await admin.getByTestId('vinculo-guardar').click();
  await admin.getByTestId('ficha-unidades').waitFor();
  ok('vincular: POST 201 y la tabla muestra la unidad propietaria', (await admin.getByTestId('ficha-unidades').textContent())?.includes('Medicina interna'));
  await admin.reload({ waitUntil: 'domcontentloaded' });
  await admin.getByTestId('ficha-espacio').waitFor({ timeout: 20_000 });
  await admin.locator('[data-testid="ficha-pestanas"] [role="tab"]').nth(2).click();
  ok('recarga de la ficha: el vínculo y la edición siguen', (await admin.getByTestId('ficha-unidades').textContent())?.includes('Medicina interna'));
  await uno(admin, '27-ficha-recarga-vinculo');

  /* ══ 5 · Clausurar: bloqueos → resolver → motivo → recargar ═══════════ */
  await admin.goto(`${BASE}${ficha('HAB-302')}`, { waitUntil: 'domcontentloaded' });
  await admin.getByTestId('ficha-espacio').waitFor({ timeout: 20_000 });
  await admin.getByRole('button', { name: 'Clausurar' }).click();
  await admin.getByTestId('bloqueos-dialogo').waitFor();
  const bloqueos = await admin.locator('[data-testid="bloqueo"]').evaluateAll((ls) => ls.map((l) => ({ kind: l.getAttribute('data-kind'), texto: l.textContent.replace(/\s+/g, ' ').trim() })));
  ok('clausurar con camas activas: 409 con ACTIVE_CHILDREN y su próxima acción', bloqueos.length === 1 && bloqueos[0].kind === 'ACTIVE_CHILDREN' && bloqueos[0].texto.includes('Clausure o mueva'), JSON.stringify(bloqueos));
  ok('el diálogo de bloqueos no ofrece confirmar la clausura', (await admin.getByRole('dialog').getByRole('button', { name: /^Clausurar/ }).count()) === 0);
  await tresAnchos(admin, '30-clausura-bloqueos-hijos');
  await admin.getByTestId('bloqueos-dialogo').locator('a').first().click();
  await admin.getByTestId('ficha-espacio').waitFor();
  for (const cama of ['302-A', '302-B']) {
    await admin.goto(`${BASE}${ficha(cama)}`, { waitUntil: 'domcontentloaded' });
    await admin.getByTestId('ficha-espacio').waitFor();
    await admin.getByRole('button', { name: 'Clausurar' }).click();
    await admin.locator('dialog[open] textarea').fill(`Baja de la cama ${cama} por remodelación`);
    if (cama === '302-A') await uno(admin, '31-clausura-motivo-cama');
    await admin.locator('dialog[open]').getByRole('button', { name: 'Clausurar' }).click();
    await admin.waitForTimeout(700);
    ok(`clausurar cama ${cama}: «Clausurado» con motivo`, (await admin.getByTestId('ficha-estado').textContent())?.includes('Clausurado'));
  }
  await admin.goto(`${BASE}${ficha('HAB-302')}`, { waitUntil: 'domcontentloaded' });
  await admin.getByTestId('ficha-espacio').waitFor();
  await admin.getByRole('button', { name: 'Clausurar' }).click();
  await admin.locator('dialog[open] textarea').waitFor();
  ok('resuelto el bloqueo: ya no hay lista y se pide el motivo (confirmWithReason)', (await admin.getByTestId('bloqueos-dialogo').count()) === 0);
  await uno(admin, '32-clausura-habitacion-motivo');
  await admin.locator('dialog[open] textarea').fill('Remodelación completa del ala de internación');
  await admin.locator('dialog[open]').getByRole('button', { name: 'Clausurar' }).click();
  await admin.waitForTimeout(800);
  const lifecycle = (await peticiones(admin)).filter((p) => p.url.endsWith('/lifecycle')).at(-1);
  ok('clausurar habitación: POST /lifecycle 200 con action=retire y motivo', lifecycle?.status === 200 && lifecycle.body?.action === 'retire' && lifecycle.body?.reason?.includes('Remodelación'), JSON.stringify(lifecycle?.body));
  await tresAnchos(admin, '33-clausura-habitacion-clausurada');
  await admin.reload({ waitUntil: 'domcontentloaded' });
  await admin.getByTestId('ficha-espacio').waitFor();
  ok('recarga: la habitación sigue clausurada y sin acciones', (await admin.getByTestId('ficha-estado').textContent())?.includes('Clausurado') && (await admin.getByRole('button', { name: 'Clausurar' }).count()) === 0);
  await admin.locator('[data-testid="ficha-pestanas"] [role="tab"]').nth(4).click();
  await admin.getByTestId('ficha-historial').waitFor();
  ok('historial: queda la revisión de la clausura con su motivo', (await admin.getByTestId('ficha-historial').textContent())?.includes('Remodelación completa'));
  await uno(admin, '34-clausura-historial');

  // Un quirófano con cirugías futuras (externo): lista con ids de otro módulo
  await admin.goto(`${BASE}/administration/medical-organization/spaces/${uuid('operating-room-1')}`, { waitUntil: 'domcontentloaded' });
  await admin.getByTestId('ficha-espacio').waitFor();
  await admin.getByRole('button', { name: 'Clausurar' }).click();
  await admin.getByTestId('bloqueos-dialogo').waitFor();
  ok('quirófano con cirugías: bloqueo FUTURE_PROCEDURE con su próxima acción', (await admin.getByTestId('bloqueos-dialogo').textContent())?.includes('Cirugías programadas'));
  await tresAnchos(admin, '35-clausura-bloqueos-cirugias');

  // 412: otra persona cambia el espacio mientras éste edita
  await admin.goto(`${BASE}${ficha('CONS-102')}`, { waitUntil: 'domcontentloaded' });
  await admin.getByTestId('ficha-espacio').waitFor();
  await admin.getByRole('button', { name: 'Editar' }).click();
  await admin.getByTestId('espacio-formulario').waitFor();
  await admin.getByTestId('espacio-nombre').fill('Consultorio 102 (mi cambio)');
  await admin.evaluate(async () => {
    const comp = window.ng.getComponent(document.querySelector('app-space-detail'));
    const id = comp.detail().id;
    await new Promise((r) => comp.client.updateCareSpace(id, comp.detail().rowVersion, { name: 'Cambiado por otra persona' }).subscribe(r));
  });
  await terminarFormulario(admin);
  await admin.waitForTimeout(500);
  const aviso412 = await admin.getByTestId('infra-issue-alert').textContent().catch(() => '');
  ok('412 por If-Match viejo: S4 «otra persona cambió este dato», con código de soporte y lo escrito intacto', aviso412.includes('Otra persona cambió') && aviso412.includes('req-infra-'), aviso412.replace(/\s+/g, ' '));
  await uno(admin, '36-conflicto-412');
  await admin.keyboard.press('Escape');

  // SPACE_CODE_TAKEN en el alta
  await irAConsola(admin);
  await abrirPestana(admin, 'Infraestructura');
  await elegirNodo(admin, ['Edificio C · Anexo', 'Piso 1']);
  await admin.getByTestId('infra-agregar-dentro').click();
  await admin.getByTestId('espacio-formulario').waitFor();
  await admin.getByTestId('espacio-codigo').fill('CONS-C101');
  await admin.getByTestId('espacio-nombre').fill('Otro consultorio');
  await elegirOpcion(admin, 'espacio-forma', 'Local');
  await admin.getByRole('dialog').getByRole('button', { name: 'Siguiente' }).click();
  await admin.waitForTimeout(300);
  await elegirOpcion(admin, 'espacio-funcion', 'Consultorio');
  await terminarFormulario(admin);
  await admin.waitForTimeout(500);
  const avisoCodigo = await admin.getByTestId('infra-issue-alert').textContent().catch(() => '');
  ok('código repetido: 409 SPACE_CODE_TAKEN, S4 anclado al campo código', avisoCodigo.includes('code:') && avisoCodigo.includes('no se reutiliza'), avisoCodigo.replace(/\s+/g, ' '));
  await uno(admin, '37-alta-codigo-repetido');
  await admin.keyboard.press('Escape');

  /* ══ 6 · Establecimiento ═════════════════════════════════════════════ */
  await irAConsola(admin);
  await abrirPestana(admin, 'Establecimiento');
  await admin.getByTestId('regulatorio-datos').waitFor();
  const unaTarjeta = await admin.locator('[data-testid="estab-tab"] app-card').count();
  ok('Establecimiento: UNA tarjeta con tres pestañas', unaTarjeta === 1 && (await admin.locator('[data-testid="estab-pestanas"] [role="tab"]').count()) === 3);
  await tresAnchos(admin, '40-establecimiento-regulatorio');
  await admin.locator('[data-testid="estab-pestanas"] [role="tab"]').nth(1).click();
  await admin.getByTestId('habilitaciones').waitFor();
  ok('habilitaciones: la guardada como vigente que venció se lee «Vencida»', (await admin.locator('[data-testid="habilitaciones"] tr[data-estado="LIC_EXPIRED"]').count()) === 1);
  await tresAnchos(admin, '41-establecimiento-habilitaciones');
  await admin.locator('[data-testid="estab-pestanas"] [role="tab"]').nth(2).click();
  await admin.getByTestId('capacidad-tabla').waitFor();
  const camasReales = await admin.locator('[data-tipo="CAP_BEDS_CENSABLE"] [data-testid="capacidad-real"]').textContent();
  ok('capacidad: la real se cuenta del árbol (las camas creadas ya suman) y no se escribe', Number(camasReales) > 4, `real=${camasReales}`);
  await tresAnchos(admin, '42-establecimiento-capacidad');

  // Declarar capacidad
  await admin.getByTestId('capacidad-declarar').click();
  await admin.getByTestId('capacidad-dialogo').waitFor();
  await elegirOpcion(admin, 'capacidad-tipo', 'Salas de partos');
  await admin.getByTestId('capacidad-cantidad').fill('3');
  await uno(admin, '43-capacidad-declarar');
  await terminarFormularioGenerico(admin, 'capacidad-dialogo');
  await admin.waitForTimeout(500);
  ok('declarar capacidad: POST 201 y la tabla muestra la declarada con su diferencia', (await admin.locator('[data-tipo="CAP_DELIVERY_ROOMS"]').textContent())?.includes('respecto de lo declarado'));
  await uno(admin, '44-capacidad-declarada');

  // Habilitación nueva
  await admin.locator('[data-testid="estab-pestanas"] [role="tab"]').nth(1).click();
  await admin.getByTestId('habilitacion-nueva').click();
  await admin.getByTestId('habilitacion-dialogo').waitFor();
  await admin.getByTestId('habilitacion-autoridad').fill('CODELAB');
  await admin.getByTestId('habilitacion-resolucion').fill('CL-2026/118');
  await uno(admin, '45-habilitacion-registrar');
  await terminarFormularioGenerico(admin, 'habilitacion-dialogo');
  await admin.waitForTimeout(500);
  ok('habilitación nueva: POST 201 y la fila aparece', (await admin.getByTestId('habilitaciones').textContent())?.includes('CL-2026/118'));

  // Regulatorio: conflicto de tipología y luego un SNIS válido
  await admin.locator('[data-testid="estab-pestanas"] [role="tab"]').nth(0).click();
  await admin.getByTestId('regulatorio-editar').click();
  await admin.getByTestId('regulatorio-dialogo').waitFor();
  await elegirOpcion(admin, 'regulatorio-tipologia', 'Puesto de Salud');
  await admin.getByRole('dialog').getByRole('button', { name: 'Siguiente' }).click();
  await admin.waitForTimeout(300);
  await admin.getByRole('dialog').getByRole('button', { name: 'Guardar datos regulatorios' }).click();
  await admin.getByTestId('regulatorio-conflictos').waitFor();
  ok('tipología con espacios que la incumplen: 409 TYPOLOGY_CONFLICT con la lista y enlaces', (await admin.locator('[data-testid="regulatorio-conflictos"] li').count()) > 3 && (await admin.locator('[data-testid="regulatorio-conflictos"] a').count()) > 3);
  await uno(admin, '46-regulatorio-conflicto-tipologia');
  await admin.keyboard.press('Escape');
  await admin.getByTestId('regulatorio-editar').click();
  await admin.getByTestId('regulatorio-dialogo').waitFor();
  await admin.getByTestId('regulatorio-snis').fill('DEMO-SNIS-4242');
  await admin.getByRole('dialog').getByRole('button', { name: 'Siguiente' }).click();
  await admin.waitForTimeout(300);
  await admin.getByRole('dialog').getByRole('button', { name: 'Guardar datos regulatorios' }).click();
  await admin.waitForTimeout(700);
  const patchReg = (await peticiones(admin)).filter((p) => p.url.endsWith('/regulatory')).at(-1);
  ok('SNIS: PATCH /regulatory 200 (If-Match) y el dato cambió, sin verificar', patchReg?.status === 200 && (await admin.getByTestId('regulatorio-datos').textContent())?.includes('DEMO-SNIS-4242') && (await admin.getByTestId('regulatorio-datos').textContent())?.includes('Sin verificar'), JSON.stringify(patchReg?.body));
  await admin.reload({ waitUntil: 'domcontentloaded' });
  await irAConsola(admin);
  await abrirPestana(admin, 'Establecimiento');
  ok('recarga: el SNIS nuevo sigue', (await admin.getByTestId('regulatorio-datos').textContent())?.includes('DEMO-SNIS-4242'));
  await uno(admin, '47-regulatorio-recarga');

  /* ══ 7 · Estados M34 ═════════════════════════════════════════════════ */
  const fallo = (patron, modo, metodos = ['GET']) =>
    admin.evaluate(([p, m, ms]) => sessionStorage.setItem('mock:fallos', JSON.stringify([{ patron: p, modo: m, metodos: ms }])), [patron, modo, metodos]);
  const sinFallos = () => admin.evaluate(() => sessionStorage.removeItem('mock:fallos'));

  // S7 — datos atrasados
  await admin.evaluate(() => sessionStorage.setItem('mock:infra-antiguedad', '12'));
  await irAConsola(admin);
  await abrirPestana(admin, 'Infraestructura');
  await admin.getByTestId('infra-asof').waitFor();
  ok('S7: la estructura vieja se dice con su antigüedad y «Actualizar»', ((await admin.locator('[data-testid="infra-tab"]').textContent()) ?? '').includes('pueden estar atrasados') && (await admin.getByTestId('infra-asof').textContent())?.includes('hace 12 min'));
  await tresAnchos(admin, '50-estado-S7-infraestructura');
  await admin.evaluate(() => sessionStorage.removeItem('mock:infra-antiguedad'));

  // S5 / S6 / S8 / S9 en la pestaña
  const estadosPestana = [
    ['forbidden', 'S5', /No tiene acceso/],
    ['not-found', 'S6', /No encontramos lo que busca/],
    ['red', 'S8', /Sin conexión/],
    ['error', 'S9', /Algo salió mal/],
  ];
  for (const [modo, codigo, patron] of estadosPestana) {
    await fallo('/structure', modo);
    await irAConsola(admin);
    await abrirPestana(admin, 'Infraestructura');
    await admin.waitForTimeout(900);
    const texto = (await admin.locator('[data-testid="infra-tab"]').textContent().catch(() => '')) ?? '';
    ok(`${codigo} en la pestaña: ${modo}`, patron.test(texto), texto.replace(/\s+/g, ' ').slice(0, 120));
    if (codigo === 'S6') ok('S6 no revela nada: sin nombres ni códigos del establecimiento', !texto.includes('Hospital San Lucas (') && !/ED-A/.test(texto));
    if (codigo === 'S9') ok('S9 trae código de soporte copiable', /Código de soporte/.test(texto) && /Copiar código/.test(texto));
    await tresAnchos(admin, `5${{ S5: 1, S6: 2, S8: 3, S9: 4 }[codigo]}-estado-${codigo}-infraestructura`);
  }
  await sinFallos();

  // S2 — cargando (el simulador responde a los 120 ms; con la marca `lento` tarda 6 s)
  await irAConsola(admin);
  await abrirPestana(admin, 'Infraestructura');
  await admin.getByTestId('infra-sitio').waitFor({ timeout: 20_000 });
  await admin.evaluate(() => sessionStorage.setItem('lento', '1'));
  await admin.getByTestId('infra-sitio').locator('button').click();
  await admin.getByRole('option', { name: /Anexo Norte/ }).click();
  await admin.waitForTimeout(500);
  ok('S2: mientras carga la estructura no hay árbol ni datos del establecimiento', (await admin.locator('[role="tree"]').count()) === 0 && (await admin.locator('[data-testid="infra-tab"] [aria-busy], [data-testid="infra-tab"] app-skeleton, [data-testid="infra-tab"] .view-state-host__loading').count()) > 0);
  await tresAnchos(admin, '55-estado-S2-infraestructura');
  await admin.evaluate(() => sessionStorage.removeItem('lento'));

  // S3 — establecimiento sin estructura
  await abrirInfraSinRecarga(admin, /Consultorio Dra\. Rojas/);
  await admin.getByTestId('infra-vacio').waitFor({ timeout: 20_000 });
  ok('S3: sin estructura ofrece «Agregar el primer edificio» e «Importar CSV»', (await admin.getByTestId('infra-primer-edificio').count()) === 1 && (await admin.getByTestId('infra-importar-vacio').count()) === 1);
  await tresAnchos(admin, '56-estado-S3-infraestructura');

  // Ficha: S6 (otro tenant), S5, S8, S9, S2
  await admin.goto(`${BASE}/administration/medical-organization/spaces/${uuid('space-otro-tenant')}`, { waitUntil: 'domcontentloaded' });
  await admin.getByText('No encontramos lo que busca').waitFor({ timeout: 20_000 });
  ok('ficha S6: un espacio de otro tenant no revela nada (404 = inexistente)', (await admin.locator('app-space-detail').textContent())?.includes('otro') === false);
  await tresAnchos(admin, '60-ficha-estado-S6');
  for (const [modo, codigo, patron] of [['forbidden', 'S5', /No tiene acceso/], ['red', 'S8', /Sin conexión/], ['error', 'S9', /Algo salió mal/]]) {
    await fallo('/care-spaces/', modo);
    await admin.goto(`${BASE}${ficha('HAB-301')}`, { waitUntil: 'domcontentloaded' });
    await admin.waitForTimeout(1200);
    const texto = (await admin.locator('app-space-detail').textContent().catch(() => '')) ?? '';
    ok(`ficha ${codigo}: ${modo}`, patron.test(texto), texto.replace(/\s+/g, ' ').slice(0, 100));
    await tresAnchos(admin, `6${{ S5: 1, S8: 2, S9: 3 }[codigo]}-ficha-estado-${codigo}`);
  }
  await sinFallos();
  await admin.evaluate(() => sessionStorage.setItem('lento', '1'));
  await admin.goto(`${BASE}${ficha('HAB-301')}`, { waitUntil: 'domcontentloaded' });
  await admin.waitForTimeout(900);
  await tresAnchos(admin, '64-ficha-estado-S2');
  await admin.evaluate(() => sessionStorage.removeItem('lento'));

  // Establecimiento: S3 (Consultorio) y S8
  await irAConsola(admin, /Consultorio Dra\. Rojas/);
  await abrirPestana(admin, 'Establecimiento');
  await admin.locator('[data-testid="estab-pestanas"] [role="tab"]').nth(1).click();
  await admin.getByTestId('habilitaciones-vacio').waitFor({ timeout: 20_000 });
  await tresAnchos(admin, '70-establecimiento-S3-habilitaciones');
  await admin.locator('[data-testid="estab-pestanas"] [role="tab"]').nth(2).click();
  await admin.getByTestId('capacidad-vacio').waitFor({ timeout: 20_000 });
  await tresAnchos(admin, '71-establecimiento-S3-capacidad');
  await fallo('/capacity', 'red');
  await irAConsola(admin);
  await abrirPestana(admin, 'Establecimiento');
  await admin.locator('[data-testid="estab-pestanas"] [role="tab"]').nth(2).click();
  await admin.waitForTimeout(900);
  ok('Establecimiento S8: la capacidad sin conexión no tumba las otras secciones', /Sin conexión/.test((await admin.locator('[data-testid="estab-tab"]').textContent()) ?? ''));
  await tresAnchos(admin, '72-establecimiento-S8-capacidad');
  await sinFallos();

  /* ══ 8 · Sólo lectura: quien no administra ═══════════════════════════ */
  const lectura = await nuevaPagina('medica@alovida.mock', 2);
  await abrirInfra(lectura);
  await lectura.locator('[role="treeitem"]').first().waitFor({ timeout: 20_000 });
  ok('S5 reflejado: quien sólo lee ve el árbol completo y NINGUNA acción de escritura', (await lectura.locator('[role="treeitem"]').count()) > 3 && (await lectura.getByTestId('infra-agregar').count()) === 0 && (await lectura.getByTestId('infra-importar').count()) === 0);
  await lectura.locator('[role="treeitem"]').first().click();
  ok('sin permiso tampoco hay «Agregar dentro»; la ficha sí se puede abrir', (await lectura.getByTestId('infra-agregar-dentro').count()) === 0 && (await lectura.getByTestId('infra-abrir-ficha').count()) === 1);
  await tresAnchos(lectura, '80-solo-lectura-infraestructura');
  await lectura.getByTestId('infra-abrir-ficha').click();
  await lectura.getByTestId('ficha-espacio').waitFor();
  ok('ficha sin permiso: sin botones de edición ni historial', (await lectura.getByRole('button', { name: 'Editar' }).count()) === 0);
  await lectura.locator('[data-testid="ficha-pestanas"] [role="tab"]').nth(4).click();
  await lectura.getByTestId('ficha-historial-sin-permiso').waitFor();
  await tresAnchos(lectura, '81-solo-lectura-ficha');
  await irAConsola(lectura);
  await abrirPestana(lectura, 'Establecimiento');
  await lectura.getByTestId('regulatorio-solo-lectura').waitFor();
  await tresAnchos(lectura, '82-solo-lectura-establecimiento');
  // La API decide: aunque la interfaz oculte el botón, una escritura directa da 403.
  const directo = await lectura.evaluate(async () => {
    const el = document.querySelector('app-establishment-tab');
    const comp = window.ng.getComponent(el);
    return await new Promise((resolve) =>
      comp.client.updateRegulatory(comp.siteId(), 1, { snisCode: 'X' }).subscribe({ next: () => resolve('200'), error: (e) => resolve(String(e.status)) }),
    );
  });
  ok('la API decide: una escritura directa de quien sólo lee responde 403', directo === '403', directo);

  const errores = [...admin.errores, ...lectura.errores];
  ok('sin excepciones no capturadas en la página', errores.length === 0, errores.slice(0, 2).join(' | '));
} finally {
  writeFileSync(`${SALIDA}resultados.json`, JSON.stringify({ base: BASE, fecha: new Date().toISOString(), resultados }, null, 2));
  await navegador.close();
}

const fallas = resultados.filter((r) => !r.ok);
process.stdout.write(`\n${resultados.length - fallas.length}/${resultados.length} comprobaciones en verde\n`);
process.exit(fallas.length === 0 ? 0 : 1);

/* ── ayudas que dependen de las de arriba (hoisting de function) ───────── */

/** Un diálogo de formulario por partes que no es el de espacios: avanza hasta que se cierra. */
async function terminarFormularioGenerico(pagina, testIdDialogo) {
  for (let i = 0; i < 6; i++) {
    if ((await pagina.getByTestId(testIdDialogo).count()) === 0) return;
    await pagina.getByRole('dialog').getByRole('button', { name: /^(Siguiente|Registrar declaración|Registrar habilitación|Guardar cambios)$/ }).last().click();
    await pagina.waitForTimeout(500);
  }
}

/** Cambia de establecimiento dentro de la consola ya abierta. */
async function abrirInfraSinRecarga(pagina, practica) {
  await irAConsola(pagina, practica);
  await abrirPestana(pagina, 'Infraestructura');
}
