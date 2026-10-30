import { expect, test } from '@playwright/test';

import { doctora } from './support/actores';
import { irA } from './support/sesion';
import {
  REAL_API,
  REAL_API_SKIP_REASON,
  openRealSession,
  reloadApp,
  responseOf,
  type RealSession,
} from './support/real-session';

/**
 * Carril 33 · mis organizaciones («Mis vinculaciones»), contra la API real.
 *
 * Criterios derivados de `medical-organization.ts`, `my-organizations.ts` y sus
 * specs Vitest: `/my-organizations` redirige al panel de la organización;
 * `?tab=memberships` abre «Mis vinculaciones» y recién ahí pide `/practices` y
 * `/practitioners/me/role-assignments`; «Pedir vinculación» manda
 * `POST /practices/:id/role-assignments/self-request` y la solicitud vuelve,
 * tras recargar, como «Pendiente de aprobación».
 *
 * ## Lo que esta spec deja en la base
 *
 * La solicitud de vinculación **no tiene endpoint para retirarla** (ni el
 * front ni la API documentada lo ofrecen). Se pide a una organización con la
 * que la médica todavía no tiene vínculo; si ya tiene vínculo con todas, la
 * prueba se salta con el motivo. La solicitud queda pendiente en la base de
 * desarrollo: anotado en el PR.
 *
 *   E2E_API_REAL=1 corepack yarn pw carril-33-my-organizations --workers=1
 */

test.describe.configure({ mode: 'serial' });
test.skip(!REAL_API, REAL_API_SKIP_REASON);

const MEMBERSHIPS = '/administration/medical-organization?tab=memberships';

interface Practice {
  readonly id: string;
  readonly name: string;
}

let session: RealSession;

test.beforeAll(async ({ browser }) => {
  session = await openRealSession(browser, doctora());
});

test.afterAll(async () => {
  await session?.close();
});

function asItems<T>(body: unknown): T[] {
  if (Array.isArray(body)) return body as T[];
  return ((body as { items?: T[] }).items ?? []) as T[];
}

test('«Mis organizaciones» redirige al panel de la organización', async () => {
  const { page } = session;
  await irA(page, '/my-organizations');
  await expect(page).toHaveURL(/\/administration\/medical-organization/);
  await expect(page.getByTestId('no-encontrado')).toHaveCount(0);
});

test('la pestaña «Mis vinculaciones» lista lo que devuelve la API', async () => {
  const { page } = session;
  const assignments = await responseOf(page, 'GET', /\/practitioners\/me\/role-assignments$/, () =>
    irA(page, MEMBERSHIPS),
  );
  expect(assignments.status()).toBe(200);
  await expect(page.getByRole('tab', { name: 'Mis vinculaciones' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  const items = asItems<{ practiceName: string }>(await assignments.json());
  if (items.length === 0) {
    await expect(page.getByText('Todavía no tiene vinculaciones')).toBeVisible();
  } else {
    const table = page.getByTestId('mis-vinculaciones');
    for (const item of items) {
      await expect(table.getByRole('row').filter({ hasText: item.practiceName }).first()).toBeVisible();
    }
  }
});

test('pide una vinculación nueva y queda pendiente después de recargar', async () => {
  const { page } = session;
  const [practicesResponse, assignmentsResponse] = await Promise.all([
    session.api.get('/practices', { headers: session.authHeaders() }),
    session.api.get('/practitioners/me/role-assignments', { headers: session.authHeaders() }),
  ]);
  expect(practicesResponse.status(), 'GET /practices').toBe(200);
  expect(assignmentsResponse.status(), 'GET /practitioners/me/role-assignments').toBe(200);
  const linked = new Set(
    asItems<{ practiceId: string }>(await assignmentsResponse.json()).map((item) => item.practiceId),
  );
  const target = asItems<Practice>(await practicesResponse.json()).find(
    (practice) => !linked.has(practice.id),
  );
  test.skip(
    target === undefined,
    'Omitido: la médica ya tiene vínculo con todas las organizaciones de la API; no hay a cuál pedir.',
  );

  const request = page.getByRole('button', { name: 'Pedir vinculación' });
  await expect(request).toBeDisabled();
  await page.getByRole('combobox').filter({ hasText: 'Elija una organización' }).click();
  await page.getByRole('option', { name: target!.name, exact: true }).click();
  await expect(request).toBeEnabled();

  const sent = await responseOf(
    page,
    'POST',
    new RegExp(`/practices/${target!.id}/role-assignments/self-request$`),
    () => request.click(),
  );
  expect([200, 201], await sent.text()).toContain(sent.status());
  await expect(
    page.getByText('Solicitud enviada. Queda pendiente hasta que la organización la apruebe.'),
  ).toBeVisible();

  await reloadApp(page);
  const row = page
    .getByTestId('mis-vinculaciones')
    .getByRole('row')
    .filter({ hasText: target!.name })
    .first();
  await expect(row).toBeVisible();
  await expect(row).toContainText('Pendiente de aprobación');
});
