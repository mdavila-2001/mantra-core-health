import { readFileSync } from 'node:fs';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import { contextoDeApi } from './support/actores';
import { entrar, irA } from './support/sesion';

/**
 * Carril 20 — libros contables contra la API real.
 *
 * Siembra por el camino real (mismo patrón que el carril 26): alta de la
 * médica, consultorio propio y, como el plan de cuentas y el ejercicio fiscal
 * sólo los crea `SECURITY_ADMIN`, el administrador de arranque le arma cinco
 * cuentas y el ejercicio del año. El activo fijo lo da de alta la médica. El
 * administrador además contabiliza un asiento en febrero, para que el filtro
 * por período tenga algo que dejar afuera.
 *
 * Lo que se ejercita en pantalla, como médica:
 *  - las seis pestañas en el orden del pedido;
 *  - MODO CONTADOR: fecha y glosa, filas que se agregan, modifican y quitan con
 *    totales exactos, una entidad relacionada por tipo (activo fijo), y el
 *    borrador guardado — comprobado después por la API (`status`, `assetId`);
 *  - el libro diario con su estado, el período aplicado, y el CSV y el PDF
 *    descargados con exactamente las filas del período.
 *
 * La autorización del MODO CONTADOR se prueba contra la API, no contra la UI:
 * la médica no puede postear directo, aprobar ni postear su borrador (403), y
 * un borrador descuadrado vuelve 422.
 */

const API_REAL = process.env['E2E_API_REAL'] === '1';
const ADMIN_EMAIL = process.env['E2E_BOOTSTRAP_ADMIN_EMAIL'] ?? '';
const ADMIN_PASSWORD = process.env['E2E_BOOTSTRAP_ADMIN_PASSWORD'] ?? '';
const DEPARTAMENTO_SC = '16fe92e8-bec7-577d-9e63-4a0d8ff3b0e4';
const MUNICIPIO = '5132db42-8cb1-52d6-88f5-0e9a04bdc94c';
const RUTA = '/administration/accounting/books';
const EVIDENCIA = '../docs/progress/evidence/lane-20';
const YEAR = new Date().getUTCFullYear();

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
  readonly cuentas: Record<string, string>;
}

let api: APIRequestContext;
let escenario: Escenario;

async function json<T>(
  paso: string,
  respuesta: Awaited<ReturnType<APIRequestContext['post']>>,
): Promise<T> {
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
  const clave = `Libros-${corrida}-2026!`;
  const medica = { identificador: `medica.c20.${corrida}@alovida.test`, clave };
  await json(
    'alta de la médica',
    await api.post('/iam/auth/register-practitioner', {
      data: {
        email: medica.identificador,
        password: clave,
        name: 'Ana',
        lastName: 'Rojas',
        licenseNumber: `MP-C20-${corrida}`,
        sedesLicenseNumber: `SEDES-C20-${corrida}`,
        professionalTitle: 'Médico',
        nationalId: `C20${corrida}`,
        issuerAdministrativeAreaConceptId: DEPARTAMENTO_SC,
        residenceMunicipalityConceptId: MUNICIPIO,
      },
    }),
  );
  await json(
    'consultorio propio',
    await api.post('/practitioners/me/sites', {
      headers: { Authorization: `Bearer ${await login(medica.identificador, clave)}` },
      data: { name: 'Consultorio Ana Rojas' },
    }),
  );
  const token = await login(medica.identificador, clave);
  const auth = { Authorization: `Bearer ${token}` };
  const [practica] = await json<{ id: string }[]>(
    'prácticas',
    await api.get('/practices', { headers: auth }),
  );
  const practiceId = practica!.id;
  const tenantId = (claims(token)['tenants'] as string[])[0]!;

  const admin = {
    Authorization: `Bearer ${await login(ADMIN_EMAIL, ADMIN_PASSWORD)}`,
    'X-Tenant-Id': tenantId,
  };
  const cuentas: Record<string, string> = {};
  for (const [code, name, accountType, normalBalance] of [
    ['1101', 'Banco', 'ASSET', 'DEBIT'],
    ['1201', 'Equipo médico', 'ASSET', 'DEBIT'],
    ['3101', 'Capital', 'EQUITY', 'CREDIT'],
    ['4101', 'Ingresos por consultas', 'REVENUE', 'CREDIT'],
    ['6101', 'Gastos generales', 'EXPENSE', 'DEBIT'],
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
  const periods = Array.from({ length: 12 }, (_, m) => {
    const last = new Date(Date.UTC(YEAR, m + 1, 0)).getUTCDate();
    const mm = String(m + 1).padStart(2, '0');
    return {
      code: `${YEAR}-${mm}`,
      startDate: `${YEAR}-${mm}-01`,
      endDate: `${YEAR}-${mm}-${last}`,
    };
  });
  await json(
    'ejercicio fiscal',
    await api.post('/accounting/fiscal-years', {
      headers: admin,
      data: {
        practiceId,
        code: `FY${YEAR}`,
        startDate: `${YEAR}-01-01`,
        endDate: `${YEAR}-12-31`,
        periods,
      },
    }),
  );
  const { id: assetId } = await json<{ id: string }>(
    'alta del activo',
    await api.post('/accounting/practitioner/assets', {
      headers: auth,
      data: {
        practiceId,
        code: 'EQ-ECO-20',
        name: 'Ecógrafo de consultorio',
        acquisitionAccountId: cuentas['1201'],
        offsetAccountId: cuentas['3101'],
        acquisitionCost: '1000.00',
        acquisitionDate: `${YEAR}-03-01`,
        usefulLifeMonths: 12,
        salvageValue: '0.00',
      },
    }),
  );
  // Un asiento contabilizado en febrero: el filtro de enero lo tiene que dejar afuera.
  await json(
    'asiento de febrero (administrador)',
    await api.post('/accounting/journal-transactions', {
      headers: admin,
      data: {
        practiceId,
        transactionDate: `${YEAR}-02-10`,
        description: 'Consulta cobrada en febrero',
        lines: [
          { accountId: cuentas['1101'], direction: 'DEBIT', amount: '150.00' },
          { accountId: cuentas['4101'], direction: 'CREDIT', amount: '150.00' },
        ],
      },
    }),
  );
  return { medica, token, practiceId, assetId, cuentas };
}

/** El formulario del MODO CONTADOR (los informes de arriba también tienen un campo «Cuenta»). */
function modoContador(page: Page) {
  return page.locator('app-card', { has: page.getByText('Filas del asiento') });
}

/** Un campo por el comienzo de su nombre accesible (el obligatorio suma un asterisco). */
function campo(page: Page, rol: 'textbox' | 'combobox', nombre: string) {
  return modoContador(page).getByRole(rol, { name: new RegExp(`^${nombre}`) });
}

async function elegir(page: Page, nombre: string, opcion: RegExp): Promise<void> {
  await campo(page, 'combobox', nombre).click();
  await page.getByRole('option', { name: opcion }).click();
  // El selector es un <dialog> modal que se cierra con transición: mientras
  // sigue abierto el resto de la página está inerte y un `fill` no llega al
  // campo (se perdía el importe en silencio).
  await expect(page.locator('dialog.select-dialog[open]')).toHaveCount(0);
}

async function agregarFila(
  page: Page,
  cuenta: RegExp,
  lado: 'Debe' | 'Haber',
  importe: string,
): Promise<void> {
  await elegir(page, 'Cuenta', cuenta);
  await elegir(page, 'Dirección', new RegExp(`^${lado}$`));
  await campo(page, 'textbox', 'Importe').fill(importe);
}

test.beforeAll(async () => {
  api = await contextoDeApi();
  escenario = await prepararEscenario();
});

test.afterAll(async () => {
  await api.dispose();
});

test('autorización del MODO CONTADOR: la API manda, no la pantalla', async () => {
  const auth = { Authorization: `Bearer ${escenario.token}` };
  const { cuentas, practiceId } = escenario;
  const asiento = {
    practiceId,
    transactionDate: `${YEAR}-01-20`,
    lines: [
      { accountId: cuentas['6101'], direction: 'DEBIT', amount: '10.00' },
      { accountId: cuentas['1101'], direction: 'CREDIT', amount: '10.00' },
    ],
  };
  // PRACTITIONER no postea directo: sólo SECURITY_ADMIN (accounting-ledger.controller.ts).
  expect(
    (await api.post('/accounting/journal-transactions', { headers: auth, data: asiento })).status(),
  ).toBe(403);
  // Partida doble antes de guardar siquiera el borrador.
  const descuadrado = {
    ...asiento,
    lines: [asiento.lines[0], { ...asiento.lines[1], amount: '9.99' }],
  };
  expect(
    (
      await api.post('/accounting/journal-transactions/drafts', {
        headers: auth,
        data: descuadrado,
      })
    ).status(),
  ).toBe(422);
  // Un activo que no es de la práctica es un 404, sin decir si existe en otra.
  const ajeno = {
    ...asiento,
    lines: [
      { ...asiento.lines[0], assetId: '00000000-0000-4000-8000-000000000001' },
      asiento.lines[1],
    ],
  };
  expect(
    (
      await api.post('/accounting/journal-transactions/drafts', { headers: auth, data: ajeno })
    ).status(),
  ).toBe(404);
  const borrador = await json<{ id: string }>(
    'borrador válido',
    await api.post('/accounting/journal-transactions/drafts', { headers: auth, data: asiento }),
  );
  // Aprobar y postear un borrador: tampoco (ACCOUNTING_APPROVER no existe en el mapeo de roles).
  expect(
    (
      await api.post(`/accounting/journal-transactions/${borrador.id}/approve`, {
        headers: auth,
        data: {},
      })
    ).status(),
  ).toBe(403);
  expect(
    (
      await api.post(`/accounting/journal-transactions/${borrador.id}/post`, {
        headers: auth,
        data: {},
      })
    ).status(),
  ).toBe(403);
});

test('pestañas, MODO CONTADOR de N filas con entidad relacionada, período y exportaciones', async ({
  page,
}) => {
  const consola: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consola.push(m.text());
  });
  const fallos: string[] = [];
  page.on('response', (r) => {
    if (r.url().includes('/accounting/') && r.status() >= 500)
      fallos.push(`${r.status()} ${r.url()}`);
  });

  await entrar(page, { rol: 'doctora', nombre: 'Ana Rojas', ...escenario.medica });
  await irA(page, RUTA);

  // Criterio 1: seis pestañas, en el orden del pedido.
  await expect(page.getByRole('tab')).toHaveText([
    'Cuadro de mando integral',
    'Libro diario',
    'Libro mayor',
    'Flujo de caja',
    'Estado de resultados',
    'Balance general',
  ]);

  // Criterios 4–10: MODO CONTADOR.
  await page.getByRole('button', { name: 'MODO CONTADOR', exact: true }).click();
  await campo(page, 'textbox', 'Fecha').fill(`${YEAR}-01-15`);
  await campo(page, 'textbox', 'Glosa').fill('Insumos del ecógrafo');

  await agregarFila(page, /^6101/, 'Debe', '0.10');
  await elegir(page, 'Tipo de entidad', /^Activo fijo$/);
  await elegir(page, 'Entidad', /EQ-ECO-20/);
  await page.getByRole('button', { name: 'Agregar entidad relacionada' }).click();
  await expect(page.getByText('Activo fijo: EQ-ECO-20 — Ecógrafo de consultorio')).toBeVisible();
  await page.getByRole('button', { name: 'Agregar fila' }).click();

  await agregarFila(page, /^6101/, 'Debe', '0.20');
  await page.getByRole('button', { name: 'Agregar fila' }).click();
  await agregarFila(page, /^1101/, 'Haber', '9.99');
  await page.getByRole('button', { name: 'Agregar fila' }).click();
  await expect(page.getByText('Debe 0.30 — Haber 9.99', { exact: false })).toBeVisible();
  await expect(page.getByText('Descuadrado: -9.69')).toBeVisible();

  // Modificar trae los valores al formulario; quitar una fila recalcula.
  await page.getByRole('button', { name: 'Modificar la fila 3' }).click();
  await expect(campo(page, 'textbox', 'Importe')).toHaveValue('9.99');
  await campo(page, 'textbox', 'Importe').fill('0.30');
  await page.getByRole('button', { name: 'Guardar cambios en la fila' }).click();
  await expect(page.getByText('Cuadra', { exact: true })).toBeVisible();
  await agregarFila(page, /^1101/, 'Haber', '5.00');
  await page.getByRole('button', { name: 'Agregar fila' }).click();
  await expect(page.getByText('Descuadrado: -5.00')).toBeVisible();
  await page.getByRole('button', { name: 'Eliminar la fila 4' }).click();
  await expect(page.getByText('Cuadra', { exact: true })).toBeVisible();
  await expect(page.locator('.fila-del-asiento')).toHaveCount(3);
  await modoContador(page)
    .locator('.filas-del-asiento')
    .evaluate((lista) => lista.scrollIntoView({ block: 'center' }));
  await modoContador(page)
    .locator('.filas-del-asiento')
    .screenshot({
      path: `${EVIDENCIA}/modo-contador-filas-1440.png`,
    });

  const guardado = page.waitForResponse(
    (r) =>
      r.url().includes('/accounting/journal-transactions/drafts') &&
      r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Guardar en borrador' }).click();
  const respuesta = await guardado;
  expect(respuesta.status()).toBe(201);
  const enviado = respuesta.request().postDataJSON() as {
    description: string;
    lines: { amount: string; assetId?: string }[];
  };
  expect(enviado.description).toBe('Insumos del ecógrafo');
  expect(enviado.lines.map((l) => l.amount)).toEqual(['0.10', '0.20', '0.30']);
  expect(enviado.lines[0]!.assetId).toBe(escenario.assetId);
  await expect(page.getByText('Asiento guardado en borrador.')).toBeVisible();

  // Persistencia: la API devuelve el borrador con su estado y el activo en la línea.
  const { id } = (await respuesta.json()) as { id: string };
  const detalle = await json<{
    status: string;
    lines: { amountBase: string; assetId: string | null }[];
  }>(
    'detalle del borrador',
    await api.get(`/accounting/journal-transactions/${id}`, {
      headers: { Authorization: `Bearer ${escenario.token}` },
    }),
  );
  expect(detalle.status).toBe('DRAFT');
  expect(detalle.lines.map((l) => [l.amountBase, l.assetId])).toEqual([
    ['0.10', escenario.assetId],
    ['0.20', null],
    ['0.30', null],
  ]);

  // Criterios 3, 14 y 15: el diario con estado, el período y las exportaciones.
  await page.getByRole('tab', { name: 'Libro diario', exact: true }).click();
  const diario = page.getByRole('tabpanel');
  await expect(diario.getByRole('cell', { name: 'Borrador' }).first()).toBeVisible();
  await expect(
    diario.getByRole('cell', { name: 'Contabilizado', exact: true }).first(),
  ).toBeVisible();

  await page.getByTestId('period-from').fill(`${YEAR}-01-01`);
  await page.getByTestId('period-to').fill(`${YEAR}-01-31`);
  await page.getByRole('button', { name: 'Aplicar período' }).click();
  await expect(page.getByText(`Del 01/01/${YEAR} al 31/01/${YEAR}`).first()).toBeVisible();
  await expect(diario.getByRole('cell', { name: '150.00' })).toHaveCount(0);
  await expect(diario.getByRole('cell', { name: '0.30' }).first()).toBeVisible();

  const csv = page.waitForEvent('download');
  await diario.getByRole('button', { name: 'Exportar a CSV' }).click();
  const descargaCsv = await csv;
  expect(descargaCsv.suggestedFilename()).toBe(`libro-diario_${YEAR}-01-01_${YEAR}-01-31.csv`);
  const contenido = readFileSync((await descargaCsv.path())!, 'utf8');
  expect(contenido).toContain('Estado');
  expect(contenido).toContain('Borrador');
  expect(contenido).toContain('0.30');
  expect(contenido).toContain('10.00');
  expect(contenido).not.toContain('150.00');
  expect(contenido).not.toContain('1000.00');

  const pdf = page.waitForEvent('download', { timeout: 30_000 });
  await diario.getByRole('button', { name: 'Exportar a PDF' }).click();
  expect((await pdf).suggestedFilename()).toBe(`libro-diario_${YEAR}-01-01_${YEAR}-01-31.pdf`);

  // Un período inválido se dice en el paso donde se comete y no se aplica.
  await page.getByTestId('period-from').fill(`${YEAR}-02-01`);
  await page.getByRole('button', { name: 'Aplicar período' }).click();
  await expect(
    page.getByText('La fecha «Desde» no puede ser posterior a la fecha «Hasta».'),
  ).toBeVisible();

  // Escritorio primero (claro y oscuro): al pasar por el ancho móvil la barra
  // lateral queda en modo cajón y taparía el contenido en la foto de 1440.
  await page.setViewportSize({ width: 1440, height: 3200 });
  await page.evaluate(() => {
    localStorage.setItem('mantra-core-health.theme', 'dark');
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  await page.screenshot({ path: `${EVIDENCIA}/libros-diario-periodo-1440-oscuro.png` });
  await page.evaluate(() => {
    localStorage.removeItem('mantra-core-health.theme');
    document.documentElement.removeAttribute('data-theme');
  });
  for (const [nombre, ancho, alto] of [
    ['1440', 1440, 900],
    ['768', 768, 1024],
    ['390', 390, 844],
  ] as const) {
    await page.setViewportSize({ width: ancho, height: alto });
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, `sin scroll horizontal a ${nombre} px`).toBeLessThanOrEqual(clientWidth);
    // Ventana alta en vez de `fullPage`: con `fullPage` la barra lateral fija
    // y la cabecera salen pegadas a media altura (ver contabilidad-pestanas.spec.ts).
    await page.setViewportSize({ width: ancho, height: 3200 });
    await page.screenshot({ path: `${EVIDENCIA}/libros-diario-periodo-${nombre}.png` });
  }

  expect(fallos, 'sin 5xx de contabilidad').toEqual([]);
  expect(
    consola.filter((m) => !m.includes('favicon')),
    'sin errores de consola',
  ).toEqual([]);
});
