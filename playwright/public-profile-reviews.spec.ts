import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import { esperarAQueSeAsiente } from './support/simulador';

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const EVIDENCE = join('docs', 'progress', 'evidence', 'doctor-profile-reviews');

test('la ficha pública de un médico abre y muestra las reseñas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${BASE}/p/jorge-salazar`, { waitUntil: 'domcontentloaded' });
  await esperarAQueSeAsiente(page);
  await expect(page.getByRole('heading', { name: /Jorge Andrés Salazar/ })).toBeVisible();

  const ficha = page.locator('app-public-profile-card');
  await expect(ficha).toBeVisible();
  const pestaña = ficha.getByRole('tab', { name: 'Reseñas' });
  await expect(pestaña).toBeVisible();
  await pestaña.click();
  await expect(pestaña).toHaveAttribute('aria-selected', 'true');
  const panel = ficha.getByTestId('perfil-reviews');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Opiniones' })).toBeVisible();
  await expect(panel.getByTestId('opinion').first()).toBeVisible();

  mkdirSync(EVIDENCE, { recursive: true });
  await page.screenshot({ path: join(EVIDENCE, 'reviews-1440-claro.png'), fullPage: true });

  await page.setViewportSize({ width: 375, height: 844 });
  await expect(pestaña).toHaveAttribute('aria-selected', 'true');
  const scrollHorizontal = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(scrollHorizontal).toBe(false);
  await page.screenshot({ path: join(EVIDENCE, 'reviews-375-claro.png'), fullPage: true });
});
