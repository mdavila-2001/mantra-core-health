import { expect, test, type Page } from '@playwright/test';

/**
 * Carril 29 — las rutas en inglés, en un navegador de verdad.
 *
 * ## Qué prueba
 *
 * 1. Las pantallas de la bóveda abren por su ruta nueva en inglés, y el nav del
 *    marco sólo ofrece direcciones en inglés.
 * 2. Una dirección vieja en castellano —guardada o pegada en un mensaje— llega
 *    a la nueva sin perder su consulta (`?q=`).
 * 3. La raíz vieja de un módulo (`/personas`) también llega.
 *
 * Corre contra la maqueta (`ng serve --configuration development,demo`): las
 * pantallas de la bóveda sólo se montan con `designMockups`. Con la API real
 * las mismas direcciones viejas van a la pantalla real equivalente; eso lo
 * fija `app.routes.design-mockups.spec.ts`.
 */

/** Los módulos de la bóveda con marco, con su segmento nuevo (`/home` es la portada, sin marco). */
const MODULES = ['explore', 'shared-data', 'vocabulary', 'institutions', 'people', 'access'];

/** Se espera al marco de la maqueta: `networkidle` no llega contra `ng serve`. */
async function openMockup(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('[data-alovida-maqueta]', { timeout: 30_000 });
}

test.describe('Carril 29 · rutas en inglés', () => {
  test('la pantalla abre por su ruta en inglés y el nav no ofrece direcciones en castellano', async ({
    page,
  }, testInfo) => {
    await openMockup(page, '/people/patients-list');

    await expect(page).toHaveURL(/\/people\/patients-list$/);
    const hrefs = await page
      .locator('[data-alovida-maqueta] a[href^="/"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute('href') ?? ''));
    const legacy = hrefs.filter((href) =>
      /^\/(inicio|buscar|datos-compartidos|terminologia|directorio|personas|accesos)(\/|$)/.test(
        href,
      ),
    );
    expect(hrefs.length).toBeGreaterThan(0);
    expect(legacy).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath('people-patients-list.png'),
      fullPage: true,
    });
  });

  test('la dirección vieja llega a la nueva y conserva la búsqueda', async ({ page }) => {
    await openMockup(page, '/personas/pacientes-listado?q=ana');

    await expect(page).toHaveURL(/\/people\/patients-list\?q=ana$/);
  });

  test('la raíz vieja de un módulo llega a su primera pantalla', async ({ page }) => {
    await openMockup(page, '/accesos');

    expect(new URL(page.url()).pathname.split('/')[1]).toBe('access');
  });

  test('la portada vieja `/inicio` llega a `/home`', async ({ page }) => {
    await page.goto('/inicio', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByText('No encontramos lo que busca')).toHaveCount(0);
  });

  test('cada módulo nuevo abre su pantalla', async ({ page }) => {
    for (const module of MODULES) {
      await openMockup(page, `/${module}`);
      expect(new URL(page.url()).pathname.split('/')[1], module).toBe(module);
    }
  });
});
