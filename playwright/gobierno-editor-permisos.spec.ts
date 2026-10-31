import { expect, test, type Page } from '@playwright/test';

/**
 * **Editor de permisos con condiciones y vista previa** contra el **backend simulado** (CONTRATO-GOBIERNO §9.4).
 *
 * Un solo recorrido, como lo haría la administración de seguridad del Hospital Piloto con los permisos de Ana Gutiérrez:
 *
 * 1. El editor abre en «Básico» (los paquetes de siempre). «Avanzado» muestra el aviso de nombres antiguos («se normalizarán»).
 * 2. Un horario armado con frases (sin JSON) pide la vista previa **antes** de guardar: sin vista previa, «Guardar» está apagado.
 * 3. Una franja que empieza y termina a la misma hora la rechaza el servidor: el error aparece junto al campo y «Guardar» sigue apagado.
 * 4. Corregida la franja, la vista previa dice qué cambia y «Guardar» manda **el mismo permiso que se simuló**, con su huella.
 * 5. Se recarga lo guardado: el permiso ya trae su condición, dicha en una oración.
 *
 * Se levanta con `yarn start:demo` (o el build demo servido) y se apunta con `E2E_BASE_URL`. El simulador contesta dentro del
 * navegador: lo que se mandó y lo que se contestó se lee de `window.__mockRequests`.
 */

test.describe.configure({ mode: 'serial' });

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await (await browser.newContext()).newPage();
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

interface Peticion {
  readonly method: string;
  readonly url: string;
  readonly status: number;
  readonly body: unknown;
  readonly response?: unknown;
}

async function peticiones(): Promise<Peticion[]> {
  return page.evaluate(
    () => (window as unknown as { __mockRequests?: Peticion[] }).__mockRequests ?? [],
  );
}

const apagado = async (id: string): Promise<boolean> =>
  (await page.getByTestId(id).getAttribute('aria-disabled')) === 'true';

test('editor de permisos: Básico por omisión, condiciones con frases, vista previa obligatoria y guardado con la misma huella', async () => {
  await entrar('hospital_piloto');
  await irA('/administration/support-team');
  const fila = page.locator('[data-testid^="equipo-nombre-"]', { hasText: 'Ana Gutiérrez' });
  await expect(fila).toBeVisible();
  const id = (await fila.getAttribute('data-testid'))!.replace('equipo-nombre-', '');
  await page.getByTestId(`equipo-permisos-${id}`).click();
  await expect(page.getByTestId('editor-permisos')).toBeVisible();

  // 1 · «Básico» por omisión; «Avanzado» avisa que los nombres antiguos se normalizarán.
  await expect(page.getByTestId('segmentado-basic')).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByTestId('advanced-panel')).toHaveCount(0);
  await page.getByTestId('segmentado-advanced').click();
  await expect(page.getByTestId('advanced-panel')).toBeVisible();
  await expect(page.getByTestId('legacy-notice')).toContainText('se normalizarán');
  await expect(page.getByTestId('atom-category-SUPPORT_AGENDA')).toBeVisible();

  // 2 · Sin cambios no hay nada que guardar; con un horario hay que esperar la vista previa.
  expect(await apagado('editor-guardar')).toBe(true);
  await page.getByTestId('cond-toggle-when').click();
  await page.getByTestId('cond-time-add').click();
  await expect(page.getByTestId('cond-toggle-when')).toContainText('1 condición');
  await expect(page.getByTestId('preview-valid')).toBeVisible();
  await expect(page.getByTestId('preview-summary')).not.toBeEmpty();
  await expect(page.getByTestId('editor-guardar')).toBeEnabled();
  expect(await page.locator('body').innerText()).not.toContain('schemaVersion');

  // 3 · El servidor rechaza una franja vacía y el error queda junto al campo.
  await page.getByTestId('cond-time-to-0').fill('08:00');
  await expect(page.getByTestId('cond-issues-when')).toContainText('misma hora');
  await expect(page.getByTestId('cond-section-when')).toHaveAttribute('data-invalid', 'true');
  await expect(page.getByTestId('preview-errors')).toBeVisible();
  expect(await apagado('editor-guardar')).toBe(true);

  // 4 · Corregida, se guarda lo mismo que se simuló, con su huella.
  await page.getByTestId('cond-time-to-0').fill('18:30');
  await expect(page.getByTestId('preview-valid')).toBeVisible();
  await expect(page.getByTestId('editor-guardar')).toBeEnabled();
  await page.getByTestId('editor-guardar').click();
  await expect(page.getByTestId('editor-guardar')).toBeDisabled();

  const todas = await peticiones();
  const simulaciones = todas.filter(
    (p) => p.method === 'POST' && p.url.includes('/org/access/simulate') && p.status === 200,
  );
  const guardados = todas.filter(
    (p) =>
      p.url.includes('/grants') && (p.method === 'PATCH' || p.method === 'POST') && p.status < 300,
  );
  expect(simulaciones.length).toBeGreaterThan(0);
  expect(guardados).toHaveLength(1);
  const cuerpo = guardados[0]!.body as {
    simulationToken?: string;
    condition?: { time?: { windows: { from: string; to: string }[] } };
  };
  const ultima = simulaciones.at(-1)!;
  expect(cuerpo.simulationToken).toBe(
    (ultima.response as { simulationToken?: string }).simulationToken,
  );
  expect(cuerpo.condition?.time?.windows[0]).toMatchObject({ from: '08:00', to: '18:30' });
  const simulado = (ultima.body as { draft: { grants: { condition?: unknown }[] } }).draft
    .grants[0]!;
  expect(simulado.condition).toEqual(cuerpo.condition);

  // 5 · Se recargó lo guardado: el permiso ya trae su condición.
  await expect(page.getByTestId('advanced-general-issue')).toHaveCount(0);
  await expect(page.getByTestId('conditions-count')).toContainText('1');
});
