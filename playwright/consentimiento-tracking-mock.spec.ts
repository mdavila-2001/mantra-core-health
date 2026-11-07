import { expect, test, type Page } from '@playwright/test';

import { esperarAplicacionLista } from './support/sesion';

/**
 * Tracking consent against the mock (`start:demo`): UI -> mock store -> reload
 * -> UI, for the three routes of the M28 controller that used to answer 501 in
 * the simulator. The mock answers inside the browser, so there is no network
 * request to watch: the 501 shows up as the panel's error alert, and the
 * persistence is read from the mock table in `sessionStorage`.
 *
 * The panel only exists when the capture is on, so this spec needs the build
 * to be started with:
 *   PUBLIC_UX_ANALYTICS_ENABLED=true
 *   PUBLIC_UX_ANALYTICS_EVENT_SCHEMA_ID=5c1d901c-94da-5c97-b115-e89e303c2c20
 * (the schema id is the public `ux_interaccion` v2 one, not a secret).
 */
const CUENTA = { usuario: 'paciente@alovida.mock', clave: 'alovida' };
const RUTA = '/my-account/privacy';
const TABLA = 'mock.telemetria.consentimientos';

test.describe.configure({ mode: 'serial' });

let page: Page;
const erroresDeConsola: string[] = [];

const estado = () => page.getByTestId('ux-consent-status');

/** The persisted consents of the mock table, as the simulator wrote them. */
const filasGuardadas = () =>
  page.evaluate((clave) => {
    const crudo = sessionStorage.getItem(clave);
    return crudo === null ? [] : (JSON.parse(crudo).filas as { id: string; withdrawnAt?: string }[]);
  }, TABLA);

async function abrirPrivacidad(): Promise<void> {
  await page.goto(RUTA);
  await esperarAplicacionLista(page);
  // The panel lives in the «Mis consentimientos» tab of «Mi privacidad».
  await page.getByRole('radio', { name: 'Mis consentimientos' }).click({ force: true });
  await expect(
    page.getByTestId('ux-consent-panel'),
    'The consent panel is missing: start the build with PUBLIC_UX_ANALYTICS_ENABLED=true and the schema id',
  ).toBeVisible({ timeout: 30_000 });
}

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (m) => m.type() === 'error' && erroresDeConsola.push(m.text()));
  page.on('pageerror', (e) => erroresDeConsola.push(`pageerror: ${e.message}`));
  await page.goto('/auth');
  await esperarAplicacionLista(page);
  await page.getByTestId('login-identifier').fill(CUENTA.usuario);
  await page.getByTestId('login-password').fill(CUENTA.clave);
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization|my-account)/, { timeout: 60_000 });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
});

test.afterAll(async () => {
  await page?.close();
});

test('1 · with no decision the panel offers to allow and shows no error', async () => {
  await abrirPrivacidad();
  await expect(estado()).toContainText('Sin decidir');
  await expect(page.getByTestId('ux-consent-otorgar')).toBeVisible();
  await expect(page.getByTestId('ux-consent-error')).toHaveCount(0);
  expect(await filasGuardadas()).toEqual([]);
});

test('2 · allowing changes the badge, persists the grant and survives a reload', async () => {
  await page.getByTestId('ux-consent-otorgar').click();
  await expect(estado()).toContainText('Permitido');
  await expect(page.getByTestId('ux-consent-retirar')).toBeVisible();
  await expect(page.getByTestId('ux-consent-error')).toHaveCount(0);

  const filas = await filasGuardadas();
  expect(filas).toHaveLength(1);
  expect(filas[0]!.withdrawnAt).toBeUndefined();

  await abrirPrivacidad();
  await expect(estado()).toContainText('Permitido');
});

test('3 · withdrawing keeps the record, shows Retirado and survives a reload', async () => {
  await page.getByTestId('ux-consent-retirar').click();
  await expect(estado()).toContainText('Retirado');
  await expect(page.getByTestId('ux-consent-otorgar')).toBeVisible();
  await expect(page.getByTestId('ux-consent-error')).toHaveCount(0);

  // Append-only: the grant is still there, now stamped with its withdrawal.
  const filas = await filasGuardadas();
  expect(filas).toHaveLength(1);
  expect(filas[0]!.withdrawnAt).toBeDefined();

  await abrirPrivacidad();
  await expect(estado()).toContainText('Retirado');
});

test('4 · no console errors during the whole flow', async () => {
  expect(erroresDeConsola, erroresDeConsola.join('\n')).toEqual([]);
});
