import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { apiViva, contextoDeApi, urlDeApi } from './support/actores';
import { entrar, estable, irA } from './support/sesion';

/**
 * Carril 12 — «agenda de hoy»: el calendario de `/schedule`.
 *
 * ## Qué cubre esta suite
 *
 * Es un barrido de **evidencia visual y de acabado**, no la suite de negocio
 * de la ficha completa (mover N minutos, cancelar-bloquea, etc. tienen su
 * propia prueba). Lo que se verifica acá:
 *
 * 1. Las tres vistas (día, semana, mes) cargan sobre datos reales de la API
 *    viva, sin simular ninguna respuesta.
 * 2. Ninguna de las tres produce scroll horizontal en 390, 768 ni 1440 px
 *    (AC-12-14).
 * 3. La paginación del día («Ayer» / «Mañana») y la de la semana cambian el
 *    encabezado sin recargar la página.
 * 4. La cita sembrada se ve en la semana y su detalle abre un diálogo con
 *    `role="dialog"` que cierra con Escape.
 *
 * ## Por qué se reescribió (2026-10-25)
 *
 * La versión anterior entraba por `/schedule/mine`, que ya no existe: desde
 * C-08 (20/09) el calendario ES la solapa «Consultas» de `/schedule`
 * (`agenda.html`, `app-my-agenda mode="calendar"`), que abre en el día y ofrece
 * Semana y Mes a un toque. Además dependía de la médica demo, que nace sin
 * agenda: sin recurso propio `/schedule` no dibuja el calendario
 * (`agenda.ts`, `tieneCalendario`). Ahora la prueba crea sus datos por el
 * camino real, igual que los carriles 11, 14 y 15.
 *
 * ## Por qué cada ancho es su propia sesión
 *
 * El `shell` decide una sola vez, al construirse, si el panel de navegación va
 * abierto o en cajón — no escucha `resize`. Redimensionar en caliente deja el
 * panel abierto tapando media pantalla, algo que nadie ve en un uso real.
 *
 * Exige el front en `start:real-api` y la API levantada:
 *   E2E_API_REAL=1 E2E_API_URL=http://localhost:3000 E2E_BASE_URL=http://localhost:4200
 */

const API_REAL = process.env['E2E_API_REAL'] === '1';
/** `VS_BO_DEPARTMENT · Santa Cruz`, sembrado por el stack de desarrollo. */
const DEPARTAMENTO_SC = '16fe92e8-bec7-577d-9e63-4a0d8ff3b0e4';
/** Municipio sembrado (Sucre), el mismo que usan los carriles 11 y 13. */
const MUNICIPIO = '5132db42-8cb1-52d6-88f5-0e9a04bdc94c';

const CAPTURAS = join(__dirname, '..', 'artifacts', 'playwright', 'tarea-12');

test.describe.configure({ mode: 'serial' });
test.skip(
  !API_REAL,
  'Omitido: hace falta E2E_API_REAL=1 con la API y el front en modo real-api. No es un verde.',
);

interface Ancho {
  readonly nombre: string;
  readonly width: number;
  readonly height: number;
}

const ANCHOS: readonly Ancho[] = [
  { nombre: '390x844', width: 390, height: 844 },
  { nombre: '768x1024', width: 768, height: 1024 },
  { nombre: '1440x900', width: 1440, height: 900 },
];

interface Medica {
  readonly identificador: string;
  readonly clave: string;
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

/** Médica con agenda y horario publicados, y una cita confirmada para mañana a las 10:00. */
async function prepararMedica(api: APIRequestContext): Promise<Medica> {
  const corrida = Date.now().toString(36);
  const clave = `Agenda-${corrida}-2026!`;
  const medica = { identificador: `medica.agenda.${corrida}@alovida.test`, clave };
  const nationalIdPaciente = `PAGH${corrida}`;

  await json(
    'alta de la médica',
    await api.post('/iam/auth/register-practitioner', {
      data: {
        email: medica.identificador,
        password: clave,
        name: 'Lucía',
        lastName: 'Méndez',
        licenseNumber: `MP-AGH-${corrida}`,
        sedesLicenseNumber: `SEDES-${corrida}`,
        professionalTitle: 'Médico',
        nationalId: `AGH${corrida}`,
        issuerAdministrativeAreaConceptId: DEPARTAMENTO_SC,
        residenceMunicipalityConceptId: MUNICIPIO,
      },
    }),
  );
  await json(
    'alta de la paciente',
    await api.post('/iam/auth/register-patient', {
      data: {
        nationalId: nationalIdPaciente,
        issuerAdministrativeAreaConceptId: DEPARTAMENTO_SC,
        residenceMunicipalityConceptId: MUNICIPIO,
        password: clave,
        email: `paciente.agenda.${corrida}@alovida.test`,
        name: 'Carmen',
        lastName: 'Vaca',
        birthDate: '1985-07-02',
        phone: '70054321',
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
      data: { nationalId: nationalIdPaciente, password: clave },
    }),
  );
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
        name: 'Consultorio Lucía Méndez',
      },
    }),
  );

  // Sin horario publicado `/schedule` muestra «Todavía no publicó su horario»
  // en vez del calendario. Se publica uno de lunes a domingo para que el día,
  // la semana y el mes tengan cupos que dibujar sea cual sea el día de la corrida.
  const plantilla = await json<{ id: string }>(
    'horario de la médica',
    await api.post(`/scheduling/resources/${agenda.id}/templates`, {
      headers: auth,
      data: {
        name: 'Horario de Lucía Méndez',
        slotMinutes: 30,
        rules: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
          dayOfWeek,
          startTime: '08:00',
          endTime: '12:00',
          slotMinutes: 30,
        })),
      },
    }),
  );
  const desde = new Date();
  const hasta = new Date();
  hasta.setUTCDate(hasta.getUTCDate() + 9);
  await json(
    'cupos del horario',
    await api.post(`/scheduling/templates/${plantilla.id}/generate-slots`, {
      headers: auth,
      data: { from: desde.toISOString(), to: hasta.toISOString() },
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
        patientProfileId: pid,
        resourceId: agenda.id,
        startAt: inicio.toISOString(),
        durationMinutes: 30,
        reasonText: 'Control general',
      },
    }),
  );

  return medica;
}

async function capturar(page: Page, nombre: string): Promise<void> {
  mkdirSync(CAPTURAS, { recursive: true });
  await page.screenshot({ path: join(CAPTURAS, `${nombre}.png`), fullPage: true });
}

/** `scrollWidth <= clientWidth`, tal como pide AC-12-14. */
async function comprobarSinScrollHorizontal(page: Page, etiqueta: string): Promise<void> {
  const medidas = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    medidas.scrollWidth,
    `${etiqueta}: scrollWidth (${medidas.scrollWidth}) > clientWidth (${medidas.clientWidth}) — hay scroll horizontal`,
  ).toBeLessThanOrEqual(medidas.clientWidth);
}

async function texto(page: Page, selector: string): Promise<string> {
  return ((await page.locator(selector).first().textContent()) ?? '').trim();
}

let api: APIRequestContext;
let medica: Medica;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  api = await contextoDeApi();
  expect(await apiViva(api), `La API no responde en ${urlDeApi()}.`).toBe(true);
  medica = await prepararMedica(api);
});

test.afterAll(async () => {
  await api?.dispose();
});

for (const ancho of ANCHOS) {
  test.describe(`Carril 12 · agenda de hoy · ${ancho.nombre}`, () => {
    test.use({ viewport: { width: ancho.width, height: ancho.height } });

    test(`día, semana y mes en ${ancho.nombre}`, async ({ page }) => {
      test.setTimeout(150_000);
      await entrar(page, {
        rol: 'doctora',
        identificador: medica.identificador,
        clave: medica.clave,
        nombre: 'médica de la agenda',
      });
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await irA(page, '/schedule');
      await estable(page);

      // «Consultas» es el calendario y abre por defecto en el día de hoy.
      await expect(page.getByTestId('agenda-calendario')).toBeVisible();

      await test.step('la vista del día: paginación y sin scroll horizontal', async () => {
        await expect(page.locator('.dia')).toBeVisible();
        const hoy = await texto(page, '.dia__titulo');

        // «Un botón de ver mañana, y así sucesivamente» (punto 5, AC-12-5).
        await page.getByTestId('dia-siguiente').click();
        await expect.poll(() => texto(page, '.dia__titulo')).not.toBe(hoy);
        await page.getByTestId('dia-anterior').click();
        await expect.poll(() => texto(page, '.dia__titulo')).toBe(hoy);

        await capturar(page, `dia-${ancho.nombre}`);
        await comprobarSinScrollHorizontal(page, `día en ${ancho.nombre}`);
      });

      await test.step('la vista de semana: paginación, la cita y su detalle', async () => {
        await page.getByTestId('ver-semana').click();
        await expect(page.locator('.semana__dias')).toBeVisible();
        const inicial = await texto(page, '.semana__titulo');

        // «Cada uno con su respectiva paginación de adelante y atrás» (punto 8).
        await page.getByTestId('semana-siguiente').click();
        await expect.poll(() => texto(page, '.semana__titulo')).not.toBe(inicial);
        await page.getByTestId('semana-anterior').click();
        await expect.poll(() => texto(page, '.semana__titulo')).toBe(inicial);

        // La cita es de mañana y la semana empieza el lunes: si hoy es
        // domingo, cae en la siguiente. Se decide por la fecha, no por si la
        // cita ya se ve, que depende de cuándo termina de cargar.
        if (new Date().getDay() === 0) {
          await page.getByTestId('semana-siguiente').click();
          await expect.poll(() => texto(page, '.semana__titulo')).not.toBe(inicial);
        }
        const cita = page.getByTestId('semana-cita');
        await expect(cita.first(), 'la cita sembrada no aparece en la semana').toBeVisible();

        if (ancho.nombre === '1440x900') {
          await cita.first().click();
          const dialogo = page.getByRole('dialog', { name: 'Detalle de la cita' });
          await expect(dialogo).toBeVisible();
          await capturar(page, 'semana-modal-detalle-1440x900');
          await page.keyboard.press('Escape');
          await expect(dialogo).toBeHidden();
        }

        await capturar(page, `semana-${ancho.nombre}`);
        await comprobarSinScrollHorizontal(page, `semana en ${ancho.nombre}`);
      });

      await test.step('la vista del mes: grilla de ocupación, sin scroll horizontal', async () => {
        await page.getByTestId('ver-mes').click();
        await expect(page.locator('.mes__grilla')).toBeVisible();
        await capturar(page, `mes-${ancho.nombre}`);
        await comprobarSinScrollHorizontal(page, `mes en ${ancho.nombre}`);
      });
    });
  });
}
