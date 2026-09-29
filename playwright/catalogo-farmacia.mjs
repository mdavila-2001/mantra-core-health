/**
 * Evidencia del «Catálogo de productos» entrando COMO LA FARMACIA
 * (`farmacia@alovida.mock`, Farmacia Vida) contra el simulador, 29/09/2026.
 *
 * - La cuenta de farmacia entra directo a SU catálogo (sin elegir farmacia).
 * - Una tarjeta centrada a lo ancho con tres pestañas e indicadores arriba.
 * - Alta con precio y categoría → persistida → recarga → sigue en la lista.
 * - «Marcar sin stock» (como el renglón «no disponible» de un pedido) →
 *   persistido → recarga → sigue sin stock.
 * - Edición → persistida.
 * - Carga masiva con precio, categoría y disponibilidad: crea los nuevos y
 *   ACTUALIZA los que ya estaban.
 * - Retiro.
 * - 390 / 768 / 1440 sin desborde horizontal.
 *
 * El simulador intercepta dentro de Angular: lo que se comprueba es su
 * efecto persistido (sessionStorage) y la pantalla después de recargar. El
 * cuerpo exacto de cada petición lo fija `pharmacy-catalog.spec.ts`.
 *
 * Uso: `node playwright/catalogo-farmacia.mjs [urlBase]`
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4300';
const SALIDA = fileURLToPath(new URL('../evidencias/catalogo-farmacia-2026-09-29', import.meta.url));
const sello = Date.now().toString(36).toUpperCase();
const CODIGO_ALTA = `EVI-${sello}`;

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
  // Alto de sobra y capturas de ventana: la captura `fullPage` deja el velo
  // de la barra lateral encima del contenido a 1440 (es del shell).
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 1700 } });
  const pagina = await contexto.newPage();
  const errores = [];
  const sinManejador = [];
  pagina.on('pageerror', (e) => errores.push(String(e)));
  pagina.on('console', (m) => {
    if (m.text().includes('[mock]')) sinManejador.push(m.text());
  });

  const capturar = (nombre, opciones = {}) =>
    pagina.screenshot({ path: `${SALIDA}/${nombre}.png`, ...opciones });
  const medir = async (selector) => pagina.locator(selector).first().boundingBox();
  const tabla = () => pagina.getByTestId('catalogo-tabla');
  const pestana = (nombre) => pagina.getByRole('tab', { name: nombre });
  const persistidos = () =>
    pagina.evaluate(() => {
      const clave = Object.keys(sessionStorage).find((k) => k.includes('mock.pharmacy.productos'));
      return clave === undefined ? [] : (JSON.parse(sessionStorage.getItem(clave) ?? '{}').filas ?? []);
    });
  const persistido = async (codigo) => (await persistidos()).find((p) => p.productCode === codigo);

  async function entrar(cuenta) {
    await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await pagina.getByTestId('login-identifier').fill(cuenta);
    await pagina.getByTestId('login-password').fill('mockup');
    await pagina.getByTestId('login-submit').click();
    await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
    if (pagina.url().includes('/auth/organization')) {
      await pagina.getByTestId('tenant-opcion').first().click();
      await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
    }
  }

  async function abrirCatalogo() {
    await pagina.goto(`${BASE}/administration/pharmacy-catalog`, {
      waitUntil: 'domcontentloaded',
      timeout: 180_000,
    });
    await pagina.getByTestId('catalogo-tarjeta').waitFor({ timeout: 60_000 });
    await tabla().locator('tbody tr').first().waitFor({ timeout: 30_000 });
  }

  async function buscar(termino) {
    const campo = pagina.locator('.catalogo__buscador input');
    await campo.fill(termino);
    await campo.press('Enter');
    await pagina.waitForTimeout(800);
  }

  async function accion(codigo, rotulo) {
    const fila = tabla().locator('tbody tr', { hasText: codigo });
    const directo = fila.getByRole('button', { name: new RegExp(rotulo) });
    if ((await directo.count()) > 0) {
      await directo.first().click();
    } else {
      await fila.getByRole('button', { name: /Acciones/ }).click();
      await pagina.getByRole('menuitem', { name: new RegExp(rotulo) }).click();
    }
  }

  /* ── Sesión como la farmacia ────────────────────────────────────────── */
  await entrar('farmacia@alovida.mock');
  await pagina.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded' });
  await pagina.waitForTimeout(1500);
  const menu = await pagina.locator('nav').first().textContent();
  ok('la cuenta de farmacia tiene «Catálogo de productos» en su menú', menu.includes('Catálogo de productos'));
  await capturar('00-menu-farmacia');

  /* ── 1 · Su catálogo, sin elegir farmacia ───────────────────────────── */
  await abrirCatalogo();
  ok('entra directo a su catálogo, sin preguntar de qué farmacia', (await pagina.locator('.catalogo__farmacia').count()) === 0);
  const main = await medir('.app-main__inner');
  const tarjeta = await medir('[data-testid="catalogo-tarjeta"]');
  const izq = tarjeta.x - main.x;
  const der = main.x + main.width - (tarjeta.x + tarjeta.width);
  ok('la tarjeta está centrada (≤ 2 px de diferencia)', Math.abs(izq - der) <= 2, `izq ${Math.round(izq)} · der ${Math.round(der)}`);
  ok('la tarjeta ocupa ≥ 85 % del área', tarjeta.width >= main.width * 0.85, `${Math.round(tarjeta.width)} de ${Math.round(main.width)} px`);
  const resumen = (await pagina.getByTestId('catalogo-resumen').textContent()).replace(/\s+/g, ' ').trim();
  ok('indicadores arriba: publicados, disponibles, sin stock, bajo receta', /Productos publicados/.test(resumen) && /Disponibles/.test(resumen) && /Sin stock/.test(resumen) && /Bajo receta/.test(resumen), resumen);
  const cabecera = await tabla().locator('thead').textContent();
  ok('la lista muestra precio y disponibilidad', cabecera.includes('Precio') && cabecera.includes('Disponibilidad'));
  await capturar('01-catalogo-farmacia');

  /* ── 2 · Alta con precio y categoría ────────────────────────────────── */
  await pestana('Nuevo producto').click();
  await pagina.getByTestId('catalogo-campo-codigo').fill(CODIGO_ALTA);
  await pagina.getByTestId('catalogo-campo-marca').fill('Ibuprofeno Evidencia');
  await pagina.getByTestId('catalogo-campo-generico').fill('Ibuprofeno');
  await pagina.getByTestId('catalogo-campo-concentracion').fill('400 mg');
  await pagina.getByTestId('catalogo-campo-presentacion').fill('Caja x 20 comprimidos');
  await pagina.getByTestId('catalogo-campo-precio').fill('26,50');
  await pagina.getByRole('combobox', { name: 'Categoría' }).selectOption({ label: 'Medicamentos' });
  await pagina.getByRole('combobox', { name: '¿Se vende bajo receta?' }).selectOption({ label: 'No' });
  await capturar('02-alta-con-precio');
  await pagina.getByTestId('catalogo-guardar').click();
  await pagina.waitForTimeout(900);
  const alta = await persistido(CODIGO_ALTA);
  ok('el alta quedó persistida con precio y categoría', alta?.price === '26.50' && alta?.category === 'Medicamentos', JSON.stringify({ price: alta?.price, category: alta?.category }));
  ok('el genérico se enlazó al vademécum (aparece al buscar la receta)', alta?.medicationConceptId !== null && alta?.medicationConceptId !== undefined);

  await pagina.reload({ waitUntil: 'domcontentloaded' });
  await abrirCatalogo();
  await buscar(CODIGO_ALTA);
  const filaAlta = await tabla().textContent();
  ok('tras recargar, el alta sigue con su precio', filaAlta.includes(CODIGO_ALTA) && /Bs 26[.,]50/.test(filaAlta));

  /* ── 3 · «No lo tengo» ──────────────────────────────────────────────── */
  await accion(CODIGO_ALTA, 'Marcar sin stock');
  await pagina.waitForTimeout(900);
  ok('«sin stock» quedó persistido', (await persistido(CODIGO_ALTA))?.sinStock === true);
  await pagina.reload({ waitUntil: 'domcontentloaded' });
  await abrirCatalogo();
  await buscar(CODIGO_ALTA);
  ok('tras recargar, el producto sigue «Sin stock»', (await tabla().textContent()).includes('Sin stock'));
  await capturar('03-marcado-sin-stock');


  /* ── 4 · Editar ─────────────────────────────────────────────────────── */
  await accion(CODIGO_ALTA, 'Editar');
  await pagina.getByTestId('catalogo-editando').waitFor({ timeout: 10_000 });
  await pagina.getByTestId('catalogo-campo-precio').fill('24,90');
  await pagina.getByRole('combobox', { name: 'Disponibilidad' }).selectOption({ label: 'Lo tengo (disponible)' });
  await capturar('04-editando');
  await pagina.getByTestId('catalogo-guardar').click();
  await pagina.waitForTimeout(900);
  const editado = await persistido(CODIGO_ALTA);
  ok('la edición quedó persistida (precio nuevo y otra vez disponible)', editado?.price === '24.90' && editado?.sinStock === false, JSON.stringify({ price: editado?.price, sinStock: editado?.sinStock }));

  /* ── 5 · Carga masiva: crea y actualiza ─────────────────────────────── */
  const csv = [
    'Código;Marca;Principio activo;Concentración;Presentación;Receta;Precio;Categoría;Disponible;Descripción',
    `IMP-${sello}-1;Amoxicilina Evidencia;Amoxicilina;500 mg;Caja x 21 cápsulas;sí;42,00;Medicamentos;sí;Antibiótico de amplio espectro.`,
    `IMP-${sello}-2;Protector Solar Evidencia;;SPF 50;Tubo de 50 ml;no;149;Dermocosmética;agotado;`,
    `IMP-${sello}-3;Termómetro Evidencia;;;1 unidad;no;45;Dispositivos;12;`,
    `IMP-${sello}-4;Mal precio;;;;no;1.234,50;;;`,
    `${CODIGO_ALTA};Ibuprofeno Evidencia Actualizado;;;;;19,90;;;`,
  ].join('\r\n');
  const rutaCsv = `${SALIDA}/carga-de-prueba.csv`;
  // Como lo guarda Excel en castellano: Windows-1252.
  writeFileSync(rutaCsv, Buffer.from(csv, 'latin1'));

  await pestana('Importación masiva').click();
  await capturar('05-importar');
  await pagina.locator('app-file-input input[type="file"]').setInputFiles(rutaCsv);
  await pagina.getByTestId('catalogo-revision').waitFor({ timeout: 30_000 });
  const revision = (await pagina.getByTestId('catalogo-revision').textContent()).replace(/\s+/g, ' ').trim();
  ok('la revisión separa nuevos, a actualizar y a corregir', /3 productos nuevos/.test(revision) && /1 se actualiza/.test(revision) && /1 fila a corregir/.test(revision), revision);
  const muestra = await pagina.getByTestId('catalogo-muestra').textContent();
  ok('las tildes de Excel llegan intactas', muestra.includes('cápsulas') && !muestra.includes('�'));
  await capturar('06-importar-revision');

  await pagina.getByTestId('catalogo-publicar-carga').click();
  await pagina.getByTestId('catalogo-resultado').waitFor({ timeout: 60_000 });
  const resultado = (await pagina.getByTestId('catalogo-resultado').textContent()).replace(/\s+/g, ' ').trim();
  ok('crea 3 y actualiza 1', /3 productos publicados/.test(resultado) && /1 actualizado/.test(resultado), resultado);
  await capturar('07-importar-resultado');

  const solar = await persistido(`IMP-${sello}-2`);
  ok('«agotado» en el CSV entra como sin stock', solar?.sinStock === true);
  const actualizado = await persistido(CODIGO_ALTA);
  ok('la fila del código existente actualizó marca y precio sin borrar lo demás', actualizado?.brandName === 'Ibuprofeno Evidencia Actualizado' && actualizado?.price === '19.90' && actualizado?.strengthText === '400 mg', JSON.stringify({ brand: actualizado?.brandName, price: actualizado?.price, strength: actualizado?.strengthText }));

  await pagina.reload({ waitUntil: 'domcontentloaded' });
  await abrirCatalogo();
  await buscar(`IMP-${sello}`);
  const importados = await tabla().textContent();
  ok('tras recargar, están los importados con precio y los inválidos no', importados.includes(`IMP-${sello}-1`) && /Bs 42[.,]00/.test(importados) && !importados.includes(`IMP-${sello}-4`));
  await capturar('08-importados-tras-recarga');

  /* ── 6 · Retiro ─────────────────────────────────────────────────────── */
  await buscar(CODIGO_ALTA);
  await accion(CODIGO_ALTA, 'Retirar');
  const confirmar = pagina.getByRole('dialog').getByRole('button', { name: 'Retirar' });
  await confirmar.waitFor({ timeout: 10_000 });
  await confirmar.click();
  await pagina.waitForTimeout(900);
  ok('el retiro quedó persistido como borrado lógico', (await persistido(CODIGO_ALTA))?.retirado === true);

  /* ── 7 · Anchos ─────────────────────────────────────────────────────── */
  await buscar('');
  for (const [ancho, alto] of [[390, 844], [768, 1024], [1440, 1700]]) {
    await pagina.setViewportSize({ width: ancho, height: alto });
    await pagina.waitForTimeout(500);
    // El catálogo no puede salirse de la pantalla. La cabecera del shell se
    // mide aparte: a 390 px su fila de íconos desborda en varias cuentas y no
    // es de esta pantalla (queda registrado, no se da por bueno).
    const medida = await pagina.evaluate(() => ({
      ancho: document.documentElement.clientWidth,
      tarjeta: Math.round(document.querySelector('[data-testid="catalogo-tarjeta"]').getBoundingClientRect().right),
      cabecera: Math.round(document.querySelector('.app-header__derecha')?.getBoundingClientRect().right ?? 0),
    }));
    ok(`${ancho}px: el catálogo no se sale de la pantalla`, medida.tarjeta <= medida.ancho, `tarjeta hasta ${medida.tarjeta} de ${medida.ancho}px`);
    if (medida.cabecera > medida.ancho) {
      process.stdout.write(`  ℹ ${ancho}px: la cabecera del shell se sale ${medida.cabecera - medida.ancho}px (ajeno a esta pantalla)\n`);
    }
    await capturar(`09-catalogo-${ancho}`, { fullPage: ancho < 1120 });
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
