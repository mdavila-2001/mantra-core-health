/**
 * Evidencia de N-03 (pedido del cliente del 22/09/2026): «Mis puntos» deja de
 * ser una pantalla aparte y pasa a ser la quinta pestaña de «Mi perfil» del
 * paciente, sin cabecera duplicada.
 *
 * 1. La ficha tiene cinco pestañas y la última es «Mis puntos».
 * 2. Abrirla muestra la billetera dentro de la tarjeta: una sola cabecera en
 *    la pantalla, la de «Mi perfil».
 * 3. `/my-account?pestana=puntos` entra directo en la billetera: es lo que
 *    permite que la ruta vieja siga llegando cuando se la redirija.
 * 4. `/my-account/loyalty` sigue existiendo con su propia cabecera, como hoy.
 * 5. Con el lápiz abierto, «Mis puntos» sigue en la tira pero apagada.
 *
 * Uso: `node playwright/mis-puntos-quinta-pestana.mjs [urlBase] [sufijo]`
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4200';
const SUFIJO = process.argv[3] ?? 'despues';
const SALIDA = fileURLToPath(
  new URL('../docs/frontend/evidence/mis-puntos-quinta-pestana-2026-09-23', import.meta.url),
);

const PESTANAS = ['Datos personales', 'Contacto', 'Facturación', 'Seguros y tutores', 'Mis puntos'];

const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond) });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

/** Entra con una de las cuentas de la maqueta y deja la sesión abierta. */
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

const sinDesborde = (pagina) =>
  pagina.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/** El navegador a nivel de módulo, para que lo alcance el cierre de emergencia. */
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

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  navegador = await chromium.launch();
  const errores = [];
  const respuestasFeas = [];

  const contexto = await navegador.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'es-BO',
  });
  const paciente = await contexto.newPage();
  paciente.on('pageerror', (e) => errores.push(String(e)));
  paciente.on('response', (r) => {
    if (r.status() >= 400) respuestasFeas.push(`${r.status()} ${r.url()}`);
  });

  await entrar(paciente, 'paciente@alovida.mock');

  /* ── 1. Cinco pestañas ───────────────────────────────────────────────── */
  await paciente.goto(`${BASE}/my-account`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await paciente.getByTestId('mi-perfil-editar').waitFor({ timeout: 30_000 });
  const tira = paciente.getByTestId('mi-perfil-pestanas').getByRole('tab');
  await tira.nth(4).waitFor({ timeout: 15_000 });
  const rotulos = (await tira.allInnerTexts()).map((t) => t.trim());
  ok('la ficha tiene cinco pestañas, en su orden', rotulos.join(' | ') === PESTANAS.join(' | '), rotulos.join(' | '));
  ok(
    'se entra por «Datos personales»',
    (await tira.nth(0).getAttribute('aria-selected')) === 'true',
  );
  await paciente.waitForTimeout(600);
  await paciente.screenshot({ path: `${SALIDA}/${SUFIJO}-ficha-1440-claro.png`, fullPage: true });

  /* ── 2. La billetera dentro de la tarjeta ────────────────────────────── */
  await tira.nth(4).click();
  const billetera = paciente.getByTestId('mi-perfil-puntos');
  await billetera.waitFor({ timeout: 15_000 });
  await billetera.locator('app-view-state-host, app-alert').first().waitFor({ timeout: 15_000 });
  await paciente.waitForTimeout(800);
  ok(
    'la billetera no trae cabecera propia',
    (await billetera.locator('app-page-header').count()) === 0,
  );
  ok(
    'una sola cabecera en la pantalla',
    (await paciente.locator('app-page-header').count()) === 1,
    `${await paciente.locator('app-page-header').count()} cabeceras`,
  );
  const textoBilletera = (await billetera.innerText()).trim();
  ok(
    'la billetera dice algo del programa (saldo, vacío o error, nunca en blanco)',
    textoBilletera.length > 0,
    textoBilletera.slice(0, 80).replace(/\s+/g, ' '),
  );
  const tarjeta = await paciente.locator('.mi-perfil__principal').first().boundingBox();
  const caja = await billetera.boundingBox();
  ok(
    'la billetera queda dentro de la tarjeta',
    caja && tarjeta && caja.x >= tarjeta.x - 1 && caja.x + caja.width <= tarjeta.x + tarjeta.width + 1,
  );
  ok('1440 · sin desborde horizontal', await sinDesborde(paciente));
  await paciente.screenshot({ path: `${SALIDA}/${SUFIJO}-puntos-1440-claro.png`, fullPage: true });

  await paciente.emulateMedia({ colorScheme: 'dark' });
  await paciente.waitForTimeout(500);
  await paciente.screenshot({ path: `${SALIDA}/${SUFIJO}-puntos-1440-oscuro.png`, fullPage: true });
  await paciente.emulateMedia({ colorScheme: 'light' });

  /* ── Teléfono, claro y oscuro ────────────────────────────────────────── */
  await paciente.setViewportSize({ width: 375, height: 812 });
  await paciente.waitForTimeout(600);
  ok('375 · sin desborde horizontal', await sinDesborde(paciente));
  ok(
    '375 · la pestaña «Mis puntos» sigue alcanzable en la tira',
    await tira.nth(4).isVisible(),
  );
  await paciente.screenshot({ path: `${SALIDA}/${SUFIJO}-puntos-375-claro.png`, fullPage: true });
  await paciente.emulateMedia({ colorScheme: 'dark' });
  await paciente.waitForTimeout(500);
  await paciente.screenshot({ path: `${SALIDA}/${SUFIJO}-puntos-375-oscuro.png`, fullPage: true });
  await paciente.emulateMedia({ colorScheme: 'light' });

  await paciente.setViewportSize({ width: 768, height: 1024 });
  await paciente.waitForTimeout(600);
  ok('768 · sin desborde horizontal', await sinDesborde(paciente));
  await paciente.screenshot({ path: `${SALIDA}/${SUFIJO}-puntos-768-claro.png`, fullPage: true });
  await paciente.setViewportSize({ width: 1440, height: 1000 });

  /* ── 3. Por URL directa ──────────────────────────────────────────────── */
  await paciente.goto(`${BASE}/my-account?pestana=puntos`, {
    waitUntil: 'domcontentloaded',
    timeout: 180_000,
  });
  await paciente.getByTestId('mi-perfil-puntos').waitFor({ timeout: 30_000 });
  const tiraDirecta = paciente.getByTestId('mi-perfil-pestanas').getByRole('tab');
  ok(
    '/my-account?pestana=puntos entra en la billetera',
    (await tiraDirecta.nth(4).getAttribute('aria-selected')) === 'true',
  );
  await paciente.waitForTimeout(600);
  await paciente.screenshot({ path: `${SALIDA}/${SUFIJO}-url-directa-1440-claro.png`, fullPage: true });

  await paciente.goto(`${BASE}/my-account?pestana=zzz`, {
    waitUntil: 'domcontentloaded',
    timeout: 180_000,
  });
  await paciente.getByTestId('mi-perfil-editar').waitFor({ timeout: 30_000 });
  ok(
    'una clave desconocida cae en la primera pestaña',
    (await paciente.getByTestId('mi-perfil-pestanas').getByRole('tab').nth(0).getAttribute('aria-selected')) ===
      'true',
  );

  /* ── 4. La ruta propia sigue existiendo, con su cabecera ─────────────── */
  await paciente.goto(`${BASE}/my-account/loyalty`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await paciente.locator('app-loyalty app-page-header').waitFor({ timeout: 30_000 });
  ok(
    '/my-account/loyalty sigue llegando, con su propia cabecera',
    (await paciente.locator('app-loyalty app-page-header').count()) === 1,
  );
  await paciente.waitForTimeout(600);
  await paciente.screenshot({ path: `${SALIDA}/${SUFIJO}-ruta-propia-1440-claro.png`, fullPage: true });

  /* ── 5. El editor: en la tira, apagada ───────────────────────────────── */
  await paciente.goto(`${BASE}/my-account`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await paciente.getByTestId('mi-perfil-editar').waitFor({ timeout: 30_000 });
  await paciente.getByTestId('mi-perfil-editar').click();
  const tiraEditor = paciente.getByTestId('perfil-pestanas').getByRole('tab');
  await tiraEditor.nth(4).waitFor({ timeout: 30_000 });
  ok(
    'editor · «Mis puntos» sigue en la tira',
    ((await tiraEditor.nth(4).innerText()) ?? '').trim() === 'Mis puntos',
  );
  ok('editor · pero apagada', (await tiraEditor.nth(4).getAttribute('aria-disabled')) === 'true');
  await tiraEditor.nth(4).click({ force: true }).catch(() => {});
  ok(
    'editor · pulsarla no abre nada',
    (await tiraEditor.nth(0).getAttribute('aria-selected')) === 'true',
  );
  await paciente.waitForTimeout(600);
  await paciente.screenshot({ path: `${SALIDA}/${SUFIJO}-editor-1440-claro.png`, fullPage: true });

  ok('sin errores de página', errores.length === 0, errores.join(' · '));
  ok('sin respuestas 4xx/5xx', respuestasFeas.length === 0, respuestasFeas.slice(0, 3).join(' · '));

  await cerrarNavegador();

  const fallaron = veredictos.filter((v) => !v.cond);
  process.stdout.write(
    `\n${veredictos.length - fallaron.length}/${veredictos.length} comprobaciones en verde\n` +
      `capturas en ${SALIDA}\n`,
  );
  process.exit(fallaron.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  await cerrarNavegador();
  process.stderr.write(String(e) + '\n');
  process.exit(1);
});
