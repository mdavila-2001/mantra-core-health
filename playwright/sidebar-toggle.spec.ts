import { expect, test } from '@playwright/test';

import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

const baseUrl = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';

test.describe('Sidebar toggle', () => {
  test('desktop lets the navigation sidebar be hidden and restored', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await entrarAlSimulador(page, 'admin', baseUrl);
    await esperarAQueSeAsiente(page);

    const toggle = page.getByTestId('header-menu');
    const sidebar = page.locator('.app-side-nav');

    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.click();

    await expect(page.locator('html')).toHaveClass(/nav-collapsed/);
    await expect(sidebar).toHaveAttribute('inert', '');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect
      .poll(() => sidebar.evaluate((element) => element.getBoundingClientRect().right))
      .toBeLessThanOrEqual(0);
    await page.screenshot({ path: testInfo.outputPath('desktop-sidebar-hidden.png') });
    await toggle.click();

    await expect(page.locator('html')).not.toHaveClass(/nav-collapsed/);
    await expect(sidebar).not.toHaveAttribute('inert', '');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect
      .poll(() => sidebar.evaluate((element) => element.getBoundingClientRect().left))
      .toBe(0);
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
