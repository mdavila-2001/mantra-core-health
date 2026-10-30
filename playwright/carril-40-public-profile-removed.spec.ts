import { expect, test } from '@playwright/test';

import { doctora } from './support/actores';
import { irA } from './support/sesion';
import {
  REAL_API,
  REAL_API_SKIP_REASON,
  openRealSession,
  responseOf,
  type RealSession,
} from './support/real-session';

/**
 * Carril 40 · sacar el perfil público («vitrina»), contra la API real.
 *
 * El carril es una **remoción**: se borró `/my-account/preview` y el enlace
 * «Ver cómo me ven» (`practitioner-profile-view.spec.ts`, pedido del
 * propietario del 10/09/2026). No quedó ningún interruptor de «perfil
 * público» ni endpoint de visibilidad, así que no hay mutación que probar: lo
 * que se mide es que la ficha y el editor se sirven con datos reales sin la
 * vitrina, que la ruta vieja cae en «no encontrado», y que el directorio —que
 * es por donde un paciente sí ve al médico— sigue respondiendo.
 *
 *   E2E_API_REAL=1 corepack yarn pw carril-40-public-profile-removed --workers=1
 */

test.describe.configure({ mode: 'serial' });
test.skip(!REAL_API, REAL_API_SKIP_REASON);

let session: RealSession;

test.beforeAll(async ({ browser }) => {
  session = await openRealSession(browser, doctora());
});

test.afterAll(async () => {
  await session?.close();
});

test('la ficha propia carga de la API y ya no ofrece «Ver cómo me ven»', async () => {
  const { page } = session;
  const summary = await responseOf(page, 'GET', /\/profiles\/practitioners\/me\/summary$/, () =>
    irA(page, '/my-account'),
  );
  expect(summary.status()).toBe(200);

  await expect(page.getByTestId('mi-perfil-editar')).toBeVisible();
  await expect(page.getByRole('link', { name: /Ver cómo me ven/ })).toHaveCount(0);
  await expect(page.locator('a[href*="/my-account/preview"]')).toHaveCount(0);
});

test('el editor tampoco enlaza a la vitrina', async () => {
  const { page } = session;
  await page.getByTestId('mi-perfil-editar').click();
  await expect(page).toHaveURL(/\/my-account\/edit/);
  await expect(page.getByTestId('edicion-pestanas')).toBeVisible();
  await expect(page.locator('a[href*="/my-account/preview"]')).toHaveCount(0);
});

test('la dirección vieja de la vitrina responde «no encontrado»', async () => {
  const { page } = session;
  await irA(page, '/my-account/preview');
  const notFound = page.getByTestId('no-encontrado');
  await expect(notFound).toBeVisible();
  await expect(notFound).toContainText('No encontramos lo que busca');
  await notFound.getByRole('link', { name: 'Ir al inicio' }).click();
  await expect(page).not.toHaveURL(/\/my-account\/preview/);
});

test('el directorio de médicos sigue vivo contra la API', async () => {
  const { page } = session;
  const list = await responseOf(page, 'GET', /\/profiles\/practitioners$/, () =>
    irA(page, '/directory'),
  );
  expect(list.status()).toBe(200);
  await expect(page.getByTestId('no-encontrado')).toHaveCount(0);
});
