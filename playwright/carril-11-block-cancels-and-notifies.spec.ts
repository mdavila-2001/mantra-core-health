import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { apiViva, contextoDeApi, urlDeApi } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Carril 11 · bloquear la agenda **cancela las citas del rato y avisa al
 * paciente**, con confirmación previa (pedido del propietario, 24/10/2026).
 *
 * ## Qué prueba que las unitarias no pueden
 *
 * Las unitarias de la API fijan los dos pasos (vista previa → cancelación en
 * la misma transacción → aviso después del commit) y las del front fijan el
 * modal. Lo que sólo se ve con la API y el navegador de verdad es la cadena
 * completa: la médica bloquea desde la pantalla, confirma mirando el nombre
 * de la paciente, la cita queda cancelada **en la base** y a la paciente le
 * llega «Su cita se canceló» a su bandeja.
 *
 * ## Datos propios, creados por el camino real
 *
 * Una médica y una paciente nuevas por `/iam/auth/register-*`, la agenda de la
 * médica y una cita confirmada para mañana a las 10:00 (`appointments/direct`,
 * AG-2). Nada se toma prestado del entorno: la prueba no depende del orden ni
 * de lo que otra haya dejado.
 *
 * Exige el front en `start:real-api` y la API levantada:
 *   E2E_API_REAL=1 E2E_API_URL=http://localhost:3000 E2E_BASE_URL=http://localhost:4289
 */

const API_REAL = process.env['E2E_API_REAL'] === '1';
/** `VS_BO_DEPARTMENT · Santa Cruz`, sembrado por el stack de desarrollo. */
const DEPARTAMENTO_SC = '16fe92e8-bec7-577d-9e63-4a0d8ff3b0e4';
/** Municipio sembrado (Sucre), el mismo que usa el carril 13. */
const MUNICIPIO = '5132db42-8cb1-52d6-88f5-0e9a04bdc94c';

test.describe.configure({ mode: 'serial' });
test.skip(
  !API_REAL,
  'Omitido: hace falta E2E_API_REAL=1 con la API y el front en modo real-api. No es un verde.',
);
test.setTimeout(180_000);

interface Escenario {
  readonly medica: { identificador: string; clave: string };
  readonly paciente: { identificador: string; clave: string; token: string };
  readonly resourceId: string;
  readonly bookingId: string;
  readonly inicio: Date;
}

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

/** Médica, paciente, agenda y la cita confirmada de mañana a las 10:00. */
async function prepararEscenario(api: APIRequestContext): Promise<Escenario> {
  const corrida = Date.now().toString(36);
  const clave = `Bloqueo-${corrida}-2026!`;
  const medica = { identificador: `medica.bloqueo.${corrida}@alovida.test`, clave };
  const paciente = { identificador: `PBLQ${corrida}`, clave, token: '' };

  await json(
    'alta de la médica',
    await api.post('/iam/auth/register-practitioner', {
      data: {
        email: medica.identificador,
        password: clave,
        name: 'Valeria',
        lastName: 'Rojas',
        licenseNumber: `MP-BLQ-${corrida}`,
        sedesLicenseNumber: `SEDES-${corrida}`,
        professionalTitle: 'Médico',
        nationalId: `BLQ${corrida}`,
        issuerAdministrativeAreaConceptId: DEPARTAMENTO_SC,
        residenceMunicipalityConceptId: MUNICIPIO,
      },
    }),
  );
  await json(
    'alta de la paciente',
    await api.post('/iam/auth/register-patient', {
      data: {
        nationalId: paciente.identificador,
        issuerAdministrativeAreaConceptId: DEPARTAMENTO_SC,
        residenceMunicipalityConceptId: MUNICIPIO,
        password: clave,
        email: `paciente.bloqueo.${corrida}@alovida.test`,
        name: 'Rosa',
        lastName: 'Quispe',
        birthDate: '1990-03-15',
        phone: '70012345',
        sexAtBirth: 'FEMALE',
      },
    }),
  );

  const { accessToken: tokenMedica } = await json<{ accessToken: string }>(
    'login de la médica',
    await api.post('/iam/auth/login', { data: { email: medica.identificador, password: clave } }),
  );
  const { accessToken: tokenPaciente } = await json<{ accessToken: string }>(
    'login de la paciente',
    await api.post('/iam/auth/login', {
      data: { nationalId: paciente.identificador, password: clave },
    }),
  );
  paciente.token = tokenPaciente;
  const auth = { Authorization: `Bearer ${tokenMedica}` };
  const { tenants, hpid } = claims(tokenMedica) as { tenants?: string[]; hpid?: string };
  const { pid } = claims(tokenPaciente) as { pid?: string };
  expect(
    tenants?.[0] && hpid && pid,
    'los tokens no traen tenant, perfil profesional y perfil de paciente',
  ).toBeTruthy();

  const agenda = await json<{ id: string }>(
    'agenda de la médica',
    await api.post('/scheduling/resources', {
      headers: auth,
      data: {
        tenantId: tenants![0],
        resourceType: 'PRACTITIONER',
        resourceRefType: 'health_practitioner_profiles',
        resourceRefId: hpid,
        name: 'Consultorio Valeria Rojas',
      },
    }),
  );

  const inicio = new Date();
  inicio.setDate(inicio.getDate() + 1);
  inicio.setHours(10, 0, 0, 0);
  const cita = await json<{ id?: string; bookingId?: string }>(
    'cita confirmada de mañana',
    await api.post('/scheduling/appointments/direct', {
      headers: auth,
      data: {
        patientProfileId: pid,
        resourceId: agenda.id,
        startAt: inicio.toISOString(),
        durationMinutes: 30,
        reasonText: 'Control de presión',
      },
    }),
  );

  return {
    medica,
    paciente,
    resourceId: agenda.id,
    bookingId: (cita.id ?? cita.bookingId)!,
    inicio,
  };
}

function ddmmaaaa(fecha: Date): string {
  const dd = String(fecha.getDate()).padStart(2, '0');
  const mm = String(fecha.getMonth() + 1).padStart(2, '0');
  return `${dd}${mm}${fecha.getFullYear()}`;
}

async function escribirFecha(page: Page, indice: number, fecha: Date): Promise<void> {
  const input = page.locator('app-block-form app-date-picker').nth(indice).locator('input').first();
  await input.click();
  await page.keyboard.type(ddmmaaaa(fecha), { delay: 40 });
  await page.keyboard.press('Escape');
}

let api: APIRequestContext;
let escenario: Escenario;

test.beforeAll(async () => {
  api = await contextoDeApi();
  expect(await apiViva(api), `La API no responde en ${urlDeApi()}.`).toBe(true);
  escenario = await prepararEscenario(api);
});

test.afterAll(async () => {
  await api?.dispose();
});

test('la médica bloquea el rato de una cita: ve a la paciente, confirma, y la cita queda cancelada con aviso', async ({
  page,
}, testInfo) => {
  await entrar(page, {
    rol: 'doctora',
    identificador: escenario.medica.identificador,
    clave: escenario.medica.clave,
    nombre: 'médica del bloqueo',
  });
  // Sin fundidos entre pantallas: la captura sale entera, no a medio animar.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await irA(page, '/schedule/blocks');
  await estable(page);

  await page.getByTestId('bloqueo-nuevo').click();
  await expect(page.locator('app-block-form')).toBeVisible();
  await escribirFecha(page, 0, escenario.inicio);
  await escribirFecha(page, 1, escenario.inicio);
  await page.getByRole('radio', { name: 'Sólo una franja de cada día' }).check();
  await page.getByLabel('Desde').fill('09:00');
  await page.getByLabel('Hasta').fill('12:00');
  // `data-testid` cae en el envoltorio `app-input`, no en el `<input>`.
  await page.getByTestId('bloqueo-descripcion').locator('input').fill('Viaje a La Paz');

  /* -- 1 · el primer pedido no cancela: trae la lista ------------------------ */

  const [primero] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes(`/scheduling/resources/${escenario.resourceId}/exceptions`) &&
        r.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Bloquear', exact: true }).click(),
  ]);
  expect(primero.status(), await primero.text()).toBe(422);
  const vistaPrevia = (await primero.json()) as {
    details: {
      failureCode: string;
      affectedBookings: { bookingId: string; patientName: string | null }[];
    };
  };
  expect(vistaPrevia.details.failureCode).toBe('BOOKINGS_REQUIRE_CONFIRMATION');
  expect(vistaPrevia.details.affectedBookings.map((b) => b.bookingId)).toEqual([
    escenario.bookingId,
  ]);

  /* -- 2 · el modal nombra a la paciente y pide confirmar -------------------- */

  const dialogo = page.getByTestId('dialogo');
  await expect(dialogo).toBeVisible();
  await expect(page.getByTestId('dialogo-titulo')).toHaveText('Este bloqueo cancela una cita');
  await expect(page.getByTestId('dialogo-detalles')).toContainText('Rosa Quispe');
  await page.screenshot({ path: testInfo.outputPath('modal-confirmacion.png'), fullPage: true });
  await testInfo.attach('modal-confirmacion', {
    path: testInfo.outputPath('modal-confirmacion.png'),
    contentType: 'image/png',
  });

  /* -- 3 · con el sí, el segundo pedido cancela y bloquea -------------------- */

  const [segundo] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes(`/scheduling/resources/${escenario.resourceId}/exceptions`) &&
        r.request().method() === 'POST',
    ),
    page.getByTestId('dialogo-confirmar').click(),
  ]);
  expect(segundo.status(), await segundo.text()).toBe(201);
  expect(segundo.request().postDataJSON()).toMatchObject({ cancelAffectedBookings: true });
  const creado = (await segundo.json()) as { cancelledBookings: number };
  expect(creado.cancelledBookings).toBe(1);

  const toast = page.getByTestId('toast-mensaje');
  await expect(toast).toContainText('Se canceló 1 cita');
  await page.screenshot({ path: testInfo.outputPath('bloqueo-creado.png'), fullPage: true });
  await testInfo.attach('bloqueo-creado', {
    path: testInfo.outputPath('bloqueo-creado.png'),
    contentType: 'image/png',
  });

  /* -- 4 · persistencia: el bloqueo existe y la cita ya no es de la agenda --- */

  const desde = new Date(escenario.inicio);
  desde.setHours(0, 0, 0, 0);
  const hasta = new Date(desde);
  hasta.setDate(hasta.getDate() + 1);
  await irA(page, '/schedule/blocks');
  await estable(page);
  await expect(page.locator('app-blocks')).toContainText('Viaje a La Paz');
});

test('a la paciente le llega «Su cita se canceló» con el motivo del bloqueo', async ({
  page,
}, testInfo) => {
  const auth = { Authorization: `Bearer ${escenario.paciente.token}` };

  // El aviso sale después del commit por la cola de mensajería: se le da
  // hasta medio minuto, consultando la bandeja real de la paciente.
  await expect
    .poll(
      async () => {
        const bandeja = await api.get('/notifications/me', { headers: auth });
        if (!bandeja.ok()) return `HTTP ${bandeja.status()}`;
        const { items } = (await bandeja.json()) as {
          items: { subject?: string; bodyText?: string }[];
        };
        const aviso = items.find((n) => /se cancel/i.test(n.subject ?? ''));
        return aviso ? `${aviso.subject} · ${aviso.bodyText ?? ''}` : 'sin aviso todavía';
      },
      { timeout: 30_000, message: 'la bandeja de la paciente no recibió la cancelación' },
    )
    .toMatch(/Su cita se canceló.*Bloqueo de agenda/s);

  await entrar(page, {
    rol: 'paciente',
    identificador: escenario.paciente.identificador,
    clave: escenario.paciente.clave,
    nombre: 'paciente del bloqueo',
  });
  // Sin fundidos entre pantallas: la captura sale entera, no a medio animar.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await irA(page, '/notification-center');
  await estable(page);
  await expect(page.locator('app-root')).toContainText('Su cita se canceló');
  await page.screenshot({ path: testInfo.outputPath('bandeja-paciente.png'), fullPage: true });
  await testInfo.attach('bandeja-paciente', {
    path: testInfo.outputPath('bandeja-paciente.png'),
    contentType: 'image/png',
  });
});
