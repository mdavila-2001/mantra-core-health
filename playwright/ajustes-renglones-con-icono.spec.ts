import { expect, test, type Page } from '@playwright/test';

import { esperarAplicacionLista } from './support/sesion';

/**
 * Settings: every tab uses the Permisos row — icon on the left, text in the
 * middle, control on the right — and nothing overflows on a phone.
 * Runs against the demo build (mock backend), signed in as the mock patient.
 */
const TABS = ['Avisos', 'Chats', 'Apariencia', 'Permisos', 'Dispositivos', 'Tutoriales'] as const;

/** Row cards of the visible panel, by tab. */
const ROWS: Record<(typeof TABS)[number], string> = {
  Avisos: '.prefs__fila',
  Chats: '.chat-prefs__modo',
  Apariencia: '.ajustes__fila',
  Permisos: '.ajustes__fila',
  Dispositivos: '.dispositivos__renglon',
  Tutoriales: '.ajustes__fila',
};

async function signIn(page: Page): Promise<void> {
  await page.goto('/auth');
  await esperarAplicacionLista(page);
  await page.getByTestId('login-identifier').fill('paciente@alovida.mock');
  await page.getByTestId('login-password').fill('cualquiera');
  await page.getByTestId('login-submit').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 30_000 });
  await page.goto('/settings');
  await esperarAplicacionLista(page);
}

for (const width of [1280, 390]) {
  test(`Ajustes a ${width} px: cada renglón lleva su ícono a la izquierda`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await signIn(page);

    for (const tab of TABS) {
      await page.getByRole('tab', { name: tab }).click();
      const panel = page.locator('[role="tabpanel"]:visible').first();
      const rows = panel.locator(ROWS[tab]);
      await expect(rows.first()).toBeVisible();

      for (const row of await rows.all()) {
        // Exactly one icon, the first thing in the row, left of the row's text.
        await expect(row.locator(':scope > app-nav-icon')).toHaveCount(1);
        const icon = await row.locator(':scope > app-nav-icon').boundingBox();
        const text = await row.locator(':scope > :not(app-nav-icon)').first().boundingBox();
        expect(icon && text && icon.x < text.x, `${tab}: icon left of text`).toBe(true);
      }

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${tab}: no horizontal scroll`).toBeLessThanOrEqual(0);
    }

    // On a phone the index is a strip above the panel, so the panel takes the width.
    if (width < 640) {
      const list = await page.getByRole('tablist').boundingBox();
      const panel = await page.locator('[role="tabpanel"]:visible').first().boundingBox();
      expect(list && panel && list.y + list.height <= panel.y, 'tab strip above the panel').toBe(true);
      expect(panel?.width ?? 0, 'panel uses the phone width').toBeGreaterThan(width - 80);
    }

    // Dispositivos: the verify button sits inside the row, after the text.
    await page.getByRole('tab', { name: 'Dispositivos' }).click();
    const button = page.getByTestId('device-verificar').first();
    await expect(button).toBeVisible();
    await expect(page.locator('.dispositivos__renglon').first().getByTestId('device-verificar')).toHaveCount(1);
  });
}
