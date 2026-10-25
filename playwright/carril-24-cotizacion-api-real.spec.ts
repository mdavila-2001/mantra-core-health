import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { apiViva, contextoDeApi, urlDeApi } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Carril 24 · cotización, de punta a punta contra la API real.
 *
 * `planes-de-pago-flexibles.spec.ts` recorre el mismo formulario contra la
 * maqueta. Esta prueba demuestra lo que la maqueta no puede: que lo que la
 * pantalla arma es lo que la API guarda —precio, cuotas, fechas— y que el
 * plan cierra al centavo en los dos lados (criterio 12: cálculos
 * deterministas y consistentes entre frontend y backend).
 *
 * Los criterios 7–9 de la ficha (simulador con tasa de interés, plazo y
 * método de cálculo) **no se prueban porque se retiraron a propósito** el
 * 18/09/2026 (`303f13e42`): un consultorio reparte un precio en cuotas, no
 * presta dinero. La prueba fija que no reaparezcan.
 *
 * Datos propios por el camino real: médica con consultorio propio y un
 * servicio en su catálogo, y una paciente.
 *
 * Exige el front en `start:real-api` y la API levantada:
 *   E2E_API_REAL=1 E2E_API_URL=http://localhost:3000 E2E_BASE_URL=http://localhost:4200
 */

const API_REAL = process.env['E2E_API_REAL'] === '1';
const DEPARTAMENTO_SC = '16fe92e8-bec7-577d-9e63-4a0d8ff3b0e4';
const MUNICIPIO = '5132db42-8cb1-52d6-88f5-0e9a04bdc94c';
const PRECIO = '3000.00';

test.describe.configure({ mode: 'serial' });
test.skip(
  !API_REAL,
  'Omitido: hace falta E2E_API_REAL=1 con la API y el front en modo real-api. No es un verde.',
);

interface Escenario {
  readonly medica: { identificador: string; clave: string };
  readonly codigoServicio: string;
  readonly pacienteId: string;
}

let api: APIRequestContext;
let escenario: Escenario;

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

async function tokenDe(identificador: string, clave: string): Promise<string> {
  const { accessToken } = await json<{ accessToken: string }>(
    'login',
    await api.post('/iam/auth/login', { data: { email: identificador, password: clave } }),
  );
  return accessToken;
}

async function prepararEscenario(): Promise<Escenario> {
  const corrida = Date.now().toString(36);
  const clave = `Cotiza-${corrida}-2026!`;
  const medica = { identificador: `medica.c24.${corrida}@alovida.test`, clave };
  await json(
    'alta de la médica',
    await api.post('/iam/auth/register-practitioner', {
      data: {
        email: medica.identificador,
        password: clave,
        name: 'Carla',
        lastName: 'Suárez',
        licenseNumber: `MP-C24-${corrida}`,
        sedesLicenseNumber: `SEDES-C24-${corrida}`,
        professionalTitle: 'Médico',
        nationalId: `C24${corrida}`,
        issuerAdministrativeAreaConceptId: DEPARTAMENTO_SC,
        residenceMunicipalityConceptId: MUNICIPIO,
      },
    }),
  );
  const nationalId = `PC24${corrida}`;
  await json(
    'alta de la paciente',
    await api.post('/iam/auth/register-patient', {
      data: {
        nationalId,
        issuerAdministrativeAreaConceptId: DEPARTAMENTO_SC,
        residenceMunicipalityConceptId: MUNICIPIO,
        password: clave,
        email: `paciente.c24.${corrida}@alovida.test`,
        name: 'Elsa',
        lastName: 'Mamani',
        birthDate: '1980-02-11',
        phone: '70033333',
        sexAtBirth: 'FEMALE',
      },
    }),
  );
  const { accessToken: tokenPaciente } = await json<{ accessToken: string }>(
    'login de la paciente',
    await api.post('/iam/auth/login', { data: { nationalId, password: clave } }),
  );
  const { pid } = claims(tokenPaciente) as { pid?: string };

  await json(
    'consultorio propio',
    await api.post('/practitioners/me/sites', {
      headers: { Authorization: `Bearer ${await tokenDe(medica.identificador, clave)}` },
      data: { name: 'Consultorio Carla Suárez' },
    }),
  );
  const auth = { Authorization: `Bearer ${await tokenDe(medica.identificador, clave)}` };
  const [practica] = await json<{ id: string }[]>(
    'prácticas',
    await api.get('/practices', { headers: auth }),
  );
  // La médica sólo lee a quien atiende: sin un turno con la paciente, la API
  // responde 403 al leerla y el formulario no la puede preelegir. Es el
  // camino real: se llega a cotizar desde la consulta.
  const { tenants, hpid } = claims(auth.Authorization.slice(7)) as {
    tenants?: string[];
    hpid?: string;
  };
  const agenda = await json<{ id: string }>(
    'agenda de la médica',
    await api.post('/scheduling/resources', {
      headers: auth,
      data: {
        tenantId: tenants![0],
        resourceType: 'PRACTITIONER',
        resourceRefType: 'health_practitioner_profiles',
        resourceRefId: hpid,
        name: 'Consultorio Carla Suárez',
      },
    }),
  );
  // Un turno de HOY: la API deja leer a la paciente a quien la atiende hoy
  // (profiles-patients.controller, `assertCanReadHistory`). Uno de mañana no
  // alcanza.
  const hoy = new Date(Date.now() + 60 * 60 * 1000);
  hoy.setMinutes(hoy.getMinutes() < 30 ? 30 : 60, 0, 0);
  await json(
    'cita con la paciente',
    await api.post('/scheduling/appointments/direct', {
      headers: auth,
      data: {
        patientProfileId: pid,
        resourceId: agenda.id,
        startAt: hoy.toISOString(),
        durationMinutes: 30,
        reasonText: 'Evaluación de ortodoncia',
      },
    }),
  );

  const codigoServicio = `ORTO-${corrida}`;
  await json(
    'servicio del catálogo',
    await api.post('/billing/service-catalog', {
      headers: auth,
      data: {
        practiceId: practica!.id,
        code: codigoServicio,
        name: 'Tratamiento de ortodoncia',
        defaultPrice: PRECIO,
      },
    }),
  );
  return { medica, codigoServicio, pacienteId: pid! };
}

/** Escribe una fecha en un selector por segmentos, empezando por el día. */
async function escribirFecha(page: Page, etiqueta: string, ddmmaaaa: string): Promise<void> {
  const fecha = page.getByRole('textbox', { name: etiqueta });
  await fecha.focus();
  await fecha.evaluate((el: HTMLInputElement) => el.setSelectionRange(0, 2));
  await fecha.pressSequentially(ddmmaaaa);
  await fecha.blur();
}

function enDias(dias: number): { texto: string; iso: string } {
  const fecha = new Date(Date.now() + dias * 24 * 3600 * 1000);
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  return { texto: `${dd}${mm}${fecha.getFullYear()}`, iso: `${fecha.getFullYear()}-${mm}-${dd}` };
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

test('la cotización que arma la pantalla es la que guarda la API, y el plan cierra al centavo', async ({
  page,
}) => {
  test.setTimeout(150_000);
  await entrar(page, {
    rol: 'doctora',
    identificador: escenario.medica.identificador,
    clave: escenario.medica.clave,
    nombre: 'médica de la cotización',
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await irA(page, `/my-quotations/new?patient=${escenario.pacienteId}`);
  await estable(page);

  // Criterio 1: la paciente llega elegida.
  await expect(page.getByTestId('quotation-form-paciente-elegido')).toContainText('Elsa');
  // Criterios 7–9 retirados: ni tasa, ni método, ni simulador.
  await expect(page.getByText(/tasa de inter|m[eé]todo de c[aá]lculo|simulador/i)).toHaveCount(0);

  // Criterio 4: el servicio sale del catálogo.
  await page.getByLabel('Buscar servicio por código o nombre').fill(escenario.codigoServicio);
  await page.getByRole('button', { name: 'Elegir' }).first().click();
  await expect(page.getByTestId('quotation-form-servicio-elegido')).toContainText(
    'Tratamiento de ortodoncia',
  );
  // Criterio 5: el precio ofrecido entra prellenado con el de referencia.
  await expect(page.getByTestId('quotation-form-offered-price')).toHaveValue(PRECIO);

  // Criterio 2 y 11: fecha de atención y validez.
  const atencion = enDias(7);
  const validez = enDias(30);
  await escribirFecha(page, 'Fecha de atención', atencion.texto);
  await escribirFecha(page, 'Válida hasta', validez.texto);

  // Criterio 6: el plan se arma solo y cierra con el precio.
  const cuotas = page.getByRole('list', { name: 'Cuotas del plan' }).getByRole('listitem');
  await expect(cuotas.first()).toBeVisible();
  await expect(page.getByTestId('quotation-form-plan-mismatch')).toHaveCount(0);
  const cantidad = await cuotas.count();

  // Criterio 10: exportar descarga un PDF.
  const [descarga] = await Promise.all([
    page.waitForEvent('download'),
    page.getByTestId('quotation-form-export').click(),
  ]);
  expect(descarga.suggestedFilename()).toMatch(/\.pdf$/i);

  const [guardada] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/quotations') && r.request().method() === 'POST'),
    page.getByTestId('quotation-form-save').click(),
  ]);
  expect(guardada.status(), await guardada.text()).toBe(201);
  const { id } = (await guardada.json()) as { id: string };

  // Lo guardado, leído de vuelta: mismo precio, mismas cuotas, mismas fechas,
  // y la suma del plan igual al precio (anticipo + cuotas, en centavos).
  const token = await tokenDe(escenario.medica.identificador, escenario.medica.clave);
  const cotizacion = await json<{
    offeredPrice: number | string;
    attentionDate: string;
    validUntil: string;
    downPaymentAmount?: number | string;
    installments: { amount: number | string }[];
  }>(
    'leer la cotización',
    await api.get(`/quotations/${id}`, { headers: { Authorization: `Bearer ${token}` } }),
  );
  expect(Number(cotizacion.offeredPrice)).toBe(Number(PRECIO));
  expect(cotizacion.attentionDate.slice(0, 10)).toBe(atencion.iso);
  expect(cotizacion.validUntil.slice(0, 10)).toBe(validez.iso);
  expect(cotizacion.installments).toHaveLength(cantidad);
  const centavos = (valor: number | string | undefined): number =>
    Math.round(Number(valor ?? 0) * 100);
  const suma =
    centavos(cotizacion.downPaymentAmount) +
    cotizacion.installments.reduce((total, cuota) => total + centavos(cuota.amount), 0);
  expect(suma, 'el plan guardado no suma el precio ofrecido').toBe(centavos(PRECIO));
});
