import { expect, type Page } from '@playwright/test';

import { esperarAplicacionLista, irA } from './sesion';

/* Shared steps of «Encuestas por servicio», for the mock and the real-API specs. */

/** Formularios → «Encuestas» → «Encuestas por servicio», the way the practitioner gets there. */
export async function openServiceSurveys(page: Page): Promise<void> {
  await irA(page, '/form-builder');
  await page.getByRole('tab', { name: 'Encuestas', exact: true }).click();
  await expect(page).toHaveURL(/\/questionnaires/);
  await expect(page.getByRole('tab', { name: 'Buzón', exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('tab', { name: 'Encuestas por servicio', exact: true }).click();
  await expect(page).toHaveURL(/encuestas=servicios/);
  await expect(page.getByTestId('service-surveys-list')).toBeVisible({ timeout: 30_000 });
}

/** The `serviceId` of the first service row that still offers «Importar». */
export async function firstServiceWithoutSurvey(page: Page): Promise<string> {
  const button = page.locator('[data-testid^="service-survey-import-"]').first();
  await expect(button).toBeVisible();
  return (await button.getAttribute('data-testid'))!.replace('service-survey-import-', '');
}

/** Picks the first catalog option and returns its code and title. */
export async function pickFirstCatalogOption(page: Page): Promise<{ code: string; title: string }> {
  const catalog = page.getByTestId('standard-catalog');
  await expect(catalog).toBeVisible();
  const option = catalog.locator('[data-testid^="standard-catalog-option-"]').first();
  const code = (await option.getAttribute('data-testid'))!.replace('standard-catalog-option-', '');
  const title = (await option.locator('.catalogo__opcion-titulo').textContent())!.trim();
  await option.click();
  await expect(page.getByTestId('standard-catalog-preview')).toContainText(title);
  return { code, title };
}

export async function reloadServiceSurveys(page: Page): Promise<void> {
  await page.reload();
  await esperarAplicacionLista(page);
  await expect(page.getByTestId('service-surveys-list')).toBeVisible({ timeout: 30_000 });
}

