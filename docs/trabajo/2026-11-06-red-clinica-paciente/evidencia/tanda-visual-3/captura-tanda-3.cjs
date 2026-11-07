// Visual batch 3 — browser evidence for the clinical network review fixes.
// Usage: node captura-tanda-3.cjs <out-dir>   (ng serve on :4300, configuration development,demo)
// SOLO=medica|paciente|estados|a11y|todo. Never `networkidle` (with HMR it never arrives): waits are on test ids.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const fs = require('fs');
const OUT = process.argv[2];
const BASE = process.env.BASE ?? 'http://localhost:4300';
const SOLO = process.env.SOLO ?? 'todo';
const AXE = '/home/user/mantra-core-health/node_modules/axe-core/axe.min.js';
const log = [];
const anotar = (s) => { log.push(s); console.log(s); };
let fallas = 0;
const afirmar = (cond, texto) => { anotar(`${cond ? 'ok  ' : 'FALLA'} ${texto}`); if (!cond) fallas++; };

function uuid(seed) {
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) { const c = seed.charCodeAt(i); h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0; h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0; }
  const hex = (n) => n.toString(16).padStart(8, '0');
  const raw = `${hex(h1)}${hex(h2)}${hex((h1 * 31 + h2) >>> 0)}${hex((h2 * 17 + h1) >>> 0)}`;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-a${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
}
const EXPEDIENTE = `/medical-records/${uuid('pid-paciente')}`;
const ALTO = { 390: 844, 768: 1024, 1024: 768, 1440: 900, 1920: 1080 };
const nombreTema = (t) => (t === 'light' ? 'claro' : 'oscuro');

async function sesion(b, usuario, ancho, tema) {
  const ctx = await b.newContext({ viewport: { width: ancho, height: ALTO[ancho] }, deviceScaleFactor: ancho >= 1440 ? 1 : 2, colorScheme: tema, locale: 'es-BO', timezoneId: 'America/La_Paz', acceptDownloads: true });
  await ctx.addInitScript((t) => { try { localStorage.setItem('mantra-core-health.theme', t); } catch {} }, tema);
  const p = await ctx.newPage();
  const errores = [];
  p.on('pageerror', (e) => errores.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errores.push('console: ' + m.text()); });
  await p.goto(BASE + '/auth');
  await p.getByTestId('login-identifier').waitFor({ timeout: 180000 });
  await p.getByTestId('login-identifier').fill(usuario);
  await p.getByTestId('login-password').fill('mock');
  await p.getByTestId('login-submit').click();
  await p.waitForURL((u) => !u.pathname.startsWith('/auth') || u.pathname.includes('organization'), { timeout: 120000 });
  if (p.url().includes('organization')) {
    await p.getByTestId('tenant-opcion').first().click();
    await p.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60000 });
  }
  return { ctx, p, errores };
}

const sinDesborde = (p) => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
/** Dismisses the opening toasts: they are measured apart and would cover what each capture is about. */
async function sinToasts(p) {
  for (const cerrar of await p.getByTestId('toast-cerrar').all()) await cerrar.click().catch(() => {});
  await p.locator('app-toast').first().waitFor({ state: 'detached', timeout: 5000 }).catch(() => {});
}

/** A tall region whole: a full-page shot clipped to it (an element shot stitches the fixed header in the middle). */
async function region(p, testId, path) {
  const caja = await p.getByTestId(testId).evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, width: r.width, height: r.height }; });
  await p.screenshot({ path, fullPage: true, clip: caja });
}

async function abrirRed(p) {
  await p.goto(BASE + EXPEDIENTE);
  await p.getByTestId('expediente-vista').waitFor({ timeout: 120000 });
  await p.getByTestId('expediente-vista').getByRole('radio', { name: 'Recorrido' }).click();
  await p.getByTestId('red-superficie').waitFor({ timeout: 60000 });
  await p.getByTestId('red-episodio').first().waitFor({ timeout: 60000 });
}

async function abrirTsh(p) {
  const hipo = p.getByTestId('red-episodio').filter({ hasText: 'Hipotiroidismo' }).first();
  if ((await hipo.getAttribute('aria-expanded')) !== 'true') await hipo.click();
  const tsh = p.locator('[data-testid="recorrido-nodo"][data-clase="estudio"]').filter({ hasText: 'TSH' }).first();
  await tsh.waitFor();
  await tsh.click();
  await p.getByTestId('red-panel').waitFor({ timeout: 15000 });
  return tsh;
}

/** Each episode name whole and inside the visible canvas (finding 1). */
const nombresEnteros = (p) => p.evaluate(() => {
  const lienzo = document.querySelector('.red__lienzo');
  if (!lienzo) return { vertical: true, cortados: [] };
  const caja = lienzo.getBoundingClientRect();
  // The text's own laid-out box against the span's: scrollWidth rounds to whole pixels and hid a sub-pixel cut.
  const cortados = [...lienzo.querySelectorAll('.red__episodio-nombre')].filter((n) => {
    const r = n.getBoundingClientRect();
    const rango = document.createRange();
    rango.selectNodeContents(n);
    const t = rango.getBoundingClientRect();
    return r.left < caja.left - 1 || r.right > caja.right + 1 || t.width > r.width || t.height > r.height;
  }).map((n) => n.textContent.trim());
  return { vertical: false, cortados };
});

async function medica(b, ancho, tema) {
  const pref = `medica-${ancho}-${nombreTema(tema)}`;
  const { ctx, p, errores } = await sesion(b, 'medica@alovida.mock', ancho, tema);
  await abrirRed(p);
  const toast = await p.locator('app-toast').allTextContents();
  afirmar(!toast.join(' ').includes('Sin registrar'), `${pref}: el aviso de alergias nombra cada sustancia (${toast.join(' | ').replace(/\s+/g, ' ').trim().slice(0, 90)})`);
  await sinToasts(p);
  await p.getByTestId('expediente-recorrido').scrollIntoViewIfNeeded();
  const nombres = await nombresEnteros(p);
  afirmar(nombres.cortados.length === 0, `${pref}: ningún nombre de episodio cortado ${JSON.stringify(nombres)}`);
  // Two neighbouring columns never print the same day: the second says «Mismo día».
  const ejes = await p.$$eval('.red__columna .red__fecha', (fs) => fs.map((f) => f.textContent.trim()));
  const repetidas = ejes.filter((e, i) => i > 0 && e === ejes[i - 1] && !/^Mismo/.test(e));
  afirmar(repetidas.length === 0, `${pref}: el eje no repite la fecha de la columna vecina (${ejes.slice(0, 3).join(' | ')} …)`);
  if (!nombres.vertical) {
    const aviso = await p.getByTestId('red-fuera').allTextContents();
    afirmar(aviso.length > 0, `${pref}: los episodios con marcas fuera de la vista lo avisan (${aviso.map((t) => t.trim()).join(' · ')})`);
  }
  afirmar(await sinDesborde(p), `${pref}: sin desplazamiento horizontal`);
  await p.screenshot({ path: `${OUT}/${pref}-01-red.png` });
  if (ancho === 1440 || ancho === 390) await region(p, 'red-superficie', `${OUT}/${pref}-01b-red-completa.png`);

  await abrirTsh(p);
  await p.getByTestId('red-panel-valor').first().waitFor({ timeout: 20000 });
  const panel = await p.evaluate(() => {
    const pan = document.querySelector('[data-testid="red-panel"]');
    const caja = pan.getBoundingClientRect();
    const cerrar = document.querySelector('[data-testid="red-panel-cerrar"]').getBoundingClientRect();
    const archivo = document.querySelector('[data-testid="red-panel-archivo"]');
    return {
      recortados: [...pan.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > caja.right + 1 && !e.closest('.panel__tabla-caja')).length,
      cerrar: [Math.round(cerrar.width), Math.round(cerrar.height)],
      archivoAlto: archivo ? Math.round(archivo.getBoundingClientRect().height) : null,
      valorFuente: getComputedStyle(document.querySelector('.panel__valor')).fontFamily.split(',')[0],
    };
  });
  anotar(`${pref} panel: ${JSON.stringify(panel)}`);
  afirmar(panel.recortados === 0, `${pref}: nada del panel se sale por la derecha`);
  afirmar(panel.cerrar[0] >= 24 && panel.cerrar[1] >= 24, `${pref}: «Cerrar» mide ${panel.cerrar.join('×')} (≥ 24)`);
  afirmar(panel.archivoAlto === null || panel.archivoAlto <= 44, `${pref}: la descarga va en una línea (${panel.archivoAlto} px)`);
  afirmar(!/mono/i.test(panel.valorFuente), `${pref}: los valores no van en monoespaciada (${panel.valorFuente})`);
  if (ancho >= 650) {
    const conPanel = await nombresEnteros(p);
    afirmar(conPanel.cortados.length === 0, `${pref}: con el panel abierto ningún nombre de episodio cortado ${JSON.stringify(conPanel.cortados)}`);
  }
  await p.screenshot({ path: `${OUT}/${pref}-02-panel-tsh.png` });
  afirmar(errores.length === 0, `${pref}: consola sin errores ${JSON.stringify(errores.slice(0, 3))}`);
  await ctx.close();
}

async function paciente(b, ancho, tema) {
  const pref = `paciente-${ancho}-${nombreTema(tema)}`;
  const { ctx, p, errores } = await sesion(b, 'paciente@alovida.mock', ancho, tema);
  await p.goto(BASE + '/my-account/medical-record?vista=recorrido');
  await p.getByTestId('recorrido-hilos').waitFor({ timeout: 120000 });
  await sinToasts(p);
  const hilo = p.getByTestId('recorrido-hilo').filter({ hasText: 'Hipotiroidismo' }).first();
  await hilo.locator('.accordion-panel__trigger').first().click();
  const atenciones = hilo.getByTestId('recorrido-atencion');
  await atenciones.first().waitFor();
  for (let i = 0; i < Math.min(await atenciones.count(), 2); i++) await atenciones.nth(i).locator('.accordion-panel__trigger').first().click();
  const sellos = await hilo.locator('app-badge').count();
  afirmar(sellos === 0, `${pref}: el estado del problema se dice una vez (en el encabezado), sin insignia repetida`);
  await hilo.scrollIntoViewIfNeeded();
  afirmar(await sinDesborde(p), `${pref}: sin desplazamiento horizontal`);
  await p.screenshot({ path: `${OUT}/${pref}-1-hilo.png` });
  await hilo.getByTestId('recorrido-empezar-guiado').click();
  const frases = [];
  for (let i = 0; i < 25; i++) {
    frases.push((await p.getByTestId('recorrido-narracion').textContent())?.trim());
    if (i === 2) { await p.getByTestId('recorrido-guiado').scrollIntoViewIfNeeded(); await p.screenshot({ path: `${OUT}/${pref}-2-paso-a-paso.png` }); }
    // «Paso N de M»: the last step ends the walk (a disabled button is not clicked).
    const [n, m] = ((await p.locator('.recorrido__guiado-contador').textContent()) ?? '').match(/\d+/g) ?? [];
    if (n === m) break;
    await p.getByTestId('recorrido-siguiente').click();
    await p.locator('.recorrido__guiado-contador').filter({ hasText: `Paso ${+n + 1} de` }).waitFor();
  }
  if (ancho === 1440 && tema === 'light') anotar(`${pref} narración:\n  - ${frases.join('\n  - ')}`);
  afirmar(!frases.some((f) => /consultó por reconsulta/i.test(f ?? '')), `${pref}: ninguna frase dice «consultó por reconsulta»`);
  afirmar(errores.length === 0, `${pref}: consola sin errores ${JSON.stringify(errores.slice(0, 3))}`);
  await ctx.close();
}

/** The panel's M34 states, provoked with `mock:fallos` (core/mock/simulated-failures.ts). */
async function estados(b, ancho, tema) {
  const pref = `estados-${ancho}-${nombreTema(tema)}`;
  const { ctx, p } = await sesion(b, 'medica@alovida.mock', ancho, tema);
  await abrirRed(p);
  await sinToasts(p);
  const fallar = (lista) => p.evaluate((l) => sessionStorage.setItem('mock:fallos', JSON.stringify(l)), lista);
  const panel = p.getByTestId('red-panel');
  const cerrar = async () => { await p.getByTestId('red-panel-cerrar').click(); await panel.waitFor({ state: 'detached' }); };

  // S1: while the report is read, what is known stays and the reading says so. The simulator answers
  // in 120 ms; the page clock is paused (Playwright `clock.pauseAt`) so the shot lands inside that wait.
  const hipo = p.getByTestId('red-episodio').filter({ hasText: 'Hipotiroidismo' }).first();
  await hipo.click();
  const tsh = p.locator('[data-testid="recorrido-nodo"][data-clase="estudio"]').filter({ hasText: 'TSH' }).first();
  await tsh.waitFor();
  await p.clock.install();
  await p.clock.pauseAt(Date.now() + 1000);
  await tsh.click();
  await p.clock.runFor(60);
  const s1 = await p.getByTestId('red-panel-informe-cargando').isVisible().catch(() => false);
  if (s1) await panel.screenshot({ path: `${OUT}/${pref}-s1-leyendo.png` });
  await p.clock.resume();
  afirmar(s1, `${pref}: S1 «Leyendo los valores del informe…» visible en la captura`);
  await p.getByTestId('red-panel-valor').first().waitFor();
  await cerrar();

  const casos = [
    ['403', { patron: '/reports/', modo: 'forbidden', metodos: ['GET'] }, 'No puede ver este informe'],
    ['404', { patron: '/reports/', modo: 'not-found', metodos: ['GET'] }, 'El informe no está disponible'],
    ['sin-conexion', { patron: '/reports/', modo: 'red', metodos: ['GET'] }, 'Sin conexión'],
    ['s9-error-con-id', { patron: '/reports/', modo: 'error', metodos: ['GET'] }, 'Código de soporte'],
    ['validacion', { patron: '/reports/', modo: 'validation', metodos: ['GET'] }, 'No se pudieron leer los valores ahora'],
  ];
  for (const [nombre, fallo, texto] of casos) {
    await fallar([fallo]);
    await tsh.click();
    const error = p.getByTestId('red-panel-informe-error');
    await error.waitFor({ timeout: 15000 });
    const dice = (await error.textContent()).replace(/\s+/g, ' ').trim();
    afirmar(dice.includes(texto), `${pref} ${nombre}: «${dice.slice(0, 110)}»`);
    await panel.screenshot({ path: `${OUT}/${pref}-${nombre}.png` });
    await fallar([]);
    await cerrar();
  }

  // The file download states (validation: the file is still under security review).
  await fallar([{ patron: '/content', modo: 'validation', metodos: ['GET'] }]);
  await tsh.click();
  await p.getByTestId('red-panel-archivo').first().click();
  await panel.getByText('El archivo todavía no se puede abrir').waitFor({ timeout: 15000 });
  await panel.getByTestId('red-panel-archivo').scrollIntoViewIfNeeded();
  await panel.screenshot({ path: `${OUT}/${pref}-descarga-validacion.png` });
  afirmar(true, `${pref}: descarga en revisión → «El archivo todavía no se puede abrir»`);
  await fallar([]);
  await cerrar();

  // «Liberado sin publicar»: the first released report the patient does not see.
  const sinPublicar = await buscarSinPublicar(p);
  afirmar(sinPublicar !== null, `${pref}: «Liberado sin publicar al paciente.» en ${sinPublicar ?? 'ningún estudio'}`);
  if (sinPublicar !== null) {
    await p.getByTestId('red-panel-sin-publicar').scrollIntoViewIfNeeded();
    await panel.screenshot({ path: `${OUT}/${pref}-liberado-sin-publicar.png` });
    await cerrar();
  }

  // The step notice: a type filter hides what a step tells (step 1 is an encounter).
  // The thread filter on a 2026 episode while the tour narrates the whole history from 2025: the first
  // steps tell records the filter leaves out.
  await p.getByTestId('red-filtro-hilo').click();
  await p.getByRole('option', { name: /^Trastorno de ansiedad/ }).first().click();
  anotar(`${pref}: filtro «Solo el hilo» = Trastorno de ansiedad generalizada; se recorre «Toda la historia»`);
  await p.getByTestId('red-guiado-alternar').click();
  await p.getByTestId('red-guiado-episodio').click();
  await p.getByRole('option', { name: /^Toda la historia/ }).first().click();
  // The whole history opens near the followed episode's date: back to step 1 (2025).
  await p.getByTestId('guiado-episodio').waitFor({ state: 'detached' });
  const contador = p.getByTestId('guiado-contador');
  await contador.filter({ hasText: /de 3\d/ }).waitFor();
  for (let i = 0; i < 40 && !/Paso 1 de/.test((await contador.textContent()) ?? ''); i++) await p.getByTestId('guiado-anterior').click({ force: true });
  const nota = p.getByTestId('red-guiado-sin-nodos');
  for (let i = 0; i < 8; i++) {
    if (await nota.waitFor({ timeout: 1500 }).then(() => true, () => false)) break;
    await p.getByTestId('guiado-siguiente').click();
  }
  afirmar(await nota.isVisible(), `${pref}: aviso de paso «${((await nota.textContent().catch(() => '')) ?? '').trim()}»`);
  await nota.scrollIntoViewIfNeeded();
  await p.getByTestId('red-guiado').screenshot({ path: `${OUT}/${pref}-aviso-de-paso.png` });
  await ctx.close();
}

/** Opens every study node until one says «Liberado sin publicar». */
async function buscarSinPublicar(p) {
  await p.getByTestId('red-desplegar-todo').click();
  const estudios = p.locator('[data-testid="recorrido-nodo"][data-clase="estudio"]');
  const total = await estudios.count();
  for (let i = 0; i < total; i++) {
    const nodo = estudios.nth(i);
    await nodo.scrollIntoViewIfNeeded();
    await nodo.click();
    await p.getByTestId('red-panel').waitFor();
    const leido = p.getByTestId('red-panel-informe-cargando');
    await leido.waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
    if (await p.getByTestId('red-panel-sin-publicar').count()) return (await nodo.textContent()).replace(/\s+/g, ' ').trim().slice(0, 40);
    await p.getByTestId('red-panel-cerrar').click();
  }
  return null;
}

module.exports = { sesion, abrirRed, abrirTsh, sinToasts, afirmar, anotar, BASE, AXE, EXPEDIENTE };

if (require.main === module) {
  (async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const b = await chromium.launch({ args: ['--disable-dev-shm-usage', '--disable-gpu'] });
    for (const ancho of [390, 768, 1024, 1440, 1920]) {
      for (const tema of ['light', 'dark']) {
        if (SOLO === 'todo' || SOLO === 'medica') await medica(b, ancho, tema).catch((e) => { fallas++; anotar(`FALLA médica ${ancho} ${tema}: ${e.message.split('\n')[0]}`); });
        if (SOLO === 'todo' || SOLO === 'paciente') await paciente(b, ancho, tema).catch((e) => { fallas++; anotar(`FALLA paciente ${ancho} ${tema}: ${e.message.split('\n')[0]}`); });
      }
    }
    if (SOLO === 'todo' || SOLO === 'estados') {
      for (const [ancho, tema] of [[1440, 'light'], [1440, 'dark'], [390, 'light']].filter(([a, t]) => !process.env.SOLO_ESTADO || process.env.SOLO_ESTADO === `${a}-${t}`)) {
        await estados(b, ancho, tema).catch((e) => { fallas++; anotar(`FALLA estados ${ancho} ${tema}: ${e.message.split('\n').slice(0, 4).join(' | ')}`); });
      }
    }
    await b.close();
    anotar(`\n${fallas === 0 ? 'TODO OK' : fallas + ' FALLA(S)'}`);
    fs.writeFileSync(`${OUT}/aserciones-${SOLO}.txt`, log.join('\n') + '\n');
  })().catch((e) => { console.error(e); process.exit(1); });
}
