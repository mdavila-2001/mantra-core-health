import { expect, test, type Page, type Response } from '@playwright/test';

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
 * Carril 35 · centro de notificaciones: filtrar, paginar y marcar leída, contra la API real.
 *
 * Criterios derivados de `notification-center.ts` y su spec Vitest: la primera
 * página va sin cursor y con `limit=25`; «Sin leer» pide `unread=true` y suelta
 * el cursor; «Ver más notificaciones» sigue por cursor y agrega; abrir una fila
 * llama `POST /notifications/in-app/:id/read` y la fila deja de estar sin leer.
 *
 * ## Datos
 *
 * Ningún endpoint del front crea una notificación (las emiten los módulos del
 * backend), así que la spec trabaja con las que la médica ya tiene: si no hay
 * ninguna sin leer con destino, la prueba de «marcar leída» se salta con el
 * motivo. «Marcar todas como leídas» **no** se ejerce: consume de una vez el
 * estado sin leer de toda la cuenta sembrada, que otras suites usan, y no se
 * puede devolver.
 *
 *   E2E_API_REAL=1 corepack yarn pw carril-35-notification-center --workers=1
 */

test.describe.configure({ mode: 'serial' });
test.skip(!REAL_API, REAL_API_SKIP_REASON);

const CENTER = '/notification-center';
const LIST = /\/notifications\/me$/;

interface NotificationItem {
  readonly id: string;
  readonly subject: string;
  readonly unread: boolean;
}

interface NotificationPage {
  readonly items: readonly NotificationItem[];
  readonly nextCursor: string | null;
}

let session: RealSession;

/**
 * La lectura de la bandeja, no la de la campana: las dos piden
 * `/notifications/me`, pero sólo la bandeja va con `limit=25`.
 */
async function centerList(page: Page, action: () => Promise<unknown>): Promise<Response> {
  const [response] = await Promise.all([
    page.waitForResponse((res) => {
      const url = new URL(res.url());
      return (
        res.request().method() === 'GET' &&
        LIST.test(url.pathname) &&
        url.searchParams.get('limit') === '25'
      );
    }),
    action(),
  ]);
  return response;
}

test.beforeAll(async ({ browser }) => {
  session = await openRealSession(browser, doctora());
});

test.afterAll(async () => {
  await session?.close();
});

test('la bandeja carga la primera página de la API, sin cursor', async () => {
  const { page } = session;
  const first = await centerList(page, () => irA(page, CENTER));
  expect(first.status()).toBe(200);
  const params = new URL(first.url()).searchParams;
  expect(params.get('limit')).toBe('25');
  expect(params.has('cursor')).toBe(false);

  const { items } = (await first.json()) as NotificationPage;
  if (items.length === 0) {
    await expect(page.getByText('Todavía no tiene notificaciones')).toBeVisible();
  } else {
    await expect(page.getByTestId('aviso')).toHaveCount(items.length);
  }
});

test('«Sin leer» filtra por la API y sólo muestra filas sin leer', async () => {
  const { page } = session;
  const unread = await centerList(page, () =>
    page.getByRole('tab', { name: /^Sin leer/ }).click(),
  );
  expect(unread.status()).toBe(200);
  const params = new URL(unread.url()).searchParams;
  expect(params.get('unread')).toBe('true');
  expect(params.has('cursor')).toBe(false);

  const { items } = (await unread.json()) as NotificationPage;
  if (items.length === 0) {
    await expect(page.getByText('No tiene notificaciones sin leer')).toBeVisible();
  } else {
    await expect(page.locator('li.avisos__fila')).toHaveCount(items.length);
    await expect(page.locator('li.avisos__fila:not(.is-sin-leer)')).toHaveCount(0);
  }

  const all = await centerList(page, () =>
    page.getByRole('tab', { name: 'Todas', exact: true }).click(),
  );
  expect(new URL(all.url()).searchParams.has('unread')).toBe(false);
});

test('«Ver más notificaciones» sigue por cursor y agrega filas', async () => {
  const { page } = session;
  const first = await centerList(page, () => reloadApp(page));
  const { items, nextCursor } = (await first.json()) as NotificationPage;
  test.skip(nextCursor === null, 'Omitido: la médica tiene una sola página de notificaciones.');

  const more = await centerList(page, () =>
    page.getByRole('button', { name: 'Ver más notificaciones' }).click(),
  );
  expect(more.status()).toBe(200);
  expect(new URL(more.url()).searchParams.get('cursor')).toBe(nextCursor);
  const next = (await more.json()) as NotificationPage;
  await expect(page.getByTestId('aviso')).toHaveCount(items.length + next.items.length);
});

test('abrir una notificación sin leer la marca leída y así sigue al recargar', async () => {
  const { page } = session;
  await irA(page, CENTER);
  const unreadRow = page.locator('li.avisos__fila.is-sin-leer').filter({
    has: page.locator('button[data-testid="aviso"]'),
  });
  await expect(page.locator('li.avisos__fila').first().or(page.getByText('Todavía no tiene notificaciones'))).toBeVisible();
  test.skip(
    (await unreadRow.count()) === 0,
    'Omitido: la médica no tiene notificaciones sin leer con destino; ningún endpoint del front las crea.',
  );

  const row = unreadRow.first();
  const subject = ((await row.locator('.avisos__titulo').textContent()) ?? '').trim();
  const marked = await responseOf(page, 'POST', /\/notifications\/in-app\/[^/]+\/read$/, () =>
    row.getByTestId('aviso').click(),
  );
  expect([200, 201], await marked.text()).toContain(marked.status());
  const notificationId = new URL(marked.url()).pathname.split('/').at(-2) ?? '';
  expect(((await marked.json()) as { id: string }).id).toBe(notificationId);

  // Persistencia: la API la devuelve leída...
  const check = await session.api.get('/notifications/me', {
    headers: session.authHeaders(),
    params: { limit: '100' },
  });
  expect(check.status()).toBe(200);
  const stored = ((await check.json()) as NotificationPage).items.find(
    (item) => item.id === notificationId,
  );
  expect(stored?.unread, 'la notificación abierta tiene que quedar leída').toBe(false);

  // ...y la bandeja, recargada, ya no la pinta como nueva.
  await irA(page, CENTER);
  await reloadApp(page);
  const sameRow = page.locator('li.avisos__fila').filter({ hasText: subject }).first();
  await expect(sameRow).toBeVisible();
  await expect(sameRow).not.toHaveClass(/is-sin-leer/);
});
