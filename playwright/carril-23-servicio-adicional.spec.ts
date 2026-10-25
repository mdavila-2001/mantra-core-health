import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { apiViva, contextoDeApi, urlDeApi } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Carril 23 · servicio médico adicional con aviso de parecidos, contra la API
 * real.
 *
 * Datos propios: una médica con consultorio propio y «Consulta de control
 * prenatal» en su catálogo. Cubre:
 *
 * - «Agregar servicio adicional» abre el diálogo (criterios 1 y 2).
 * - Un nombre parecido a uno existente pregunta «¿Quizás quiso decir…?» con
 *   la opción (3 y 4); «Usar este» no crea nada (5).
 * - «Es un servicio distinto» sigue y lo crea (7); queda guardado y aparece
 *   en la lista sin recargar (8).
 * - Un nombre sin parecidos se crea directo (5: no se bloquea lo distinto).
 *
 * Exige el front en `start:real-api` y la API levantada:
 *   E2E_API_REAL=1 E2E_API_URL=http://localhost:3000 E2E_BASE_URL=http://localhost:4200
 */

const API_REAL = process.env['E2E_API_REAL'] === '1';
const DEPARTAMENTO_SC = '16fe92e8-bec7-577d-9e63-4a0d8ff3b0e4';
const MUNICIPIO = '5132db42-8cb1-52d6-88f5-0e9a04bdc94c';
const EXISTENTE = 'Consulta de control prenatal';

test.describe.configure({ mode: 'serial' });
test.skip(
  !API_REAL,
  'Omitido: hace falta E2E_API_REAL=1 con la API y el front en modo real-api. No es un verde.',
);

interface Escenario {
  readonly medica: { identificador: string; clave: string };
  readonly practicaId: string;
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
  const clave = `Adicional-${corrida}-2026!`;
  const medica = { identificador: `medica.s23.${corrida}@alovida.test`, clave };
  await json(
    'alta de la médica',
    await api.post('/iam/auth/register-practitioner', {
      data: {
        email: medica.identificador,
        password: clave,
        name: 'Inés',
        lastName: 'Paz',
        licenseNumber: `MP-S23-${corrida}`,
        sedesLicenseNumber: `SEDES-S23-${corrida}`,
        professionalTitle: 'Médico',
        nationalId: `S23${corrida}`,
        issuerAdministrativeAreaConceptId: DEPARTAMENTO_SC,
        residenceMunicipalityConceptId: MUNICIPIO,
      },
    }),
  );
  await json(
    'consultorio propio',
    await api.post('/practitioners/me/sites', {
      headers: { Authorization: `Bearer ${await tokenDe(medica.identificador, clave)}` },
      data: { name: 'Consultorio Inés Paz' },
    }),
  );
  const auth = { Authorization: `Bearer ${await tokenDe(medica.identificador, clave)}` };
  const [practica] = await json<{ id: string }[]>(
    'prácticas',
    await api.get('/practices', { headers: auth }),
  );
  await json(
    'servicio existente',
    await api.post('/billing/service-catalog', {
      headers: auth,
      data: {
        practiceId: practica!.id,
        code: `PREN-${corrida}`,
        name: EXISTENTE,
        defaultPrice: '250.00',
      },
    }),
  );
  return { medica, practicaId: practica!.id };
}

async function nombresEnLaBase(): Promise<string[]> {
  const token = await tokenDe(escenario.medica.identificador, escenario.medica.clave);
  const pagina = await json<{ items: { name: string }[] }>(
    'leer el catálogo',
    await api.get(`/billing/service-catalog?practiceId=${escenario.practicaId}&limit=100`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
  return pagina.items.map((item) => item.name);
}

async function abrirAgregar(page: Page, nombre: string, precio: string): Promise<void> {
  await irA(page, '/my-services');
  await estable(page);
  await page.getByTestId('my-services-add').click();
  await expect(page.getByRole('dialog', { name: 'Agregar servicio adicional' })).toBeVisible();
  await page.getByTestId('service-add-name').fill(nombre);
  await page.getByTestId('service-add-price').fill(precio);
  await page.getByTestId('service-add-continue').click();
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
    nombre: 'médica de los servicios adicionales',
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('un nombre parecido pregunta «¿Quizás quiso decir…?» y «Usar este» no crea nada', async ({
  page,
}) => {
  await abrirAgregar(page, 'Control prenatal', '200.00');
  const parecidos = page.getByTestId('service-add-suggestions');
  await expect(page.getByText('¿Quizás quiso decir…?')).toBeVisible();
  await expect(parecidos).toContainText(EXISTENTE);
  await page.screenshot({ path: 'artifacts/tarea-23/quizas-quiso-decir-1280.png', fullPage: true });

  await page.getByRole('button', { name: `Usar el servicio existente: ${EXISTENTE}` }).click();
  await expect(page.getByRole('dialog', { name: 'Agregar servicio adicional' })).toHaveCount(0);
  await expect(page).toHaveURL(/[?&]q=/);
  expect(await nombresEnLaBase()).toEqual([EXISTENTE]);
});

test('«Es un servicio distinto» lo crea, queda guardado y aparece sin recargar', async ({
  page,
}) => {
  await abrirAgregar(page, 'Control prenatal de alto riesgo', '400.00');
  await expect(page.getByTestId('service-add-suggestions')).toBeVisible();
  const [creado] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith('/billing/service-catalog') && r.request().method() === 'POST',
    ),
    page.getByTestId('service-add-create-anyway').click(),
  ]);
  expect(creado.status(), await creado.text()).toBe(201);
  await expect(page.getByText('Control prenatal de alto riesgo').first()).toBeVisible();
  expect(await nombresEnLaBase()).toContain('Control prenatal de alto riesgo');
});

test('un nombre sin parecidos se crea directo, sin preguntar', async ({ page }) => {
  const [creado] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith('/billing/service-catalog') && r.request().method() === 'POST',
    ),
    abrirAgregar(page, 'Curación de heridas', '120.00'),
  ]);
  expect(creado.status(), await creado.text()).toBe(201);
  await expect(page.getByText('¿Quizás quiso decir…?')).toHaveCount(0);
  await expect(page.getByText('Curación de heridas').first()).toBeVisible();
  expect(await nombresEnLaBase()).toContain('Curación de heridas');
});
