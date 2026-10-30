/**
 * Carril 19 — «Dónde conseguir lo de mi receta»
 * (`/my-account/medical-record/where-to-buy/:requestId`), en la maqueta.
 *
 * - REQ-19-001/002/003: las tres pestañas (farmacias, imagenología, centros
 *   médicos), y la pestaña elegida viaja en la URL (`?tab=`).
 * - REQ-19-004: por defecto sólo las sucursales que tienen todo; las demás,
 *   a pedido y con lo que les falta dicho por su nombre.
 * - REQ-19-009: «Cómo llegar» va a OpenStreetMap (la CSP no admite Google
 *   Maps, regla 99 §7) y la pestaña de centros médicos no inventa una lista:
 *   la maqueta no siembra órdenes de procedimiento, así que
 *   `GET /clinical/me/procedure-centers` responde vacío y la pestaña lo dice.
 *   El recorrido con centros reales está en `carril-19-centros-medicos.spec.ts`.
 *
 * Corre contra `ng serve` en modo demo (simulador). Sin consola en rojo.
 */
import { expect, test, type Page } from '@playwright/test';

import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';

/** Errores de la página; el sondeo del glosario completo es previsto (ver carril 03). */
function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    const glossaryProbe = msg.location().url.includes('/glossary-data/');
    if (msg.type() === 'error' && !/Content Security Policy/.test(msg.text()) && !glossaryProbe) {
      errors.push(msg.text());
    }
  });
  return errors;
}

/** Entra como paciente y abre «dónde conseguir» de la primera receta. */
async function openWhereToBuy(page: Page): Promise<string> {
  await entrarAlSimulador(page, 'paciente', BASE);
  await page.goto(`${BASE}/my-account/pharmacy/prescriptions`, { waitUntil: 'domcontentloaded' });
  const links = page.locator('a[href*="where-to-buy"]');
  await expect(links.first()).toBeVisible({ timeout: 30_000 });
  await links.first().click();
  await expect(page).toHaveURL(/\/where-to-buy\/[^/?#]+/u);
  await esperarAQueSeAsiente(page);
  return page.url().split('?')[0] ?? page.url();
}

test.describe('Carril 19 — dónde conseguir lo de mi receta', () => {
  test('REQ-19-001/002/003: tres pestañas, y la elegida queda en la URL', async ({ page }) => {
    const errors = watchConsole(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    const screenUrl = await openWhereToBuy(page);

    const tabs = page.getByRole('tab');
    await expect(tabs.filter({ hasText: 'Farmacias' })).toHaveCount(1);
    await expect(tabs.filter({ hasText: 'Centros de imagenología' })).toHaveCount(1);
    await expect(tabs.filter({ hasText: 'Centros médicos' })).toHaveCount(1);
    await expect(tabs.filter({ hasText: 'Farmacias' })).toHaveAttribute('aria-selected', 'true');

    await tabs.filter({ hasText: 'Centros de imagenología' }).click();
    await expect(page).toHaveURL(/[?&]tab=imaging/u);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('tab', { name: 'Centros de imagenología' })).toHaveAttribute(
      'aria-selected',
      'true',
      { timeout: 30_000 },
    );

    await page.goto(`${screenUrl}?tab=medical-centers`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('tab', { name: 'Centros médicos' })).toHaveAttribute(
      'aria-selected',
      'true',
      { timeout: 30_000 },
    );

    expect(errors).toEqual([]);
  });

  test('REQ-19-004/009: por defecto sólo las sucursales completas; «Cómo llegar» por OpenStreetMap', async ({
    page,
  }) => {
    const errors = watchConsole(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openWhereToBuy(page);

    const branches = page.getByTestId('where-to-buy-branches');
    const noneComplete = page.getByTestId('where-to-buy-none-complete');
    await expect(branches.or(noneComplete).first()).toBeVisible({ timeout: 30_000 });

    // Sin pedir las incompletas, ninguna tarjeta dice lo que le falta.
    await expect(branches.getByTestId('where-to-buy-missing')).toHaveCount(0);

    const showIncomplete = page.getByTestId('where-to-buy-show-partial');
    if ((await showIncomplete.count()) > 0) {
      await expect(showIncomplete).toHaveAttribute('aria-pressed', 'false');
      await showIncomplete.click();
      await expect(showIncomplete).toHaveAttribute('aria-pressed', 'true');
      await expect(branches.getByTestId('where-to-buy-missing').first()).toBeVisible();
      await expect(branches.getByTestId('where-to-buy-missing').first()).toContainText('Le falta');
    }

    const directions = page.getByTestId('where-to-buy-directions');
    if ((await directions.count()) > 0) {
      const first = directions.first();
      await expect(first).toHaveAttribute('href', /^https:\/\/www\.openstreetmap\.org\/directions\?/u);
      await expect(first).toHaveAttribute('target', '_blank');
      await expect(first).toHaveAttribute('rel', /noopener/u);
      await expect(first).toHaveAccessibleName(/^Cómo llegar a .+\(abre en una pestaña nueva\)$/u);
    }

    expect(errors).toEqual([]);
  });

  test('REQ-19-003/007/009: centros médicos no inventa una lista y ofrece el directorio', async ({
    page,
  }) => {
    const errors = watchConsole(page);
    await page.setViewportSize({ width: 375, height: 812 });
    const screenUrl = await openWhereToBuy(page);
    await page.goto(`${screenUrl}?tab=medical-centers`, { waitUntil: 'domcontentloaded' });

    const panel = page.getByRole('tabpanel');
    await expect(panel.getByText('No tiene procedimientos pendientes.')).toBeVisible({
      timeout: 30_000,
    });
    await expect(panel.getByRole('link', { name: 'Ver clínicas y hospitales' }).first()).toBeVisible();
    // Ninguna tarjeta de centro ni ninguna sucursal: la maqueta no tiene oferta que las respalde.
    await expect(panel.locator('.purchase__branch')).toHaveCount(0);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({
      path: 'artifacts/playwright/carril-19-centros-medicos-375.png',
      fullPage: true,
    });

    expect(errors).toEqual([]);
  });
});
