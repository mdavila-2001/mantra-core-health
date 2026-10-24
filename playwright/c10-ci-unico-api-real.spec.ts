import { expect, request, test, type Page, type Response } from '@playwright/test';
import { urlDeApi } from './support/actores';

/**
 * C-10 / MD-01 de punta a punta contra la **API real**, sin mocks:
 * UI → request → response → persistencia → recarga → UI.
 *
 * 1. El alta del médico pregunta por el CI (número + departamento) y la API
 *    contesta que está libre.
 * 2. Otro médico se da de alta con ese CI, fuera del navegador (persistencia
 *    real en `common.identifiers`).
 * 3. Se recarga el alta: el mismo CI ahora se marca como ya registrado, con
 *    el mensaje en el campo; otro departamento sigue libre.
 * 4. El alta de paciente acepta ese mismo CI: un médico puede ser paciente.
 *
 * Exige la API levantada y el front en `start:real-api` (proxy hacia la API):
 *
 *   E2E_API_REAL=1 E2E_API_URL=http://localhost:3005 E2E_BASE_URL=http://localhost:4201
 *
 * Datos sintéticos: un CI con prefijo `E2E` y la marca de esta corrida.
 */
const API_REAL = process.env['E2E_API_REAL'] === '1';
const RUN = Date.now().toString(36).toUpperCase();
const CI = `E2E${RUN}`;
const TITULO = '.paginated-form__titulo';

test.describe.configure({ mode: 'serial' });
test.skip(
  !API_REAL,
  'Omitido: hace falta E2E_API_REAL=1 con la API y el front en modo real-api. No es un verde.',
);
test.use({ contextOptions: { reducedMotion: 'reduce' } });
test.setTimeout(120_000);

/** Toda respuesta 4xx/5xx y todo error de consola hace fallar la prueba. */
function vigilarRed(page: Page): string[] {
  const inesperadas: string[] = [];
  page.on('response', (r: Response) => {
    if (r.status() >= 400)
      inesperadas.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`);
  });
  page.on('console', (m) => {
    if (m.type() === 'error') inesperadas.push(`console: ${m.text().slice(0, 200)}`);
  });
  return inesperadas;
}

async function continuar(page: Page): Promise<void> {
  const boton = page.getByTestId('paginated-form-continuar').last();
  await expect(boton).toBeEnabled({ timeout: 20_000 });
  await boton.click();
}

/** Hasta la página del documento del alta de médico. */
async function documentoDelMedico(page: Page): Promise<void> {
  await page.goto('/auth/register/practitioner', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('registro-pro-nombre').fill('Ana');
  await page.getByTestId('registro-pro-apellido-paterno').fill('Paz');
  await continuar(page);
  await expect(page.locator(TITULO).first()).toContainText('Su documento', { timeout: 20_000 });
}

/**
 * Escribe el CI, elige el departamento como lo hace una persona (el
 * desplegable es un botón con su lista) y espera la respuesta real de la
 * consulta. Devuelve el departamento que viajó en la petición.
 */
async function consultar(
  page: Page,
  prefijo: 'registro-pro' | 'registro',
  departamento: string,
  anterior?: string,
): Promise<{ departamento: string; available: boolean }> {
  // Volver a escribir el mismo CI dispararía otra consulta con el departamento
  // anterior: sólo se escribe si cambia.
  const documento = page.getByTestId(`${prefijo}-documento`);
  if ((await documento.inputValue()) !== CI) await documento.fill(CI);
  const respuesta = page.waitForResponse((r) => {
    if (!r.url().includes('/iam/auth/document-availability') || r.request().method() !== 'GET') {
      return false;
    }
    // La respuesta del departamento recién elegido, no una que venga atrasada.
    return new URL(r.url()).searchParams.get('issuer') !== anterior;
  });
  await page.getByTestId(`${prefijo}-departamento-ci`).getByRole('combobox').click();
  await page.getByRole('option', { name: departamento, exact: true }).click();
  const r = await respuesta;
  expect(r.status()).toBe(200);
  const cuerpo = (await r.json()) as { available: boolean };
  // La respuesta no dice a quién pertenece el documento.
  expect(Object.keys(cuerpo)).toEqual(['available']);
  const pedido = new URL(r.url()).searchParams;
  expect(pedido.get('number')).toBe(CI);
  return {
    departamento: pedido.get('issuer') ?? '',
    available: cuerpo.available,
  };
}

let departamentoLibre = '';

test('1 · el CI recién inventado está libre para un médico', async ({ page }) => {
  const inesperadas = vigilarRed(page);
  await documentoDelMedico(page);
  const consulta = await consultar(page, 'registro-pro', 'La Paz');
  departamentoLibre = consulta.departamento;
  expect(consulta.available).toBe(true);
  await expect(page.getByTestId('documento-disponibilidad')).toContainText('Documento disponible.');
  expect(inesperadas).toEqual([]);
});

test('2 · otro médico se registra con ese CI (alta real, fuera del navegador)', async () => {
  const api = await request.newContext({ baseURL: urlDeApi() });
  const alta = await api.post('/iam/auth/register-practitioner', {
    data: {
      nationalId: CI,
      issuerAdministrativeAreaConceptId: departamentoLibre,
      email: `c10-${RUN.toLowerCase()}@example.test`,
      password: 'S3cret-passw0rd',
      name: 'Beto',
      lastName: 'Primero',
      licenseNumber: `LIC-C10-${RUN}`,
      credentialNumber: `CRED-C10-${RUN}`,
    },
  });
  expect(alta.status(), await alta.text()).toBe(201);
  await api.dispose();
});

test('3 · al recargar, el mismo CI y departamento se marcan como ya registrados; otro departamento sigue libre', async ({
  page,
}) => {
  const inesperadas = vigilarRed(page);
  await documentoDelMedico(page);
  const tomado = await consultar(page, 'registro-pro', 'La Paz');
  expect(tomado.departamento).toBe(departamentoLibre);
  expect(tomado.available).toBe(false);
  await expect(page.getByTestId('documento-disponibilidad')).toContainText('ya está registrado');
  // El mensaje del campo, que es a donde el motor vuelve al enviar.
  await page.getByTestId('registro-pro-documento').blur();
  await expect(page.getByText('Ya hay un médico registrado con este documento')).toBeVisible();

  const otro = await consultar(page, 'registro-pro', 'Santa Cruz', tomado.departamento);
  expect(otro.available).toBe(true);
  await expect(page.getByTestId('documento-disponibilidad')).toContainText('Documento disponible.');
  await expect(page.getByText('Ya hay un médico registrado con este documento')).toHaveCount(0);
  expect(inesperadas).toEqual([]);
});

test('4 · el alta de paciente acepta el CI del médico: son tipos de usuario distintos', async ({
  page,
}) => {
  const inesperadas = vigilarRed(page);
  await page.goto('/auth/register/patient', { waitUntil: 'domcontentloaded' });
  // En el alta de paciente el documento va en la primera página, con el nombre.
  await expect(page.locator(TITULO).first()).toContainText('Identidad', { timeout: 20_000 });
  const consulta = await consultar(page, 'registro', 'La Paz');
  expect(consulta.departamento).toBe(departamentoLibre);
  expect(consulta.available).toBe(true);
  await expect(page.getByTestId('documento-disponibilidad')).toContainText('Documento disponible.');
  expect(inesperadas).toEqual([]);
});
