import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { apiViva, contextoDeApi, urlDeApi } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Carril 22 · vista de servicios médicos, contra la API real.
 *
 * Datos propios: una médica con consultorio propio y un servicio en su
 * catálogo. Cubre:
 *
 * - La vista de un servicio: tarjeta con lo principal arriba, términos abajo
 *   (criterios 2 y 3). Sin términos propios dice que usa los de por defecto
 *   y que todavía no hay un contrato general cargado — no inventa el texto.
 * - Cambiar los términos por defecto pide confirmación antes (criterio 6), y
 *   cancelar no abre la edición.
 * - Los términos propios se guardan y persisten tras recargar; volver a los
 *   de por defecto los borra en la base (criterios 5 y 12).
 * - «Importar producto» desde «Mis servicios» lleva al arancel agrupado por
 *   especialidad e importa a la práctica propia; lo ya importado no se ofrece
 *   de nuevo (criterios 7, 8 y 11).
 *
 * Exige el front en `start:real-api` y la API levantada:
 *   E2E_API_REAL=1 E2E_API_URL=http://localhost:3000 E2E_BASE_URL=http://localhost:4200
 */

const API_REAL = process.env['E2E_API_REAL'] === '1';
const DEPARTAMENTO_SC = '16fe92e8-bec7-577d-9e63-4a0d8ff3b0e4';
const MUNICIPIO = '5132db42-8cb1-52d6-88f5-0e9a04bdc94c';
const TERMINOS = 'La consulta incluye un control sin costo dentro de los 15 días.';

test.describe.configure({ mode: 'serial' });
test.skip(
  !API_REAL,
  'Omitido: hace falta E2E_API_REAL=1 con la API y el front en modo real-api. No es un verde.',
);

interface Escenario {
  readonly medica: { identificador: string; clave: string };
  readonly practicaId: string;
  readonly servicioId: string;
  readonly nombreServicio: string;
}

let api: APIRequestContext;
let escenario: Escenario;

async function json<T>(
  paso: string,
  respuesta: Awaited<ReturnType<APIRequestContext['post']>>,
): Promise<T> {
  expect(respuesta.ok(), `${paso}: ${respuesta.status()} ${await respuesta.text()}`).toBe(true);
  return (await respuesta.json()) as T;
}

async function tokenDe(identificador: string, clave: string): Promise<string> {
  const { accessToken } = await json<{ accessToken: string }>(
    'login',
    await api.post('/iam/auth/login', { data: { email: identificador, password: clave } }),
  );
  return accessToken;
}

async function prepararEscenario(): Promise<Escenario> {
  const corrida = Date.now().toString(36);
  const clave = `Servicio-${corrida}-2026!`;
  const medica = { identificador: `medica.s22.${corrida}@alovida.test`, clave };
  await json(
    'alta de la médica',
    await api.post('/iam/auth/register-practitioner', {
      data: {
        email: medica.identificador,
        password: clave,
        name: 'Nora',
        lastName: 'Vargas',
        licenseNumber: `MP-S22-${corrida}`,
        sedesLicenseNumber: `SEDES-S22-${corrida}`,
        professionalTitle: 'Médico',
        nationalId: `S22${corrida}`,
        issuerAdministrativeAreaConceptId: DEPARTAMENTO_SC,
        residenceMunicipalityConceptId: MUNICIPIO,
      },
    }),
  );
  await json(
    'consultorio propio',
    await api.post('/practitioners/me/sites', {
      headers: { Authorization: `Bearer ${await tokenDe(medica.identificador, clave)}` },
      data: { name: 'Consultorio Nora Vargas' },
    }),
  );
  const auth = { Authorization: `Bearer ${await tokenDe(medica.identificador, clave)}` };
  const [practica] = await json<{ id: string }[]>(
    'prácticas',
    await api.get('/practices', { headers: auth }),
  );
  const nombreServicio = `Control prenatal ${corrida}`;
  const servicio = await json<{ id: string }>(
    'servicio del catálogo',
    await api.post('/billing/service-catalog', {
      headers: auth,
      data: {
        practiceId: practica!.id,
        code: `PREN-${corrida}`,
        name: nombreServicio,
        defaultPrice: '250.00',
      },
    }),
  );
  return { medica, practicaId: practica!.id, servicioId: servicio.id, nombreServicio };
}

async function terminosEnLaBase(): Promise<string | undefined> {
  const token = await tokenDe(escenario.medica.identificador, escenario.medica.clave);
  const pagina = await json<{ items: { id: string; termsText?: string }[] }>(
    'leer el catálogo',
    await api.get(`/billing/service-catalog?practiceId=${escenario.practicaId}&limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
  return pagina.items.find((item) => item.id === escenario.servicioId)?.termsText;
}

async function abrirTerminos(page: Page): Promise<void> {
  await irA(page, '/my-services');
  await estable(page);
  await page
    .getByRole('button', { name: `Términos y condiciones: ${escenario.nombreServicio}` })
    .click();
  await expect(page.getByRole('dialog', { name: 'Términos y condiciones' })).toBeVisible();
}

test.beforeAll(async () => {
  test.setTimeout(120_000);
  api = await contextoDeApi();
  expect(await apiViva(api), `La API no responde en ${urlDeApi()}.`).toBe(true);
  escenario = await prepararEscenario();
});

test.afterAll(async () => {
  await api?.dispose();
});

test.beforeEach(async ({ page }) => {
  await entrar(page, {
    rol: 'doctora',
    identificador: escenario.medica.identificador,
    clave: escenario.medica.clave,
    nombre: 'médica de los servicios',
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('la vista del servicio: tarjeta arriba, términos por defecto abajo, sin inventar el texto', async ({
  page,
}) => {
  await abrirTerminos(page);
  await expect(page.getByTestId('service-terms-card')).toContainText(escenario.nombreServicio);
  await expect(page.getByTestId('service-terms-default')).toContainText(
    'Todavía no hay un contrato general cargado',
  );

  // Cancelar la confirmación no abre la edición.
  await page.getByTestId('service-terms-edit').click();
  await expect(page.getByText('¿Cambiar los términos por defecto?')).toBeVisible();
  await page.getByTestId('dialogo-cancelar').click();
  await expect(page.getByTestId('service-terms-input')).toHaveCount(0);
  expect(await terminosEnLaBase()).toBeUndefined();
});

test('cambiar los términos pide confirmación, se guardan y persisten; volver al defecto los borra', async ({
  page,
}) => {
  await abrirTerminos(page);
  await page.getByTestId('service-terms-edit').click();
  await expect(page.getByText(/pensados para cubrir la práctica de consulta médica/)).toBeVisible();
  await page.getByTestId('dialogo-confirmar').click();

  await page.getByTestId('service-terms-input').locator('textarea').fill(TERMINOS);
  const [guardado] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().endsWith(`/billing/service-catalog/${escenario.servicioId}`) &&
        r.request().method() === 'PATCH',
    ),
    page.getByTestId('service-terms-save').click(),
  ]);
  expect(guardado.status(), await guardado.text()).toBe(200);
  expect(await terminosEnLaBase()).toBe(TERMINOS);

  await page.reload();
  await abrirTerminos(page);
  await expect(page.getByTestId('service-terms-text')).toHaveText(TERMINOS);
  await page.screenshot({ path: 'artifacts/tarea-22/terminos-propios-1280.png', fullPage: true });

  await page.getByTestId('service-terms-restore').click();
  await page.getByTestId('dialogo-confirmar').click();
  await expect(page.getByTestId('service-terms-default')).toBeVisible();
  await expect.poll(terminosEnLaBase).toBeUndefined();
});

test('importar producto desde Mis servicios trae un procedimiento del arancel sin duplicarlo', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await irA(page, '/my-services');
  await estable(page);
  await page.getByTestId('my-services-import').click();
  await expect(page).toHaveURL(/\/my-services\/import/);

  const boton = page.getByTestId('procedimiento-importar').first();
  await expect(boton).toBeVisible({ timeout: 30_000 });
  const nombre = (await boton.getAttribute('aria-label'))!.replace('Importar: ', '');
  const [importado] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith('/billing/service-catalog') && r.request().method() === 'POST',
    ),
    boton.click(),
  ]);
  expect(importado.status(), await importado.text()).toBe(201);

  // Lo ya importado no se ofrece de nuevo.
  const tarjeta = page.getByTestId('procedimiento').filter({ hasText: nombre }).first();
  await expect(tarjeta).toContainText('Ya está en su catálogo');
  await expect(tarjeta.getByTestId('procedimiento-importar')).toHaveCount(0);

  // Vuelve a «Mis servicios» y el procedimiento está en la lista.
  await page.getByRole('link', { name: 'Volver al catálogo' }).click();
  await expect(page).toHaveURL(/\/my-services$/);
  await estable(page);
  await expect(page.getByText(nombre, { exact: false }).first()).toBeVisible();
  await page.screenshot({ path: 'artifacts/tarea-22/mis-servicios-1280.png', fullPage: true });
});
