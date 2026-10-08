/* ============================================================================
    Catálogo universal de medicamentos · «Nuevo producto» de la farmacia.

    Corre contra la **maqueta** (`mockBackend`) con `farmacia@alovida.mock`. Lo
    que se prueba, de punta a punta en un navegador:

      1. el alta NO se tipea: se busca en el catálogo oficial y se elige;
      2. lo oficial (nombre, concentración, receta) se ve y no se puede editar;
      3. lo propio (SKU, precio, existencias, fotos, descripción) sigue editable;
      4. sin elegir un medicamento no hay alta;
      5. «no encuentro mi medicamento» pide el alta, no publica nada;
      6. en 375 / 768 / 1440, claro y oscuro, el modal no se desborda.

    Con `--workers=1`. Antes hay que tener `ng serve` y apuntar `E2E_BASE_URL`.
    Las capturas van a `docs/trabajo/2026-10-01-catalogo-universal/evidencia/`.
    ========================================================================== */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { test, expect, type Locator, type Page } from '@playwright/test';

import { farmacia, type Actor } from './support/actores';
import { entrar } from './support/sesion';

const EVIDENCIA = join('docs', 'trabajo', '2026-10-01-catalogo-universal', 'evidencia');
const SUFIJO = String(Date.now()).slice(-6);

const VIEWPORTS = [
  { nombre: '375', ancho: 375, alto: 800 },
  { nombre: '768', ancho: 768, alto: 900 },
  { nombre: '1440', ancho: 1440, alto: 900 },
] as const;

async function abrirAlta(page: Page): Promise<Locator> {
  // Por URL y no por el menú: en 375 px el menú es un cajón cerrado y el enlace queda fuera de la pantalla.
  await page.goto('/administration/pharmacy-catalog');
  await page.getByTestId('products-new').click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  return modal;
}

/** Busca «ibuprofeno» y elige el primer resultado que se puede elegir; devuelve su nombre oficial. */
async function elegirIbuprofeno(page: Page, modal: Locator): Promise<string> {
  await modal.getByRole('combobox', { name: 'Medicamento del catálogo oficial' }).fill('ibuprofeno');
  const opcion = page.locator('[role="option"]:not([aria-disabled="true"])').first();
  await expect(opcion).toBeVisible();
  const nombre = (await opcion.locator('.reference-combobox__label').innerText()).trim();
  await opcion.click();
  await expect(modal.getByTestId('product-official')).toContainText(nombre);
  return nombre;
}

async function sinDesborde(modal: Locator): Promise<number> {
  return modal.evaluate((el) => el.scrollWidth - el.clientWidth);
}

test.describe('catálogo universal · nuevo producto de la farmacia', () => {
  test.beforeEach(async ({ page }) => {
    const errores: string[] = [];
    page.on('console', (mensaje) => {
      if (mensaje.type() === 'error') errores.push(mensaje.text());
    });
    (page as unknown as { __errores: string[] }).__errores = errores;
    await entrar(page, farmacia() as Actor);
    mkdirSync(EVIDENCIA, { recursive: true });
  });

  test.afterEach(async ({ page }) => {
    const errores = (page as unknown as { __errores: string[] }).__errores;
    // Los avisos de CSP por «inline script» son de `ng serve`; las fotos oficiales
    // viven en otro origen y pueden fallar sin conexión: se descartan a propósito.
    const propios = errores.filter(
      (texto) => !/favicon|Failed to load resource|Executing inline script violates|cima\.aemps\.es/.test(texto),
    );
    expect(propios).toEqual([]);
  });

  test('buscar, elegir, ver lo oficial bloqueado, poner lo propio y guardar; la lista lo muestra al releer', async ({ page }) => {
    const modal = await abrirAlta(page);

    // Antes de elegir no hay NINGÚN campo de datos del producto para tipear.
    for (const campo of ['product-field-brand', 'product-field-strength', 'product-field-package', 'product-field-generic']) {
      await expect(modal.getByTestId(campo)).toHaveCount(0);
    }

    const nombre = await elegirIbuprofeno(page, modal);
    const oficial = modal.getByTestId('product-official');
    await expect(oficial).toContainText('Estos datos vienen del registro oficial');
    await expect(oficial).toContainText('Principio activo');
    await expect(oficial).toContainText('Concentración');
    // Lo oficial es texto, no un campo: dentro de la tarjeta no hay nada que editar.
    await expect(oficial.locator('input, textarea, select')).toHaveCount(0);

    // La foto oficial (si el registro la trae) carga de verdad, o se ve el marcador: nunca un cuadro roto.
    const foto = oficial.getByTestId('product-official-photo');
    if ((await foto.count()) > 0) {
      await expect
        .poll(() => foto.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), { timeout: 15_000 })
        .toBe(true);
    }

    const presentacion = modal.getByLabel('Presentación que vende');
    if (await presentacion.isVisible()) await presentacion.selectOption({ index: 1 });

    const codigo = `CAT-${SUFIJO}`;
    await modal.getByTestId('product-field-code').fill(codigo);

    // Lo propio sigue siendo editable: ficha técnica (GTIN), descripción, imágenes y publicación.
    await modal.getByRole('tab', { name: 'Ficha técnica' }).click();
    await expect(modal.getByTestId('product-technical-official')).toContainText('Vienen del registro oficial');
    await expect(modal.getByTestId('product-field-gtin')).toBeEditable();
    await modal.getByRole('tab', { name: 'Descripción' }).click();
    await modal.locator('textarea').fill('Descripción propia de la farmacia.');
    await modal.getByRole('tab', { name: 'Imágenes' }).click();
    await expect(modal.getByTestId('product-image-input')).toBeVisible();
    await modal.getByRole('tab', { name: 'Publicación' }).click();
    await modal.getByTestId('product-field-price').fill('21,90');

    await modal.getByTestId('product-dialog-save').click();
    await expect(modal).toBeHidden();

    await page.getByPlaceholder('Marca, genérico o código').fill(codigo);
    await page.keyboard.press('Enter');
    const fila = page.getByRole('row').filter({ hasText: codigo });
    await expect(fila).toContainText(nombre);
    await expect(fila).toContainText('Bs 21,90');
    await expect(fila).toContainText('Publicado');

    // Recargar y reabrir para editar: lo oficial queda bloqueado, el precio persiste.
    await page.reload();
    await page.getByPlaceholder('Marca, genérico o código').fill(codigo);
    await page.keyboard.press('Enter');
    await page.getByRole('row').filter({ hasText: codigo }).getByRole('button', { name: /Acciones|Más/ }).click();
    await page.getByRole('menuitem', { name: /Editar/ }).click();
    const edicion = page.getByRole('dialog');
    await expect(edicion.getByTestId('product-official')).toContainText(nombre);
    await expect(edicion.getByTestId('product-field-brand')).toHaveCount(0);
    await expect(edicion.getByTestId('product-field-code')).not.toBeEditable();
    await edicion.getByRole('tab', { name: 'Publicación' }).click();
    await expect(edicion.getByTestId('product-field-price')).toHaveValue('21.90');
  });

  test('sin elegir un medicamento del catálogo no hay alta', async ({ page }) => {
    const modal = await abrirAlta(page);
    await modal.getByTestId('product-field-code').fill(`LIBRE-${SUFIJO}`);
    await modal.getByTestId('product-dialog-save').click();

    await expect(modal.getByTestId('product-dialog-errors')).toContainText('Elija el medicamento del catálogo oficial');
    await expect(modal).toBeVisible();
  });

  test('«no encuentro mi medicamento» manda la solicitud y no publica ningún producto', async ({ page }) => {
    const modal = await abrirAlta(page);
    await modal.getByTestId('product-request-toggle').click();
    await expect(modal.getByTestId('product-request-form')).toBeVisible();

    await modal.getByTestId('product-request-send').click();
    await expect(modal.getByTestId('product-request-form')).toContainText('Escriba el nombre del medicamento');

    // El simulador vive dentro de la app (no hay respuesta de red que esperar): el resultado
    // visible es que el formulario se cierra y la persona recibe el aviso.
    await modal.getByTestId('product-request-name').fill(`Medicamento local ${SUFIJO}`);
    await modal.getByTestId('product-request-send').click();
    await expect(modal.getByTestId('product-request-form')).toHaveCount(0);
    await expect(page.getByText('Pedimos incorporar el medicamento al catálogo')).toBeVisible();
    // Sigue en el alta, sin producto elegido y sin nada publicado.
    await expect(modal.getByTestId('product-official')).toHaveCount(0);
  });

  for (const vista of VIEWPORTS) {
    for (const esquema of ['light', 'dark'] as const) {
      if (esquema === 'dark' && vista.nombre !== '1440') continue;
      test(`el modal con un producto elegido se ve bien en ${vista.nombre} ${esquema === 'light' ? 'claro' : 'oscuro'}`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: esquema });
        await page.setViewportSize({ width: vista.ancho, height: vista.alto });
        const modal = await abrirAlta(page);
        await elegirIbuprofeno(page, modal);
        const foto = modal.getByTestId('product-official-photo');
        if ((await foto.count()) > 0) {
          await expect
            .poll(() => foto.evaluate((img: HTMLImageElement) => img.complete), { timeout: 15_000 })
            .toBe(true);
        }

        expect(await sinDesborde(modal)).toBeLessThanOrEqual(1);
        await page.screenshot({ path: join(EVIDENCIA, `modal-catalogo-${vista.nombre}-${esquema === 'light' ? 'claro' : 'oscuro'}.png`) });

        await modal.getByTestId('product-request-toggle').scrollIntoViewIfNeeded();
        await modal.getByTestId('product-request-toggle').click();
        expect(await sinDesborde(modal)).toBeLessThanOrEqual(1);
        await page.screenshot({ path: join(EVIDENCIA, `modal-solicitud-${vista.nombre}-${esquema === 'light' ? 'claro' : 'oscuro'}.png`) });
      });
    }
  }
});
