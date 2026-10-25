import { expect, test } from '@playwright/test';

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
 * Carril 38 · editar el perfil médico: guardar y recargar, contra la API real.
 *
 * Criterios derivados de `practitioner-profile-edit.ts` y su spec Vitest: el
 * guardado manda sólo lo que cambió (`PATCH /profiles/practitioners/me`), avisa
 * «Su perfil quedó actualizado.», y lo guardado vuelve tal cual al recargar el
 * editor y en la ficha propia (`/my-account`, «Presentación»).
 *
 * El campo elegido es la **biografía**: es texto libre, no lo valida ningún
 * catálogo y se puede devolver a su valor original sin rastro. La prueba lo
 * restaura por la pantalla y, si algo falla a mitad de camino, `afterAll` lo
 * restaura por API.
 *
 *   E2E_API_REAL=1 corepack yarn pw carril-38-edit-practitioner-profile --workers=1
 */

test.describe.configure({ mode: 'serial' });
test.skip(!REAL_API, REAL_API_SKIP_REASON);

const EDITOR = '/my-account/edit';
const OWN_PROFILE_PATH = /\/profiles\/practitioners\/me$/;

let session: RealSession;
let originalBio: string | null = null;
const testBio = `Biografía de prueba E2E ${uniqueSuffix()}: atención en medicina general.`;

async function readOwnBio(s: RealSession): Promise<string> {
  const summary = await s.api.get('/profiles/practitioners/me/summary', {
    headers: s.authHeaders(),
  });
  expect(summary.status(), 'GET /profiles/practitioners/me/summary').toBe(200);
  return ((await summary.json()) as { professionalBio?: string | null }).professionalBio ?? '';
}

test.beforeAll(async ({ browser }) => {
  session = await openRealSession(browser, doctora());
  originalBio = await readOwnBio(session);
});

test.afterAll(async () => {
  if (session === undefined) return;
  // Red de seguridad: si la prueba cayó antes de restaurar, se deja el perfil como estaba.
  if (originalBio !== null && (await readOwnBio(session)) !== originalBio) {
    const restore = await session.api.patch('/profiles/practitioners/me', {
      headers: session.authHeaders(),
      data: { professionalBio: originalBio },
    });
    expect(restore.ok(), `restaurar la biografía: ${await restore.text()}`).toBe(true);
  }
  await session.close();
});

test('guarda la biografía y la muestra igual después de recargar', async () => {
  const { page } = session;
  await irA(page, EDITOR);
  await page.getByRole('tab', { name: 'Datos personales', exact: true }).click();

  const bio = page.getByLabel('Biografía');
  await expect(bio).toBeVisible();
  await expect(bio).toHaveValue(originalBio ?? '');
  await bio.fill(testBio);

  const response = await responseOf(page, 'PATCH', OWN_PROFILE_PATH, () =>
    page.getByRole('button', { name: 'Guardar cambios' }).click(),
  );
  expect(response.status(), await response.text()).toBe(200);
  // Sólo se manda lo que cambió. La única clave extra legítima es
  // `acceptsNewPatients: true`, que el editor agrega si el perfil la tenía en
  // `false` (`guardarPresentacion`).
  const sent = response.request().postDataJSON() as Record<string, unknown>;
  expect(sent['professionalBio']).toBe(testBio);
  expect(Object.keys(sent).filter((key) => key !== 'acceptsNewPatients')).toEqual([
    'professionalBio',
  ]);
  expect(((await response.json()) as { professionalBio?: string }).professionalBio).toBe(testBio);
  await expect(page.getByText('Su perfil quedó actualizado.')).toBeVisible();

  // Persistencia: la API la devuelve y el editor la vuelve a cargar tras recargar.
  expect(await readOwnBio(session)).toBe(testBio);
  await reloadApp(page);
  await page.getByRole('tab', { name: 'Datos personales', exact: true }).click();
  await expect(page.getByLabel('Biografía')).toHaveValue(testBio);
});

test('la ficha propia muestra la presentación guardada', async () => {
  const { page } = session;
  await irA(page, '/my-account');
  await page.getByRole('tab', { name: 'Datos personales', exact: true }).click();
  await expect(page.getByText(testBio)).toBeVisible();
});

test('devuelve la biografía a su valor original por la pantalla', async () => {
  const { page } = session;
  await irA(page, EDITOR);
  await page.getByRole('tab', { name: 'Datos personales', exact: true }).click();

  const bio = page.getByLabel('Biografía');
  await expect(bio).toHaveValue(testBio);
  await bio.fill(originalBio ?? '');

  const response = await responseOf(page, 'PATCH', OWN_PROFILE_PATH, () =>
    page.getByRole('button', { name: 'Guardar cambios' }).click(),
  );
  expect(response.status(), await response.text()).toBe(200);
  expect(response.request().postDataJSON()).toEqual({ professionalBio: originalBio ?? '' });

  await reloadApp(page);
  await page.getByRole('tab', { name: 'Datos personales', exact: true }).click();
  await expect(page.getByLabel('Biografía')).toHaveValue(originalBio ?? '');
  expect(await readOwnBio(session)).toBe(originalBio ?? '');
});

test('sin cambios no manda nada y lo dice', async () => {
  const { page } = session;
  await irA(page, EDITOR);
  await page.getByRole('tab', { name: 'Datos personales', exact: true }).click();
  await expect(page.getByLabel('Biografía')).toHaveValue(originalBio ?? '');

  const writes: string[] = [];
  const track = (req: { method(): string; url(): string }): void => {
    if (req.method() === 'PATCH' && OWN_PROFILE_PATH.test(new URL(req.url()).pathname)) {
      writes.push(req.url());
    }
  };
  page.on('request', track);
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('No había ningún cambio para guardar.')).toBeVisible();
  page.off('request', track);
  expect(writes).toEqual([]);
});
