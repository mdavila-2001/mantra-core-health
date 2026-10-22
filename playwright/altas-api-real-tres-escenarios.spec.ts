import { expect, request, test, type Page, type Response } from '@playwright/test';

import { urlDeApi } from './support/actores';
import { elegirLocalidadDeResidencia } from './support/registro-paciente';

/**
 * Las altas públicas contra la **API real**, en tres escenarios cada una:
 * **aceptado**, **al límite** y **error** (03/10/2026).
 *
 * - Aceptado: el `POST` responde 201, la pantalla dice éxito y un login nuevo,
 *   fuera del navegador, entra con la cuenta recién creada.
 * - Límite: valores en el borde exacto que el DTO del backend acepta
 *   (contraseña de 8, documento de 4, matrícula de 1 carácter).
 * - Error: un duplicado que el backend rechaza (409) y que la pantalla
 *   muestra, sin pantalla de éxito.
 *
 * Exige el front en `start:real-api` y la API levantada:
 *
 *   E2E_API_REAL=1 E2E_API_URL=http://localhost:3000 E2E_BASE_URL=http://localhost:4289
 *
 * Las rutas de alta tienen límite de peticiones por IP: entre envíos se
 * espera lo que pide el limitador, a propósito, en vez de desactivarlo.
 */

const API_REAL = process.env['E2E_API_REAL'] === '1';
const RUN = Date.now().toString(36).toUpperCase();
const TITULO = '.paginated-form__titulo';
const PAUSA_DEL_LIMITADOR_MS = 7_000;

test.describe.configure({ mode: 'serial' });
test.skip(!API_REAL, 'Omitido: hace falta E2E_API_REAL=1 con la API y el front en modo real-api. No es un verde.');
test.setTimeout(180_000);

async function continuar(page: Page): Promise<void> {
  // El último: el mini-asistente del nombre trae su propio «continuar» adentro.
  const boton = page.getByTestId('paginated-form-continuar').last();
  await expect(boton).toBeEnabled({ timeout: 20_000 });
  await boton.click();
}

async function enLaPagina(page: Page, titulo: string): Promise<void> {
  await expect(page.locator(TITULO).first()).toContainText(titulo, { timeout: 20_000 });
}

async function continuarHasta(page: Page, titulo: string): Promise<void> {
  for (let intento = 0; intento < 8; intento++) {
    const actual = (await page.locator(TITULO).first().textContent())?.trim() ?? '';
    if (actual.includes(titulo)) return;
    await continuar(page);
    await expect(page.locator(TITULO).first()).not.toHaveText(actual, { timeout: 20_000 });
  }
  await enLaPagina(page, titulo);
}

/** Envía la última página y devuelve la respuesta del `POST` de alta. */
async function enviar(page: Page, ruta: string): Promise<Response> {
  // El limitador de las rutas de alta es por IP; respetarlo es parte del escenario real.
  await page.waitForTimeout(PAUSA_DEL_LIMITADOR_MS);
  const respuesta = page.waitForResponse(
    (r) => r.url().includes(ruta) && r.request().method() === 'POST',
    { timeout: 30_000 },
  );
  await continuar(page);
  return respuesta;
}

/**
 * Nombre desglosado. En `test`, `app-name-fields` es un mini-asistente
 * («Nombres» → «Apellidos») con su propio «Siguiente»: si el apellido no está
 * a la vista, se avanza dentro del componente, no del formulario.
 */
async function escribirNombre(page: Page, prefijo: string, nombre: string, apellido: string): Promise<void> {
  const primerNombre = page.getByTestId(`${prefijo}-nombre`);
  await primerNombre.fill(nombre);
  const apellidoPaterno = page.getByTestId(`${prefijo}-apellido-paterno`);
  if (!(await apellidoPaterno.isVisible())) {
    await page
      .locator('app-name-fields')
      .filter({ has: primerNombre })
      .getByRole('button', { name: 'Siguiente', exact: true })
      .click();
  }
  await apellidoPaterno.fill(apellido);
}

/** Login real, fuera del navegador: prueba que la cuenta quedó en la base. */
async function loginReal(credenciales: Record<string, string>): Promise<number> {
  const api = await request.newContext({ baseURL: urlDeApi() });
  try {
    const r = await api.post('/iam/auth/login', { data: credenciales });
    return r.status();
  } finally {
    await api.dispose();
  }
}

/* ---------------------------------------------------------------- paciente */

interface DatosPaciente {
  readonly documento: string;
  readonly correo: string;
  readonly password: string;
}

async function altaPaciente(page: Page, datos: DatosPaciente): Promise<Response> {
  await page.goto('/auth/register/patient', { waitUntil: 'domcontentloaded' });
  await escribirNombre(page, 'registro', 'Lucía', 'Mamani');
  await continuar(page);
  await enLaPagina(page, 'Su documento');
  await page.getByTestId('registro-documento').fill(datos.documento);
  const depto = page.getByTestId('registro-departamento-ci').locator('select');
  await expect(depto.locator('option').nth(1)).toBeAttached({ timeout: 20_000 });
  await depto.selectOption({ index: 1 });
  await continuar(page);
  await enLaPagina(page, 'Cuéntenos');
  const fecha = page.getByPlaceholder('DD/MM/AAAA');
  await fecha.click();
  await page.keyboard.type('15031988', { delay: 60 });
  await expect(fecha).toHaveValue('15/03/1988');
  await page.getByTestId('registro-genero').locator('select').selectOption({ index: 1 });
  await continuar(page);
  await enLaPagina(page, 'contactamos');
  await page.getByTestId('registro-telefono').fill('70012345');
  await continuar(page);
  await enLaPagina(page, 'Dónde vive');
  await elegirLocalidadDeResidencia(page);
  await continuarHasta(page, 'Su acceso');
  await page.getByTestId('registro-correo').fill(datos.correo);
  await page.getByTestId('registro-password').fill(datos.password);
  await continuarHasta(page, 'Datos de facturación');
  return enviar(page, '/iam/auth/register-patient');
}

test.describe('paciente', () => {
  const documento = `PAC${RUN}`;

  test('aceptado: 201, pantalla de éxito y login con el documento', async ({ page }) => {
    const datos = { documento, correo: `paciente.${RUN}@alovida.test`.toLowerCase(), password: 'Paciente-2026!' };
    const r = await altaPaciente(page, datos);
    expect(r.status(), await r.text()).toBe(201);
    await expect(page.getByTestId('registro-exito')).toBeVisible({ timeout: 20_000 });
    expect(await loginReal({ nationalId: datos.documento, password: datos.password })).toBe(200);
  });

  test('límite: documento de 4 caracteres y contraseña de 8 se aceptan', async ({ page }) => {
    const datos = {
      documento: RUN.slice(-4),
      correo: `paciente.limite.${RUN}@alovida.test`.toLowerCase(),
      password: '12345678',
    };
    const r = await altaPaciente(page, datos);
    expect(r.status(), await r.text()).toBe(201);
    await expect(page.getByTestId('registro-exito')).toBeVisible({ timeout: 20_000 });
    expect(await loginReal({ nationalId: datos.documento, password: datos.password })).toBe(200);
  });

  test('error: el mismo documento otra vez lo rechaza el backend y la pantalla lo dice', async ({ page }) => {
    const r = await altaPaciente(page, {
      documento,
      correo: `paciente.dup.${RUN}@alovida.test`.toLowerCase(),
      password: 'Paciente-2026!',
    });
    expect(r.status(), await r.text()).toBe(409);
    // El catálogo explica qué dato está repetido y qué hacer; nada del texto técnico.
    await expect(page.getByTestId('registro-error')).toContainText(
      'Ya hay una cuenta registrada con este número de documento',
    );
    await expect(page.getByTestId('registro-error')).toContainText('inicie sesión');
    await expect(page.getByTestId('registro-exito')).toHaveCount(0);
  });

  // El paciente entra con su documento: el correo es opcional y no es su usuario,
  // y la recuperación de contraseña busca por documento. Una familia puede
  // compartir el correo (diseño de `IamPatientSelfRegistrationService`).
  test('límite: el mismo correo con otro documento se acepta (el usuario del paciente es su documento)', async ({ page }) => {
    const r = await altaPaciente(page, {
      documento: `PCO${RUN}`,
      correo: `paciente.${RUN}@alovida.test`.toLowerCase(),
      password: 'Paciente-2026!',
    });
    expect(r.status(), await r.text()).toBe(201);
    await expect(page.getByTestId('registro-exito')).toBeVisible({ timeout: 20_000 });
  });
});

/* ------------------------------------------------------------------ médico */

interface DatosMedico {
  readonly documento: string;
  readonly correo: string;
  readonly matricula: string;
  /** Registro del SEDES: obligatorio en «Tu habilitación para ejercer». */
  readonly sedes: string;
  readonly password: string;
}

async function altaMedico(page: Page, datos: DatosMedico): Promise<Response> {
  await page.goto('/auth/register/practitioner', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('registro-pro-nombre').fill('Ana');
  await page.getByTestId('registro-pro-apellido-paterno').fill('Paz');
  await continuar(page);
  await enLaPagina(page, 'Su documento');
  await page.getByTestId('registro-pro-documento').fill(datos.documento);
  const depto = page.getByTestId('registro-pro-departamento-ci').locator('select');
  await expect(depto.locator('option').nth(1)).toBeAttached({ timeout: 20_000 });
  await depto.selectOption({ index: 1 });
  await continuar(page);
  await enLaPagina(page, 'Cuéntenos');
  await page.getByTestId('registration-practitioner-sex').locator('select').selectOption({ index: 1 });
  const fecha = page.getByPlaceholder('DD/MM/AAAA');
  await fecha.click();
  await page.keyboard.type('12051985', { delay: 60 });
  await expect(fecha).toHaveValue('12/05/1985');
  await continuar(page);
  await enLaPagina(page, 'Cómo le contactamos en privado');
  await page.getByTestId('registro-pro-celular-personal').fill('70012345');
  await page.getByTestId('registro-pro-correo-personal').fill(datos.correo);
  await continuarHasta(page, 'Su título profesional');
  await page.getByTestId('registro-pro-titulo').getByRole('combobox').fill('Médico');
  await page.getByRole('option').first().click();
  await continuar(page);
  await enLaPagina(page, 'Su habilitación');
  await page.getByTestId('registro-pro-matricula').fill(datos.matricula);
  await page.getByTestId('registro-pro-credencial').fill(datos.sedes);
  await continuarHasta(page, 'Su contraseña');
  await page.getByTestId('registro-pro-password').fill(datos.password);
  return enviar(page, '/iam/auth/register-practitioner');
}

test.describe('médico', () => {
  const correo = `medico.${RUN}@alovida.test`.toLowerCase();

  test('aceptado: 201, pantalla de éxito y login con el correo', async ({ page }) => {
    const datos = { documento: `MED${RUN}`, correo, matricula: `MP-${RUN}`, sedes: `T.I. ${RUN}`, password: 'Medico-2026!' };
    const r = await altaMedico(page, datos);
    expect(r.status(), await r.text()).toBe(201);
    await expect(page.getByTestId('registro-exito')).toBeVisible({ timeout: 20_000 });
    expect(await loginReal({ email: datos.correo, password: datos.password })).toBe(200);
  });

  test('límite: matrícula y SEDES de 1 carácter y contraseña de 8 se aceptan', async ({ page }) => {
    const datos = {
      documento: `MEL${RUN}`,
      correo: `medico.limite.${RUN}@alovida.test`.toLowerCase(),
      matricula: 'X',
      sedes: 'Y',
      password: '12345678',
    };
    const r = await altaMedico(page, datos);
    expect(r.status(), await r.text()).toBe(201);
    await expect(page.getByTestId('registro-exito')).toBeVisible({ timeout: 20_000 });
  });

  test('error: el mismo correo otra vez lo rechaza el backend y la pantalla lo dice', async ({ page }) => {
    const r = await altaMedico(page, { documento: `MDU${RUN}`, correo, matricula: `MP-D${RUN}`, sedes: `T.I. D${RUN}`, password: 'Medico-2026!' });
    expect(r.status(), await r.text()).toBe(409);
    await expect(page.getByTestId('registro-error')).toContainText(
      'Ya hay una cuenta registrada con este correo electrónico',
    );
    await expect(page.getByTestId('registro-error')).toContainText('¿Olvidó su contraseña?');
    await expect(page.getByTestId('registro-exito')).toHaveCount(0);
  });
});

/* ------------------------------------------ farmacia, laboratorio, imagen */

interface Organizacion {
  readonly nombre: string;
  readonly ruta: string;
  readonly prefijo: string;
  readonly exito: string;
  readonly error: string;
  /** El selector del poder notariado (obligatorio salvo unipersonal). */
  readonly poder: { readonly testId: string; readonly quitar: string };
  /** Lo que la organización exige antes de «Dónde está la central». */
  readonly antesDeLaCentral: (page: Page) => Promise<void>;
}

/** Sube un PDF a un selector cuyo `testId` cae en el host o en el `<input>`. */
async function subirPdf(page: Page, testId: string, nombre: string): Promise<void> {
  const { pdfDePrueba } = await import('./helpers/documentos-legales');
  await page
    .locator(`[data-testid="${testId}"] input[type="file"], input[type="file"][data-testid="${testId}"]`)
    .first()
    .setInputFiles(pdfDePrueba(nombre));
}

async function papelesDeImagen(page: Page): Promise<void> {
  await enLaPagina(page, 'Qué estudios hace');
  await page.getByTestId('registro-imagen-modalidades').getByText('Ecografía', { exact: true }).click();
  await continuar(page);
  await enLaPagina(page, 'Los papeles de la empresa');
  const { pdfDePrueba } = await import('./helpers/documentos-legales');
  // Los obligatorios de la rama: SEPREC, licencia, SEDES y NIT.
  for (const clave of ['seprecFile', 'licenciaFile', 'sedesFile', 'nitFile']) {
    await page
      .locator(`[data-testid="registro-imagen-adjunto-${clave}"] input[type="file"], input[type="file"][data-testid="registro-imagen-adjunto-${clave}"]`)
      .first()
      .setInputFiles(pdfDePrueba(clave));
    await expect(page.getByTestId(`registro-imagen-quitar-${clave}`)).toBeVisible({ timeout: 15_000 });
  }
  await continuar(page);
  // Obligatoria salvo unipersonal; se adjunta siempre, después de que la página exista.
  await enLaPagina(page, 'Constitución');
  await subirPdf(page, 'registro-imagen-adjunto-constitucionFile', 'constitucion');
  await expect(page.getByTestId('registro-imagen-quitar-constitucionFile')).toBeVisible({ timeout: 15_000 });
}

const ORGANIZACIONES: readonly Organizacion[] = [
  {
    nombre: 'farmacia',
    ruta: '/auth/register/pharmacy',
    prefijo: 'registro-farmacia',
    exito: 'registro-farmacia-exito',
    error: 'registro-farmacia-error',
    poder: { testId: 'registro-farmacia-doc-powerOfAttorneyFileId', quitar: 'registro-farmacia-doc-powerOfAttorneyFileId-quitar' },
    antesDeLaCentral: async () => undefined,
  },
  {
    nombre: 'laboratorio',
    ruta: '/auth/register/laboratory',
    prefijo: 'registro-lab',
    exito: 'registro-lab-exito',
    error: 'registro-lab-error',
    poder: { testId: 'registro-lab-doc-powerOfAttorneyFileId', quitar: 'registro-lab-doc-powerOfAttorneyFileId-quitar' },
    antesDeLaCentral: async () => undefined,
  },
  {
    nombre: 'imagenología',
    ruta: '/auth/register/imaging-center',
    prefijo: 'registro-imagen',
    exito: 'registro-imagen-exito',
    error: 'registro-error',
    poder: { testId: 'registro-imagen-adjunto-poderFile', quitar: 'registro-imagen-quitar-poderFile' },
    antesDeLaCentral: papelesDeImagen,
  },
];

async function altaOrganizacion(
  page: Page,
  org: Organizacion,
  datos: {
    razonSocial: string;
    nit: string;
    correo: string;
    password: string;
    documento?: string;
    /** `S.R.L.` por omisión; `Unipersonal` es el único que puede omitir el poder. */
    tipo?: 'S.R.L.' | 'Unipersonal';
  },
): Promise<Response> {
  await page.goto(org.ruta, { waitUntil: 'domcontentloaded' });
  await enLaPagina(page, 'La empresa');
  await page.getByTestId(`${org.prefijo}-razon-social`).fill(datos.razonSocial);
  await page.getByLabel('Tipo de sociedad').selectOption({ label: datos.tipo ?? 'S.R.L.' });
  await page.getByTestId(`${org.prefijo}-nit`).fill(datos.nit);
  await continuar(page);
  await org.antesDeLaCentral(page);
  await continuarHasta(page, 'Dónde está la central');
  await page.getByTestId(`${org.prefijo}-direccion`).fill('Av. Cañoto esq. Ballivián 234');
  await continuarHasta(page, 'Representante legal');
  await escribirNombre(page, `${org.prefijo}-representante`, 'Mariana', 'Siles');
  // La API exige el documento del representante (4 a 50 caracteres).
  await page.getByTestId(`${org.prefijo}-representante-documento`).fill(datos.documento ?? `CI${RUN}`);
  await page.getByTestId(`${org.prefijo}-representante-correo`).fill(datos.correo);
  if ((datos.tipo ?? 'S.R.L.') !== 'Unipersonal') {
    await subirPdf(page, org.poder.testId, 'poder-notariado');
    await expect(page.getByTestId(org.poder.quitar)).toBeVisible({ timeout: 15_000 });
  }
  await continuarHasta(page, 'Su acceso');
  await page.getByTestId(`${org.prefijo}-password`).fill(datos.password);
  return enviar(page, '/iam/auth/register-organization');
}

for (const org of ORGANIZACIONES) {
  test.describe(org.nombre, () => {
    const correo = `${org.prefijo}.${RUN}@alovida.test`.toLowerCase();

    test('aceptado: 201, pantalla de éxito y login con el correo del representante', async ({ page }) => {
      const datos = { razonSocial: `${org.nombre} ${RUN} S.R.L.`, nit: `10${Date.now() % 1e8}`, correo, password: 'Organizacion-26!' };
      const r = await altaOrganizacion(page, org, datos);
      expect(r.status(), await r.text()).toBe(201);
      await expect(page.getByTestId(org.exito)).toBeVisible({ timeout: 20_000 });
      expect(await loginReal({ email: datos.correo, password: datos.password })).toBe(200);
    });

    test('límite: unipersonal sin poder, CI de 4 caracteres y contraseña de 8 se aceptan', async ({ page }) => {
      const r = await altaOrganizacion(page, org, {
        razonSocial: `${org.nombre} límite ${RUN}`,
        nit: `20${Date.now() % 1e8}`,
        correo: `${org.prefijo}.limite.${RUN}@alovida.test`.toLowerCase(),
        password: '12345678',
        documento: RUN.slice(-4),
        tipo: 'Unipersonal',
      });
      expect(r.status(), await r.text()).toBe(201);
      await expect(page.getByTestId(org.exito)).toBeVisible({ timeout: 20_000 });
    });

    test('error: el mismo correo otra vez lo rechaza el backend y la pantalla lo dice', async ({ page }) => {
      const r = await altaOrganizacion(page, org, {
        razonSocial: `${org.nombre} duplicada ${RUN}`,
        nit: `30${Date.now() % 1e8}`,
        correo,
        password: 'Organizacion-26!',
      });
      expect(r.status(), await r.text()).toBe(409);
      await expect(page.getByTestId(org.error)).toContainText(
        'Ya hay una cuenta registrada con el correo del representante legal',
      );
      await expect(page.getByTestId(org.error)).toContainText('¿Olvidó su contraseña?');
      await page.screenshot({ path: `artifacts/errores-alta/${org.prefijo}-correo-repetido.png`, fullPage: true });
      await expect(page.getByTestId(org.exito)).toHaveCount(0);
    });
  });
}
