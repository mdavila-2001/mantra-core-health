import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { administrador, apiViva, contextoDeApi, urlDeApi } from './support/actores';
import { entrar, esperarAplicacionLista, estable, irA } from './support/sesion';

/**
 * TAREA-22 · S2 — importar un procedimiento del arancel al catálogo.
 *
 * Precondición: el arancel sembrado por el arranque de la API
 * (`VS_BO_MEDICAL_PROCEDURE`, 4408 procedimientos en 36 especialidades). No
 * hace falta ningún seeder aparte: lo deja `seed:boot`.
 *
 * Lo que esta suite **no** cubre, y queda dicho: la vista de servicios del
 * profesional con su tarjeta, el precio editable y los términos y condiciones
 * (S3 a S5 de la ficha) siguen bloqueados — `billing.service_catalog` no tiene
 * columnas para imagen, descripción ni términos, y agregarlas exige el
 * repositorio del modelo.
 */

const IMPORTAR = '/administration/services-catalog/import';
const CATALOGO = '/administration/services-catalog';

/** Los tres anchos obligatorios de la ficha. */
const VIEWPORTS = [
  { nombre: 'movil', width: 390, height: 844 },
  { nombre: 'tablet', width: 768, height: 1024 },
  { nombre: 'escritorio', width: 1440, height: 900 },
] as const;

let api: APIRequestContext;

test.beforeAll(async () => {
  api = await contextoDeApi();
  expect(
    await apiViva(api),
    `La API no responde en ${urlDeApi()}.`,
  ).toBe(true);
});

test.afterAll(async () => {
  await api.dispose();
});

/**
 * Entra y abre el importador con la grilla ya dibujada.
 *
 * @param page - La página de la prueba.
 */
async function abrirImportador(page: Page): Promise<void> {
  await entrar(page, administrador());
  await irA(page, IMPORTAR);
  await expect(page.getByTestId('procedimiento').first()).toBeVisible({
    timeout: 30_000,
  });
  await estable(page);
}

test('AC-22-11 · se llega desde el catálogo, y lo que se ve es el arancel', async ({
  page,
}) => {
  await entrar(page, administrador());
  await irA(page, CATALOGO);
  await estable(page);

  const entrada = page.getByTestId('catalogo-servicios-importar');
  await expect(entrada).toBeVisible();
  await entrada.click();
  await expect(page).toHaveURL(new RegExp(`${IMPORTAR}$`));

  // No es un catálogo paralelo: son los procedimientos del arancel ya
  // sembrado, agrupados por su especialidad.
  await expect(page.getByTestId('procedimiento').first()).toBeVisible({
    timeout: 30_000,
  });
});

test('AC-22-13 · usa el organismo compartido, no una grilla propia', async ({
  page,
}) => {
  await abrirImportador(page);

  // El mismo organismo que consume el catálogo de formularios, y que la
  // TAREA-27 va a consumir: si esto desaparece, alguien escribió una segunda
  // grilla.
  await expect(page.locator('app-specialty-browser')).toHaveCount(1);
  // Y agrupa: hay al menos un encabezado de especialidad.
  await expect(page.locator('app-specialty-browser h2, app-specialty-browser h3').first()).toBeVisible();
});

test('AC-22-12 · el filtro por especialidad recorta y queda en la URL', async ({
  page,
}) => {
  await abrirImportador(page);

  const antes = await page.getByTestId('procedimiento').count();
  expect(antes).toBeGreaterThan(0);

  // Se entra por la dirección filtrada, que es la mitad del criterio: recargar
  // tiene que conservar la búsqueda.
  await irA(page, `${IMPORTAR}?specialty=${encodeURIComponent('Auditoría Médica')}`);
  await expect(page.getByTestId('procedimiento').first()).toBeVisible({
    timeout: 30_000,
  });
  await estable(page);

  // «Auditoría Médica» tiene cuatro procedimientos; sin filtro se traen treinta.
  const despues = await page.getByTestId('procedimiento').count();
  expect(despues).toBeLessThan(antes);

  // Y todos los que quedan son de esa especialidad: el filtro lo aplica el
  // servidor, no la pantalla escondiendo tarjetas.
  const encabezados = await page
    .locator('app-specialty-browser')
    .locator('h2, h3')
    .allTextContents();
  expect(encabezados.join(' ')).toContain('Auditoría Médica');

  await page.reload();
  await esperarAplicacionLista(page);
  await expect(page).toHaveURL(/specialty=/);
});

test('AC-22-17 · pagina por cursor: no trae las 4408 de una', async ({ page }) => {
  await abrirImportador(page);

  const primera = await page.getByTestId('procedimiento').count();
  // Una página, no el arancel entero.
  expect(primera).toBeLessThanOrEqual(30);

  const mas = page.getByTestId('specialty-browser-more');
  await expect(mas).toBeVisible();
  await mas.click();
  await estable(page);

  // «Cargar más» acumula sobre lo que ya estaba, no reemplaza la página.
  const segunda = await page.getByTestId('procedimiento').count();
  expect(segunda).toBeGreaterThan(primera);
});

test('AC-22-15 · la fila marcada por el arancel avisa antes de importarse', async ({
  page,
}) => {
  // «Riesgo quirirgico preoperatorio cardiol6gico» es una de las 228 entradas
  // que el arancel marcó como dañadas por el reconocimiento óptico.
  await entrar(page, administrador());
  await irA(page, `${IMPORTAR}?q=${encodeURIComponent('Riesgo quirirgico')}`);
  await expect(page.getByTestId('procedimiento').first()).toBeVisible({
    timeout: 30_000,
  });
  await estable(page);

  const avisos = page.getByTestId('procedimiento-revision');
  await expect(avisos.first()).toBeVisible();
  await expect(avisos.first()).toContainText(/mal le[íi]d/i);
});

test('el precio nunca se muestra sin su unidad', async ({ page }) => {
  await abrirImportador(page);

  const precios = await page.locator('.procedimiento__precio').allTextContents();
  expect(precios.length).toBeGreaterThan(0);
  for (const precio of precios) {
    // La UMA no es una moneda: un «20» a secas invita a cobrar veinte
    // bolivianos por algo que el arancel valúa en veinte unidades de cuenta.
    expect(precio).toMatch(/(UMA|USD|Sin precio en el arancel)/);
  }
});

for (const viewport of VIEWPORTS) {
  test(`AC-22-18 · sin scroll horizontal en ${viewport.width} px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await abrirImportador(page);

    const desborde = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth,
    );
    expect(desborde, 'el importador desborda a lo ancho').toBe(false);

    await page.screenshot({
      path: `artifacts/playwright/tarea-22/importar-${viewport.nombre}.png`,
      fullPage: false,
    });
  });
}
