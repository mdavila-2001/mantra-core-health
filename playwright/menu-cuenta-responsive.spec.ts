import { expect, test } from '@playwright/test';

import { entrar, irA } from './support/sesion';

/*
 * Regression (04/11/2026): at ≤ 900 px the header action strip scrolls
 * horizontally, and that overflow also clipped the account menu. Tapping the
 * avatar flipped `aria-expanded` but nothing showed. `toBeVisible()` cannot see
 * that clipping, so the check hit-tests the menu item instead.
 */
test.use({ hasTouch: true, isMobile: true });

for (const width of [375, 768, 1440]) {
  test(`el menú de la cuenta se abre y se ve a ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await entrar(page, {
      rol: 'paciente',
      identificador: 'paciente@alovida.mock',
      clave: 'mock',
      nombre: 'Paciente de demostración',
    });
    await irA(page, '/my-account');
    await expect(page.locator('h1', { hasText: 'Mi perfil' })).toBeVisible();

    await page.getByTestId('header-cuenta').tap();
    const item = page.getByTestId('header-seguridad');
    await expect(item).toBeVisible();

    const box = (await item.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await expect
      .poll(() =>
        page.evaluate(
          ({ x, y }) =>
            document.elementFromPoint(x, y)?.closest('[data-testid]')?.getAttribute('data-testid'),
          { x: box.x + box.width / 2, y: box.y + box.height / 2 },
        ),
      )
      .toBe('header-seguridad');

    await item.tap();
    await expect(page).toHaveURL(/\/my-account\/security/);
  });
}
