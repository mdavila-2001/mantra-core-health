import { expect, test } from '@playwright/test';

import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

const baseUrl = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';

test.describe('Sidebar toggle', () => {
  /**
   * Lo contrario de lo que esta prueba exigía hasta el 13/09/2026.
   *
   * Pedía que el botón del encabezado **escondiera** la barra en escritorio, y
   * eso es justo lo que el cliente pidió quitar: no abría ningún menú, le ponía
   * `nav-collapsed` a la raíz y la barra se iba de la pantalla con un
   * `translateX(-101%)`. Quedaban dos controles pegados que parecían el mismo y
   * no lo eran — el `»` de la barra la recoge a un carril de íconos, con el
   * menú todavía ahí—. «Queremos que siga estando nuestro menú».
   *
   * El requisito cambió, así que la prueba cambia con él: en escritorio el
   * botón no se dibuja, y recoger la barra la deja angosta pero presente.
   */
  test('desktop no longer hides the sidebar, it only narrows it', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrarAlSimulador(page, 'admin', baseUrl);
    await esperarAQueSeAsiente(page);

    const sidebar = page.locator('.app-side-nav');

    // 1 · La hamburguesa del encabezado no existe en escritorio.
    await expect(page.getByTestId('header-menu')).toBeHidden();

    // 2 · El control que sí queda es el de la barra, y la recoge sin esconderla.
    const recoger = page.getByTestId('nav-recoger');
    await expect(recoger).toBeVisible();
    await recoger.click();

    await expect(page.locator('html')).not.toHaveClass(/nav-collapsed/);
    await expect(sidebar).not.toHaveAttribute('inert', '');
    await expect.poll(() => sidebar.evaluate((el) => el.getBoundingClientRect().left)).toBe(0);
    await expect
      .poll(() => sidebar.evaluate((el) => el.getBoundingClientRect().width))
      .toBeGreaterThan(40);
    await page.screenshot({ path: testInfo.outputPath('desktop-sidebar-narrow.png') });

    // 3 · Y vuelve a su ancho.
    await recoger.click();
    await expect
      .poll(() => sidebar.evaluate((el) => el.getBoundingClientRect().width))
      .toBeGreaterThan(200);
  });

  test('mobile keeps the existing drawer interaction', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await entrarAlSimulador(page, 'admin', baseUrl);
    await esperarAQueSeAsiente(page);

    const toggle = page.getByTestId('header-menu');
    const sidebar = page.locator('.app-side-nav');

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(sidebar).toHaveAttribute('inert', '');
    await toggle.click();

    await expect(page.locator('html')).toHaveClass(/nav-abierto/);
    await expect(sidebar).not.toHaveAttribute('inert', '');
    await expect
      .poll(() => sidebar.evaluate((element) => element.getBoundingClientRect().left))
      .toBe(0);
    await page.screenshot({ path: testInfo.outputPath('mobile-sidebar-open.png') });
  });
});
