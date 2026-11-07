/* ============================================================================
    Catalog «Importar CSV» modal: products and prices merged, sites removed,
    the format guide and templates always visible, and no flicker when
    switching options. Against the mock backend, as `farmacia@alovida.mock`.

    The price-only file is checked up to the review step; the bulk write is
    not simulated in demo mode (see the last test).

    Needs `yarn start:demo` on :4200 (the pre-push gate starts it).
    Screenshots go to `evidencias/2026-11-06-importar-csv-productos-y-precios/`.
    ========================================================================== */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { farmacia } from './support/actores';

const EVIDENCIA = join('evidencias', '2026-11-06-importar-csv-productos-y-precios');
const CATALOGO = '/administration/pharmacy-catalog';

test.use({ launchOptions: process.env['CHROMIUM'] ? { executablePath: process.env['CHROMIUM'] } : {} });

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

async function openImport(page: Page): Promise<Locator> {
  await page.getByTestId('catalog-import').click();
  const modal = page.getByRole('dialog', { name: 'Importar CSV' });
  await expect(modal).toBeVisible();
  await expect(page.locator('.content-dialog__panel').last()).toHaveCSS('opacity', '1');
  return modal;
}

test.describe('Importar CSV: productos y precios en uno, con plantillas a la vista', () => {
  test.beforeAll(() => mkdirSync(EVIDENCIA, { recursive: true }));

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('dos opciones, la guía del formato y la plantilla de precios', async ({ page }) => {
    await openTab(page, 'prices');
    const modal = await openImport(page);

    // From the Prices tab it preselects products: prices travel in that file.
    await expect(page).toHaveURL(/tab=import&target=products/);
    await expect(modal.getByTestId('import-target').getByRole('radio')).toHaveText(['Productos y precios', 'Categorías']);
    await expect(modal.locator('app-import-columns-help')).toContainText('precio');
    await expect(modal.getByTestId('import-columns-note')).toContainText('«codigo» y «precio»');
    await page.screenshot({ path: join(EVIDENCIA, '01-modal-productos-y-precios.png') });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      modal.getByTestId('import-template-prices').click(),
    ]);
    expect(download.suggestedFilename()).toBe('plantilla-precios.csv');
    const content = await (await download.createReadStream()).toArray();
    expect(Buffer.concat(content).toString('utf8').replace(/^\u{FEFF}/u, '').split(/\r?\n/u)[0]).toBe('codigo,precio');

    // Retired options from old links land on products and prices.
    await page.goto(`${CATALOGO}?tab=import&target=sites`);
    await expect(page.getByRole('dialog', { name: 'Importar CSV' }).getByRole('radio', { checked: true })).toHaveText(
      'Productos y precios',
      { timeout: 60_000 },
    );
  });

  test('cambiar de opción no hace parpadear el modal: la transición de la página queda quieta', async ({ page }) => {
    await openTab(page, 'products');
    const modal = await openImport(page);
    await page.evaluate(() => {
      const seen: string[] = [];
      (window as unknown as { quietSeen: string[] }).quietSeen = seen;
      new MutationObserver(() => {
        if (document.documentElement.hasAttribute('data-vt-quiet')) seen.push('quiet');
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-vt-quiet'] });
    });

    const panel = page.locator('.content-dialog__panel').last();
    const box = async (): Promise<string> => JSON.stringify(await panel.boundingBox());
    // Let the entry spring settle before taking the reference box.
    await expect.poll(() => panel.evaluate((el) => el.getAnimations().filter((a) => a.playState !== 'finished').length), { timeout: 10_000 }).toBe(0);
    const before = await box();
    for (const option of ['Categorías', 'Productos y precios', 'Categorías']) {
      await modal.getByRole('radio', { name: option }).click();
      await expect(modal.getByRole('radio', { name: option })).toHaveAttribute('aria-checked', 'true');
      // Views of different heights: the panel neither resizes nor moves.
      expect(await box()).toBe(before);
    }
    await expect(page).toHaveURL(/target=categories/);
    // Every switch ran its view transition quieted (no captured page above the dialog).
    expect(await page.evaluate(() => (window as unknown as { quietSeen: string[] }).quietSeen.length)).toBeGreaterThan(0);
    await expect(page.locator('html')).not.toHaveAttribute('data-vt-quiet', /.*/u);
    await expect(modal.getByTestId('entity-import-template')).toBeVisible();
    await page.screenshot({ path: join(EVIDENCIA, '02-modal-categorias.png') });
  });

  test('un CSV sólo con «codigo,precio» se reconoce y avisa que la disponibilidad se conserva', async ({ page }) => {
    await openTab(page, 'prices');
    const code = ((await page.locator('app-data-table tbody tr').first().locator('code').first().textContent()) ?? '').trim();
    const modal = await openImport(page);
    await modal.locator('input[type="file"]').setInputFiles({
      name: 'precios.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(`codigo,precio\n${code},"23,40"\n`, 'utf8'),
    });
    // Choosing the file moves straight to the columns step.
    await expect(modal.getByTestId('import-no-availability')).toContainText('conservan la disponibilidad');
    await page.screenshot({ path: join(EVIDENCIA, '03-columnas-lista-de-precios.png') });
    await modal.getByTestId('import-continue-columns').click();
    // Existing product, no name in the file: accepted as an update of its price.
    await expect(modal.getByTestId('import-review')).toContainText('1 se actualiza');
    await expect(modal.getByTestId('import-sample')).toContainText(code);
    await page.screenshot({ path: join(EVIDENCIA, '04-revisar-lista-de-precios.png') });
    // The demo simulator implements no `/pharmacies/:id/products/bulk`, so the
    // server preview and the write are not exercised here: their request
    // bodies are pinned by `pharmacy-import.spec.ts` and `bulk-publish.spec.ts`.
  });
});
