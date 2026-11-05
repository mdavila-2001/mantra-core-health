/**
 * Evidencia del catálogo de la farmacia con «Importar CSV» en el membrete y
 * acciones por fila (Editar en modal, Quitar precio, Vaciar), contra el
 * simulador (`mockBackend: true`), 05/11/2026.
 *
 * Cada mutación se comprueba UI → petición (simulada) → persistencia
 * (`sessionStorage` del simulador) → recarga → UI. El cuerpo exacto de cada
 * petición lo fijan las specs con `HttpTestingController`.
 *
 * Uso: `node playwright/catalogo-acciones-por-fila.mjs [urlBase]`
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4300';
const SALIDA = fileURLToPath(new URL('../evidencias/2026-11-05-catalogo-acciones-por-fila', import.meta.url));
const CATALOGO = `${BASE}/administration/pharmacy-catalog`;

const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond), detalle });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

/** The open page, so a failure can leave a screenshot behind. */
let paginaActual = null;

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch(
    process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {},
  );
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1000 } });
  const pagina = await contexto.newPage();
  paginaActual = pagina;
  const errores = [];
  pagina.on('pageerror', (e) => errores.push(String(e)));

  const capturar = (nombre) => pagina.screenshot({ path: `${SALIDA}/${nombre}.png` });
  const persistidos = () =>
    pagina.evaluate(() => {
      const clave = Object.keys(sessionStorage).find((k) => k.includes('mock.pharmacy.productos'));
      return clave === undefined ? [] : (JSON.parse(sessionStorage.getItem(clave) ?? '{}').filas ?? []);
    });
  const persistido = async (codigo) => (await persistidos()).find((p) => p.productCode === codigo);

  async function entrar() {
    await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 240_000 });
    await pagina.getByTestId('login-identifier').fill('farmacia@alovida.mock');
    await pagina.getByTestId('login-password').fill('mockup');
    await pagina.getByTestId('login-submit').click();
    await pagina.waitForURL((url) => !url.pathname.startsWith('/auth') || url.pathname.startsWith('/auth/organization'), { timeout: 60_000 });
    if (pagina.url().includes('/auth/organization')) {
      await pagina.getByTestId('tenant-opcion').first().click();
      await pagina.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 60_000 });
    }
  }

  async function abrir(tab) {
    await pagina.goto(`${CATALOGO}?tab=${tab}`, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await pagina.locator('app-data-table tbody tr').first().waitFor({ timeout: 60_000 });
  }

  /** Picks a row action: a direct button when the row shows them, else the «Acciones» menu. */
  async function accion(fila, rotulo) {
    const directo = fila.getByRole('button', { name: new RegExp(`^${rotulo}`) });
    if ((await directo.count()) > 0) {
      await directo.first().click();
      return;
    }
    await fila.getByRole('button', { name: /Acciones/ }).click();
    await pagina.getByRole('menuitem', { name: rotulo }).click();
  }

  const filaDe = (codigo) => pagina.locator('app-data-table tbody tr', { hasText: codigo }).first();
  const codigoDeLaPrimera = async () =>
    (await pagina.locator('app-data-table tbody tr code').first().textContent()).trim();

  await entrar();

  /* ── 1 · «Importar CSV» arriba, sin pestaña «Importación» ────────────── */
  await abrir('categories');
  const pestanas = await pagina.getByRole('tab').allTextContents();
  ok('cinco pestañas, sin «Importación»', !pestanas.some((t) => t.includes('Importación')), pestanas.map((t) => t.trim()).join(' · '));
  const boton = pagina.getByTestId('catalog-import');
  ok('«Importar CSV» está en el membrete', (await pagina.locator('app-page-header [data-testid="catalog-import"]').count()) === 1);
  await capturar('01-membrete-con-importar');
  await boton.click();
  const modal = pagina.getByRole('dialog', { name: 'Importar CSV' });
  await modal.waitFor({ timeout: 30_000 });
  await pagina.waitForTimeout(600);
  ok('desde Categorías, el modal arranca en Categorías', pagina.url().includes('target=categories') && (await modal.locator('app-entity-import').count()) === 1, pagina.url());
  await capturar('02-modal-importar-categorias');
  await pagina.keyboard.press('Escape');
  await pagina.waitForTimeout(800);
  ok('Esc cierra el modal y la URL vuelve a la pestaña', (await modal.count()) === 0 && pagina.url().includes('tab=categories') && !pagina.url().includes('target='), pagina.url());
  await accion(pagina.locator('app-data-table tbody tr').first(), 'Editar');
  const categoria = pagina.getByRole('dialog', { name: 'Editar categoría' });
  await categoria.waitFor();
  ok('Categorías: «Editar» abre su modal con Guardar y Cancelar', (await categoria.getByRole('button', { name: 'Cancelar' }).count()) === 1);
  await capturar('03-categorias-editar');
  await categoria.getByRole('button', { name: 'Cancelar' }).click();

  /* ── 2 · Precios: Editar en modal → persistido → recarga ─────────────── */
  await abrir('prices');
  const codigo = await codigoDeLaPrimera();
  ok('Precios no tiene campos en la tabla ni «Guardar cambios»', (await pagina.locator('app-data-table input').count()) === 0 && (await pagina.getByTestId('prices-save').count()) === 0);
  await capturar('04-precios-tabla');
  await accion(filaDe(codigo), 'Editar');
  const precio = pagina.getByRole('dialog', { name: 'Editar precio' });
  await precio.waitFor();
  await pagina.getByTestId('price-dialog-input').fill('19,75');
  await capturar('05-precios-modal-editar');
  await pagina.getByTestId('price-dialog-save').click();
  await precio.waitFor({ state: 'detached', timeout: 15_000 }).catch(() => undefined);
  ok('Guardar cierra el modal', (await precio.count()) === 0);
  // The simulator stores the price as `price` (see `pharmacy.handlers.ts`).
  const guardado = (await persistido(codigo))?.price;
  ok('el precio quedó persistido', Number(guardado) === 19.75, String(guardado));
  await abrir('prices');
  ok('tras recargar, la fila muestra 19.75', (await filaDe(codigo).textContent()).includes('19.75'));

  /* ── 3 · Precios: Quitar precio → persistido → recarga ───────────────── */
  await accion(filaDe(codigo), 'Quitar precio');
  const confirmar = pagina.getByRole('alertdialog').or(pagina.getByRole('dialog')).last();
  await confirmar.getByRole('button', { name: 'Quitar precio' }).waitFor();
  await capturar('06-precios-confirmar-quitar');
  await confirmar.getByRole('button', { name: 'Quitar precio' }).click();
  await pagina.waitForTimeout(1200);
  const borrado = (await persistido(codigo))?.price;
  ok('el precio se borró del simulador', borrado === null || borrado === undefined, String(borrado));
  await abrir('prices');
  ok('tras recargar, la fila dice «Sin precio»', (await filaDe(codigo).textContent()).includes('Sin precio'));

  /* ── 4 · Inventario: Editar → persistido → recarga; Vaciar ───────────── */
  await abrir('inventory');
  const enStock = pagina.locator('app-data-table tbody tr', { hasText: 'Disponible' }).first();
  const codigoInv = (await enStock.locator('code').first().textContent()).trim();
  await accion(filaDe(codigoInv), 'Editar');
  const inventario = pagina.getByRole('dialog', { name: 'Editar inventario' });
  await inventario.waitFor();
  await pagina.getByTestId('inventory-dialog-stock').fill('7');
  await pagina.getByTestId('inventory-dialog-minimum').fill('3');
  await capturar('07-inventario-modal-editar');
  await pagina.getByTestId('inventory-dialog-save').click();
  await inventario.waitFor({ state: 'detached', timeout: 15_000 }).catch(() => undefined);
  ok('Guardar cierra el modal de inventario', (await inventario.count()) === 0);
  const inv = await persistido(codigoInv);
  ok('existencias y umbral persistidos', inv?.stock === 7 && inv?.minStock === 3, `stock ${inv?.stock} · umbral ${inv?.minStock}`);
  await abrir('inventory');
  const celdas = (await filaDe(codigoInv).locator('td').allTextContents()).map((t) => t.trim());
  ok('tras recargar, la fila muestra 7 y umbral 3', celdas[1] === '7' && celdas[2] === '3', celdas.slice(0, 3).join(' | '));
  await capturar('08-inventario-tras-editar');
  await accion(filaDe(codigoInv), 'Vaciar');
  const confirmarInv = pagina.getByRole('alertdialog').or(pagina.getByRole('dialog')).last();
  await confirmarInv.getByRole('button', { name: 'Vaciar' }).click();
  await pagina.waitForTimeout(1200);
  ok('Vaciar dejó 0 en el simulador', (await persistido(codigoInv))?.stock === 0, String((await persistido(codigoInv))?.stock));
  await abrir('inventory');
  ok('tras recargar, la fila dice «Sin stock»', (await filaDe(codigoInv).textContent()).includes('Sin stock'));

  /* ── 5 · Enlace viejo ?tab=import y 390 px ───────────────────────────── */
  await pagina.goto(`${CATALOGO}?tab=import&target=prices`, { waitUntil: 'domcontentloaded' });
  const abierto = await modal.waitFor({ timeout: 60_000 }).then(() => true, () => false);
  ok('el enlace viejo `?tab=import` abre el modal', abierto);
  await pagina.waitForTimeout(800);
  await capturar('09-enlace-viejo-abre-modal-precios');
  for (const ancho of [390, 768]) {
    await pagina.setViewportSize({ width: ancho, height: 900 });
    await pagina.waitForTimeout(500);
    const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(`modal de importar sin desborde horizontal a ${ancho} px`, desborde <= 0, `${desborde} px`);
    await capturar(`10-modal-importar-${ancho}`);
  }
  await pagina.keyboard.press('Escape');
  await abrir('prices');
  const desbordePrecios = await pagina.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok('Precios sin desborde horizontal a 768 px', desbordePrecios <= 0, `${desbordePrecios} px`);
  await capturar('11-precios-768');

  ok('sin errores de página', errores.length === 0, errores.join(' | '));
  writeFileSync(`${SALIDA}/veredictos.json`, JSON.stringify(veredictos, null, 2));
  await navegador.close();
  const fallas = veredictos.filter((v) => !v.cond).length;
  process.stdout.write(`\n${veredictos.length - fallas}/${veredictos.length} verificaciones\n`);
  process.exit(fallas === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await paginaActual?.screenshot({ path: `${SALIDA}/fallo.png` }).catch(() => undefined);
  process.exit(2);
});
