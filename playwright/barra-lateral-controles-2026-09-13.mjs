/**
 * Evidencia de los tres pedidos del cliente del 13/09/2026 sobre los controles
 * del marco de sesión:
 *
 *   1. El botón que recoge la barra —el `»` bajo el logotipo— tiene que ser más
 *      grande y más visible, y llevar borde. El borde cambia con el tema.
 *   2. La hamburguesa que había a su lado, en el encabezado, no va más en
 *      escritorio: no abría un menú, escondía la barra entera. Se queda sólo en
 *      modo cajón (≤ 900 px), donde es la única puerta al menú.
 *   3. La flecha de volver no se dibuja en el panel, donde volver o no hace
 *      nada o devuelve al ingreso.
 *
 * Un solo navegador, un contexto por vez: serie estricta, como exige
 * `.claude/rules/20-resource-control.md`. El navegador se cierra en `finally` y
 * ante señal, para no dejar procesos vivos si esto se corta.
 *
 * Uso: `node playwright/barra-lateral-controles-2026-09-13.mjs [urlBase]`
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4334';
/* `fileURLToPath` y no `.pathname`: el repositorio vive bajo «Mantra Core
   Technologies», con espacios, y `pathname` los devuelve como `%20`. */
const SALIDA = fileURLToPath(
  new URL('../docs/frontend/evidence/barra-lateral-controles-2026-09-13', import.meta.url),
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

/** La geometría y el color del botón de recoger, medidos en el navegador. */
function medirRecoger(pagina) {
  return pagina.locator('[data-testid="nav-recoger"]').evaluate((el) => {
    const cs = getComputedStyle(el);
    const caja = el.getBoundingClientRect();
    const svg = el.querySelector('svg');
    return {
      ancho: Math.round(caja.width),
      alto: Math.round(caja.height),
      borde: cs.borderTopWidth,
      colorBorde: cs.borderTopColor,
      fondo: cs.backgroundColor,
      icono: svg ? Math.round(svg.getBoundingClientRect().width) : 0,
    };
  });
}

async function recorrerEscritorio(pagina, tema) {
  await pagina.emulateMedia({ colorScheme: tema === 'oscuro' ? 'dark' : 'light' });
  await pagina.goto(`${BASE}/my-account`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.locator('[data-testid="nav-recoger"]').waitFor({ state: 'visible', timeout: 30_000 });

  /* 1 · El botón de recoger: más grande, con borde y con caja. */
  const medida = await medirRecoger(pagina);
  ok(
    `[${tema}] el botón de recoger mide 40 px y no 32`,
    medida.ancho >= 40 && medida.alto >= 40,
    `${medida.ancho}×${medida.alto}`,
  );
  ok(
    `[${tema}] tiene borde visible`,
    parseFloat(medida.borde) >= 1 && !/rgba\(0, 0, 0, 0\)/.test(medida.colorBorde),
    `${medida.borde} ${medida.colorBorde}`,
  );
  ok(
    `[${tema}] y caja propia, no transparente`,
    !/rgba\(0, 0, 0, 0\)/.test(medida.fondo),
    medida.fondo,
  );
  ok(`[${tema}] el ícono creció con él`, medida.icono >= 18, `${medida.icono}px`);

  /* 2 · La hamburguesa no está en escritorio. */
  ok(
    `[${tema}] sin hamburguesa en el encabezado`,
    (await pagina.locator('.app-nav-toggle:visible').count()) === 0,
  );

  await pagina.screenshot({
    path: `${SALIDA}/escritorio-${tema}-desplegada.png`,
    animations: 'disabled',
  });

  /* La barra se recoge a un carril de íconos y SIGUE ESTANDO. */
  await pagina.locator('[data-testid="nav-recoger"]').click();
  await pagina.waitForTimeout(500);
  const barra = await pagina.locator('#app-side-nav').boundingBox();
  ok(
    `[${tema}] recogida, la barra sigue en pantalla`,
    barra !== null && barra.x >= 0 && barra.width > 40,
    barra ? `x=${Math.round(barra.x)} ancho=${Math.round(barra.width)}` : 'sin caja',
  );
  ok(
    `[${tema}] y sigue siendo navegable (sin inert)`,
    (await pagina.locator('#app-side-nav').getAttribute('inert')) === null,
  );
  const recogido = await medirRecoger(pagina);
  ok(
    `[${tema}] recogida, el botón se sigue viendo igual de grande`,
    recogido.ancho >= 40 && parseFloat(recogido.borde) >= 1,
    `${recogido.ancho}×${recogido.alto} borde ${recogido.borde}`,
  );
  await pagina.screenshot({
    path: `${SALIDA}/escritorio-${tema}-recogida.png`,
    animations: 'disabled',
  });

  /* Se devuelve para no arrastrar el estado a la siguiente comprobación. */
  await pagina.locator('[data-testid="nav-recoger"]').click();
  await pagina.waitForTimeout(400);

  /* 3 · La flecha de volver: no en el panel, sí en el resto. */
  ok(
    `[${tema}] fuera del panel la flecha está`,
    (await pagina.locator('app-back-link').count()) > 0,
  );
  await pagina.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.waitForTimeout(900);
  ok(`[${tema}] en el panel la flecha NO está`, (await pagina.locator('app-back-link').count()) === 0);
  await pagina.screenshot({ path: `${SALIDA}/panel-${tema}.png`, animations: 'disabled' });

  const desborda = await pagina.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  ok(`[${tema}] sin desborde horizontal`, !desborda);
}

async function recorrerTelefono(pagina) {
  await pagina.setViewportSize({ width: 375, height: 812 });
  await pagina.goto(`${BASE}/my-account`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.waitForTimeout(900);

  /* En teléfono la hamburguesa SIGUE, porque es la única puerta al menú. */
  const toggle = pagina.locator('.app-nav-toggle');
  ok('[teléfono] la hamburguesa sigue estando', (await toggle.count()) === 1);
  await toggle.click();
  await pagina.waitForTimeout(500);
  ok(
    '[teléfono] y abre el cajón',
    await pagina.evaluate(() => document.documentElement.classList.contains('nav-abierto')),
  );
  await pagina.screenshot({ path: `${SALIDA}/telefono-cajon.png`, animations: 'disabled' });
  await pagina.keyboard.press('Escape');
  await pagina.waitForTimeout(400);
  ok(
    '[teléfono] y Escape lo cierra',
    !(await pagina.evaluate(() => document.documentElement.classList.contains('nav-abierto'))),
  );
}

async function recorrer(errores, fallidas) {
  for (const tema of ['claro', 'oscuro']) {
    const contexto = await navegador.newContext({
      viewport: { width: 1440, height: 1000 },
      locale: 'es-BO',
    });
    const pagina = await contexto.newPage();
    pagina.on('pageerror', (e) => errores.push(`${tema}: ${e}`));
    pagina.on('response', (r) => {
      if (r.status() >= 400 && !r.url().includes('favicon'))
        fallidas.push(`${tema} ${r.status()} ${r.url()}`);
    });
    await entrar(pagina, 'medica@alovida.mock');
    await recorrerEscritorio(pagina, tema);
    if (tema === 'claro') {
      await recorrerTelefono(pagina);
    }
    await contexto.close();
  }
}

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const errores = [];
  const fallidas = [];

  navegador = await chromium.launch();
  try {
    await recorrer(errores, fallidas);
  } finally {
    await cerrarNavegador();
  }

  ok('sin errores de consola', errores.length === 0, errores.slice(0, 4).join(' | '));
  ok('sin respuestas 4xx/5xx', fallidas.length === 0, fallidas.slice(0, 4).join(' | '));

  const malos = veredictos.filter((v) => !v.cond);
  process.stdout.write(
    `\n${veredictos.length - malos.length}/${veredictos.length} comprobaciones en verde\n` +
      `capturas en ${SALIDA}\n`,
  );
  process.exit(malos.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  await cerrarNavegador();
  process.stderr.write(String(e && e.stack ? e.stack : e) + '\n');
  process.exit(2);
});
