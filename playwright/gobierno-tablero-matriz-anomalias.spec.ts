import { expect, test, type Page } from '@playwright/test';

/**
 * **Tablero de gobierno, matriz de accesos y anomalías** contra el backend simulado (bloque B6b del gobierno de accesos).
 * Un solo escenario, con el administrador de la organización piloto. Se levanta con `ng serve --configuration development,demo`
 * (o un build de demo servido) y se apunta con `E2E_BASE_URL`.
 *
 * 1. El **tablero** muestra los diez mosaicos y «lo que necesita su atención hoy»; el mosaico de anomalías lleva a su lista.
 * 2. En **anomalías** abre la de Marcos: ve el gráfico con su descripción en texto; **descartar sin comentario** no sale; con
 *    comentario, sale la petición, la lista se recarga sin ella y el tablero, al volver, cuenta una menos.
 * 3. En la **matriz** pregunta «¿por qué?» por la cancelación de citas de Marcos y lee la explicación; **exporta** la matriz
 *    con motivo y segundo paso (código de prueba) y el archivo se descarga con su huella.
 */

let page: Page;

test.beforeAll(async ({ browser }) => {
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await contexto.newPage();
});

test.afterAll(async () => {
  await page.context().close();
});

async function entrar(correo: string): Promise<void> {
  await page.goto('/auth');
  await page.getByTestId('login-identifier').fill(correo);
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

/** Va a una pantalla por el router, sin recargar: el simulador conserva su memoria. */
async function irA(ruta: string, esperaTestId: string): Promise<void> {
  await page.evaluate((destino) => {
    window.history.pushState({}, '', destino);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, ruta);
  await expect(page.getByTestId(esperaTestId)).toBeVisible({ timeout: 30_000 });
}

async function peticiones(): Promise<
  { method: string; url: string; status: number; body: unknown }[]
> {
  return page.evaluate(
    () => (window as unknown as { __mockRequests?: never[] }).__mockRequests ?? [],
  );
}

test('el administrador recorre el tablero, resuelve una anomalía, pregunta «¿por qué?» en la matriz y exporta con segundo paso', async () => {
  await entrar('hospital_piloto@alovida.mock');

  /* 1 · tablero */
  await irA('/administration/access-governance', 'governance-tiles');
  await expect(page.locator('[data-testid="governance-tiles"] li')).toHaveCount(10);
  await expect(page.getByTestId('governance-attention')).toContainText(
    'Lo que necesita su atención hoy',
  );
  await expect(page.getByTestId('governance-tile-status-openAnomalies')).toContainText(
    'Requiere atención',
  );
  const abiertas = Number(
    await page.getByTestId('governance-tile-value-openAnomalies').innerText(),
  );
  expect(abiertas).toBeGreaterThanOrEqual(2);
  await page.getByTestId('governance-tile-openAnomalies').click();
  await expect(page).toHaveURL(/\/administration\/access-governance\/anomalies$/);

  /* 2 · anomalías: abrir, descartar sin comentario, descartar con comentario */
  await expect(page.getByTestId('anomalies-table')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Ver el detalle de Marcos Ribera/ }).click();
  // Con la forma de evidencia de la API real (sin serie ni texto) la pantalla arma el texto y tres barras: observado, habitual y umbral.
  await expect(page.getByTestId('anomaly-description')).toContainText(
    'Muchas búsquedas de pacientes: se observó 18, lo habitual es 4 y el umbral de la organización es 15.',
  );
  await expect(page.locator('[data-testid="anomaly-bar"]')).toHaveCount(3);
  await expect(page.getByTestId('anomaly-baseline')).toContainText('Línea base');

  await page.getByTestId('anomaly-dismiss').click();
  await expect(page.locator('.form-field-error')).toContainText('al menos 10 caracteres');
  expect(
    (await peticiones()).some((p) => p.method === 'POST' && p.url.includes('/anomalies/')),
  ).toBe(false);

  await page
    .getByTestId('anomaly-comment')
    .locator('textarea')
    .fill('Fue la campaña de recordatorios de la mañana.');
  await page.getByTestId('anomaly-dismiss').click();
  await expect(page.getByTestId('anomaly-detail-status')).toContainText('Descartada');
  const ack = (await peticiones()).find(
    (p) => p.method === 'POST' && p.url.includes('/anomalies/') && p.url.endsWith('/ack'),
  );
  expect(ack).toMatchObject({
    status: 200,
    body: { status: 'DISMISSED', comment: 'Fue la campaña de recordatorios de la mañana.' },
  });
  await expect(page.getByRole('button', { name: /Ver el detalle de Marcos Ribera/ })).toHaveCount(
    0,
  );

  await irA('/administration/access-governance', 'governance-tiles');
  await expect(page.getByTestId('governance-tile-value-openAnomalies')).toHaveText(
    String(abiertas - 1),
  );

  /* 3 · matriz: «¿por qué?» y exportación */
  await irA('/administration/access-governance/matrix', 'matrix-grid');
  await page
    .getByRole('row', { name: /Marcos Ribera/ })
    .getByRole('button', { name: /Agenda/ })
    .click();
  await expect(page.getByTestId('matrix-detail')).toContainText('Marcos Ribera');
  await page.getByTestId('matrix-explain-atom').locator('.select-trigger').click();
  await page.getByRole('option', { name: 'Cancelar citas' }).click();
  await page.getByTestId('matrix-explain-run').click();
  await expect(page.getByTestId('matrix-explain-result')).toContainText('Hace falta un paso más');
  expect(
    (await peticiones()).some(
      (p) => p.method === 'POST' && p.url.endsWith('/org/access/explain') && p.status === 200,
    ),
  ).toBe(true);

  await page.getByTestId('matrix-export-open').click();
  await page
    .getByTestId('matrix-export-reason')
    .locator('textarea')
    .fill('Revisión trimestral de auditoría interna');
  await page.getByTestId('matrix-export-submit').click();
  await expect(page.getByTestId('desafio-codigo')).toBeVisible({ timeout: 15_000 });
  await page.getByTestId('desafio-codigo').fill('123456');
  const descarga = page.waitForEvent('download');
  await page.getByTestId('desafio-verificar').click();
  expect((await descarga).suggestedFilename()).toMatch(
    /^matriz-de-accesos-\d{4}-\d{2}-\d{2}\.csv$/,
  );
  await expect(page.getByTestId('matrix-export-done')).toContainText('SHA-256');
  const exportaciones = (await peticiones()).filter((p) =>
    p.url.endsWith('/reports/access-matrix/export'),
  );
  expect(exportaciones.map((p) => p.status)).toEqual([403, 200]);
});
