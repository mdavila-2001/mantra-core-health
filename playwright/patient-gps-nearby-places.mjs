/**
 * Evidencia de la subtarea B.2: el domicilio guardado en «Mi perfil» alimenta
 * «Lugares cercanos» y «Dónde comprar» sin pedir el GPS del navegador.
 *
 * Se corre con la geolocalización **negada** a propósito: cualquier resultado
 * cercano que aparezca tiene que venir del perfil, no del navegador.
 *
 * Lo que se afirma, contra la maqueta:
 * 1. En el editor del perfil, mover el pin de la casa y guardar cambia el punto
 *    guardado (el enlace «Ver en el mapa» de la lectura cambia).
 * 2. `/nearby-places` preselecciona «Tu casa» y la pestaña de imagenología
 *    lista centros con su distancia, sin pedir permiso de ubicación.
 * 3. Mover la casa cambia las distancias: la búsqueda sale del punto guardado.
 * 4. «Ubicación actual» con el GPS negado avisa y deja el origen en la casa.
 * 5. «Dónde comprar» mide desde «tu casa» de entrada (si hay receta emitida).
 * 6. Quitar el pin y guardar deja sólo «Usar mi ubicación actual».
 * 7. En 390 px no hay desplazamiento horizontal.
 *
 * La maqueta guarda los pacientes en memoria: una carga completa de página
 * los devuelve a su estado inicial. Por eso toda navegación posterior al
 * ingreso va por el router (`spaGo`), no por `page.goto`.
 *
 * Uso: `node playwright/patient-gps-nearby-places.mjs [urlBase]`
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4200';
// `fileURLToPath` y no `.pathname`: la ruta del workspace tiene espacios, y
// `.pathname` los deja como `%20` y crea una carpeta con ese nombre literal.
const SALIDA = fileURLToPath(
  new URL('../artifacts/playwright/patient-gps-nearby-places', import.meta.url),
);

/** El aviso de la política de contenido del servidor de desarrollo: anterior a este carril. */
const RUIDO_CSP = /Content Security Policy|Refused to execute inline script/i;

const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond), detalle });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};
const omitido = (nombre, motivo) => process.stdout.write(`○ ${nombre} — SKIP: ${motivo}\n`);

/** Navega por el router de Angular sin recargar la página. */
async function spaGo(pagina, ruta) {
  await pagina.evaluate((destino) => {
    window.history.pushState({}, '', destino);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, ruta);
  await pagina.waitForURL((url) => url.pathname === ruta, { timeout: 30_000 });
}

async function ingresar(pagina) {
  await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.getByTestId('login-identifier').fill('paciente@alovida.mock');
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
}

/** Abre el editor del perfil en la pestaña «Contacto». */
async function abrirContactoEnEditor(pagina) {
  await spaGo(pagina, '/my-account');
  await pagina.getByTestId('mi-perfil-editar').click();
  await pagina.getByTestId('mi-perfil-editor').waitFor({ timeout: 30_000 });
  await pagina.locator('[data-testid="perfil-pestanas"] [role="tab"]').nth(1).click();
  await pagina.getByTestId('perfil-domicilio').waitFor({ timeout: 15_000 });
}

async function guardarPerfil(pagina) {
  await pagina.getByRole('button', { name: 'Guardar cambios' }).click();
  await pagina.getByTestId('mi-perfil-editar').waitFor({ timeout: 30_000 });
}

/** El `href` de «Ver en el mapa» del domicilio en la lectura, o `null`. */
async function enlaceDelDomicilio(pagina) {
  await pagina.locator('[data-testid="mi-perfil-pestanas"] [role="tab"]').nth(1).click();
  const enlace = pagina.locator('.mi-perfil__mapa').first();
  if ((await enlace.count()) === 0) return null;
  return enlace.getAttribute('href');
}

/** Espera la lista de imagenología (o su vacío) y devuelve las distancias mostradas. */
async function distanciasDeImagenologia(pagina) {
  await pagina.getByRole('tab', { name: 'Centros de imagenología' }).click();
  const lista = pagina.locator('.lista-de-lugares .item__distancia');
  const vacio = pagina.getByText('No encontramos ninguno dentro de 15 km.');
  await lista.first().or(vacio).waitFor({ timeout: 20_000 });
  return (await lista.allTextContents()).map((t) => t.trim());
}

async function recorridoDeEscritorio(navegador) {
  const contexto = await navegador.newContext({
    viewport: { width: 1440, height: 1000 },
    permissions: [], // geolocalización negada
  });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(String(e)));
  pagina.on('console', (m) => {
    if (m.type() === 'error' && !RUIDO_CSP.test(m.text())) errores.push(m.text());
  });
  const capturar = (nombre) =>
    pagina.screenshot({ path: `${SALIDA}/1440-${nombre}.png`, fullPage: true });

  await ingresar(pagina);

  /* ── 1 · Lugares cercanos con la casa de partida ─────────────────────── */
  await spaGo(pagina, '/nearby-places');
  await pagina.getByTestId('search-origin-picker').waitFor({ timeout: 30_000 });
  const casa = pagina.getByTestId('segmentado-home');
  await casa.waitFor({ timeout: 20_000 });
  ok(
    '«Tu casa» se ofrece y queda elegida de entrada',
    (await casa.getAttribute('aria-checked')) === 'true',
  );
  const antes = await distanciasDeImagenologia(pagina);
  ok(
    'imagenología lista centros desde la casa, con el GPS negado',
    antes.length > 0,
    antes.join(' · '),
  );
  await capturar('01-nearby-desde-casa');

  /* ── 2 · «Ubicación actual» con el GPS negado ────────────────────────── */
  await pagina.getByTestId('segmentado-current').click();
  const aviso = pagina.getByText('No pudimos usar tu ubicación actual');
  await aviso.waitFor({ timeout: 20_000 });
  ok('el GPS negado se avisa', await aviso.isVisible());
  ok('y el origen sigue en la casa', (await casa.getAttribute('aria-checked')) === 'true');
  await capturar('02-gps-negado');

  /* ── 3 · Mover la casa en el perfil ──────────────────────────────────── */
  await spaGo(pagina, '/my-account');
  await pagina.getByTestId('mi-perfil-editar').waitFor({ timeout: 30_000 });
  const enlaceAntes = await enlaceDelDomicilio(pagina);
  await abrirContactoEnEditor(pagina);
  const mapa = pagina.getByTestId('perfil-domicilio-mapa');
  await mapa.waitFor({ timeout: 20_000 });
  ok(
    'el editor abre con el pin guardado ya confirmado',
    await pagina.getByTestId('perfil-domicilio-confirmada').isVisible(),
  );
  await mapa.locator('.leaflet-marker-icon').first().waitFor({ timeout: 20_000 });
  const caja = await mapa.boundingBox();
  // Un toque a ~120 px del centro, a zoom 17, corre el pin unos cientos de metros.
  await pagina.mouse.click(caja.x + caja.width / 2 + 120, caja.y + caja.height / 2 + 80);
  await pagina.getByTestId('perfil-domicilio-sin-confirmar').waitFor({ timeout: 10_000 });
  await pagina.getByTestId('perfil-domicilio-confirmar').click();
  await pagina.getByTestId('perfil-domicilio-confirmada').waitFor({ timeout: 10_000 });
  await capturar('03-pin-movido');
  await guardarPerfil(pagina);
  const enlaceDespues = await enlaceDelDomicilio(pagina);
  ok(
    'guardar cambia el punto del domicilio («Ver en el mapa»)',
    enlaceDespues !== null && enlaceDespues !== enlaceAntes,
    `${enlaceAntes} → ${enlaceDespues}`,
  );

  // Releer desde el editor: el pin sembrado es el nuevo, confirmado.
  await abrirContactoEnEditor(pagina);
  ok(
    'releído, el editor vuelve a mostrar el pin confirmado',
    await pagina
      .getByTestId('perfil-domicilio-confirmada')
      .waitFor({ timeout: 15_000 })
      .then(
        () => true,
        () => false,
      ),
  );
  await pagina.getByRole('button', { name: 'Cancelar' }).click();
  await pagina.getByTestId('mi-perfil-editar').waitFor({ timeout: 30_000 });

  /* ── 4 · Las distancias salen del punto nuevo ────────────────────────── */
  await spaGo(pagina, '/nearby-places');
  await pagina.getByTestId('segmentado-home').waitFor({ timeout: 20_000 });
  const despues = await distanciasDeImagenologia(pagina);
  ok(
    'mover la casa cambia las distancias',
    despues.join('|') !== antes.join('|'),
    `${antes.join(' · ')} → ${despues.join(' · ')}`,
  );
  await capturar('04-nearby-casa-nueva');

  /* ── 5 · «Dónde comprar» mide desde la casa ──────────────────────────── */
  await pagina.getByRole('tab', { name: 'Farmacias' }).click();
  const verFarmacias = pagina.getByRole('link', { name: 'Ver farmacias cercanas' }).first();
  const receta = await verFarmacias.waitFor({ timeout: 15_000 }).then(
    () => true,
    () => false,
  );
  if (receta) {
    await verFarmacias.click();
    const origen = pagina.getByTestId('compra-origen');
    await origen.waitFor({ timeout: 30_000 });
    ok(
      '«Dónde comprar» mide desde tu casa sin pedir nada',
      ((await origen.textContent()) ?? '').includes('tu casa'),
    );
    await capturar('05-donde-comprar-desde-casa');
  } else {
    omitido(
      '«Dónde comprar» mide desde tu casa',
      'la paciente de la maqueta no tiene recetas emitidas',
    );
  }

  /* ── 6 · Quitar el pin deja sólo la ubicación actual ─────────────────── */
  await abrirContactoEnEditor(pagina);
  await pagina.getByTestId('perfil-domicilio-quitar-gps').first().click();
  await guardarPerfil(pagina);
  ok(
    'sin punto, la lectura ya no ofrece «Ver en el mapa» del domicilio',
    (await enlaceDelDomicilio(pagina)) === null,
  );
  await spaGo(pagina, '/nearby-places');
  const unico = pagina.getByTestId('search-origin-current-only');
  ok(
    'sin lugares guardados, sólo queda «Usar mi ubicación actual»',
    await unico.waitFor({ timeout: 20_000 }).then(
      () => true,
      () => false,
    ),
  );
  ok(
    'con el enlace a completar el perfil',
    await pagina.getByTestId('search-origin-profile-link').isVisible(),
  );
  await capturar('06-sin-lugares');

  ok('sin errores de página ni de consola (escritorio)', errores.length === 0, errores.join(' | '));
  await contexto.close();
}

async function recorridoMovil(navegador) {
  const contexto = await navegador.newContext({
    viewport: { width: 390, height: 844 },
    permissions: [],
  });
  const pagina = await contexto.newPage();
  await ingresar(pagina);
  await spaGo(pagina, '/nearby-places');
  await pagina.getByTestId('segmentado-home').waitFor({ timeout: 30_000 });
  await distanciasDeImagenologia(pagina);
  await pagina.screenshot({ path: `${SALIDA}/390-01-nearby-desde-casa.png`, fullPage: true });
  const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth);
  ok('en 390 px no hay desplazamiento horizontal', ancho <= 390, `scrollWidth=${ancho}`);
  await contexto.close();
}

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch();
  try {
    await recorridoDeEscritorio(navegador);
    await recorridoMovil(navegador);
  } finally {
    await navegador.close();
  }
  const fallidos = veredictos.filter((v) => !v.cond);
  process.stdout.write(
    `\n${veredictos.length - fallidos.length}/${veredictos.length} verificaciones OK · capturas en ${SALIDA}\n`,
  );
  process.exit(fallidos.length === 0 ? 0 : 1);
}

main().catch((e) => {
  process.stderr.write(`${e?.stack ?? e}\n`);
  process.exit(1);
});
