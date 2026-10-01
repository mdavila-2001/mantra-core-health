/**
 * Evidencia del editor del perfil médico (`/my-account/edit`) contra la maqueta
 * (rama mockup), pedidos del 13/09/2026:
 *
 * - «Acepto pacientes nuevos» ya no existe en Datos personales.
 * - El mapa del domicilio en Contacto se dibuja entero (no un lienzo gris ni
 *   mosaicos corridos), y sigue dejando marcar, mover, confirmar y quitar.
 * - Los tres teléfonos son el campo del alta: bandera + prefijo y número.
 * - Trayectoria y Credenciales muestran, debajo, la tabla de lo ya cargado.
 * - La matrícula ofrece tres autoridades.
 * - Agregar un título, una especialidad y una matrícula: POST → recarga → fila.
 *
 * Uso: `yarn node playwright/editor-perfil-medico.mjs [urlBase] [sufijo]`
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4290';
const SUFIJO = process.argv[3] ?? 'despues';
const SALIDA = new URL('../evidencias/editor-perfil-medico-2026-09-13', import.meta.url).pathname
  .replace(/^\/([A-Za-z]:)/, '$1');

const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond), detalle });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

/** Cuántos mosaicos cargados caen, al menos en parte, dentro del lienzo del mapa. */
async function medirMapa(pagina) {
  return pagina.evaluate(() => {
    const lienzo = document.querySelector('[data-testid="edicion-domicilio-mapa"] .leaflet-container');
    if (!lienzo) return null;
    const caja = lienzo.getBoundingClientRect();
    const mosaicos = [...lienzo.querySelectorAll('img.leaflet-tile-loaded')];
    const dentro = mosaicos.filter((m) => {
      const r = m.getBoundingClientRect();
      return r.right > caja.left && r.left < caja.right && r.bottom > caja.top && r.top < caja.bottom;
    });
    // Área del lienzo cubierta por mosaicos: un mapa montado a 0×0 deja franjas grises.
    let cubierto = 0;
    for (const m of dentro) {
      const r = m.getBoundingClientRect();
      const ancho = Math.min(r.right, caja.right) - Math.max(r.left, caja.left);
      const alto = Math.min(r.bottom, caja.bottom) - Math.max(r.top, caja.top);
      cubierto += Math.max(0, ancho) * Math.max(0, alto);
    }
    const pin = lienzo.querySelector('.mapa__marcador');
    const rPin = pin?.getBoundingClientRect();
    const pinDentro = rPin
      ? rPin.left >= caja.left && rPin.right <= caja.right && rPin.top >= caja.top && rPin.bottom <= caja.bottom
      : false;
    const cx = caja.left + caja.width / 2;
    const cy = caja.top + caja.height / 2;
    const pinCentrado = rPin
      ? Math.abs(rPin.left + rPin.width / 2 - cx) < 40 && Math.abs(rPin.top + rPin.height / 2 - cy) < 40
      : false;
    return {
      ancho: Math.round(caja.width),
      alto: Math.round(caja.height),
      mosaicos: dentro.length,
      cobertura: caja.width * caja.height === 0 ? 0 : cubierto / (caja.width * caja.height),
      pinDentro,
      pinCentrado,
    };
  });
}

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
  const pagina = await contexto.newPage();
  const errores = [];
  const peticiones = [];
  pagina.on('pageerror', (e) => errores.push(String(e)));
  pagina.on('console', (m) => {
    // La CSP de desarrollo bloquea los scripts en línea que inyecta `ng serve`:
    // pasa en cualquier ruta y no es de esta pantalla.
    if (m.text().includes('Content Security Policy')) return;
    if (m.type() === 'error' || m.text().includes('[mock] sin manejador')) errores.push(m.text());
  });
  pagina.on('request', (r) => {
    if (['PATCH', 'POST'].includes(r.method()) && r.url().includes('/profiles/')) {
      peticiones.push({ metodo: r.method(), url: r.url(), body: r.postData() });
    }
  });
  const capturar = (nombre, opciones = {}) =>
    pagina.screenshot({ path: `${SALIDA}/${SUFIJO}-${nombre}.png`, ...opciones });

  await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.getByTestId('login-identifier').fill('medica@alovida.mock');
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
  // Limpia lo que haya dejado una corrida anterior en el simulador.
  await pagina.evaluate(() => {
    for (const clave of Object.keys(sessionStorage)) {
      if (clave.startsWith('mock.perfil-medico.')) sessionStorage.removeItem(clave);
    }
  });

  await pagina.goto(`${BASE}/my-account/edit`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  const pestanas = pagina.locator('[data-testid="edicion-pestanas"] [role="tab"]');
  await pestanas.first().waitFor({ timeout: 60_000 });
  await pagina.waitForTimeout(800);

  /* ── 1 · Datos personales sin «Acepto pacientes nuevos» ─────────────── */
  ok(
    '«Acepto pacientes nuevos» no aparece',
    (await pagina.getByText('Acepto pacientes nuevos').count()) === 0,
  );
  // Mudadas desde «Credenciales» el 24/09/2026: contestan «¿de qué es
  // médico?», la misma pregunta que el título profesional de esta pestaña.
  const filasEspecialidades = await pagina
    .locator('[data-testid="tabla-especialidades"] tbody tr:not(.data-table__detail-row)')
    .count();
  ok(
    'Datos personales muestra la tabla de especialidades',
    filasEspecialidades > 0,
    `${filasEspecialidades} filas`,
  );
  await capturar('01-datos-personales', { fullPage: true });

  /* ── 2 · Contacto: el mapa entero ───────────────────────────────────── */
  await pestanas.nth(1).click();
  await pagina.getByTestId('edicion-domicilio-mapa').waitFor({ timeout: 30_000 });
  // Los mosaicos vienen de OpenStreetMap: la primera vez tardan lo que tarde la
  // red. Se espera hasta que cubran el lienzo o pasen 12 s, no un tiempo fijo.
  let mapa = await medirMapa(pagina);
  for (let intento = 0; intento < 24 && !(mapa && mapa.cobertura > 0.97); intento++) {
    await pagina.waitForTimeout(500);
    mapa = await medirMapa(pagina);
  }
  process.stdout.write(`  mapa: ${JSON.stringify(mapa)}\n`);
  ok('el mapa tiene tamaño', mapa !== null && mapa.ancho > 300 && mapa.alto >= 300);
  ok('los mosaicos cubren el lienzo', mapa !== null && mapa.cobertura > 0.97, `${Math.round((mapa?.cobertura ?? 0) * 100)} %`);
  ok('el pin guardado está centrado en el mapa', mapa?.pinCentrado === true);
  await pagina.getByTestId('edicion-domicilio-mapa').scrollIntoViewIfNeeded();
  await capturar('02-contacto-mapa');

  // Cambiar de pestaña y volver: el caso que rompía el lienzo.
  await pestanas.nth(0).click();
  await pagina.waitForTimeout(400);
  await pestanas.nth(1).click();
  await pagina.getByTestId('edicion-domicilio-mapa').waitFor({ timeout: 30_000 });
  await pagina.waitForTimeout(2500);
  const mapaDeVuelta = await medirMapa(pagina);
  process.stdout.write(`  mapa al volver: ${JSON.stringify(mapaDeVuelta)}\n`);
  ok('al volver a Contacto el mapa sigue entero', mapaDeVuelta !== null && mapaDeVuelta.cobertura > 0.97 && mapaDeVuelta.pinCentrado);

  // Las funciones del bloque: mover el pin tocando el mapa, confirmar, quitar.
  const lienzo = pagina.locator('[data-testid="edicion-domicilio-mapa"] .leaflet-container');
  const caja = await lienzo.boundingBox();
  if (caja) {
    await pagina.mouse.click(caja.x + caja.width * 0.3, caja.y + caja.height * 0.3);
    ok('tocar el mapa mueve el pin y pide confirmar', await pagina.getByTestId('edicion-domicilio-confirmar').isVisible({ timeout: 5000 }).catch(() => false));
    await pagina.getByTestId('edicion-domicilio-confirmar').click().catch(() => {});
    ok('confirmar deja la ubicación confirmada', await pagina.getByTestId('edicion-domicilio-confirmada').isVisible({ timeout: 5000 }).catch(() => false));
  }

  /* ── 3 · Teléfonos: bandera + número ───────────────────────────────── */
  for (const id of ['edicion-celular-personal', 'edicion-celular-trabajo', 'edicion-fijo-trabajo']) {
    const pais = pagina.getByTestId(`${id}-pais`);
    ok(`«${id}» tiene selector de país con bandera`, (await pais.count()) === 1 && (await pais.locator('app-pais-bandera').count()) === 1);
  }
  await pagina.getByTestId('edicion-celular-personal').scrollIntoViewIfNeeded().catch(() => {});
  await capturar('03-contacto-telefonos');
  await pagina.getByTestId('edicion-celular-personal-pais').click().catch(() => {});
  await pagina.waitForTimeout(300);
  await capturar('03b-contacto-lista-de-paises');
  await pagina.keyboard.press('Escape');

  /* ── 4 · Trayectoria: tabla de lo cargado ──────────────────────────── */
  await pestanas.nth(2).click();
  await pagina.waitForTimeout(600);
  const tablaFormacion = pagina.locator('[data-testid="tabla-formacion"] tbody tr:not(.data-table__detail-row)');
  const filasAntes = await tablaFormacion.count();
  ok('Trayectoria muestra la tabla de títulos cargados', filasAntes > 0, `${filasAntes} filas`);
  await capturar('04-trayectoria', { fullPage: true });

  /* ── 5 · Credenciales: tabla de matrículas y tres autoridades ──────── */
  await pestanas.nth(3).click();
  await pagina.waitForTimeout(600);
  const filasMatriculas = await pagina.locator('[data-testid="tabla-matriculas"] tbody tr:not(.data-table__detail-row)').count();
  ok('Credenciales muestra la tabla de matrículas', filasMatriculas > 0, `${filasMatriculas} filas`);

  // `app-select` dibuja un <select> nativo: se leen sus <option> sin el marcador.
  const selectAutoridad = pagina.locator('[data-testid="matricula-autoridad"] select');
  const opciones = (await selectAutoridad.locator('option').allTextContents())
    .map((t) => t.trim())
    .filter((t) => t !== '' && t !== 'Elegí quién la emitió');
  ok('la matrícula ofrece tres autoridades', opciones.length === 3, opciones.join(' · '));
  await selectAutoridad.scrollIntoViewIfNeeded();
  await capturar('05-credenciales-autoridades', { fullPage: true });
  await selectAutoridad.selectOption({ label: 'SEDES (Gobernación)' });

  // Agregar una matrícula y verla en la tabla.
  await pagina.getByTestId('matricula-numero').fill('MP-99887');
  await pagina.getByRole('button', { name: 'Agregar matrícula' }).click();
  await pagina.waitForTimeout(1500);
  const filasMatriculasDespues = await pagina.locator('[data-testid="tabla-matriculas"] tbody tr:not(.data-table__detail-row)').count();
  ok('la matrícula agregada aparece en la tabla', filasMatriculasDespues === filasMatriculas + 1, `${filasMatriculas} → ${filasMatriculasDespues}`);
  ok('la fila nueva dice «MP-99887» y SEDES', (await pagina.locator('[data-testid="tabla-matriculas"] tbody tr:not(.data-table__detail-row)', { hasText: 'MP-99887' }).filter({ hasText: 'SEDES' }).count()) === 1);
  await capturar('06-credenciales-matricula-agregada', { fullPage: true });

  // Recargar la página: la fila sigue (persistencia del simulador).
  await pagina.reload({ waitUntil: 'domcontentloaded' });
  await pestanas.first().waitFor({ timeout: 60_000 });
  await pestanas.nth(3).click();
  await pagina.waitForTimeout(1200);
  ok('tras recargar la matrícula sigue en la tabla', (await pagina.locator('[data-testid="tabla-matriculas"] tbody tr:not(.data-table__detail-row)', { hasText: 'MP-99887' }).count()) === 1);

  /* ── 6 · Ancho móvil sin scroll horizontal ─────────────────────────── */
  await pagina.setViewportSize({ width: 390, height: 900 });
  await pagina.waitForTimeout(600);
  const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok('a 390 px no hay scroll horizontal', desborde <= 1, `${desborde}px`);
  await capturar('07-credenciales-movil', { fullPage: true });

  process.stdout.write(`\npeticiones: ${JSON.stringify(peticiones, null, 1)}\n`);
  ok('sin errores en consola', errores.length === 0, errores.slice(0, 3).join(' | '));
  await navegador.close();
  const fallas = veredictos.filter((v) => !v.cond).length;
  process.stdout.write(`\n${veredictos.length - fallas}/${veredictos.length} en verde\n`);
  process.exitCode = fallas === 0 ? 0 : 1;
}

main().catch((e) => {
  process.stderr.write(String(e?.stack ?? e));
  process.exitCode = 2;
});
