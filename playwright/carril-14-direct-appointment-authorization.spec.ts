import { expect, test, type APIRequestContext } from '@playwright/test';

import { apiViva, contextoDeApi, urlDeApi } from './support/actores';

/**
 * Carril 14 · quién puede crear una cita puntual (`POST /scheduling/appointments/direct`).
 *
 * La ficha deja un hueco anotado: «sin prueba de API contra suplantación de
 * `doctorId`». La pantalla de alta de cita del médico es sólo acceso; la
 * autoridad es la API, y esta prueba la ejercita con cuentas reales:
 *
 * 1. la médica A agenda en **su** agenda → 201;
 * 2. la médica A intenta agendar en la agenda de la médica B (otra organización)
 *    → no puede crear nada;
 * 3. una paciente no agenda por esta vía → no puede crear nada;
 * 4. dos citas en el mismo rato de la misma agenda → la segunda no se crea.
 *
 * Requiere `E2E_API_REAL=1` con la API de verdad.
 */

const API_REAL = process.env['E2E_API_REAL'] === '1';
/** `VS_BO_DEPARTMENT · Santa Cruz`, sembrado por el stack de desarrollo. */
const DEPARTAMENTO_SC = '16fe92e8-bec7-577d-9e63-4a0d8ff3b0e4';
/** Municipio sembrado (Sucre), el mismo que usan los demás carriles. */
const MUNICIPIO = '5132db42-8cb1-52d6-88f5-0e9a04bdc94c';

test.describe.configure({ mode: 'serial' });
test.skip(!API_REAL, 'Omitido: hace falta E2E_API_REAL=1 con la API de verdad. No es un verde.');
test.setTimeout(120_000);

interface Medica {
  readonly token: string;
  readonly resourceId: string;
}
interface Escenario {
  readonly a: Medica;
  readonly b: Medica;
  readonly paciente: { token: string; perfil: string };
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

async function nuevaMedica(
  api: APIRequestContext,
  corrida: string,
  letra: string,
): Promise<Medica> {
  const clave = `Autoriza-${corrida}-2026!`;
  const correo = `medica.autoriza.${letra}.${corrida}@alovida.test`;
  await json(
    `alta de la médica ${letra}`,
    await api.post('/iam/auth/register-practitioner', {
      data: {
        email: correo,
        password: clave,
        name: letra === 'a' ? 'Ana' : 'Beatriz',
        lastName: 'Autoriza',
        licenseNumber: `MP-AUT-${letra}-${corrida}`,
        sedesLicenseNumber: `SEDES-${letra}-${corrida}`,
        professionalTitle: 'Médico',
        nationalId: `AUT${letra.toUpperCase()}${corrida}`,
        issuerAdministrativeAreaConceptId: DEPARTAMENTO_SC,
        residenceMunicipalityConceptId: MUNICIPIO,
      },
    }),
  );
  const { accessToken } = await json<{ accessToken: string }>(
    `login de la médica ${letra}`,
    await api.post('/iam/auth/login', { data: { email: correo, password: clave } }),
  );
  const { tenants, hpid } = claims(accessToken) as { tenants?: string[]; hpid?: string };
  expect(tenants?.[0] && hpid).toBeTruthy();
  const agenda = await json<{ id: string }>(
    `agenda de la médica ${letra}`,
    await api.post('/scheduling/resources', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {
        tenantId: tenants![0],
        resourceType: 'PRACTITIONER',
        resourceRefType: 'health_practitioner_profiles',
        resourceRefId: hpid,
        name: `Consultorio ${letra}`,
        timeZone: 'America/La_Paz',
      },
    }),
  );
  return { token: accessToken, resourceId: agenda.id };
}

async function prepararEscenario(api: APIRequestContext): Promise<Escenario> {
  const corrida = Date.now().toString(36);
  const a = await nuevaMedica(api, corrida, 'a');
  const b = await nuevaMedica(api, corrida, 'b');
  const clave = `Autoriza-${corrida}-2026!`;
  const documento = `PAUT${corrida}`.toUpperCase();
  await json(
    'alta de la paciente',
    await api.post('/iam/auth/register-patient', {
      data: {
        nationalId: documento,
        issuerAdministrativeAreaConceptId: DEPARTAMENTO_SC,
        residenceMunicipalityConceptId: MUNICIPIO,
        password: clave,
        email: `paciente.autoriza.${corrida}@alovida.test`,
        name: 'Rosa',
        lastName: 'Quispe',
        birthDate: '1990-03-15',
        phone: '70012345',
        sexAtBirth: 'FEMALE',
      },
    }),
  );
  const { accessToken } = await json<{ accessToken: string }>(
    'login de la paciente',
    await api.post('/iam/auth/login', { data: { nationalId: documento, password: clave } }),
  );
  const { pid } = claims(accessToken) as { pid?: string };
  expect(pid).toBeTruthy();
  const inicio = new Date();
  inicio.setDate(inicio.getDate() + 2);
  inicio.setHours(11, 0, 0, 0);
  return { a, b, paciente: { token: accessToken, perfil: pid! }, inicio };
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

function cita(resourceId: string, inicio: Date, paciente: string) {
  return {
    patientProfileId: paciente,
    resourceId,
    startAt: inicio.toISOString(),
    durationMinutes: 30,
    reasonText: 'Control',
  };
}

async function citasDe(token: string, resourceId: string): Promise<number> {
  const lista = await api.get(`/scheduling/bookings?resourceId=${resourceId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!lista.ok()) return -1;
  const cuerpo = (await lista.json()) as { items?: unknown[] };
  return cuerpo.items?.length ?? 0;
}

test('la médica agenda en su propia agenda', async () => {
  const ok = await api.post('/scheduling/appointments/direct', {
    headers: { Authorization: `Bearer ${escenario.a.token}` },
    data: cita(escenario.a.resourceId, escenario.inicio, escenario.paciente.perfil),
  });
  expect(ok.status(), await ok.text()).toBe(201);
});

test('la médica A no puede agendar en la agenda de la médica B', async () => {
  const intento = await api.post('/scheduling/appointments/direct', {
    headers: { Authorization: `Bearer ${escenario.a.token}` },
    data: cita(escenario.b.resourceId, escenario.inicio, escenario.paciente.perfil),
  });
  expect(
    [403, 404],
    `A agendó en la agenda de B: ${intento.status()} ${await intento.text()}`,
  ).toContain(intento.status());
  expect(await citasDe(escenario.b.token, escenario.b.resourceId)).toBe(0);
});

test('una paciente no agenda por la vía del médico', async () => {
  const otroRato = new Date(escenario.inicio.getTime() + 2 * 60 * 60_000);
  const intento = await api.post('/scheduling/appointments/direct', {
    headers: { Authorization: `Bearer ${escenario.paciente.token}` },
    data: cita(escenario.a.resourceId, otroRato, escenario.paciente.perfil),
  });
  expect(
    [403, 404],
    `La paciente agendó por la vía del médico: ${intento.status()} ${await intento.text()}`,
  ).toContain(intento.status());
});

test('dos citas en el mismo rato de la misma agenda: la segunda no se crea', async () => {
  const segunda = await api.post('/scheduling/appointments/direct', {
    headers: { Authorization: `Bearer ${escenario.a.token}` },
    data: cita(escenario.a.resourceId, escenario.inicio, escenario.paciente.perfil),
  });
  expect(segunda.status(), await segunda.text()).toBeGreaterThanOrEqual(400);
  expect(segunda.status()).toBeLessThan(500);
});
