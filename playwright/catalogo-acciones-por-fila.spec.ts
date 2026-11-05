/* ============================================================================
    Pharmacy catalog: «Importar CSV» in the header and per-row actions
    (Editar in a modal, Quitar precio, Vaciar), against the mock backend.

    Runs as `farmacia@alovida.mock`. Every mutation is proven
    UI → request (mocked) → persistence (the simulator's sessionStorage) →
    reload → UI. The exact request bodies are pinned by the TestBed specs.

    Needs `yarn start:demo` on :4200 (the pre-push gate starts it).
    Screenshots go to `evidencias/2026-11-05-catalogo-acciones-por-fila/`.
    ========================================================================== */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { farmacia } from './support/actores';

const EVIDENCIA = join('evidencias', '2026-11-05-catalogo-acciones-por-fila');
const CATALOGO = '/administration/pharmacy-catalog';

// The sandbox ships its own Chromium build; elsewhere Playwright's default is used.
test.use({ launchOptions: process.env['CHROMIUM'] ? { executablePath: process.env['CHROMIUM'] } : {} });

/** The simulator's stored products (`Coleccion.guardar` keeps `{ build, filas }`). */
async function stored(page: Page, code: string): Promise<Record<string, unknown> | undefined> {
  return page.evaluate((wanted) => {
    const key = Object.keys(sessionStorage).find((k) => k.includes('mock.pharmacy.productos'));
    const rows: Record<string, unknown>[] =
      key === undefined ? [] : (JSON.parse(sessionStorage.getItem(key) ?? '{}').filas ?? []);
    return rows.find((row) => row['productCode'] === wanted);
  }, code);
}

/**
 * Signs in as the pharmacy. The shared `entrar` helper waits for `/dashboard`,
 * but the pharmacy account lands on `/administration/pharmacy`.
 */
async function signIn(page: Page): Promise<void> {
  const actor = farmacia();
  await page.goto('/auth');
  await page.getByTestId('login-identifier').fill(actor.identificador);
  await page.getByTestId('login-password').fill(actor.clave);
  await page.getByTestId('login-submit').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/auth') || url.pathname.startsWith('/auth/organization'), {
    timeout: 60_000,
  });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 60_000 });
  }
}

async function openTab(page: Page, tab: string): Promise<void> {
  await page.goto(`${CATALOGO}?tab=${tab}`);
  await expect(page.locator('app-data-table tbody tr').first()).toBeVisible({ timeout: 60_000 });
}

const rowOf = (page: Page, code: string): Locator =>
  page.locator('app-data-table tbody tr', { hasText: code }).first();

/** Row actions show as buttons when there are few, or behind the «Acciones» menu. */
async function rowAction(page: Page, row: Locator, label: string): Promise<void> {
  const direct = row.getByRole('button', { name: new RegExp(`^${label}`) });
  if ((await direct.count()) > 0) {
    await direct.first().click();
    return;
  }
  await row.getByRole('button', { name: /Acciones/ }).click();
  await page.getByRole('menuitem', { name: label }).click();
}

async function confirm(page: Page, label: string): Promise<void> {
  await page.getByRole('dialog').or(page.getByRole('alertdialog')).last().getByRole('button', { name: label }).click();
}

/** Screenshot of an open modal once its entry animation has finished. */
async function shootModal(page: Page, name: string): Promise<void> {
  await expect(page.locator('.content-dialog__panel').last()).toHaveCSS('opacity', '1');
  await page.screenshot({ path: join(EVIDENCIA, name) });
}

async function firstCode(page: Page, rowText?: string): Promise<string> {
  const row = rowText
    ? page.locator('app-data-table tbody tr', { hasText: rowText }).first()
    : page.locator('app-data-table tbody tr').first();
  return ((await row.locator('code').first().textContent()) ?? '').trim();
}

test.describe('catálogo de la farmacia: importar arriba y acciones por fila', () => {
  test.beforeAll(() => mkdirSync(EVIDENCIA, { recursive: true }));

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('«Importar CSV» está en el membrete y abre el modal con lo de la pestaña', async ({ page }) => {
    await openTab(page, 'categories');

    await expect(page.getByRole('tab')).toHaveText(['Productos', 'Categorías', 'Precios', 'Inventario', 'Integración']);
    await expect(page.locator('app-page-header [data-testid="catalog-import"]')).toBeVisible();
    await page.screenshot({ path: join(EVIDENCIA, '01-membrete-con-importar.png') });

    await page.getByTestId('catalog-import').click();
    const modal = page.getByRole('dialog', { name: 'Importar CSV' });
    await expect(modal).toBeVisible();
    await expect(page).toHaveURL(/tab=import&target=categories/);
    await expect(modal.locator('app-entity-import')).toHaveCount(1);
    await shootModal(page, '02-modal-importar-categorias.png');

    await page.keyboard.press('Escape');
    await expect(modal).toBeHidden();
    await expect(page).toHaveURL(`${CATALOGO}?tab=categories`);

    // The old link still opens the modal.
    await page.goto(`${CATALOGO}?tab=import&target=prices`);
    await expect(page.getByRole('dialog', { name: 'Importar CSV' })).toBeVisible({ timeout: 60_000 });
  });

  test('Precios: Editar en modal y Quitar precio, persistidos y releídos', async ({ page }) => {
    await openTab(page, 'prices');
    const code = await firstCode(page);
    await expect(page.locator('app-data-table input')).toHaveCount(0);
    await expect(page.getByTestId('prices-save')).toHaveCount(0);

    await rowAction(page, rowOf(page, code), 'Editar');
    const dialog = page.getByRole('dialog', { name: 'Editar precio' });
    await expect(dialog.getByRole('button', { name: 'Cancelar' })).toBeVisible();
    await page.getByTestId('price-dialog-input').fill('19,75');
    await shootModal(page, '05-precios-modal-editar.png');
    await page.getByTestId('price-dialog-save').click();
    await expect(dialog).toBeHidden();
    // The simulator stores the price as `price` (see `pharmacy.handlers.ts`).
    await expect.poll(async () => Number((await stored(page, code))?.['price']), { timeout: 15_000 }).toBe(19.75);
    await page.reload();
    await expect(rowOf(page, code)).toContainText('19.75', { timeout: 60_000 });

    await rowAction(page, rowOf(page, code), 'Quitar precio');
    await confirm(page, 'Quitar precio');
    await expect.poll(async () => (await stored(page, code))?.['price'] ?? null, { timeout: 15_000 }).toBeNull();
    await page.reload();
    await expect(rowOf(page, code)).toContainText('Sin precio', { timeout: 60_000 });
  });

  test('Inventario: Editar con cantidades y Vaciar, persistidos y releídos', async ({ page }) => {
    await openTab(page, 'inventory');
    const code = await firstCode(page, 'Disponible');

    await rowAction(page, rowOf(page, code), 'Editar');
    const dialog = page.getByRole('dialog', { name: 'Editar inventario' });
    await page.getByTestId('inventory-dialog-stock').fill('7');
    await page.getByTestId('inventory-dialog-minimum').fill('3');
    await shootModal(page, '07-inventario-modal-editar.png');
    await page.getByTestId('inventory-dialog-save').click();
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await stored(page, code))?.['stock'], { timeout: 15_000 }).toBe(7);
    await page.reload();
    const cells = rowOf(page, code).locator('td');
    await expect(cells.nth(1)).toHaveText('7', { timeout: 60_000 });
    await expect(cells.nth(2)).toHaveText('3');

    await rowAction(page, rowOf(page, code), 'Vaciar');
    await confirm(page, 'Vaciar');
    await expect.poll(async () => (await stored(page, code))?.['stock'], { timeout: 15_000 }).toBe(0);
    await page.reload();
    await expect(rowOf(page, code)).toContainText('Sin stock', { timeout: 60_000 });
  });

  test('Inventario «Hay / no hay»: «No lo tengo» se guarda y la fila dice «No hay» tras recargar', async ({ page }) => {
    await openTab(page, 'inventory');
    await page.getByTestId('inventory-view').getByText('Hay / no hay').click();
    const code = await firstCode(page, 'Hay');

    await rowAction(page, rowOf(page, code), 'Editar');
    const dialog = page.getByRole('dialog', { name: 'Editar inventario' });
    await expect(page.getByTestId('inventory-dialog-stock')).toHaveCount(0);
    await page.getByTestId('inventory-dialog-has').click();
    await expect(dialog).toContainText('No lo tengo');
    await page.getByTestId('inventory-dialog-save').click();
    await expect(dialog).toBeHidden();
    // The simulator stores «no hay» as `sinStock: true` and keeps the count.
    await expect.poll(async () => (await stored(page, code))?.['sinStock'], { timeout: 15_000 }).toBe(true);
    await page.reload();
    await expect(rowOf(page, code)).toContainText('No hay', { timeout: 60_000 });
    await page.screenshot({ path: join(EVIDENCIA, '12-inventario-no-hay-tras-recargar.png') });
  });

  test('sin desborde a 390, 768 y 1440, en claro y en oscuro', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      // The app keeps its own theme choice (`THEME_STORAGE_KEY` in theme.service.ts).
      await page.evaluate((theme) => localStorage.setItem('mantra-core-health.theme', theme), scheme);
      for (const width of [390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await openTab(page, 'prices');
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
        await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
        await page.screenshot({ path: join(EVIDENCIA, `20-precios-${width}-${scheme}.png`), animations: 'disabled' });

        await page.getByTestId('catalog-import').click();
        await expect(page.getByRole('dialog', { name: 'Importar CSV' })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
        await shootModal(page, `21-modal-importar-${width}-${scheme}.png`);
        await page.keyboard.press('Escape');
      }
    }
  });
});
