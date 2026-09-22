/**
 * Evidencia de «Mi perfil» del paciente contra la maqueta (rama mockup),
 * pedidos del 09/09/2026:
 *
 * - UNA tarjeta centrada a lo ancho del área de contenido, con pestañas.
 * - Un botón de lápiz que habilita la edición ahí mismo, en la pestaña que
 *   se estaba mirando.
 * - Los campos de elección siguen siendo de elección: sexo (select),
 *   ocupación (lupa), ubicación (árbol departamento → municipio).
 * - La mutación entera: UI → PATCH → respuesta → recarga → UI.
 *
 * Uso: `node playwright/mi-perfil-paciente.mjs [urlBase] [sufijo]`
 */
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4333';
const SUFIJO = process.argv[3] ?? 'despues';
const SALIDA = fileURLToPath(new URL('../evidencias/mi-perfil-centrado-2026-09-09', import.meta.url));

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
  const peticiones = [];
  pagina.on('pageerror', (e) => errores.push(String(e)));
  pagina.on('request', (r) => {
    if (r.method() === 'PATCH') peticiones.push({ url: r.url(), body: r.postData() });
  });

  const capturar = (nombre, opciones = {}) =>
    pagina.screenshot({ path: `${SALIDA}/${SUFIJO}-${nombre}.png`, ...opciones });
  const medir = async (selector) => pagina.locator(selector).first().boundingBox();

  await pagina.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.getByTestId('login-identifier').fill('paciente@alovida.mock');
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }

  await pagina.goto(`${BASE}/my-account`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.getByTestId('mi-perfil-editar').waitFor({ timeout: 30_000 });
  await pagina.waitForTimeout(600);

  /* ── 1 · Geometría: centrada y a lo ancho ────────────────────────────── */
  const main = await medir('.app-main__inner');
  const tarjeta = await medir('.mi-perfil__principal');
  const izq = tarjeta.x - main.x;
  const der = main.x + main.width - (tarjeta.x + tarjeta.width);
  process.stdout.write(
    `  área ${Math.round(main.width)}px · tarjeta ${Math.round(tarjeta.width)}px · izq ${Math.round(izq)} · der ${Math.round(der)}\n`,
  );
  ok('la tarjeta está centrada (misma holgura a ambos lados)', Math.abs(izq - der) <= 2);
  ok('la tarjeta ocupa el ancho del área de contenido', tarjeta.width >= main.width * 0.85);
  ok('no hay columna lateral vacía', (await pagina.locator('.mi-perfil__lateral').count()) === 0);
  ok('es UNA tarjeta en la columna principal', (await pagina.locator('.mi-perfil__principal app-card').count()) === 1);

  const pestanas = pagina.locator('[data-testid="mi-perfil-pestanas"] [role="tab"]');
  const rotulos = (await pestanas.allTextContents()).map((t) => t.trim());
  ok('cuatro pestañas en lectura', rotulos.join(' · ') === 'Datos personales · Contacto · Facturación · Seguros y tutores', rotulos.join(' · '));
  await capturar('01-lectura-datos-personales', { fullPage: true });

  for (const [i, nombre] of [[1, 'contacto'], [2, 'facturacion'], [3, 'seguros']]) {
    await pestanas.nth(i).click();
    await pagina.waitForTimeout(300);
    await capturar(`02-lectura-${nombre}`, { fullPage: true });
  }
  await pestanas.nth(1).click();
  // El nombre del municipio llega del catálogo un instante después que el perfil.
  let municipioAntes = '';
  for (let i = 0; i < 40 && !(municipioAntes.length > 1); i += 1) {
    await pagina.waitForTimeout(250);
    municipioAntes = (await pagina.getByTestId('mi-perfil-municipio').textContent()).trim();
  }
  ok('el municipio de residencia se lee en «Contacto»', municipioAntes.length > 1 && municipioAntes !== 'Sin registrar', municipioAntes);
  process.stdout.write(`  municipio en lectura: ${municipioAntes}\n`);

  /* ── 2 · El lápiz ────────────────────────────────────────────────────── */
  const boton = pagina.getByTestId('mi-perfil-editar');
  ok('el botón de editar es un lápiz (sólo ícono)', (await boton.locator('svg').count()) === 1 && (await boton.textContent()).trim() === '');
  ok('el botón se llama «Editar»', (await boton.getAttribute('aria-label')) === 'Editar');
  await boton.hover();
  await pagina.waitForTimeout(500);
  const cabecera = await medir('.mi-perfil__cabecera');
  await capturar('03-lapiz-globo', { clip: { x: cabecera.x - 8, y: cabecera.y - 48, width: cabecera.width + 16, height: cabecera.height + 64 } });
  ok('el globo dice «Editar»', (await pagina.locator('[role="tooltip"]').allTextContents()).some((t) => t.trim() === 'Editar'));

  // Estando en «Contacto», el lápiz abre el formulario en «Contacto».
  await boton.click();
  await pagina.getByTestId('mi-perfil-editor').waitFor({ timeout: 30_000 });
  await pagina.waitForTimeout(800);
  const pestanasEditor = pagina.locator('[data-testid="perfil-pestanas"] [role="tab"]');
  ok('el editor abre en la pestaña que se estaba mirando', (await pestanasEditor.nth(1).getAttribute('aria-selected')) === 'true');
  ok('el editor sigue dentro de la misma tarjeta', (await pagina.locator('.mi-perfil__principal app-card').count()) === 1);
  ok('el botón lápiz desaparece mientras se edita', (await boton.count()) === 0);

  const editor = await medir('.mi-perfil__principal');
  const izqE = editor.x - main.x;
  const derE = main.x + main.width - (editor.x + editor.width);
  ok('el editor está centrado', Math.abs(izqE - derE) <= 2);
  ok('el editor ocupa el ancho del área de contenido', editor.width >= main.width * 0.85);
  const form = await medir('app-patient-profile-edit form');
  process.stdout.write(`  formulario ${Math.round(form.width)}px\n`);
  ok('el formulario no queda acotado a 44rem', form.width > 760);
  await capturar('04-edicion-contacto', { fullPage: true });

  /* ── 3 · Los campos de elección ──────────────────────────────────────── */
  ok('Municipio es un árbol de elección (no texto)', (await pagina.locator('app-tree-select[data-testid="perfil-municipio"]').count()) === 1);
  const disparador = pagina.locator('[data-testid="perfil-municipio"] button').first();
  const valorArbol = (await disparador.textContent()).trim();
  process.stdout.write(`  árbol de ubicación muestra: ${valorArbol}\n`);
  ok('el árbol de ubicación viene con el municipio guardado', valorArbol.length > 0 && valorArbol !== 'Sin especificar' && valorArbol.includes(municipioAntes));
  await disparador.click();
  await pagina.waitForTimeout(500);
  const dialogo = pagina.locator('[role="dialog"]').last();
  await dialogo.waitFor({ timeout: 10_000 });
  const grupos = await dialogo.locator('[role="treeitem"], [aria-level="1"], summary, .tree-select__grupo').allTextContents();
  process.stdout.write(`  ramas del árbol: ${grupos.length}\n`);
  await capturar('05-ubicacion-arbol', { fullPage: true });
  const buscador = dialogo.locator('input[type="search"], input[type="text"]').first();
  await buscador.fill('Cochab');
  await pagina.waitForTimeout(400);
  await capturar('06-ubicacion-busqueda');
  const coincidencias = await dialogo.locator('text=/Cochabamba/').count();
  ok('el buscador del árbol acota por nombre', coincidencias > 0);
  await pagina.keyboard.press('Escape');
  await pagina.waitForTimeout(300);

  await pestanasEditor.nth(0).click();
  await pagina.waitForTimeout(300);
  ok('Sexo es un select', (await pagina.locator('app-select[data-testid="perfil-genero"] select').count()) === 1);
  ok('Ocupación es una lupa (combobox)', (await pagina.locator('app-reference-combobox[data-testid="perfil-ocupacion"]').count()) === 1);
  ok('Nombre es texto', (await pagina.locator('[data-testid="perfil-nombre"]').count()) === 1);
  const sexo = pagina.locator('app-select[data-testid="perfil-genero"] select');
  const opciones = await sexo.locator('option').allTextContents();
  ok('el select de sexo trae las opciones del alta', opciones.map((o) => o.trim()).join('|') === 'Elegí una opción|Masculino|Femenino', opciones.join('|'));
  await capturar('07-edicion-datos-personales', { fullPage: true });

  await pestanasEditor.nth(2).click();
  await pagina.waitForTimeout(300);
  await capturar('08-edicion-facturacion', { fullPage: true });
  await pestanasEditor.nth(3).click();
  await pagina.waitForTimeout(300);
  await capturar('09-edicion-seguros', { fullPage: true });

  // Un obligatorio vacío en otra pestaña se nombra junto a las acciones.
  await pestanasEditor.nth(0).click();
  await pagina.waitForTimeout(200);
  const nombreOriginal = await pagina.locator('[data-testid="perfil-nombre"]').inputValue();
  await pagina.locator('[data-testid="perfil-nombre"]').fill('');
  await pestanasEditor.nth(1).click();
  await pagina.waitForTimeout(300);
  ok('con el nombre vacío en otra pestaña, la nota dice adónde ir', ((await pagina.getByTestId('perfil-pendiente').textContent()) ?? '').includes('Datos personales'));
  await capturar('10-pendiente-en-otra-pestana', { clip: { x: 0, y: 0, width: 1440, height: 1000 } });
  await pestanasEditor.nth(0).click();
  await pagina.waitForTimeout(200);
  await pagina.locator('[data-testid="perfil-nombre"]').fill(nombreOriginal);
  ok('lo tecleado sobrevive al cambio de pestaña', (await pagina.locator('[data-testid="perfil-nombre"]').inputValue()) === nombreOriginal);

  /* ── 4 · La mutación entera ──────────────────────────────────────────── */
  await pestanasEditor.nth(1).click();
  await pagina.waitForTimeout(200);
  const nuevoDomicilio = `Av. Evidencia #${Date.now() % 10_000}, Equipetrol`;
  await pagina.locator('[data-testid="perfil-domicilio"] input').fill(nuevoDomicilio);
  await pagina.getByRole('button', { name: 'Guardar cambios' }).click();
  await pagina.getByTestId('mi-perfil-editar').waitFor({ timeout: 30_000 });
  await pagina.waitForTimeout(800);
  ok('al guardar se vuelve a lectura en la misma pestaña («Contacto»)', (await pestanas.nth(1).getAttribute('aria-selected')) === 'true');
  const textoContacto = await pagina.locator('.mi-perfil__principal').textContent();
  ok('la ficha recargada muestra el domicilio nuevo', textoContacto.includes(nuevoDomicilio));
  await capturar('11-guardado-y-releido', { fullPage: true });

  // La maqueta contesta dentro de la app —no hay red que escuchar— y su memoria
  // vive en la pestaña del navegador (se pierde con una carga completa). La
  // persistencia se demuestra releyendo dentro de la SPA: el lápiz monta el
  // editor de nuevo y ése hace su propio GET /profiles/patients/me.
  await pagina.getByTestId('mi-perfil-editar').click();
  await pagina.getByTestId('mi-perfil-editor').waitFor({ timeout: 30_000 });
  await pestanasEditor.nth(1).click();
  await pagina.waitForTimeout(400);
  ok('releído por el editor (GET nuevo contra la maqueta), el domicilio guardado persiste', (await pagina.locator('[data-testid="perfil-domicilio"] input').inputValue()) === nuevoDomicilio);
  await pagina.getByRole('button', { name: 'Cancelar' }).click();
  await pagina.getByTestId('mi-perfil-editar').waitFor({ timeout: 30_000 });

  // La ruta propia del editor sigue existiendo y es la misma tarjeta con pestañas.
  await pagina.goto(`${BASE}/my-account/profile/edit`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  const pestanasRuta = pagina.locator('[data-testid="perfil-pestanas"] [role="tab"]');
  await pestanasRuta.first().waitFor({ timeout: 30_000 });
  ok('la ruta propia del editor también es UNA tarjeta con pestañas', (await pagina.locator('app-patient-profile-edit app-card').count()) === 1 && (await pestanasRuta.count()) === 4);
  await capturar('11b-ruta-propia-del-editor', { fullPage: true });
  await pagina.goto(`${BASE}/my-account`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await pagina.getByTestId('mi-perfil-editar').waitFor({ timeout: 30_000 });
  await pagina.waitForTimeout(600);

  /* ── 5 · Móvil ───────────────────────────────────────────────────────── */
  await pagina.setViewportSize({ width: 390, height: 844 });
  await pagina.waitForTimeout(500);
  await capturar('12-movil-lectura', { fullPage: true });
  const anchoDoc = await pagina.evaluate(() => document.documentElement.scrollWidth);
  ok('en móvil no hay desplazamiento horizontal', anchoDoc <= 390);

  ok('sin errores de página', errores.length === 0, errores.join(' | '));

  await contexto.close();
  await navegador.close();
  const fallidos = veredictos.filter((v) => !v.cond);
  process.stdout.write(`\n${veredictos.length - fallidos.length}/${veredictos.length} verificaciones OK\n`);
  process.exit(fallidos.length === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
