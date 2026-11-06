import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * The symptom-check body figure in the booking's right column (client request,
 * 2026-11-04): reason text → figure, figure → reason, then hold, confirm and
 * reload. Evidence in `artifacts/evidencia/2026-11-04-reserva-figura-cuerpo`.
 */
const PACIENTE: Actor = {
  rol: 'paciente',
  identificador: 'paciente@alovida.mock',
  clave: 'mock',
  nombre: 'Paciente',
};
const SALIDA = join('artifacts', 'evidencia', '2026-11-04-reserva-figura-cuerpo');

async function foto(page: Page, archivo: string): Promise<void> {
  await page.screenshot({ path: join(SALIDA, archivo), animations: 'disabled' });
}

test.use({
  launchOptions: process.env['PW_CHROMIUM'] ? { executablePath: process.env['PW_CHROMIUM'] } : {},
});

test('la reserva muestra la figura del cuerpo conectada al motivo', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  // Which mannequin renders cannot be read from the DOM (the href is a blob
  // copy), so the request for the image file is the observable signal.
  const maniquies: string[] = [];
  page.on('request', (r) => {
    const m = /\/body-map\/(\w+)-front\.webp/.exec(r.url());
    if (m) maniquies.push(m[1]!);
  });
  await entrar(page, PACIENTE);

  // Slot ids are rebuilt from the mock seeds (`core/mock/fixtures/agenda.ts`):
  // morning slots of the synthetic practitioner over the next working days.
  const rutas = await page.evaluate(() => {
    const uuid = (seed: string): string => {
      let h1 = 0x811c9dc5;
      let h2 = 0x01000193;
      for (let i = 0; i < seed.length; i++) {
        const c = seed.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
        h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
      }
      const hex = (n: number): string => n.toString(16).padStart(8, '0');
      const raw = `${hex(h1)}${hex(h2)}${hex((h1 * 31 + h2) >>> 0)}${hex((h2 * 17 + h1) >>> 0)}`;
      return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-a${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
    };
    const recurso = uuid(`resource-${uuid('hpid-medica')}`);
    const salida: string[] = [];
    for (let offset = 2; offset <= 9; offset++) {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      if (d.getDay() === 0 || d.getDay() === 3) continue;
      for (const m of [600, 630, 660, 690, 540, 570]) {
        d.setHours(Math.floor(m / 60), m % 60, 0, 0);
        const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const cupo = uuid(`slot-${uuid('template-medica-manana')}-${dia}-${m}`);
        const fin = new Date(d.getTime() + 30 * 60_000);
        salida.push(
          `/my-account/appointments/book/${cupo}?recurso=${recurso}&desde=${d.toISOString()}&hasta=${fin.toISOString()}`,
        );
      }
    }
    return salida;
  });
  // Some slots are taken by mock bookings: try until a free one opens.
  for (const ruta of rutas) {
    // Same route with another slot reuses the component: leave and come back.
    await irA(page, '/my-account/appointments');
    await irA(page, ruta);
    await expect(page).toHaveURL(new RegExp(ruta.split('?')[0]!));
    await estable(page);
    const resultado = page.getByTestId('reserva-form').or(page.getByText('Ese horario ya no está'));
    await expect(resultado.first()).toBeVisible({ timeout: 15_000 });
    if (await page.getByTestId('reserva-form').isVisible()) break;
  }
  await expect(page).toHaveURL(/\/my-account\/appointments\/book\//);

  const figura = page.getByTestId('reserva-figura');
  await expect(figura).toBeVisible();
  // The silhouette follows the booking patient (Ana, FEMALE in the mock), not
  // the neutral fallback it always showed before (bug 2026-11-05).
  await expect.poll(() => maniquies.includes('female')).toBe(true);
  await figura.scrollIntoViewIfNeeded();

  // The figure sits to the right of the form, not below it.
  const form = await page.getByTestId('reserva-form').boundingBox();
  const caja = await figura.boundingBox();
  expect(form && caja && caja.x > form.x + form.width).toBeTruthy();
  await foto(page, '01-figura-vacia-1440-light.png');

  // Text → figure.
  const motivo = page.locator('app-textarea textarea');
  await motivo.fill('Me duele la cabeza desde ayer');
  await expect(page.getByTestId('reserva-figura-reconocidos')).toContainText('dolor de cabeza');
  await expect(page.locator('.body-map__zona--marcada')).not.toHaveCount(0);
  await foto(page, '02-texto-marca-cabeza-1440-light.png');

  // Figure → text.
  await page.getByTestId('reserva-figura-cabeza').click();
  await page
    .getByTestId('reserva-figura-opciones')
    .getByRole('button', { name: 'mareo', exact: true })
    .click();
  await expect(motivo).toHaveValue('Me duele la cabeza desde ayer, mareo');
  await foto(page, '03-figura-agrega-mareo-1440-light.png');

  // The theme is set by the document attribute (see `core/tokens/theme.service.ts`).
  const tema = (oscuro: boolean) =>
    page.evaluate((o) => {
      document.documentElement.setAttribute('data-theme', o ? 'dark' : 'light');
      document.documentElement.setAttribute('data-tema', o ? 'oscuro' : 'claro');
    }, oscuro);
  await tema(true);
  await foto(page, '04-figura-1440-dark.png');
  await tema(false);

  await page.setViewportSize({ width: 390, height: 844 });
  await figura.scrollIntoViewIfNeeded();
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(ancho).toBeLessThanOrEqual(390);
  await foto(page, '05-figura-390-light.png');
  await page.setViewportSize({ width: 1440, height: 900 });

  // ---- End to end: UI → request → response → persistence → reload → UI.
  const motivoEsperado = 'Me duele la cabeza desde ayer, mareo';
  await page.getByRole('button', { name: 'Retener el cupo' }).click();
  await expect(page.getByText('Se lo guardamos hasta las')).toBeVisible();
  // Held: the figure still shows the head but no longer offers to add.
  await expect(page.getByTestId('reserva-figura-opciones')).toHaveCount(0);
  await expect(page.locator('.body-map__zona--marcada')).not.toHaveCount(0);
  await figura.scrollIntoViewIfNeeded();
  await foto(page, '06-retenido-figura-solo-lectura-1440-light.png');

  await page.getByRole('button', { name: 'Confirmar la reserva' }).click();
  await expect(page).toHaveURL(/\/my-account\/appointments(\?|$)/, { timeout: 20_000 });

  // The confirming request carried the reason built with the figure, and the mock accepted it.
  const confirmacion = await page.evaluate(() =>
    (
      (
        window as unknown as {
          __mockRequests?: { method: string; url: string; status?: number; body: unknown }[];
        }
      ).__mockRequests ?? []
    )
      .filter((r) => r.method === 'POST' && /\/holds\/.+\/(confirm|request)/.test(r.url))
      .at(-1),
  );
  expect(confirmacion?.status).toBeLessThan(300);
  expect(JSON.stringify(confirmacion?.body)).toContain(motivoEsperado);

  // Full reload: the booking is still there with its reason.
  await page.reload();
  await estable(page);
  const cita = page.locator('.turnos__motivo', { hasText: motivoEsperado }).first();
  await expect(cita).toBeVisible({ timeout: 20_000 });
  await cita.scrollIntoViewIfNeeded();
  await foto(page, '07-mis-citas-tras-recarga-1440-light.png');
});
