import { expect, test } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * «Mi historia clínica» by date, against the simulator (`yarn start:demo`):
 * when the orders read answers 403, the partial failure is a wall (S5) in the
 * warning tone, as in «Mi recorrido». It used to be painted as an S9 fault,
 * in red and with a support code, which a 403 is not (ADR-0005).
 *
 * The 403 is provoked with `mock:fallos` (`src/app/core/mock/simulated-failures.ts`).
 */

const PACIENTE: Actor = { rol: 'paciente', identificador: 'paciente@alovida.mock', clave: 'mock', nombre: 'Paciente' };

test('un 403 en las órdenes es un aviso en «Por fecha», no una falla roja con código', async ({ page }) => {
  test.setTimeout(5 * 60_000);
  await entrar(page, PACIENTE);
  await page.evaluate(() =>
    sessionStorage.setItem(
      'mock:fallos',
      JSON.stringify([{ patron: '/diagnostic-results/me/orders', modo: 'forbidden', metodos: ['GET'] }]),
    ),
  );
  await irA(page, '/my-account/medical-record');
  await estable(page);

  const atenciones = page.getByTestId('historia-atenciones');
  await expect(atenciones).toBeVisible({ timeout: 60_000 });
  await atenciones.locator('.accordion-panel__trigger').first().click();

  const falta = page.getByTestId('historia-detalle-falta');
  await expect(falta).toBeVisible();
  await expect(falta.locator('.alert--warning')).toContainText('No puede ver las notas y los estudios de sus atenciones');
  await expect(falta.locator('.alert--error')).toHaveCount(0);
  await expect(falta.getByTestId('support-code')).toHaveCount(0);
  await expect(falta.getByRole('button', { name: 'Reintentar' })).toHaveCount(0);
  // What already arrived is still drawn: the encounters stay.
  await expect(atenciones.locator('.accordion-panel__trigger').first()).toBeVisible();
});
