/**
 * Evidencia de D-05 (pedido del cliente del 22/09/2026: «cada botón de acción
 * tiene ícono + nombre») en el perfil del paciente, las altas y tres piezas
 * compartidas:
 *
 * - «Editar» de «Mi perfil» pasa de lápiz solo a lápiz + «Editar».
 * - El calendario pasa a ícono + nombre en «Cerrar» y en sus flechas; los
 *   nombres accesibles («Mes anterior», …) se conservan, y las cuatro flechas
 *   van en un renglón. Se mira en el editor del paciente y en la vitrina, en
 *   modo fecha y hora.
 * - El botón que quita la ubicación del mapa pasa a ícono + «Quitar».
 * - Las excepciones del ADR-0012 §3 (quitar, pasar de página, volver) sólo
 *   suman su justificación en el código: el DOM de la botonera del formulario
 *   por páginas sale idéntico, antes y después, en cinco pantallas que no son
 *   de este cambio.
 *
 * Uso: `node playwright/d05-iconos.mjs <antes|despues> [urlBase]`. La pasada
 * `antes` guarda el DOM y las capturas de referencia; la pasada `despues`
 * compara contra ellas. Si algo falla, deja una captura de diagnóstico en la
 * carpeta temporal del sistema, no junto a la evidencia.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const FASE = process.argv[2];
const BASE = process.argv[3] ?? 'http://localhost:4200';
if (FASE !== 'antes' && FASE !== 'despues') {
  process.stderr.write('Uso: node playwright/d05-iconos.mjs <antes|despues> [urlBase]\n');
  process.exit(2);
}
const SALIDA = fileURLToPath(new URL('../docs/frontend/evidence/d05-iconos-2026-09-23', import.meta.url));
const DOM_ANTES = `${SALIDA}/dom-formulario-por-paginas-antes.json`;
const DOM_DESPUES = `${SALIDA}/dom-formulario-por-paginas-despues.json`;
const DESBORDE_ANTES = `${SALIDA}/desborde-mi-perfil-antes.json`;

/**
 * Los cinco viewports que el repo exige como evidencia visual, con tema oscuro
 * en el de escritorio y en el más angosto, más 360: ahí las flechas del mes ya
 * no entran en un renglón y se parten.
 */
const CELDAS = [
  { ancho: 1440, alto: 900, tema: 'light' },
  { ancho: 1440, alto: 900, tema: 'dark' },
  { ancho: 1920, alto: 1080, tema: 'light' },
  { ancho: 1024, alto: 768, tema: 'light' },
  { ancho: 768, alto: 1024, tema: 'light' },
  { ancho: 390, alto: 844, tema: 'light' },
  { ancho: 390, alto: 844, tema: 'dark' },
  { ancho: 360, alto: 800, tema: 'light' },
];

/**
 * Exclusión deliberada: bajo el servidor de desarrollo la CSP queda sin hashes
 * y bloquea los scripts en línea en todas las rutas (ver
 * `src/server/security-headers.ts`). Se cuentan aparte; cualquier otro error
 * de consola sigue haciendo fallar el recorrido.
 */
const CSP_DEL_SERVIDOR_DE_DESARROLLO =
  "Executing inline script violates the following Content Security Policy directive 'script-src 'self'";

/**
 * Pantallas que montan `app-paginated-form`, todas públicas. Las cinco
 * primeras no son de este cambio; el alta del paciente sí (sólo comentarios
 * de plantilla) y es la única que enciende el modo ícono. Todas tienen que
 * dibujarlo.
 */
const CONSUMIDORES = [
  { ruta: '/auth/register/practitioner', cuenta: null },
  { ruta: '/auth/register/organization', cuenta: null },
  { ruta: '/auth/register/laboratory', cuenta: null },
  { ruta: '/auth/register/imaging-center', cuenta: null },
  { ruta: '/design-system', cuenta: null },
  { ruta: '/auth/register/patient', cuenta: null },
];
const CONSUMIDORES_NECESARIOS = CONSUMIDORES.length;

const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond) });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

let navegador;
let paginaActual;
async function cerrarNavegador() {
  await navegador?.close().catch(() => {});
  navegador = undefined;
}
for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    void cerrarNavegador().then(() => process.exit(130));
  });
}

/** Fuentes listas, sin transiciones finitas en curso, y dos cuadros más. */
async function pintada(pagina) {
  await pagina.evaluate(() => document.fonts.ready);
  await pagina
    .waitForFunction(
      () =>
        document
          .getAnimations()
          .every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
      null,
      { timeout: 5_000 },
    )
    .catch(() => {});
  await pagina.evaluate(
    () => new Promise((listo) => requestAnimationFrame(() => requestAnimationFrame(listo))),
  );
}

/** Captura de la vista (no de la página entera): el calendario es un modal. */
async function capturar(pagina, nombre, { paginaEntera = false } = {}) {
  const { width, height } = pagina.viewportSize();
  // El menú lateral se abre al pasar el cursor: lo dejamos en el borde derecho.
  await pagina.mouse.move(width - 4, Math.round(height / 2));
  await pintada(pagina);
  await pagina.screenshot({ path: `${SALIDA}/${FASE}-${nombre}.png`, fullPage: paginaEntera });
}

const problemas = [];
let cspExcluidos = 0;

/** Contexto nuevo con su página, vigilada desde antes de navegar. */
async function contexto(opciones = {}) {
  const ctx = await navegador.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce',
    ...opciones,
  });
  const pagina = await ctx.newPage();
  pagina.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (m.text().startsWith(CSP_DEL_SERVIDOR_DE_DESARROLLO)) {
      cspExcluidos++;
      return;
    }
    problemas.push(`console: ${m.text()}`);
  });
  pagina.on('pageerror', (e) => problemas.push(`pageerror: ${e.message}`));
  pagina.on('response', (r) => {
    if (r.status() >= 400) problemas.push(`${r.status()} ${r.url()}`);
  });
  paginaActual = pagina;
  return { ctx, pagina };
}

async function entrar(pagina, cuenta) {
  await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.getByTestId('login-identifier').fill(cuenta);
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
}

/**
 * La botonera del formulario por páginas, sin los atributos que pone el
 * compilador para el encapsulado de estilos. Y cuántos comentarios con
 * «ADR-0012» llegaron al DOM (la justificación vive en la plantilla, no en la
 * página).
 */
function leerFormulario(pagina) {
  return pagina.evaluate(() => {
    const forma = document.querySelector('app-paginated-form');
    const botonera = forma?.querySelector('.paginated-form__acciones');
    if (!forma || !botonera) return null;
    const copia = botonera.cloneNode(true);
    for (const el of [copia, ...copia.querySelectorAll('*')]) {
      for (const atributo of [...el.attributes]) {
        if (/^(_ngcontent|_nghost|ng-reflect)/.test(atributo.name)) el.removeAttribute(atributo.name);
      }
    }
    let comentarios = 0;
    const recorrido = document.createTreeWalker(forma, NodeFilter.SHOW_COMMENT);
    for (let nodo = recorrido.nextNode(); nodo; nodo = recorrido.nextNode()) {
      if (nodo.textContent.includes('ADR-0012')) comentarios++;
    }
    return { botonera: copia.outerHTML.replace(/\s+/g, ' ').trim(), comentarios };
  });
}

/* ───────────── cinco pantallas ajenas que usan el formulario por páginas ───────────── */
async function consumidores() {
  const leidos = {};
  const porCuenta = new Map();
  for (const { ruta, cuenta } of CONSUMIDORES) {
    if (Object.keys(leidos).length >= CONSUMIDORES_NECESARIOS) break;
    const clave = cuenta ?? 'sin sesión';
    if (!porCuenta.has(clave)) {
      const { ctx, pagina } = await contexto();
      if (cuenta) await entrar(pagina, cuenta);
      porCuenta.set(clave, { ctx, pagina });
    }
    const { pagina } = porCuenta.get(clave);
    await pagina.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    const hay = await pagina
      .locator('app-paginated-form .paginated-form__acciones')
      .first()
      .waitFor({ timeout: 30_000 })
      .then(() => true)
      .catch(() => false);
    if (!hay) {
      process.stdout.write(`  · ${ruta} (${clave}): no dibuja el formulario por páginas, se sigue con la próxima\n`);
      continue;
    }
    // El servidor pone `jsaction` en los botones y se van al hidratar: leer
    // antes de eso compara el momento de la hidratación, no la botonera.
    await pagina.waitForFunction(
      () => !document.querySelector('.paginated-form__acciones[jsaction], .paginated-form__acciones [jsaction]'),
      null,
      { timeout: 30_000 },
    );
    await pintada(pagina);
    leidos[`${ruta} · ${clave}`] = await leerFormulario(pagina);
  }
  for (const { ctx } of porCuenta.values()) await ctx.close();

  const claves = Object.keys(leidos);
  ok(`formulario por páginas: las ${CONSUMIDORES_NECESARIOS} pantallas lo dibujan`, claves.length >= CONSUMIDORES_NECESARIOS, claves.join(' | '));

  if (FASE === 'antes') {
    writeFileSync(DOM_ANTES, JSON.stringify(leidos, null, 2));
    process.stdout.write(`  DOM de referencia guardado en ${relative(process.cwd(), DOM_ANTES)}\n`);
    return;
  }
  writeFileSync(DOM_DESPUES, JSON.stringify(leidos, null, 2));
  const antes = JSON.parse(readFileSync(DOM_ANTES, 'utf8'));
  for (const clave of claves) {
    ok(`formulario por páginas, ${clave}: la botonera es idéntica a la de antes`, antes[clave]?.botonera === leidos[clave].botonera);
    ok(`formulario por páginas, ${clave}: ningún comentario de la justificación llega a la página`, leidos[clave].comentarios === 0);
  }
}

/* ───────────────────────────── «Editar» en «Mi perfil» ───────────────────────────── */
async function editarEnMiPerfil() {
  // Cuántos px pasa la página del ancho de la ventana, por celda. El «antes» lo
  // guarda y el «después» exige que no crezca: el botón con nombre no puede
  // empujar nada fuera de la pantalla.
  const desborde = {};
  const antes = FASE === 'despues' ? JSON.parse(readFileSync(DESBORDE_ANTES, 'utf8')) : {};
  for (const { ancho, alto, tema } of CELDAS) {
    const { ctx, pagina } = await contexto({ viewport: { width: ancho, height: alto }, colorScheme: tema });
    await entrar(pagina, 'paciente@alovida.mock');
    await pagina.goto(`${BASE}/my-account`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    const boton = pagina.getByTestId('mi-perfil-editar');
    await boton.waitFor({ timeout: 30_000 });
    const celda = `${ancho}-${tema === 'light' ? 'claro' : 'oscuro'}`;
    await pintada(pagina);
    desborde[celda] = await pagina.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    if (FASE === 'despues') {
      ok(`Editar ${celda}: dice «Editar»`, (await boton.innerText()).trim() === 'Editar');
      ok(`Editar ${celda}: conserva el lápiz`, (await boton.locator('svg').count()) === 1);
      ok(`Editar ${celda}: ya no es botón de sólo ícono`, !(await boton.getAttribute('class')).includes('btn--icon-only'));
      ok(
        `Editar ${celda}: entra entero en la pantalla`,
        await boton.evaluate((b) => b.getBoundingClientRect().right <= document.documentElement.clientWidth),
      );
      ok(
        `Editar ${celda}: la página no desborda más que antes`,
        desborde[celda] <= antes[celda],
        `antes ${antes[celda]} px, después ${desborde[celda]} px`,
      );
    }
    await capturar(pagina, `editar-${celda}`);
    if (FASE === 'despues' && ancho === 1440 && tema === 'light') {
      await boton.click();
      await pagina.getByTestId('mi-perfil-editor').waitFor({ timeout: 30_000 });
      ok('Editar: sigue abriendo el formulario acá mismo', await pagina.getByTestId('mi-perfil-editor').isVisible());
    }
    await ctx.close();
  }
  if (FASE === 'antes') {
    writeFileSync(DESBORDE_ANTES, JSON.stringify(desborde, null, 2));
    process.stdout.write(`  desborde de «Mi perfil» por celda (px): ${JSON.stringify(desborde)}\n`);
  }
}

/* ─────────────────────────────── el calendario ─────────────────────────────── */
async function abrirCalendario(pagina) {
  await entrar(pagina, 'paciente@alovida.mock');
  await pagina.goto(`${BASE}/my-account`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.getByTestId('mi-perfil-editar').waitFor({ timeout: 30_000 });
  await pagina.getByTestId('mi-perfil-editar').click();
  await pagina.getByTestId('mi-perfil-editor').waitFor({ timeout: 30_000 });
  const disparador = pagina.locator('.date-picker-trigger').first();
  await disparador.waitFor({ timeout: 30_000 });
  await disparador.scrollIntoViewIfNeeded();
  await disparador.click();
  const dialogo = pagina.locator('dialog.date-picker-dialog[open]');
  await dialogo.waitFor({ timeout: 15_000 });
  return dialogo;
}

/** En cuántos renglones quedan las flechas del panel (por la altura de cada una). */
function renglonesDeFlechas(dialogo) {
  return dialogo.evaluate(
    (d) => new Set([...d.querySelectorAll('.nav-controls button')].map((b) => Math.round(b.getBoundingClientRect().top))).size,
  );
}

/**
 * Las flechas que no están en su mitad del panel: las de «anterior» van a la
 * izquierda del centro y las de «siguiente» a la derecha, aunque el renglón se
 * parta.
 */
function flechasFueraDeSuMitad(dialogo) {
  return dialogo.evaluate((d) => {
    const panel = d.querySelector('.date-picker-panel').getBoundingClientRect();
    const medio = panel.left + panel.width / 2;
    return [...d.querySelectorAll('.nav-controls button')]
      .filter((b) => {
        const caja = b.getBoundingClientRect();
        const centro = caja.left + caja.width / 2;
        return /anterior/.test(b.getAttribute('aria-label') ?? '') ? centro >= medio : centro <= medio;
      })
      .map((b) => b.getAttribute('aria-label'));
  });
}

async function calendario() {
  for (const { ancho, alto, tema } of CELDAS) {
    // La referencia del «antes» basta en claro, en escritorio y en los dos más angostos.
    if (FASE === 'antes' && (tema === 'dark' || ![1440, 390, 360].includes(ancho))) continue;
    const { ctx, pagina } = await contexto({ viewport: { width: ancho, height: alto }, colorScheme: tema });
    const dialogo = await abrirCalendario(pagina);
    const celda = `${ancho}-${tema === 'light' ? 'claro' : 'oscuro'}`;

    if (FASE === 'despues') {
      const cerrar = dialogo.locator('.dialog-header button');
      ok(`calendario ${celda}: «Cerrar» dice su nombre`, (await cerrar.innerText()).trim() === 'Cerrar');
      ok(`calendario ${celda}: «Cerrar» conserva la cruz`, (await cerrar.locator('svg').count()) === 1);
      const flechas = dialogo.locator('.nav-controls button');
      const textos = (await flechas.allInnerTexts()).map((t) => t.trim());
      const nombres = await flechas.evaluateAll((b) => b.map((x) => x.getAttribute('aria-label')));
      ok(`calendario ${celda}: las flechas del mes dicen Año, Mes, Mes, Año`, textos.join(',') === 'Año,Mes,Mes,Año', textos.join(','));
      ok(
        `calendario ${celda}: conservan sus nombres completos`,
        nombres.join(',') === 'Año anterior,Mes anterior,Mes siguiente,Año siguiente',
        nombres.join(','),
      );
      ok(
        `calendario ${celda}: ningún botón del calendario queda de sólo ícono`,
        (await dialogo.locator('.btn--icon-only').count()) === 0,
      );
      ok(
        `calendario ${celda}: el panel no desborda a lo ancho`,
        await dialogo.locator('.date-picker-panel').evaluate((p) => p.scrollWidth <= p.clientWidth),
      );
      const fuera = await flechasFueraDeSuMitad(dialogo);
      ok(`calendario ${celda}: «anterior» a la izquierda y «siguiente» a la derecha`, fuera.length === 0, fuera.join(', '));
      const renglones = await renglonesDeFlechas(dialogo);
      ok(`calendario ${celda}: las cuatro flechas van en un renglón`, renglones === 1, `${renglones} renglones`);
    }
    await capturar(pagina, `calendario-dias-${celda}`);

    // La grilla de años: sus dos flechas.
    await dialogo.locator('.view-switch').click();
    // Las flechas se leen cuando la grilla de años ya está: antes siguen las del mes.
    await dialogo.locator('.calendar-grid-years').waitFor({ timeout: 10_000 });
    if (FASE === 'despues') {
      const textos = (await dialogo.locator('.nav-controls button').allInnerTexts()).map((t) => t.trim());
      ok(`calendario ${celda}: las flechas de los años dicen «30 años»`, textos.join(',') === '30 años,30 años', textos.join(','));
      ok(
        `calendario ${celda}: el panel de años no desborda a lo ancho`,
        await dialogo.locator('.date-picker-panel').evaluate((p) => p.scrollWidth <= p.clientWidth),
      );
      const fuera = await flechasFueraDeSuMitad(dialogo);
      ok(`calendario ${celda}: en los años, «anterior» a la izquierda y «siguiente» a la derecha`, fuera.length === 0, fuera.join(', '));
      const renglones = await renglonesDeFlechas(dialogo);
      ok(`calendario ${celda}: las dos flechas de los años van en un renglón`, renglones === 1, `${renglones} renglones`);
    }
    await capturar(pagina, `calendario-anios-${celda}`);

    // Hallazgo de Q-I12: algo colgado del <body> —como el globo de ayuda— queda
    // debajo de un <dialog> modal aunque pida el z-index más alto.
    if (FASE === 'despues' && ancho === 1440 && tema === 'light') {
      const debajo = await dialogo.evaluate((d) => {
        const caja = d.querySelector('.date-picker-panel').getBoundingClientRect();
        const x = caja.left + caja.width / 2;
        const y = caja.top + 24;
        const globo = document.createElement('div');
        globo.style.cssText = `position:fixed;left:${x - 20}px;top:${y - 10}px;width:40px;height:20px;z-index:2147483647;background:red`;
        document.body.appendChild(globo);
        const arriba = document.elementFromPoint(x, y);
        globo.remove();
        return arriba !== globo && d.contains(arriba);
      });
      ok('hallazgo: un elemento colgado del <body> queda debajo del calendario modal', debajo);
    }
    await ctx.close();
  }
}

/** Escritorio y teléfono, en claro: donde se miran el segundo consumidor y el mapa. */
const CELDAS_REDUCIDAS = CELDAS.filter(({ ancho, tema }) => tema === 'light' && (ancho === 1440 || ancho === 390));

/** Más 360, donde el encabezado del modo fecha y hora es el más largo. */
const CELDAS_DE_LA_VITRINA = [...CELDAS_REDUCIDAS, ...CELDAS.filter(({ ancho }) => ancho === 360)];

/**
 * El calendario en otro consumidor y en su otro modo: la vitrina monta uno en
 * modo fecha y hora. Se abre sin sesión.
 */
async function calendarioEnLaVitrina() {
  for (const { ancho, alto, tema } of CELDAS_DE_LA_VITRINA) {
    const { ctx, pagina } = await contexto({ viewport: { width: ancho, height: alto }, colorScheme: tema });
    const celda = `${ancho}-claro`;
    await pagina.goto(`${BASE}/design-system`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    const disparador = pagina
      .locator('app-form-field', { hasText: 'Fecha y Hora de Cita' })
      .locator('.date-picker-trigger');
    await disparador.waitFor({ timeout: 30_000 });
    await disparador.scrollIntoViewIfNeeded();
    await disparador.click();
    const dialogo = pagina.locator('dialog.date-picker-dialog[open]');
    await dialogo.waitFor({ timeout: 15_000 });
    if (FASE === 'despues') {
      const cerrar = dialogo.locator('.dialog-header button');
      ok(`vitrina, fecha y hora ${celda}: «Cerrar» dice su nombre`, (await cerrar.innerText()).trim() === 'Cerrar');
      const textos = (await dialogo.locator('.nav-controls button').allInnerTexts()).map((t) => t.trim());
      ok(`vitrina, fecha y hora ${celda}: las flechas dicen Año, Mes, Mes, Año`, textos.join(',') === 'Año,Mes,Mes,Año', textos.join(','));
      ok(`vitrina, fecha y hora ${celda}: ningún botón queda de sólo ícono`, (await dialogo.locator('.btn--icon-only').count()) === 0);
      const renglones = await renglonesDeFlechas(dialogo);
      ok(`vitrina, fecha y hora ${celda}: las cuatro flechas van en un renglón`, renglones === 1, `${renglones} renglones`);
      ok(
        `vitrina, fecha y hora ${celda}: el panel no desborda a lo ancho`,
        await dialogo.locator('.date-picker-panel').evaluate((p) => p.scrollWidth <= p.clientWidth),
      );
    }
    await capturar(pagina, `vitrina-fecha-y-hora-${celda}`);
    await ctx.close();
  }
}

/**
 * Las comprobaciones del botón del mapa que quita la ubicación o, sin punto
 * todavía, cierra el mapa. `nombreCompleto` en `null`: el nombre es el texto.
 */
async function comprobarQuitar(quitar, prefijo, texto, nombreCompleto) {
  if (FASE !== 'despues') return;
  ok(`${prefijo}: el botón dice «${texto}»`, (await quitar.innerText()).trim() === texto);
  ok(`${prefijo}: lleva su ícono`, (await quitar.locator('svg').count()) === 1);
  ok(`${prefijo}: ya no es botón de sólo ícono`, !(await quitar.getAttribute('class')).includes('btn--icon-only'));
  const nombre = await quitar.getAttribute('aria-label');
  ok(
    `${prefijo}: el nombre accesible empieza por el texto visible`,
    nombreCompleto === null ? nombre === null : nombre === nombreCompleto && nombre.startsWith(texto),
    nombre ?? 'el del texto',
  );
}

/**
 * Espera las teselas del plano: la primera y, después, que no quede ninguna a
 * medio bajar. Sin red el mapa se dibuja igual, así que no espera para siempre.
 */
async function teselas(mapa) {
  await mapa.locator('.leaflet-tile-loaded').first().waitFor({ timeout: 20_000 }).catch(() => {});
  await mapa
    .page()
    .waitForFunction(
      (el) => el.querySelectorAll('img.leaflet-tile:not(.leaflet-tile-loaded)').length === 0,
      await mapa.elementHandle(),
      { timeout: 15_000 },
    )
    .catch(() => {});
}

/** Toca el plano un poco al costado del centro: pone o corre el pin. */
async function tocarElMapa(pagina, mapa) {
  await mapa.scrollIntoViewIfNeeded();
  const caja = await mapa.boundingBox();
  await pagina.mouse.click(caja.x + caja.width / 2 - 40, caja.y + caja.height / 2 - 20);
}

/**
 * El mapa compartido, en el editor del paciente (Contacto › domicilio): con el
 * punto ya guardado y después de correr el pin, que es el estado de tres
 * botones.
 */
async function quitarLaUbicacion() {
  for (const { ancho, alto, tema } of CELDAS_REDUCIDAS) {
    const { ctx, pagina } = await contexto({ viewport: { width: ancho, height: alto }, colorScheme: tema });
    const celda = `${ancho}-claro`;
    await entrar(pagina, 'paciente@alovida.mock');
    await pagina.goto(`${BASE}/my-account`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await pagina.getByTestId('mi-perfil-editar').waitFor({ timeout: 30_000 });
    await pagina.getByTestId('mi-perfil-editar').click();
    await pagina.getByTestId('mi-perfil-editor').waitFor({ timeout: 30_000 });
    await pagina.getByTestId('perfil-pestanas').getByRole('tab').nth(1).click();
    const mapa = pagina.getByTestId('perfil-domicilio-mapa');
    const marcar = pagina.getByTestId('perfil-domicilio-marcar');
    await mapa.or(marcar).first().waitFor({ timeout: 15_000 });
    if ((await mapa.count()) === 0) await marcar.click();
    await mapa.waitFor({ timeout: 15_000 });
    await teselas(mapa);
    const quitar = pagina.getByTestId('perfil-domicilio-quitar-gps');
    const nombre = 'Quitar la ubicación de tu casa';
    await quitar.waitFor({ timeout: 15_000 });
    await comprobarQuitar(quitar, `mapa del editor, punto guardado ${celda}`, "Quitar la ubicación", nombre);
    await quitar.evaluate((b) => b.scrollIntoView({ block: 'center' }));
    await capturar(pagina, `mapa-quitar-${celda}`);

    await tocarElMapa(pagina, mapa);
    await pagina.getByTestId('perfil-domicilio-confirmar').waitFor({ timeout: 15_000 });
    await teselas(mapa);
    await comprobarQuitar(quitar, `mapa del editor, sin confirmar ${celda}`, "Quitar la ubicación", nombre);
    await quitar.evaluate((b) => b.scrollIntoView({ block: 'center' }));
    await capturar(pagina, `mapa-sin-confirmar-${celda}`);

    // El trabajo no tiene punto guardado: su mapa abre vacío y el botón sólo lo cierra.
    await pagina.getByTestId('perfil-trabajo-marcar').click();
    const mapaTrabajo = pagina.getByTestId('perfil-trabajo-mapa');
    await mapaTrabajo.waitFor({ timeout: 15_000 });
    await teselas(mapaTrabajo);
    const cerrar = pagina.getByTestId('perfil-trabajo-quitar-gps');
    await cerrar.waitFor({ timeout: 15_000 });
    await comprobarQuitar(cerrar, `mapa del editor, sin punto ${celda}`, 'Cerrar el mapa', null);
    await cerrar.evaluate((b) => b.scrollIntoView({ block: 'center' }));
    await capturar(pagina, `mapa-sin-punto-${celda}`);
    await ctx.close();
  }
}

/**
 * La copia del mapa que tiene el alta del paciente («¿Dónde vivís?»), en sus
 * tres estados. Se salta directo a esa página del formulario por páginas: las
 * anteriores no cambian nada acá.
 */
async function quitarEnElAltaDelPaciente() {
  for (const { ancho, alto, tema } of CELDAS_REDUCIDAS) {
    const { ctx, pagina } = await contexto({ viewport: { width: ancho, height: alto }, colorScheme: tema });
    const celda = `${ancho}-claro`;
    await pagina.goto(`${BASE}/auth/register/patient`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await pagina.getByTestId('registro-form-paciente').waitFor({ timeout: 90_000 });
    await pagina.waitForFunction(() => {
      const forma = document.querySelector('app-paginated-form');
      return Boolean(forma && window.ng?.getComponent(forma));
    });
    await pagina.evaluate(() => {
      const motor = window.ng.getComponent(document.querySelector('app-paginated-form'));
      motor.indice.set(motor.paginas().findIndex((p) => p.clave === 'residence'));
    });
    const mapa = pagina.getByTestId('registro-mapa-domicilio');
    await pagina.getByTestId('registration-home-location-pick').click();
    await mapa.waitFor({ timeout: 15_000 });
    await teselas(mapa);
    const quitar = pagina.getByTestId('registration-home-location-remove');
    const nombre = 'Quitar la ubicación de tu domicilio';

    await quitar.waitFor({ timeout: 15_000 });
    await comprobarQuitar(quitar, `alta del paciente, sin punto ${celda}`, "Cerrar el mapa", "Cerrar el mapa de tu domicilio");
    await quitar.evaluate((b) => b.scrollIntoView({ block: 'center' }));
    await capturar(pagina, `alta-mapa-sin-punto-${celda}`);

    await tocarElMapa(pagina, mapa);
    const confirmar = pagina.getByTestId('registro-confirmar-direccion');
    await confirmar.waitFor({ timeout: 15_000 });
    await teselas(mapa);
    await comprobarQuitar(quitar, `alta del paciente, sin confirmar ${celda}`, "Quitar la ubicación", nombre);
    await quitar.evaluate((b) => b.scrollIntoView({ block: 'center' }));
    await capturar(pagina, `alta-mapa-sin-confirmar-${celda}`);

    await confirmar.click();
    await pagina.getByTestId('registro-direccion-confirmada').waitFor({ state: 'attached', timeout: 15_000 });
    await comprobarQuitar(quitar, `alta del paciente, confirmada ${celda}`, "Quitar la ubicación", nombre);
    await quitar.evaluate((b) => b.scrollIntoView({ block: 'center' }));
    await capturar(pagina, `alta-mapa-confirmada-${celda}`);
    await ctx.close();
  }
}

/* ─────────────────────────────── recorrido ─────────────────────────────── */
mkdirSync(SALIDA, { recursive: true });
if (FASE === 'despues' && !(existsSync(DOM_ANTES) && existsSync(DESBORDE_ANTES))) {
  process.stderr.write(`Falta la pasada «antes» (${DOM_ANTES}, ${DESBORDE_ANTES}).\n`);
  process.exit(2);
}
navegador = await chromium.launch();
try {
  await consumidores();
  await editarEnMiPerfil();
  await calendario();
  await calendarioEnLaVitrina();
  await quitarLaUbicacion();
  await quitarEnElAltaDelPaciente();
  ok(
    `sin errores de página ni de consola — avisos de CSP por scripts en línea, excluidos: ${cspExcluidos}`,
    problemas.filter((p) => !/^\d{3} /.test(p)).length === 0,
    problemas.filter((p) => !/^\d{3} /.test(p)).join(' | '),
  );
  ok('sin respuestas 4xx/5xx', problemas.filter((p) => /^\d{3} /.test(p)).length === 0, problemas.filter((p) => /^\d{3} /.test(p)).join(' | '));
} catch (error) {
  const diagnostico = `${tmpdir()}/d05-iconos-fallo.png`;
  await paginaActual?.screenshot({ path: diagnostico, fullPage: true }).catch(() => {});
  process.stdout.write(`✘ el recorrido se cortó: ${error.message}\n  captura de diagnóstico: ${diagnostico}\n`);
  veredictos.push({ nombre: 'recorrido completo', cond: false });
} finally {
  await cerrarNavegador();
}

const verdes = veredictos.filter((v) => v.cond).length;
process.stdout.write(`\n${verdes}/${veredictos.length} comprobaciones en verde (${FASE})\n`);
process.exit(verdes === veredictos.length ? 0 : 1);
