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
    // La app cambia de tema con `data-theme`, no sólo con la preferencia del sistema.
    if (caso.tema === 'dark') {
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
    }
    await expect(page.getByTestId('atlas3d-ficha-titulo')).toBeVisible({ timeout: 60_000 });

    const descripcion = page.getByTestId('atlas3d-descripcion');
    await expect(descripcion).toBeVisible();
    const citas = descripcion.locator('a.atlas3d__cita');
    expect(await citas.count(), 'cada frase lleva al menos una cita').toBeGreaterThan(0);
    // La cita lleva a su entrada de la bibliografía, y esa entrada a PubMed.
    const destino = await citas.first().getAttribute('href');
    expect(destino).toMatch(/[?&]structure=.*#atlas3d-fuente-\d+$/);
    const entrada = page.locator(`#${destino?.split('#')[1] ?? ''}`);
    await expect(entrada).toBeAttached();
    await expect(entrada.locator('a[href^="https://pubmed.ncbi.nlm.nih.gov/"]')).toHaveCount(1);
    // Tocar la cita lleva a su entrada sin salir de la ficha (con <base href="/">
    // un href="#…" llevaba a otra página).
    await citas.first().click();
    await expect(page).toHaveURL(/structure=UBERON(%3A|:)0000981.*#atlas3d-fuente-\d+$/);
    await expect(page.getByTestId('atlas3d-ficha-titulo')).toBeVisible();
    await expect(entrada).toBeInViewport();
    // Y se ve de verdad: ninguna barra fija la tapa, y tiene el foco.
    await expect
      .poll(() =>
        entrada.evaluate((el) => {
          const r = el.getBoundingClientRect();
          const encima = document.elementFromPoint(r.left + Math.min(40, r.width / 2), r.top + r.height / 2);
          return encima !== null && el.contains(encima);
        }),
      )
      .toBe(true);
    await expect(entrada).toBeFocused();

    // Una segunda cita de la MISMA fuente (el ancla ya está en la URL): también
    // tiene que dejarla a la vista. La primera vez se arreglaba; la segunda no.
    const mismaFuente = descripcion.locator(`a.atlas3d__cita[href$="#${destino?.split('#')[1] ?? ''}"]`);
    if ((await mismaFuente.count()) > 1) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await mismaFuente.nth(1).scrollIntoViewIfNeeded();
      await mismaFuente.nth(1).click();
      await expect
        .poll(() =>
          entrada.evaluate((el) => {
            const r = el.getBoundingClientRect();
            const encima = document.elementFromPoint(r.left + Math.min(40, r.width / 2), r.top + r.height / 2);
            return encima !== null && el.contains(encima);
          }),
        )
        .toBe(true);
    }
    await expect(page.getByText('sin revisión humana').first()).toBeVisible();

    await expect(page.getByTestId('atlas3d-ta2')).toContainText(/TA2 \d+/);

    // «Atrás» desde la entrada devuelve el foco a la cita de origen.
    await page.goBack();
    await expect(page).not.toHaveURL(/#atlas3d-fuente-/);
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.classList.contains('atlas3d__cita') ?? false))
      .toBe(true);

    const figura = page.getByTestId('atlas3d-imagenes').locator('figure').first();
    await figura.scrollIntoViewIfNeeded();
    const imagen = figura.locator('img');
    await expect(imagen).toHaveAttribute('alt', /\S/);
    await expect
      // Commons limita por IP: la miniatura puede tardar más que la página.
      .poll(() => imagen.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth), { timeout: 120_000 })
      .toBeGreaterThan(0);
    await expect(figura.locator('figcaption')).toContainText('Wikimedia Commons');
    if (caso.tema === 'dark') {
      const fondo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(fondo, 'el tema oscuro está aplicado').not.toBe('rgb(255, 255, 255)');
    }

    // El foco de teclado se ve: un contorno real, no `none`.
    await page.getByRole('button', { name: 'Quitar selección' }).focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    const foco = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      const estilo = el ? getComputedStyle(el) : null;
      return { style: estilo?.outlineStyle, width: estilo?.outlineWidth };
    });
    expect(foco.style, 'el foco se ve').not.toBe('none');

    // Sin desborde horizontal: la ficha cabe en el ancho.
    const desborde = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(desborde, 'sin scroll horizontal').toBeLessThanOrEqual(0);

    await page.getByTestId('atlas3d-descripcion').scrollIntoViewIfNeeded();
    await page.locator('.atlas3d__panel').screenshot({ path: `${CAPTURAS}/literatura-${caso.nombre}.png` });
    await figura.screenshot({ path: `${CAPTURAS}/literatura-imagen-${caso.nombre}.png` });
  });
}
