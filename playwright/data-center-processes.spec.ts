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
 * Centro de datos · grupo «Procesos» del portal de inventario, contra la API
 * real: la lista filtrada por la URL, la ficha de un proceso con sus pestañas
 * y los saltos al diagrama y a sus operaciones. Médico y paciente no entran.
 *
 *   E2E_API_REAL=1 corepack yarn pw data-center-processes --workers=1
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

test('Procesos: el tipo de la URL viaja a la API y cada fila lleva a su ficha', async () => {
  const { page } = session;
  const list = await responseWith(page, /\/admin\/portal\/flujos$/, { tipo: 'MODULO' }, () =>
    openPortal(page, 'processes?tipo=MODULO'),
  );
  expect(list.status()).toBe(200);
  const body = (await list.json()) as { items: { tipo: string }[] };
  expect(body.items.length).toBeGreaterThan(0);
  expect(body.items.every((p) => p.tipo === 'MODULO')).toBe(true);
  await expect(page.getByTestId('portal-processes-table')).toContainText('Módulo');
  await capture(page, 'procesos-lista');

  const detail = await responseOf(page, 'GET', /\/admin\/portal\/flujos\/[^/]+$/, () =>
    page.getByTestId('portal-process-link').first().click(),
  );
  expect(detail.status()).toBe(200);
  await expect(page.getByTestId('portal-process-detail')).toBeVisible();
  await expect(page.getByTestId('portal-item-processes')).toHaveAttribute('aria-current', 'page');
  await capture(page, 'procesos-ficha');

  await page.getByRole('tab', { name: 'Etapas' }).click();
  await expect(page).toHaveURL(/vista=etapas/);
  await expect(page.getByTestId('portal-process-stages')).toBeVisible();
  await capture(page, 'procesos-etapas');
});

test('la ficha salta a sus operaciones ya filtradas por el proceso', async () => {
  const { page } = session;
  const ops = await responseOf(page, 'GET', /\/admin\/portal\/operaciones$/, () =>
    page.getByRole('link', { name: 'Ver sus operaciones' }).click(),
  );
  expect(ops.status()).toBe(200);
  expect(new URL(ops.url()).searchParams.get('flujo')).toBeTruthy();
  await expect(page).toHaveURL(/systems\/operations\?flujo=/);
  await expect(page.getByTestId('portal-operations-table')).toBeVisible();
});

test('médico y paciente no entran a Procesos, ni por la dirección ni por la API', async ({ browser }) => {
  for (const actor of await actorsWithoutPortal()) {
    await expectDenied(browser, actor, ['processes'], '/admin/portal/flujos');
  }
});
