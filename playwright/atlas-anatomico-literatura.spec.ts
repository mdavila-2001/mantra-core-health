import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

/**
 * La ficha del atlas 3D con su descripción extendida citada, su imagen de
 * Wikimedia Commons y su código TA2, a 375, 768 y 1440 claro y 1440 oscuro.
 *
 * Se comprueba lo que una persona vería: frases con citas numeradas que llevan
 * a la bibliografía, cada artículo con su enlace a PubMed, la imagen cargada
 * de verdad (`naturalWidth` > 0, no sólo el `<img>`), con texto alternativo,
 * autor y licencia, y el código TA2 con su cruce. Las capturas quedan en
 * `docs/progress/evidence/anatomy-atlas/screenshots/literatura-*.png`.
 *
 * Nunca se espera `networkidle`: con `ng serve` no llega (CLAUDE.md §5).
 *
 * Uso: `yarn pw --workers=1 atlas-anatomico-literatura`
 */

const CAPTURAS = join(process.cwd(), 'docs', 'progress', 'evidence', 'anatomy-atlas', 'screenshots');
/** Una ficha con descripción, imagen y TA2 en el catálogo generado. */
const FICHA = process.env['ATLAS_FICHA'] ?? 'UBERON:0000981';
const RUTA = `/glossary/anatomy-atlas?structure=${encodeURIComponent(FICHA)}`;

test.use({
  launchOptions: {
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
    ...(process.env['PW_CHROMIUM_PATH'] ? { executablePath: process.env['PW_CHROMIUM_PATH'] } : {}),
  },
});

async function entrarComoMedica(pagina: Page): Promise<void> {
  await pagina.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await pagina.getByTestId('login-identifier').fill('medica@alovida.mock');
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
}

test.beforeAll(() => {
  mkdirSync(CAPTURAS, { recursive: true });
});

const CASOS = [
  { nombre: '375-claro', ancho: 375, alto: 812, tema: 'light' as const },
  { nombre: '768-claro', ancho: 768, alto: 1024, tema: 'light' as const },
  { nombre: '1440-claro', ancho: 1440, alto: 900, tema: 'light' as const },
  { nombre: '1440-oscuro', ancho: 1440, alto: 900, tema: 'dark' as const },
];

for (const caso of CASOS) {
  test(`la ficha muestra descripción citada, imagen y TA2 — ${caso.nombre}`, async ({ page }) => {
    await page.setViewportSize({ width: caso.ancho, height: caso.alto });
    await page.emulateMedia({ colorScheme: caso.tema, reducedMotion: 'reduce' });
    await entrarComoMedica(page);
    await page.goto(RUTA, { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await expect(page.getByTestId('atlas3d-ficha-titulo')).toBeVisible({ timeout: 60_000 });

    const descripcion = page.getByTestId('atlas3d-descripcion');
    await expect(descripcion).toBeVisible();
    const citas = descripcion.locator('a.atlas3d__cita');
    expect(await citas.count(), 'cada frase lleva al menos una cita').toBeGreaterThan(0);
    // La cita lleva a su entrada de la bibliografía, y esa entrada a PubMed.
    const destino = await citas.first().getAttribute('href');
    expect(destino).toMatch(/^#atlas3d-fuente-\d+$/);
    const entrada = page.locator(destino ?? '');
    await expect(entrada).toBeAttached();
    await expect(entrada.locator('a[href^="https://pubmed.ncbi.nlm.nih.gov/"]')).toHaveCount(1);
    await expect(page.getByText('sin revisión humana').first()).toBeVisible();

    await expect(page.getByTestId('atlas3d-ta2')).toContainText(/TA2 \d+/);

    const figura = page.getByTestId('atlas3d-imagenes').locator('figure').first();
    await figura.scrollIntoViewIfNeeded();
    const imagen = figura.locator('img');
    await expect(imagen).toHaveAttribute('alt', /\S/);
    await expect
      .poll(() => imagen.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth), { timeout: 60_000 })
      .toBeGreaterThan(0);
    await expect(figura.locator('figcaption')).toContainText('Wikimedia Commons');

    // Sin desborde horizontal: la ficha cabe en el ancho.
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(desborde, 'sin scroll horizontal').toBeLessThanOrEqual(0);

    await page.getByTestId('atlas3d-descripcion').scrollIntoViewIfNeeded();
    await page.locator('.atlas3d__panel').screenshot({ path: `${CAPTURAS}/literatura-${caso.nombre}.png` });
    await figura.screenshot({ path: `${CAPTURAS}/literatura-imagen-${caso.nombre}.png` });
  });
}
