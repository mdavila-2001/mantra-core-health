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
 * Carril 15 · correcciones adicionales sobre agenda y avisos, contra la API real.
 *
 * El repositorio no tiene ficha de este carril (el «carril 15» viejo del
 * historial es el muro profesional). Se cubren las dos superficies que el
 * encargo nombra:
 *
 * 1. **Avisos** (`/settings`, pestaña «Avisos»,
 *    `notification-preferences.ts`): cambiar una categoría manda
 *    `PUT /notifications/preferences/me` con esa categoría cambiada, confirma con
 *    «Guardamos sus preferencias.» y el cambio sobrevive a la recarga. Se
 *    elige «Actividad social» —no toca nada clínico— y se devuelve a su valor.
 * 2. **Avisar demora** (`/schedule`, `agenda.ts`): el panel se abre con sus
 *    valores por defecto y «Volver» lo cierra **sin** mandar nada.
 *
 * Lo que **no** se envía: el aviso de demora real
 * (`POST /scheduling/resources/:id/delay`). Notifica a los pacientes reales de
 * la agenda sembrada y no se puede deshacer; queda anotado en el PR.
 *
 *   E2E_API_REAL=1 corepack yarn pw carril-15-agenda-notification-settings --workers=1
 */

test.describe.configure({ mode: 'serial' });
test.skip(!REAL_API, REAL_API_SKIP_REASON);

const PREFERENCES = /\/notifications\/preferences\/me$/;
const CATEGORY = 'SOCIAL';
const CATEGORY_LABEL = 'Actividad social';

interface Preferences {
  readonly categories: readonly { category: string; optedIn: boolean }[];
  readonly quietHours: unknown;
}

let session: RealSession;
let originalOptedIn: boolean;

async function readOptedIn(s: RealSession): Promise<boolean> {
  const response = await s.api.get('/notifications/preferences/me', { headers: s.authHeaders() });
  expect(response.status(), 'GET /notifications/preferences/me').toBe(200);
  const { categories } = (await response.json()) as Preferences;
  const row = categories.find((item) => item.category === CATEGORY);
  expect(row, `la API no devuelve la categoría ${CATEGORY}`).toBeDefined();
  return row!.optedIn;
}

test.beforeAll(async ({ browser }) => {
  session = await openRealSession(browser, doctora());
  originalOptedIn = await readOptedIn(session);
});

test.afterAll(async () => {
  if (session === undefined) return;
  if ((await readOptedIn(session)) !== originalOptedIn) {
    const restore = await session.api.put('/notifications/preferences/me', {
      headers: session.authHeaders(),
      data: { categories: [{ category: CATEGORY, optedIn: originalOptedIn }] },
    });
    expect(restore.ok(), `restaurar la preferencia: ${await restore.text()}`).toBe(true);
  }
  await session.close();
});

async function openNotificationSettings(s: RealSession): Promise<void> {
  const loaded = await responseOf(s.page, 'GET', PREFERENCES, () => irA(s.page, '/settings'));
  expect(loaded.status()).toBe(200);
  await s.page.getByRole('tab', { name: 'Avisos' }).click();
  await expect(s.page.getByRole('heading', { name: 'Avisos', level: 2 })).toBeVisible();
}

async function saveCategory(s: RealSession, optedIn: boolean): Promise<void> {
  const { page } = s;
  const toggle = page.getByRole('switch', { name: CATEGORY_LABEL });
  await expect(toggle).toBeChecked({ checked: !optedIn });
  await page.getByTestId(`pref-${CATEGORY}`).locator('label').click();
  await expect(toggle).toBeChecked({ checked: optedIn });

  const saved = await responseOf(page, 'PUT', PREFERENCES, () =>
    page.getByTestId('pref-save').click(),
  );
  expect(saved.status(), await saved.text()).toBe(200);
  const body = saved.request().postDataJSON() as Preferences;
  expect(body.categories).toContainEqual({ category: CATEGORY, optedIn });
  await expect(page.getByText('Guardamos sus preferencias.')).toBeVisible();
}

test('cambia el aviso de actividad social, lo guarda y sigue así al recargar', async () => {
  await openNotificationSettings(session);
  await saveCategory(session, !originalOptedIn);

  expect(await readOptedIn(session)).toBe(!originalOptedIn);
  const [reloaded] = await Promise.all([
    session.page.waitForResponse(
      (res) => res.request().method() === 'GET' && PREFERENCES.test(new URL(res.url()).pathname),
    ),
    reloadApp(session.page),
  ]);
  expect(reloaded.status()).toBe(200);
  await session.page.getByRole('tab', { name: 'Avisos' }).click();
  await expect(session.page.getByRole('switch', { name: CATEGORY_LABEL })).toBeChecked({
    checked: !originalOptedIn,
  });
});

test('devuelve el aviso a su valor original por la pantalla', async () => {
  await saveCategory(session, originalOptedIn);
  expect(await readOptedIn(session)).toBe(originalOptedIn);
});

test('«Avisar demora» abre el panel y «Volver» lo cierra sin avisar a nadie', async () => {
  const { page } = session;
  await irA(page, '/schedule');

  const delayRequests: string[] = [];
  const track = (req: { method(): string; url(): string }): void => {
    if (req.method() === 'POST' && /\/delay$/.test(new URL(req.url()).pathname)) {
      delayRequests.push(req.url());
    }
  };
  page.on('request', track);

  // La de la agenda entera: en el encabezado de la página o en el del día.
  await page.getByTestId('agenda-avisar-demora').or(page.getByTestId('dia-avisar-demora')).first().click();
  const panel = page.getByTestId('agenda-demora-panel');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: 'Avisar demora de la agenda' })).toBeVisible();
  await expect(panel.getByText('Cuánto se demora')).toBeVisible();
  await expect(panel.getByLabel('Mensaje para el paciente')).toBeVisible();
  await expect(panel.getByTestId('agenda-demora-confirmar')).toBeEnabled();

  await panel.getByRole('button', { name: 'Volver' }).click();
  await expect(panel).toBeHidden();
  page.off('request', track);
  expect(delayRequests, 'cerrar el panel no puede avisar a ningún paciente').toEqual([]);
});
