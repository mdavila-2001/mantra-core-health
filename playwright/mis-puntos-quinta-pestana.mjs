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
 * 4. `/my-account/loyalty` ya no pinta una pantalla aparte: termina en la
 *    ficha. En qué pestaña la abre se informa, porque esa redirección no es
 *    de este cambio.
 * 5. Con el lápiz abierto, «Mis puntos» sigue en la tira pero apagada.
 *
 * La ficha, la billetera y el editor se capturan en los cinco viewports que el
 * repo exige como evidencia visual, con tema oscuro en el de escritorio y en el
 * más angosto. Cada celda se carga de cero en su tamaño y su tema.
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

const CELDAS = [
  { ancho: 1440, alto: 900, tema: 'light' },
  { ancho: 1440, alto: 900, tema: 'dark' },
  { ancho: 1920, alto: 1080, tema: 'light' },
  { ancho: 1024, alto: 768, tema: 'light' },
  { ancho: 768, alto: 1024, tema: 'light' },
  { ancho: 390, alto: 844, tema: 'light' },
  { ancho: 390, alto: 844, tema: 'dark' },
];

const nombreCelda = ({ ancho, tema }) => `${ancho}-${tema === 'dark' ? 'oscuro' : 'claro'}`;
const esReferencia = ({ ancho, tema }) => ancho === 1440 && tema === 'light';

const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond) });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};
/** Lo que se mide y se informa sin ser un criterio de este cambio. */
const observar = (nombre, detalle) => process.stdout.write(`ℹ ${nombre} — ${detalle}\n`);

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

/**
 * Espera a que la pantalla deje de moverse: dos cuadros y ninguna animación
 * finita en curso. La barra lateral anima su ancho cuando cambia la ventana, y
 * una foto tomada a mitad de esa animación la saca recortada.
 */
async function quieta(pagina) {
  await pagina.evaluate(
    () => new Promise((listo) => requestAnimationFrame(() => requestAnimationFrame(() => listo()))),
  );
  await pagina.waitForFunction(
    () =>
      document
        .getAnimations()
        .every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity),
    undefined,
    { timeout: 15_000 },
  );
}

/**
 * Foto de la página entera sin `fullPage`: esa opción estira la ventana en el
 * momento de la foto y la barra lateral sale a mitad de su animación. Acá se
 * estira antes, se espera a que todo quede quieto y recién entonces se toma.
 */
async function capturar(pagina, nombre) {
  const ventana = pagina.viewportSize();
  // El puntero queda donde se hizo el último clic —encima de la tira— y la
  // pestaña se pintaría con su fondo de «puntero encima». Se lo lleva al borde.
  await pagina.mouse.move(ventana.width - 4, Math.round(ventana.height / 2));
  const alto = await pagina.evaluate(() => document.documentElement.scrollHeight);
  const estirar = alto > ventana.height;
  if (estirar) await pagina.setViewportSize({ width: ventana.width, height: alto });
  await quieta(pagina);
  await pagina.screenshot({ path: `${SALIDA}/${SUFIJO}-${nombre}.png` });
  if (estirar) {
    await pagina.setViewportSize(ventana);
    await quieta(pagina);
  }
}

/**
 * La billetera ya resolvió su estado (saldo, vacío o error): no le queda
 * ningún esqueleto de carga adentro. Sin esto la foto puede salir en S1.
 */
const billeteraResuelta = (pagina) =>
  pagina.waitForFunction(
    () => {
      const billetera = document.querySelector('[data-testid="mi-perfil-puntos"]');
      return billetera !== null && billetera.querySelector('app-skeleton') === null;
    },
    undefined,
    { timeout: 30_000 },
  );

/** Carga una ruta en el tamaño y el tema de la celda, y espera la ficha. */
async function abrir(pagina, ruta, { ancho, alto, tema }) {
  await pagina.setViewportSize({ width: ancho, height: alto });
  await pagina.emulateMedia({ colorScheme: tema });
  await pagina.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.getByTestId('mi-perfil-editar').waitFor({ timeout: 30_000 });
}

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

/** 1 y 2: la ficha y la billetera, en una celda. */
async function fichaYBilletera(paciente, celda) {
  const c = nombreCelda(celda);
  await abrir(paciente, '/my-account', celda);
  const tira = paciente.getByTestId('mi-perfil-pestanas').getByRole('tab');
  await tira.nth(4).waitFor({ timeout: 15_000 });
  if (esReferencia(celda)) {
    const rotulos = (await tira.allInnerTexts()).map((t) => t.trim());
    ok('la ficha tiene cinco pestañas, en su orden', rotulos.join(' | ') === PESTANAS.join(' | '), rotulos.join(' | '));
    ok('se entra por «Datos personales»', (await tira.nth(0).getAttribute('aria-selected')) === 'true');
  }
  ok(`${c} · ficha sin desborde horizontal`, await sinDesborde(paciente));
  await capturar(paciente, `ficha-${c}`);

  await tira.nth(4).click();
  const billetera = paciente.getByTestId('mi-perfil-puntos');
  await billetera.waitFor({ timeout: 15_000 });
  await billeteraResuelta(paciente);
  ok(`${c} · «Mis puntos» queda seleccionada`, (await tira.nth(4).getAttribute('aria-selected')) === 'true');
  if (esReferencia(celda)) {
    ok('la billetera no trae cabecera propia', (await billetera.locator('app-page-header').count()) === 0);
    const cabeceras = await paciente.locator('app-page-header').count();
    ok('una sola cabecera en la pantalla', cabeceras === 1, `${cabeceras} cabeceras`);
    const textoBilletera = (await billetera.innerText()).trim();
    ok(
      'la billetera dice algo del programa (saldo, vacío o error, nunca en blanco)',
      textoBilletera.length > 0,
      textoBilletera.slice(0, 80).replace(/\s+/g, ' '),
    );
  }
  const tarjeta = await paciente.locator('.mi-perfil__principal').first().boundingBox();
  const caja = await billetera.boundingBox();
  ok(
    `${c} · la billetera queda dentro de la tarjeta`,
    caja && tarjeta && caja.x >= tarjeta.x - 1 && caja.x + caja.width <= tarjeta.x + tarjeta.width + 1,
  );
  ok(`${c} · billetera sin desborde horizontal`, await sinDesborde(paciente));
  await capturar(paciente, `puntos-${c}`);
}

/** 5: el editor, en una celda. */
async function editor(paciente, celda) {
  const c = nombreCelda(celda);
  await abrir(paciente, '/my-account', celda);
  await paciente.getByTestId('mi-perfil-editar').click();
  const tiraEditor = paciente.getByTestId('perfil-pestanas').getByRole('tab');
  await tiraEditor.nth(4).waitFor({ timeout: 30_000 });
  ok(`${c} · editor · «Mis puntos» sigue en la tira`, ((await tiraEditor.nth(4).innerText()) ?? '').trim() === 'Mis puntos');
  ok(`${c} · editor · pero apagada`, (await tiraEditor.nth(4).getAttribute('aria-disabled')) === 'true');
  if (esReferencia(celda)) {
    await tiraEditor.nth(4).click({ force: true }).catch(() => {});
    ok('editor · pulsarla no abre nada', (await tiraEditor.nth(0).getAttribute('aria-selected')) === 'true');
  }
  ok(`${c} · editor sin desborde horizontal`, await sinDesborde(paciente));
  await capturar(paciente, `editor-${c}`);
}

/**
 * 3: por URL directa. En el teléfono, además, se mide si la pestaña activa
 * queda a la vista en la tira: es la entrada de quien llegue por el redirect.
 */
async function urlDirecta(paciente, celda) {
  const c = nombreCelda(celda);
  await abrir(paciente, '/my-account?pestana=puntos', celda);
  await paciente.getByTestId('mi-perfil-puntos').waitFor({ timeout: 30_000 });
  await billeteraResuelta(paciente);
  const tira = paciente.getByTestId('mi-perfil-pestanas').getByRole('tab');
  ok(`${c} · /my-account?pestana=puntos entra en la billetera`, (await tira.nth(4).getAttribute('aria-selected')) === 'true');
  if (celda.ancho < 768) {
    const lista = await paciente.getByTestId('mi-perfil-pestanas').getByRole('tablist').boundingBox();
    const activa = await tira.nth(4).boundingBox();
    const aLaVista = lista && activa && activa.x >= lista.x - 1 && activa.x + activa.width <= lista.x + lista.width + 1;
    observar(
      `${c} · la pestaña activa, a la vista en la tira al entrar por la URL`,
      aLaVista ? 'sí' : 'no: queda fuera de la parte visible de la tira',
    );
  }
  await capturar(paciente, `url-directa-${c}`);
}

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  navegador = await chromium.launch();
  const errores = [];
  const respuestasFeas = [];

  const contexto = await navegador.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'es-BO',
  });
  const paciente = await contexto.newPage();
  paciente.on('pageerror', (e) => errores.push(String(e)));
  paciente.on('console', (m) => {
    if (m.type() === 'error') errores.push(`consola: ${m.text()}`);
  });
  paciente.on('response', (r) => {
    if (r.status() >= 400) respuestasFeas.push(`${r.status()} ${r.url()}`);
  });

  await entrar(paciente, 'paciente@alovida.mock');

  for (const celda of CELDAS) await fichaYBilletera(paciente, celda);

  const referencia = CELDAS[0];
  const telefono = CELDAS.find((celda) => celda.ancho === 390 && celda.tema === 'light');
  await urlDirecta(paciente, referencia);
  await urlDirecta(paciente, telefono);

  await abrir(paciente, '/my-account?pestana=zzz', referencia);
  ok(
    'una clave desconocida cae en la primera pestaña',
    (await paciente.getByTestId('mi-perfil-pestanas').getByRole('tab').nth(0).getAttribute('aria-selected')) ===
      'true',
  );

  /* ── 4. La dirección vieja ya no pinta una pantalla aparte ───────────── */
  await abrir(paciente, '/my-account/loyalty', referencia);
  ok(
    '/my-account/loyalty ya no pinta una pantalla aparte: termina en la ficha',
    new URL(paciente.url()).pathname === '/my-account' && (await paciente.locator('app-loyalty').count()) === 0,
    new URL(paciente.url()).pathname + new URL(paciente.url()).search,
  );
  const tiraVieja = paciente.getByTestId('mi-perfil-pestanas').getByRole('tab');
  const seleccionada = await tiraVieja.evaluateAll((pestanas) =>
    pestanas.find((p) => p.getAttribute('aria-selected') === 'true')?.textContent?.trim(),
  );
  observar('/my-account/loyalty abre la ficha en la pestaña', `«${seleccionada}» (la billetera es «Mis puntos»)`);
  await capturar(paciente, `ruta-vieja-${nombreCelda(referencia)}`);

  for (const celda of CELDAS) await editor(paciente, celda);

  ok('sin errores de página ni de consola', errores.length === 0, errores.slice(0, 3).join(' · '));
  ok('sin respuestas 4xx/5xx', respuestasFeas.length === 0, respuestasFeas.slice(0, 3).join(' · '));

  await cerrarNavegador();

  const fallaron = veredictos.filter((v) => !v.cond);
  process.stdout.write(
    `\n${veredictos.length - fallaron.length}/${veredictos.length} comprobaciones en verde\n` +
      'capturas en docs/frontend/evidence/mis-puntos-quinta-pestana-2026-09-23\n',
  );
  process.exit(fallaron.length === 0 ? 0 : 1);
}

main().catch(async (e) => {
  await cerrarNavegador();
  process.stderr.write(String(e) + '\n');
  process.exit(1);
});
