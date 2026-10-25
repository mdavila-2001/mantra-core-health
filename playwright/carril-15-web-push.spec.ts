import { execFileSync } from 'node:child_process';
import { createECDH, createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { expect, test, type APIRequestContext } from '@playwright/test';

import { apiViva, contextoDeApi, urlDeApi } from './support/actores';

/**
 * Carril 15 · push web: la persona se suscribe y, cuando la médica bloquea su
 * cita, la API intenta empujar el aviso a su navegador.
 *
 * ## Qué se afirma y qué no
 *
 * Se afirma contra la API y la base reales: la configuración pública, el
 * rechazo de direcciones que no son de un servicio de push, que la suscripción
 * queda **cifrada** en `iam.devices`, que un navegador pertenece a una cuenta
 * a la vez, y que al cancelar la cita la bandeja recibe el aviso y el servidor
 * **intenta** el envío (queda en su registro o retira la suscripción muerta).
 *
 * **No se afirma que el navegador muestre el aviso**: el servicio de push de
 * Google no está al alcance de una prueba local y un Chromium sin cabeza no
 * se suscribe. Esa parte queda como no probada.
 *
 * Requiere `E2E_API_REAL=1`, la API arrancada con `VAPID_*`, Postgres en el
 * contenedor `mantra-redesa-postgres-1` y `E2E_API_LOG` apuntando al registro
 * de esa API.
 */

const API_REAL = process.env['E2E_API_REAL'] === '1';
const RUTA_REGISTRO = process.env['E2E_API_LOG'] ?? '';
/** `VS_BO_DEPARTMENT · Santa Cruz`, sembrado por el stack de desarrollo. */
const DEPARTAMENTO_SC = '16fe92e8-bec7-577d-9e63-4a0d8ff3b0e4';
/** Municipio sembrado (Sucre), el mismo que usan los carriles 11 a 13. */
const MUNICIPIO = '5132db42-8cb1-52d6-88f5-0e9a04bdc94c';

test.describe.configure({ mode: 'serial' });
test.skip(
  !API_REAL || RUTA_REGISTRO === '',
  'Omitido: hace falta E2E_API_REAL=1 y E2E_API_LOG con la API de verdad. No es un verde.',
);
test.setTimeout(180_000);

interface Escenario {
  readonly paciente: { identificador: string; clave: string; token: string };
  readonly tokenMedica: string;
  readonly resourceId: string;
  readonly inicio: Date;
  readonly corrida: string;
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
  clave: string,
  nombre: string,
): Promise<{ identificador: string; token: string; perfil: string }> {
  const identificador = `PPSH${nombre}${corrida}`.toUpperCase();
  await json(
    `alta de ${nombre}`,
    await api.post('/iam/auth/register-patient', {
      data: {
        nationalId: identificador,
        issuerAdministrativeAreaConceptId: DEPARTAMENTO_SC,
        residenceMunicipalityConceptId: MUNICIPIO,
        password: clave,
        email: `paciente.push.${nombre}.${corrida}@alovida.test`,
        name: 'Rosa',
        lastName: 'Quispe',
        birthDate: '1990-03-15',
        phone: '70012345',
        sexAtBirth: 'FEMALE',
      },
    }),
  );
  const { accessToken } = await json<{ accessToken: string }>(
    `login de ${nombre}`,
    await api.post('/iam/auth/login', { data: { nationalId: identificador, password: clave } }),
  );
  const { pid } = claims(accessToken) as { pid?: string };
  expect(pid).toBeTruthy();
  return { identificador, token: accessToken, perfil: pid! };
}

/** Médica, paciente, agenda y la cita confirmada de mañana a las 10:00. */
async function prepararEscenario(api: APIRequestContext): Promise<Escenario> {
  const corrida = Date.now().toString(36);
  const clave = `PushWeb-${corrida}-2026!`;
  const correoMedica = `medica.push.${corrida}@alovida.test`;

  await json(
    'alta de la médica',
    await api.post('/iam/auth/register-practitioner', {
      data: {
        email: correoMedica,
        password: clave,
        name: 'Valeria',
        lastName: 'Rojas',
        licenseNumber: `MP-PSH-${corrida}`,
        sedesLicenseNumber: `SEDES-${corrida}`,
        professionalTitle: 'Médico',
        nationalId: `PSH${corrida}`,
        issuerAdministrativeAreaConceptId: DEPARTAMENTO_SC,
        residenceMunicipalityConceptId: MUNICIPIO,
      },
    }),
  );
  const paciente = await registrarPaciente(api, corrida, clave, 'a');
  const { accessToken: tokenMedica } = await json<{ accessToken: string }>(
    'login de la médica',
    await api.post('/iam/auth/login', { data: { email: correoMedica, password: clave } }),
  );
  const auth = { Authorization: `Bearer ${tokenMedica}` };
  const { tenants, hpid } = claims(tokenMedica) as { tenants?: string[]; hpid?: string };
  expect(tenants?.[0] && hpid, 'el token no trae tenant y perfil profesional').toBeTruthy();

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
        timeZone: 'America/La_Paz',
      },
    }),
  );

  const inicio = new Date();
  inicio.setDate(inicio.getDate() + 1);
  inicio.setHours(10, 0, 0, 0);
  await json(
    'cita confirmada de mañana',
    await api.post('/scheduling/appointments/direct', {
      headers: auth,
      data: {
        patientProfileId: paciente.perfil,
        resourceId: agenda.id,
        startAt: inicio.toISOString(),
        durationMinutes: 30,
        reasonText: 'Control de presión',
      },
    }),
  );

  return {
    paciente: { identificador: paciente.identificador, clave, token: paciente.token },
    tokenMedica,
    resourceId: agenda.id,
    inicio,
    corrida,
  };
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

/** Suscripción con claves de forma válida (punto P-256 real y secreto de 16 bytes). */
function suscripcion(sufijo: string) {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  return {
    endpoint: `https://fcm.googleapis.com/fcm/send/e2e-${sufijo}`,
    keys: {
      p256dh: ecdh.getPublicKey().toString('base64url'),
      auth: randomBytes(16).toString('base64url'),
    },
  };
}

function huellaDe(endpoint: string): string {
  return `webpush:${createHash('sha256').update(endpoint).digest('hex')}`;
}

function consultaBase(sql: string): string {
  return execFileSync(
    'docker',
    [
      'exec',
      'mantra-redesa-postgres-1',
      'psql',
      '-U',
      'mantra',
      '-d',
      'mantra_redesa_health',
      '-tAc',
      sql,
    ],
    { encoding: 'utf8' },
  ).trim();
}

test('la configuración pública trae la clave VAPID y se rechazan direcciones ajenas', async () => {
  const auth = { Authorization: `Bearer ${escenario.paciente.token}` };
  const config = await json<{ enabled: boolean; publicKey: string | null }>(
    'config',
    await api.get('/notifications/web-push/config', { headers: auth }),
  );
  expect(config.enabled).toBe(true);
  expect(config.publicKey).toBeTruthy();

  for (const endpoint of [
    'https://evil.example.com/push',
    'http://fcm.googleapis.com/fcm/send/x',
    'https://fcm.googleapis.com.evil.com/x',
  ]) {
    const rechazo = await api.put('/notifications/web-push/subscription', {
      headers: auth,
      data: { endpoint, keys: suscripcion('x').keys },
    });
    expect(rechazo.status(), endpoint).toBe(400);
  }
});

test('la suscripción queda cifrada y un navegador pertenece a una cuenta a la vez', async () => {
  const auth = { Authorization: `Bearer ${escenario.paciente.token}` };
  const sub = suscripcion(escenario.corrida);
  const huella = huellaDe(sub.endpoint);
  const ok = await api.put('/notifications/web-push/subscription', { headers: auth, data: sub });
  expect(ok.status(), await ok.text()).toBe(204);

  const guardado = consultaBase(
    `select push_token_encrypted from iam.devices where device_fingerprint = '${huella}'`,
  );
  expect(guardado.length).toBeGreaterThan(40);
  expect(guardado).not.toContain('fcm.googleapis.com');
  expect(guardado).not.toContain(sub.keys.auth);

  // Otra cuenta en el mismo navegador: la anterior deja de recibir.
  const otra = await registrarPaciente(api, escenario.corrida, 'OtraClave-2026!', 'b');
  const traspaso = await api.put('/notifications/web-push/subscription', {
    headers: { Authorization: `Bearer ${otra.token}` },
    data: sub,
  });
  expect(traspaso.status()).toBe(204);
  const vivas = consultaBase(
    `select count(*) from iam.devices where device_fingerprint = '${huella}' and push_token_encrypted is not null`,
  );
  expect(vivas).toBe('1');

  // Vuelve la paciente original para el caso siguiente.
  const devuelta = await api.put('/notifications/web-push/subscription', {
    headers: auth,
    data: sub,
  });
  expect(devuelta.status()).toBe(204);
  expect(
    consultaBase(
      `select count(*) from iam.devices where device_fingerprint = '${huella}' and push_token_encrypted is not null`,
    ),
  ).toBe('1');
});

test('al bloquear la agenda, la paciente recibe el aviso y el servidor intenta el push', async () => {
  const medica = { Authorization: `Bearer ${escenario.tokenMedica}` };
  const huella = huellaDe(suscripcion(escenario.corrida).endpoint);
  const antes = readFileSync(RUTA_REGISTRO, 'utf8').length;

  const fin = new Date(escenario.inicio.getTime() + 30 * 60_000);
  const bloqueo = await api.post(`/scheduling/resources/${escenario.resourceId}/exceptions`, {
    headers: medica,
    data: {
      exceptionType: 'OTHER',
      startAt: escenario.inicio.toISOString(),
      endAt: fin.toISOString(),
      reason: 'Viaje a La Paz',
      cancelAffectedBookings: true,
    },
  });
  expect(bloqueo.status(), await bloqueo.text()).toBe(201);

  const auth = { Authorization: `Bearer ${escenario.paciente.token}` };
  await expect
    .poll(
      async () => {
        const bandeja = await api.get('/notifications/me', { headers: auth });
        const { items } = (await bandeja.json()) as { items: { subject?: string }[] };
        return items.some((n) => /se cancel/i.test(n.subject ?? ''));
      },
      { timeout: 30_000, message: 'la bandeja no recibió la cancelación' },
    )
    .toBe(true);

  // El intento deja rastro: o el servicio de Google lo rechazó (queda en el
  // registro) o respondió 404/410 y la suscripción muerta se retiró.
  await expect
    .poll(
      () => {
        const nuevo = readFileSync(RUTA_REGISTRO, 'utf8').slice(antes);
        if (/messaging\.web-push\.(device|send)/.test(nuevo)) return 'rechazado y registrado';
        const viva = consultaBase(
          `select count(*) from iam.devices where device_fingerprint = '${huella}' and push_token_encrypted is not null`,
        );
        return viva === '0' ? 'suscripción muerta retirada' : 'sin intento';
      },
      { timeout: 40_000, message: 'el servidor no intentó el push' },
    )
    .not.toBe('sin intento');
});
