import { expect, test, type Request } from '@playwright/test';

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
 * Centro de datos · grupo «Sistemas» del portal de inventario, contra la API real:
 * Operaciones (lista y ficha), Mapa de rutas, Diagrama, Deriva y Revisión.
 *
 * Cada prueba entra por la dirección con sus filtros en la URL —que es lo que
 * promete la pantalla— y comprueba que el filtro viaja a la API, que la
 * respuesta llega y que la pantalla la dibuja. Médico y paciente no entran: ni
 * por la dirección ni llamando a la API con su token.
 *
 * La Revisión no decide ninguna ficha: aprobar o rechazar exige que decida
 * otra persona que la autora (`SELF_REVIEW`) y una ficha preparada para eso.
 * Acá se prueba lo que la pantalla anticipa sin escribir: aprobar sin evidencia
 * no se ofrece y el rechazo no se envía sin motivo.
 *
 *   E2E_API_REAL=1 corepack yarn pw data-center-systems --workers=1
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

test('Operaciones: el filtro de la URL viaja a la API y la ficha abre su árbol', async () => {
  const { page } = session;
  const list = await responseOf(page, 'GET', /\/admin\/portal\/operaciones$/, () =>
    openPortal(page, 'systems/operations?riesgo=ALTO'),
  );
  expect(list.status()).toBe(200);
  expect(new URL(list.url()).searchParams.get('riesgo')).toBe('ALTO');
  const body = (await list.json()) as { items: { riesgo: string }[] };
  expect(body.items.length).toBeGreaterThan(0);
  expect(body.items.every((o) => o.riesgo === 'ALTO')).toBe(true);
  await expect(page.getByTestId('portal-operations-table')).toContainText('Riesgo alto');
  await capture(page, 'sistemas-operaciones');

  const detail = await responseOf(page, 'GET', /\/admin\/portal\/operaciones\/[^/]+$/, () =>
    page.getByTestId('portal-operation-link').first().click(),
  );
  expect(detail.status()).toBe(200);
  await expect(page.getByTestId('portal-operation-detail')).toBeVisible();
  await page.getByRole('tab', { name: 'Árbol de decisión' }).click();
  await expect(page).toHaveURL(/vista=arbol/);
  await expect(
    page.getByTestId('portal-decision-tree').or(page.getByText('El inventario no trae un árbol de decisión')),
  ).toBeVisible();
  await capture(page, 'sistemas-operacion-ficha');
});

test('Mapa de rutas: filtra por señal y salta al diagrama del proceso', async () => {
  const { page } = session;
  const map = await responseOf(page, 'GET', /\/admin\/portal\/flujos\/mapa$/, () =>
    openPortal(page, 'systems/flows?senal=SIN_PRUEBAS'),
  );
  expect(map.status()).toBe(200);
  expect(new URL(map.url()).searchParams.get('senal')).toBe('SIN_PRUEBAS');
  const table = page.getByTestId('portal-route-map-table');
  await expect(table).toContainText('Sin pruebas');
  await capture(page, 'sistemas-mapa');

  const graph = await responseOf(page, 'GET', /\/admin\/portal\/flujos\/[^/]+\/grafo$/, () =>
    table.locator('a[href*="diagrama?flujo="]').first().click(),
  );
  expect(graph.status()).toBe(200);
  await expect(page).toHaveURL(/systems\/flows\/diagram\?flujo=/);
  await expect(page.getByTestId('portal-process-graph')).toBeVisible();
  await expect(page.getByTestId('portal-item-sistemas/flujos/diagrama')).toHaveAttribute('aria-current', 'page');
  await capture(page, 'sistemas-diagrama');
});

test('Deriva: un hallazgo abre sus casos en el cajón y la vista del modelo cuenta la deriva', async () => {
  const { page } = session;
  const findings = await responseOf(page, 'GET', /\/admin\/portal\/flujos\/hallazgos$/, () =>
    openPortal(page, 'systems/drift'),
  );
  expect(findings.status()).toBe(200);
  const detail = await responseOf(page, 'GET', /\/admin\/portal\/flujos\/hallazgos\/[^/]+$/, () =>
    page.getByTestId('portal-finding-link').first().click(),
  );
  expect(detail.status()).toBe(200);
  await expect(page).toHaveURL(/hallazgo=/);
  await expect(page.getByTestId('portal-finding-detail')).toBeVisible();
  await capture(page, 'sistemas-deriva-hallazgo');
  await page.getByTestId('cajon-cerrar').click();
  await expect(page).not.toHaveURL(/hallazgo=/);

  await page.getByRole('tab', { name: 'Modelo contra ORM' }).click();
  await expect(page.getByTestId('portal-model-drift')).toContainText('Entidades del ORM sin tabla en el modelo');
  await capture(page, 'sistemas-deriva-modelo');
});

test('Revisión: lista sólo lo que espera decisión y no ofrece puertas que la API cerraría', async () => {
  const { page } = session;
  const queue = await responseOf(page, 'GET', /\/admin\/catalog\/objects$/, () =>
    openPortal(page, 'systems/review'),
  );
  expect(queue.status()).toBe(200);
  expect(new URL(queue.url()).searchParams.get('reviewStatus')).toBe('NEEDS_REVIEW');
  const items = ((await queue.json()) as { items: { id: string }[] }).items;
  await capture(page, 'sistemas-revision');
  test.skip(items.length === 0, 'No hay fichas en revisión en esta base: la cola vacía quedó capturada.');

  const object = await responseOf(page, 'GET', /\/admin\/catalog\/objects\/[^/]+$/, () =>
    page.getByTestId('portal-review-link').first().click(),
  );
  const { evidenceCount } = (await object.json()) as { evidenceCount: number };
  await expect(page.getByTestId('portal-review-detail')).toBeVisible();
  await expect(page.getByTestId('portal-review-approve')).toHaveAttribute(
    'aria-disabled',
    evidenceCount === 0 ? 'true' : 'false',
  );

  // El rechazo no se envía con un motivo corto: el diálogo lo frena antes de la API.
  let decisions = 0;
  const countDecisions = (req: Request): void => {
    if (/\/admin\/catalog\/annotations\/[^/]+\/review$/.test(new URL(req.url()).pathname)) decisions += 1;
  };
  page.on('request', countDecisions);
  await page.getByTestId('portal-review-reject').click();
  const dialog = page.getByTestId('dialogo');
  await expect(dialog).toContainText('Rechazar la ficha');
  await dialog.getByTestId('dialogo-motivo').locator('textarea').fill('corto');
  await dialog.getByTestId('dialogo-confirmar').click();
  await expect(dialog).toBeVisible();
  await capture(page, 'sistemas-revision-rechazo');
  await dialog.getByTestId('dialogo-cancelar').click();
  page.off('request', countDecisions);
  expect(decisions, 'ninguna decisión viajó a la API').toBe(0);
});

test('médico y paciente no entran a Sistemas, ni por la dirección ni por la API', async ({ browser }) => {
  for (const actor of await actorsWithoutPortal()) {
    await expectDenied(
      browser,
      actor,
      ['systems/operations', 'systems/flows', 'systems/drift', 'systems/review'],
      '/admin/portal/operaciones',
    );
  }
});
