import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { administrador, apiViva, contextoDeApi, urlDeApi } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * TAREA-27 · catálogo de plantillas de formularios clínicos.
 *
 * Cubre únicamente lo que ya existe hoy en el repositorio: el catálogo
 * navegable de plantillas estándar (`FormsCatalog`, en
 * `features/admin/clinical-forms/forms-catalog.ts`), montado dentro de la
 * pantalla `administration/clinical-forms` y construido sobre el mismo
 * organismo `app-specialty-browser` que usa la TAREA-22
 * (`carril-22-importar-arancel.spec.ts`).
 *
 * No cubre el editor de secciones/preguntas, «mis formularios», ni etiqueta /
 * diagnóstico / procedimiento: esos huecos están documentados en la ficha
 * (§3, AC-27-1 a -9, AC-27-14 a -18) como no resueltos todavía en este
 * carril.
 */

const CLINICAL_FORMS = '/administration/clinical-forms';

/** Los tres anchos obligatorios de la ficha. */
const VIEWPORTS = [
  { nombre: 'movil', width: 390, height: 844 },
  { nombre: 'tablet', width: 768, height: 1024 },
  { nombre: 'escritorio', width: 1440, height: 900 },
] as const;

let api: APIRequestContext;

test.beforeAll(async () => {
  api = await contextoDeApi();
  expect(await apiViva(api), `La API no responde en ${urlDeApi()}.`).toBe(true);
});

test.afterAll(async () => {
  await api.dispose();
});

/** Entra como admin y abre la pantalla con el catálogo ya dibujado. */
async function abrirCatalogo(page: Page): Promise<void> {
  await entrar(page, administrador());
  await irA(page, CLINICAL_FORMS);
  await estable(page);
}

test('la pantalla usa el organismo compartido app-specialty-browser', async ({ page }) => {
  await abrirCatalogo(page);

  await expect(page.locator('app-forms-catalog')).toHaveCount(1);
  await expect(page.locator('app-specialty-browser')).toHaveCount(1);
});

test('el catálogo muestra formularios agrupados por especialidad, con versión y procedencia', async ({
  page,
}) => {
  await abrirCatalogo(page);

  await expect(page.getByTestId('catalogo-resumen')).toBeVisible({ timeout: 30_000 });

  // Al menos una tarjeta con procedencia (o su rótulo de "sin origen"), y la
  // versión visible: AC-27-12.
  const origen = page.getByTestId('origen').first();
  const sinOrigen = page.getByTestId('sin-origen').first();
  await expect(origen.or(sinOrigen)).toBeVisible();

  await expect(page.locator('.catalogo__version').first()).toBeVisible();
  await expect(page.locator('.catalogo__version').first()).toHaveText(/^v/);
});

test('buscar acota el catálogo y el término queda en la URL', async ({ page }) => {
  await abrirCatalogo(page);
  await expect(page.getByTestId('catalogo-resumen')).toBeVisible({ timeout: 30_000 });

  const antes = await page.locator('.catalogo__formulario').count();
  expect(antes).toBeGreaterThan(0);

  const buscador = page.getByLabel('Buscar un formulario por nombre, código o especialidad');
  await buscador.fill('cardio');
  await estable(page);

  await expect(page).toHaveURL(/q=cardio/);
  const despues = await page.locator('.catalogo__formulario').count();
  expect(despues).toBeLessThanOrEqual(antes);
  expect(despues).toBeGreaterThan(0);
});

test('duplicar un formulario del catálogo precarga el alta de arriba', async ({ page }) => {
  await abrirCatalogo(page);
  await expect(page.getByTestId('catalogo-resumen')).toBeVisible({ timeout: 30_000 });

  const nombreOriginal = await page
    .locator('.catalogo__formulario-titulo')
    .first()
    .textContent();
  expect(nombreOriginal).toBeTruthy();

  await page
    .getByRole('button', { name: 'Duplicar para adaptar' })
    .first()
    .click();

  // El formulario de alta debe llevar "(adaptada)" agregado al nombre
  // original — es la evidencia de que el catálogo emitió el evento y la
  // pantalla contenedora lo usó, sin llamar a ningún endpoint de duplicado.
  // `toContainText` no sirve acá: el nombre vive en el `value` de un
  // `<input>`, no en un nodo de texto.
  const campoNombre = page
    .locator('.formularios__alta')
    .locator('input[placeholder="Ficha de cardiología"]');
  await expect(campoNombre).toHaveValue(/\(adaptada\)$/);
});

for (const viewport of VIEWPORTS) {
  test(`sin scroll horizontal en ${viewport.width} px, con captura`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await abrirCatalogo(page);
    await expect(page.getByTestId('catalogo-resumen')).toBeVisible({ timeout: 30_000 });
    await estable(page);

    const desborde = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(
      desborde.scrollWidth,
      `scrollWidth (${desborde.scrollWidth}) > clientWidth (${desborde.clientWidth}) en ${viewport.width}px`,
    ).toBeLessThanOrEqual(desborde.clientWidth);

    await page.screenshot({
      path: `artifacts/playwright/tarea-27-catalogo/catalogo-${viewport.nombre}.png`,
      fullPage: false,
    });

    // La captura de arriba es el tope de la página (el alta); el catálogo
    // que este carril revisa vive más abajo. Se desplaza hasta él para que
    // quede evidencia visual de las tarjetas, no sólo del formulario.
    await page.locator('app-forms-catalog').scrollIntoViewIfNeeded();
    await estable(page);
    await page.screenshot({
      path: `artifacts/playwright/tarea-27-catalogo/catalogo-${viewport.nombre}-grilla.png`,
      fullPage: false,
    });
  });
}
