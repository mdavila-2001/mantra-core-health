import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar } from './support/sesion';

/**
 * The patient's «Mis encuestas» in the top bar is ALWAYS offered (06/11/2026),
 * even before the first survey arrives; the screen it opens explains when
 * surveys come (S3 with next action).
 *
 * Runs against the demo build (mock backend), signed in as the mock patient.
 * The mock patient always has invitations, so the «no surveys yet» case is
 * forced with the mock's `vacio` mode (`simulated-failures.ts`): a 200 with an
 * empty list for `GET /surveys/me/invitations`. Before this change that same
 * empty list hid the link entirely, so this spec fails without it.
 *
 * Never waits for `networkidle`: waits on elements.
 */

const PATIENT: Actor = {
  rol: 'paciente',
  identificador: 'paciente@alovida.mock',
  clave: 'mock',
  nombre: 'Paciente',
};

interface Atendida {
  readonly method: string;
  readonly url: string;
  readonly status: number;
  readonly respuesta?: unknown;
}

async function invitacionesLeidas(page: Page): Promise<readonly Atendida[]> {
  const todas = await page.evaluate(
    () => (window as unknown as { __mockRequests?: Atendida[] }).__mockRequests ?? [],
  );
  return todas.filter((r) => r.method === 'GET' && r.url.startsWith('/surveys/me/invitations'));
}

test('sin encuestas todavía: «Mis encuestas» sigue en la barra y lleva al estado vacío', async ({ page }) => {
  // Runs before the app on every load of this tab: the mock reads it per request.
  await page.addInitScript(() => {
    sessionStorage.setItem(
      'mock:fallos',
      JSON.stringify([{ patron: '/surveys/me/invitations', modo: 'vacio', metodos: ['GET'] }]),
    );
  });
  await entrar(page, PATIENT);

  const enlace = page.getByTestId('header-encuestas');
  await expect(enlace).toBeVisible({ timeout: 30_000 });
  await expect(enlace).toContainText('Mis encuestas');
  // No permanent «0»: the number shows only with pending surveys.
  await expect(page.getByTestId('header-encuestas-badge')).toHaveCount(0);

  // The bar really asked and really got nothing.
  await expect.poll(async () => (await invitacionesLeidas(page)).length).toBeGreaterThan(0);
  const [lectura] = await invitacionesLeidas(page);
  expect(lectura!.status).toBe(200);
  expect(lectura!.respuesta).toEqual([]);

  await enlace.click();
  await expect(page).toHaveURL(/\/my-account\/questionnaires\?.*seccion=encuestas/);
  const vacio = page.getByTestId('questionnaires-no-surveys');
  await expect(vacio).toBeVisible({ timeout: 30_000 });
  await expect(vacio).toContainText('Todavía no tiene encuestas');
  await expect(vacio.getByTestId('questionnaires-see-appointments')).toBeVisible();
  await expect(enlace).toHaveAttribute('aria-current', 'page');
  // The link and the tab it lands on share one name.
  await expect(page.getByRole('tab', { name: 'Mis encuestas', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('con encuestas pendientes: «Mis encuestas» muestra el número de pendientes', async ({ page }) => {
  await entrar(page, PATIENT);

  const enlace = page.getByTestId('header-encuestas');
  await expect(enlace).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('header-encuestas-badge')).toBeVisible();

  await enlace.click();
  await expect(page).toHaveURL(/\/my-account\/questionnaires\?.*seccion=encuestas/);
  await expect(page.getByTestId('cuestionarios-lista')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('questionnaires-no-surveys')).toHaveCount(0);
});
