/**
 * Evidencia de la ficha de un término del glosario contra la maqueta (rama
 * mockup), pedido del 28/10/2026 («Biopsia», prueba diagnóstica):
 *
 * - Relacionados: la columna larga ocupa la fila y reparte sus vecinos en
 *   varias columnas; la corta crece hasta llenar su fila.
 * - Artículo: la fuente de «Datos» aparece UNA vez aunque cite varias páginas;
 *   las referencias van numeradas.
 * - Sin desborde horizontal; captura de cada pestaña.
 *
 * Uso: `node playwright/glosario-ficha.mjs [urlBase] [carpeta] [ancho] [light|dark] [antes|despues]`
 */
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4333';
const SALIDA = process.argv[3] ?? 'evidencias/glosario-ficha-2026-10-28';
const ANCHO = Number(process.argv[4] ?? 1440);
const TEMA = process.argv[5] ?? 'dark';
const PREFIJO = process.argv[6] ?? 'despues';
const BIOPSIA = '01e07c73-b8b8-434b-a2e7-95384621346e';

const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond), detalle });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch(process.env['PW_CHROMIUM'] ? { executablePath: process.env['PW_CHROMIUM'] } : {});
  const pagina = await (await navegador.newContext({ viewport: { width: ANCHO, height: 1000 } })).newPage();
  const errores = [];
  pagina.setDefaultTimeout(60_000);
  pagina.on('pageerror', (e) => errores.push(String(e)));
  /* `fullPage` agranda la ventana justo al capturar y el panel lateral entra
     en su transición: salía a medio colapsar, tapando el contenido. Se agranda
     la ventana antes, se espera a que la transición termine y se captura. */
  const capturar = async (nombre) => {
    const alto = await pagina.evaluate(() => document.documentElement.scrollHeight);
    await pagina.setViewportSize({ width: ANCHO, height: alto });
    await pagina.waitForTimeout(1500);
    await pagina.screenshot({ path: `${SALIDA}/${PREFIJO}-${nombre}-${ANCHO}-${TEMA}.png` });
    await pagina.setViewportSize({ width: ANCHO, height: 1000 });
  };

  await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 240_000 });
  await pagina.getByTestId('login-identifier').fill('medica@alovida.mock');
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 120_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 90_000 });
  }
  await pagina.evaluate((t) => localStorage.setItem('mantra-core-health.theme', t), TEMA);

  await pagina.goto(`${BASE}/glossary/${BIOPSIA}`, { waitUntil: 'domcontentloaded', timeout: 240_000 });
  await pagina.getByTestId('articulo-enciclopedico').waitFor({ timeout: 90_000 });
  await pagina.waitForTimeout(2500);
  await capturar('articulo');

  const pie = await pagina.locator('#articulo-datos ~ .articulo__cita').innerText().catch(() => '');
  ok('la fuente de «Datos» se nombra una sola vez', (pie.match(/MedlinePlus en español/g) ?? []).length === 1, pie);
  ok('las referencias van numeradas', (await pagina.locator('ol.articulo__referencias li').count()) > 0);

  await pagina.getByRole('tab', { name: 'Relacionados' }).click();
  await pagina.locator('app-relation-groups').first().waitFor({ timeout: 60_000 });
  await pagina.waitForTimeout(1500);
  await capturar('relacionados');
  if (ANCHO >= 1280) {
    const columnas = await pagina.locator('.relation-groups__group--long').first().locator('.relation-groups__list').evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
    );
    ok('la columna larga reparte sus vecinos en varias columnas', columnas >= 2, `${columnas} columnas`);
  }
  // La fila se llena: la larga toma el ancho principal y, si hay columnas
  // cortas, éstas van en un riel a su derecha; ninguna queda estirada sola.
  const bloque = await pagina.locator('.relation-groups__columns').first().boundingBox();
  const cajas = await pagina.locator('.relation-groups__columns').first().locator('.relation-groups__group').evaluateAll(
    (els) => els.map((el) => { const r = el.getBoundingClientRect(); return { x: r.x, w: r.width, larga: el.classList.contains('relation-groups__group--long') }; }),
  );
  const derecha = Math.max(...cajas.map((c) => c.x + c.w));
  const larga = cajas.find((c) => c.larga);
  ok('las columnas llenan la fila, sin hueco a la derecha', bloque && Math.abs(derecha - (bloque.x + bloque.width)) <= 2, `${Math.round(bloque.x + bloque.width - derecha)}px de holgura`);
  ok('la columna larga se lleva el ancho principal', larga && larga.w / bloque.width >= (bloque.width >= 832 ? 0.6 : 0.98), `${Math.round((larga.w / bloque.width) * 100)} %`);
  const cortasAnchas = cajas.filter((c) => !c.larga && c.w / bloque.width > 0.5 && cajas.length > 1 && larga);
  ok('ninguna columna corta se estira a todo el ancho al lado de una larga', cortasAnchas.length === 0 || bloque.width < 832);

  await pagina.getByRole('tab', { name: 'Fuente y código' }).click();
  await pagina.waitForTimeout(1000);
  await capturar('fuente');

  const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('sin desborde horizontal', desborde <= 0, `${desborde}px`);
  ok('sin errores de página', errores.length === 0, errores.join(' | '));

  await navegador.close();
  const fallas = veredictos.filter((v) => !v.cond).length;
  process.stdout.write(`\n${veredictos.length - fallas}/${veredictos.length} verificaciones\n`);
  process.exitCode = fallas === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
