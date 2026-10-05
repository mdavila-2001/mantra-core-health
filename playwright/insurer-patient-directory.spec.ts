import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

// UI aislada: no demuestra autorización ni persistencia de la API.
const route = '/administration/insurance-patients';
const evidence = path.resolve('docs/trabajo/2026-10-05-directorio-pacientes/evidencia');
const patient = {
  patientProfileId: '11111111-1111-4111-8111-111111111111',
  fullName: 'Paciente Sintético de Prueba con Nombre Extenso',
  birthDate: '1990-10-05',
  age: 36,
  phone: '+59170000001',
  email: 'paciente.sintetico@example.test',
  genderCode: 'GENDER_FEMALE',
  occupationDisplay: 'Artesana textil independiente',
  insurers: [
    { id: 'carrier-1', name: 'Aseguradora Sintética Uno' },
    { id: 'carrier-2', name: 'Aseguradora Sintética Dos' },
  ],
  messaging: { channel: 'internal', available: true },
};
const uninsured = {
  patientProfileId: '22222222-2222-4222-8222-222222222222',
  fullName: 'Paciente Sintético Sin Seguro',
  insurers: [],
  messaging: { channel: 'internal', available: false },
};
type Scenario = 'data' | 'empty' | 'error' | 'loading' | 'forbidden' | 'chat-error';

async function setup(page: Page, scenario: Scenario = 'data') {
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'synthetic-admin',
      name: 'Administración Sintética',
      roles: ['SECURITY_ADMIN'],
      tenants: [],
      exp: 4102444800,
    }),
  ).toString('base64url');
  const token = `e30.${payload}.synthetic`;
  await page.addInitScript(() => {
    localStorage.setItem('mantra.refresh-token', 'synthetic-refresh');
    localStorage.setItem('mantra.session', '1');
  });
  const problems: string[] = [];
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  const allowedStatus =
    scenario === 'error' ? 500 : ['forbidden', 'chat-error'].includes(scenario) ? 403 : null;
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      !(allowedStatus && message.text().includes(String(allowedStatus)))
    )
      problems.push(message.text());
  });
  page.on('response', (response) => {
    if (
      response.status() >= 400 &&
      !(response.status() === allowedStatus && response.url().includes('/insurance/patients/'))
    )
      problems.push(`${response.status()} ${new URL(response.url()).pathname}`);
  });
  // Supports both same-origin production and a local /api proxy build.
  await page.route(
    (url) =>
      /^\/(?:api\/)?(?:iam|community|insurance|system-context|notifications|profiles)\//.test(
        url.pathname,
      ),
    async (intercepted) => {
      const url = new URL(intercepted.request().url());
      const endpoint = url.pathname.replace(/^\/api/, '');
      let json: unknown = {};
      let status = 200;
      if (endpoint === '/iam/auth/token/refresh')
        json = {
          accessToken: token,
          refreshToken: 'synthetic-refresh',
          expiresAt: '2100-01-01T00:00:00Z',
        };
      else if (endpoint === '/community/profiles/me') json = null;
      else if (endpoint === '/insurance/patients/options') {
        json = { insurers: patient.insurers };
        if (scenario === 'forbidden') {
          status = 403;
          json = { code: 'FORBIDDEN', message: 'Acceso denegado' };
        }
      } else if (endpoint === '/system-context/dynamic-enums')
        json = {
          code: 'gender',
          name: 'Sexo',
          definitionId: 'gender',
          valueSetId: 'gender',
          cacheToken: 'v1',
          options: [
            { conceptId: 'gender-f', code: 'GENDER_FEMALE', display: 'Femenino' },
            { conceptId: 'gender-m', code: 'GENDER_MALE', display: 'Masculino' },
            { conceptId: 'gender-o', code: 'GENDER_OTHER', display: 'Otro' },
          ],
        };
      else if (endpoint === '/insurance/patients/search') {
        expect(intercepted.request().method()).toBe('POST');
        expect(url.search).toBe('');
        const body = intercepted.request().postDataJSON() as Record<string, unknown>;
        requests.push({ url: url.pathname, body });
        if (scenario === 'loading') return;
        if (scenario === 'error') {
          status = 500;
          json = { message: 'Error sintético', requestId: 'synthetic-request' };
        } else
          json = {
            items:
              scenario === 'empty' || body['search'] === 'sin coincidencia'
                ? []
                : [patient, uninsured],
            total: scenario === 'empty' || body['search'] === 'sin coincidencia' ? 0 : 42,
            limit: body['limit'],
            nextCursor: body['cursor'] ? null : 'synthetic-next',
          };
      } else if (endpoint === '/insurance/patients/conversation') {
        expect(intercepted.request().postDataJSON()).toEqual({
          patientProfileId: patient.patientProfileId,
          channel: 'internal',
        });
        status = 403;
        json = { message: 'Cobertura revocada' };
      } else if (endpoint.includes('notifications'))
        json = { items: [], nextCursor: null, unreadCount: 0 };
      else if (endpoint.includes('dependents')) json = [];
      else if (endpoint.includes('conversations')) json = { items: [], nextCursor: null };
      await intercepted.fulfill({ status, json });
    },
  );
  await page.goto(route);
  await expect(
    page.getByRole('heading', { name: 'Directorio de Pacientes', exact: true }),
  ).toBeVisible();
  return { problems, requests };
}

test.describe('Directorio de pacientes @ui-mock', () => {
  for (const width of [390, 649, 650, 768, 1023, 1024, 1440, 1920]) {
    test(`tarjetas/tabla y mensajería a ${width}px`, async ({ page }) => {
      const height =
        width === 390
          ? 844
          : width === 768
            ? 1024
            : width === 1024
              ? 768
              : width === 1920
                ? 1080
                : 900;
      await page.setViewportSize({ width, height });
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: 'light' });
      const { problems } = await setup(page);
      await expect(page.getByTestId('directory-count')).toContainText('42');
      const region =
        width < 1024
          ? page.getByTestId('patient-cards')
          : page.getByTestId('table-insurer-patients');
      await expect(region).toBeVisible();
      await expect(
        region.getByRole('button', { name: `Enviar Mensaje a ${patient.fullName}`, exact: true }),
      ).toBeVisible();
      await expect(region).toContainText('Ninguno');
      await expect(region).toContainText('05/10/1990');
      await expect(region).toContainText('36 años');
      await page.getByRole('textbox', { name: 'Buscar pacientes', exact: true }).focus();
      await mkdir(evidence, { recursive: true });
      for (const theme of ['light', 'dark']) {
        if (theme === 'dark') {
          await page.getByRole('switch', { name: 'Cambiar a modo oscuro', exact: true }).click();
          await expect(
            page.getByRole('switch', { name: 'Cambiar a modo claro', exact: true }),
          ).toBeChecked();
          await page.getByRole('textbox', { name: 'Buscar pacientes', exact: true }).focus();
        }
        await expect
          .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
          .toBe(true);
        await page.screenshot({
          path: path.join(evidence, `directory-${width}-${theme}.png`),
          fullPage: true,
        });
      }
      expect(problems).toEqual([]);
      console.log(`UI ${width}px: consola/red sin errores inesperados`);
    });
  }

  for (const scenario of ['loading', 'empty', 'error', 'forbidden'] as const) {
    test(`estado ${scenario}`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      const { problems } = await setup(page, scenario);
      if (scenario === 'loading') await expect(page.getByLabel('Cargando pacientes')).toBeVisible();
      if (scenario === 'empty')
        await expect(
          page.getByRole('heading', { name: 'Tu directorio todavía no tiene pacientes' }),
        ).toBeVisible();
      if (scenario === 'error')
        await expect(page.getByRole('button', { name: 'Reintentar carga' })).toBeVisible();
      if (scenario === 'forbidden')
        await expect(
          page.getByText('No tenés acceso a esta sección', { exact: true }),
        ).toBeVisible();
      for (const theme of ['light', 'dark']) {
        if (theme === 'dark')
          await page.getByRole('switch', { name: 'Cambiar a modo oscuro', exact: true }).click();
        await page.screenshot({
          path: path.join(evidence, `directory-${scenario}-${theme}.png`),
          fullPage: true,
        });
      }
      expect(problems).toEqual([]);
    });
  }

  test('búsqueda, chips, reinicio y paginación sin filtros en URL', async ({ page }) => {
    const { problems, requests } = await setup(page);
    const search = page.getByRole('textbox', { name: 'Buscar pacientes', exact: true });
    await expect(page.getByTestId('directory-count')).toContainText('42');
    await search.fill('sin coincidencia');
    await expect(
      page.getByRole('heading', {
        name: 'No se encontraron pacientes con los filtros seleccionados',
      }),
    ).toBeVisible();
    expect(requests.at(-1)?.body['search']).toBe('sin coincidencia');
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await page.getByRole('button', { name: 'Restablecer filtros', exact: true }).click();
    await expect(search).toHaveValue('');
    await expect(page.getByTestId('directory-count')).toContainText('42');
    await page
      .getByRole('combobox', { name: 'Filas por página' })
      .selectOption({ label: '50 por página' });
    await expect.poll(() => requests.at(-1)?.body['limit']).toBe(50);
    expect(problems).toEqual([]);
  });

  test('error de conversación conserva la búsqueda y permite reintentar', async ({ page }) => {
    const { problems, requests } = await setup(page, 'chat-error');
    const search = page.getByRole('textbox', { name: 'Buscar pacientes', exact: true });
    await search.fill('Paciente Sintético');
    await expect.poll(() => requests.at(-1)?.body['search']).toBe('Paciente Sintético');
    const message = page.getByTestId('table-insurer-patients').getByRole('button', {
      name: `Enviar Mensaje a ${patient.fullName}`,
      exact: true,
    });
    await message.click();
    await expect(page.getByText('No se pudo abrir la conversación', { exact: true })).toBeVisible();
    await expect(search).toHaveValue('Paciente Sintético');
    await expect(message).toBeEnabled();
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    expect(problems).toEqual([]);
  });
});
