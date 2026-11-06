import { expect, test, type Page } from '@playwright/test';

import { esperarAplicacionLista } from './support/sesion';

/**
 * The laboratory enters the order a patient brings on paper (API v4.2.96),
 * fixes it and annuls it, from «Órdenes». Demo server (`yarn start:demo`):
 * the simulator mirrors `/diagnostics/lab/orders` and keeps its state across a
 * reload. Synthetic data only. The same flow was run against the real API with
 * RLS on; its evidence is in the PR.
 */

const ORDERS = '/administration/laboratory-orders';
const REQUESTER = 'Dra. Orden de Mostrador';
/** Martín Rocha Antelo, a written patient of the simulator (`PATIENTS[3]`, fixed seed). */
const PATIENT_NATIONAL_ID = '5029613';

async function signIn(page: Page): Promise<void> {
  await page.goto('/auth');
  await esperarAplicacionLista(page);
  await page.getByTestId('login-identifier').fill('laboratorio@alovida.mock');
  await page.getByTestId('login-password').fill('mock');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|administration\/|auth\/organization)/);
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/(dashboard|administration\/)/);
  }
}

async function openOrders(page: Page): Promise<void> {
  await page.goto(ORDERS);
  await esperarAplicacionLista(page);
  await expect(page.getByTestId('lab-orders-card')).toBeVisible();
}

async function pick(page: Page, label: string): Promise<void> {
  await page.locator('[data-testid="lab-order-intake-study"] [role="combobox"]').click();
  await page.getByRole('option', { name: label, exact: true }).click();
}

test('el laboratorio carga, corrige y anula la orden que trae el paciente', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await signIn(page);
  await openOrders(page);

  // Create: the patient is found by exact national id.
  await page.getByTestId('lab-orders-new').click();
  const create = page.getByRole('dialog', { name: 'Nueva orden' });
  await expect(create).toBeVisible();
  await expect(page.getByTestId('lab-order-intake-save')).toBeDisabled();
  await page.getByTestId('lab-order-intake-national-id').fill('NADIE-0');
  await page.getByTestId('lab-order-intake-lookup').click();
  await expect(page.getByTestId('lab-order-intake-error')).toContainText('No hay ningún paciente');

  await page.getByTestId('lab-order-intake-national-id').fill(PATIENT_NATIONAL_ID);
  await page.getByTestId('lab-order-intake-lookup').click();
  await expect(page.getByTestId('lab-order-intake-patient')).toContainText('Martín Rocha Antelo');

  await pick(page, 'Electrocardiograma');
  await expect(create.getByText('Elija un estudio de laboratorio o de imagen.')).toBeVisible();
  await expect(page.getByTestId('lab-order-intake-save')).toBeDisabled();

  await pick(page, 'Hemograma completo');
  await page.getByTestId('lab-order-intake-requester').fill(REQUESTER);
  await page.getByTestId('lab-order-intake-save').click();
  await expect(create).toBeHidden();

  await page.reload();
  await esperarAplicacionLista(page);
  const row = page.locator('tr', { hasText: REQUESTER }).first();
  await expect(row).toContainText('Borrador');

  // Fix it while it is still a draft.
  await row.getByRole('button', { name: /acciones/i }).click();
  await page.getByRole('menuitem', { name: 'Corregir' }).click();
  const fix = page.getByRole('dialog', { name: 'Corregir la orden' });
  await expect(fix).toBeVisible();
  await pick(page, 'Radiografía de tórax');
  await page.getByTestId('lab-order-intake-save').click();
  await expect(fix).toBeHidden();
  await page.reload();
  await esperarAplicacionLista(page);
  await expect(page.locator('tr', { hasText: REQUESTER }).first()).toContainText('Radiografía de tórax');

  // Annul it, with a reason.
  await page.locator('tr', { hasText: REQUESTER }).first().getByRole('button', { name: /acciones/i }).click();
  await page.getByRole('menuitem', { name: 'Anular' }).click();
  const annul = page.getByRole('dialog', { name: 'Anular la orden' });
  await annul.getByRole('textbox').fill('Cargada por error');
  await annul.getByRole('button', { name: 'Anular la orden' }).click();
  await page.reload();
  await esperarAplicacionLista(page);
  await page.getByRole('tab', { name: /Canceladas y rechazadas/ }).click();
  await expect(page.locator('tr', { hasText: 'Cargada por error' }).first()).toContainText('Cancelada');

  expect(errors).toEqual([]);
});
