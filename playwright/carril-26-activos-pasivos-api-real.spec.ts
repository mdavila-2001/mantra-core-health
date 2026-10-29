import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { contextoDeApi } from './support/actores';
import { entrar, irA } from './support/sesion';

/**
 * Carril 26 — activos y pasivos del profesional contra la API real.
 *
 * Siembra por el camino real: alta de la médica (`register-practitioner`),
 * consultorio propio (`POST /practitioners/me/sites`) y, como el plan de
 * cuentas y el ejercicio fiscal sólo los puede crear `SECURITY_ADMIN`
 * (`accounting-ledger.controller.ts`, `accounting-fiscal.controller.ts`), el
 * administrador de arranque (`E2E_BOOTSTRAP_ADMIN_EMAIL`/`_PASSWORD`) le arma
 * siete cuentas y el ejercicio del año en curso. El activo y el pasivo se dan
 * de alta por la API; lo que se ejercita en pantalla es lo nuevo del carril:
 * registrar avance, ver el histórico de depreciación y el cronograma, y el
 * interruptor de automatización persistido.
 */

const API_REAL = process.env['E2E_API_REAL'] === '1';
const ADMIN_EMAIL = process.env['E2E_BOOTSTRAP_ADMIN_EMAIL'] ?? '';
const ADMIN_PASSWORD = process.env['E2E_BOOTSTRAP_ADMIN_PASSWORD'] ?? '';
const DEPARTAMENTO_SC = '16fe92e8-bec7-577d-9e63-4a0d8ff3b0e4';
const MUNICIPIO = '5132db42-8cb1-52d6-88f5-0e9a04bdc94c';
const RUTA = '/administration/accounting/assets-liabilities';
const EVIDENCIA = '../docs/progress/evidence/lane-26';

test.describe.configure({ mode: 'serial' });
test.skip(
  !API_REAL || ADMIN_EMAIL === '',
  'Omitido: hace falta E2E_API_REAL=1 y el administrador de arranque. No es un verde.',
);

interface Escenario {
  readonly medica: { identificador: string; clave: string };
  readonly token: string;
  readonly practiceId: string;
  readonly assetId: string;
  readonly liabilityId: string;
}

let api: APIRequestContext;
let escenario: Escenario;

async function json<T>(paso: string, respuesta: Awaited<ReturnType<APIRequestContext['post']>>): Promise<T> {
  expect(respuesta.ok(), `${paso}: ${respuesta.status()} ${await respuesta.text()}`).toBe(true);
  return (await respuesta.json()) as T;
}

function claims(token: string): Record<string, unknown> {
  const cuerpo = token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(
    Buffer.from(cuerpo + '='.repeat((4 - (cuerpo.length % 4)) % 4), 'base64').toString('utf8'),
  ) as Record<string, unknown>;
}

async function login(email: string, password: string): Promise<string> {
  const { accessToken } = await json<{ accessToken: string }>(
    `login ${email}`,
    await api.post('/iam/auth/login', { data: { email, password } }),
  );
  return accessToken;
}

async function prepararEscenario(): Promise<Escenario> {
  const corrida = Date.now().toString(36);
  const clave = `Activos-${corrida}-2026!`;
  const medica = { identificador: `medica.c26.${corrida}@alovida.test`, clave };
  await json(
    'alta de la médica',
    await api.post('/iam/auth/register-practitioner', {
      data: {
        email: medica.identificador,
        password: clave,
        name: 'Lucía',
        lastName: 'Paz',
        licenseNumber: `MP-C26-${corrida}`,
        sedesLicenseNumber: `SEDES-C26-${corrida}`,
        professionalTitle: 'Médico',
        nationalId: `C26${corrida}`,
        issuerAdministrativeAreaConceptId: DEPARTAMENTO_SC,
        residenceMunicipalityConceptId: MUNICIPIO,
      },
    }),
  );
  await json(
    'consultorio propio',
    await api.post('/practitioners/me/sites', {
      headers: { Authorization: `Bearer ${await login(medica.identificador, clave)}` },
      data: { name: 'Consultorio Lucía Paz' },
    }),
  );
  const token = await login(medica.identificador, clave);
  const auth = { Authorization: `Bearer ${token}` };
  const [practica] = await json<{ id: string }[]>('prácticas', await api.get('/practices', { headers: auth }));
  const practiceId = practica!.id;
  const tenantId = (claims(token)['tenants'] as string[])[0]!;

  const admin = { Authorization: `Bearer ${await login(ADMIN_EMAIL, ADMIN_PASSWORD)}`, 'X-Tenant-Id': tenantId };
  const cuentas: Record<string, string> = {};
  for (const [code, name, accountType, normalBalance] of [
    ['1201', 'Equipo médico', 'ASSET', 'DEBIT'],
    ['1101', 'Banco', 'ASSET', 'DEBIT'],
    ['1209', 'Depreciación acumulada', 'ASSET', 'CREDIT'],
    ['2101', 'Préstamo bancario', 'LIABILITY', 'CREDIT'],
    ['6101', 'Gasto por depreciación', 'EXPENSE', 'DEBIT'],
    ['6201', 'Gasto por interés', 'EXPENSE', 'DEBIT'],
    ['3101', 'Capital', 'EQUITY', 'CREDIT'],
  ] as const) {
    const { id } = await json<{ id: string }>(
      `cuenta ${code}`,
      await api.post('/accounting/accounts', {
        headers: admin,
        data: { practiceId, code, name, accountType, normalBalance },
      }),
    );
    cuentas[code] = id;
  }
  const year = new Date().getUTCFullYear();
  const periods = Array.from({ length: 12 }, (_, m) => {
    const last = new Date(Date.UTC(year, m + 1, 0)).getUTCDate();
    const mm = String(m + 1).padStart(2, '0');
    return { code: `${year}-${mm}`, startDate: `${year}-${mm}-01`, endDate: `${year}-${mm}-${last}` };
  });
  await json(
    'ejercicio fiscal',
    await api.post('/accounting/fiscal-years', {
      headers: admin,
      data: { practiceId, code: `FY${year}`, startDate: `${year}-01-01`, endDate: `${year}-12-31`, periods },
    }),
  );

  const mesActual = new Date().toISOString().slice(0, 7);
  const { id: assetId } = await json<{ id: string }>(
    'alta del activo',
    await api.post('/accounting/practitioner/assets', {
      headers: auth,
      data: {
        practiceId,
        code: 'EQ-ECO-1',
        name: 'Ecógrafo portátil',
        acquisitionAccountId: cuentas['1201'],
        offsetAccountId: cuentas['3101'],
        acquisitionCost: '1000.00',
        acquisitionDate: `${mesActual}-01`,
        usefulLifeMonths: 3,
        salvageValue: '0.00',
      },
    }),
  );
  const { id: liabilityId } = await json<{ id: string }>(
    'alta del pasivo',
    await api.post('/accounting/practitioner/liabilities', {
      headers: auth,
      data: {
        practiceId,
        code: 'PR-BCO-1',
        name: 'Préstamo del ecógrafo',
        creditorName: 'Banco Unión',
        accountId: cuentas['2101'],
        principalAmount: '1000.00',
        interestRate: '12.00',
        installments: 3,
        startDate: '2026-10-01',
      },
    }),
  );
  return { medica, token, practiceId, assetId, liabilityId };
}

async function elegirCuenta(page: Page, campo: string, cuenta: RegExp): Promise<void> {
  await page.getByRole('combobox', { name: campo }).click();
  await page.getByRole('option', { name: cuenta }).click();
}

test.beforeAll(async () => {
  api = await contextoDeApi();
  escenario = await prepararEscenario();
});

test.afterAll(async () => {
  await api.dispose();
});

test('activos: registrar avance, ver el histórico y apagar la automatización', async ({ page }) => {
  const consola: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consola.push(m.text());
  });
  const fallos: string[] = [];
  page.on('response', (r) => {
    if (r.url().includes('/accounting/') && r.status() >= 500) fallos.push(`${r.status()} ${r.url()}`);
  });

  await entrar(page, { rol: 'doctora', nombre: 'Lucía Paz', ...escenario.medica });
  await irA(page, RUTA);
  await expect(page.getByRole('heading', { name: 'Activos y pasivos' })).toBeVisible();
  await expect(page.getByText('EQ-ECO-1 — Ecógrafo portátil')).toBeVisible();

  await page.getByRole('button', { name: 'Ver historial: Ecógrafo portátil' }).click();
  await expect(page.getByText('Este activo todavía no tiene depreciaciones registradas.')).toBeVisible();

  await elegirCuenta(page, 'Cuenta de gasto por depreciación', /Gasto por depreciación/);
  await elegirCuenta(page, 'Cuenta de depreciación acumulada', /Depreciación acumulada/);
  await page.getByRole('button', { name: 'Registrar avance: Ecógrafo portátil' }).click();

  const historial = page.getByRole('region', { name: 'Historial de depreciación: Ecógrafo portátil' });
  const fila = historial.locator('tbody tr').first();
  await expect(fila).toContainText(new Date().toISOString().slice(0, 7));
  await expect(fila).toContainText('333.33');
  await expect(fila).toContainText('666.67');
  await expect(historial).toContainText('Depreciación acumulada: 333.33 de 1000.00');
  await expect(page.getByText('Valor en libros: 666.67')).toBeVisible();

  // El mismo período no se deprecia dos veces: la API lo rechaza y la pantalla lo dice.
  await page.getByRole('button', { name: 'Registrar avance: Ecógrafo portátil' }).click();
  await expect(page.getByText(/No hay activos elegibles para depreciar/)).toBeVisible();
  await expect(historial.locator('tbody tr')).toHaveCount(1);

  const interruptor = page.getByRole('switch', { name: 'Automatizado' }).first();
  await expect(interruptor).toHaveAttribute('aria-checked', 'true');
  // El `<input role="switch">` está oculto bajo su pista: se toca el rótulo, como el usuario.
  await page.getByText('Automatizado', { exact: true }).first().click();
  await expect(interruptor).toHaveAttribute('aria-checked', 'false');

  await page.screenshot({ path: `${EVIDENCIA}/activos-historial-1440.png`, fullPage: true });
  await page.locator('li.item', { has: historial }).screenshot({ path: `${EVIDENCIA}/activos-historial-item-1440.png` });

  // Persistido: lo confirma la API, no la pantalla.
  await expect
    .poll(async () => {
      const r = await api.get(`/accounting/practitioner/assets?practiceId=${escenario.practiceId}`, {
        headers: { Authorization: `Bearer ${escenario.token}` },
      });
      const [activo] = (await r.json()) as { automated: boolean }[];
      return activo?.automated;
    })
    .toBe(false);

  expect(fallos).toEqual([]);
  expect(consola.filter((t) => !t.includes('422'))).toEqual([]);
});

test('pasivos: pagar las cuotas, ver el cronograma y el pasivo saldado', async ({ page }) => {
  await entrar(page, { rol: 'doctora', nombre: 'Lucía Paz', ...escenario.medica });
  await irA(page, RUTA);
  await page.getByRole('tab', { name: 'Pasivos' }).click();
  await expect(page.getByText('PR-BCO-1 — Préstamo del ecógrafo')).toBeVisible();

  await elegirCuenta(page, 'Cuenta banco/tesorería', /Banco/);
  await elegirCuenta(page, 'Cuenta de gasto por interés', /Gasto por interés/);
  await page.getByRole('button', { name: 'Ver cronograma: Préstamo del ecógrafo' }).click();

  const cronograma = page.getByRole('region', { name: 'Cronograma de cuotas: Préstamo del ecógrafo' });
  await expect(cronograma.locator('tbody tr')).toHaveCount(3);
  // Vencimientos en el mismo día de cada mes (antes: 2026-10-31, 2026-12-01, 2026-12-31).
  await expect(cronograma.locator('tbody tr td:nth-child(2)')).toHaveText(['2026-11-01', '2026-12-01', '2027-01-01']);

  const avance = page.getByRole('button', { name: 'Registrar avance: Préstamo del ecógrafo' });
  await avance.click();
  await expect(cronograma.locator('tbody tr').nth(0)).toContainText('343.33');
  await expect(cronograma.locator('tbody tr').nth(0)).toContainText('Pagada');
  await expect(cronograma.locator('tbody tr').nth(1)).toContainText('Pendiente');
  await page.screenshot({ path: `${EVIDENCIA}/pasivos-cronograma-1440.png`, fullPage: true });

  await avance.click();
  await expect(cronograma.locator('tbody tr').nth(1)).toContainText('Pagada');
  await avance.click();
  await expect(cronograma.locator('tbody tr').nth(2)).toContainText('336.67');
  await expect(cronograma).toContainText('Saldo pendiente: 0.00 de 1000.00');
  await expect(page.locator('.item__detalle', { hasText: 'Saldo pendiente: 0.00' })).toBeVisible();

  await avance.click();
  await expect(page.getByText('Este pasivo no tiene cuotas pendientes')).toBeVisible();

  for (const [ancho, alto, nombre] of [
    [390, 844, '390'],
    [768, 1024, '768'],
  ] as const) {
    await page.setViewportSize({ width: ancho, height: alto });
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, `scroll horizontal a ${ancho}px`).toBeLessThanOrEqual(clientWidth);
    await page.screenshot({ path: `${EVIDENCIA}/pasivos-cronograma-${nombre}.png`, fullPage: true });
    await page
      .locator('li.item', { has: cronograma })
      .screenshot({ path: `${EVIDENCIA}/pasivos-cronograma-item-${nombre}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.locator('li.item', { has: cronograma }).screenshot({ path: `${EVIDENCIA}/pasivos-cronograma-item-1440.png` });
});
