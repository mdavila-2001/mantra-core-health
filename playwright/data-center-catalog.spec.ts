import { expect, test } from '@playwright/test';

import { administrador } from './support/actores';
import {
  actorsWithoutPortal,
  capture,
  expectDenied,
  openPortal,
  responseWith,
} from './support/portal-data-center';
import {
  REAL_API,
  REAL_API_SKIP_REASON,
  openRealSession,
  responseOf,
  type RealSession,
} from './support/real-session';

/**
 * Centro de datos · grupo «Catálogo y metadatos» del portal de inventario,
 * contra la API real: Tablas (lista y ficha) y Dominios y glosario. Los filtros
 * y la búsqueda viven en la URL. Médico y paciente no entran.
 *
 *   E2E_API_REAL=1 corepack yarn pw data-center-catalog --workers=1
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

test('Tablas: el filtro del ORM viaja a la API y la ficha abre sus pestañas', async () => {
  const { page } = session;
  const list = await responseOf(page, 'GET', /\/admin\/portal\/catalogo\/tablas$/, () =>
    openPortal(page, 'catalog/tables?orm=COINCIDE'),
  );
  expect(list.status()).toBe(200);
  expect(new URL(list.url()).searchParams.get('orm')).toBe('COINCIDE');
  await expect(page.getByTestId('portal-tables-table')).toContainText('Coincide');
  await capture(page, 'catalogo-tablas');

  const sheet = await responseOf(page, 'GET', /\/admin\/portal\/catalogo\/tablas\/[^/]+\/[^/]+$/, () =>
    page.getByTestId('portal-table-link').first().click(),
  );
  expect(sheet.status()).toBe(200);
  await expect(page.getByTestId('portal-table-detail')).toBeVisible();
  await expect(page.getByTestId('portal-item-catalogo/tablas')).toHaveAttribute('aria-current', 'page');
  await capture(page, 'catalogo-tabla-ficha');

  await page.getByRole('tab', { name: 'Columnas' }).click();
  await expect(page).toHaveURL(/vista=columnas/);
  await expect(page.getByTestId('portal-table-columns')).toBeVisible();
  await capture(page, 'catalogo-tabla-columnas');
});

test('Dominios y glosario: la búsqueda queda en la URL y un dominio lleva a sus tablas', async () => {
  const { page } = session;
  const glossary = await responseOf(page, 'GET', /\/admin\/portal\/glosario$/, () =>
    openPortal(page, 'catalog/domains'),
  );
  expect(glossary.status()).toBe(200);
  const search = await responseWith(page, /\/admin\/portal\/glosario$/, { q: 'PHI' }, () =>
    page.getByLabel('Buscar en el glosario').fill('PHI'),
  );
  expect(search.status()).toBe(200);
  await expect(page).toHaveURL(/q=PHI/);
  await expect(page.getByTestId('portal-glossary-table')).toBeVisible();
  await capture(page, 'catalogo-glosario');

  await page.getByRole('tab', { name: 'Dominios' }).click();
  await expect(page).toHaveURL(/vista=dominios/);
  const domain = page.getByTestId('portal-domain-link').first();
  await expect(domain).toBeVisible();
  await capture(page, 'catalogo-dominios');
  const tables = await responseOf(page, 'GET', /\/admin\/portal\/catalogo\/tablas$/, () => domain.click());
  expect(new URL(tables.url()).searchParams.get('q')).toBeTruthy();
  await expect(page.getByTestId('portal-tables-table')).toBeVisible();
});

test('médico y paciente no entran al catálogo, ni por la dirección ni por la API', async ({ browser }) => {
  for (const actor of await actorsWithoutPortal()) {
    await expectDenied(browser, actor, ['catalog/tables', 'catalog/domains'], '/admin/portal/catalogo/tablas');
  }
});
