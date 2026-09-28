/**
 * Evidencia del «Catálogo de productos» de la farmacia contra el simulador
 * (`mockBackend: true`), 28/09/2026.
 *
 * - UNA tarjeta centrada a lo ancho con tres pestañas (composition-rules §5).
 * - Alta: UI → POST (simulado) → persistencia (`sessionStorage` del simulador)
 *   → recarga → el producto sigue en la lista.
 * - Importación masiva: archivo → revisión → publicación en serie → recarga →
 *   los productos importados siguen en la lista.
 * - Retiro: confirmación → DELETE (simulado) → recarga → ya no está.
 * - 390 / 768 / 1440 sin desborde horizontal.
 *
 * El simulador intercepta dentro de Angular: las peticiones no salen a la red
 * y Playwright no las ve. Lo que se comprueba es su efecto persistido y la
 * pantalla después de recargar. El cuerpo exacto de cada petición lo fija
 * `pharmacy-catalog.spec.ts` con `HttpTestingController`.
 *
 * Uso: `node playwright/catalogo-farmacia.mjs [urlBase]`
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4300';
const SALIDA = fileURLToPath(new URL('../evidencias/catalogo-farmacia-2026-09-28', import.meta.url));
const FARMACIA = 'Farmacia Vida';
const CODIGO_ALTA = `EVI-${Date.now().toString(36).toUpperCase()}`;

const veredictos = [];
const ok = (nombre, cond, detalle = '') => {
  veredictos.push({ nombre, cond: Boolean(cond), detalle });
  process.stdout.write(`${cond ? '✔' : '✘'} ${nombre}${detalle ? ' — ' + detalle : ''}\n`);
};

async function main() {
  mkdirSync(SALIDA, { recursive: true });
  const navegador = await chromium.launch(
    process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {},
  );
  // Alto de sobra y capturas de ventana, no `fullPage`: la captura de página
  // completa deja el velo de la barra lateral encima del contenido a 1440 (le
  // pasa igual a «Pedidos de farmacia»; es del shell, no de esta pantalla).
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1700 } });
  const pagina = await contexto.newPage();
  const errores = [];
  const sinManejador = [];
  pagina.on('pageerror', (e) => errores.push(String(e)));
  pagina.on('console', (m) => {
    if (m.text().includes('[mock]')) sinManejador.push(m.text());
  });
  pagina.on('dialog', (d) => d.accept());

  const capturar = (nombre, opciones = {}) =>
    pagina.screenshot({ path: `${SALIDA}/${nombre}.png`, ...opciones });
  const medir = async (selector) => pagina.locator(selector).first().boundingBox();
  const tabla = () => pagina.getByTestId('catalogo-tabla');
  const pestana = (nombre) => pagina.getByRole('tab', { name: nombre });
  const productosPersistidos = () =>
    pagina.evaluate(() => {
      const clave = Object.keys(sessionStorage).find((k) => k.includes('mock.pharmacy.productos'));
      // El simulador guarda `{ build, filas }`: ver `Coleccion.guardar`.
      return clave === undefined ? [] : (JSON.parse(sessionStorage.getItem(clave) ?? '{}').filas ?? []);
    });

  async function abrirCatalogo() {
    await pagina.goto(`${BASE}/administration/pharmacy-catalog`, {
      waitUntil: 'domcontentloaded',
      timeout: 180_000,
    });
    await pagina.getByRole('combobox', { name: 'Farmacia' }).waitFor({ timeout: 60_000 });
    await pagina.getByRole('combobox', { name: 'Farmacia' }).selectOption({ label: FARMACIA });
    await pagina.getByTestId('catalogo-tarjeta').waitFor({ timeout: 30_000 });
    await tabla().locator('tbody tr').first().waitFor({ timeout: 30_000 });
  }

  async function buscar(termino) {
    const campo = pagina.locator('.catalogo__buscador input');
    await campo.fill(termino);
    await campo.press('Enter');
    await pagina.waitForTimeout(700);
  }

  /* ── Sesión ─────────────────────────────────────────────────────────── */
  await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.getByTestId('login-identifier').fill('admin@alovida.mock');
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }

  /* ── 1 · Lectura y geometría ────────────────────────────────────────── */
  await abrirCatalogo();
  const main = await medir('.app-main__inner');
  const tarjeta = await medir('[data-testid="catalogo-tarjeta"]');
  const izq = tarjeta.x - main.x;
  const der = main.x + main.width - (tarjeta.x + tarjeta.width);
  ok('la tarjeta está centrada (≤ 2 px de diferencia)', Math.abs(izq - der) <= 2, `izq ${Math.round(izq)} · der ${Math.round(der)}`);
  ok('la tarjeta ocupa ≥ 85 % del área', tarjeta.width >= main.width * 0.85, `${Math.round(tarjeta.width)} de ${Math.round(main.width)} px`);
  const rotulos = (await pagina.getByRole('tab').allTextContents()).map((t) => t.trim());
  ok('tres pestañas en una tarjeta', rotulos.join(' · ') === 'Productos · Nuevo producto · Importación masiva', rotulos.join(' · '));
  const filasIniciales = await tabla().locator('tbody tr').count();
  ok('el catálogo de la farmacia se lista', filasIniciales > 0, `${filasIniciales} filas en la primera página`);
  await capturar('01-productos-1440');

  /* ── 2 · Alta de un producto ────────────────────────────────────────── */
  await pestana('Nuevo producto').click();
  await pagina.getByTestId('catalogo-guardar').click();
  const avisoDeErrores = await pagina
    .getByTestId('catalogo-errores-alta')
    .waitFor({ timeout: 5_000 })
    .then(() => true, () => false);
  ok('publicar en blanco muestra los errores y no guarda', avisoDeErrores);
  await capturar('02-alta-errores');

  const antes = (await productosPersistidos()).length;
  await pagina.getByTestId('catalogo-campo-codigo').fill(CODIGO_ALTA);
  await pagina.getByTestId('catalogo-campo-marca').fill('Ibuprofeno Evidencia');
  await pagina.getByTestId('catalogo-campo-generico').fill('Ibuprofeno');
  await pagina.getByTestId('catalogo-campo-concentracion').fill('400 mg');
  await pagina.getByTestId('catalogo-campo-presentacion').fill('Caja x 20 comprimidos');
  await pagina.getByTestId('catalogo-campo-gtin').fill('7501031311309');
  await pagina.getByRole('combobox', { name: '¿Se vende bajo receta?' }).selectOption({ label: 'No' });
  await capturar('03-alta-completa');
  await pagina.getByTestId('catalogo-guardar').click();
  await pestana('Productos').waitFor();
  await pagina.waitForTimeout(700);
  ok('después del alta vuelve a la pestaña Productos', (await pestana('Productos').getAttribute('aria-selected')) === 'true');

  const despues = await productosPersistidos();
  // Hasta la primera escritura el simulador no guarda nada: `antes` es 0 y lo
  // que se mira es que el código nuevo esté entre lo persistido.
  ok('el alta quedó persistida en el simulador', despues.some((p) => p.productCode === CODIGO_ALTA) && (antes === 0 || despues.length === antes + 1), `${antes} → ${despues.length}`);

  await pagina.reload({ waitUntil: 'domcontentloaded' });
  await abrirCatalogo();
  await buscar(CODIGO_ALTA);
  ok('tras recargar, el producto nuevo sigue en el catálogo', (await tabla().textContent()).includes(CODIGO_ALTA));
  await capturar('04-alta-tras-recarga');

  /* ── 3 · Importación masiva ─────────────────────────────────────────── */
  const sufijo = Date.now().toString(36).toUpperCase();
  const csv = [
    'Código;Marca;Principio activo;Concentración;Presentación;Receta;Código de barras;stock',
    `IMP-${sufijo}-1;Amoxicilina Evidencia;Amoxicilina;500 mg;Caja x 21 cápsulas;sí;;30`,
    `IMP-${sufijo}-2;;Loratadina;10 mg;Caja x 10;no;;12`,
    `IMP-${sufijo}-3;Omeprazol Evidencia;Omeprazol;20 mg;Caja x 14;talvez;;5`,
    `${CODIGO_ALTA};Repetido del catálogo;;;;no;;1`,
    `IMP-${sufijo}-5;Gel Evidencia;;;Frasco 250 ml;no;1234567890123;9`,
  ].join('\r\n');
  const rutaCsv = `${SALIDA}/carga-de-prueba.csv`;
  writeFileSync(rutaCsv, csv, 'utf8');

  await pestana('Importación masiva').click();
  await capturar('05-importar-archivo');
  await pagina.locator('app-file-input input[type="file"]').setInputFiles(rutaCsv);
  await pagina.getByTestId('catalogo-revision').waitFor({ timeout: 30_000 });
  const revision = await pagina.getByTestId('catalogo-revision').textContent();
  ok('la revisión separa 2 listas de 3 a corregir', /2\s+filas listas/.test(revision) && /3\s+filas a corregir/.test(revision), revision.replace(/\s+/g, ' ').trim());
  ok('avisa la columna que ignora', (await pagina.textContent('body')).includes('stock: el catálogo todavía no guarda'));
  await capturar('06-importar-revision');

  const antesDeImportar = (await productosPersistidos()).length;
  await pagina.getByTestId('catalogo-publicar-carga').click();
  await pagina.getByTestId('catalogo-resultado').waitFor({ timeout: 60_000 });
  const resultado = await pagina.getByTestId('catalogo-resultado').textContent();
  ok('publica las 2 filas listas', /2\s+productos publicados/.test(resultado), resultado.replace(/\s+/g, ' ').trim());
  await capturar('07-importar-resultado');
  ok('la importación quedó persistida', (await productosPersistidos()).length === antesDeImportar + 2);

  await pagina.reload({ waitUntil: 'domcontentloaded' });
  await abrirCatalogo();
  await buscar(`IMP-${sufijo}`);
  const textoImportados = await tabla().textContent();
  ok('tras recargar, están los importados y no los rechazados', textoImportados.includes(`IMP-${sufijo}-1`) && textoImportados.includes(`IMP-${sufijo}-2`) && !textoImportados.includes(`IMP-${sufijo}-3`));
  await capturar('08-importados-tras-recarga');

  /* ── 4 · Retiro ─────────────────────────────────────────────────────── */
  await buscar(CODIGO_ALTA);
  const fila = tabla().locator('tbody tr', { hasText: CODIGO_ALTA });
  await fila.getByRole('button', { name: /Retirar/ }).click();
  const confirmar = pagina.getByRole('dialog').getByRole('button', { name: 'Retirar' });
  await confirmar.waitFor({ timeout: 10_000 });
  await capturar('09-retiro-confirmacion');
  await confirmar.click();
  await pagina.waitForTimeout(900);
  const retirado = (await productosPersistidos()).find((p) => p.productCode === CODIGO_ALTA);
  ok('el retiro quedó persistido como borrado lógico', retirado?.retirado === true);
  await pagina.reload({ waitUntil: 'domcontentloaded' });
  await abrirCatalogo();
  await buscar(CODIGO_ALTA);
  ok('tras recargar, el retirado ya no se lista', !(await pagina.getByTestId('catalogo-tarjeta').textContent()).includes(`${CODIGO_ALTA}`) || (await tabla().locator('tbody tr').count()) === 0);
  await capturar('10-retirado-tras-recarga');

  /* ── 5 · Anchos ─────────────────────────────────────────────────────── */
  await buscar('');
  for (const [ancho, alto] of [[390, 844], [768, 1024], [1440, 1700]]) {
    await pagina.setViewportSize({ width: ancho, height: alto });
    await pagina.waitForTimeout(500);
    const desborde = await pagina.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(`${ancho}px sin desborde horizontal`, desborde <= 0, `${desborde}px`);
    await capturar(`11-productos-${ancho}`, { fullPage: ancho < 1120 });
    await pestana('Nuevo producto').click();
    await pagina.waitForTimeout(300);
    await capturar(`12-alta-${ancho}`, { fullPage: ancho < 1120 });
    await pestana('Productos').click();
  }

  ok('sin errores de página', errores.length === 0, errores.join(' | '));
  ok('el simulador atendió todo (sin «sin manejador»)', sinManejador.length === 0, sinManejador.join(' | '));

  writeFileSync(`${SALIDA}/veredictos.json`, JSON.stringify(veredictos, null, 2));
  await navegador.close();
  const fallidos = veredictos.filter((v) => !v.cond);
  process.stdout.write(`\n${veredictos.length - fallidos.length}/${veredictos.length} comprobaciones\n`);
  process.exit(fallidos.length === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
