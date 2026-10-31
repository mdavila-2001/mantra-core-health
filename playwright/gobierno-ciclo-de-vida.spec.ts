import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * **Ciclo de vida del equipo y administración delegada** contra el **backend simulado** (CONTRATO-GOBIERNO §6.1, §6.4, §9.3, §9.5).
 *
 * Un solo recorrido, con dos personas del Hospital Piloto:
 *
 * 1. La administración de seguridad ve los casos abiertos (el ingreso de Nora) y **las cuentas sin dueño**; le asigna dueño a Nora
 *    y la lista deja de traerla (petición `PUT …/owner` → recarga → pantalla).
 * 2. Da de baja a Pablo con traspaso en tres pasos: lo que tiene en las manos, a quién se lo pasa, confirmar. El acceso termina
 *    **ahora** (primero se revoca, después se reasigna) y queda el registro de transferencia.
 * 3. Sofía, jefa de Ecografía, ve «Mi equipo»: qué administra y qué puede dar. En la ficha de una persona, lo que pasa de su techo
 *    aparece deshabilitado con su explicación y suspender a quien trabaja fuera de su alcance se rechaza en lenguaje simple.
 *
 * Se levanta con el build demo servido y se apunta con `E2E_BASE_URL`. El simulador contesta dentro del navegador: lo que se
 * mandó y lo que se contestó se lee de `window.__mockRequests`.
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
      sessionStorage.removeItem('mock.sesion');
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
}

async function peticiones(): Promise<Peticion[]> {
  return page.evaluate(
    () => (window as unknown as { __mockRequests?: Peticion[] }).__mockRequests ?? [],
  );
}

/** Elige una opción de un `app-select` como lo haría la persona: abre la lista y toca la fila. */
async function elegir(campo: Locator, opcion: string): Promise<void> {
  await campo.locator('.select-trigger').click();
  await page.getByRole('option', { name: opcion, exact: true }).click();
}

test('ciclo de vida: sin dueño, baja con traspaso y administración delegada dentro del techo', async () => {
  // 1. La administración de seguridad: casos abiertos y cuentas sin dueño.
  await entrar('hospital_piloto');
  await irA('/administration/access-governance/lifecycle');
  await expect(
    page.locator('[data-testid^="case-person-"]', { hasText: 'Nora Villarroel' }),
  ).toBeVisible();
  await expect(page.getByTestId('ownerless-list')).toContainText('Nora Villarroel');
  await expect(page.getByTestId('ownerless-list')).toContainText(
    'Nadie es responsable de esta cuenta.',
  );

  const nora = page.locator('[data-testid^="ownerless-"]', { hasText: 'Nora Villarroel' }).first();
  await elegir(nora.locator('app-select'), 'Sofía Camacho');
  await nora.getByRole('button', { name: /Asignar dueño/ }).click();
  await expect(page.getByTestId('owner-notice')).toContainText(
    'Sofía Camacho es ahora responsable de la cuenta de Nora Villarroel.',
  );
  await expect(page.getByTestId('ownerless-host')).toContainText(
    'Todas las cuentas tienen responsable.',
  );
  const owner = (await peticiones()).find((p) => p.method === 'PUT' && p.url.includes('/owner'));
  expect(owner?.status).toBe(200);

  // El caso de ingreso de Nora marca el paso como hecho.
  await page.locator('[data-testid^="case-open-"]').first().click();
  await expect(page.getByTestId('step-status-SUPERVISOR_ASSIGNED')).toContainText('Hecho');
  await expect(page.getByTestId('step-auto-CONFIDENTIALITY_ACK')).toContainText(
    'Este paso se completa solo',
  );

  // 2. Baja de Pablo con traspaso.
  await irA('/administration/support-team');
  const enlace = page.getByRole('link', { name: 'Permisos de Pablo Mamani' });
  const href = (await enlace.getAttribute('href'))!;
  await irA(`${href}/offboard`);
  await expect(page.getByTestId('offboard-count-CONVERSATION')).toContainText('3 conversaciones');
  await page.getByTestId('offboard-next').click();
  for (const tipo of ['CONVERSATION', 'TASK', 'PENDING_APPOINTMENT']) {
    await elegir(page.getByTestId(`handover-target-${tipo}`), 'Lucía Paz');
  }
  await page.getByTestId('offboard-next').click();
  await expect(page.getByTestId('offboard-fixed-text')).toContainText(
    'El acceso termina ahora. Las citas se mantienen y su gestión pasa a la recepción.',
  );
  await page.locator('[data-testid="offboard-reason"] textarea').fill('Renuncia de Pablo');
  await page.getByTestId('offboard-confirm').click();
  await expect(page.getByTestId('offboard-result')).toContainText(
    'primero se revocó y después se reasignó el trabajo',
  );
  await expect(page.getByTestId('offboard-result')).toContainText('No quedó nada pendiente.');
  const baja = (await peticiones()).find((p) => p.method === 'POST' && p.url.includes('/offboard'));
  expect(baja?.status).toBe(200);
  expect(baja?.body).toMatchObject({
    reason: 'Renuncia de Pablo',
    handover: { defaultToUserId: expect.any(String) },
  });
  await page.getByTestId('offboard-case-link').click();
  await expect(page.getByTestId('case-kind')).toContainText('Baja');
  await page.getByRole('tab', { name: 'Traspaso' }).click();
  await expect(page.getByTestId('handover-table')).toContainText('Lucía Paz');

  // 3. Sofía, jefa de Ecografía, dentro de su techo.
  await entrar('sofia');
  await irA('/administration/team-management');
  await expect(page.getByTestId('team-scope')).toContainText('Usted administra: Ecografía.');
  await expect(page.getByTestId('team-ceiling')).toContainText('todo lo de agenda');
  await page.locator('[data-testid^="member-open-"]').first().click();
  await expect(page.getByTestId('member-status')).toBeVisible();
  await page.getByTestId('member-add-grant').click();
  await page.getByRole('button', { name: /Facturación y caja/ }).click();
  const cobrar = page.getByTestId('member-grant-atom-billing.payment.collect');
  await expect(cobrar.locator('input[type="checkbox"]')).toBeDisabled();
  await expect(cobrar).toContainText('Solo el administrador de seguridad puede dar esto.');
  await page.getByTestId('member-editor-cancel').click();

  await page.getByRole('tab', { name: 'Vínculo y baja' }).click();
  if (await page.getByTestId('account-scope-warning').count()) {
    await page.getByTestId('suspend-submit').click();
    await expect(page.getByTestId('account-failure')).toContainText(
      'Fuera de lo que usted administra',
    );
    await expect(page.getByTestId('account-failure')).toContainText('«Quitar»');
  }
});
