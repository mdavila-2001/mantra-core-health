import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * «Iniciar consulta» en la agenda lleva a la rejilla de la consulta.
 *
 * Es el único origen de la atención: el botón inicia la reserva y navega a
 * `/medical-records/:id/consultation` con el motivo y la cita del turno. Lo
 * que se afirma acá es ese salto de punta a punta, en un navegador.
 */

const SALIDA = join('docs', 'frontend', 'evidence', 'consulta-rejilla');

const MEDICA: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Médica',
};

test.describe('Consulta · desde la agenda', () => {
  test('«Iniciar consulta» abre la rejilla de la persona', async ({ page }) => {
    test.setTimeout(5 * 60_000);
    mkdirSync(SALIDA, { recursive: true });

    await entrar(page, MEDICA);
    await irA(page, '/schedule');
    await estable(page);

    const iniciar = page.getByTestId('agenda-iniciar').first();
    await expect(iniciar).toBeVisible({ timeout: 60_000 });
    await iniciar.click();

    await page.waitForURL(/\/medical-records\/[^/?]+\/consultation(\?.*)?$/, { timeout: 60_000 });
    await estable(page);

    await expect(page.getByTestId('consulta-encuentro')).toBeVisible();
    await expect(page.locator('[data-testid^="consulta-casilla-"]')).toHaveCount(9);
    await page.screenshot({ path: join(SALIDA, 'consulta-desde-agenda-1440.png') });
  });
});
