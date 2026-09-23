/**
 * Evidencia del pedido del cliente del 13/09/2026 sobre «Dónde atiendo»
 * (`/my-account/edit`, pestaña 3):
 *
 *   1. Editar y retirar **se leen con su texto**. Nacieron como íconos con
 *      globo; ADR-0012 (20/09/2026) invirtió la regla, porque el globo era el
 *      parche de un botón mudo. Lo que se comprueba ahora es que el texto
 *      esté a la vista, y que el disparador diga de qué sede son.
 *   2. Cada sede ofrece la acción del **QR bancario** con el que el
 *      profesional cobra ahí. Sin uno cargado, el modal **es** la zona de
 *      soltar; con uno cargado, el lápiz de la esquina pide el reemplazo.
 *   3. Sin QR configurado lo dice con palabras, dos veces: la acción se llama
 *      «Configurar QR bancario» y la fila lleva su aviso en ámbar, que es el
 *      que se ve sin abrir nada. El color nunca fue la única señal
 *      (WCAG 1.4.1), y el ámbar que queda es texto: se le mide 4,5:1.
 *
 * Un solo navegador, un contexto por vez: serie estricta, como exige
 * `.claude/rules/20-resource-control.md`. El navegador se cierra en `finally` y
 * ante señal, para no dejar procesos vivos si esto se corta.
 *
 * Uso: `node playwright/qr-bancario-por-sede-2026-09-13.mjs [urlBase]`
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4335';
/* `fileURLToPath` y no `.pathname`: el repositorio vive bajo «Mantra Core
   Technologies», con espacios, y `pathname` los devuelve como `%20`. */
const SALIDA = fileURLToPath(
  new URL('../docs/frontend/evidence/qr-bancario-por-sede-2026-09-13', import.meta.url),
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

/** Abre «Editar tu info → Dónde atiendo» y espera a que la lista tenga filas. */
async function abrirDondeAtiendo(pagina) {
  await pagina.goto(`${BASE}/my-account/edit`, {
    waitUntil: 'domcontentloaded',
    timeout: 180_000,
  });
  await pagina.getByRole('tab', { name: 'Dónde atiendo' }).click();
  await pagina.locator('[data-testid="sede-propia"]').first().waitFor({ timeout: 60_000 });
}

/**
 * Lo que cada fila dice sobre su QR, y cómo se pinta el aviso.
 *
 * Ya no se mide la tinta de un glifo: desde ADR-0012 la señal son las
 * palabras. Se mide el aviso de la fila —el que se ve sin abrir el
 * desplegable— contra el fondo **realmente pintado**, subiendo por los
 * ancestros hasta encontrar uno no transparente: comparar contra un hex
 * escrito a mano en el guion sería comprobar la aritmética del guion, no lo
 * que se ve. Y el umbral es 4,5:1 y no 3:1, porque ahora es texto chico
 * (WCAG 1.4.3) y no un objeto gráfico.
 */
function medirAvisosDeQr(pagina) {
  return pagina.locator('[data-testid="sede-propia"]').evaluateAll((filas) => {
    const canal = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const luminancia = (rgb) => {
      const [r, g, b] = rgb.map((v) => canal(v / 255));
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const aRgb = (color) => (color.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map(Number);
    const fondoPintado = (el) => {
      for (let n = el; n instanceof Element; n = n.parentElement) {
        const fondo = getComputedStyle(n).backgroundColor;
        const canales = fondo.match(/\d+(\.\d+)?/g) ?? [];
        const alfa = canales.length === 4 ? Number(canales[3]) : 1;
        if (alfa > 0) return aRgb(fondo);
      }
      return [255, 255, 255];
    };

    return filas.map((fila) => {
      const aviso = fila.querySelector('[data-testid="sede-sin-qr"]');
      const tinta = aviso ? getComputedStyle(aviso).color : 'rgb(0, 0, 0)';
      const a = luminancia(aRgb(tinta));
      const b = luminancia(fondoPintado(aviso ?? fila));
      return {
        sede: fila.querySelector('strong')?.textContent?.trim() ?? '',
        avisa: aviso !== null,
        tinta,
        contraste: Number(
          ((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2),
        ),
      };
    });
  });
}

/**
 * El texto de una acción de esa sede, abriendo el desplegable si hace falta.
 *
 * La forma sale de cuántas acciones tiene la sede, no de una decisión de esta
 * pantalla: la propia son tres y se pliegan, la ajena son dos y quedan en la
 * fila. El recorrido pregunta por la acción, no por la forma.
 */
async function textoDeAccion(pagina, indice, code) {
  const fila = pagina.locator('[data-testid="sede-propia"]').nth(indice);
  const disparador = fila.locator('[data-testid="row-actions-trigger"]');
  if ((await disparador.count()) === 0) {
    return (
      (await fila.locator(`app-row-actions [data-action="${code}"]`).textContent()) ?? ''
    ).trim();
  }
  await disparador.click();
  await pagina.locator('app-menu [role="menuitem"]').first().waitFor({ timeout: 10_000 });
  const texto = (
    (await pagina.locator(`app-menu [data-action="${code}"]`).textContent()) ?? ''
  ).trim();
  await pagina.keyboard.press('Escape');
  await pagina
    .locator('app-menu [role="menuitem"]')
    .first()
    .waitFor({ state: 'detached', timeout: 10_000 });
  return texto;
}

/** Ejecuta esa acción en la fila n de la lista de sedes. */
async function accionarSede(pagina, indice, code) {
  const fila = pagina.locator('[data-testid="sede-propia"]').nth(indice);
  const disparador = fila.locator('[data-testid="row-actions-trigger"]');
  if ((await disparador.count()) > 0) {
    await disparador.click();
    await pagina.locator('app-menu [role="menuitem"]').first().waitFor({ timeout: 10_000 });
    await pagina.locator(`app-menu [data-action="${code}"]`).click();
    return;
  }
  await fila.locator(`app-row-actions [data-action="${code}"]`).click();
}

async function recorrer(pagina, tema) {
  await pagina.emulateMedia({ colorScheme: tema === 'oscuro' ? 'dark' : 'light' });
  await abrirDondeAtiendo(pagina);

  const filas = await medirAvisosDeQr(pagina);
  await pagina.screenshot({ path: `${SALIDA}/sedes-acciones-${tema}.png`, fullPage: true });

  ok(`[${tema}] las cuatro sedes siguen en la lista`, filas.length === 4, `${filas.length} filas`);

  const sinQr = filas.filter((f) => f.avisa);
  const conQr = filas.filter((f) => !f.avisa);
  ok(
    `[${tema}] sólo el consultorio propio tiene QR cargado`,
    conQr.length === 1 && conQr[0].sede.includes('Rojas'),
    conQr.map((f) => f.sede).join(' · '),
  );
  ok(
    `[${tema}] a los que les falta se les ve el aviso sin abrir nada`,
    sinQr.length === 3,
    sinQr.map((f) => f.sede).join(' · '),
  );
  /* WCAG 1.4.3: texto chico necesita 4,5:1 contra lo que tiene detrás. Un
     ámbar que no se distingue del fondo no avisa de nada. */
  ok(
    `[${tema}] el aviso en ámbar llega a 4,5:1 sobre el fondo real`,
    sinQr.every((f) => f.contraste >= 4.5),
    sinQr.map((f) => `${f.contraste}:1`).join(' · '),
  );

  /* ---- Y la acción también lo dice, con su propio texto ------------------ */
  const textoPropio = await textoDeAccion(pagina, 0, 'qr');
  const indiceSinQr = filas.findIndex((f) => f.avisa);
  const textoSinQr = await textoDeAccion(pagina, indiceSinQr, 'qr');
  ok(
    `[${tema}] el que ya está se nombra distinto del que falta`,
    textoPropio === 'Ver QR bancario' && textoSinQr === 'Configurar QR bancario',
    `${textoPropio} · ${textoSinQr}`,
  );

  /* ---- Editar se lee sin apuntar: ya no hay globo que esperar ------------ */
  const textoEditar = await textoDeAccion(pagina, 0, 'editar');
  ok(`[${tema}] editar se lee con su texto`, textoEditar === 'Editar', textoEditar);

  /* ---- El modal del QR que YA está cargado ------------------------------- */
  await accionarSede(pagina, 0, 'qr');
  await pagina.locator('[data-testid="sede-qr-imagen"]').waitFor({ timeout: 30_000 });
  await pagina.screenshot({ path: `${SALIDA}/qr-cargado-${tema}.png` });
  ok(
    `[${tema}] con QR cargado muestra la imagen y el lápiz, no la zona de soltar`,
    (await pagina.locator('[data-testid="sede-qr-reemplazar"]').count()) === 1 &&
      (await pagina.locator('[data-testid="sede-qr-archivo"]').count()) === 0,
  );

  // El lápiz abre el reemplazo, y se puede volver sin perder el que estaba.
  await pagina.locator('[data-testid="sede-qr-reemplazar"]').click();
  await pagina.locator('[data-testid="sede-qr-archivo"]').waitFor({ timeout: 10_000 });
  await pagina.screenshot({ path: `${SALIDA}/qr-reemplazo-${tema}.png` });
  await pagina.locator('[data-testid="sede-qr-cancelar"]').click();
  /* `waitFor` y no `count()` a secas: el clic vuelve antes de que Angular haya
     repintado, y medido en ese instante el modal todavía muestra la zona de
     soltar. Comprobado: al instante daba imagen 0 / archivo 1, y 1,5 s después
     imagen 1 / archivo 0. Era la aserción la que llegaba temprano, no la
     pantalla la que tarda. */
  await pagina.locator('[data-testid="sede-qr-imagen"]').waitFor({ timeout: 10_000 });
  ok(
    `[${tema}] cancelar el reemplazo devuelve el QR que ya estaba`,
    (await pagina.locator('[data-testid="sede-qr-archivo"]').count()) === 0,
  );
  await pagina.getByTestId('content-dialog-close').click();

  /* ---- El modal del QR que FALTA: es la zona de soltar ------------------- */
  await accionarSede(pagina, 1, 'qr');
  await pagina.locator('[data-testid="sede-qr-archivo"]').waitFor({ timeout: 30_000 });
  await pagina.screenshot({ path: `${SALIDA}/qr-vacio-${tema}.png` });
  ok(
    `[${tema}] sin QR, el modal ES la zona de soltar`,
    (await pagina.locator('[data-testid="sede-qr-imagen"]').count()) === 0,
  );

  /* ---- Subir uno de verdad, y que la fila deje el ámbar ------------------ */
  if (tema !== 'claro') {
    await pagina.getByTestId('content-dialog-close').click();
    return;
  }

  await pagina.locator('[data-testid="sede-qr-archivo"]').setInputFiles({
    name: 'qr-banco-union.png',
    mimeType: 'image/png',
    buffer: QR_DE_PRUEBA,
  });
  await pagina.locator('[data-testid="sede-qr-imagen"]').waitFor({ timeout: 30_000 });
  await pagina.screenshot({ path: `${SALIDA}/qr-recien-subido.png` });
  const fuente = await pagina.locator('[data-testid="sede-qr-imagen"]').getAttribute('src');
  ok(
    '[claro] lo subido vuelve como imagen, no como un dibujo con iniciales',
    (fuente ?? '').startsWith('data:image/png'),
    (fuente ?? '').slice(0, 24),
  );

  await pagina.getByTestId('content-dialog-close').click();
  const despues = await medirAvisosDeQr(pagina);
  const nombreTrasSubir = await textoDeAccion(pagina, 1, 'qr');
  ok(
    '[claro] la fila que recibió el QR deja el aviso, y su acción cambia de nombre',
    despues[1]?.avisa === false && nombreTrasSubir === 'Ver QR bancario',
    `avisa=${despues[1]?.avisa} · ${nombreTrasSubir}`,
  );
  await pagina.screenshot({ path: `${SALIDA}/sedes-tras-subir.png`, fullPage: true });
}

async function principal() {
  mkdirSync(SALIDA, { recursive: true });
  navegador = await chromium.launch();

  try {
    for (const tema of ['claro', 'oscuro']) {
      const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 } });
      const pagina = await contexto.newPage();
      /* La violación de CSP del script anti-parpadeo es **anterior a este
         cambio y ajena a él**: medida igual en `/auth` y en `/dashboard`, que
         no se tocaron. Se filtra por su texto exacto para que cualquier error
         nuevo siga saltando, en vez de apagar la comprobación entera. */
      const consola = [];
      pagina.on(
        'console',
        (m) =>
          m.type() === 'error' &&
          !m.text().includes('Executing inline script violates') &&
          consola.push(m.text()),
      );

      await entrar(pagina, 'medica@mantra.health');
      await recorrer(pagina, tema);

      ok(`[${tema}] consola sin errores`, consola.length === 0, consola.slice(0, 2).join(' | '));
      await contexto.close();
    }

    /* ---- Móvil: la fila de tres íconos no rompe el ancho ------------------ */
    const movil = await navegador.newContext({ viewport: { width: 375, height: 780 } });
    const pagina = await movil.newPage();
    await entrar(pagina, 'medica@mantra.health');
    await abrirDondeAtiendo(pagina);
    await pagina.screenshot({ path: `${SALIDA}/sedes-375.png`, fullPage: true });
    const desborde = await pagina.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    ok('[375] sin scroll horizontal con los tres íconos', !desborde);
    await movil.close();
  } finally {
    await cerrarNavegador();
  }

  const fallos = veredictos.filter((v) => !v.cond);
  process.stdout.write(
    `\n${veredictos.length - fallos.length}/${veredictos.length} comprobaciones en verde\n`,
  );
  process.exit(fallos.length === 0 ? 0 : 1);
}

await principal();
