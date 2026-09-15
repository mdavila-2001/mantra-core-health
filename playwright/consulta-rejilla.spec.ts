import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * La consulta: una rejilla con todo lo que se puede registrar.
 *
 * Lo que sólo un navegador puede afirmar:
 *
 * 1. **Las nueve casillas están a la vista**, sin pestañas que abrir.
 * 2. **El encuentro se abre desde la misma pantalla** y queda «en curso».
 * 3. **Cada casilla abre su formulario en modal** y el modal se cierra.
 * 4. **La página no scrollea de costado**, ni a 1440 ni a 390 px.
 */

const SALIDA = join('docs', 'frontend', 'evidence', 'consulta-rejilla');

const MEDICA: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Médica',
};

const CASILLAS: readonly { readonly clave: string; readonly modal: string }[] = [
  { clave: 'diagnosticos', modal: 'Nuevo diagnóstico' },
  { clave: 'alergias', modal: 'Nueva alergia' },
  { clave: 'medicacion', modal: 'Prescribir medicación' },
  { clave: 'observaciones', modal: 'Registrar una observación' },
  { clave: 'notas', modal: 'Escribir una nota clínica' },
  { clave: 'planes', modal: 'Abrir un plan de cuidados' },
  { clave: 'documentos', modal: 'Registrar un documento' },
  { clave: 'formulario', modal: 'Llenar un formulario clínico' },
  { clave: 'internacion', modal: 'Registrar una internación' },
];

async function desbordeHorizontal(page: Page): Promise<number> {
  return page.evaluate(() => {
    const d = document.documentElement;
    return Math.max(0, d.scrollWidth - d.clientWidth);
  });
}

test.describe('Consulta · rejilla de registro', () => {
  test('todo lo que se registra está en la rejilla y abre en modal', async ({ page }) => {
    test.setTimeout(5 * 60_000);
    mkdirSync(SALIDA, { recursive: true });

    await entrar(page, MEDICA);
    await irA(page, '/medical-records');
    await estable(page);

    // El archivo no lista a nadie hasta que se busca: Enter dispara la búsqueda
    // sin esperar la demora del tipeo.
    const buscador = page.getByRole('textbox', { name: 'Buscar por nombre o código' });
    await buscador.fill('Ana');
    await buscador.press('Enter');
    await page.getByRole('link', { name: 'Ver expediente' }).first().click();
    await page.waitForURL(/\/medical-records\/[^/]+$/, { timeout: 60_000 });
    await estable(page);

    await page.goto(`${page.url()}/consultation`, { waitUntil: 'commit' });
    await page.waitForURL(/\/medical-records\/[^/]+\/consultation$/, { timeout: 60_000 });
    await estable(page);

    /* ---- 1. las nueve casillas ------------------------------------------- */

    await expect(page.getByTestId('consulta-rejilla')).toBeVisible();
    await expect(page.locator('[data-testid^="consulta-casilla-"]')).toHaveCount(9);
    expect(await desbordeHorizontal(page)).toBe(0);
    // Del tamaño de la ventana y no `fullPage`: la captura cosida dibuja el menú
    // lateral fijo encima del contenido, que no es lo que ve una persona.
    await page.screenshot({ path: join(SALIDA, 'consulta-1440.png') });

    /* ---- 2. el encuentro se abre acá ------------------------------------- */

    const abrir = page.getByTestId('consulta-abrir-encuentro');
    if ((await abrir.count()) > 0) {
      await abrir.click();
    }
    await expect(page.getByTestId('encuentros-en-curso')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('consulta-cerrar-encuentro').first()).toBeVisible();
    await page.screenshot({ path: join(SALIDA, 'consulta-en-curso-1440.png') });

    /* ---- 3. cada casilla abre su modal ----------------------------------- */

    for (const casilla of CASILLAS) {
      await page.getByTestId(`consulta-casilla-${casilla.clave}`).click();
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible();
      await expect(modal.getByRole('heading', { name: casilla.modal, exact: true })).toBeVisible();
      if (casilla.clave === 'diagnosticos') {
        await page.screenshot({ path: join(SALIDA, 'consulta-modal-diagnostico.png') });
      }
      await page.keyboard.press('Escape');
      await expect(modal).toHaveCount(0);
    }

    /* ---- 4. angosto ------------------------------------------------------ */

    await page.setViewportSize({ width: 390, height: 844 });
    await estable(page);
    // El recorrido de los modales dejó la página scrolleada, y el menú lateral
    // tarda en salir de pantalla al achicar: sin esperar las dos cosas la
    // captura muestra la transición, no la pantalla.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(
      page.getByRole('navigation', { name: 'Navegación principal' }),
    ).not.toBeInViewport();
    expect(await desbordeHorizontal(page)).toBe(0);
    await page.screenshot({ path: join(SALIDA, 'consulta-390.png') });
  });
});
