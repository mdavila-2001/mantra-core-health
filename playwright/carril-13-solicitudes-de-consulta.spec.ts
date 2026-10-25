import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { apiViva, contextoDeApi, urlDeApi } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Carril 13 · solicitudes de consulta, sobre la pantalla de hoy.
 *
 * ## Dónde viven las solicitudes ahora
 *
 * La tabla «Solicitudes» de `/schedule` se retiró con C-07/C-08 (propietario,
 * 18–20/09): quien tiene agenda propia atiende todo desde el calendario
 * («Consultas»), y las acciones de una solicitud —ver detalle, historial del
 * paciente, aceptar, rechazar, estado del pago— son las MISMAS de la celda de
 * la tabla, montadas sobre la cita del día y, en la semana, dentro del modal
 * «Detalle de la cita» (`agenda.html`, `#accionesDeLaCitaDelDia`). La tabla
 * sólo sobrevive para quien no tiene agenda propia.
 *
 * La versión anterior de esta prueba buscaba esa solapa y dependía de la
 * médica demo, que nace sin horario; por eso fallaba. Se reescribió el
 * 2026-10-25 para la pantalla vigente.
 *
 * ## Qué cubre (criterios de la ficha)
 *
 * - La solicitud del paciente aparece y su detalle muestra paciente y motivo.
 * - Ofrece «Ver el historial del paciente», «Aceptar» y «Rechazar».
 * - Aceptar persiste: tras recargar, la cita figura confirmada (UI y API).
 * - Una segunda aceptación de la misma solicitud la rechaza el servidor.
 * - El estado de pago se marca aparte y persiste tras recargar.
 * - Una solicitud rechazada ya no ofrece estado de pago.
 *
 * Datos propios por el camino real (médica, horario, paciente, pedido).
 * Exige el front en `start:real-api` y la API levantada:
 *   E2E_API_REAL=1 E2E_API_URL=http://localhost:3000 E2E_BASE_URL=http://localhost:4200
 */

const API_REAL = process.env['E2E_API_REAL'] === '1';
/** `VS_BO_DEPARTMENT · Santa Cruz`: la API exige la expedición del documento. */
const DEPARTAMENTO_SC = '16fe92e8-bec7-577d-9e63-4a0d8ff3b0e4';
/** Municipio sembrado (Sucre). */
const MUNICIPIO = '5132db42-8cb1-52d6-88f5-0e9a04bdc94c';
const CAPTURAS = join(__dirname, '..', 'artifacts', 'playwright', 'tarea-13');

test.describe.configure({ mode: 'serial' });
test.skip(
  !API_REAL,
  'Omitido: hace falta E2E_API_REAL=1 con la API y el front en modo real-api. No es un verde.',
);

interface Escenario {
  readonly medica: { identificador: string; clave: string };
  readonly tokenMedica: string;
  readonly aAceptar: string;
  readonly aRechazar: string;
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

async function registrarPaciente(
  api: APIRequestContext,
  corrida: string,
  sufijo: string,
  clave: string,
  nombre: string,
): Promise<{ token: string; pid: string }> {
  const nationalId = `PS13${sufijo}${corrida}`;
  await json(
    `alta de ${nombre}`,
    await api.post('/iam/auth/register-patient', {
      data: {
        nationalId,
        issuerAdministrativeAreaConceptId: DEPARTAMENTO_SC,
        residenceMunicipalityConceptId: MUNICIPIO,
        password: clave,
        email: `paciente.s13.${sufijo}.${corrida}@alovida.test`,
        name: nombre,
        lastName: 'Quispe',
        birthDate: '1995-05-20',
        phone: '70055555',
        sexAtBirth: 'FEMALE',
      },
    }),
  );
  const { accessToken } = await json<{ accessToken: string }>(
    `login de ${nombre}`,
    await api.post('/iam/auth/login', { data: { nationalId, password: clave } }),
  );
  const { pid } = claims(accessToken) as { pid?: string };
  expect(pid, `el token de ${nombre} no trae su perfil de paciente`).toBeTruthy();
  return { token: accessToken, pid: pid! };
}

/** Un paciente retiene un cupo y lo PIDE: queda en `BOOKING_REQUESTED`. */
async function pedirCita(
  api: APIRequestContext,
  tenantId: string,
  cupoId: string,
  paciente: { token: string; pid: string },
  motivo: string,
): Promise<string> {
  const auth = { Authorization: `Bearer ${paciente.token}` };
  const { holdToken } = await json<{ holdToken: string }>(
    'retener el cupo',
    await api.post(`/scheduling/slots/${cupoId}/holds`, {
      headers: auth,
      data: { patientProfileId: paciente.pid },
    }),
  );
  const pedido = await json<{ id?: string; bookingId?: string }>(
    'pedir la cita',
    await api.post(`/scheduling/holds/${holdToken}/request`, {
      headers: auth,
      data: { tenantId, patientProfileId: paciente.pid, channel: 'PORTAL', reasonText: motivo },
    }),
  );
  const id = pedido.id ?? pedido.bookingId;
  expect(id, 'el pedido no devolvió el id de la reserva').toBeTruthy();
  return id!;
}

async function prepararEscenario(api: APIRequestContext): Promise<Escenario> {
  const corrida = Date.now().toString(36);
  const clave = `Solicitud-${corrida}-2026!`;
  const medica = { identificador: `medica.s13.${corrida}@alovida.test`, clave };

  await json(
    'alta de la médica',
    await api.post('/iam/auth/register-practitioner', {
      data: {
        email: medica.identificador,
        password: clave,
        name: 'Paula',
        lastName: 'Arce',
        licenseNumber: `MP-S13-${corrida}`,
        sedesLicenseNumber: `SEDES-${corrida}`,
        professionalTitle: 'Médico',
        nationalId: `S13${corrida}`,
        issuerAdministrativeAreaConceptId: DEPARTAMENTO_SC,
        residenceMunicipalityConceptId: MUNICIPIO,
      },
    }),
  );
  const { accessToken: tokenMedica } = await json<{ accessToken: string }>(
    'login de la médica',
    await api.post('/iam/auth/login', { data: { email: medica.identificador, password: clave } }),
  );
  const auth = { Authorization: `Bearer ${tokenMedica}` };
  const { tenants, hpid } = claims(tokenMedica) as { tenants?: string[]; hpid?: string };
  expect(tenants?.[0] && hpid, 'el token de la médica no trae tenant ni perfil').toBeTruthy();
  const tenantId = tenants![0]!;

  const agenda = await json<{ id: string }>(
    'agenda de la médica',
    await api.post('/scheduling/resources', {
      headers: auth,
      data: {
        tenantId,
        resourceType: 'PRACTITIONER',
        resourceRefType: 'health_practitioner_profiles',
        resourceRefId: hpid,
        name: 'Consultorio Paula Arce',
      },
    }),
  );
  const plantilla = await json<{ id: string }>(
    'horario de la médica',
    await api.post(`/scheduling/resources/${agenda.id}/templates`, {
      headers: auth,
      data: {
        name: 'Horario de Paula Arce',
        slotMinutes: 30,
        rules: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
          dayOfWeek,
          startTime: '09:00',
          endTime: '11:00',
          slotMinutes: 30,
        })),
      },
    }),
  );

  // Los cupos de MAÑANA, para que las dos solicitudes caigan en el mismo día.
  const desde = new Date();
  desde.setDate(desde.getDate() + 1);
  desde.setHours(0, 0, 0, 0);
  const hasta = new Date(desde);
  hasta.setDate(hasta.getDate() + 1);
  await json(
    'cupos del horario',
    await api.post(`/scheduling/templates/${plantilla.id}/generate-slots`, {
      headers: auth,
      data: { from: desde.toISOString(), to: hasta.toISOString() },
    }),
  );
  const libres = await json<{ items?: { id: string }[] }>(
    'cupos libres de mañana',
    await api.get(
      `/scheduling/slots?resourceId=${agenda.id}&from=${desde.toISOString()}&to=${hasta.toISOString()}&onlyAvailable=true`,
      { headers: auth },
    ),
  );
  const cupos = libres.items ?? [];
  expect(cupos.length, 'el horario no generó dos cupos libres para mañana').toBeGreaterThanOrEqual(
    2,
  );

  const ana = await registrarPaciente(api, corrida, 'a', clave, 'Ana');
  const rosa = await registrarPaciente(api, corrida, 'b', clave, 'Rosa');
  const aAceptar = await pedirCita(api, tenantId, cupos[0]!.id, ana, 'Dolor de cabeza frecuente');
  const aRechazar = await pedirCita(api, tenantId, cupos[1]!.id, rosa, 'Control de rutina');

  return { medica, tokenMedica, aAceptar, aRechazar };
}

async function capturar(page: Page, nombre: string): Promise<void> {
  mkdirSync(CAPTURAS, { recursive: true });
  await page.screenshot({ path: join(CAPTURAS, `${nombre}.png`), fullPage: true });
}

/** Abre la semana que contiene mañana y el detalle de la cita de `paciente`. */
async function abrirDetalle(page: Page, paciente: string) {
  await irA(page, '/schedule');
  await estable(page);
  await expect(page.getByTestId('agenda-calendario')).toBeVisible();
  await page.getByTestId('ver-semana').click();
  await expect(page.locator('.semana__dias')).toBeVisible();

  // La semana empieza el lunes: si hoy es domingo, mañana cae en la siguiente.
  // Se decide por la fecha y no por si ya se ve la cita, que depende de cuándo
  // termina de cargar.
  if (new Date().getDay() === 0) {
    const titulo = await page.locator('.semana__titulo').textContent();
    await page.getByTestId('semana-siguiente').click();
    await expect(page.locator('.semana__titulo')).not.toHaveText(titulo ?? '');
  }
  const cita = page.getByTestId('semana-cita').filter({ hasText: paciente });
  await expect(cita.first(), `la solicitud de ${paciente} no aparece en la semana`).toBeVisible();
  await cita.first().click();
  const dialogo = page.getByRole('dialog', { name: 'Detalle de la cita' });
  await expect(dialogo).toBeVisible();
  return dialogo;
}

interface ReservaLeida {
  readonly statusConceptId: string;
  readonly confirmedAt: string | null;
}

/** La reserva tal como la guarda la base (el estado viaja como concepto). */
async function leerReserva(
  api: APIRequestContext,
  token: string,
  id: string,
): Promise<ReservaLeida> {
  const respuesta = await api.get(`/scheduling/bookings/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(respuesta.ok(), `leer la reserva: ${respuesta.status()}`).toBe(true);
  return (await respuesta.json()) as ReservaLeida;
}

let api: APIRequestContext;
let escenario: Escenario;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  api = await contextoDeApi();
  expect(await apiViva(api), `La API no responde en ${urlDeApi()}.`).toBe(true);
  escenario = await prepararEscenario(api);
});

test.afterAll(async () => {
  await api?.dispose();
});

test.beforeEach(async ({ page }) => {
  await entrar(page, {
    rol: 'doctora',
    identificador: escenario.medica.identificador,
    clave: escenario.medica.clave,
    nombre: 'médica de las solicitudes',
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
});

test('la solicitud se ve con su detalle y ofrece historial, aceptar y rechazar', async ({
  page,
}) => {
  const dialogo = await abrirDetalle(page, 'Ana');
  await expect(dialogo).toContainText('Ana Quispe');
  await expect(dialogo).toContainText('Dolor de cabeza frecuente');
  await expect(dialogo.locator('[data-action="agenda-historial"]')).toBeVisible();
  await expect(dialogo.locator('[data-action="agenda-aceptar"]')).toBeVisible();
  await expect(dialogo.locator('[data-action="agenda-rechazar"]')).toBeVisible();
  await capturar(page, 'detalle-solicitud-1440');
});

test('aceptar persiste y una segunda aceptación la rechaza el servidor', async ({ page }) => {
  const dialogo = await abrirDetalle(page, 'Ana');
  const [aceptada] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes(`/scheduling/bookings/${escenario.aAceptar}/accept`) &&
        r.request().method() === 'POST',
    ),
    dialogo.locator('[data-action="agenda-aceptar"]').click(),
  ]);
  expect(aceptada.status(), await aceptada.text()).toBeLessThan(300);

  // Recargar: no es estado de la pantalla, es de la base.
  await page.reload();
  const otraVez = await abrirDetalle(page, 'Ana');
  await expect(otraVez).toContainText('Confirmada');
  await expect(otraVez.locator('[data-action="agenda-aceptar"]')).toHaveCount(0);
  const leida = await leerReserva(api, escenario.tokenMedica, escenario.aAceptar);
  expect(leida.confirmedAt, 'la base no registró la confirmación').not.toBeNull();

  const doble = await api.post(`/scheduling/bookings/${escenario.aAceptar}/accept`, {
    headers: { Authorization: `Bearer ${escenario.tokenMedica}` },
    data: {},
  });
  expect(doble.status(), 'una segunda aceptación no debería pasar').toBeGreaterThanOrEqual(400);
  expect(doble.status()).toBeLessThan(500);
});

test('el estado de pago se marca aparte y persiste tras recargar', async ({ page }) => {
  const dialogo = await abrirDetalle(page, 'Ana');
  const [pago] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes(`/scheduling/bookings/${escenario.aAceptar}/payment-state`) &&
        r.request().method() !== 'GET',
    ),
    dialogo.getByTestId('agenda-pago-PAID').click(),
  ]);
  expect(pago.status(), await pago.text()).toBeLessThan(300);

  await page.reload();
  const otraVez = await abrirDetalle(page, 'Ana');
  await expect(otraVez.getByTestId('agenda-pago-detalle')).toContainText('Pagada');
  // El pago no movió el estado de la cita.
  await expect(otraVez).toContainText('Confirmada');
  await capturar(page, 'detalle-pagada-1440');
});

test('rechazar pide motivo, persiste y la rechazada no ofrece estado de pago', async ({ page }) => {
  const antes = await leerReserva(api, escenario.tokenMedica, escenario.aRechazar);
  const dialogo = await abrirDetalle(page, 'Rosa');
  await dialogo.locator('[data-action="agenda-rechazar"]').click();

  const motivo = page.getByLabel('Motivo del rechazo');
  await expect(motivo).toBeVisible();
  await motivo.fill('La médica no atiende ese día por un congreso.');
  const [rechazo] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes(`/scheduling/bookings/${escenario.aRechazar}/reject`) &&
        r.request().method() === 'POST',
    ),
    page.getByTestId('dialogo-confirmar').click(),
  ]);
  expect(rechazo.status(), await rechazo.text()).toBeLessThan(300);

  const despues = await leerReserva(api, escenario.tokenMedica, escenario.aRechazar);
  expect(despues.statusConceptId, 'el rechazo no cambió el estado en la base').not.toBe(
    antes.statusConceptId,
  );
  expect(despues.confirmedAt).toBeNull();
  const pagoDeRechazada = await api.put(
    `/scheduling/bookings/${escenario.aRechazar}/payment-state`,
    {
      headers: { Authorization: `Bearer ${escenario.tokenMedica}` },
      data: { state: 'PAID' },
    },
  );
  expect(
    pagoDeRechazada.status(),
    'una solicitud rechazada no admite estado de pago',
  ).toBeGreaterThanOrEqual(400);
});
