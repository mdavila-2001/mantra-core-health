import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { apiViva, contextoDeApi, urlDeApi } from './support/actores';
import { elegirOpcion } from './support/registro-paciente';
import { entrar, estable, irA } from './support/sesion';

/**
 * Carril 21 · grupo médico, de punta a punta contra la API real.
 *
 * ## Datos propios, por el camino real
 *
 * Dos médicas nuevas (`register-practitioner`). La primera abre su consultorio
 * propio (`POST /practitioners/me/sites`) y da de alta un servicio en su
 * catálogo; la segunda pide vincularse a esa práctica y el administrador lo
 * aprueba — sin eso la API no la dejaría invitar (sólo se invita a colegas de
 * la misma organización). Dos grupos más se crean por API con fecha pasada:
 * uno de hace dos días (notas abiertas) y otro de hace diez (expediente
 * cerrado). Nada se toma prestado del entorno.
 *
 * ## Qué cubre (criterios de la ficha)
 *
 * - Pestañas: Histórico por defecto, Solicitudes enviadas y recibidas.
 * - «Crear grupo médico» abre el formulario; el grupo queda guardado.
 * - La consulta muestra el mismo formulario lleno, sin editar, con el estado.
 * - El invitado acepta; el estado persiste tras recargar.
 * - Un integrante pide cambio de horario: queda pendiente del creador, y al
 *   aceptarlo vuelve a programado con la fecha nueva.
 * - Realizado y dentro de la semana: se cargan notas y persisten.
 * - Pasada la semana: el expediente se cierra y la API no deja mutarlo.
 *
 * Exige el front en `start:real-api` y la API levantada:
 *   E2E_API_REAL=1 E2E_API_URL=http://localhost:3000 E2E_BASE_URL=http://localhost:4200
 *   E2E_ADMIN_EMAIL y E2E_ADMIN_PASSWORD (los BOOTSTRAP_ADMIN_* de la API)
 */

const API_REAL = process.env['E2E_API_REAL'] === '1';
const ADMIN_EMAIL = process.env['E2E_ADMIN_EMAIL'] ?? '';
const ADMIN_PASSWORD = process.env['E2E_ADMIN_PASSWORD'] ?? '';
/** `VS_BO_DEPARTMENT · Santa Cruz`, sembrado por el stack de desarrollo. */
const DEPARTAMENTO_SC = '16fe92e8-bec7-577d-9e63-4a0d8ff3b0e4';
/** Municipio sembrado (Sucre), el mismo que usan los carriles 11 a 13. */
const MUNICIPIO = '5132db42-8cb1-52d6-88f5-0e9a04bdc94c';
const CAPTURAS = join(__dirname, '..', 'artifacts', 'playwright', 'tarea-21');
const DIA_MS = 24 * 60 * 60 * 1000;

test.describe.configure({ mode: 'serial' });
test.skip(
  !API_REAL || ADMIN_EMAIL === '' || ADMIN_PASSWORD === '',
  'Omitido: hace falta E2E_API_REAL=1, la API y el front en modo real-api, y E2E_ADMIN_*. No es un verde.',
);

interface Medica {
  readonly identificador: string;
  readonly clave: string;
  readonly nombre: string;
}

interface Escenario {
  readonly creadora: Medica;
  readonly invitada: Medica;
  readonly codigoServicio: string;
  readonly nombreInvitada: string;
  readonly grupoConNotas: string;
  readonly grupoCerrado: string;
}

let api: APIRequestContext;
let escenario: Escenario;
/** El grupo que la prueba crea desde la pantalla. */
let grupoNuevo = '';

function claims(token: string): Record<string, unknown> {
  const cuerpo = token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(
    Buffer.from(cuerpo + '='.repeat((4 - (cuerpo.length % 4)) % 4), 'base64').toString('utf8'),
  ) as Record<string, unknown>;
}

async function json<T>(
  paso: string,
  respuesta: Awaited<ReturnType<APIRequestContext['post']>>,
): Promise<T> {
  expect(respuesta.ok(), `${paso}: ${respuesta.status()} ${await respuesta.text()}`).toBe(true);
  return (await respuesta.json()) as T;
}

async function token(identificador: string, clave: string): Promise<string> {
  const { accessToken } = await json<{ accessToken: string }>(
    `login de ${identificador}`,
    await api.post('/iam/auth/login', { data: { email: identificador, password: clave } }),
  );
  return accessToken;
}

async function registrar(
  corrida: string,
  sufijo: string,
  nombre: string,
  apellido: string,
): Promise<Medica> {
  const medica = {
    identificador: `medica.g21.${sufijo}.${corrida}@alovida.test`,
    clave: `Grupo-${corrida}-2026!`,
    nombre: `${nombre} ${apellido}`,
  };
  await json(
    `alta de ${medica.nombre}`,
    await api.post('/iam/auth/register-practitioner', {
      data: {
        email: medica.identificador,
        password: medica.clave,
        name: nombre,
        lastName: apellido,
        licenseNumber: `MP-G21${sufijo}-${corrida}`,
        sedesLicenseNumber: `SEDES-G21${sufijo}-${corrida}`,
        professionalTitle: 'Médico',
        nationalId: `G21${sufijo}${corrida}`,
        issuerAdministrativeAreaConceptId: DEPARTAMENTO_SC,
        residenceMunicipalityConceptId: MUNICIPIO,
      },
    }),
  );
  return medica;
}

async function prepararEscenario(): Promise<Escenario> {
  const corrida = Date.now().toString(36);
  // Los consultorios propios comparten organización, así que las médicas de
  // corridas anteriores también son «colegas»: el apellido lleva la corrida,
  // en letras, para que el selector no ofrezca a dos con el mismo nombre.
  const etiqueta = corrida.replace(/\d/g, (d) => 'abcdefghij'[Number(d)]!);
  const creadora = await registrar(corrida, 'a', 'Paula', `Arce ${etiqueta}`);
  const invitada = await registrar(corrida, 'b', 'Luis', `Rojas ${etiqueta}`);

  let tokenCreadora = await token(creadora.identificador, creadora.clave);
  await json(
    'consultorio propio',
    await api.post('/practitioners/me/sites', {
      headers: { Authorization: `Bearer ${tokenCreadora}` },
      data: { name: 'Consultorio Paula Arce' },
    }),
  );
  // El token nuevo trae la organización del consultorio recién creado.
  tokenCreadora = await token(creadora.identificador, creadora.clave);
  const authCreadora = { Authorization: `Bearer ${tokenCreadora}` };
  const [practica] = await json<{ id: string }[]>(
    'prácticas',
    await api.get('/practices', { headers: authCreadora }),
  );
  const codigoServicio = `COLE-${corrida}`;
  const servicio = await json<{ id: string }>(
    'servicio del catálogo',
    await api.post('/billing/service-catalog', {
      headers: authCreadora,
      data: {
        practiceId: practica!.id,
        code: codigoServicio,
        name: 'Colecistectomía laparoscópica',
        defaultPrice: '8000.00',
      },
    }),
  );

  const tokenInvitada = await token(invitada.identificador, invitada.clave);
  const vinculo = await json<{ id: string }>(
    'la invitada pide vincularse',
    await api.post(`/practices/${practica!.id}/role-assignments/self-request`, {
      headers: { Authorization: `Bearer ${tokenInvitada}` },
      data: {},
    }),
  );
  const tokenAdmin = await token(ADMIN_EMAIL, ADMIN_PASSWORD);
  const { tenants } = claims(tokenCreadora) as { tenants?: string[] };
  await json(
    'el administrador aprueba la vinculación',
    await api.post(`/role-assignments/${vinculo.id}/approve`, {
      headers: { Authorization: `Bearer ${tokenAdmin}`, 'x-tenant-id': tenants![0]! },
      data: {},
    }),
  );

  const grupo = async (paso: string, diasAtras: number) =>
    (
      await json<{ id: string }>(
        paso,
        await api.post('/medical-groups', {
          headers: authCreadora,
          data: {
            serviceCatalogId: servicio.id,
            scheduledAt: new Date(Date.now() - diasAtras * DIA_MS).toISOString(),
            locationText: 'Clínica Foianini, quirófano 2',
            members: [],
          },
        }),
      )
    ).id;

  return {
    creadora,
    invitada,
    codigoServicio,
    nombreInvitada: invitada.nombre,
    grupoConNotas: await grupo('grupo realizado hace dos días', 2),
    grupoCerrado: await grupo('grupo realizado hace diez días', 10),
  };
}

async function como(page: Page, medica: Medica): Promise<void> {
  await entrar(page, {
    rol: 'doctora',
    identificador: medica.identificador,
    clave: medica.clave,
    nombre: medica.nombre,
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
}

async function capturar(page: Page, nombre: string): Promise<void> {
  mkdirSync(CAPTURAS, { recursive: true });
  await page.screenshot({ path: join(CAPTURAS, `${nombre}.png`), fullPage: true });
}

function ddmmaaaa(fecha: Date): string {
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${dd}${mm}${fecha.getFullYear()}`;
}

/**
 * Escribe la fecha en el selector. Se sale con Tab y no con Escape: dentro de
 * un diálogo, Escape cierra el diálogo entero.
 */
async function escribirFecha(page: Page, scope: string, fecha: Date): Promise<void> {
  const input = page.locator(`${scope} app-date-picker input`).first();
  // El cambio de horario abre con la fecha vigente: se vacía antes de escribir.
  await input.fill('');
  await input.click();
  await page.keyboard.type(ddmmaaaa(fecha), { delay: 40 });
  await page.keyboard.press('Tab');
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

test('el listado abre en el Histórico, con las tres pestañas', async ({ page }) => {
  await como(page, escenario.creadora);
  await irA(page, '/my-medical-groups');
  await estable(page);

  await expect(page.getByRole('tab', { name: 'Histórico de grupos' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(page.getByRole('tab', { name: 'Solicitudes enviadas' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Solicitudes recibidas' })).toBeVisible();
  // Los dos grupos sembrados por API están en el histórico de quien los creó,
  // y el de hace diez días ya figura cerrado también en el listado.
  await expect(page.getByTestId('medical-group-open')).toHaveCount(2);
  await expect(page.getByText('Cerrado', { exact: true })).toHaveCount(1);
  await capturar(page, 'listado-historico-1280');
});

test('crear un grupo: servicio, fecha, lugar y un cargo; queda esperando al equipo', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await como(page, escenario.creadora);
  await irA(page, '/my-medical-groups');
  await page.getByTestId('medical-group-list-new').click();
  await expect(page).toHaveURL(/\/my-medical-groups\/new$/);

  await page.getByLabel('Buscar servicio por código o nombre').fill(escenario.codigoServicio);
  await page.getByRole('button', { name: 'Elegir' }).first().click();
  await expect(page.getByTestId('medical-group-form-service')).toContainText(
    'Colecistectomía laparoscópica',
  );

  await escribirFecha(page, '.grupo', new Date(Date.now() + 5 * DIA_MS));
  await page.getByTestId('medical-group-form-location').fill('Clínica Foianini, quirófano 2');

  await elegirOpcion(page, 'medical-group-form-practitioner-0', {
    label: escenario.nombreInvitada,
  });
  await page.getByTestId('medical-group-form-role-0').fill('Anestesiólogo');
  await page.getByTestId('medical-group-form-amount-0').fill('1500.00');
  await capturar(page, 'formulario-lleno-1280');

  const [creado] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().endsWith('/medical-groups') && r.request().method() === 'POST',
    ),
    page.getByTestId('medical-group-form-save').click(),
  ]);
  expect(creado.status(), await creado.text()).toBe(201);
  grupoNuevo = ((await creado.json()) as { id: string }).id;

  await expect(page).toHaveURL(new RegExp(`/my-medical-groups/${grupoNuevo}$`));
  await expect(page.getByTestId('medical-group-status')).toContainText('Esperando al equipo');

  // Recargar: lo que se ve es lo que la base guardó.
  await page.reload();
  await estable(page);
  await expect(page.getByTestId('medical-group-status')).toContainText('Esperando al equipo');
  await expect(
    page.getByTestId('medical-group-member').filter({ hasText: 'Anestesiólogo' }),
  ).toContainText('Luis Rojas');
  await expect(page.getByText('Pago acordado: Bs 1.500,00')).toBeVisible();
  await capturar(page, 'consulta-creadora-1280');

  await irA(page, '/my-medical-groups?tab=enviadas');
  await estable(page);
  await expect(page.getByTestId('medical-group-open')).toHaveCount(1);
});

test('la invitada lo ve en Recibidas, acepta, y el grupo queda programado', async ({ page }) => {
  await como(page, escenario.invitada);
  await irA(page, '/my-medical-groups?tab=recibidas');
  await estable(page);
  await expect(page.getByRole('tab', { name: 'Solicitudes recibidas' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.getByTestId('medical-group-open').first().click();
  await expect(page.getByTestId('medical-group-accept')).toBeVisible();
  await capturar(page, 'consulta-invitada-pendiente-1280');

  const [respuesta] = await Promise.all([
    page.waitForResponse((r) => r.url().includes(`/medical-groups/${grupoNuevo}/members/`)),
    page.getByTestId('medical-group-accept').click(),
  ]);
  expect(respuesta.status(), await respuesta.text()).toBe(201);

  await page.reload();
  await estable(page);
  await expect(page.getByTestId('medical-group-status')).toContainText('Programado');
  await expect(page.getByTestId('medical-group-accept')).toHaveCount(0);
});

test('la invitada pide cambio de horario; la creadora lo acepta y vuelve a programado', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await como(page, escenario.invitada);
  await irA(page, `/my-medical-groups/${grupoNuevo}`);
  await estable(page);
  await page.getByTestId('medical-group-request-reschedule').click();
  const dialogo = page.getByRole('dialog', { name: 'Solicitar cambio de horario' });
  await expect(dialogo).toBeVisible();
  const propuesta = new Date(Date.now() + 9 * DIA_MS);
  await escribirFecha(page, 'app-content-dialog', propuesta);
  await capturar(page, 'modal-cambio-de-horario-1280');
  const [pedido] = await Promise.all([
    page.waitForResponse((r) =>
      r.url().endsWith(`/medical-groups/${grupoNuevo}/reschedule-requests`),
    ),
    page.getByTestId('medical-group-send-reschedule').click(),
  ]);
  expect(pedido.status(), await pedido.text()).toBe(201);
  await expect(page.getByTestId('medical-group-status')).toContainText(
    'Cambio de horario por confirmar',
  );

  await como(page, escenario.creadora);
  await irA(page, `/my-medical-groups/${grupoNuevo}`);
  await estable(page);
  const [respuesta] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/reschedule-requests/respond')),
    page.getByTestId('medical-group-accept-reschedule').click(),
  ]);
  expect(respuesta.status(), await respuesta.text()).toBe(201);
  const grupo = (await respuesta.json()) as { status: string; scheduledAt: string };
  expect(grupo.status).toBe('SCHEDULED');
  expect(new Date(grupo.scheduledAt).getDate()).toBe(propuesta.getDate());

  await page.reload();
  await estable(page);
  await expect(page.getByTestId('medical-group-status')).toContainText('Programado');
});

test('realizado y dentro de la semana: las notas del ejercicio se guardan y persisten', async ({
  page,
}) => {
  await como(page, escenario.creadora);
  await irA(page, `/my-medical-groups/${escenario.grupoConNotas}`);
  await estable(page);
  await page
    .locator('.consulta__notas app-textarea textarea')
    .fill('Procedimiento sin complicaciones.');
  const [guardado] = await Promise.all([
    page.waitForResponse((r) =>
      r.url().endsWith(`/medical-groups/${escenario.grupoConNotas}/exercise-notes`),
    ),
    page.getByTestId('medical-group-save-notes').click(),
  ]);
  expect(guardado.status(), await guardado.text()).toBe(200);

  await page.reload();
  await estable(page);
  await expect(page.locator('.consulta__notas app-textarea textarea')).toHaveValue(
    'Procedimiento sin complicaciones.',
  );
});

test('pasada la semana: el expediente está cerrado y la API no deja mutarlo', async ({ page }) => {
  await como(page, escenario.creadora);
  await irA(page, `/my-medical-groups/${escenario.grupoCerrado}`);
  await estable(page);
  await expect(page.getByTestId('medical-group-status')).toContainText('Cerrado');
  await expect(page.getByTestId('medical-group-closed')).toBeVisible();
  await expect(page.getByTestId('medical-group-save-notes')).toHaveCount(0);
  await capturar(page, 'consulta-cerrada-1280');

  // La UI no es la barrera: se intenta directo contra la API.
  const tokenCreadora = await token(escenario.creadora.identificador, escenario.creadora.clave);
  const mutacion = await api.patch(`/medical-groups/${escenario.grupoCerrado}/exercise-notes`, {
    headers: { Authorization: `Bearer ${tokenCreadora}` },
    data: { notesText: 'Intento de corregir un expediente cerrado.' },
  });
  expect(mutacion.status(), 'un expediente cerrado no admite notas').toBeGreaterThanOrEqual(400);
  expect(mutacion.status()).toBeLessThan(500);
});

test('en el teléfono: listado y consulta sin desborde horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await como(page, escenario.creadora);
  for (const [ruta, nombre] of [
    ['/my-medical-groups', 'listado-390'],
    [`/my-medical-groups/${grupoNuevo}`, 'consulta-390'],
    ['/my-medical-groups/new', 'formulario-390'],
  ] as const) {
    await irA(page, ruta);
    await estable(page);
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, `${ruta}: hay scroll horizontal`).toBeLessThanOrEqual(clientWidth);
    await capturar(page, nombre);
  }
});
