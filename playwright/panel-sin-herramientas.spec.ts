import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Evidencia del 28/10/2026: el panel del médico ya no dibuja «Sus
 * herramientas», y las cuatro pantallas cuya única puerta era ese árbol
 * («Grupos y foros», «Laboratorio e imagen», «Encuestas» y «Organización
 * médica») se ofrecen en el menú lateral y abren.
 *
 * Contra el backend simulado (`ng serve`, configuración de desarrollo).
 */
const SALIDA = join('artifacts', 'playwright', 'panel-sin-herramientas');
const MEDICA: Actor = {
  rol: 'doctora', identificador: 'medica@alovida.mock', clave: 'mock', nombre: 'Médica',
};

/** Espera a que la pantalla deje de moverse y de cargar antes de capturar. */
async function quieta(page: Page): Promise<void> {
  await expect(page.locator('app-skeleton, [aria-busy="true"]')).toHaveCount(0, { timeout: 15_000 });
  await page.evaluate(async () => {
    const finitas = document
      .getAnimations()
      .filter((a) => a.playState === 'running' && a.effect?.getComputedTiming().endTime !== Infinity);
    await Promise.race([
      Promise.all(finitas.map((a) => a.finished.catch(() => undefined))),
      new Promise((listo) => setTimeout(listo, 3_000)),
    ]);
  });
}

test('el panel del médico no tiene «Sus herramientas» y el menú abre lo que colgaba de ahí', async ({ page }) => {
  mkdirSync(SALIDA, { recursive: true });
  await entrar(page, MEDICA);
  await irA(page, '/dashboard');
  await estable(page);

  await expect(page.getByTestId('panel-accesos')).toHaveCount(0);
  await expect(page.getByText('Sus herramientas', { exact: true })).toHaveCount(0);
  await expect(page.getByTestId('panel-consultas-resumen')).toBeVisible();
  await quieta(page);
  await page.screenshot({ path: join(SALIDA, 'panel-1440.png'), fullPage: true });

  for (const ruta of ['/groups', '/diagnostics', '/questionnaires', '/administration/medical-organization']) {
    const enlace = page.locator(`[data-testid="nav-enlace"][data-route="${ruta}"]`);
    await expect(enlace, `${ruta} tiene renglón en el menú`).toBeVisible();
    await enlace.click();
    await page.waitForURL((url) => url.pathname === ruta || url.pathname.startsWith(`${ruta}/`));
    await estable(page);
    await expect(page.locator('app-section-placeholder, app-not-found, app-error-recovery')).toHaveCount(0);
    await expect(page.locator('h1:visible, app-empty-state:visible').first()).toBeVisible();
    await quieta(page);
    await page.screenshot({ path: join(SALIDA, `${ruta.slice(1).replaceAll('/', '-')}.png`) });
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await irA(page, '/dashboard');
  await estable(page);
  await expect(page.getByTestId('panel-accesos')).toHaveCount(0);
  await quieta(page);
  await page.screenshot({ path: join(SALIDA, 'panel-390.png'), fullPage: true });
});
