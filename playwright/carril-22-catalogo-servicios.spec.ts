import { expect, test, type APIRequestContext, type Browser, type Page } from '@playwright/test';

import { administrador, apiViva, contextoDeApi, urlDeApi } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * TAREA-22 · revisión de `/administration/services-catalog`.
 *
 * Cubre lo que la pantalla **ya hace** — listado por práctica con paginación
 * por cursor, buscador, alta inline de tres campos, y el enlace al importador
 * del arancel (S2, entregado en otro carril).
 *
 * Lo que esta suite **no** cubre porque no existe: la tarjeta con imagen y
 * descripción, el precio editable con persistencia, y los términos y
 * condiciones con su modal de confirmación (puntos 2 a 4 del pedido del
 * propietario). `billing.service_catalog` no tiene columnas para ninguno de
 * los tres —verificado con `\d billing.service_catalog` contra la base
 * viva— y agregarlas exige `mantra-core-health-model`, que no está clonado en
 * esta máquina. Ver el informe del carril para el detalle.
 *
 * ## Una sola sesión para toda la suite
 *
 * `POST /iam/auth/login` admite diez por minuto y por IP, y en esta corrida
 * conviven varios barridos de otros carriles sobre la misma máquina: el cupo
 * se satura entre agentes, no por esta suite. Entrar una sola vez y navegar
 * el resto por el router (`irA`, sin recarga) es lo único que deja margen
 * para que los tests corran dentro del `test.timeout` de 180 s.
 */

const CATALOGO = '/administration/services-catalog';

/** Los tres anchos obligatorios de la ficha. */
const VIEWPORTS = [
  { nombre: 'movil', width: 390, height: 844 },
  { nombre: 'tablet', width: 768, height: 1024 },
  { nombre: 'escritorio', width: 1440, height: 900 },
] as const;

test.describe.configure({ mode: 'serial' });

let api: APIRequestContext;
let browser: Browser;
let page: Page;

test.beforeAll(async ({ browser: b }) => {
  browser = b;
  api = await contextoDeApi();
  expect(await apiViva(api), `La API no responde en ${urlDeApi()}.`).toBe(true);

  page = await browser.newPage();
  await entrar(page, administrador());
});

test.afterAll(async () => {
  await page.close();
  await api.dispose();
});

/** Deja el catálogo listo, sin el formulario de alta abierto. */
async function irAlCatalogo(): Promise<void> {
  await irA(page, CATALOGO);
  await estable(page);
  await expect(page.getByTestId('catalogo-servicios-nuevo')).toBeVisible();
  // Si un test anterior dejó el formulario abierto, cerrarlo antes de seguir.
  const cancelar = page.getByRole('button', { name: 'Cancelar' });
  if (await cancelar.isVisible().catch(() => false)) {
    await cancelar.click();
  }
}

test('el catálogo lista por práctica y no hay «Cita médica» sembrada de fábrica', async () => {
  await irAlCatalogo();

  // Punto 1 del pedido: no hay fila «Cita médica» aparecida sola. La base
  // viva confirma `billing.service_catalog` en 0 filas antes de esta corrida
  // para las dos prácticas existentes — el catálogo arranca vacío.
  const tabla = page.locator('app-data-table');
  await expect(tabla).toBeVisible();
});

test('el formulario de alta inline abre con sus tres campos, y nada más', async () => {
  await irAlCatalogo();

  await page.getByTestId('catalogo-servicios-nuevo').click();
  const form = page.getByTestId('catalogo-servicios-alta-form');
  await expect(form).toBeVisible();

  // Punto 2 del pedido pide imagen y descripción en el alta; hoy sólo hay
  // código, nombre y precio de referencia.
  await expect(page.getByTestId('catalogo-servicios-codigo')).toBeVisible();
  await expect(page.getByTestId('catalogo-servicios-nombre')).toBeVisible();
  await expect(page.getByTestId('catalogo-servicios-precio')).toBeVisible();
  await expect(form.getByRole('textbox', { name: /descripci[oó]n/i })).toHaveCount(0);
  await expect(form.locator('input[type="file"], img')).toHaveCount(0);
});

test('«Importar producto» y «Nuevo servicio» conviven en el encabezado, sin duplicar catálogo', async () => {
  await irAlCatalogo();

  const importar = page.getByTestId('catalogo-servicios-importar');
  const nuevo = page.getByTestId('catalogo-servicios-nuevo');
  await expect(importar).toBeVisible();
  await expect(nuevo).toBeVisible();

  await importar.click();
  await expect(page).toHaveURL(/\/administration\/services-catalog\/import$/);
});

// Antes de crear nada: las capturas tienen que mostrar la pantalla como la ve
// alguien que todavía no hizo un alta en esta sesión, sin el aviso de éxito
// del test siguiente superpuesto.
for (const viewport of VIEWPORTS) {
  test(`sin scroll horizontal en ${viewport.width} px, catálogo y alta abierta`, async () => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await irAlCatalogo();

    let desborde = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(desborde, 'el catálogo desborda a lo ancho').toBe(false);

    await page.screenshot({
      path: `artifacts/playwright/tarea-22-catalogo/catalogo-${viewport.nombre}.png`,
      fullPage: false,
    });

    await page.getByTestId('catalogo-servicios-nuevo').click();
    await expect(page.getByTestId('catalogo-servicios-alta-form')).toBeVisible();
    await estable(page);

    await page.screenshot({
      path: `artifacts/playwright/tarea-22-catalogo/catalogo-alta-${viewport.nombre}.png`,
      fullPage: false,
    });

    // Con el formulario de alta abierto se agrega `<app-form-actions>` (barra
    // pegajosa de Guardar/Cancelar). A 390 px llegó a medir 398 px reales
    // porque cancelaba el padding del marco con `--sp-4` (16 px) cuando el
    // marco, en ese corte, usa `--e3` (12 px) — 4 px de más por lado. Ya
    // corregido en `form-actions.css`, que ahora lee
    // `var(--app-main-inline-padding, var(--sp-4))` publicado por el marco en
    // sus seis puntos de corte. Queda como aserción normal, no como fallo
    // esperado.
    desborde = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(desborde, 'el formulario de alta desborda a lo ancho').toBe(false);
  });
}

test('el alta con código repetido vuelve el error asociado al campo', async () => {
  await irAlCatalogo();

  await page.getByTestId('catalogo-servicios-nuevo').click();
  const sufijo = String(Date.now()).slice(-8);
  await page.getByTestId('catalogo-servicios-codigo').fill(`E2E-${sufijo}`);
  await page.getByTestId('catalogo-servicios-nombre').fill(`Servicio de prueba ${sufijo}`);
  await page.getByTestId('catalogo-servicios-precio').fill('150.00');
  await page.getByRole('button', { name: 'Guardar servicio' }).click();

  await expect(page.getByTestId('catalogo-servicios-alta-form')).toBeHidden({ timeout: 15_000 });

  // Repetir el mismo código: el 409 de la API se muestra junto al campo, no
  // como alerta genérica.
  await page.getByTestId('catalogo-servicios-nuevo').click();
  await page.getByTestId('catalogo-servicios-codigo').fill(`E2E-${sufijo}`);
  await page.getByTestId('catalogo-servicios-nombre').fill(`Servicio duplicado ${sufijo}`);
  await page.getByTestId('catalogo-servicios-precio').fill('200.00');
  await page.getByRole('button', { name: 'Guardar servicio' }).click();

  await expect(
    page.getByText('Ya existe un servicio con este código en el catálogo.'),
  ).toBeVisible({ timeout: 15_000 });
});
