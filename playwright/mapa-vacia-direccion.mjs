/**
 * Evidencia de D-06 y D-07 (pedido del cliente del 22/09/2026):
 *
 * - D-06: tocar el mapa deja el campo de dirección en blanco y lo dice junto
 *   al campo («Volvé a escribir la dirección para este punto»); volver a
 *   escribir se lleva el aviso. Se mira en el editor del paciente (las dos
 *   direcciones), en el alta del paciente (sus dos copias en línea) y en el
 *   alta de la aseguradora.
 * - D-07: al confirmar, «Listo, guardamos…» ya no se ve, pero sigue en el
 *   documento sólo para lectores de pantalla, con su identificador de prueba.
 * - Direcciones obligatorias (aseguradora y la central de laboratorio e
 *   imagenología): el vaciado que hace el mapa no pone el campo en rojo; lo
 *   marca que la persona lo toque o intente avanzar. Y el aviso va pegado al
 *   campo: ningún otro control queda entre los dos.
 *
 * Uso: `node playwright/mapa-vacia-direccion.mjs [urlBase] [sufijo] [recorridos] [ancho] [tema]`
 * — `recorridos` es una lista separada por comas de
 * `editor,alta,aseguradora,laboratorio,imagenologia` (por defecto, todos); `ancho` en px (por
 * defecto 1440) y `tema` `claro` u `oscuro` (por defecto claro) valen para las altas. Si algo
 * falla, deja una captura de diagnóstico en la carpeta temporal del sistema, no junto a la
 * evidencia.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4200';
const SUFIJO = process.argv[3] ?? 'despues';
const RECORRIDOS = new Set(
  (process.argv[4] ?? 'editor,alta,aseguradora,laboratorio,imagenologia').split(','),
);
const ANCHO = Number(process.argv[5] ?? 1440);
const TEMA = process.argv[6] ?? 'claro';
/** El alto de cada viewport del repo; un ancho que no está en la lista usa 1000. */
const ALTO_POR_ANCHO = { 1920: 1080, 1440: 900, 1024: 768, 768: 1024, 390: 844, 360: 800 };
const ALTO = ALTO_POR_ANCHO[ANCHO] ?? 1000;
/** Una celda de captura: el ancho y el tema de la corrida. */
const CELDA = `${ANCHO}-${TEMA}`;
const SALIDA = fileURLToPath(
  new URL('../docs/frontend/evidence/mapa-vacia-direccion-2026-09-23', import.meta.url),
);
const AVISO = 'Volvé a escribir la dirección para este punto';
/**
 * Exclusión deliberada: bajo el servidor de desarrollo la CSP queda sin hashes
 * y bloquea los scripts en línea en todas las rutas (ver
 * `src/server/security-headers.ts`). Se cuentan aparte; cualquier otro error
 * de consola sigue haciendo fallar el recorrido.
 */
const CSP_DEL_SERVIDOR_DE_DESARROLLO =
  "Executing inline script violates the following Content Security Policy directive 'script-src 'self'";

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

/** Centro del elemento, desplazado en píxeles. */
async function tocar(pagina, locator, dx = 0, dy = 0) {
  // El clic va por coordenadas: fuera de la ventana no llega al plano.
  await locator.scrollIntoViewIfNeeded();
  const caja = await locator.boundingBox();
  await pagina.mouse.click(caja.x + caja.width / 2 + dx, caja.y + caja.height / 2 + dy);
}

/**
 * Espera a que la vista quede quieta: fuentes listas, sin transiciones finitas
 * en curso (al cambiar de tema, algunas piezas todavía están pasando al otro
 * color) y dos cuadros más.
 */
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

async function capturar(pagina, nombre, { conTitulo = false } = {}) {
  // Arriba de todo: con la página desplazada, la cabecera y el menú fijos se
  // pintan a mitad de la captura de página completa.
  await pagina.evaluate(() => window.scrollTo(0, 0));
  // En escritorio la tarjeta se desplaza por dentro y la captura es la ventana:
  // con `conTitulo`, el título del paso queda arriba, a la vista. Cuando se
  // desplaza la página entera, la captura ya la trae completa y no se toca.
  if (conTitulo) {
    await pagina.locator('.paginated-form__titulo').evaluate((titulo) => {
      const pagina = document.scrollingElement;
      if (pagina.scrollHeight <= window.innerHeight + 1) titulo.scrollIntoView({ block: 'start' });
    });
  }
  // El menú lateral se abre al pasar el cursor: lo dejamos en el borde derecho.
  const { width, height } = pagina.viewportSize();
  await pagina.mouse.move(width - 4, Math.round(height / 2));
  // Las teselas del plano llegan de a una: sin esperarlas, la captura sale con huecos grises.
  await pagina
    .waitForFunction(
      () => document.querySelectorAll('img.leaflet-tile:not(.leaflet-tile-loaded)').length === 0,
      null,
      { timeout: 15_000 },
    )
    .catch(() => {});
  await pintada(pagina);
  await pagina.screenshot({ path: `${SALIDA}/${SUFIJO}-${nombre}.png`, fullPage: true });
}

/** Un elemento que está en el documento pero fuera de la vista (sólo lectores). */
async function soloParaLectores(locator) {
  if ((await locator.count()) !== 1) return false;
  const caja = await locator.boundingBox();
  return caja !== null && caja.width <= 1 && caja.height <= 1;
}

/**
 * Ningún texto con la frase se pinta a la vista: cada nodo que la contiene vive
 * en una caja de 1×1 o menos. (`innerText` no sirve: incluye lo recortado.)
 */
async function fraseSoloParaLectores(pagina, frase) {
  return pagina.evaluate((buscada) => {
    const cajas = [];
    const recorrido = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let nodo = recorrido.nextNode(); nodo; nodo = recorrido.nextNode()) {
      if (!nodo.textContent.includes(buscada)) continue;
      const rect = nodo.parentElement.getBoundingClientRect();
      cajas.push(rect.width <= 1 && rect.height <= 1);
    }
    return cajas.length > 0 && cajas.every(Boolean);
  }, frase);
}

/** El campo está marcado en error: borde (`aria-invalid`) o mensaje bajo el campo. */
async function enRojo(campo) {
  return campo.evaluate(
    (el) =>
      el.getAttribute('aria-invalid') === 'true' ||
      el.closest('app-form-field')?.querySelector('.form-field-error') != null,
  );
}

/**
 * Qué hay entre el campo y su aviso: cuántos controles visibles quedan en medio,
 * en el orden del documento, y cuántos píxeles separan el pie del campo del
 * aviso.
 */
async function entreElCampoYElAviso(campo, aviso) {
  return campo.evaluate((el, avisoEl) => {
    const siguiendo = (a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    const enMedio = [
      ...document.querySelectorAll('input:not([type="hidden"]):not([type="file"]), select, textarea'),
    ].filter((otro) => otro.getClientRects().length > 0 && siguiendo(el, otro) && siguiendo(otro, avisoEl));
    const pie = (el.closest('app-form-field') ?? el).getBoundingClientRect().bottom;
    return { controles: enMedio.length, px: Math.round(avisoEl.getBoundingClientRect().top - pie) };
  }, await aviso.elementHandle());
}

/**
 * El recorrido D-06/D-07 sobre un campo de dirección y su mapa.
 *
 * @param campo  - locator del `<input>` de la dirección.
 * @param ids    - { marcar, mapa, aviso, confirmar, confirmada, obligatoria? } — `obligatoria`
 *   es el texto de su error: suma las comprobaciones del rojo y del aviso pegado al campo.
 * @param escribir - cómo escribir en el campo (el editor y el alta difieren en el `input`).
 */
async function recorrer(pagina, prefijo, campo, ids, escribir) {
  // Textos distintos de los ejemplos de los campos: en la captura, un campo
  // vacío muestra su ejemplo en gris y no se tiene que confundir con lo escrito.
  await escribir('Calle Warnes #350');
  ok(`${prefijo}: la dirección está escrita`, (await campo.inputValue()) !== '');
  ok(`${prefijo}: sin tocar el mapa no hay aviso`, (await pagina.getByTestId(ids.aviso).count()) === 0);

  // Con un punto ya guardado el mapa abre desplegado y no hay botón «Marcar».
  const mapa = pagina.getByTestId(ids.mapa);
  const marcar = pagina.getByTestId(ids.marcar);
  await mapa.or(marcar).first().waitFor({ timeout: 15_000 });
  if ((await mapa.count()) === 0) await marcar.click();
  await mapa.waitFor({ timeout: 15_000 });
  await mapa.locator('.leaflet-tile-loaded').first().waitFor({ timeout: 20_000 }).catch(() => {});
  await tocar(pagina, mapa, -40, -20);
  await pagina.getByTestId(ids.aviso).waitFor({ timeout: 10_000 }).catch(() => {});

  ok(`${prefijo}: tocar el mapa vacía la dirección`, (await campo.inputValue()) === '');
  const aviso = pagina.getByTestId(ids.aviso);
  ok(`${prefijo}: el aviso está junto al campo`, (await aviso.count()) === 1 && (await aviso.innerText()).includes(AVISO));
  ok(`${prefijo}: el aviso es una región viva, sin robar el foco`, (await aviso.getAttribute('aria-live')) === 'polite');
  if (ids.obligatoria) {
    ok(`${prefijo}: el vaciado no pone el campo en rojo`, !(await enRojo(campo)));
    const entre = await entreElCampoYElAviso(campo, aviso);
    ok(
      `${prefijo}: el aviso va pegado al campo, sin otro control en medio`,
      entre.controles === 0,
      `${entre.controles} controles en medio, ${entre.px} px`,
    );
  }
  await capturar(pagina, `${prefijo}-1-vaciada-${CELDA}`, { conTitulo: Boolean(ids.obligatoria) });

  // D-07: confirmar no muestra «Listo, guardamos…», pero el lector lo recibe.
  await pagina.getByTestId(ids.confirmar).click();
  const confirmada = pagina.getByTestId(ids.confirmada);
  await confirmada.waitFor({ state: 'attached', timeout: 10_000 });
  ok(`${prefijo}: la confirmación no se ve`, await soloParaLectores(confirmada));
  ok(
    `${prefijo}: pero está para el lector, con su anuncio`,
    (await confirmada.getAttribute('aria-live')) !== null &&
      (await confirmada.textContent()).includes('Listo, guardamos'),
  );
  ok(
    `${prefijo}: «Listo, guardamos» no se pinta en ningún lugar de la vista`,
    await fraseSoloParaLectores(pagina, 'Listo, guardamos'),
  );
  if (ids.obligatoria) {
    ok(`${prefijo}: confirmar el punto tampoco lo pone en rojo`, !(await enRojo(campo)));
  }
  await capturar(pagina, `${prefijo}-2-confirmada-${CELDA}`, { conTitulo: Boolean(ids.obligatoria) });

  // Volver a escribir se lleva el aviso.
  await escribir('Calle Sucre #88');
  await pagina.getByTestId(ids.aviso).waitFor({ state: 'detached', timeout: 5_000 }).catch(() => {});
  ok(`${prefijo}: volver a escribir se lleva el aviso`, (await pagina.getByTestId(ids.aviso).count()) === 0);

  // Y un segundo toque (mover el pin) vuelve a vaciar.
  await tocar(pagina, mapa, 60, 30);
  await pagina.getByTestId(ids.aviso).waitFor({ timeout: 10_000 }).catch(() => {});
  ok(`${prefijo}: mover el pin vuelve a vaciar`, (await campo.inputValue()) === '');
  if (!ids.obligatoria) return;

  // Lo escrito se había dejado (tocado); el vaciado del mapa no lo pone en rojo.
  ok(`${prefijo}: tampoco en rojo tras escribir y volver a tocar el mapa`, !(await enRojo(campo)));

  // Tocarlo sí: entrar y salir del campo vacío lo marca, con el aviso al lado.
  await campo.focus();
  await campo.blur();
  const error = pagina.getByText(ids.obligatoria);
  await error.waitFor({ timeout: 5_000 }).catch(() => {});
  ok(`${prefijo}: entrar y salir del campo vacío lo marca`, await enRojo(campo));
  ok(`${prefijo}: con su mensaje`, (await error.count()) === 1);
  ok(`${prefijo}: y el aviso sigue a su lado`, (await pagina.getByTestId(ids.aviso).count()) === 1);
  await capturar(pagina, `${prefijo}-3-tocada-${CELDA}`, { conTitulo: true });

  // Intentar avanzar también: se reescribe, el mapa lo vacía sin rojo, y «Siguiente» lo marca.
  await escribir('Calle Sucre #88');
  await tocar(pagina, mapa, -60, 20);
  await pagina.getByTestId(ids.aviso).waitFor({ timeout: 10_000 }).catch(() => {});
  ok(`${prefijo}: un vaciado nuevo vuelve a dejarlo sin rojo`, !(await enRojo(campo)));
  const titulo = await pagina.locator('.paginated-form__titulo').innerText();
  await pagina.getByTestId('paginated-form-continuar').click();
  await error.waitFor({ timeout: 5_000 }).catch(() => {});
  // Lo que ve la persona justo después de pulsar «Siguiente», sin mover nada:
  // si el campo en rojo entra en la ventana y dónde quedó el foco. Se informa,
  // no se exige: lo decide el formulario por páginas, no esta pantalla.
  await pintada(pagina);
  const tras = await campo.evaluate((el) => {
    const caja = el.getBoundingClientRect();
    const foco = document.activeElement;
    return {
      aLaVista: caja.bottom > 0 && caja.top < window.innerHeight,
      foco: foco?.getAttribute('data-testid') ?? foco?.tagName.toLowerCase() ?? 'ninguno',
    };
  });
  process.stdout.write(
    `ℹ ${prefijo}: tras «Siguiente», el campo en rojo ${tras.aLaVista ? 'queda' : 'NO queda'} a la vista; el foco queda en ${tras.foco}\n`,
  );
  await pagina.screenshot({ path: `${SALIDA}/${SUFIJO}-${prefijo}-4b-tras-siguiente-${CELDA}.png` });
  ok(`${prefijo}: intentar avanzar lo marca`, await enRojo(campo));
  ok(
    `${prefijo}: y es el único rojo de la página`,
    (await pagina.locator('.form-field-error').count()) === 1,
  );
  ok(
    `${prefijo}: y no deja pasar de página`,
    (await pagina.locator('.paginated-form__titulo').innerText()) === titulo,
  );
  await capturar(pagina, `${prefijo}-4-al-avanzar-${CELDA}`, { conTitulo: true });
}

/* ───────────────────────── el editor del paciente ───────────────────────── */
async function editorDelPaciente(pagina) {
  await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.getByTestId('login-identifier').fill('paciente@alovida.mock');
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
  await pagina.goto(`${BASE}/my-account`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.getByTestId('mi-perfil-editar').waitFor({ timeout: 30_000 });
  await pagina.getByTestId('mi-perfil-editar').click();
  await pagina.getByTestId('mi-perfil-editor').waitFor({ timeout: 30_000 });
  await pagina.getByTestId('perfil-pestanas').getByRole('tab').nth(1).click();
  await pagina.getByTestId('perfil-domicilio').waitFor({ timeout: 15_000 });

  const domicilio = pagina.getByTestId('perfil-domicilio').locator('input');
  await recorrer(
    pagina,
    'editor-domicilio',
    domicilio,
    {
      marcar: 'perfil-domicilio-marcar',
      mapa: 'perfil-domicilio-mapa',
      aviso: 'perfil-domicilio-reescribir',
      confirmar: 'perfil-domicilio-confirmar',
      confirmada: 'perfil-domicilio-confirmada',
    },
    (texto) => domicilio.fill(texto),
  );
  // El trabajo no se enteró del mapa del domicilio.
  ok(
    'editor: el trabajo no tiene aviso',
    (await pagina.getByTestId('perfil-trabajo-reescribir').count()) === 0,
  );

  await pagina.emulateMedia({ colorScheme: 'dark' });
  await capturar(pagina, 'editor-domicilio-3-1440-oscuro');
  await pagina.emulateMedia({ colorScheme: 'light' });
  await pagina.setViewportSize({ width: 375, height: 812 });
  await pintada(pagina);
  ok(
    'editor 375: sin desborde horizontal',
    await pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );
  // A 375 la barra fija de acciones tapa el campo en la captura de página
  // completa: se captura la ventana con el campo al centro.
  await domicilio.evaluate((campo) => campo.scrollIntoView({ block: 'center' }));
  await pagina.mouse.move(371, 406);
  await pintada(pagina);
  await pagina.screenshot({ path: `${SALIDA}/${SUFIJO}-editor-domicilio-4-375-claro.png` });

  await pagina.setViewportSize({ width: 768, height: 1024 });
  await pintada(pagina);
  ok(
    'editor 768: sin desborde horizontal',
    await pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  );
  await domicilio.evaluate((campo) => campo.scrollIntoView({ block: 'center' }));
  await pagina.mouse.move(764, 512);
  await pintada(pagina);
  await pagina.screenshot({ path: `${SALIDA}/${SUFIJO}-editor-domicilio-5-768-claro.png` });
  await pagina.setViewportSize({ width: 1440, height: 1000 });
}

/* ───────────────────────── el alta del paciente ─────────────────────────── */
async function siguiente(pagina, testIdEsperado, rellenar = async () => {}) {
  for (let intento = 0; intento < 6; intento += 1) {
    await rellenar();
    await pagina.getByTestId('paginated-form-continuar').click();
    const llego = await pagina
      .getByTestId(testIdEsperado)
      .waitFor({ timeout: 4_000 })
      .then(() => true)
      .catch(() => false);
    if (llego) return;
  }
  throw new Error(`No apareció ${testIdEsperado} tras pulsar «Siguiente»`);
}

async function avanzarHasta(pagina, titulo) {
  const encabezado = pagina.getByRole('heading', { name: titulo });
  const boton = pagina.getByTestId('paginated-form-continuar');
  for (let paso = 0; paso < 8; paso += 1) {
    // Se espera al encabezado antes de cada clic: un clic de más sobre el paso
    // de destino dispara su validación y ensucia la captura.
    const llego = await encabezado
      .waitFor({ timeout: 1_500 })
      .then(() => true)
      .catch(() => false);
    if (llego) return;
    await boton.click();
  }
  if (!(await encabezado.isVisible())) throw new Error(`No se llegó a «${titulo}»`);
}

async function escribirFecha(pagina, ddmmaaaa) {
  const esperado = `${ddmmaaaa.slice(0, 2)}/${ddmmaaaa.slice(2, 4)}/${ddmmaaaa.slice(4)}`;
  const campo = pagina.getByPlaceholder('DD/MM/AAAA');
  for (let intento = 0; intento < 4; intento += 1) {
    await campo.click();
    await pagina.keyboard.press('Control+A');
    await pagina.keyboard.press('Backspace');
    await pagina.waitForTimeout(150);
    await campo.pressSequentially(ddmmaaaa, { delay: 120 });
    await pagina.waitForTimeout(250);
    if ((await campo.inputValue()) === esperado) return;
  }
  throw new Error(`La fecha quedó como «${await campo.inputValue()}»`);
}

async function altaDelPaciente(pagina) {
  await pagina.goto(`${BASE}/auth/register/patient`, { waitUntil: 'commit', timeout: 120_000 });
  await pagina.getByTestId('registro-form-paciente').waitFor({ timeout: 90_000 });
  await pagina.waitForTimeout(1_500);
  await siguiente(pagina, 'registro-documento', async () => {
    await pagina.getByTestId('registro-nombre').fill('Ana');
    await pagina.getByTestId('registro-apellido-paterno').fill('Paz');
  });
  await siguiente(pagina, 'registro-genero', async () => {
    await pagina.getByTestId('registro-documento').fill('9876543');
    await pagina.getByTestId('registro-departamento-ci').locator('select').selectOption({ index: 1 });
  });
  await siguiente(pagina, 'registro-telefono', async () => {
    await escribirFecha(pagina, '01011990');
    await pagina.getByTestId('registro-genero').locator('select').selectOption({ label: 'Masculino' });
  });
  await pagina.getByTestId('registro-telefono').fill('70012345');
  await pagina.getByTestId('paginated-form-continuar').click();
  await avanzarHasta(pagina, '¿Dónde vivís?');

  // En el alta el identificador lo lleva el `<input>` mismo (`app-input [testId]`).
  const campoCalle = pagina.getByTestId('registro-domicilio-calle');
  await recorrer(
    pagina,
    'alta-domicilio',
    campoCalle,
    {
      marcar: 'registration-home-location-pick',
      mapa: 'registro-mapa-domicilio',
      aviso: 'registro-domicilio-reescribir',
      confirmar: 'registro-confirmar-direccion',
      confirmada: 'registro-direccion-confirmada',
    },
    (texto) => campoCalle.fill(texto),
  );

  await pagina.emulateMedia({ colorScheme: 'dark' });
  await capturar(pagina, 'alta-domicilio-3-1440-oscuro');
  await pagina.emulateMedia({ colorScheme: 'light' });

  await pagina.getByTestId('registration-residence-mapa-SC').click();
  const municipio = pagina.getByTestId('registration-residence-municipio').locator('select');
  await municipio.waitFor();
  await municipio.selectOption({ index: 1 });
  await avanzarHasta(pagina, 'El lugar donde trabajás');

  const trabajo = pagina.getByTestId('registration-work-address');
  await recorrer(
    pagina,
    'alta-trabajo',
    trabajo,
    {
      marcar: 'registration-work-location-pick',
      mapa: 'registration-work-map',
      aviso: 'registration-work-address-reescribir',
      confirmar: 'registration-work-location-confirm',
      confirmada: 'registration-work-location-confirmed',
    },
    (texto) => trabajo.fill(texto),
  );
}

/* ───────────────────────── el alta de la aseguradora ────────────────────── */
async function altaDeAseguradora(pagina) {
  await pagina.goto(`${BASE}/auth/register/organization`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await pagina.getByLabel('Tipo societario').waitFor({ timeout: 30_000 });
  await pagina.getByLabel('Tipo societario').locator('option:not([hidden])').first().waitFor({ state: 'attached', timeout: 20_000 });
  await pagina.getByLabel('Nombre de la empresa').fill('Andina Salud S.A.');
  await pagina.getByTestId('registro-organizacion-sigla').fill('ANDINA');
  await pagina.getByLabel('Tipo societario').selectOption({ label: 'S.R.L. · Sociedad de Responsabilidad Limitada' });
  await pagina.getByTestId('paginated-form-continuar').click();
  await pagina.getByTestId('registro-organizacion-direccion').waitFor({ timeout: 15_000 });
  // El NIT va lleno: al intentar avanzar, el único rojo de la página tiene que ser el de la dirección.
  await pagina.getByTestId('registro-organizacion-nit').fill('1023456789');

  const direccion = pagina.getByTestId('registro-organizacion-direccion');
  await recorrer(
    pagina,
    'aseguradora',
    direccion,
    {
      marcar: 'registro-organizacion-casa-matriz-location-pick',
      mapa: 'registro-organizacion-casa-matriz-map',
      aviso: 'registro-organizacion-direccion-reescribir',
      confirmar: 'registro-organizacion-casa-matriz-location-confirm',
      confirmada: 'registro-organizacion-casa-matriz-location-confirmed',
      obligatoria: 'Escribí la dirección (hasta 300 caracteres).',
    },
    (texto) => direccion.fill(texto),
  );
}

/* ─────────────────── las altas de laboratorio e imagenología ─────────────── */
const DOCUMENTO = {
  name: 'documento.png',
  mimeType: 'image/png',
  buffer: readFileSync(fileURLToPath(new URL('./fixtures/upload-document.png', import.meta.url))),
};

/**
 * Completa el paso y pulsa «Siguiente» hasta que aparezca el encabezado del
 * paso pedido. Se completa en cada intento: lo escrito antes de que la página
 * termine de hidratarse se pierde.
 */
async function continuarHasta(pagina, titulo, rellenar = async () => {}) {
  const encabezado = pagina.getByRole('heading', { name: titulo });
  for (let intento = 0; intento < 4; intento += 1) {
    await rellenar();
    await pagina.getByTestId('paginated-form-continuar').click();
    const llego = await encabezado
      .waitFor({ timeout: 4_000 })
      .then(() => true)
      .catch(() => false);
    if (llego) return;
  }
  throw new Error(`No se llegó a «${titulo}»`);
}

/**
 * Laboratorio e imagenología comparten forma: la empresa, los papeles, la
 * central con su mapa y las sucursales, cada una con el suyo.
 */
async function altaConSucursales(pagina, { ruta, p, pasoIntermedio }) {
  await pagina.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await pagina.getByTestId(`${p}-razon-social`).waitFor({ timeout: 90_000 });
  const tipo = pagina.getByTestId(`${p}-tipo-sociedad`).locator('select');
  await tipo.locator('option:not([hidden])').nth(1).waitFor({ state: 'attached', timeout: 20_000 });
  const rellenarEmpresa = async () => {
    await pagina.getByTestId(`${p}-razon-social`).fill('Diagnóstico Andino S.R.L.');
    await tipo.selectOption({ index: 1 });
    await pagina.getByTestId(`${p}-nit`).fill('1023456789');
  };
  if (pasoIntermedio) {
    await continuarHasta(pagina, pasoIntermedio.titulo, rellenarEmpresa);
    await continuarHasta(pagina, 'Los papeles de la empresa', pasoIntermedio.rellenar);
  } else {
    await continuarHasta(pagina, 'Los papeles de la empresa', rellenarEmpresa);
  }

  const entradas = pagina.locator('app-file-input input[type="file"]');
  await entradas.first().waitFor({ state: 'attached', timeout: 15_000 });
  for (const entrada of await entradas.all()) await entrada.setInputFiles(DOCUMENTO);
  await continuarHasta(pagina, /^Constitución/);
  await continuarHasta(pagina, 'Dónde está la central');

  const central = pagina.getByTestId(`${p}-direccion`);
  const nombre = p === 'registro-lab' ? 'laboratorio' : 'imagenologia';
  await recorrer(
    pagina,
    `${nombre}-central`,
    central,
    {
      marcar: `${p}-central-location-pick`,
      mapa: `${p}-central-map`,
      aviso: `${p}-direccion-reescribir`,
      confirmar: `${p}-central-location-confirm`,
      confirmada: `${p}-central-location-confirmed`,
      obligatoria: 'Escribí la dirección legal de la central.',
    },
    (texto) => central.fill(texto),
  );

  // La dirección de la central es obligatoria: se vuelve a escribir para seguir.
  await central.fill('Calle Warnes #350');
  await continuarHasta(pagina, 'Tus sucursales');
  await pagina.getByTestId(`${p}-agregar-sucursal`).click();
  const sucursal = pagina.getByTestId(`${p}-sucursal-1-direccion`);
  await sucursal.waitFor({ timeout: 10_000 });
  await recorrer(
    pagina,
    `${nombre}-sucursal`,
    sucursal,
    {
      marcar: `${p}-sucursal-1-location-pick`,
      mapa: `${p}-sucursal-1-map`,
      aviso: `${p}-sucursal-1-direccion-reescribir`,
      confirmar: `${p}-sucursal-1-location-confirm`,
      confirmada: `${p}-sucursal-1-location-confirmed`,
    },
    (texto) => sucursal.fill(texto),
  );
}

async function altaDeLaboratorio(pagina) {
  await altaConSucursales(pagina, { ruta: '/auth/register/laboratory', p: 'registro-lab' });
}

async function altaDeImagenologia(pagina) {
  await altaConSucursales(pagina, {
    ruta: '/auth/register/imaging-center',
    p: 'registro-imagen',
    pasoIntermedio: {
      titulo: 'Qué estudios hacés',
      // El `<input>` nativo va oculto bajo su dibujo: se marca por la etiqueta,
      // y sólo si no estaba marcado, para que un reintento no lo desmarque.
      rellenar: async () => {
        const grupo = pagina.getByTestId('registro-imagen-modalidades');
        if (await grupo.getByRole('checkbox').first().isChecked()) return;
        await grupo.locator('app-checkbox label').first().click();
      },
    },
  });
}

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  navegador = await chromium.launch();
  process.stdout.write(`celda: ${ANCHO}×${ALTO} · tema ${TEMA} · recorridos ${[...RECORRIDOS].join(', ')}\n`);
  const contexto = await navegador.newContext({
    viewport: { width: ANCHO, height: ALTO },
    colorScheme: TEMA === 'oscuro' ? 'dark' : 'light',
    locale: 'es-BO',
    reducedMotion: 'reduce',
  });
  const pagina = await contexto.newPage();
  paginaActual = pagina;
  const errores = [];
  const respuestasFeas = [];
  pagina.on('pageerror', (e) => errores.push(String(e)));
  let cspExcluidos = 0;
  pagina.on('console', (m) => {
    if (m.type() !== 'error') return;
    if (m.text().startsWith(CSP_DEL_SERVIDOR_DE_DESARROLLO)) cspExcluidos += 1;
    else errores.push(`consola: ${m.text()}`);
  });
  pagina.on('response', (r) => {
    if (r.status() >= 400) respuestasFeas.push(`${r.status()} ${r.url()}`);
  });

  if (RECORRIDOS.has('editor')) await editorDelPaciente(pagina);
  if (RECORRIDOS.has('alta')) await altaDelPaciente(pagina);
  if (RECORRIDOS.has('aseguradora')) await altaDeAseguradora(pagina);
  if (RECORRIDOS.has('laboratorio')) await altaDeLaboratorio(pagina);
  if (RECORRIDOS.has('imagenologia')) await altaDeImagenologia(pagina);

  ok(
    'sin errores de página ni de consola',
    errores.length === 0,
    `${errores.join(' · ')}${errores.length ? ' · ' : ''}excluidos por la CSP del servidor de desarrollo: ${cspExcluidos}`,
  );
  ok('sin respuestas 4xx/5xx', respuestasFeas.length === 0, respuestasFeas.slice(0, 3).join(' · '));

  await cerrarNavegador();
  const fallaron = veredictos.filter((v) => !v.cond);
  process.stdout.write(
    `\n${veredictos.length - fallaron.length}/${veredictos.length} comprobaciones en verde\ncapturas en ${relative(process.cwd(), SALIDA)}\n`,
  );
  process.exit(fallaron.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  const diagnostico = `${tmpdir()}/mapa-vacia-direccion-fallo.png`;
  await paginaActual?.screenshot({ path: diagnostico, fullPage: true }).catch(() => {});
  process.stderr.write(`captura de diagnóstico: ${diagnostico}
`);
  await cerrarNavegador();
  process.stderr.write(String(e?.stack ?? e) + '\n');
  process.exit(1);
});
