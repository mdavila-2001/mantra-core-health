import { expect, test, type APIRequestContext } from '@playwright/test';

import { apiViva, contextoDeApi, urlDeApi } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Carril 07 · derivar a otro profesional desde la consulta (pedido del
 * propietario, 24/10/2026): la médica, atendiendo, recomienda a la paciente que
 * consulte con otra colega; a la paciente le llega el aviso en su campana, lo
 * abre y cae en la ficha de la colega, donde reserva con la reserva de siempre.
 *
 * ## Datos propios, por el camino real
 *
 * Dos médicas y una paciente nuevas, la agenda de la primera y una cita
 * confirmada de la paciente con ella (AG-2) — lo que le da a la médica el
 * acceso a la historia —. Nada se toma del entorno.
 *
 * Exige el front en `start:real-api` y la API levantada:
 *   E2E_API_REAL=1 E2E_API_URL=http://localhost:3000 E2E_BASE_URL=http://localhost:4289
 */

const API_REAL = process.env['E2E_API_REAL'] === '1';
/** `VS_BO_DEPARTMENT · Santa Cruz`, sembrado por el stack de desarrollo. */
const DEPARTAMENTO_SC = '16fe92e8-bec7-577d-9e63-4a0d8ff3b0e4';
/** Municipio sembrado (Sucre), el mismo que usan los carriles 11 a 13. */
const MUNICIPIO = '5132db42-8cb1-52d6-88f5-0e9a04bdc94c';

test.describe.configure({ mode: 'serial' });
test.skip(
  !API_REAL,
  'Omitido: hace falta E2E_API_REAL=1 con la API y el front en modo real-api. No es un verde.',
);
test.setTimeout(180_000);

interface Escenario {
  readonly medica: { identificador: string; clave: string };
  readonly paciente: { identificador: string; clave: string; token: string; perfil: string };
  /** La colega a quien se deriva. */
  readonly colega: { perfil: string; nombre: string };
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

async function registrarMedica(
  api: APIRequestContext,
  corrida: string,
  clave: string,
  quien: { correo: string; nombre: string; apellido: string; matricula: string; documento: string },
): Promise<string> {
  await json(
    `alta de ${quien.nombre}`,
    await api.post('/iam/auth/register-practitioner', {
      data: {
        email: quien.correo,
        password: clave,
        name: quien.nombre,
        lastName: quien.apellido,
        licenseNumber: quien.matricula,
        sedesLicenseNumber: `SEDES-${quien.matricula}`,
        professionalTitle: 'Médico',
        nationalId: quien.documento,
        issuerAdministrativeAreaConceptId: DEPARTAMENTO_SC,
        residenceMunicipalityConceptId: MUNICIPIO,
      },
    }),
  );
  const { accessToken } = await json<{ accessToken: string }>(
    `login de ${quien.nombre}`,
    await api.post('/iam/auth/login', { data: { email: quien.correo, password: clave } }),
  );
  const { hpid } = claims(accessToken) as { hpid?: string };
  expect(hpid, `el token de ${quien.nombre} no trae perfil profesional (${corrida})`).toBeTruthy();
  return accessToken;
}

async function prepararEscenario(api: APIRequestContext): Promise<Escenario> {
  const corrida = Date.now().toString(36);
  const clave = `Derivar-${corrida}-2026!`;

  const medica = { identificador: `medica.derivar.${corrida}@alovida.test`, clave };
  const tokenMedica = await registrarMedica(api, corrida, clave, {
    correo: medica.identificador,
    nombre: 'Marcela',
    apellido: 'Quiroga',
    matricula: `MP-DER-A-${corrida}`,
    documento: `DERA${corrida}`,
  });

  // La colega lleva un apellido que ninguna otra cuenta de la base tiene, para
  // encontrarla en el buscador sin depender de lo que haya sembrado.
  const apellidoColega = `Zambrana${corrida}`;
  const correoColega = `colega.derivar.${corrida}@alovida.test`;
  const tokenColega = await registrarMedica(api, corrida, clave, {
    correo: correoColega,
    nombre: 'Ximena',
    apellido: apellidoColega,
    matricula: `MP-DER-B-${corrida}`,
    documento: `DERB${corrida}`,
  });

  const paciente = { identificador: `PDER${corrida}`, clave, token: '', perfil: '' };
  await json(
    'alta de la paciente',
    await api.post('/iam/auth/register-patient', {
      data: {
        nationalId: paciente.identificador,
        issuerAdministrativeAreaConceptId: DEPARTAMENTO_SC,
        residenceMunicipalityConceptId: MUNICIPIO,
        password: clave,
        email: `paciente.derivar.${corrida}@alovida.test`,
        name: 'Gabriela',
        lastName: 'Lara',
        birthDate: '1991-11-09',
        phone: '70055577',
        sexAtBirth: 'FEMALE',
      },
    }),
  );
  const { accessToken: tokenPaciente } = await json<{ accessToken: string }>(
    'login de la paciente',
    await api.post('/iam/auth/login', {
      data: { nationalId: paciente.identificador, password: clave },
    }),
  );
  paciente.token = tokenPaciente;
  const { pid } = claims(tokenPaciente) as { pid?: string };
  expect(pid).toBeTruthy();
  paciente.perfil = pid!;

  // La cita confirmada de la paciente con la primera médica: por ella la médica
  // tiene la historia a la vista y la consulta puede abrirse.
  const authMedica = { Authorization: `Bearer ${tokenMedica}` };
  const { tenants, hpid } = claims(tokenMedica) as { tenants?: string[]; hpid?: string };
  const agenda = await json<{ id: string }>(
    'agenda de la médica',
    await api.post('/scheduling/resources', {
      headers: authMedica,
      data: {
        tenantId: tenants![0],
        resourceType: 'PRACTITIONER',
        resourceRefType: 'health_practitioner_profiles',
        resourceRefId: hpid,
        name: 'Consultorio Marcela Quiroga',
        timeZone: 'America/La_Paz',
      },
    }),
  );
  const inicio = new Date();
  inicio.setDate(inicio.getDate() + 1);
  inicio.setHours(10, 0, 0, 0);
  await json(
    'cita de la paciente',
    await api.post('/scheduling/appointments/direct', {
      headers: authMedica,
      data: {
        patientProfileId: pid,
        resourceId: agenda.id,
        startAt: inicio.toISOString(),
        durationMinutes: 30,
        reasonText: 'Control de la tiroides',
      },
    }),
  );

  // La relación asistencial: sin ella la historia de la paciente no es de la
  // médica («Sólo puede consultar su propia historia clínica»). La médica la
  // pide y la paciente la acepta, igual que en «Solicitudes de acceso».
  const solicitud = await json<{ id: string }>(
    'solicitud de relación asistencial',
    await api.post('/authz/care-relationships/request', {
      headers: authMedica,
      data: {
        tenantId: tenants![0],
        patientProfileId: pid,
        relationshipType: 'TREATING',
        reasonText: 'Control de la tiroides',
      },
    }),
  );
  await json(
    'la paciente acepta la relación',
    await api.post(`/authz/care-relationships/${solicitud.id}/respond`, {
      headers: { Authorization: `Bearer ${tokenPaciente}` },
      data: { decision: 'ACCEPT' },
    }),
  );

  const { hpid: perfilColega } = claims(tokenColega) as { hpid?: string };
  return {
    medica,
    paciente,
    colega: { perfil: perfilColega!, nombre: `Ximena ${apellidoColega}` },
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

test('la médica deriva desde la consulta: busca a su colega, escribe el motivo y la derivación queda emitida', async ({
  page,
}, testInfo) => {
  await entrar(page, {
    rol: 'doctora',
    identificador: escenario.medica.identificador,
    clave: escenario.medica.clave,
    nombre: 'médica que deriva',
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await irA(page, `/medical-records/${escenario.paciente.perfil}/consultation`);
  await estable(page);

  /* -- 1 · el encuentro: sin él no hay derivación con aviso ------------------ */

  await page.getByTestId('consulta-abrir-encuentro').click();
  await expect(page.getByTestId('encuentros-en-curso')).toBeVisible();

  /* -- 2 · «Derivar» es una casilla más de la rejilla ------------------------ */

  await page.getByTestId('consulta-casilla-derivacion').click();
  // El contenedor del modal no tiene caja propia; lo visible es el diálogo.
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByTestId('derivacion-sin-encuentro')).toHaveCount(0);

  /* -- 3 · busca a la colega por su apellido y la elige ---------------------- */

  const apellido = escenario.colega.nombre.split(' ')[1]!;
  await page.getByTestId('derivacion-profesional').locator('input').fill(apellido);
  await page.getByRole('option', { name: new RegExp(apellido) }).click();
  await page
    .getByTestId('derivacion-motivo')
    .locator('textarea')
    .fill('Control de la tiroides: conviene que la vea endocrinología');
  await page.screenshot({ path: testInfo.outputPath('derivar-formulario.png'), fullPage: true });
  await testInfo.attach('derivar-formulario', {
    path: testInfo.outputPath('derivar-formulario.png'),
    contentType: 'image/png',
  });

  /* -- 4 · envía: el pedido lleva el encuentro y NO quién deriva ------------- */

  const [respuesta] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/referrals') && r.request().method() === 'POST'),
    page.getByTestId('derivacion-enviar').click(),
  ]);
  expect(respuesta.status(), await respuesta.text()).toBe(201);
  const cuerpo = respuesta.request().postDataJSON() as Record<string, unknown>;
  expect(cuerpo['targetProfileId']).toBe(escenario.colega.perfil);
  expect(cuerpo['patientProfileId']).toBe(escenario.paciente.perfil);
  expect(cuerpo['sourceEncounterId']).toBeTruthy();
  expect(cuerpo['referringProfileId']).toBeUndefined();
});

test('a la paciente le llega el aviso, lo abre y cae en la ficha de la colega, donde reserva', async ({
  page,
}, testInfo) => {
  const auth = { Authorization: `Bearer ${escenario.paciente.token}` };

  await expect
    .poll(
      async () => {
        const bandeja = await api.get('/notifications/me', { headers: auth });
        if (!bandeja.ok()) return `HTTP ${bandeja.status()}`;
        const { items } = (await bandeja.json()) as {
          items: {
            subject?: string;
            bodyText?: string;
            destination?: { type: string; id: string };
          }[];
        };
        const aviso = items.find((n) => /recomienda otra consulta/i.test(n.subject ?? ''));
        return aviso
          ? `${aviso.destination?.type}:${aviso.destination?.id} · ${aviso.bodyText ?? ''}`
          : 'sin aviso todavía';
      },
      { timeout: 30_000, message: 'la bandeja de la paciente no recibió la derivación' },
    )
    .toContain(`PRACTITIONER_PROFILE:${escenario.colega.perfil}`);

  await entrar(page, {
    rol: 'paciente',
    identificador: escenario.paciente.identificador,
    clave: escenario.paciente.clave,
    nombre: 'paciente derivada',
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await irA(page, '/notification-center');
  await estable(page);

  const aviso = page
    .getByTestId('aviso')
    .filter({ hasText: 'Su médico le recomienda otra consulta' });
  await expect(aviso).toContainText('Marcela Quiroga');
  await expect(aviso).toContainText(escenario.colega.nombre);
  await page.screenshot({ path: testInfo.outputPath('aviso-derivacion.png'), fullPage: true });
  await testInfo.attach('aviso-derivacion', {
    path: testInfo.outputPath('aviso-derivacion.png'),
    contentType: 'image/png',
  });

  await aviso.click();
  await expect(page).toHaveURL(new RegExp(`/directory/${escenario.colega.perfil}$`));
  await estable(page);
  await expect(page.locator('app-root')).toContainText(escenario.colega.nombre.split(' ')[1]!);
  await page.screenshot({ path: testInfo.outputPath('ficha-colega.png'), fullPage: true });
  await testInfo.attach('ficha-colega', {
    path: testInfo.outputPath('ficha-colega.png'),
    contentType: 'image/png',
  });
});
