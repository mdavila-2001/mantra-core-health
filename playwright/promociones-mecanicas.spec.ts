/* ============================================================================
    Promociones de farmacia con las 14 mecánicas, en un navegador.

    Corre contra la **maqueta** (`mockBackend`): entra `farmacia@alovida.mock`
    por la pantalla de ingreso, arma campañas de cada familia en el formulario
    nuevo y comprueba que lo publicado se ve en la lista releída y en la ficha
    pública. No necesita API ni Docker.

    Con `--workers=1` y `E2E_BASE_URL` apuntando al `ng serve` que esté arriba.
    Las capturas van a `docs/progress/evidence/promociones-mecanicas/`.
    ========================================================================== */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { test, expect, type Locator, type Page } from '@playwright/test';

import { farmacia, type Actor } from './support/actores';
import { entrar, irA } from './support/sesion';

const EVIDENCIA = join('docs', 'progress', 'evidence', 'promociones-mecanicas');
const RUTA = '/administration/pharmacy-campaigns';

/** Los anchos que se miran: móvil estrecho, tableta, escritorio y una ventana baja. */
const VISTAS = [
  { nombre: '375', width: 375, height: 800 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '1440', width: 1440, height: 900 },
  { nombre: '1280x680', width: 1280, height: 680 },
] as const;

const FAMILIAS = ['PRICE', 'QUANTITY', 'ORDER_TOTAL', 'COMBO', 'LOYALTY'] as const;

function seccionNueva(page: Page): Locator {
  return page.locator('section[aria-labelledby="campanas-nueva"]');
}

async function elegirFamilia(page: Page, familia: (typeof FAMILIAS)[number]): Promise<void> {
  await page.locator(`[data-testid="segmentado-${familia}"]`).click();
  await expect(page.locator(`[data-testid="segmentado-${familia}"]`)).toHaveAttribute('aria-checked', 'true');
}

async function sinScrollHorizontal(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
}

test.describe('promociones: formulario con todas las mecánicas', () => {
  const errores: string[] = [];

  test.beforeEach(async ({ page }) => {
    mkdirSync(EVIDENCIA, { recursive: true });
    errores.length = 0;
    page.on('console', (mensaje) => {
      if (mensaje.type() === 'error') errores.push(mensaje.text());
    });
    await entrar(page, farmacia() as Actor);
    await irA(page, RUTA);
    await expect(seccionNueva(page)).toBeVisible({ timeout: 30_000 });
  });

  test('el selector de dos opciones ya no está: hay cinco familias y catorce mecánicas', async ({ page }) => {
    await expect(page.getByText('Cómo se calcula el descuento')).toHaveCount(0);
    for (const familia of FAMILIAS) {
      await expect(page.locator(`[data-testid="segmentado-${familia}"]`)).toBeVisible();
    }
    // Recorrer las familias deja ver cada mecánica: 4 + 3 + 3 + 3 + 1 = 14.
    let total = 0;
    for (const familia of FAMILIAS) {
      await elegirFamilia(page, familia);
      total += await page.locator('[data-testid="regla-mecanicas"] input[type="radio"]').count();
    }
    expect(total).toBe(14);
  });

  for (const vista of VISTAS) {
    test(`se ve bien a ${vista.nombre} en claro`, async ({ page }) => {
      await page.setViewportSize({ width: vista.width, height: vista.height });
      await irA(page, RUTA);
      await expect(seccionNueva(page)).toBeVisible();
      for (const familia of FAMILIAS) {
        await elegirFamilia(page, familia);
        await seccionNueva(page).locator('[data-testid="regla-editor"]').screenshot({
          path: join(EVIDENCIA, `formulario-${familia}-${vista.nombre}-claro.png`),
        });
        expect(await sinScrollHorizontal(page), `scroll horizontal en ${familia} a ${vista.nombre}`).toBe(true);
      }
    });
  }

  test('se ve bien en oscuro a 1440', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.setViewportSize({ width: 1440, height: 900 });
    await irA(page, RUTA);
    await expect(seccionNueva(page)).toBeVisible();
    for (const familia of FAMILIAS) {
      await elegirFamilia(page, familia);
      await seccionNueva(page).locator('[data-testid="regla-editor"]').screenshot({
        path: join(EVIDENCIA, `formulario-${familia}-1440-oscuro.png`),
      });
    }
  });

  test('la consola queda limpia', async () => {
    expect(errores).toEqual([]);
  });
});
