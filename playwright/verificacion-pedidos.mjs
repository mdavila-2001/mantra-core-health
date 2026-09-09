/**
 * Verificación de los pedidos del 08/09/2026 contra la maqueta (rama mockup).
 *
 * Una pasada por cada pedido que el usuario hizo a las distintas sesiones,
 * con captura y un veredicto ✔/✘ por pantalla. No prueba a fondo cada
 * función: comprueba que lo pedido ESTÉ en la rama que el usuario mira.
 *
 * Uso: `node playwright/verificacion-pedidos.mjs [urlBase]`
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4328';
const SALIDA = new URL('../evidencias/verificacion-pedidos-2026-09-09', import.meta.url).pathname
  .replace(/^\/([A-Za-z]:)/, '$1');
const RUIDO = [/favicon/i, /Content Security Policy/i, /inline script/i];

const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond), detalle });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
  const pagina = await contexto.newPage();

  const errores = [];
  const sinManejador = [];
  pagina.on('console', (m) => {
    const texto = m.text();
    if (/\[mock\] sin manejador/i.test(texto)) sinManejador.push(texto);
    if (m.type() !== 'error') return;
    if (RUIDO.some((p) => p.test(texto))) return;
    errores.push(texto);
  });
  pagina.on('pageerror', (e) => errores.push(String(e)));

  let n = 0;
  const capturar = async (nombre, opciones = {}) => {
    n += 1;
    const archivo = `${String(n).padStart(2, '0')}-${nombre}.png`;
    await pagina.screenshot({ path: `${SALIDA}/${archivo}`, ...opciones });
    process.stdout.write(`  · ${archivo}\n`);
  };
  const esperar = (ms) => pagina.waitForTimeout(ms);
  const textos = async (selector) =>
    (await pagina.locator(selector).allTextContents()).map((t) => t.replace(/\s+/g, ' ').trim());

  /* ── Ingreso como la médica (los directorios con mapa piden sesión) ──── */
  await pagina.goto(`${BASE}/auth`);
  await pagina.getByTestId('login-identifier').fill('medica@alovida.mock');
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
  await esperar(800);
  await capturar('panel-medica');

  /* ── 1 · Chips de ciudad cuelgan del departamento (clínicas y farmacias) ── */
  for (const [ruta, mapa, nombre] of [
    ['/clinics-directory', 'clinicas-mapa', 'clinicas'],
    ['/pharmacies-directory', 'farmacias-mapa', 'farmacias'],
  ]) {
    await pagina.goto(`${BASE}${ruta}`);
    await pagina.locator(`[data-testid^="${mapa}-"]`).first().waitFor({ timeout: 30_000 });
    await esperar(800);
    const antes = await textos('app-directory-page button');
    await capturar(`${nombre}-sin-departamento`, { fullPage: true });
    // La Paz es el único departamento de la maqueta con dos ciudades (La Paz y
    // El Alto): los chips sólo se dibujan cuando hay más de una ciudad entre
    // la que elegir —un chip solo no acota nada—. Santa Cruz tiene 11 fichas
    // pero todas en la misma ciudad, así que ahí no hay renglón de chips.
    const lp = pagina.locator(`[data-testid="${mapa}-LP"]`);
    const objetivo = (await lp.count()) > 0 ? lp : pagina.locator(`[data-testid^="${mapa}-"]`).first();
    const departamento = await objetivo.getAttribute('aria-label');
    await objetivo.click();
    await esperar(1000);
    // Los chips no son <button> sueltos: se buscan por su átomo.
    const nuevos = (await textos('app-chip, .chip, [class*="__chip"]')).filter((t) => !antes.includes(t));
    await capturar(`${nombre}-con-departamento`, { fullPage: true });
    ok(
      `${nombre}: sin departamento no hay chips de ciudad`,
      !antes.some((t) => /santa cruz|cochabamba|la paz|montero|quillacollo|el alto/i.test(t)),
      `botones antes: ${antes.length}`,
    );
    ok(
      `${nombre}: al elegir «${departamento}» aparecen sus ciudades`,
      nuevos.length > 0,
      `chips nuevos: ${nuevos.join(' | ') || 'ninguno'}`,
    );
  }

  /* ── 1b · /search/hospitals sigue con la fila plana (pendiente conocido) ── */
  await pagina.goto(`${BASE}/search/hospitals`);
  await esperar(1500);
  const chipsHosp = await textos('.centros__chip');
  await capturar('hospitales-publico', { fullPage: true });
  ok(
    'hospitales público: el filtro de ciudad pasa por departamento',
    chipsHosp.length === 0 || (await pagina.locator('[data-testid*="mapa"]').count()) > 0,
    `chips planos: ${chipsHosp.join(' | ')}`,
  );

  /* ── 2 · Alta de paciente: departamento de emisión obligatorio (sin sesión) ── */
  {
    const anonimo = await (await navegador.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
    await anonimo.goto(`${BASE}/auth/register/patient`);
    await anonimo.waitForTimeout(2000);
    // El departamento de emisión vive en el paso del documento: se llena el
    // nombre y se avanza con la flecha.
    await anonimo.getByRole('textbox', { name: /primer nombre/i }).fill('Prueba');
    await anonimo.getByRole('textbox', { name: /apellido paterno/i }).fill('Maqueta');
    const siguiente = anonimo.getByRole('button', { name: /siguiente|continuar|avanzar/i }).first();
    if ((await siguiente.count()) > 0) await siguiente.click();
    else await anonimo.locator('form button').last().click();
    await anonimo.waitForTimeout(1500);
    const etiqueta = anonimo.locator('label, legend, span').filter({ hasText: /departamento de emisi/i }).first();
    const textoEtiqueta = (await etiqueta.count()) > 0 ? await etiqueta.evaluate((e) => e.closest('app-form-field, .form-field, label')?.textContent ?? e.textContent) : '';
    n += 1;
    await anonimo.screenshot({ path: `${SALIDA}/${String(n).padStart(2, '0')}-alta-paciente-documento.png`, fullPage: true });
    process.stdout.write(`  · ${String(n).padStart(2, '0')}-alta-paciente-documento.png\n`);
    ok(
      'alta paciente: el departamento de emisión se ve obligatorio',
      /\*|obligatorio/i.test(textoEtiqueta),
      `etiqueta: «${textoEtiqueta.replace(/\s+/g, ' ').trim().slice(0, 80)}»`,
    );
    await anonimo.context().close();
  }

  /* ── 3 · Mi agenda: horario como calendario, sin «Crear agenda» ────────── */
  await pagina.goto(`${BASE}/schedule`);
  await pagina.getByRole('tab', { name: 'Mi agenda' }).waitFor({ timeout: 30_000 });
  ok('consultas: no hay «Crear agenda»', (await pagina.getByRole('link', { name: 'Crear agenda' }).count()) === 0);
  await pagina.getByRole('tab', { name: 'Mi agenda' }).click();
  await pagina.locator('[data-testid="horario-bloque"]').first().waitFor({ timeout: 30_000 });
  ok('mi agenda: grilla calendario con la semana en curso', (await pagina.locator('.grilla__dia--hoy').count()) === 1);
  await capturar('mi-agenda-calendario', { fullPage: true });

  /* ── 4 · Expediente: pestañas marco de ventana, sin «Qué vas a registrar» ── */
  await pagina.goto(`${BASE}/medical-records`);
  await esperar(1500);
  const buscador = pagina.getByRole('textbox').first();
  await buscador.fill('a');
  await esperar(1200);
  await capturar('archivo-clinico-busqueda', { fullPage: true });
  const ver = pagina.getByRole('link', { name: /ver expediente/i }).first();
  ok('archivo clínico: la búsqueda devuelve expedientes', (await ver.count()) > 0);
  if ((await ver.count()) > 0) {
    await ver.click();
    await pagina.locator('app-tabs').first().waitFor({ timeout: 30_000 });
    await esperar(1000);
    const cuerpo = await pagina.locator('body').innerText();
    const browser = await pagina.locator('app-tabs[appearance="browser"], .tabs--browser').count();
    ok('expediente: las pestañas son un marco de ventana', browser > 0);
    ok('expediente: no aparece «Qué vas a registrar» en la ficha', !/qué vas a registrar/i.test(cuerpo));
    ok('expediente: hay botón «Atender» que lleva a Atención', (await pagina.getByTestId('expediente-abrir-atencion').count()) > 0);
    ok('expediente: sigue el PDF de la historia', /descargar pdf|pdf/i.test(cuerpo));
    await capturar('expediente-pestanas', { fullPage: true });
    const atender = pagina.getByTestId('expediente-abrir-atencion');
    if ((await atender.count()) > 0) {
      await atender.click();
      await esperar(1500);
      ok('atención: la escritura vive en su pantalla', /\/encounter/.test(pagina.url()), pagina.url());
      await capturar('atencion-encounter', { fullPage: true });
    }
  }

  /* ── 5 · Generador de formularios (Google Forms) ──────────────────────── */
  await pagina.goto(`${BASE}/form-builder`);
  await esperar(2000);
  const cuerpoForm = await pagina.locator('body').innerText();
  ok('form-builder: la pantalla carga', !/no encontramos|404|no existe/i.test(cuerpoForm));
  await capturar('form-builder', { fullPage: true });

  /* ── 6 · Mis verificaciones (PR #382, ahora en mockup) ────────────────── */
  await pagina.goto(`${BASE}/my-account/identity/verify`);
  await esperar(2000);
  const cuerpoVerif = await pagina.locator('body').innerText();
  ok('mis verificaciones: la pantalla carga', !/no encontramos|404|no existe/i.test(cuerpoVerif));
  await capturar('mis-verificaciones', { fullPage: true });

  /* ── 7 · Mensajería (pendiente del cherry-pick de pablo/chat-whatsapp) ── */
  await pagina.goto(`${BASE}/messaging`);
  await esperar(2000);
  const whatsapp = await pagina.locator('[data-testid="mensajeria-consulta"]').count();
  ok('mensajería: bandeja estilo WhatsApp (buscador + chips)', whatsapp > 0);
  await capturar('mensajeria', { fullPage: true });

  /* ── 8 · Ficha pública de una organización (PR #383 + portada) ────────── */
  await pagina.goto(`${BASE}/clinics-directory`);
  const ficha = pagina.locator('app-directory-page a[href]:not([href="#"])').first();
  // Esperar al enlace y no un rato fijo: el directorio recorre el cursor entero
  // antes de pintar, y con la máquina cargada un segundo y medio no alcanza —
  // daba un rojo que no era del producto.
  await ficha.waitFor({ timeout: 30_000 }).catch(() => undefined);
  if ((await ficha.count()) > 0) {
    await ficha.click();
    await esperar(2000);
    ok('organización: la ficha pública abre', !/no encontramos|404/i.test(await pagina.locator('body').innerText()), pagina.url());
    await capturar('organizacion-ficha-publica', { fullPage: true });
  } else {
    ok('organización: hay enlace a la ficha desde el directorio', false);
  }

  /* ── Resumen ───────────────────────────────────────────────────────────── */
  process.stdout.write(`\nRutas de la maqueta sin manejador: ${sinManejador.length}\n`);
  for (const s of [...new Set(sinManejador)]) process.stdout.write(`  ? ${s}\n`);
  process.stdout.write(`Errores de consola: ${errores.length}\n`);
  for (const e of [...new Set(errores)].slice(0, 15)) process.stdout.write(`  ! ${e.slice(0, 220)}\n`);
  const fallidos = veredictos.filter((v) => !v.cond);
  process.stdout.write(`\n${veredictos.length - fallidos.length}/${veredictos.length} verificaciones en verde\n`);
  await navegador.close();
  process.exit(fallidos.length === 0 ? 0 : 1);
}

main().catch((e) => {
  process.stderr.write(`${e?.stack ?? e}\n`);
  process.exit(2);
});
