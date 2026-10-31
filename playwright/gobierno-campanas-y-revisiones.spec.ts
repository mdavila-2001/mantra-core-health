import { expect, test, type Page } from '@playwright/test';

/**
 * **Campañas de certificación y «Mis revisiones»** contra el **backend simulado** (CONTRATO-GOBIERNO §6.2 y §9.3).
 *
 * Un solo recorrido, como lo haría la administración de seguridad del Hospital Piloto, de punta a punta y en serie:
 *
 * 1. La lista de campañas muestra la de ejemplo, abierta y con su avance.
 * 2. El asistente de cuatro pasos arma «Certificación Q1-2027»: la vista previa dice cuántos accesos entran y quién los
 *    revisa **antes** de crear nada; «Crear y lanzar» crea, lanza y lleva al seguimiento.
 * 3. En «Mis revisiones» la decisión en lote es todo o nada: si entre lo elegido hay algo de riesgo alto la API rechaza
 *    (`REVIEW_BULK_NOT_ALLOWED`), la pantalla señala cuál lo impide y no cambia nada; con solo lo de bajo riesgo se mantiene.
 * 4. El acceso de riesgo alto se decide de a uno: mantenerlo exige comentario; con él queda «Mantenido» y sigue así tras
 *    recargar la pantalla.
 * 5. Se cierra la campaña: lo que nadie decidió se quita solo y el seguimiento lo cuenta; se exporta con su huella.
 *
 * Se levanta con `yarn start:demo` (o el build demo servido) y se apunta con `E2E_BASE_URL`. El simulador contesta dentro del
 * navegador: lo que se mandó y lo que se contestó se lee de `window.__mockRequests`.
 */

test.describe.configure({ mode: 'serial' });

let page: Page;
let idDeLaCampana = '';

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext({ acceptDownloads: true })).newPage();
});

test.afterAll(async () => {
  await page.context().close();
});

async function entrar(clave: string): Promise<void> {
  await page.goto('/auth');
  await page.evaluate(() => {
    try {
      localStorage.clear();
    } catch {
      /* sin almacenamiento no hay sesión que borrar */
    }
  });
  await page.goto('/auth');
  await page.getByTestId('login-identifier').fill(`${clave}@alovida.mock`);
  await page.getByTestId('login-password').fill('cualquiera');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(
    (url) => !url.pathname.startsWith('/auth') || url.pathname.startsWith('/auth/organization'),
    { timeout: 30_000 },
  );
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 30_000 });
  }
  await expect(page.getByTestId('header-cuenta')).toBeVisible({ timeout: 30_000 });
}

/** Navega por el router (sin recargar: la sesión del simulador vive en memoria). */
async function irA(ruta: string): Promise<void> {
  await page.evaluate((destino) => {
    window.history.pushState({}, '', destino);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, ruta);
  await expect(page).toHaveURL(new RegExp(`${ruta.replace(/[/.?=]/g, '\\$&')}$`));
}

async function peticiones(): Promise<
  { method: string; url: string; status: number; body: unknown }[]
> {
  return page.evaluate(
    () => (window as unknown as { __mockRequests?: never[] }).__mockRequests ?? [],
  );
}

/** El diálogo de confirmación del sistema de diseño: se confirma con su botón principal. */
async function confirmarDialogo(): Promise<void> {
  const dialogo = page.locator('dialog[open]').last();
  await expect(dialogo).toBeVisible();
  await dialogo
    .getByRole('button', { name: /^(Mantener|Cerrar la campaña|Lanzar|Confirmar)$/ })
    .click();
}

test('1 · la lista de campañas muestra la de ejemplo, abierta y con su avance', async () => {
  await entrar('hospital_piloto');
  await irA('/administration/access-governance/campaigns');
  await expect(page.getByTestId('pantalla-campaign-list')).toBeVisible();
  const q4 = page.locator('[data-testid^="campana-nombre-"]', { hasText: 'Certificación Q4-2026' });
  await expect(q4).toBeVisible();
  await expect(page.locator('[data-testid^="campana-estado-"]').first()).toHaveText('Abierta');
  await expect(page.locator('[data-testid^="campana-avance-"]').first()).toContainText('%');
  await expect(page.locator('[data-testid^="campana-vence-"]').first()).toContainText(
    'Venció hace',
  );
});

test('2 · el asistente muestra la vista previa antes de crear y «Crear y lanzar» lleva al seguimiento', async () => {
  await page.getByTestId('campanas-nueva').click();
  await expect(page).toHaveURL(/\/campaigns\/new$/);
  await expect(page.getByTestId('asistente-paso')).toContainText('Paso 1 de 4');

  // Sin nombre no se avanza: el error está junto al campo.
  await page.getByTestId('asistente-siguiente').click();
  await expect(page.getByTestId('campana-error-name')).toBeVisible();

  await page.getByTestId('campana-nombre').fill('Certificación Q1-2027');
  await page.getByTestId('asistente-siguiente').click();
  await expect(page.getByTestId('asistente-paso')).toContainText('Paso 2 de 4');
  await expect(page.getByTestId('vista-previa-total')).toContainText(/\d+ accesos? por revisar/);
  await expect(page.getByTestId('vista-previa-revisores')).toContainText(
    'Administración de seguridad',
  );
  // Nada se creó todavía.
  const antes = await peticiones();
  expect(
    antes.some((p) => p.method === 'POST' && p.url.endsWith('/org/access-reviews/campaigns')),
  ).toBe(false);
  expect(
    antes.some((p) => p.url.endsWith('/org/access-reviews/campaigns/preview') && p.status === 200),
  ).toBe(true);

  await page.getByTestId('asistente-siguiente').click();
  await expect(page.getByTestId('asistente-paso')).toContainText('Paso 3 de 4');
  await page.getByTestId('asistente-siguiente').click();
  await expect(page.getByTestId('asistente-paso')).toContainText('Paso 4 de 4');
  await expect(page.getByTestId('resumen-nombre')).toHaveText('Certificación Q1-2027');
  await expect(page.getByTestId('resumen-no-certificado')).toContainText('se quita');

  await page.getByTestId('campana-crear-lanzar').click();
  await expect(page).toHaveURL(/\/administration\/access-governance\/campaigns\/(?!new)[^/]+$/);
  idDeLaCampana = page.url().split('/').pop() ?? '';
  await expect(page.getByTestId('campana-nombre')).toHaveText('Certificación Q1-2027');
  await expect(page.getByTestId('campana-estado')).toHaveText('Abierta');

  const despues = await peticiones();
  const posts = despues
    .filter((p) => p.method === 'POST')
    .map((p) => p.url.replace(/[0-9a-f-]{36}/, ':id'));
  expect(posts).toEqual(
    expect.arrayContaining([
      '/org/access-reviews/campaigns',
      '/org/access-reviews/campaigns/:id/launch',
    ]),
  );
});

test('3 · en «Mis revisiones» el lote es todo o nada: la API rechaza lo de riesgo alto, la pantalla dice cuál y no cambia nada', async () => {
  await irA('/my-reviews');
  await expect(page.getByTestId('pantalla-my-reviews')).toBeVisible();
  const tarjetas = page.locator('[data-testid^="revision-tarjeta-"]');
  await expect(tarjetas.first()).toBeVisible();
  const pendientesAntes = await tarjetas.count();

  await page.getByTestId('revisiones-bajo-riesgo').click();
  // Se suma a mano el de riesgo alto (Sofía).
  const riesgoAlto = page
    .locator('[data-testid^="revision-tarjeta-"]', {
      has: page.locator('[data-testid^="revision-riesgo-"]', { hasText: 'Riesgo alto' }),
    })
    .first();
  await riesgoAlto.locator('label.checkbox-container').click();
  await expect(riesgoAlto.getByRole('checkbox')).toBeChecked();
  await page.getByTestId('revisiones-mantener-lote').click();
  await confirmarDialogo();

  await expect(page.getByTestId('revisiones-lote-error')).toContainText(
    'Solo se pueden mantener en bloque los accesos de bajo riesgo',
  );
  await expect(page.getByTestId('revisiones-lote-error')).toContainText('No se mantuvo ninguno');
  await expect(page.locator('[data-testid^="revisiones-lote-impide-"]')).toHaveCount(1);
  await expect(page.locator('[data-testid^="revision-impide-"]')).toHaveCount(1);
  const rechazo = (await peticiones())
    .filter((p) => p.url.endsWith('/me/access-reviews/items/bulk-decision'))
    .pop();
  expect(rechazo?.status).toBe(422);
  await expect(tarjetas).toHaveCount(pendientesAntes);

  // Sin el de riesgo alto, el lote se mantiene.
  await riesgoAlto.locator('label.checkbox-container').click();
  await expect(riesgoAlto.getByRole('checkbox')).not.toBeChecked();
  await page.getByTestId('revisiones-mantener-lote').click();
  await confirmarDialogo();
  await expect(page.getByTestId('revisiones-resultado')).toContainText(
    /Se mantuvieron? \d+ accesos?/,
  );
  const ok = (await peticiones())
    .filter((p) => p.url.endsWith('/me/access-reviews/items/bulk-decision'))
    .pop();
  expect(ok?.status).toBe(200);
  const mantenidos = (ok?.body as { itemIds: string[] }).itemIds.length;
  expect(mantenidos).toBeGreaterThan(0);
  // Lo mantenido salió de lo pendiente; lo demás (lo de riesgo alto) sigue ahí, para decidirse de a uno.
  await expect(tarjetas).toHaveCount(pendientesAntes - mantenidos);
});

test('4 · el acceso de riesgo alto se decide de a uno: sin comentario no sale, con comentario queda «Mantenido» y persiste al recargar', async () => {
  await page.locator('[data-testid^="revision-abrir-"]').first().click();
  await expect(page.getByTestId('revision-detalle')).toBeVisible();
  await expect(page.getByTestId('evidencia-resumen')).not.toBeEmpty();
  await expect(page.getByTestId('evidencia-uso')).toBeVisible();
  await expect(page.getByTestId('decision-aviso-comentario')).toContainText('obligatorio');

  await page.getByTestId('decision-mantener').click();
  await page.getByTestId('decision-enviar').click();
  await expect(page.getByTestId('decision-comentario-error')).toContainText(
    'Escriba al menos 10 caracteres',
  );
  const sinPedido = (await peticiones()).filter(
    (p) => p.method === 'POST' && p.url.includes('/decision'),
  );
  expect(sinPedido).toHaveLength(0);

  await page
    .getByTestId('decision-comentario')
    .locator('textarea')
    .fill('Administra al equipo de Ecografía y lo usa a diario.');
  await page.getByTestId('decision-enviar').click();
  await expect(page.getByTestId('revision-estado-detalle')).toHaveText('Mantenido');
  await expect(page.getByTestId('decision-resultado')).toContainText('Mantuvo este acceso');
  const pedido = (await peticiones())
    .filter((p) => p.method === 'POST' && p.url.includes('/decision'))
    .pop();
  expect(pedido?.status).toBe(200);
  expect(pedido?.body).toMatchObject({
    decision: 'CERTIFY',
    comment: 'Administra al equipo de Ecografía y lo usa a diario.',
  });

  // Recargar la pantalla: lo que se ve es lo que guardó la API.
  await page.reload();
  await expect(page.getByTestId('revision-estado-detalle')).toHaveText('Mantenido', {
    timeout: 30_000,
  });
  await expect(page.getByTestId('decision-hecha')).toContainText(
    'Administra al equipo de Ecografía y lo usa a diario.',
  );
});

test('5 · cerrar la campaña quita lo que nadie decidió y el seguimiento lo cuenta; se exporta con su huella', async () => {
  await irA(`/administration/access-governance/campaigns/${idDeLaCampana}`);
  await expect(page.getByTestId('campana-nombre')).toHaveText('Certificación Q1-2027', {
    timeout: 30_000,
  });
  await page.getByTestId('campana-cerrar').click();
  await confirmarDialogo();
  await expect(page.getByTestId('campana-estado')).toHaveText('Cerrada');
  await expect(page.getByTestId('campana-resultado')).toContainText(
    /Se quit(ó 1 acceso|aron \d+ accesos)/,
  );
  await expect(page.getByTestId('campana-cerrar')).toHaveCount(0);

  const descarga = page.waitForEvent('download');
  await page.getByTestId('campana-exportar-csv').click();
  expect((await descarga).suggestedFilename()).toMatch(
    /^certificacion-q1-2027-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  await expect(page.getByTestId('campana-exportado')).toContainText('Huella SHA-256');
});
