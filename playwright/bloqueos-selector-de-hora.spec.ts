import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

/**
 * Block form on /schedule/blocks (2026-11-06): «Desde» and «Hasta» are a time
 * picker (`type="time"`, 5-minute step) instead of free `HH:MM` text, with
 * presets, an inline error for an inverted range and a live summary.
 *
 * Flow: UI → save → the block shows up in «Vigentes» with the chosen range →
 * reload → still there. Runs against the demo (in-browser mock API).
 * Screenshots go to SALIDA for the visual review.
 */
const SALIDA = join('artifacts', 'evidencia', '2026-11-06-bloqueos-selector-de-hora');

async function entrarComoMedica(page: Page): Promise<void> {
  await page.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByTestId('login-identifier').fill('medica@alovida.mock');
  await page.getByTestId('login-password').fill('mockup');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
}

/** `dd/mm/aaaa` of a day `dias` from today, far enough to be «Vigente». */
function fechaFutura(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

for (const [nombre, ancho, tema] of [
  ['escritorio-oscuro', 1440, 'dark'],
  ['celular-claro', 390, 'light'],
] as const) {
  test(`bloquear una franja con el selector de hora · ${nombre}`, async ({ page }) => {
    test.setTimeout(240_000);
    mkdirSync(SALIDA, { recursive: true });
    await page.emulateMedia({ colorScheme: tema });
    await page.setViewportSize({ width: ancho, height: ancho > 800 ? 900 : 844 });
    await entrarComoMedica(page);

    await page.goto('/schedule/blocks', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('bloqueo-nuevo').click();
    const form = page.locator('app-block-form');
    await expect(form).toBeVisible();

    // The date pickers now have a visible label.
    await expect(form.getByRole('textbox', { name: /^Primer día/ })).toBeVisible();
    await expect(form.getByRole('textbox', { name: /^Último día/ })).toBeVisible();

    const dia = fechaFutura(40 + (ancho > 800 ? 0 : 1));
    // The date picker masks its text: type the digits like a person, not `fill`.
    const primerDia = form.getByTestId('bloqueo-desde').locator('input');
    await primerDia.click();
    await primerDia.pressSequentially(dia.replace(/\//g, ''), { delay: 30 });
    await primerDia.press('Tab');
    await expect(primerDia).toHaveValue(dia);
    // Picking the first day fills the last one: a one-day block needs one date.
    await expect(form.getByTestId('bloqueo-hasta').locator('input')).toHaveValue(dia);

    await page.getByRole('radio', { name: 'Sólo una franja de cada día' }).click();
    const desde = form.getByTestId('bloqueo-hora-desde');
    const hasta = form.getByTestId('bloqueo-hora-hasta');
    await expect(desde).toHaveAttribute('type', 'time');
    await expect(desde).toHaveAttribute('step', '300');

    // Preset fills both times and is marked as pressed.
    const manana = form.getByTestId('bloqueo-atajo-08:00');
    await manana.click();
    await expect(desde).toHaveValue('08:00');
    await expect(hasta).toHaveValue('12:00');
    await expect(manana).toHaveAttribute('aria-pressed', 'true');

    // Inverted range: the error shows on «Hasta» before saving.
    await hasta.fill('07:30');
    await expect(form.getByText('Tiene que ser posterior a la hora de inicio.')).toBeVisible();

    await desde.fill('09:15');
    await hasta.fill('11:45');
    const resumen = form.getByTestId('bloqueo-resumen');
    await expect(resumen).toContainText('1 día · de 09:15 a 11:45 (2 h 30 min) ese día');
    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(desborde).toBeLessThanOrEqual(1);
    await form.screenshot({ path: join(SALIDA, `${nombre}-formulario.png`) });

    await form.getByTestId('bloqueo-enviar').click();
    await expect(form).toBeHidden();

    const tarjeta = page.locator('.bloqueos__item').filter({ hasText: 'de 09:15 a 11:45' });
    await expect(tarjeta).toHaveCount(1);
    await page.screenshot({ path: join(SALIDA, `${nombre}-lista.png`), fullPage: true });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(
      page.locator('.bloqueos__item').filter({ hasText: 'de 09:15 a 11:45' }),
    ).toHaveCount(1);
  });
}
