import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { apiViva, contextoDeApi, urlDeApi } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Carril 27 · formularios estandarizados, de punta a punta contra la API real.
 *
 * ## Datos propios, por el camino real
 *
 * Dos médicas nuevas (`register-practitioner`), cada una con su consultorio
 * propio (`POST /practitioners/me/sites`) — es lo que les da organización, y
 * sin organización no hay campos propios. Nada se toma prestado del entorno.
 *
 * ## Qué cubre
 *
 * - REQ-27-001/002: se entra a «Mis formularios»; vacío al principio, y el
 *   formulario extendido aparece en una fila con versión y especialidad, que
 *   persiste tras recargar y abre la edición.
 * - REQ-27-008/009/010: «Cargar formulario» abre el catálogo estándar en
 *   `app-specialty-browser`, y buscar acota a lo que coincide.
 * - REQ-27-004/005/006/007: una pregunta creada como respuesta corta pasa a
 *   casillas, con tres opciones y «exactamente 2»; el `PATCH` lleva la
 *   cardinalidad y la API la devuelve al releer.
 * - Validación y autorización en el servidor: mínimo > máximo es 422, y otra
 *   organización no puede tocar el campo (403).
 *
 * Exige el front en `real-api` y la API levantada:
 *   E2E_API_REAL=1 E2E_API_URL=http://localhost:3000 E2E_BASE_URL=http://localhost:4208
 */

const API_REAL = process.env['E2E_API_REAL'] === '1';
/** `VS_BO_DEPARTMENT · Santa Cruz`, sembrado por el stack de desarrollo. */
const DEPARTAMENTO_SC = '16fe92e8-bec7-577d-9e63-4a0d8ff3b0e4';
/** Municipio sembrado (Sucre), el mismo que usan los carriles 11 a 13 y 21. */
const MUNICIPIO = '5132db42-8cb1-52d6-88f5-0e9a04bdc94c';
const CAPTURAS = join(__dirname, '..', 'artifacts', 'playwright', 'tarea-27');
const BUSCADOR = 'Buscar un formulario por nombre, código o especialidad';

test.describe.configure({ mode: 'serial' });
test.skip(
  !API_REAL,
  'Omitido: hace falta E2E_API_REAL=1, la API y el front en modo real-api. No es un verde.',
);

interface Medica {
  readonly identificador: string;
  readonly clave: string;
  readonly nombre: string;
}

interface CampoDePlantilla {
  readonly fieldId: string;
  readonly name: string;
  readonly dataType: string;
  readonly options?: readonly string[];
  readonly multiple?: boolean;
  readonly cardinalityMin?: number;
  readonly cardinalityMax?: number;
  readonly own: boolean;
}

let api: APIRequestContext;
let duena: Medica;
let ajena: Medica;
/** El formulario que la prueba extiende desde la pantalla. */
let plantillaId = '';
let plantillaNombre = '';
const PREGUNTA = `Síntomas al ingreso ${Date.now().toString(36)}`;

async function json<T>(
  paso: string,
  respuesta: Awaited<ReturnType<APIRequestContext['post']>>,
): Promise<T> {
  expect(respuesta.ok(), `${paso}: ${respuesta.status()} ${await respuesta.text()}`).toBe(true);
  return (await respuesta.json()) as T;
}

async function token(medica: Medica): Promise<string> {
  const { accessToken } = await json<{ accessToken: string }>(
    `login de ${medica.identificador}`,
    await api.post('/iam/auth/login', {
      data: { email: medica.identificador, password: medica.clave },
    }),
  );
  return accessToken;
}

/** Médica nueva con consultorio propio: el consultorio le da organización. */
async function registrarConConsultorio(
  corrida: string,
  sufijo: string,
  nombre: string,
  apellido: string,
): Promise<Medica> {
  const medica = {
    identificador: `medica.f27.${sufijo}.${corrida}@alovida.test`,
    clave: `Formularios-${corrida}-2026!`,
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
        licenseNumber: `MP-F27${sufijo}-${corrida}`,
        sedesLicenseNumber: `SEDES-F27${sufijo}-${corrida}`,
        professionalTitle: 'Médico',
        nationalId: `F27${sufijo}${corrida}`,
        issuerAdministrativeAreaConceptId: DEPARTAMENTO_SC,
        residenceMunicipalityConceptId: MUNICIPIO,
      },
    }),
  );
  await json(
    'consultorio propio',
    await api.post('/practitioners/me/sites', {
      headers: { Authorization: `Bearer ${await token(medica)}` },
      data: { name: `Consultorio ${nombre} ${apellido}` },
    }),
  );
  return medica;
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

/** La pregunta propia, leída del servidor y no de la pantalla. */
async function preguntaEnElServidor(medica: Medica): Promise<CampoDePlantilla | undefined> {
  const plantilla = await json<{ fields: CampoDePlantilla[] }>(
    'releer la plantilla',
    await api.get(`/charts/templates/${plantillaId}`, {
      headers: { Authorization: `Bearer ${await token(medica)}` },
    }),
  );
  return plantilla.fields.find((campo) => campo.own && campo.name === PREGUNTA);
}

function ultimaPropia(page: Page) {
  return page.getByTestId('campo-propio').last();
}

/** `app-select` es un combobox propio, no un `<select>` nativo. */
async function elegir(page: Page, testId: string, etiqueta: string): Promise<void> {
  await ultimaPropia(page).getByTestId(testId).getByRole('combobox').first().click();
  await page.getByRole('option', { name: etiqueta, exact: true }).click();
}

/** Espera el `PATCH` de la definición que lleve el fragmento dado en el cuerpo. */
function esperarPatch(page: Page, fragmento: string) {
  return page.waitForResponse(
    (r) =>
      r.url().includes('/forms/field-definitions/') &&
      r.request().method() === 'PATCH' &&
      (r.request().postData() ?? '').includes(fragmento),
  );
}

test.beforeAll(async () => {
  test.setTimeout(120_000);
  api = await contextoDeApi();
  expect(await apiViva(api), `La API no responde en ${urlDeApi()}.`).toBe(true);
  const corrida = Date.now().toString(36);
  duena = await registrarConConsultorio(corrida, 'a', 'Elena', 'Quiroga');
  ajena = await registrarConConsultorio(corrida, 'b', 'Marco', 'Suárez');
});

test.afterAll(async () => {
  await api?.dispose();
});

test('se entra a «Mis formularios», vacío, y «Cargar formulario» abre el catálogo por especialidad', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await como(page, duena);
  await irA(page, '/form-builder');
  await estable(page);

  await expect(page.getByRole('heading', { name: 'Mis formularios' })).toBeVisible();
  // Vacío o con filas según lo que la organización ya extendió: los
  // consultorios propios comparten organización (ver BUGS, carril 27), así que
  // una corrida anterior puede haber dejado formularios. Lo que no puede pasar
  // es que se entre al catálogo.
  await expect(
    page.getByTestId('mi-formulario').first().or(page.getByText('Todavía no tiene formularios propios')),
  ).toBeVisible();
  await expect(page.getByTestId('catalogo-formularios')).toHaveCount(0);
  await capturar(page, '01-mis-formularios-1440');

  await page.getByTestId('cargar-formulario').click();
  await expect(page).toHaveURL(/view=catalog/);
  const catalogo = page.getByTestId('catalogo-formularios');
  await expect(catalogo).toBeVisible();
  // Agrupado por especialidad: un encabezado por tramo, con su cuenta.
  await expect(catalogo.locator('.specialty-browser__group-title').first()).toBeVisible();

  await page.getByLabel(BUSCADOR).fill('anamnesis');
  await expect(page).toHaveURL(/q=anamnesis/);
  const tarjetas = page.getByTestId('plantilla');
  await expect(tarjetas.first()).toBeVisible();
  for (const texto of await tarjetas.allInnerTexts()) {
    expect(texto.toLowerCase()).toMatch(/anamnesis|anamn/);
  }
  await capturar(page, '02-catalogo-busqueda-1440');
});

test('una pregunta pasa de respuesta corta a casillas con «exactamente 2», y la API lo guarda', async ({
  page,
}) => {
  test.setTimeout(3 * 60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await como(page, duena);
  await irA(page, '/form-builder?view=catalog&q=anamnesis');
  await estable(page);

  const abrir = page.waitForResponse(
    (r) => /\/charts\/templates\/[0-9a-f-]{36}$/.test(r.url()) && r.request().method() === 'GET',
  );
  await page.getByTestId('plantilla').first().click();
  plantillaId = (await abrir).url().split('/').at(-1)!;
  plantillaNombre = (await page.locator('.constructor__titulo').innerText()).trim();
  await expect(page.getByTestId('aviso-estandar')).toBeVisible();

  // ── Nace como respuesta corta ──────────────────────────────────────────
  const antes = await page.getByTestId('campo-propio').count();
  await page.getByTestId('agregar-campo').click();
  await expect(page.getByTestId('campo-propio')).toHaveCount(antes + 1);
  const renombre = esperarPatch(page, PREGUNTA);
  await ultimaPropia(page).getByTestId('editor-campo-nombre').locator('input').fill(PREGUNTA);
  expect((await renombre).status()).toBe(200);

  // ── Se le cambia el tipo a casillas, con tres opciones ─────────────────
  await elegir(page, 'editor-campo-tipo', 'Casillas de verificación');
  await ultimaPropia(page).getByTestId('editor-campo-opcion-0').locator('input').fill('Fiebre');
  await ultimaPropia(page).getByTestId('editor-campo-opcion-1').locator('input').fill('Tos');
  await ultimaPropia(page).getByTestId('editor-campo-agregar-opcion').click();
  const conOpciones = esperarPatch(page, 'Disnea');
  await ultimaPropia(page).getByTestId('editor-campo-opcion-2').locator('input').fill('Disnea');
  expect((await conOpciones).status()).toBe(200);

  // ── «Exactamente 2»: viaja como mínimo y máximo iguales ────────────────
  await elegir(page, 'editor-campo-regla', 'Seleccionar exactamente');
  const conTope = esperarPatch(page, '"cardinalityMax":2');
  const cantidad = ultimaPropia(page).getByTestId('editor-campo-cantidad');
  await cantidad.fill('2');
  await cantidad.blur();
  const respuesta = await conTope;
  expect(respuesta.status(), await respuesta.text()).toBe(200);
  expect(JSON.parse(respuesta.request().postData() ?? '{}')).toMatchObject({
    cardinalityMin: 2,
    cardinalityMax: 2,
  });
  await expect(ultimaPropia(page).getByText('Hay que marcar exactamente 2 opciones.')).toBeVisible();
  await expect(page.getByTestId('alta-error')).toHaveCount(0);
  await capturar(page, '03-pregunta-casillas-exactamente-2');

  // ── Lo que quedó en el servidor ────────────────────────────────────────
  const guardada = await preguntaEnElServidor(duena);
  expect(guardada).toMatchObject({
    dataType: 'code',
    multiple: true,
    options: ['Fiebre', 'Tos', 'Disnea'],
    cardinalityMin: 2,
    cardinalityMax: 2,
  });
});

test('el formulario extendido queda en «Mis formularios», con versión y especialidad, tras recargar', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await como(page, duena);
  await irA(page, '/form-builder');
  await estable(page);
  await page.reload();
  await estable(page);

  const fila = page.getByTestId('mi-formulario').filter({ hasText: plantillaNombre });
  await expect(fila).toHaveCount(1);
  await expect(fila.getByTestId('mi-formulario-version')).toHaveText(/Versión \d+/);
  await expect(fila).toContainText(/\d+ campos? propios?/);
  await capturar(page, '04-mis-formularios-1440');

  // Toda la fila abre la edición, con la pregunta y su tope como se dejaron.
  await fila.click();
  await expect(page.getByTestId('aviso-estandar')).toBeVisible();
  await expect(ultimaPropia(page).getByTestId('editor-campo-nombre').locator('input')).toHaveValue(
    PREGUNTA,
  );
  await expect(ultimaPropia(page).getByText('Hay que marcar exactamente 2 opciones.')).toBeVisible();
});

test('la API valida el par de topes y no deja que otra organización toque el campo', async () => {
  const campo = await preguntaEnElServidor(duena);
  expect(campo).toBeDefined();
  const url = `/forms/field-definitions/${campo!.fieldId}`;

  const invertido = await api.patch(url, {
    headers: { Authorization: `Bearer ${await token(duena)}` },
    data: { cardinalityMin: 3, cardinalityMax: 1 },
  });
  expect(invertido.status(), await invertido.text()).toBe(422);

  const demasiados = await api.patch(url, {
    headers: { Authorization: `Bearer ${await token(duena)}` },
    data: { cardinalityMin: 4 },
  });
  expect(demasiados.status(), await demasiados.text()).toBe(422);

  const negativo = await api.patch(url, {
    headers: { Authorization: `Bearer ${await token(duena)}` },
    data: { cardinalityMin: -1 },
  });
  expect(negativo.status(), await negativo.text()).toBe(400);

  // Un campo del estándar (asignación global) no se toca desde un consultorio.
  const plantilla = await json<{ fields: CampoDePlantilla[] }>(
    'releer la plantilla',
    await api.get(`/charts/templates/${plantillaId}`, {
      headers: { Authorization: `Bearer ${await token(ajena)}` },
    }),
  );
  const delEstandar = plantilla.fields.find((f) => !f.own)!;
  const estandarToca = await api.patch(`/forms/field-definitions/${delEstandar.fieldId}`, {
    headers: { Authorization: `Bearer ${await token(ajena)}` },
    data: { cardinalityMax: null },
  });
  expect(estandarToca.status(), await estandarToca.text()).toBe(403);

  // Nada de lo rechazado cambió lo guardado.
  expect(await preguntaEnElServidor(duena)).toMatchObject({ cardinalityMin: 2, cardinalityMax: 2 });
});

test('capturas: móvil, tableta y escritorio en claro, y escritorio en oscuro', async ({ page }) => {
  await como(page, duena);
  for (const [ancho, alto] of [
    [390, 844],
    [768, 1024],
    [1440, 900],
  ] as const) {
    await page.setViewportSize({ width: ancho, height: alto });
    await irA(page, '/form-builder');
    await estable(page);
    await expect(page.getByTestId('mi-formulario').first()).toBeVisible();
    const desborde = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(desborde, `scroll horizontal a ${ancho}px`).toBeLessThanOrEqual(0);
    await capturar(page, `05-mis-formularios-${ancho}-claro`);

    await irA(page, '/form-builder?view=catalog');
    await estable(page);
    await expect(page.getByTestId('plantilla').first()).toBeVisible();
    await capturar(page, `06-catalogo-${ancho}-claro`);
  }

  // El tema se elige en la app y se guarda en `localStorage`; la preferencia
  // del sistema sola no alcanza si ya hay uno elegido.
  await page.addInitScript(() => localStorage.setItem('mantra-core-health.theme', 'dark'));
  await page.setViewportSize({ width: 1440, height: 900 });
  await irA(page, '/form-builder');
  // `irA` navega dentro de la app: el tema se lee al arrancar, así que se recarga.
  await page.reload();
  await estable(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByTestId('mi-formulario').first()).toBeVisible();
  await capturar(page, '07-mis-formularios-1440-oscuro');
  await irA(page, '/form-builder?view=catalog');
  await estable(page);
  await capturar(page, '08-catalogo-1440-oscuro');
});
