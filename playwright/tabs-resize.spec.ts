import { expect, test, type Locator, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, irA } from './support/sesion';

/**
 * The shared Tabs strip after a resize (rotation, a shrinking window):
 * 1440 → 390 px must not leave the strip in its «overflowing» mode. When the tabs
 * fit there are no scroll arrows, and the active tab is whole inside the strip.
 *
 * Against `yarn start:demo` (mock backend), on a survey's sheet (three tabs).
 * Waits on elements, never on network quiescence.
 */

const MOCK_DOCTOR: Actor = { rol: 'doctora', identificador: 'medica@alovida.mock', clave: 'mock', nombre: 'Médica' };

async function openLegacySheet(page: Page): Promise<Locator> {
  await irA(page, '/form-builder');
  await page.getByRole('tab', { name: 'Encuestas', exact: true }).click();
  const legacy = page.getByTestId('surveys-inbox-list').locator('li', { hasText: 'Experiencia de teleconsulta' });
  await legacy.getByRole('link', { name: /Ver las respuestas/ }).click();
  const tabs = page.getByTestId('survey-detail-tabs');
  await expect(tabs.getByRole('tab', { name: 'Respuestas', exact: true })).toHaveAttribute('aria-selected', 'true', { timeout: 30_000 });
  return tabs;
}

/** No arrows, and the selected tab's box inside the strip's box. */
async function expectFitsWithActiveWhole(tabs: Locator, name: string): Promise<void> {
  await expect(tabs.locator('.tabs__desplazar')).toHaveCount(0);
  const strip = (await tabs.getByRole('tablist').boundingBox())!;
  const active = (await tabs.getByRole('tab', { name, exact: true }).boundingBox())!;
  expect(active.x, `«${name}» starts inside the strip`).toBeGreaterThanOrEqual(strip.x - 0.5);
  expect(active.x + active.width, `«${name}» ends inside the strip`).toBeLessThanOrEqual(strip.x + strip.width + 0.5);
}

test('pestañas: al pasar de 1440 a 390 px no quedan flechas si entran y la activa se ve entera', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await entrar(page, MOCK_DOCTOR);
  const tabs = await openLegacySheet(page);

  await tabs.getByRole('tab', { name: 'Preguntas', exact: true }).click();
  await expectFitsWithActiveWhole(tabs, 'Preguntas');

  await page.setViewportSize({ width: 390, height: 844 });
  await expectFitsWithActiveWhole(tabs, 'Preguntas');

  // A real overflow first (320 px: the three tabs no longer fit), then room again:
  // the strip must leave its «overflowing» mode, not keep the arrows it put up.
  await page.setViewportSize({ width: 320, height: 700 });
  await expect(tabs.locator('.tabs__desplazar')).toHaveCount(2);
  await page.setViewportSize({ width: 390, height: 844 });
  await expectFitsWithActiveWhole(tabs, 'Preguntas');

  // And back and forth with the last tab active.
  await tabs.getByRole('tab', { name: 'Respuestas', exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expectFitsWithActiveWhole(tabs, 'Respuestas');
  await page.setViewportSize({ width: 390, height: 844 });
  await expectFitsWithActiveWhole(tabs, 'Respuestas');
});
