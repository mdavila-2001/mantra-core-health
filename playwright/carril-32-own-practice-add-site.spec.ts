import { expect, test, type Page } from '@playwright/test';

import { doctora } from './support/actores';
import { irA } from './support/sesion';
import {
  REAL_API,
  REAL_API_SKIP_REASON,
  openRealSession,
  reloadApp,
  responseOf,
  uniqueSuffix,
  type RealSession,
} from './support/real-session';

/**
 * Carril 32 · mi consultorio propio: agregar un lugar de atención, contra la API real.
 *
 * Criterios derivados de `work-history.ts` y su spec Vitest: una sola puerta
 * («Agregar lugar de atención» → padrón → «Cargarlo yo»); el alta manda
 * `POST /practitioners/me/sites` con el cuerpo del formulario; la lista se
 * relee **del servidor**; el teléfono se corrige aparte
 * (`PUT /practitioners/me/sites/:id/contact-phone`); y el lugar figura también
 * en la pestaña «Dónde atiendo» de la ficha propia.
 *
 * Datos propios: el nombre lleva un sufijo único. Un consultorio propio no
 * tiene «Dejar de atender» en la pantalla (sólo las sedes ajenas), así que la
 * limpieza es por API: `DELETE /practitioners/me/sites/:id`, que cierra el
 * vínculo. La última prueba lo hace y comprueba, recargando, que ya no figura.
 *
 *   E2E_API_REAL=1 corepack yarn pw carril-32-own-practice-add-site --workers=1
 */

test.describe.configure({ mode: 'serial' });
test.skip(!REAL_API, REAL_API_SKIP_REASON);

const MY_PRACTICE = '/administration/my-practice';
const SITE_NAME = `Consultorio E2E ${uniqueSuffix()}`;
const SITE_ADDRESS = 'Av. Busch 500, 2.º piso';
const SITE_CITY = 'Santa Cruz de la Sierra';
const SITE_PHONE = '3 3345678';

let session: RealSession;
let siteId: string | null = null;

test.beforeAll(async ({ browser }) => {
  session = await openRealSession(browser, doctora());
});

test.afterAll(async () => {
  if (session === undefined) return;
  if (siteId !== null) {
    const cleanup = await session.api.delete(
      `/practitioners/me/sites/${encodeURIComponent(siteId)}`,
      { headers: session.authHeaders() },
    );
    expect([200, 204, 404], `limpieza del consultorio: ${await cleanup.text()}`).toContain(
      cleanup.status(),
    );
  }
  await session.close();
});

function siteRow(page: Page) {
  return page.getByTestId('sedes-propias').getByRole('row').filter({ hasText: SITE_NAME });
}

/** La tabla pagina de a diez: se busca por nombre para no depender de la página 1. */
async function searchSite(page: Page, text = SITE_NAME): Promise<void> {
  await page
    .getByTestId('sedes-propias')
    .getByRole('textbox', { name: 'Buscar por nombre o dirección' })
    .fill(text);
}

async function listedSiteNames(s: RealSession): Promise<string[]> {
  const response = await s.api.get(`/practitioners/${s.practitionerProfileId()}/sites`, {
    headers: s.authHeaders(),
  });
  expect(response.status(), 'GET /practitioners/:id/sites').toBe(200);
  const body = (await response.json()) as { items?: { name: string }[] } | { name: string }[];
  const items = Array.isArray(body) ? body : (body.items ?? []);
  return items.map((item) => item.name);
}

test('agrega un consultorio propio por «Cargarlo yo» y la lista lo trae del servidor', async () => {
  const { page } = session;
  const loaded = await responseOf(page, 'GET', /\/practitioners\/[^/]+\/sites$/, () =>
    irA(page, MY_PRACTICE),
  );
  expect(loaded.status()).toBe(200);

  await page.getByTestId('sede-agregar').click();
  await expect(page.getByTestId('sede-padron')).toBeVisible();
  await page.getByTestId('sede-cargar-propio').click();

  const dialog = page.getByRole('dialog', { name: 'Nuevo lugar de atención' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('sede-guardar')).toBeDisabled();
  await dialog.getByPlaceholder('Consultorio Dra. Pérez').fill(SITE_NAME);
  await dialog.getByLabel('Dirección', { exact: true }).fill(SITE_ADDRESS);
  await dialog.getByLabel('Ciudad', { exact: true }).fill(SITE_CITY);
  await expect(dialog.getByTestId('sede-guardar')).toBeEnabled();

  const [created] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.request().method() === 'POST' &&
        /\/practitioners\/me\/sites$/.test(new URL(res.url()).pathname),
    ),
    dialog.getByTestId('sede-guardar').click(),
  ]);
  expect(created.status(), await created.text()).toBe(201);
  const body = created.request().postDataJSON() as {
    name: string;
    address?: { lines: string[]; city?: string };
  };
  expect(body.name).toBe(SITE_NAME);
  expect(body.address?.lines).toEqual([SITE_ADDRESS]);
  expect(body.address?.city).toBe(SITE_CITY);
  siteId = ((await created.json()) as { id: string }).id;
  expect(siteId).toBeTruthy();

  await expect(page.getByText('Ya figura entre sus consultorios.')).toBeVisible();
  await expect(dialog).toBeHidden();
  await searchSite(page);
  await expect(siteRow(page)).toBeVisible();
  // La dirección se lista en mayúsculas (work-history.spec.ts).
  await expect(siteRow(page)).toContainText(SITE_ADDRESS.toUpperCase());
});

test('el consultorio sigue después de recargar y la API lo lista', async () => {
  const { page } = session;
  await reloadApp(page);
  await searchSite(page);
  await expect(siteRow(page)).toBeVisible();
  await expect(siteRow(page).getByTestId('sede-telefono')).toHaveText(/Sin teléfono registrado/);
  expect(await listedSiteNames(session)).toContain(SITE_NAME);
});

test('corrige el teléfono del consultorio y se ve tras recargar', async () => {
  const { page } = session;
  await siteRow(page).getByRole('button', { name: `Editar teléfono — ${SITE_NAME}` }).click();
  const phone = page.getByTestId('sede-telefono-editar');
  await expect(phone).toBeVisible();
  await phone.fill(SITE_PHONE);

  const saved = await responseOf(
    page,
    'PUT',
    new RegExp(`/practitioners/me/sites/${siteId}/contact-phone$`),
    () => page.getByRole('button', { name: 'Guardar teléfono' }).click(),
  );
  expect(saved.status(), await saved.text()).toBe(200);
  expect(saved.request().postDataJSON()).toEqual({ contactPhone: SITE_PHONE });

  await reloadApp(page);
  await searchSite(page);
  await expect(siteRow(page).getByTestId('sede-telefono')).toContainText(SITE_PHONE);
});

test('la ficha propia lo muestra en «Dónde atiendo»', async () => {
  const { page } = session;
  await irA(page, '/my-account');
  await page.getByRole('tab', { name: 'Dónde atiendo' }).click();
  await expect(page.getByTestId('perfil-consultorio')).toBeVisible();
  await searchSite(page);
  await expect(siteRow(page)).toBeVisible();
});

test('al cerrar el vínculo por API deja de figurar tras recargar (limpieza)', async () => {
  const { page } = session;
  const removed = await session.api.delete(`/practitioners/me/sites/${encodeURIComponent(siteId!)}`, {
    headers: session.authHeaders(),
  });
  expect([200, 204], await removed.text()).toContain(removed.status());
  siteId = null;

  await irA(page, MY_PRACTICE);
  await reloadApp(page);
  await expect(page.getByTestId('sedes-propias')).toBeVisible();
  await searchSite(page);
  await expect(siteRow(page)).toHaveCount(0);
  expect(await listedSiteNames(session)).not.toContain(SITE_NAME);
});
