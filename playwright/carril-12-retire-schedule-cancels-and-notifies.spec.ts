import { expect, test, type APIRequestContext } from '@playwright/test';

import { apiViva, contextoDeApi, urlDeApi } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Carril 12 · cambiar el horario avisa al paciente (pedido del propietario,
 * 24/10/2026): la médica retira su horario con una cita viva, ve a quién
 * alcanza, elige «Cancelar las citas y avisar», y a la paciente le llega
 * «Su cita se canceló» con el motivo del cambio.
 *
 * ## Datos propios, por el camino real
 *
 * Una médica y una paciente nuevas, la agenda de la médica, un **horario
 * publicado** (plantilla con su franja de mañana) con sus cupos, y una cita
 * **confirmada** de la paciente sobre uno de esos cupos
 * (`holds` → `confirm`, la puerta del portal). Nada se toma del entorno.
 *
 * Exige el front en `start:real-api` y la API levantada:
 *   E2E_API_REAL=1 E2E_API_URL=http://localhost:3000 E2E_BASE_URL=http://localhost:4289
 */

const API_REAL = process.env['E2E_API_REAL'] === '1';
/** `VS_BO_DEPARTMENT · Santa Cruz`, sembrado por el stack de desarrollo. */
const DEPARTAMENTO_SC = '16fe92e8-bec7-577d-9e63-4a0d8ff3b0e4';
/** Municipio sembrado (Sucre), el mismo que usan los carriles 11 y 13. */
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
  readonly templateId: string;
  readonly bookingId: string;
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

async function prepararEscenario(api: APIRequestContext): Promise<Escenario> {
  const corrida = Date.now().toString(36);
  const clave = `Horario-${corrida}-2026!`;
  const medica = { identificador: `medica.horario.${corrida}@alovida.test`, clave };
  const paciente = { identificador: `PHOR${corrida}`, clave, token: '' };

  await json(
    'alta de la médica',
    await api.post('/iam/auth/register-practitioner', {
      data: {
        email: medica.identificador,
        password: clave,
        name: 'Camila',
        lastName: 'Vargas',
        licenseNumber: `MP-HOR-${corrida}`,
        sedesLicenseNumber: `SEDES-H-${corrida}`,
        professionalTitle: 'Médico',
        nationalId: `HOR${corrida}`,
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
        email: `paciente.horario.${corrida}@alovida.test`,
        name: 'Elena',
        lastName: 'Flores',
        birthDate: '1988-07-02',
        phone: '70098765',
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
  const authMedica = { Authorization: `Bearer ${tokenMedica}` };
  const authPaciente = { Authorization: `Bearer ${tokenPaciente}` };
  const { tenants, hpid } = claims(tokenMedica) as { tenants?: string[]; hpid?: string };
  const { pid } = claims(tokenPaciente) as { pid?: string };
  const tenantId = tenants?.[0];
  expect(
    tenantId && hpid && pid,
    'los tokens no traen tenant, perfil profesional y perfil de paciente',
  ).toBeTruthy();

  const agenda = await json<{ id: string }>(
    'agenda de la médica',
    await api.post('/scheduling/resources', {
      headers: authMedica,
      data: {
        tenantId,
        resourceType: 'PRACTITIONER',
        resourceRefType: 'health_practitioner_profiles',
        resourceRefId: hpid,
        name: 'Consultorio Camila Vargas',
        // Sin zona la API genera los cupos en UTC: una franja de 09:00 caería
        // a las 05:00 en La Paz. La pantalla real siempre manda la zona.
        timeZone: 'America/La_Paz',
      },
    }),
  );

  // Horario publicado: la franja de la mañana del día de mañana, en turnos de
  // 30 minutos. La API acepta `dayOfWeek` de 0 a 6 (0 = domingo, como
  // `Date.getDay()`), y el día se mide en el reloj de La Paz, que es el de la
  // agenda — no el de quien corre la prueba.
  const diaDeLaSemana = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const abreviado = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/La_Paz',
    weekday: 'short',
  }).format(diaDeLaSemana);
  const diaDeSemana = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(abreviado);
  expect(diaDeSemana, `día de la semana irreconocible: ${abreviado}`).toBeGreaterThanOrEqual(0);
  const plantilla = await json<{ id: string }>(
    'horario publicado',
    await api.post(`/scheduling/resources/${agenda.id}/templates`, {
      headers: authMedica,
      data: {
        name: 'Horario de Camila Vargas',
        slotMinutes: 30,
        rules: [{ dayOfWeek: diaDeSemana, startTime: '09:00', endTime: '12:00', slotMinutes: 30 }],
      },
    }),
  );
  const desde = new Date();
  desde.setUTCDate(desde.getUTCDate());
  const hasta = new Date();
  hasta.setUTCDate(hasta.getUTCDate() + 3);
  await json(
    'cupos del horario',
    await api.post(`/scheduling/templates/${plantilla.id}/generate-slots`, {
      headers: authMedica,
      data: { from: desde.toISOString(), to: hasta.toISOString() },
    }),
  );

  const libres = await json<{ items?: { id: string }[] }>(
    'cupos libres',
    await api.get(
      `/scheduling/slots?resourceId=${agenda.id}&from=${desde.toISOString()}&to=${hasta.toISOString()}&onlyAvailable=true&limit=1`,
      { headers: authMedica },
    ),
  );
  const cupo = libres.items?.[0];
  expect(cupo, 'el horario publicado no generó ningún cupo libre para mañana').toBeDefined();

  const retencion = await json<{ holdToken: string }>(
    'retener el cupo',
    await api.post(`/scheduling/slots/${cupo!.id}/holds`, {
      headers: authPaciente,
      data: { patientProfileId: pid },
    }),
  );
  const cita = await json<{ id?: string; bookingId?: string }>(
    'cita confirmada',
    await api.post(`/scheduling/holds/${retencion.holdToken}/confirm`, {
      headers: authPaciente,
      data: { tenantId, patientProfileId: pid, channel: 'PORTAL', reasonText: 'Control de rutina' },
    }),
  );

  return { medica, paciente, templateId: plantilla.id, bookingId: (cita.id ?? cita.bookingId)! };
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

test('la médica retira su horario con una cita viva: ve a la paciente, elige cancelar y avisar, y la cita cae', async ({
  page,
}, testInfo) => {
  await entrar(page, {
    rol: 'doctora',
    identificador: escenario.medica.identificador,
    clave: escenario.medica.clave,
    nombre: 'médica del horario',
  });
  // Sin fundidos entre pantallas: la captura sale entera, no a medio animar.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await irA(page, '/schedule?vista=agenda');
  await estable(page);

  await page.getByTestId('horario-acciones-menu').getByTestId('row-actions-trigger').click();
  await page.locator('[data-action="retirar"]').first().click();

  /* -- 1 · la confirmación de siempre: «Retirar este horario» ---------------- */

  await expect(page.getByTestId('dialogo-titulo')).toHaveText('Retirar este horario');
  const [vistaPrevia] = await Promise.all([
    page.waitForResponse((r) =>
      r.url().includes(`/scheduling/templates/${escenario.templateId}/live-bookings`),
    ),
    page.getByTestId('dialogo-confirmar').click(),
  ]);

  /* -- 2 · la vista previa trae a la paciente -------------------------------- */

  expect(vistaPrevia.status(), await vistaPrevia.text()).toBe(200);
  const previa = (await vistaPrevia.json()) as {
    total: number;
    bookings: { bookingId: string; patientName: string | null }[];
  };
  expect(previa.bookings.map((b) => b.bookingId)).toEqual([escenario.bookingId]);

  /* -- 3 · el modal de la etapa C: nombra a la paciente y deja elegir -------- */

  await expect(page.getByTestId('dialogo-titulo')).toHaveText('Este horario tiene una cita');
  await expect(page.getByTestId('dialogo-detalles')).toContainText('Elena Flores');
  await page.screenshot({ path: testInfo.outputPath('modal-retiro.png'), fullPage: true });
  await testInfo.attach('modal-retiro', {
    path: testInfo.outputPath('modal-retiro.png'),
    contentType: 'image/png',
  });

  /* -- 4 · con «Cancelar las citas y avisar», el DELETE lo pide -------------- */

  const [retiro] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes(`/scheduling/templates/${escenario.templateId}`) &&
        r.request().method() === 'DELETE',
    ),
    page.getByTestId('dialogo-confirmar').click(),
  ]);
  expect(retiro.status(), await retiro.text()).toBe(200);
  expect(new URL(retiro.url()).searchParams.get('affectedBookings')).toBe('cancel');
  expect(((await retiro.json()) as { cancelledBookings: number }).cancelledBookings).toBe(1);

  await expect(page.getByTestId('toast-mensaje')).toContainText('Se canceló 1 cita');
  await page.screenshot({ path: testInfo.outputPath('horario-retirado.png'), fullPage: true });
  await testInfo.attach('horario-retirado', {
    path: testInfo.outputPath('horario-retirado.png'),
    contentType: 'image/png',
  });
});

test('a la paciente le llega «Su cita se canceló» con el motivo del cambio de horario', async ({
  page,
}, testInfo) => {
  const auth = { Authorization: `Bearer ${escenario.paciente.token}` };

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
    .toMatch(/Su cita se canceló.*Cambio en el horario de atención/s);

  await entrar(page, {
    rol: 'paciente',
    identificador: escenario.paciente.identificador,
    clave: escenario.paciente.clave,
    nombre: 'paciente del horario',
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
