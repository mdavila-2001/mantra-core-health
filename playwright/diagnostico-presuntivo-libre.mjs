/**
 * Evidencia de navegador (simulador) del pedido del cliente del 30/10/2026:
 *
 *  1. El doctor emite sin formulario médico (orden de análisis, receta,
 *     reconsulta y plan de cuidados ya no exigen una respuesta de formulario).
 *  2. Desde «Diagnóstico» el doctor registra un diagnóstico PRESUNTIVO con
 *     motivos «campo: valor» escritos ahí mismo, o partiendo de un formulario
 *     médico ya llenado — sin quitar la tabla ni sus Confirmar/Rechazar.
 *
 * Recorrido de las mutaciones: UI → request → response → persistencia →
 * recarga → UI. El simulador contesta DENTRO de Angular, así que las peticiones
 * se leen de `window.__mockRequests` (no hay tráfico de red que Playwright vea).
 *
 * Los fallos (nota que falla, 409) se provocan con `sessionStorage['mock:fallos']`,
 * el mecanismo del propio simulador: están etiquetados como inyectados.
 *
 * Requiere el servidor con el simulador:
 *   corepack yarn ng serve --configuration development,demo --port 4333
 * Uso: `node playwright/diagnostico-presuntivo-libre.mjs`
 * Nunca espera `networkidle`: con HMR no llega y da verdes falsos.
 */
import { mkdirSync, writeFileSync } from 'node:fs';

import { chromium } from 'playwright';

const BASE = process.env.PW_BASE_URL ?? 'http://127.0.0.1:4333';
const SALIDA =
  process.env.SALIDA ??
  'docs/trabajo/2026-10-30-doctor-practico-diagnostico-presuntivo/evidencia/navegador';
mkdirSync(SALIDA, { recursive: true });

const VIEWPORTS = [
  { nombre: 'movil', width: 390, height: 844 },
  { nombre: 'tablet', width: 820, height: 1180 },
  { nombre: 'escritorio', width: 1440, height: 1100 },
];
const TEMAS = ['light', 'dark'];

const veredictos = [];
const notas = [];
const problemas = [];
/** Errores de consola que ocurrieron mientras se INYECTABA un fallo a propósito. */
const esperados = [];
let inyectando = false;
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond), detalle });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

// El Playwright del repo puede pedir una build distinta de la instalada en la
// máquina: `PW_CHROMIUM=/ruta/al/chrome` la fuerza (con `--no-sandbox` en contenedores).
const navegador = await chromium.launch(
  process.env.PW_CHROMIUM === undefined
    ? {}
    : { executablePath: process.env.PW_CHROMIUM, args: ['--no-sandbox'] },
);
const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1100 } });
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
  if (m.type() !== 'error') return;
  const donde = m.location()?.url ? ` @ ${m.location().url}` : '';
  (inyectando ? esperados : problemas).push(`console.error: ${m.text()}${donde}`);
});

async function asentarse() {
  let anterior = '';
  let iguales = 0;
  for (let i = 0; i < 25; i += 1) {
    await page.waitForTimeout(250);
    const ahora = await page.evaluate(
      () =>
        `${document.querySelectorAll('app-card').length}:${document.body.scrollHeight}:${
          document.querySelectorAll('app-skeleton, app-spinner').length
        }`,
    );
    iguales = ahora === anterior ? iguales + 1 : 0;
    anterior = ahora;
    if (iguales >= 2 && ahora.endsWith(':0')) return;
  }
}

const peticiones = () => page.evaluate(() => window.__mockRequests ?? []);
const desde = async (indice, filtro) => (await peticiones()).slice(indice).filter(filtro);
const marca = async () => (await peticiones()).length;

async function fijarTema(tema) {
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), tema);
  await page.waitForTimeout(150);
}

/** Cuántos elementos del diálogo abierto sobresalen por la derecha: el desborde horizontal. */
async function desbordeDelDialogo() {
  return page.evaluate(() => {
    const dialogo = document.querySelector('dialog[open]');
    if (dialogo === null) return 0;
    const borde = dialogo.getBoundingClientRect().right;
    let fuera = 0;
    for (const el of dialogo.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.right > borde + 1) fuera += 1;
    }
    return fuera + (document.documentElement.scrollWidth > window.innerWidth + 1 ? 1 : 0);
  });
}

/**
 * Captura el diálogo abierto en los tres viewports y los dos temas.
 * Con `ver` (un `data-testid`) desplaza el diálogo hasta ese elemento antes de cada captura:
 * sin eso, en móvil lo que se quiere demostrar quedaba bajo el pliegue.
 * En cada viewport comprueba, además, que nada del diálogo se desborde hacia la derecha.
 */
async function matriz(nombre, ver) {
  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    for (const tema of TEMAS) {
      await fijarTema(tema);
      if (ver !== undefined) {
        await page.getByTestId(ver).first().scrollIntoViewIfNeeded().catch(() => undefined);
      }
      await page.waitForTimeout(250);
      if (tema === 'light') {
        const fuera = await desbordeDelDialogo();
        ok(`${nombre}: sin desborde horizontal en ${vp.nombre}`, fuera === 0, `${fuera} elementos fuera`);
      }
      await page.screenshot({ path: `${SALIDA}/${nombre}-${vp.nombre}-${tema}.png` });
    }
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await fijarTema('light');
}

async function una(nombre, vp = VIEWPORTS[2], tema = 'light') {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await fijarTema(tema);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SALIDA}/${nombre}-${vp.nombre}-${tema}.png` });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await fijarTema('light');
}

/** Escribe en un campo del sistema de diseño aunque el `data-testid` esté en el anfitrión. */
async function escribir(localizador, texto, etiqueta) {
  const el = localizador;
  const tag = await el.evaluate((e) => e.tagName);
  const destino = ['INPUT', 'TEXTAREA'].includes(tag) ? el : el.locator('input, textarea').first();
  await destino.fill(texto);
  notas.push(`escribió «${texto}» en ${etiqueta}`);
}

/** Abre un `app-select` y elige la opción que contiene el texto. */
async function elegir(combobox, texto, { buscar } = {}) {
  await combobox.click();
  const dialogo = page.locator('dialog[open]').last();
  if (buscar !== undefined) {
    const caja = dialogo.locator('input[placeholder="Buscar…"]');
    if ((await caja.count()) > 0) await caja.fill(buscar);
  }
  const opcion =
    texto === undefined
      ? dialogo.getByRole('option').first()
      : dialogo.getByRole('option', { name: texto }).first();
  await opcion.waitFor({ state: 'visible', timeout: 15_000 });
  const etiqueta = ((await opcion.innerText()) ?? '').replace(/\s+/g, ' ').trim();
  await opcion.click();
  return etiqueta;
}

async function login() {
  await page.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.getByTestId('login-identifier').fill('medica@alovida.mock');
  await page.getByTestId('login-password').fill('cualquiera');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(
    (u) => !u.pathname.startsWith('/auth') || u.pathname.includes('organization'),
    { timeout: 60_000 },
  );
  if (page.url().includes('/auth/organization')) {
    const opcion = page.getByTestId('tenant-opcion');
    if ((await opcion.count()) > 0) await opcion.first().click();
    else await page.getByRole('button').first().click();
    await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 60_000 });
  }
}

async function irALaConsulta() {
  // Misma puerta que el recorrido real: de la agenda del día a la primera cita atendible.
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
    // Sin citas atendibles hoy: por el archivo clínico, buscando al paciente sembrado
    // «Ana Lucía Pérez Quiroga» por su documento (5000000, ver `people.ts`).
    notas.push(`La agenda de hoy no tiene citas atendibles (${cuantas}): se entra por el archivo clínico.`);
    await page.goto(`${BASE}/medical-records`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await asentarse();
    await escribir(page.getByTestId('clinical-record-national-id'), '5000000', 'documento');
    await page.getByTestId('clinical-record-search-by-document').click();
    const enlace = page.locator('a[href*="/medical-records/"]').filter({ hasNot: page.locator('[href="/medical-records"]') });
    await page.waitForTimeout(1500);
    await asentarse();
    const href = await page
      .locator('a[href*="/medical-records/"]')
      .evaluateAll((as) =>
        as.map((a) => a.getAttribute('href') ?? '').find((h) => /\/medical-records\/[^/?#]+/.test(h)),
      );
    if (href === undefined) {
      await page.screenshot({ path: `${SALIDA}/ZZ-sin-paciente.png` });
      throw new Error('la búsqueda por documento no devolvió ningún paciente');
    }
    void enlace;
    const limpio = href.replace(/\/(consultation|request-access)?$/, '').split('?')[0];
    await page.goto(`${BASE}${limpio}/consultation`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  }
  await asentarse();
  const actual = new URL(page.url());
  const ruta = `${BASE}${actual.pathname}`;
  const expediente = `${BASE}${actual.pathname.replace(/\/consultation$/, '')}`;
  if ((await page.getByTestId('consulta-lo-registrado').count()) === 0) {
    const abrir = page.getByTestId('consulta-abrir-encuentro');
    if ((await abrir.count()) > 0) {
      await abrir.click();
      await page
        .getByTestId('consulta-lo-registrado')
        .waitFor({ state: 'visible', timeout: 30_000 });
      await asentarse();
    }
  }
  return { ruta: page.url(), expediente: expediente || ruta };
}

async function abrirCasilla(testId) {
  await page.getByTestId(testId).click();
  await page.locator('dialog[open]').first().waitFor({ state: 'visible', timeout: 15_000 });
  await asentarse();
}

async function cerrarModal() {
  // Con otro diálogo encima (p. ej. el de antiduplicación) el clic en «Cerrar» no llega:
  // se cae a `Escape`, que es lo que haría quien atiende.
  for (let intento = 0; intento < 4; intento += 1) {
    if ((await page.locator('dialog[open]').count()) === 0) return;
    const cerrar = page.locator('dialog[open]').last().getByRole('button', { name: /^(Cerrar|Cancelar)$/ });
    if ((await cerrar.count()) > 0) {
      await cerrar.first().click({ timeout: 2_500 }).catch(() => page.keyboard.press('Escape'));
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(450);
    const descartar = page.getByRole('button', { name: /^(Descartar|Sí, descartar|Cerrar sin guardar)$/ });
    if ((await descartar.count()) > 0) await descartar.first().click().catch(() => undefined);
    await page.waitForTimeout(300);
  }
}

try {
  await login();
  notas.push(`Sesión: medica@alovida.mock → ${page.url()}`);
  const { ruta, expediente } = await irALaConsulta();
  notas.push(`Consulta: ${ruta}`);
  await una('00-consulta-rejilla');

  /* ════════════════ H1 · emitir SIN formulario médico ════════════════ */

  // Orden de análisis: la que se puede completar de punta a punta en un par de pasos.
  await abrirCasilla('consulta-casilla-ordenes');
  const modal1 = page.locator('dialog[open]').first();
  ok(
    'H1 orden: sin formulario médico NO dice «Falta el formulario médico»',
    (await modal1.getByTestId('respuesta-falta').count()) === 0,
  );
  ok(
    'H1 orden: dice que se registra igual, sin formulario',
    (await modal1.getByTestId('respuesta-opcional-vacia').count()) === 1,
  );
  // Se prueba con estudios que la persona sembrada NO tiene recientes: la antiduplicación
  // del simulador (otro requisito, ya existente) abre su propio diálogo con los repetidos.
  let pedido = null;
  for (const candidato of ['Perfil lipidico', 'TSH por quimioluminiscencia', 'Creatinina sérica', 'Glucosa en sangre']) {
    const hito1 = await marca();
    const etiquetaEstudio = await elegir(modal1.getByRole('combobox').first(), candidato);
    notas.push(`Estudio elegido: «${etiquetaEstudio}»`);
    const pedir = modal1.getByRole('button', { name: /Pedir estudio/ });
    const habilitado = (await pedir.getAttribute('aria-disabled')) !== 'true';
    if (!habilitado) {
      notas.push(`«${etiquetaEstudio}» pide algo más que el formulario (otro requisito): se prueba otro.`);
      continue;
    }
    ok('H1 orden: «Pedir estudio» queda HABILITADO sin formulario médico', true, etiquetaEstudio);
    await una('01-orden-sin-formulario');
    await pedir.click();
    await page.waitForTimeout(1500);
    const repetido = await page.getByRole('heading', { name: /Ya hay un/ }).count();
    if (repetido > 0) {
      notas.push(`«${etiquetaEstudio}» ya estaba pedido: abrió la antiduplicación (requisito existente); se prueba otro.`);
      await page.getByRole('button', { name: 'Cancelar' }).last().click().catch(() => undefined);
      await page.waitForTimeout(400);
      continue;
    }
    pedido = { hito: hito1, etiqueta: etiquetaEstudio };
    break;
  }
  if (pedido !== null) {
    const posts = await desde(pedido.hito, (p) => p.method === 'POST' && p.url === '/clinical/service-requests');
    ok('H1 orden: salió UN POST /clinical/service-requests', posts.length === 1, JSON.stringify(posts[0]?.body));
    const cuerpo = posts[0]?.body ?? {};
    ok(
      'H1 orden: el cuerpo NO lleva formInstanceId ni basedOnNoteIds',
      !('formInstanceId' in cuerpo) && !('basedOnNoteIds' in cuerpo),
    );
    ok('H1 orden: el servidor aceptó (2xx)', posts[0] !== undefined && posts[0].status < 300, String(posts[0]?.status));
    await page.waitForTimeout(800);
    ok(
      'H1 orden: con todo guardado el anfitrión relee y cierra el modal',
      (await page.locator('dialog[open]').count()) === 0,
    );
    await abrirCasilla('consulta-casilla-ordenes');
    const lista = page.locator('dialog[open]').first().getByTestId('estudios-lista');
    await lista.waitFor({ state: 'visible', timeout: 15_000 }).catch(() => undefined);
    const nombreCorto = pedido.etiqueta.split(' ').slice(0, 2).join(' ');
    ok(
      'H1 orden: al reabrir, «Estudios pedidos» muestra el estudio (relectura)',
      new RegExp(nombreCorto, 'i').test((await lista.innerText().catch(() => '')) ?? ''),
      nombreCorto,
    );
    await una('02-orden-pedida');
  } else {
    ok('H1 orden: se pudo pedir un estudio no repetido', false, 'todos los candidatos abrieron la antiduplicación');
  }
  await cerrarModal();

  // Receta, reconsulta y plan: ya no exigen la respuesta.
  for (const [testId, nombre] of [
    ['consulta-casilla-medicacion', 'receta'],
    ['consulta-casilla-reconsulta', 'reconsulta'],
    ['consulta-casilla-planes', 'plan de cuidados'],
  ]) {
    await abrirCasilla(testId);
    const m = page.locator('dialog[open]').first();
    ok(
      `H1 ${nombre}: NO dice «Falta el formulario médico»`,
      (await m.getByTestId('respuesta-falta').count()) === 0,
    );
    ok(
      `H1 ${nombre}: ofrece el formulario como opcional`,
      (await m.getByTestId('respuesta-opcional-vacia').count()) +
        (await m.getByTestId('respuesta-del-formulario').count()) >=
        1,
    );
    if (nombre === 'receta') await una('03-receta-opcional');
    await cerrarModal();
  }

  /* ════════════════ H2 · diagnóstico presuntivo sin formulario ════════════════ */

  await abrirCasilla('consulta-casilla-diagnosticos');
  const alta = page.getByTestId('diagnostico-alta');
  ok('H2 el bloque ofrece el alta del presuntivo', (await alta.count()) === 1);
  ok('H2 la tabla de presuntivos sigue ahí', (await page.getByTestId('diagnostico-tabla').count()) === 1);
  const botonRegistro = alta.locator('app-form-actions button[type="submit"]');
  ok(
    'H2 sin diagnóstico elegido el botón está bloqueado',
    (await botonRegistro.getAttribute('aria-disabled')) === 'true',
  );
  await matriz('10-diagnostico-vacio');
  await matriz('10b-diagnostico-tabla', 'diagnostico-tabla');

  const dx = await elegir(alta.getByRole('combobox').first(), undefined, { buscar: 'Hiperten' });
  notas.push(`Diagnóstico elegido: «${dx}»`);
  for (const [campo, valor] of [
    ['Fiebre', '39 °C desde hace dos días'],
    ['Tos', 'Productiva, con dolor al respirar'],
  ]) {
    await alta.getByTestId('adicional-agregar-fila').click();
    await escribir(alta.getByTestId('adicional-rotulo').last(), campo, 'campo');
    await escribir(alta.getByTestId('adicional-valor').last(), valor, 'valor');
  }
  await escribir(alta.getByTestId('diagnostico-hallazgos'), 'Cuadro febril con tos de dos días.', 'hallazgos');
  await asentarse();
  ok(
    'H2 con diagnóstico y filas el botón se habilita',
    (await botonRegistro.getAttribute('aria-disabled')) !== 'true',
  );
  await matriz('11-diagnostico-lleno');

  const hito2 = await marca();
  await botonRegistro.click();
  await page.waitForTimeout(1500);
  const busq = await desde(hito2, (p) => p.method === 'GET' && p.url.includes('COND_PROVISIONAL'));
  ok('H2 resolvió el concepto presuntivo por código en el catálogo', busq.length >= 1);
  const altas = await desde(hito2, (p) => p.method === 'POST' && p.url === '/clinical/conditions');
  ok('H2 salió UN POST /clinical/conditions', altas.length === 1, JSON.stringify(altas[0]?.body));
  const cuerpoAlta = altas[0]?.body ?? {};
  ok(
    'H2 el cuerpo lleva verificationStatusConceptId y NO la palabra PROVISIONAL',
    typeof cuerpoAlta.verificationStatusConceptId === 'string' && !('verificationStatus' in cuerpoAlta),
  );
  ok('H2 el cuerpo lleva el resumen en noteText', /Motivos: Fiebre: 39/.test(cuerpoAlta.noteText ?? ''));
  const notasPost = await desde(hito2, (p) => p.method === 'POST' && p.url.includes('/charts/notes'));
  ok('H2 salió UN POST /charts/notes con las filas', notasPost.length === 1);
  ok(
    'H2 la nota lleva las dos filas estructuradas (entries)',
    JSON.stringify(notasPost[0]?.body?.entries ?? []) ===
      JSON.stringify([
        { label: 'Fiebre', value: '39 °C desde hace dos días' },
        { label: 'Tos', value: 'Productiva, con dolor al respirar' },
      ]),
    JSON.stringify(notasPost[0]?.body?.entries),
  );
  ok('H2 el servidor aceptó el diagnóstico (2xx)', altas[0] !== undefined && altas[0].status < 300);
  await page.waitForTimeout(800);
  ok(
    'H2 con todo guardado el anfitrión relee y cierra el modal (como con cualquier alta de la consulta)',
    (await page.locator('dialog[open]').count()) === 0,
  );
  await una('12-tras-registrar-consulta');

  // Persistencia + recarga + UI: se vuelve a abrir «Diagnóstico» tras RECARGAR la página.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await asentarse();
  await abrirCasilla('consulta-casilla-diagnosticos');
  const tabla = page.getByTestId('diagnostico-tabla');
  const tras = await tabla.innerText();
  ok(
    'H2 tras RECARGAR la tabla muestra el diagnóstico nuevo «En estudio» con Confirmar y Rechazar',
    /En estudio/.test(tras) && (await tabla.locator('[data-testid^="diagnostico-confirmar-"]').count()) >= 1,
    'persistencia del simulador (sessionStorage)',
  );
  ok(
    'H2 el formulario reabre limpio y con el botón bloqueado',
    (await page
      .getByTestId('diagnostico-alta')
      .locator('app-form-actions button[type="submit"]')
      .getAttribute('aria-disabled')) === 'true',
  );
  await matriz('13-tras-recarga-tabla', 'diagnostico-tabla');
  await cerrarModal();

  /* ════════════════ H2 · fallo parcial de la nota (INYECTADO) ════════════════ */

  await abrirCasilla('consulta-casilla-diagnosticos');
  const alta2 = page.getByTestId('diagnostico-alta');
  inyectando = true;
  await page.evaluate(() =>
    sessionStorage.setItem(
      'mock:fallos',
      JSON.stringify([{ patron: '/charts/notes', modo: 'error', metodos: ['POST'] }]),
    ),
  );
  await elegir(alta2.getByRole('combobox').first(), undefined, { buscar: 'Diabet' });
  await alta2.getByTestId('adicional-agregar-fila').click();
  await escribir(alta2.getByTestId('adicional-rotulo').last(), 'Sed', 'campo');
  await escribir(alta2.getByTestId('adicional-valor').last(), 'Intensa desde hace una semana', 'valor');
  const hito3 = await marca();
  await alta2.locator('app-form-actions button[type="submit"]').click();
  await page.getByTestId('diagnostico-fallo-motivos').waitFor({ state: 'visible', timeout: 15_000 });
  const altas3 = await desde(hito3, (p) => p.method === 'POST' && p.url === '/clinical/conditions');
  ok('H2 fallo parcial (inyectado): el diagnóstico SÍ se registró', altas3.length === 1 && altas3[0].status < 300);
  ok(
    'H2 fallo parcial: el modal NO se cierra (el anfitrión no recibió `cambio`)',
    (await page.locator('dialog[open]').count()) >= 1,
  );
  ok(
    'H2 fallo parcial: avisa que el diagnóstico quedó registrado y conserva las filas',
    /quedó registrado/.test(await alta2.getByTestId('diagnostico-fallo-motivos').innerText()) &&
      (await alta2.getByTestId('adicional-fila').count()) === 1,
  );
  await matriz('14a-fallo-parcial-alerta', 'diagnostico-fallo-motivos');
  await matriz('14b-fallo-parcial-reintento', 'diagnostico-dejar-sin-guardar');

  // Reintento: se apaga el fallo; sólo debe repetirse la nota, nunca el diagnóstico.
  inyectando = false;
  await page.evaluate(() => sessionStorage.removeItem('mock:fallos'));
  const hito4 = await marca();
  await page.waitForTimeout(500);
  await alta2.locator('app-form-actions button[type="submit"]').click();
  await page.waitForTimeout(1500);
  const altas4 = await desde(hito4, (p) => p.method === 'POST' && p.url === '/clinical/conditions');
  const notas4 = await desde(hito4, (p) => p.method === 'POST' && p.url.includes('/charts/notes'));
  ok('H2 reintento: NO vuelve a crear el diagnóstico (0 POST /clinical/conditions)', altas4.length === 0);
  ok('H2 reintento: repite sólo la nota (1 POST /charts/notes, 2xx)', notas4.length === 1 && notas4[0].status < 300);
  ok(
    'H2 reintento: con todo guardado el modal se cierra y no queda el aviso',
    (await page.locator('dialog[open]').count()) === 0 &&
      (await page.getByTestId('diagnostico-fallo-motivos').count()) === 0,
  );

  /* ════════════════ H2 · 409 «ya lo tiene» (INYECTADO) ════════════════ */

  await abrirCasilla('consulta-casilla-diagnosticos');
  const alta409 = page.getByTestId('diagnostico-alta');
  inyectando = true;
  await page.evaluate(() =>
    sessionStorage.setItem(
      'mock:fallos',
      JSON.stringify([{ patron: '/clinical/conditions', modo: 'conflict', metodos: ['POST'] }]),
    ),
  );
  await elegir(alta409.getByRole('combobox').first(), undefined, { buscar: 'Hiperten' });
  await alta409.locator('app-form-actions button[type="submit"]').click();
  await page.waitForTimeout(1200);
  const textoAlta = await alta409.innerText();
  ok(
    'H2 409 (inyectado): el aviso queda EN el campo del diagnóstico',
    /ya tiene este diagnóstico activo o en estudio/.test(textoAlta),
  );
  await una('15-conflicto-409');
  await una('15-conflicto-409', VIEWPORTS[0], 'dark');
  inyectando = false;
  await page.evaluate(() => sessionStorage.removeItem('mock:fallos'));
  await cerrarModal();

  /* ════════════════ H2 · desde un formulario médico ya llenado ════════════════ */

  await abrirCasilla('consulta-casilla-formulario');
  const bloqueForm = page.locator('app-specialty-form-block').first();
  await bloqueForm.waitFor({ state: 'visible', timeout: 15_000 });
  await asentarse();
  const plantilla = await elegir(bloqueForm.getByRole('combobox').first(), /anamnesis/i).catch(
    () => null,
  );
  notas.push(`Plantilla elegida: «${plantilla}»`);
  if (plantilla !== null) {
    await asentarse();
    const campos = bloqueForm.getByTestId('campo-especialidad');
    const n = await campos.count();
    for (let i = 0; i < n; i += 1) {
      const campo = campos.nth(i);
      const texto = campo.locator('input:not([type="number"]):not([type="checkbox"]), textarea');
      if ((await texto.count()) > 0) {
        // Un valor DISTINTO por campo, que nombre su pregunta: así se ve si cada respuesta
        // llega a su fila y no a otra.
        const nombre = ((await campo.locator('label').first().innerText().catch(() => '')) ?? '')
          .replace(/\s+/g, ' ')
          .replace(/\s*\*?\s*\(?obligatorio\)?\s*$/i, '')
          .trim();
        await texto.first().fill(`Respuesta de «${nombre || `campo ${i}`}»`).catch(() => undefined);
      }
    }
    // Los obligatorios, uno por uno, hasta que «Completar formulario» se habilite.
    const obligatorios = bloqueForm.getByTestId('campo-especialidad').filter({ hasText: /obligatorio/i });
    const cuantos = await obligatorios.count();
    for (let i = 0; i < cuantos; i += 1) {
      const campo = obligatorios.nth(i);
      const numero = campo.locator('input[type="number"]');
      const texto = campo.locator('input:not([type="number"]):not([type="checkbox"]), textarea');
      const siNo = campo.locator('app-segmented-control button');
      if ((await siNo.count()) > 0) await siNo.first().click().catch(() => undefined);
      else if ((await numero.count()) > 0) await numero.first().fill('1').catch(() => undefined);
      else if ((await texto.count()) > 0) {
        const actual = await texto.first().inputValue().catch(() => '');
        if (actual === '') await texto.first().fill('sin datos relevantes').catch(() => undefined);
      }
    }
    notas.push(`Campos del formulario: ${n} · obligatorios completados: ${cuantos}`);
    await page.waitForTimeout(1500);
    const completar = bloqueForm.getByRole('button', { name: /Completar/ });
    const hito5 = await marca();
    if ((await completar.count()) > 0 && (await completar.first().getAttribute('aria-disabled')) !== 'true') {
      await completar.first().click();
      await page.waitForTimeout(2500);
      const cerradas = await desde(hito5, (p) => p.method === 'POST' && /forms\/instances\/.+\/close/.test(p.url));
      ok('H2 el formulario médico se completó (POST …/close)', cerradas.length === 1);
    } else {
      ok('H2 el formulario médico se completó (POST …/close)', false, 'el botón Completar no quedó habilitado');
    }
  } else {
    ok('H2 el formulario médico se completó (POST …/close)', false, 'no se pudo elegir la plantilla');
  }
  await cerrarModal();

  await abrirCasilla('consulta-casilla-diagnosticos');
  const alta3 = page.getByTestId('diagnostico-alta');
  const selForm = alta3.getByTestId('diagnostico-formulario');
  ok('H2 con un formulario llenado el diagnóstico ofrece traerlo', (await selForm.count()) === 1);
  if ((await selForm.count()) === 1) {
    const hito6 = await marca();
    const elegido = await elegir(selForm.getByRole('combobox').first(), /Formulario médico/);
    notas.push(`Formulario elegido: «${elegido}»`);
    await page.waitForTimeout(1200);
    const filasTraidas = await alta3.getByTestId('adicional-fila').count();
    ok('H2 las respuestas del formulario aparecen como filas editables', filasTraidas >= 1, `${filasTraidas} filas`);
    ok(
      'H2 dice qué se trajo',
      (await alta3.getByTestId('diagnostico-aviso-importacion').count()) === 1,
      (await alta3.getByTestId('diagnostico-aviso-importacion').innerText().catch(() => '')) ?? '',
    );
    // Cada fila trae SU respuesta: el valor nombra la pregunta de su propio campo.
    const mapeo = await alta3.getByTestId('adicional-fila').evaluateAll((filas) =>
      filas.map((fila) => {
        const leer = (id) => {
          const el = fila.querySelector(`[data-testid="${id}"]`);
          if (el === null) return '';
          return el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
            ? el.value
            : (el.querySelector('input, textarea')?.value ?? '');
        };
        return { campo: leer('adicional-rotulo'), valor: leer('adicional-valor') };
      }),
    );
    const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const cruzadas = mapeo.filter(
      (m) => m.valor.startsWith('Respuesta de') && !norm(m.valor).includes(norm(m.campo).slice(0, 12)),
    );
    ok(
      'H2 cada fila traída lleva la respuesta de SU campo (valores distintos por campo)',
      mapeo.length >= 1 && cruzadas.length === 0 && new Set(mapeo.map((m) => m.valor)).size === mapeo.length,
      `${mapeo.length} filas · cruzadas: ${cruzadas.length} · ej.: ${JSON.stringify(mapeo[0])}`,
    );
    await matriz('16-desde-formulario-llenado');
    await elegir(alta3.getByRole('combobox').first(), undefined, { buscar: 'Infecci' });
    await alta3.locator('app-form-actions button[type="submit"]').click();
    await page.waitForTimeout(1800);
    const altas6 = await desde(hito6, (p) => p.method === 'POST' && p.url === '/clinical/conditions');
    ok(
      'H2 el diagnóstico queda vinculado al formulario de origen (noteText)',
      /Del formulario «/.test(altas6[0]?.body?.noteText ?? ''),
      altas6[0]?.body?.noteText?.slice(0, 120),
    );
    const notas6 = await desde(hito6, (p) => p.method === 'POST' && p.url.includes('/charts/notes'));
    ok('H2 la nota estructurada se crea con las filas del formulario', (notas6[0]?.body?.entries?.length ?? 0) >= 1);
  }
  await cerrarModal();

  /* ════════════════ Expediente: el alta también sirve desde ahí ════════════════ */

  await page.goto(expediente, { waitUntil: 'domcontentloaded' });
  await asentarse();
  const pestanaDx = page.getByRole('tab', { name: /Diagnósticos/ });
  await pestanaDx.first().waitFor({ state: 'visible', timeout: 30_000 }).catch(() => undefined);
  if ((await pestanaDx.count()) > 0) await pestanaDx.first().click();
  const nuevo = page.getByTestId('expediente-nuevo-diagnostico');
  // Se espera a que la pestaña dibuje su botón: contar al instante competía con la carga.
  await nuevo.first().waitFor({ state: 'visible', timeout: 30_000 }).catch(() => undefined);
  if ((await nuevo.count()) > 0) {
    await nuevo.first().click();
    await page.locator('dialog[open]').first().waitFor({ state: 'visible', timeout: 15_000 });
    await asentarse();
    ok('Expediente: «Nuevo diagnóstico» ofrece el alta del presuntivo', (await page.getByTestId('diagnostico-alta').count()) === 1);
    ok(
      'Expediente: sin encuentro no ofrece traer un formulario',
      (await page.getByTestId('diagnostico-formulario').count()) === 0,
    );
    await una('17-expediente-nuevo-diagnostico');
  } else {
    ok('Expediente: «Nuevo diagnóstico» ofrece el alta del presuntivo', false, 'no se encontró el botón de alta');
  }
} catch (error) {
  problemas.push(`FALLÓ EL GUION: ${error?.stack ?? error}`);
  await page.screenshot({ path: `${SALIDA}/ZZ-fallo-del-guion.png` }).catch(() => undefined);
} finally {
  const fallidos = veredictos.filter((v) => !v.cond);
  const informe = [
    '# Resultado de la corrida de navegador (simulador)',
    '',
    `Base: ${BASE} · ${new Date().toISOString()}`,
    '',
    `**${veredictos.length - fallidos.length} / ${veredictos.length} comprobaciones en verde.**`,
    '',
    '## Comprobaciones',
    ...veredictos.map((v) => `- ${v.cond ? '✔' : '✘'} ${v.nombre}${v.detalle ? ` — ${v.detalle}` : ''}`),
    '',
    '## Notas',
    ...notas.map((n) => `- ${n}`),
    '',
    '## Consola y excepciones inesperadas',
    ...(problemas.length === 0 ? ['- ninguna'] : problemas.map((p) => `- ${p}`)),
    '',
    '## Errores de consola ESPERADOS (de un fallo inyectado a propósito)',
    ...(esperados.length === 0 ? ['- ninguno'] : esperados.map((p) => `- ${p}`)),
    '',
  ].join('\n');
  writeFileSync(`${SALIDA}/RESULTADO.md`, informe);
  process.stdout.write(`\n${informe}\n`);
  await navegador.close();
  process.exitCode = fallidos.length === 0 && problemas.every((p) => !p.startsWith('FALLÓ')) ? 0 : 1;
}
