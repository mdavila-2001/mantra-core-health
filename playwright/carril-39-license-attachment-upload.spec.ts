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
 * Carril 39 · matrículas y adjuntos en «Configurar su perfil», contra la API real.
 *
 * El reporte del carril 39 dejó dicho
 * que el archivo era local a la maqueta y que **no** se declaraba subida ni
 * persistencia. Esta spec mide justamente eso: la matrícula con respaldo sube
 * el archivo (`POST /common/files/upload`), nace con su `fileId`
 * (`POST /profiles/practitioners/:id/jurisdiction-authorizations`), sobrevive a
 * la recarga, se descarga con los mismos bytes y se retira
 * (`DELETE /profiles/practitioners/me/jurisdiction-authorizations/:id`).
 *
 * Datos propios: el número lleva un sufijo único. Si la prueba cae antes de
 * retirarla, `afterAll` la borra por API. El archivo subido no tiene endpoint
 * de borrado: queda huérfano en el almacén (anotado en el PR).
 *
 *   E2E_API_REAL=1 corepack yarn pw carril-39-license-attachment-upload --workers=1
 */

test.describe.configure({ mode: 'serial' });
test.skip(!REAL_API, REAL_API_SKIP_REASON);

const LICENSE_NUMBER = `MP-E2E-${uniqueSuffix()}`;
const FILE_NAME = 'matricula-e2e.png';
/** PNG de 1×1, válido: el selector sólo acepta PDF, JPG o PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

let session: RealSession;
let licenseId: string | null = null;
let fileId: string | null = null;

test.beforeAll(async ({ browser }) => {
  session = await openRealSession(browser, doctora());
});

test.afterAll(async () => {
  if (session === undefined) return;
  if (licenseId !== null) {
    const cleanup = await session.api.delete(
      `/profiles/practitioners/me/jurisdiction-authorizations/${encodeURIComponent(licenseId)}`,
      { headers: session.authHeaders() },
    );
    expect([200, 204, 404], `limpieza de la matrícula: ${await cleanup.text()}`).toContain(
      cleanup.status(),
    );
  }
  await session.close();
});

async function openCredentials(page: Page): Promise<void> {
  await page.getByRole('tab', { name: 'Credenciales', exact: true }).click();
  await expect(page.getByTestId('edicion-matriculas-cargadas')).toBeVisible();
}

function licenseRow(page: Page) {
  return page.getByTestId('tabla-matriculas').getByRole('row').filter({ hasText: LICENSE_NUMBER });
}

/** Las tres acciones de una fila pendiente con archivo van en un menú. */
async function rowAction(page: Page, action: 'Descargar' | 'Retirar'): Promise<void> {
  await page.getByRole('button', { name: `Acciones de ${LICENSE_NUMBER}` }).click();
  await page.getByRole('menuitem', { name: action }).click();
}

test('agrega una matrícula con respaldo: sube el archivo y la guarda con su fileId', async () => {
  const { page } = session;
  await irA(page, '/my-account/edit');
  await openCredentials(page);

  await page.getByTestId('matricula-agregar').click();
  const dialog = page.getByTestId('alta-matricula-dialogo');
  await expect(dialog.getByRole('heading', { name: 'Agregar matrícula' })).toBeVisible();

  await dialog.getByLabel('Nº de matrícula').fill(LICENSE_NUMBER);
  await dialog
    .getByTestId('matricula-archivo')
    .setInputFiles({ name: FILE_NAME, mimeType: 'image/png', buffer: PNG });
  await expect(dialog.getByText(FILE_NAME)).toBeVisible();

  await dialog.getByRole('button', { name: 'Agregar matrícula' }).click();

  const uploadPromise = page.waitForResponse(
    (res) =>
      res.request().method() === 'POST' &&
      new URL(res.url()).pathname.endsWith('/common/files/upload'),
  );
  const created = await responseOf(page, 'POST', /\/jurisdiction-authorizations$/, () =>
    page.getByRole('button', { name: 'Confirmar' }).click(),
  );
  const upload = await uploadPromise;

  expect(upload.status(), await upload.text()).toBe(201);
  fileId = ((await upload.json()) as { id: string }).id;
  expect(fileId).toBeTruthy();

  expect(created.status(), await created.text()).toBe(201);
  const body = created.request().postDataJSON() as { licenseNumber: string; fileId?: string };
  expect(body.licenseNumber).toBe(LICENSE_NUMBER);
  expect(body.fileId, 'la matrícula tiene que nacer con el respaldo recién subido').toBe(fileId);
  licenseId = ((await created.json()) as { id: string }).id;

  await expect(
    page.getByText('Se agregó la matrícula. Queda pendiente de verificación.'),
  ).toBeVisible();
  await expect(licenseRow(page)).toBeVisible();
});

test('después de recargar la matrícula sigue y su respaldo baja con los mismos bytes', async () => {
  const { page } = session;
  await reloadApp(page);
  await openCredentials(page);
  await expect(licenseRow(page)).toBeVisible();

  const download = page.waitForEvent('download');
  const content = await responseOf(
    page,
    'GET',
    new RegExp(`/common/files/${fileId}/content$`),
    () => rowAction(page, 'Descargar'),
  );
  expect(content.status()).toBe(200);
  const file = await download;
  const stream = await file.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  expect(Buffer.concat(chunks).equals(PNG), 'el respaldo descargado conserva sus bytes').toBe(true);
});

test('retira la matrícula de prueba y ya no vuelve al recargar', async () => {
  const { page } = session;
  await openCredentials(page);
  await rowAction(page, 'Retirar');
  await expect(page.getByText(`¿Retirar «${LICENSE_NUMBER}»?`)).toBeVisible();

  const removed = await responseOf(
    page,
    'DELETE',
    new RegExp(`/jurisdiction-authorizations/${licenseId}$`),
    () => page.getByRole('button', { name: 'Retirar', exact: true }).click(),
  );
  expect([200, 204]).toContain(removed.status());
  licenseId = null;
  await expect(page.getByText(`Se retiró «${LICENSE_NUMBER}».`)).toBeVisible();

  await reloadApp(page);
  await openCredentials(page);
  await expect(licenseRow(page)).toHaveCount(0);
});
