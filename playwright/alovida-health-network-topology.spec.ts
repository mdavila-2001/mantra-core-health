import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const evidenceDirectory = join(process.cwd(), 'docs/progress/evidence/alovida-star-topology/fotos');

test('la red de salud conserva sus seis actores y el centro en escritorio y móvil', async ({ page }) => {
  mkdirSync(evidenceDirectory, { recursive: true });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/home');
  const diagram = page.getByRole('group', { name: 'Topología estrella de la red de salud AloVida' });
  await expect(diagram).toBeVisible();
  await expect(diagram.locator('article')).toHaveCount(6);
  await expect(page.getByRole('group', { name: 'AloVida, centro de la red' })).toBeVisible();
  await expect(page.locator('.landing-red__conexiones')).toBeVisible();
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 1440);
  await diagram.screenshot({ path: join(evidenceDirectory, 'red-salud-1440.png'), animations: 'disabled' });

  await page.setViewportSize({ width: 390, height: 1600 });
  await page.reload();
  await expect(diagram).toBeVisible();
  await expect(diagram.locator('article')).toHaveCount(6);
  await expect(page.getByRole('group', { name: 'AloVida, centro de la red' })).toBeVisible();
  await expect(page.locator('.landing-red__conexiones')).toBeHidden();
  await expect(page.locator('html')).toHaveJSProperty('scrollWidth', 390);
  await page.evaluate(() => {
    const bounds = document.querySelector('.landing-red__diagrama')!.getBoundingClientRect();
    window.scrollTo(0, window.scrollY + bounds.top - 170);
  });
  const mobileDiagram = await diagram.boundingBox();
  expect(mobileDiagram).not.toBeNull();
  expect(mobileDiagram!.y).toBeGreaterThanOrEqual(150);
  expect(mobileDiagram!.y + mobileDiagram!.height).toBeLessThanOrEqual(1450);
  await page.screenshot({
    path: join(evidenceDirectory, 'red-salud-390.png'),
    clip: { x: 0, y: 0, width: 390, height: 1450 },
    animations: 'disabled',
  });
});
