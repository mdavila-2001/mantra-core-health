/**
 * H3 + H4 — el editor del médico DESPUÉS de mover las altas a modales, montar el
 * historial en Trayectoria y darle a cada barra su propia clave de búsqueda.
 * Uso (desde la raíz del repo): yarn node docs/trabajo/<carpeta>/evidencia/h4/capturas-h3h4.mjs <urlBase>
 * Sólo la cuenta sintética `medica@alovida.mock`. Escribe en `evidencia/h3/` y `evidencia/h4/`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.argv[2];
if (!BASE) throw new Error('Falta la URL de la app como primer argumento.');
const DIR4 = new URL('./', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const DIR3 = new URL('../h3/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const CAPS3 = `${DIR3}capturas`;
const CAPS4 = `${DIR4}capturas`;
mkdirSync(CAPS3, { recursive: true });
mkdirSync(CAPS4, { recursive: true });

const SELLO = String(Date.now()).slice(-5);
const lineas = [];
const log = (t) => {
  lineas.push(t);
  process.stdout.write(t + '\n');
};
const consola = [];
const red = [];
const plano = (t) => (t ?? '').replace(/\s+/g, ' ').trim();

/**
 * Un PDF válido de una página con un texto propio: sirve para reconocer cuál se
 * bajó, y el visor lo puede dibujar en la vista previa del selector.
 */
function pdf(nombre, marca) {
  const texto = `BT /F1 14 Tf 20 70 Td (${marca}) Tj ET`;
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 320 144] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${texto.length} >>\nstream\n${texto}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let cuerpo = '%PDF-1.4\n';
  const desplazamientos = objetos.map((objeto, i) => {
    const desde = cuerpo.length;
    cuerpo += `${i + 1} 0 obj\n${objeto}\nendobj\n`;
    return desde;
  });
  const xref = cuerpo.length;
  cuerpo += `xref\n0 ${objetos.length + 1}\n0000000000 65535 f \n`;
  cuerpo += desplazamientos.map((d) => `${String(d).padStart(10, '0')} 00000 n \n`).join('');
  cuerpo += `trailer\n<< /Size ${objetos.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return { name: nombre, mimeType: 'application/pdf', buffer: Buffer.from(cuerpo, 'latin1') };
}

async function entrar(navegador, { ancho, alto, tema }) {
  const ctx = await navegador.newContext({ viewport: { width: ancho, height: alto }, colorScheme: tema, acceptDownloads: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => consola.push(`[pageerror] ${p.url()} — ${String(e).split('\n')[0]}`));
  p.on('console', (m) => {
    if (m.text().includes('Content Security Policy')) return;
    if (m.type() === 'error' || m.type() === 'warning' || m.text().includes('[mock] sin manejador')) {
      consola.push(`[${m.type()}] ${p.url()} — ${m.text().slice(0, 300)}`);
    }
  });
  p.on('response', (r) => {
    if (r.status() >= 400) red.push(`${r.status()} ${r.request().method()} ${r.url()}`);
  });
  p.on('requestfailed', (r) => red.push(`FAILED ${r.method()} ${r.url()} — ${r.failure()?.errorText}`));
  await p.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await p.getByTestId('login-identifier').fill('medica@alovida.mock');
  await p.getByTestId('login-password').fill('mockup');
  await p.getByTestId('login-submit').click();
  await p.waitForURL(/\/(dashboard|auth\/organization|my-account|home|directory)/, { timeout: 90_000 }).catch(() => {});
  if (p.url().includes('/auth/organization')) {
    await p.getByTestId('tenant-opcion').first().click();
    await p.waitForTimeout(1500);
  }
  return p;
}

const tab = (p, nombre) => p.getByRole('tab', { name: nombre }).first();
const quieto = (p) =>
  p
    .waitForFunction(
      () =>
        document
          .getAnimations()
          .every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity),
      null,
      { timeout: 5_000 },
    )
    .catch(() => {});
const asentar = async (p, ms = 900) => p.waitForTimeout(ms);
// Página completa: se estira la ventana a la altura del documento, se espera quietud y se captura.
const cap = async (p, dir, nombre) => {
  const vp = p.viewportSize();
  const alto = await p.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
  if (alto > vp.height) await p.setViewportSize({ width: vp.width, height: alto });
  await quieto(p);
  await p.screenshot({ path: `${dir}/${nombre}.png` });
  if (alto > vp.height) {
    await p.setViewportSize(vp);
    await quieto(p);
  }
};
// Con un modal abierto se captura sólo la ventana: estirarla movería el modal.
const capVista = async (p, dir, nombre) => {
  await quieto(p);
  await p.screenshot({ path: `${dir}/${nombre}.png` });
};

const panel = (p) => p.locator('[role="tabpanel"]:visible').first();
const dialogo = (p, texto) => p.locator('dialog[open]').filter({ hasText: texto }).last();
const campo = (raiz, id) => raiz.locator(`input[data-testid="${id}"], [data-testid="${id}"] input`).first();
const desplegable = (raiz, id) => raiz.locator(`select[data-testid="${id}"], [data-testid="${id}"] select`).first();
const archivo = (raiz, id) => raiz.locator(`input[type="file"][data-testid="${id}"], [data-testid="${id}"] input[type="file"]`).first();

/** Elige la enésima opción elegible (1 = la primera): ni oculta, ni apagada, ni un «Elegí…». */
async function elegir(raiz, id, n = 1) {
  const sel = desplegable(raiz, id);
  await sel.waitFor({ timeout: 20_000 });
  const elegibles = () =>
    sel.evaluate((s) =>
      [...s.options].filter((o) => !o.hidden && !o.disabled && !/^(Elegí|Seleccion)/.test(o.text.trim())).map((o) => o.value),
    );
  let valores = await elegibles();
  for (let i = 0; i < 40 && valores.length < n; i++) {
    await raiz.page().waitForTimeout(250);
    valores = await elegibles();
  }
  await sel.selectOption(valores[n - 1]);
  return plano(await sel.locator('option:checked').innerText());
}

async function abrirEditor(p, pestana) {
  await p.goto(`${BASE}/my-account/edit`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await p.locator('[data-testid="edicion-pestanas"] [role="tab"]').first().waitFor({ timeout: 60_000 });
  await asentar(p);
  await tab(p, pestana).click();
  await asentar(p, 1200);
}

/** Cada barra del panel abierto: su clave y dónde queda el botón de alta respecto del buscador. */
const barras = (p) =>
  p.evaluate(() => {
    const abierto = [...document.querySelectorAll('[role="tabpanel"]')].find((x) => !x.hasAttribute('hidden'));
    return [...(abierto ?? document).querySelectorAll('app-filter-bar')].map((host) => {
      const clave = window.ng?.getComponent(host)?.searchParam?.() ?? '(sin acceso)';
      const buscador = host.querySelector('input')?.getBoundingClientRect();
      const boton = host.querySelector('[filter-bar-action]');
      const b = boton?.getBoundingClientRect();
      let lugar = 'sin botón de alta';
      if (buscador && b) {
        if (b.top >= buscador.bottom - 1) lugar = 'debajo del buscador';
        else if (b.left >= buscador.right - 1) lugar = 'a la derecha del buscador';
        else lugar = `otro (buscador ${Math.round(buscador.left)},${Math.round(buscador.top)} · botón ${Math.round(b.left)},${Math.round(b.top)})`;
      }
      return { clave, boton: boton ? boton.textContent.replace(/\s+/g, ' ').trim() : null, lugar };
    });
  });
const desborde = (p) =>
  p.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
const claves = (p) => [...new URL(p.url()).searchParams.entries()].map(([k, v]) => `${k}=${v}`).join('&') || '(ninguna)';

const filasTitulos = (p) => p.locator('[data-testid="tabla-formacion"] tbody tr');
// Número e institución de cada título, por el encabezado de la columna y no por su posición.
const institucionesDeTitulos = (p) =>
  p.evaluate(() => {
    const tabla = document.querySelector('[data-testid="tabla-formacion"]');
    if (!tabla) return [];
    const encabezados = [...tabla.querySelectorAll('thead th')].map((th) => th.textContent.trim().toLowerCase());
    const iNumero = encabezados.findIndex((t) => t.startsWith('número'));
    const iInstitucion = encabezados.indexOf('institución');
    return [...tabla.querySelectorAll('tbody tr')].map((tr) => ({
      numero: tr.children[iNumero]?.textContent.trim() ?? '',
      institucion: iInstitucion < 0 ? 'sin columna «Institución»' : (tr.children[iInstitucion]?.textContent.trim() ?? ''),
    }));
  });
const filasHistorial = (p) => p.locator('app-work-history app-data-table tbody tr');

async function buscarEn(p, indiceDeBarra, termino) {
  const barra = panel(p).locator('app-filter-bar').nth(indiceDeBarra);
  await barra.locator('input').first().fill(termino);
  await asentar(p, 1200);
}

async function idDeFila(p, tabla, texto, prefijo) {
  const fila = p.locator(`[data-testid="${tabla}"] tbody tr`, { hasText: texto }).first();
  await fila.waitFor({ timeout: 20_000 });
  const testid = await fila.locator(`[data-testid^="${prefijo}"]`).first().getAttribute('data-testid');
  return testid.slice(prefijo.length);
}

/**
 * La acción `code` de una fila de las tablas del editor. Van por `app-row-actions`: con dos o
 * menos están en la fila; con tres o más, detrás del disparador «Acciones», en un desplegable
 * que se muda al `<body>` mientras está abierto.
 */
async function accion(p, recurso, id, code) {
  const grupo = p.getByTestId(`${recurso}-acciones-${id}`);
  const disparador = grupo.getByTestId('row-actions-trigger');
  if ((await disparador.count()) > 0) {
    await disparador.click();
    const item = p.locator(`app-menu-item[data-action="${code}"] >> visible=true`).first();
    await item.waitFor({ timeout: 10_000 });
    return item;
  }
  return grupo.locator(`[data-action="${code}"]`);
}

/** Cuántas veces ofrece la fila esa acción. Con desplegable, sus opciones sólo existen abierto: se abre, se cuenta y se cierra. */
async function cuantas(p, recurso, id, code) {
  const grupo = p.getByTestId(`${recurso}-acciones-${id}`);
  const disparador = grupo.getByTestId('row-actions-trigger');
  if ((await disparador.count()) === 0) return grupo.locator(`[data-action="${code}"]`).count();
  await disparador.click();
  await p.locator('app-menu-item >> visible=true').first().waitFor({ timeout: 10_000 });
  const n = await p.locator(`app-menu-item[data-action="${code}"] >> visible=true`).count();
  await p.keyboard.press('Escape');
  return n;
}

async function bajar(p, abrir) {
  const objetivo = await abrir();
  const [d] = await Promise.all([p.waitForEvent('download', { timeout: 20_000 }), objetivo.click()]);
  const bytes = readFileSync(await d.path());
  return { nombre: d.suggestedFilename(), texto: bytes.toString('latin1') };
}

/** Si el submit del modal está apagado (el botón usa `aria-disabled`, no `disabled`). */
const apagado = (boton) =>
  boton.evaluate((b) => b.getAttribute('aria-disabled') === 'true' || b.hasAttribute('disabled'));

/** Un paso que falla se anota y no arrastra al siguiente: se recarga el editor, que cierra cualquier modal. */
async function paso(nombre, fn, p = null, pestana = null) {
  try {
    await fn();
  } catch (e) {
    log(`FALLÓ el paso «${nombre}»: ${String(e?.message ?? e).split('\n')[0]}`);
    if (p) await p.screenshot({ path: `${CAPS4}/FALLO-${nombre.replace(/[^a-záéíóúñ0-9]+/gi, '-')}.png` }).catch(() => {});
    if (p && pestana) await abrirEditor(p, pestana).catch(() => {});
  }
}

async function trayectoria(navegador) {
  const p = await entrar(navegador, { ancho: 1440, alto: 1000, tema: 'light' });
  await abrirEditor(p, 'Trayectoria');

  await paso('Trayectoria · montaje', async () => {
    await p.locator('app-work-history').first().waitFor({ timeout: 30_000 });
    await asentar(p, 1500);
    const orden = await p.evaluate(() => {
      const abierto = [...document.querySelectorAll('[role="tabpanel"]')].find((x) => !x.hasAttribute('hidden'));
      const titulos = abierto?.querySelector('[data-testid="edicion-formacion-cargada"]');
      const historial = abierto?.querySelector('app-work-history');
      if (!titulos || !historial) return 'falta una de las dos secciones';
      return titulos.compareDocumentPosition(historial) & Node.DOCUMENT_POSITION_FOLLOWING ? 'historial después de los títulos' : 'historial ANTES de los títulos';
    });
    const altaHistorial = p.getByTestId('abrir-alta-vinculo');
    const dentroDeBarra = await altaHistorial.evaluate((b) => b.closest('app-filter-bar') !== null).catch(() => null);
    log(`H3.S3.M1 · Trayectoria 1440 claro: historial montado=${await p.locator('app-work-history').count()} · ${orden} · filas títulos=${await filasTitulos(p).count()} · filas historial=${await filasHistorial(p).count()}`);
    log(`H3.S3.M1 · barras: ${JSON.stringify(await barras(p))}`);
    log(`hallazgo · «${plano(await altaHistorial.innerText())}» del historial dentro de su barra=${dentroDeBarra}`);
    log(`desborde lateral 1440: ${JSON.stringify(await desborde(p))}`);
    log(`H3.S1.M3 · columna «Institución» de los títulos: ${(await institucionesDeTitulos(p)).map((f) => `${f.numero} → «${f.institucion}»`).join(' · ')}`);
    await cap(p, CAPS3, 'h3-trayectoria-escritorio-claro');
  }, p, 'Trayectoria');

  await paso('Trayectoria · búsquedas separadas', async () => {
    const t0 = await filasTitulos(p).count();
    const h0 = await filasHistorial(p).count();
    await buscarEn(p, 0, 'zzz');
    log(`H3.S4.M3 · buscar «zzz» en la barra de títulos → URL ${claves(p)} · títulos ${t0}→${await filasTitulos(p).count()} · historial ${h0}→${await filasHistorial(p).count()}`);
    await cap(p, CAPS3, 'h3-busqueda-titulos');
    await buscarEn(p, 0, '');
    await buscarEn(p, 1, 'zzz');
    log(`H3.S4.M3 · buscar «zzz» en la barra del historial → URL ${claves(p)} · títulos=${await filasTitulos(p).count()} · historial=${await filasHistorial(p).count()} · «sin resultados»=${await p.getByTestId('historial-tabla-sin-resultados').count()}`);
    await cap(p, CAPS3, 'h3-busqueda-historial');
    await tab(p, 'Credenciales').click();
    await asentar(p, 800);
    log(`H3.S4.M3 · al pasar a Credenciales → URL ${claves(p)}`);
    await tab(p, 'Trayectoria').click();
    await asentar(p, 1200);
  }, p, 'Trayectoria');

  const NUM = `TIT-B-${SELLO}`;
  let idTitulo = null;
  await paso('alta de título', async () => {
    await p.getByTestId('credencial-agregar').click();
    const modal = p.getByTestId('alta-titulo-dialogo');
    await modal.locator('dialog[open]').waitFor({ timeout: 10_000 });
    log(`H3.S1.M1 · formulario en línea en la pestaña=${await panel(p).locator('[data-testid="credencial-numero"]').count()} · modal abierto=${await modal.count()}`);
    await capVista(p, CAPS3, 'h3-alta-titulo-modal');
    await p.keyboard.press('Escape');
    await asentar(p, 600);
    log(`H3.S1.M1 · Escape sin nada escrito → modal=${await modal.count()} · pregunta de descarte=${await dialogo(p, '¿Descartás').count()}`);

    await p.getByTestId('credencial-agregar').click();
    await modal.locator('dialog[open]').first().waitFor({ timeout: 10_000 });
    await campo(modal, 'credencial-numero').fill(NUM);
    await p.keyboard.press('Escape');
    await asentar(p, 600);
    const descarte = dialogo(p, '¿Descartás');
    log(`H3.S1.M1 · Escape con algo escrito → pregunta de descarte=${await descarte.count()}`);
    await capVista(p, CAPS3, 'h3-alta-titulo-descarte');
    await descarte.getByRole('button', { name: 'Seguir editando' }).click();
    await asentar(p, 500);
    log(`H3.S1.M1 · «Seguir editando» → modal=${await modal.count()} · número conservado=«${await campo(modal, 'credencial-numero').inputValue()}»`);

    const tipo = await elegir(modal, 'credencial-tipo');
    const inst = await elegir(modal, 'credencial-institucion');
    await archivo(modal, 'credencial-archivo').setInputFiles(pdf(`diploma-${SELLO}.pdf`, `DIPLOMA-ORIGINAL-${SELLO}`));
    await asentar(p, 500);
    log(`H3.S1 · alta: tipo=«${tipo}» · institución=«${inst}» · número=${NUM} · archivo=diploma-${SELLO}.pdf`);
    await modal.getByRole('button', { name: 'Agregar título', exact: true }).click();
    await asentar(p, 600);
    const confirma = dialogo(p, '¿Confirmás estos datos?');
    log(`H3.S1.M4 · al agregar → «¿Confirmás estos datos?»=${await confirma.count()}`);
    await capVista(p, CAPS3, 'h3-alta-titulo-confirmacion');
    await confirma.getByRole('button', { name: 'Confirmar' }).click();
    await modal.waitFor({ state: 'detached', timeout: 20_000 });
    await asentar(p, 1200);
    idTitulo = await idDeFila(p, 'tabla-formacion', NUM, 'formacion-acciones-');
    log(`H3.S1 · guardado: modal cerrado · fila ${NUM} en la tabla (id ${idTitulo})`);
    const recien = await bajar(p, () => accion(p, 'formacion', idTitulo, 'descargar'));
    log(`H3.S1.M2 · descarga antes de recargar: ${recien.nombre} · trae el contenido subido («DIPLOMA-ORIGINAL-${SELLO}»)=${recien.texto.includes(`DIPLOMA-ORIGINAL-${SELLO}`)}`);

    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.locator('[data-testid="edicion-pestanas"] [role="tab"]').first().waitFor({ timeout: 60_000 });
    await tab(p, 'Trayectoria').click();
    await asentar(p, 1500);
    const tras = p.locator('[data-testid="tabla-formacion"] tbody tr', { hasText: NUM });
    log(`H3.S1.M2 · tras recargar: fila ${NUM}=${await tras.count()} · «Descargar»=${await cuantas(p, 'formacion', idTitulo, 'descargar')}`);
    log(`H3.S1.M3 · el título recién agregado, elegido del desplegable como «${inst}», se lee en la tabla como «${(await institucionesDeTitulos(p)).find((f) => f.numero === NUM)?.institucion ?? 'no está'}»`);
    const bajado = await bajar(p, () => accion(p, 'formacion', idTitulo, 'descargar'));
    log(`H3.S1.M2 · descarga tras recargar: ${bajado.nombre} · es el archivo subido (nombre «diploma-${SELLO}.pdf» adentro)=${bajado.texto.includes(`diploma-${SELLO}.pdf`)} · ${bajado.texto.length} bytes, empieza «${plano(bajado.texto.slice(0, 60))}»`);
    await cap(p, CAPS3, 'h3-alta-titulo-tras-recargar');
  }, p, 'Trayectoria');

  await paso('corrección de título', async () => {
    if (!idTitulo) throw new Error('sin título nuevo');
    const modal = p.getByTestId('edicion-dialogo');
    const guardar = () => modal.getByRole('button', { name: 'Guardar cambios' });
    await (await accion(p, 'formacion', idTitulo, 'editar')).click();
    await modal.locator('dialog[open]').first().waitFor({ timeout: 10_000 });
    await asentar(p, 600);
    const numero = await campo(modal, 'edicion-credencial-numero').inputValue();
    const selector = plano(await modal.locator('app-form-field', { has: p.locator('app-file-input') }).first().innerText());
    log(`H3.S2 · abrir «Editar»: número lleno=«${numero}» · selector de archivo=«${selector.slice(0, 120)}» · «Guardar cambios» apagado=${await apagado(guardar())}`);
    await capVista(p, CAPS3, 'h3-corregir-titulo-sin-cambios');
    await p.keyboard.press('Escape');
    await asentar(p, 600);
    log(`H3.S2.M5 · Escape sin cambios → modal=${await modal.count()} · pregunta de descarte=${await dialogo(p, '¿Descartás').count()}`);

    await (await accion(p, 'formacion', idTitulo, 'editar')).click();
    await modal.locator('dialog[open]').first().waitFor({ timeout: 10_000 });
    await campo(modal, 'edicion-credencial-numero').fill(`${NUM}-C`);
    await asentar(p, 300);
    log(`H3.S2.M3 · con un cambio → «Guardar cambios» apagado=${await apagado(guardar())}`);
    await guardar().click();
    await asentar(p, 600);
    const confirma = dialogo(p, '¿Confirmás estos cambios?');
    log(`H3.S2.M4 · al guardar → «¿Confirmás estos cambios?»=${await confirma.count()}`);
    await capVista(p, CAPS3, 'h3-corregir-titulo-confirmacion');
    await confirma.getByRole('button', { name: 'Seguir editando' }).click();
    await asentar(p, 600);
    const foco = await p.evaluate(() => document.activeElement?.textContent?.replace(/\s+/g, ' ').trim() ?? '(nada)');
    log(`H3.S2.M4 · «Seguir editando» → modal=${await modal.count()} · foco en «${foco}»`);
    await p.keyboard.press('Escape');
    await asentar(p, 600);
    const descarte = dialogo(p, '¿Descartás');
    log(`H3.S2.M5 · Escape con cambios → pregunta de descarte=${await descarte.count()}`);
    await capVista(p, CAPS3, 'h3-corregir-titulo-descarte');
    await descarte.getByRole('button', { name: 'Descartar' }).click();
    await asentar(p, 800);
    log(`H3.S2.M5 · «Descartar» → modal=${await modal.count()} · la fila sigue con ${NUM}=${await p.locator('[data-testid="tabla-formacion"] tbody tr', { hasText: NUM }).count()}`);

    await (await accion(p, 'formacion', idTitulo, 'editar')).click();
    await modal.locator('dialog[open]').first().waitFor({ timeout: 10_000 });
    await campo(modal, 'edicion-credencial-numero').fill(`${NUM}-C`);
    await archivo(modal, 'edicion-credencial-archivo').setInputFiles(pdf(`diploma-nuevo-${SELLO}.pdf`, `DIPLOMA-NUEVO-${SELLO}`));
    await asentar(p, 400);
    await guardar().click();
    await asentar(p, 600);
    await dialogo(p, '¿Confirmás estos cambios?').getByRole('button', { name: 'Confirmar' }).click();
    await modal.waitFor({ state: 'detached', timeout: 20_000 });
    await asentar(p, 1200);
    const recien = await bajar(p, () => accion(p, 'formacion', idTitulo, 'descargar'));
    log(`H3.S2.M2 · descarga antes de recargar: trae el nuevo=${recien.texto.includes(`DIPLOMA-NUEVO-${SELLO}`)} · trae el original=${recien.texto.includes(`DIPLOMA-ORIGINAL-${SELLO}`)}`);
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.locator('[data-testid="edicion-pestanas"] [role="tab"]').first().waitFor({ timeout: 60_000 });
    await tab(p, 'Trayectoria').click();
    await asentar(p, 1500);
    log(`H3.S2.M2 · corregido y recargado: fila ${NUM}-C=${await p.locator('[data-testid="tabla-formacion"] tbody tr', { hasText: `${NUM}-C` }).count()}`);
    const bajado = await bajar(p, () => accion(p, 'formacion', idTitulo, 'descargar'));
    log(`H3.S2.M2 · descarga tras recargar: ${bajado.nombre} · es el nuevo=${bajado.texto.includes(`diploma-nuevo-${SELLO}.pdf`)} · es el original=${bajado.texto.includes(`diploma-${SELLO}.pdf`)} · ${bajado.texto.length} bytes, empieza «${plano(bajado.texto.slice(0, 60))}»`);
  }, p, 'Trayectoria');

  await paso('historial en tabla', async () => {
    const primera = filasHistorial(p).first();
    await primera.waitFor({ timeout: 20_000 });
    const org = plano(await primera.locator('td').first().innerText());
    await primera.locator('[data-action="editar"]').click();
    const modal = p.locator('dialog[open]').filter({ hasText: 'Corregir el vínculo' }).first();
    await modal.waitFor({ timeout: 10_000 });
    const guardar = p.getByTestId('afiliacion-guardar');
    log(`H3.S4.M4 · «Editar» en «${org}» → «Corregir el vínculo» · «Guardar los cambios» apagado=${await apagado(guardar)}`);
    await capVista(p, CAPS3, 'h3-historial-corregir');
    const columnas = (await p.locator('app-work-history app-data-table th').allInnerTexts()).map(plano).filter(Boolean);
    log(`H3.S4.M5 · columnas del historial: ${columnas.join(' · ')} · «Adjunto»=${columnas.some((c) => c.toLowerCase() === 'adjunto')} · selector de archivo en la corrección=${await modal.locator('app-file-input').count()}`);
    const CARGO = `Cargo B ${SELLO}`;
    await modal.locator('app-input input').first().fill(CARGO);
    await asentar(p, 300);
    await guardar.click();
    await asentar(p, 600);
    const confirma = dialogo(p, '¿Confirmás estos cambios?');
    log(`H3.S4.M4 · al guardar → «¿Confirmás estos cambios?»=${await confirma.count()}`);
    await confirma.getByRole('button', { name: 'Guardar' }).click();
    await modal.waitFor({ state: 'detached', timeout: 20_000 });
    await asentar(p, 1000);
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.locator('[data-testid="edicion-pestanas"] [role="tab"]').first().waitFor({ timeout: 60_000 });
    await tab(p, 'Trayectoria').click();
    await asentar(p, 1500);
    log(`H3.S4.M4 · cargo «${CARGO}» tras recargar=${await filasHistorial(p).filter({ hasText: CARGO }).count()}`);
    await cap(p, CAPS3, 'h3-historial-tras-recargar-cargo');

    const n0 = await filasHistorial(p).count();
    const ultima = filasHistorial(p).last();
    const orgUltima = plano(await ultima.locator('td').first().innerText());
    await ultima.locator('[data-action="retirar"]').click();
    await asentar(p, 600);
    const retiro = dialogo(p, 'Retirar del historial');
    log(`H3.S4.M4 · «Retirar» en «${orgUltima}» → confirmación=${await retiro.count()}`);
    await capVista(p, CAPS3, 'h3-historial-retirar-confirmacion');
    await retiro.getByRole('button', { name: 'Retirar', exact: true }).click();
    await asentar(p, 1500);
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.locator('[data-testid="edicion-pestanas"] [role="tab"]').first().waitFor({ timeout: 60_000 });
    await tab(p, 'Trayectoria').click();
    await asentar(p, 1500);
    log(`H3.S4.M4 · tras retirar y recargar: filas ${n0}→${await filasHistorial(p).count()} · «${orgUltima}» sigue=${await filasHistorial(p).filter({ hasText: orgUltima }).count()}`);
  }, p, 'Trayectoria');
  await p.context().close();

  const m = await entrar(navegador, { ancho: 375, alto: 812, tema: 'dark' });
  await abrirEditor(m, 'Trayectoria');
  await paso('Trayectoria móvil', async () => {
    await m.locator('app-work-history').first().waitFor({ timeout: 30_000 });
    await asentar(m, 1500);
    log(`H3.S3.M4 · Trayectoria 375 oscuro: barras ${JSON.stringify(await barras(m))} · desborde ${JSON.stringify(await desborde(m))}`);
    await cap(m, CAPS3, 'h3-trayectoria-movil-oscuro');
  }, m, 'Trayectoria');
  await m.context().close();
}

async function credenciales(navegador) {
  const p = await entrar(navegador, { ancho: 1440, alto: 1000, tema: 'light' });
  await abrirEditor(p, 'Credenciales');

  await paso('Credenciales · barras', async () => {
    await asentar(p, 1200);
    log(`H4 · Credenciales 1440 claro: formulario en línea de especialidad=${await panel(p).locator('[data-testid="especialidad-select"]').count()} · de matrícula=${await panel(p).locator('[data-testid="matricula-numero"]').count()}`);
    log(`H4.S3.M2 · barras: ${JSON.stringify(await barras(p))} · desborde ${JSON.stringify(await desborde(p))}`);
    await cap(p, CAPS4, 'h4-credenciales-escritorio-claro');
  }, p, 'Credenciales');

  await paso('alta de especialidad', async () => {
    await p.getByTestId('especialidad-agregar').click();
    const modal = p.getByTestId('alta-especialidad-dialogo');
    await modal.locator('dialog[open]').waitFor({ timeout: 10_000 });
    const conRespaldo = await modal.locator('[data-testid="especialidad-respaldo"]').count();
    const sinRespaldo = await modal.getByTestId('especialidad-sin-respaldo').count();
    log(`H4.S1.M1/M2 · modal abierto · respaldo: desplegable=${conRespaldo} · aviso sin títulos verificados=${sinRespaldo}`);
    await capVista(p, CAPS4, 'h4-alta-especialidad-modal');
    const esp1 = await elegir(modal, 'especialidad-select');
    await modal.getByTestId('agregar-casilla-especialidad').click();
    await asentar(p, 500);
    const esp2 = await elegir(modal, 'especialidad-extra-0', 2);
    const quitar = modal.getByTestId('quitar-especialidad-0');
    log(`H4.S1.M1 · casillas: «${esp1}» + «${esp2}» · botón quitar texto=«${plano(await quitar.innerText())}» · aria-label=«${await quitar.getAttribute('aria-label')}»`);
    let respaldo = '(sin elegir)';
    if (conRespaldo) respaldo = await elegir(modal, 'especialidad-respaldo');
    log(`H4.S1.M2 · respaldo elegido=«${respaldo}»`);
    await capVista(p, CAPS4, 'h4-alta-especialidad-casillas');
    await modal.getByRole('button', { name: /^Agregar especialidades?$/ }).click();
    await asentar(p, 600);
    const confirma = dialogo(p, '¿Confirmás estos datos?');
    log(`H4.S1 · al agregar → «¿Confirmás estos datos?»=${await confirma.count()} · texto=«${plano(await confirma.innerText()).slice(0, 160)}»`);
    await capVista(p, CAPS4, 'h4-alta-especialidad-confirmacion');
    await confirma.getByRole('button', { name: 'Confirmar' }).click();
    await modal.waitFor({ state: 'detached', timeout: 20_000 });
    await asentar(p, 1200);
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.locator('[data-testid="edicion-pestanas"] [role="tab"]').first().waitFor({ timeout: 60_000 });
    await tab(p, 'Credenciales').click();
    await asentar(p, 1500);
    const filas = p.locator('[data-testid="tabla-especialidades"] tbody tr');
    log(`H4.S1 · tras recargar: «${esp1}»=${await filas.filter({ hasText: esp1 }).count()} · «${esp2}»=${await filas.filter({ hasText: esp2 }).count()}`);

    const idEsp = await idDeFila(p, 'tabla-especialidades', esp1, 'especialidad-acciones-');
    await (await accion(p, 'especialidad', idEsp, 'editar')).click();
    const edicion = p.getByTestId('edicion-dialogo');
    await edicion.locator('dialog[open]').waitFor({ timeout: 10_000 });
    await asentar(p, 500);
    log(`H4.S1.M3 · «Editar» especialidad: «Guardar cambios» apagado=${await apagado(edicion.getByRole('button', { name: 'Guardar cambios' }))}`);
    await capVista(p, CAPS4, 'h4-corregir-especialidad');
    await p.keyboard.press('Escape');
    await asentar(p, 600);
    log(`H4.S1.M3 · Escape sin cambios → modal=${await edicion.count()} · pregunta de descarte=${await dialogo(p, '¿Descartás').count()}`);
  }, p, 'Credenciales');

  const MAT = `MP-B-${SELLO}`;
  await paso('alta y corrección de matrícula', async () => {
    await p.getByTestId('matricula-agregar').click();
    const modal = p.getByTestId('alta-matricula-dialogo');
    await modal.locator('dialog[open]').waitFor({ timeout: 10_000 });
    await capVista(p, CAPS4, 'h4-alta-matricula-modal');
    await p.keyboard.press('Escape');
    await asentar(p, 600);
    log(`H4.S2.M1 · Escape sin nada escrito → modal=${await modal.count()} · pregunta de descarte=${await dialogo(p, '¿Descartás').count()}`);
    await p.getByTestId('matricula-agregar').click();
    await modal.locator('dialog[open]').first().waitFor({ timeout: 10_000 });
    await campo(modal, 'matricula-numero').fill(MAT);
    const autoridad = await elegir(modal, 'matricula-autoridad');
    await archivo(modal, 'matricula-archivo').setInputFiles(pdf(`carnet-${SELLO}.pdf`, `CARNET-ORIGINAL-${SELLO}`));
    await asentar(p, 400);
    await modal.getByRole('button', { name: 'Agregar matrícula', exact: true }).click();
    await asentar(p, 600);
    const confirma = dialogo(p, '¿Confirmás estos datos?');
    log(`H4.S2.M3 · al agregar ${MAT} (${autoridad}) → «¿Confirmás estos datos?»=${await confirma.count()}`);
    await capVista(p, CAPS4, 'h4-alta-matricula-confirmacion');
    await confirma.getByRole('button', { name: 'Confirmar' }).click();
    await modal.waitFor({ state: 'detached', timeout: 20_000 });
    await asentar(p, 1200);
    const idMat = await idDeFila(p, 'tabla-matriculas', MAT, 'matricula-acciones-');

    await (await accion(p, 'matricula', idMat, 'editar')).click();
    const edicion = p.getByTestId('edicion-dialogo');
    await edicion.locator('dialog[open]').waitFor({ timeout: 10_000 });
    await asentar(p, 500);
    log(`H4.S2.M2 · «Editar» matrícula: número lleno=«${await campo(edicion, 'edicion-matricula-numero').inputValue()}» · selector=«${plano(await edicion.locator('app-form-field', { has: p.locator('app-file-input') }).first().innerText()).slice(0, 120)}»`);
    await archivo(edicion, 'edicion-matricula-archivo').setInputFiles(pdf(`carnet-nuevo-${SELLO}.pdf`, `CARNET-NUEVO-${SELLO}`));
    await asentar(p, 400);
    await capVista(p, CAPS4, 'h4-corregir-matricula-con-archivo');
    await edicion.getByRole('button', { name: 'Guardar cambios' }).click();
    await asentar(p, 600);
    await dialogo(p, '¿Confirmás estos cambios?').getByRole('button', { name: 'Confirmar' }).click();
    await edicion.waitFor({ state: 'detached', timeout: 20_000 });
    await asentar(p, 1200);
    const recien = await bajar(p, () => accion(p, 'matricula', idMat, 'descargar'));
    log(`H4.S2.M2 · descarga antes de recargar: trae el nuevo=${recien.texto.includes(`CARNET-NUEVO-${SELLO}`)} · trae el original=${recien.texto.includes(`CARNET-ORIGINAL-${SELLO}`)}`);
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.locator('[data-testid="edicion-pestanas"] [role="tab"]').first().waitFor({ timeout: 60_000 });
    await tab(p, 'Credenciales').click();
    await asentar(p, 1500);
    const bajado = await bajar(p, () => accion(p, 'matricula', idMat, 'descargar'));
    log(`H4.S2.M2 · corregida y recargada: descarga ${bajado.nombre} · es el nuevo=${bajado.texto.includes(`carnet-nuevo-${SELLO}.pdf`)} · es el original=${bajado.texto.includes(`carnet-${SELLO}.pdf`)} · ${bajado.texto.length} bytes, empieza «${plano(bajado.texto.slice(0, 60))}»`);
    await cap(p, CAPS4, 'h4-matricula-tras-recargar');
  }, p, 'Credenciales');

  await paso('Credenciales · búsquedas separadas', async () => {
    const esp = p.locator('[data-testid="tabla-especialidades"] tbody tr');
    const mat = p.locator('[data-testid="tabla-matriculas"] tbody tr');
    const e0 = await esp.count();
    const m0 = await mat.count();
    await buscarEn(p, 0, 'zzz');
    log(`H4.S3.M1 · «zzz» en especialidades → URL ${claves(p)} · especialidades ${e0}→${await esp.count()} · matrículas ${m0}→${await mat.count()}`);
    await buscarEn(p, 0, '');
    await buscarEn(p, 1, MAT);
    log(`H4.S3.M1 · «${MAT}» en matrículas → URL ${claves(p)} · especialidades=${await esp.count()} · matrículas=${await mat.count()}`);
    await cap(p, CAPS4, 'h4-busqueda-matriculas');
  }, p, 'Credenciales');
  await p.context().close();

  const m = await entrar(navegador, { ancho: 375, alto: 812, tema: 'dark' });
  await abrirEditor(m, 'Credenciales');
  await paso('Credenciales móvil', async () => {
    await asentar(m, 1200);
    log(`H4.S3.M2 · Credenciales 375 oscuro: barras ${JSON.stringify(await barras(m))} · desborde ${JSON.stringify(await desborde(m))}`);
    await cap(m, CAPS4, 'h4-credenciales-movil-oscuro');
    await m.getByTestId('especialidad-agregar').click();
    const modal = m.getByTestId('alta-especialidad-dialogo');
    await modal.locator('dialog[open]').waitFor({ timeout: 10_000 });
    await modal.getByTestId('agregar-casilla-especialidad').click();
    await asentar(m, 500);
    await capVista(m, CAPS4, 'h4-alta-especialidad-movil-oscuro');
    await m.keyboard.press('Escape');
    await asentar(m, 400);
    await m.getByTestId('matricula-agregar').click();
    await m.getByTestId('alta-matricula-dialogo').locator('dialog[open]').waitFor({ timeout: 10_000 });
    await capVista(m, CAPS4, 'h4-alta-matricula-movil-oscuro');
  }, m, 'Credenciales');
  await m.context().close();
}

async function main() {
  const navegador = await chromium.launch();
  const que = process.argv[3] ?? 'todo';
  if (que === 'todo' || que === 'h3') await trayectoria(navegador);
  if (que === 'todo' || que === 'h4') await credenciales(navegador);
  await navegador.close();
  writeFileSync(`${DIR4}comportamiento-h3h4.txt`, lineas.join('\n') + '\n');
  const unicos = (xs) => [...new Set(xs)];
  writeFileSync(
    `${DIR4}consola-red-h3h4.txt`,
    `# Consola y red de H3/H4 — ${new Date().toISOString()}\n\n## Consola (error/warning)\n${consola.length ? unicos(consola).join('\n') : 'ninguno'}\n\n## Red (>= 400 o fallida)\n${red.length ? unicos(red).join('\n') : 'ninguna'}\n`,
  );
  log(`consola: ${unicos(consola).length} distintas · red: ${unicos(red).length} distintas`);
}
main().catch((e) => {
  process.stderr.write(String(e?.stack ?? e) + '\n');
  process.exitCode = 2;
});
