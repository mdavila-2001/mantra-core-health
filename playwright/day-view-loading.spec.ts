import { expect, test } from '@playwright/test';

import { doctora } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * **Mi agenda · Day view while it loads.**
 *
 * With a slow API the day used to be drawn empty and say "No atiende este
 * día" until the slots and bookings arrived: the doctor believed that day was
 * off. Now the day says it is loading and only claims something once
 * everything arrived.
 *
 * Only the day's slot read is delayed (`GET /scheduling/slots` with
 * `limit=100`, the one-day window); the month's (`limit=500`) goes through.
 * It signs in as the doctor, who is the one who sees this screen.
 */

const DEMORA_MS = 4_000;
const TEXTO_CARGA = 'Cargando los horarios de este día…';

test.describe('Mi agenda · el día no dice «No atiende» mientras carga', () => {
  test('con los cupos del día demorados muestra la carga y, al llegar, la quita', async ({
    page,
  }) => {
    test.setTimeout(150_000);
    const medica = doctora();
    await entrar(page, medica);

    let demorados = 0;
    await page.route(
      (url) => url.pathname.endsWith('/scheduling/slots') && url.searchParams.get('limit') === '100',
      async (route) => {
        demorados += 1;
        await new Promise((listo) => setTimeout(listo, DEMORA_MS));
        await route.continue();
      },
    );

    await irA(page, '/schedule');

    const carga = page.getByTestId('dia-cargando');
    await expect(carga).toBeVisible({ timeout: 30_000 });
    await expect(carga).toContainText(TEXTO_CARGA);
    // Meanwhile the day claims nothing.
    await expect(page.getByText('No atiende este día')).toHaveCount(0);
    await expect(page.getByTestId('dia-horario-flexible')).toHaveCount(0);

    // The answer arrived: the loading state goes away.
    await expect(carga).toBeHidden({ timeout: DEMORA_MS + 30_000 });
    await estable(page);
    await expect(page.getByText(TEXTO_CARGA)).toHaveCount(0);
    expect(demorados).toBeGreaterThan(0);
  });
});
