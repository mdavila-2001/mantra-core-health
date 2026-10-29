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
 * Carril 31 · borrar la pantalla vieja de «consulta médica», contra la API real.
 *
 * El 10/09/2026 el propietario pidió borrar `/consultation`, que duplicaba a
 * «Consultas médicas» (`navigation.subgroups.spec.ts`). El carril es una
 * **remoción de pantalla**: no existe ninguna acción de «eliminar consulta» en
 * el front ni un `DELETE` de encuentro en los clientes, así que no hay mutación
 * que probar. Se mide, con la sesión real del médico, lo que el usuario hace:
 * entrar por el renglón del menú, llegar a la agenda que sobrevive
 * (con sus datos de la API) y comprobar que la dirección vieja ya no se sirve.
 *
 *   E2E_API_REAL=1 corepack yarn pw carril-31-removed-consultation-screen --workers=1
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

test('el menú lleva a la agenda y no a la pantalla borrada', async () => {
  const { page } = session;
  await irA(page, '/');

  // Hasta el 28/10/2026 se entraba por la zona «Consultas» del árbol del
  // panel; el árbol se retiró y la puerta es el renglón del menú.
  const links = page.getByTestId('nav-enlace');
  await expect(links.first()).toBeAttached();
  await expect(page.locator('[data-testid="nav-enlace"][data-route="/consultation"]')).toHaveCount(0);

  const agenda = page.locator('[data-testid="nav-enlace"][data-route="/schedule"]');
  await expect(agenda).toBeVisible();
  const resources = await responseOf(page, 'GET', /\/scheduling\/resources$/, () => agenda.click());
  expect(resources.status()).toBe(200);
  await expect(page).toHaveURL(/\/schedule$/);
  await expect(page.getByRole('heading', { name: 'Consultas', level: 1 })).toBeVisible();
});

test('la dirección vieja `/consultation` responde «no encontrado»', async () => {
  const { page } = session;
  await irA(page, '/consultation');
  const notFound = page.getByTestId('no-encontrado');
  await expect(notFound).toBeVisible();
  await expect(notFound).toContainText('No encontramos lo que busca');
  await expect(page).toHaveTitle(/Página no encontrada/);
});
