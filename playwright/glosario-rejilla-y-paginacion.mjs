/**
 * Evidencia del glosario contra la maqueta (rama mockup), pedidos del
 * 13/09/2026:
 *
 * 1. Las categorías en rejilla: ninguna tarjeta recortada ni desplazamiento
 *    lateral.
 * 2. Las definiciones en tarjetas de mejor calidad.
 * 3. Paginación del cuerpo, con el abecedario saltando de página.
 *
 * Uso: `yarn node playwright/glosario-rejilla-y-paginacion.mjs [urlBase] [carpeta]`
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4333';
const SALIDA = process.argv[3] ?? 'evidencias/glosario-2026-09-13';

const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond), detalle });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

async function esperarCuerpo(pagina) {
  await pagina.locator('.glosario__entrada').first().waitFor({ timeout: 60_000 });
  await pagina.waitForTimeout(500);
}

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch();
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(String(e)));
  const capturar = (nombre, opciones = {}) =>
    pagina.screenshot({ path: `${SALIDA}/${nombre}.png`, ...opciones });

  await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.getByTestId('login-identifier').fill('medica@alovida.mock');
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }

  /* ── 1 · Rejilla de categorías ────────────────────────────────────────── */
  await pagina.goto(`${BASE}/glossary`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await esperarCuerpo(pagina);

  const rejilla = pagina.locator('.glosario__rejilla');
  const desborde = await rejilla.evaluate((el) => el.scrollWidth - el.clientWidth);
  ok('la rejilla no desborda en horizontal', desborde <= 0, `${desborde}px`);
  const columnas = await rejilla.evaluate(
    (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
  );
  ok('la rejilla reparte en varias columnas', columnas >= 3, `${columnas} columnas`);
  const cajaRejilla = await rejilla.boundingBox();
  const cajas = await pagina
    .locator('.glosario__tarjeta')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON()));
  const recortadas = cajas.filter((c) => c.right > cajaRejilla.x + cajaRejilla.width + 1);
  ok(
    'ninguna tarjeta de categoría queda fuera',
    recortadas.length === 0,
    `${cajas.length} tarjetas`,
  );
  const filas = new Set(cajas.map((c) => Math.round(c.top)));
  ok('las categorías ocupan más de una fila', filas.size > 1, `${filas.size} filas`);
  await capturar('01-categorias-rejilla');

  /* ── 2 · Tarjetas de definición + paginación ─────────────────────────── */
  const entradas = await pagina.locator('.glosario__entrada').count();
  ok('la primera página muestra 12 tarjetas', entradas === 12, `${entradas}`);
  const rango = (await pagina.locator('.pagination__range').textContent())?.trim();
  ok('el paginador dice el rango', /^1–12 de \d+$/.test(rango ?? ''), rango);
  const altos = await pagina
    .locator('.glosario__tramo')
    .first()
    .locator('.glosario__entrada')
    .evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().height)));
  process.stdout.write(`  altos del primer tramo: ${altos.join(', ')}\n`);
  await pagina
    .locator('.glosario__cuerpo')
    .screenshot({ path: `${SALIDA}/02-tarjetas-pagina-1.png` });

  await pagina.getByRole('button', { name: 'Página 2' }).click();
  await pagina.waitForTimeout(700);
  const rango2 = (await pagina.locator('.pagination__range').textContent())?.trim();
  ok('la página 2 cambia el rango', /^13–24 de \d+$/.test(rango2 ?? ''), rango2);
  const tituloArriba = await pagina.locator('#glosario-cuerpo-titulo').boundingBox();
  ok(
    'al cambiar de página vuelve al principio del cuerpo',
    tituloArriba.y < 400,
    `y=${Math.round(tituloArriba.y)}`,
  );
  await capturar('03-pagina-2');

  const letras = pagina.locator('.glosario__abecedario button');
  const ultima = letras.last();
  const letra = (await ultima.textContent())?.trim();
  await ultima.click();
  await pagina.waitForTimeout(900);
  ok(
    `el abecedario salta a la «${letra}» en su página`,
    (await pagina.locator(`#glosario-letra-${letra}`).count()) === 1,
  );
  await capturar('04-salto-de-letra');

  /* ── 3 · La URL que mandó el usuario ─────────────────────────────────── */
  await pagina.goto(`${BASE}/glossary?category=glossary-category-specialty`, {
    waitUntil: 'domcontentloaded',
    timeout: 180_000,
  });
  await esperarCuerpo(pagina);
  ok(
    'la categoría activa se marca',
    (await pagina.locator('.glosario__tarjeta--activa').count()) === 1,
  );
  ok('hay paginador también con categoría', (await pagina.locator('app-pagination').count()) === 1);
  await capturar('05-categoria-especialidades', { fullPage: true });

  /* ── 4 · Teléfono ────────────────────────────────────────────────────── */
  await pagina.setViewportSize({ width: 400, height: 900 });
  await pagina.waitForTimeout(500);
  const desbordePagina = await pagina.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  ok('a 400px la página no desborda en horizontal', desbordePagina <= 0, `${desbordePagina}px`);
  await capturar('06-telefono', { fullPage: true });

  ok('sin errores de página', errores.length === 0, errores.join(' | '));
  await navegador.close();

  const fallas = veredictos.filter((v) => !v.cond);
  process.stdout.write(
    `\n${veredictos.length - fallas.length}/${veredictos.length} verificaciones\n`,
  );
  process.exit(fallas.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
