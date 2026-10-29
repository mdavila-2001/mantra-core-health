import { expect, test } from '@playwright/test';

import { administrador } from './support/actores';
import { actorsWithoutPortal, capture, expectDenied, openPortal } from './support/portal-data-center';
import {
  REAL_API,
  REAL_API_SKIP_REASON,
  openRealSession,
  responseOf,
  type RealSession,
} from './support/real-session';

/**
 * Centro de datos · grupos «Linaje» y «Esquema de datos» del portal de
 * inventario, contra la API real. El linaje de una tabla y el detalle de un
 * schema se abren en un cajón con su clave en la URL (`?tabla=`, `?schema=`),
 * así que también se llega por enlace. Médico y paciente no entran.
 *
 *   E2E_API_REAL=1 corepack yarn pw data-center-lineage-schema --workers=1
 */

test.describe.configure({ mode: 'serial' });
test.skip(!REAL_API, REAL_API_SKIP_REASON);

let session: RealSession;

test.beforeAll(async ({ browser }) => {
  session = await openRealSession(browser, administrador());
});

test.afterAll(async () => {
  await session?.close();
});

test('Linaje: busca una tabla y abre su linaje en el cajón', async () => {
  const { page } = session;
  const metrics = await responseOf(page, 'GET', /\/admin\/portal\/linaje$/, () => openPortal(page, 'lineage?q=slots'));
  expect(metrics.status()).toBe(200);
  await expect(page.getByTestId('portal-lineage-metrics')).toBeVisible();
  await expect(page.getByTestId('portal-lineage-tables')).toContainText('slots');
  await capture(page, 'lineage');

  const lineage = await responseOf(page, 'GET', /\/admin\/portal\/linaje\/tablas\/[^/]+\/[^/]+$/, () =>
    page.getByTestId('portal-lineage-link').first().click(),
  );
  expect(lineage.status()).toBe(200);
  await expect(page).toHaveURL(/tabla=/);
  await expect(page.getByTestId('portal-table-lineage')).toBeVisible();
  await capture(page, 'linaje-tabla');
  await page.getByTestId('cajon-cerrar').click();
  await expect(page).not.toHaveURL(/tabla=/);
});

test('Esquema: versión del modelo, deriva por schema y un schema en su cajón', async () => {
  const { page } = session;
  const schemas = await responseOf(page, 'GET', /\/admin\/catalog\/schemas$/, () => openPortal(page, 'schemas'));
  expect(schemas.status()).toBe(200);
  const list = (await schemas.json()) as { schemaName: string }[];
  await expect(page.getByTestId('portal-schemas-coverage')).toContainText('Cálculo de cobertura');
  await capture(page, 'schemas');
  test.skip(list.length === 0, 'El catálogo vivo no tiene schemas: falta un escaneo de la base. El vacío quedó capturado.');

  const objects = await responseOf(page, 'GET', /\/admin\/catalog\/objects$/, () =>
    page.getByTestId('portal-schema-link').first().click(),
  );
  expect(new URL(objects.url()).searchParams.get('schema')).toBe(list[0]!.schemaName);
  await expect(page.getByTestId('portal-schema-detail')).toBeVisible();
  await capture(page, 'esquema-schema');
});

test('médico y paciente no entran a Linaje ni a Esquema, ni por la dirección ni por la API', async ({ browser }) => {
  for (const actor of await actorsWithoutPortal()) {
    await expectDenied(browser, actor, ['lineage', 'schemas'], '/admin/portal/linaje');
  }
});
