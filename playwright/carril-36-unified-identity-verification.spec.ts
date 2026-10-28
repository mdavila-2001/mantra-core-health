import { expect, test, type APIRequestContext } from '@playwright/test';

import {
  CLAVE,
  apiViva,
  contextoDeApi,
  firstDepartmentConceptId,
  type Actor,
} from './support/actores';
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
 * Carril 36 · verificaciones unificadas («Verificar» + «Mis trámites»), contra la API real.
 *
 * Criterios derivados de `identity-hub.ts`, `identity-verification.ts`,
 * `verification-cases.ts` y sus specs Vitest: las dos pestañas viven en
 * `/my-account/identity` (`?tab=cases` abre «Mis trámites»); el envío sube las
 * cinco evidencias como PHI (`POST /common/files/upload` ×5) y abre el caso del
 * profesional (`POST /identity/me/practitioner/identity-verification`) con
 * esos ids; el caso nuevo aparece en el historial y en «Mis trámites» después
 * de recargar; un caso sin veredicto abre el diálogo «Todavía no hay un
 * veredicto».
 *
 * ## Por qué un médico sintético y no la cuenta sembrada
 *
 * Cada envío crea cinco archivos PHI y un caso de verificación **que no se
 * puede borrar ni cancelar** (ni el front ni la API documentada lo ofrecen), y
 * podría mover el estado de verificación de la cuenta. Hacerlo con la médica
 * sembrada ensuciaría a una persona real. Se da de alta un profesional nuevo
 * por corrida (correo `@example.test`, sufijo único) y se entra con él: un
 * solo login en el archivo. El caso queda en la base con ese usuario de prueba.
 *
 * La prueba de vida usa la cámara: Chromium arranca con dispositivo falso y el
 * permiso concedido.
 *
 *   E2E_API_REAL=1 corepack yarn pw carril-36-unified-identity-verification --workers=1
 */

test.describe.configure({ mode: 'serial' });
test.skip(!REAL_API, REAL_API_SKIP_REASON);
test.use({
  launchOptions: {
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  },
  permissions: ['camera'],
});

const IDENTITY = '/my-account/identity';
/** PNG de 1×1: el selector acepta `image/*` hasta 10 MB. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

let session: RealSession;
let caseId: string;

/** Un profesional recién registrado, sin login por API: el único ingreso es el de la pantalla. */
async function registerSyntheticPractitioner(api: APIRequestContext): Promise<Actor> {
  const suffix = uniqueSuffix();
  const email = `c36-verificacion-${suffix.toLowerCase()}@example.test`;
  const response = await api.post('/iam/auth/register-practitioner', {
    data: {
      email,
      password: CLAVE,
      name: 'Marcelo',
      lastName: 'Ávila',
      licenseNumber: `LIC-C36-${suffix}`,
      sedesLicenseNumber: `SEDES-C36-${suffix}`,
      nationalId: `CI-C36-${suffix}`,
      issuerAdministrativeAreaConceptId: await firstDepartmentConceptId(api),
    },
  });
  expect(response.ok(), `POST /iam/auth/register-practitioner: ${await response.text()}`).toBe(
    true,
  );
  return { rol: 'doctora', identificador: email, clave: CLAVE, nombre: 'Marcelo Ávila (sintético)' };
}

test.beforeAll(async ({ browser }) => {
  const api = await contextoDeApi();
  try {
    test.skip(!(await apiViva(api)), 'Omitido: la API no responde. No es un verde.');
    const practitioner = await registerSyntheticPractitioner(api);
    session = await openRealSession(browser, practitioner);
    await session.page.context().grantPermissions(['camera']);
  } finally {
    await api.dispose();
  }
});

test.afterAll(async () => {
  await session?.close();
});

test('las dos pestañas viven en una sola dirección y «Mis trámites» se refleja en la URL', async () => {
  const { page } = session;
  await irA(page, IDENTITY);
  await expect(page.getByTestId('identidad-pestanas')).toBeVisible();

  const cases = page.getByRole('tab', { name: 'Mis trámites' });
  const listed = await responseOf(page, 'GET', /\/identity\/me\/verification-cases$/, () =>
    cases.click(),
  );
  expect(listed.status()).toBe(200);
  await expect(cases).toHaveAttribute('aria-selected', 'true');
  await expect(page).toHaveURL(/[?&]tab=cases/);
  // Un profesional recién dado de alta todavía no tiene trámites.
  await expect(
    page.getByText('Cuando inicie una verificación de identidad, sus trámites van a aparecer acá.'),
  ).toBeVisible();

  await page.getByRole('tab', { name: 'Verificar' }).click();
  await expect(page).not.toHaveURL(/[?&]tab=cases/);
});

test('envía las cinco evidencias y abre un caso de verificación del profesional', async () => {
  const { page } = session;
  const send = page.getByRole('button', { name: 'Enviar cinco evidencias para revisión' });
  await expect(send).toBeDisabled();

  await page.getByRole('radio', { name: 'Mi identidad como profesional' }).check();
  await page
    .getByLabel('Frente del documento')
    .setInputFiles({ name: 'frente-e2e.png', mimeType: 'image/png', buffer: PNG });
  await page
    .getByLabel('Reverso del documento')
    .setInputFiles({ name: 'reverso-e2e.png', mimeType: 'image/png', buffer: PNG });

  await page.getByRole('button', { name: 'Iniciar prueba de vida' }).click();
  // `capturarPose()` no hace nada mientras el video no tenga cuadros: se
  // espera al primero del dispositivo falso antes de capturar.
  await expect
    .poll(() =>
      page
        .getByLabel('Vista previa de la cámara frontal')
        .evaluate((video) => (video as HTMLVideoElement).videoWidth),
    )
    .toBeGreaterThan(0);
  for (const step of [1, 2, 3]) {
    await page.getByRole('button', { name: `Capturar ${step} de 3` }).click();
    if (step < 3) {
      await expect(page.getByRole('button', { name: `Capturar ${step + 1} de 3` })).toBeVisible();
    }
  }
  await expect(page.getByText('Las tres capturas están listas.')).toBeVisible();
  await expect(send).toBeEnabled();

  const uploads: { status: number; id: string }[] = [];
  const trackUpload = async (res: import('@playwright/test').Response): Promise<void> => {
    if (res.request().method() === 'POST' && new URL(res.url()).pathname.endsWith('/common/files/upload')) {
      uploads.push({ status: res.status(), id: ((await res.json()) as { id: string }).id });
    }
  };
  page.on('response', trackUpload);
  const opened = await responseOf(
    page,
    'POST',
    /\/identity\/me\/practitioner\/identity-verification$/,
    () => send.click(),
  );
  page.off('response', trackUpload);

  expect([200, 201], await opened.text()).toContain(opened.status());
  expect(uploads.map((upload) => upload.status)).toEqual([201, 201, 201, 201, 201]);
  // El caso se abre con los cinco archivos recién subidos, y con nada más.
  const body = opened.request().postDataJSON() as Record<string, string>;
  expect(Object.values(body).sort()).toEqual(uploads.map((upload) => upload.id).sort());
  caseId = ((await opened.json()) as { caseId: string }).caseId;
  expect(caseId).toBeTruthy();

  await expect(page.getByText('Su solicitud quedó registrada')).toBeVisible();
  await expect(page.getByText(caseId)).toBeVisible();

  const refreshed = await responseOf(
    page,
    'GET',
    new RegExp(`/identity/me/verification-cases/${caseId}$`),
    () => page.getByRole('button', { name: 'Actualizar estado' }).click(),
  );
  expect(refreshed.status()).toBe(200);
});

test('después de recargar, el caso está en «Mis trámites» y explica que no hay veredicto', async () => {
  const { page } = session;
  await irA(page, `${IDENTITY}?tab=cases`);
  await reloadApp(page);
  await expect(page.getByRole('tab', { name: 'Mis trámites' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

  const pending = page.getByTestId(`case-pending-${caseId}`);
  const withVerdict = page.locator(`a[href$="/my-account/identity/cases/${caseId}"]`);
  await expect(pending.or(withVerdict)).toBeVisible();

  if (await pending.isVisible()) {
    await pending.click();
    const dialog = page.getByRole('dialog', { name: 'Todavía no hay un veredicto' });
    await expect(dialog).toContainText(caseId);
    await dialog.getByRole('button', { name: 'Entendido' }).click();
    await expect(dialog).toBeHidden();
  }

  // El historial de «Verificar» también lo lista: se relee después de abrirlo.
  await page.getByRole('tab', { name: 'Verificar' }).click();
  await expect(page.getByRole('heading', { name: 'Sus trámites anteriores' })).toBeVisible();
});
