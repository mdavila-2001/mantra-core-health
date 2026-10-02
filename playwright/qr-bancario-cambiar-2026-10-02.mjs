/**
 * Evidencia de la corrección del 02/10/2026 sobre el modal del **QR bancario
 * de una sede** (`/my-account/edit`, pestaña «Dónde atiendo» → «Ver QR
 * bancario»):
 *
 *   1. «Cambiar el QR» va en el **pie del modal**, no encima de la imagen:
 *      ahí tapaba el QR y se leía como parte de él.
 *   2. El botón abre el **selector de archivos del sistema directamente**. No
 *      saca el QR vigente ni muestra una zona de soltar.
 *   3. Cancelar el selector no cambia nada: el QR guardado sigue a la vista.
 *   4. Elegir un archivo lo sube y lo deja como QR de la sede, con la imagen
 *      vigente a la vista mientras sube; al reabrir el modal, el nuevo es el
 *      que está guardado (UI → request → persistencia → recarga → UI).
 *
 * Un solo navegador, un contexto por vez, cerrado en `finally` y ante señal.
 *
 * Uso: `node playwright/qr-bancario-cambiar-2026-10-02.mjs [urlBase]`
 * `PW_CHROMIUM_PATH` apunta a otro Chromium cuando el que Playwright espera no
 * está instalado.
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4335';
const SALIDA = fileURLToPath(
  new URL('../docs/frontend/evidence/qr-bancario-cambiar-2026-10-02', import.meta.url),
);

/** Un PNG de 1×1 transparente. Alcanza: lo que se comprueba es el camino. */
const QR_DE_PRUEBA = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond) });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

let navegador;

async function cerrarNavegador() {
  await navegador?.close().catch(() => {});
  navegador = undefined;
}

for (const senal of ['SIGINT', 'SIGTERM']) {
  process.on(senal, () => {
    void cerrarNavegador().then(() => process.exit(130));
  });
}

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

/** Abre «Editar tu info → Dónde atiendo» y espera a que la tabla tenga filas. */
async function abrirDondeAtiendo(pagina) {
  await pagina.goto(`${BASE}/my-account/edit`, {
    waitUntil: 'domcontentloaded',
    timeout: 180_000,
  });
  await pagina.getByRole('tab', { name: 'Dónde atiendo' }).click();
  await filasDeSedes(pagina).first().waitFor({ timeout: 60_000 });
}

function filasDeSedes(pagina) {
  return pagina.locator('[data-testid="sedes-propias"] [data-testid="tabla-fila"]');
}

/** La primera fila que YA tiene QR: la que no lleva el aviso en ámbar. */
function filaConQr(pagina) {
  return filasDeSedes(pagina).filter({ hasNot: pagina.locator('[data-testid="sede-sin-qr"]') }).first();
}

/** Ejecuta esa acción en la fila, abriendo el desplegable si hace falta. */
async function accionar(pagina, fila, code) {
  const disparador = fila.locator('[data-testid="row-actions-trigger"]');
  if ((await disparador.count()) > 0) {
    await disparador.click();
    await pagina.locator('app-menu [role="menuitem"]').first().waitFor({ timeout: 10_000 });
    await pagina.locator(`app-menu [data-action="${code}"]`).click();
    return;
  }
  await fila.locator(`app-row-actions [data-action="${code}"]`).click();
}

const imagen = (pagina) => pagina.locator('[data-testid="sede-qr-imagen"]');
const boton = (pagina) => pagina.locator('[data-testid="sede-qr-reemplazar"]');
const zonaDeSoltar = (pagina) => pagina.locator('[data-testid="sede-qr-archivo"]');

async function recorrer(pagina, tema) {
  await pagina.emulateMedia({ colorScheme: tema === 'oscuro' ? 'dark' : 'light' });
  await abrirDondeAtiendo(pagina);

  const fila = filaConQr(pagina);
  ok(`[${tema}] hay una sede con QR cargado para mirar`, (await fila.count()) === 1);

  /* ---- 1. El botón está en el pie, no sobre la imagen ------------------- */
  await accionar(pagina, fila, 'qr');
  await imagen(pagina).waitFor({ timeout: 30_000 });
  await pagina.screenshot({ path: `${SALIDA}/qr-cargado-${tema}.png` });
  ok(
    `[${tema}] con QR cargado: imagen y «Cambiar el QR», sin zona de soltar`,
    (await boton(pagina).count()) === 1 && (await zonaDeSoltar(pagina).count()) === 0,
  );
  ok(
    `[${tema}] el botón dice lo que hace, con texto (ADR-0012)`,
    ((await boton(pagina).textContent()) ?? '').trim() === 'Cambiar el QR',
  );
  const pie = await pagina.getByTestId('content-dialog-actions').boundingBox();
  const cajaBoton = await boton(pagina).boundingBox();
  const cajaImagen = await imagen(pagina).boundingBox();
  ok(
    `[${tema}] «Cambiar el QR» está en el pie del modal y no tapa la imagen`,
    pie &&
      cajaBoton &&
      cajaImagen &&
      cajaBoton.y >= pie.y &&
      cajaBoton.y >= cajaImagen.y + cajaImagen.height,
    `pie.y=${pie?.y} botón.y=${cajaBoton?.y} imagen.abajo=${
      cajaImagen ? cajaImagen.y + cajaImagen.height : '?'
    }`,
  );

  /* ---- 2 y 3. Abre el selector; cancelado, no pasa nada ------------------ */
  const fuenteAnterior = await imagen(pagina).getAttribute('src');
  const selector = pagina.waitForEvent('filechooser', { timeout: 10_000 });
  await boton(pagina).click();
  const abierto = await selector.then(
    (fc) => !fc.isMultiple(),
    () => false,
  );
  ok(`[${tema}] «Cambiar el QR» abre el selector de archivos del sistema`, abierto);
  // El selector queda sin respuesta: es exactamente «cancelar».
  await pagina.waitForTimeout(500);
  await pagina.screenshot({ path: `${SALIDA}/qr-selector-cancelado-${tema}.png` });
  ok(
    `[${tema}] con el selector cancelado, el QR vigente sigue tal cual`,
    (await imagen(pagina).count()) === 1 &&
      (await imagen(pagina).getAttribute('src')) === fuenteAnterior &&
      (await zonaDeSoltar(pagina).count()) === 0 &&
      (await pagina.locator('[data-testid="sede-qr-cancelar"]').count()) === 0,
  );

  if (tema !== 'claro') {
    await pagina.getByTestId('content-dialog-close').click();
    return;
  }

  /* ---- 4. Elegir uno de verdad: UI → request → persistencia → UI ---------
     El backend simulado es un interceptor de `HttpClient`, así que las dos
     peticiones (`POST /common/files/upload` y `PUT …/bank-qr`) no salen por
     la red y Playwright no las ve; su contrato lo fija la prueba unitaria del
     modal. Acá se demuestra lo que sigue: que lo subido queda guardado. */
  const selectorDeReemplazo = pagina.waitForEvent('filechooser', { timeout: 10_000 });
  await boton(pagina).click();
  await (await selectorDeReemplazo).setFiles({
    name: 'qr-banco-nuevo.png',
    mimeType: 'image/png',
    buffer: QR_DE_PRUEBA,
  });
  const imagenDuranteLaSubida = await imagen(pagina).count();
  await pagina
    .locator('[data-testid="sede-qr-subiendo"]')
    .waitFor({ state: 'detached', timeout: 30_000 });
  await pagina
    .locator('[data-testid="sede-qr-imagen"]')
    .and(pagina.locator(`:not([src="${fuenteAnterior}"])`))
    .waitFor({ timeout: 30_000 })
    .catch(() => {});
  const fuenteNueva = await imagen(pagina).getAttribute('src');
  await pagina.screenshot({ path: `${SALIDA}/qr-reemplazado-${tema}.png` });
  ok(
    `[${tema}] el QR nuevo reemplaza al anterior, con el vigente a la vista mientras subía`,
    imagenDuranteLaSubida === 1 && fuenteNueva !== null && fuenteNueva !== fuenteAnterior,
    `antes=${(fuenteAnterior ?? '').slice(0, 30)}… después=${(fuenteNueva ?? '').slice(0, 30)}…`,
  );

  await pagina.getByTestId('content-dialog-close').click();
  await pagina.locator('[data-testid="content-dialog"]').waitFor({ state: 'detached', timeout: 10_000 });
  await accionar(pagina, fila, 'qr');
  await imagen(pagina).waitFor({ timeout: 30_000 });
  await pagina.screenshot({ path: `${SALIDA}/qr-reabierto-${tema}.png` });
  ok(
    `[${tema}] al reabrir el modal, el QR nuevo es el que está guardado`,
    (await imagen(pagina).getAttribute('src')) === fuenteNueva,
  );
  await pagina.getByTestId('content-dialog-close').click();
}

async function principal() {
  mkdirSync(SALIDA, { recursive: true });
  navegador = await chromium.launch({ executablePath: process.env['PW_CHROMIUM_PATH'] });

  try {
    for (const tema of ['claro', 'oscuro']) {
      const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
      const pagina = await contexto.newPage();
      /* La violación de CSP del script anti-parpadeo es anterior y ajena a
         este cambio; se filtra por su texto exacto. */
      const consola = [];
      pagina.on(
        'console',
        (m) =>
          m.type() === 'error' &&
          !m.text().includes('Executing inline script violates') &&
          !m.text().includes('Refused to execute inline script') &&
          consola.push(m.text()),
      );

      await entrar(pagina, 'medica@mantra.health');
      await recorrer(pagina, tema);

      ok(`[${tema}] consola sin errores`, consola.length === 0, consola.slice(0, 2).join(' | '));
      await contexto.close();
    }

    /* ---- Móvil: el pie reparte el ancho y el botón sigue a la vista ------- */
    const movil = await navegador.newContext({ viewport: { width: 375, height: 780 } });
    const pagina = await movil.newPage();
    await entrar(pagina, 'medica@mantra.health');
    await abrirDondeAtiendo(pagina);
    await accionar(pagina, filaConQr(pagina), 'qr');
    await imagen(pagina).waitFor({ timeout: 30_000 });
    await pagina.screenshot({ path: `${SALIDA}/qr-cargado-375.png` });
    const visible = await boton(pagina).isVisible();
    const desborde = await pagina.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    ok('[375] «Cambiar el QR» a la vista y sin scroll horizontal', visible && !desborde);
    await movil.close();
  } finally {
    await cerrarNavegador();
  }

  const fallidos = veredictos.filter((v) => !v.cond);
  process.stdout.write(`\n${veredictos.length - fallidos.length}/${veredictos.length} verificaciones\n`);
  process.exit(fallidos.length === 0 ? 0 : 1);
}

await principal();
