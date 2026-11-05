import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Browser, type Page, type Request, type Response } from '@playwright/test';

/**
 * F2/F3 contra la **API real** (no la maqueta): `ng serve --configuration real-api`
 * con el proxy a la API en :3000.
 *
 * Cada mutación se demuestra con la cadena completa: UI → request (método,
 * ruta, cabeceras de concurrencia, cuerpo) → response (estado, cuerpo,
 * requestId) → persistencia (`SELECT` en la base con `docker exec … psql`) →
 * recarga dura → UI. Los datos salen de `real-api/sembrar.mjs` (sólo API).
 *
 * Uso:
 *   E2E_BASE_URL=http://127.0.0.1:4391 STAFF_PASSWORD=… yarn pw infra-f2f3-api-real --workers=1
 *
 * **Nunca `networkidle`**: se espera siempre un selector o una respuesta.
 */

const SALIDA = join(process.cwd(), 'docs', 'refactor-profesional', 'trabajo', 'evidencias', 'infra-f2f3', 'real-api');
const SEMBRADO = join(SALIDA, 'sembrado.json');
const PASS = process.env['STAFF_PASSWORD'] ?? '';
const ANCHOS = [
  { nombre: '1440', width: 1440, height: 900 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '390', width: 390, height: 844 },
] as const;

interface Sembrado {
  readonly tag: string;
  readonly hospital: string;
  readonly sede: string;
  readonly camas: readonly { id: string; code: string }[];
  readonly personal: Readonly<Record<string, { email: string; userId: string }>>;
}

const registro: { que: string; datos: unknown }[] = [];
test.describe.configure({ mode: 'serial' });
if (process.env['PW_CHROMIUM_PATH']) test.use({ launchOptions: { executablePath: process.env['PW_CHROMIUM_PATH'] } });

const datos = (): Sembrado => JSON.parse(readFileSync(SEMBRADO, 'utf8')) as Sembrado;

test.beforeAll(() => {
  mkdirSync(SALIDA, { recursive: true });
  expect(existsSync(SEMBRADO), 'falta correr real-api/sembrar.mjs').toBe(true);
  expect(PASS, 'falta STAFF_PASSWORD').not.toBe('');
});
test.afterAll(() => {
  const archivo = join(SALIDA, 'resultados.json');
  const previo = existsSync(archivo) ? (JSON.parse(readFileSync(archivo, 'utf8')) as { corridas?: unknown[] }) : {};
  writeFileSync(archivo, JSON.stringify({ corridas: [...(previo.corridas ?? []), { fecha: new Date().toISOString(), registro }] }, null, 2));
});

/** Lo que está en la base: el `SELECT` de la cadena (lectura, nunca escritura). */
function sql(consulta: string): string[][] {
  const out = execFileSync('docker', ['exec', 'mantra-redesa-postgres-1', 'psql', '-U', 'mantra', '-d', 'alovida', '-At', '-F', '|', '-c', consulta], { encoding: 'utf8' });
  // Los códigos de concepto llevan el prefijo del módulo (`practice:HYG_DIRTY`): se compara el código.
  return out.trim().split('\n').filter(Boolean).map((l) => l.split('|').map((c) => c.replace(/^[a-z_]+:/, '')));
}
const uuidOk = (s: string) => /^[0-9a-f-]{36}$/.test(s);

/** Cada cuenta en un contexto de navegador nuevo: sin sesión, almacenamiento ni cookies de la anterior. */
async function entrar(browser: Browser, clave: string, viewport = { width: 1440, height: 900 }): Promise<Page> {
  const d = datos();
  const page = await (await browser.newContext({ viewport })).newPage();
  await page.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByTestId('login-identifier').fill(d.personal[clave]!.email);
  await page.getByTestId('login-password').fill(PASS);
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization|portal-selector)/, { timeout: 60_000 });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').filter({ hasText: `Hospital ${d.tag}` }).first().click();
    await page.waitForURL(/\/(dashboard|portal-selector)/, { timeout: 60_000 });
  }
  return page;
}

interface Cadena {
  readonly method: string;
  readonly url: string;
  readonly ifMatch: string | null;
  readonly ifMatchOps: string | null;
  readonly body: unknown;
  readonly status: number;
  readonly response: unknown;
  readonly requestId: string | null;
}

/** Hace `accion` y devuelve la primera escritura que coincide, con su respuesta. */
async function mutacion(page: Page, metodo: string, ruta: RegExp, accion: () => Promise<void>): Promise<Cadena> {
  const espera = page.waitForResponse((r: Response) => r.request().method() === metodo && ruta.test(new URL(r.url()).pathname), { timeout: 60_000 });
  await accion();
  const r = await espera;
  const req: Request = r.request();
  const body = req.postData();
  const response = await r.json().catch(() => null);
  return {
    method: metodo,
    url: new URL(r.url()).pathname,
    ifMatch: req.headers()['if-match'] ?? null,
    ifMatchOps: req.headers()['if-match-ops'] ?? null,
    body: body === null ? null : (JSON.parse(body) as unknown),
    status: r.status(),
    response,
    requestId: r.headers()['x-request-id'] ?? (response as { requestId?: string } | null)?.requestId ?? null,
  };
}

const tile = (page: Page, code: string) => page.locator('app-bed-tile', { hasText: code }).locator('[data-v2]').first();

async function tablero(page: Page): Promise<unknown> {
  const respuesta = page.waitForResponse((r) => /\/sites\/[^/]+\/bed-board$/.test(new URL(r.url()).pathname) && r.request().method() === 'GET', { timeout: 60_000 });
  await page.goto(`/inpatient/bed-board?site=${datos().sede}`, { waitUntil: 'domcontentloaded' });
  const r = await respuesta;
  expect(r.status()).toBe(200);
  await expect(page.getByTestId('bed-board')).toBeVisible({ timeout: 60_000 });
  return r.json();
}

async function captura(page: Page, nombre: string, ancho: string): Promise<void> {
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(SALIDA, `${nombre}-${ancho}.png`), fullPage: true });
}

test('F2 real: marcar sucia → limpiar → inspeccionar, con persistencia y recarga', async ({ browser }) => {
  test.setTimeout(600_000);
  const d = datos();
  let page: Page;
  // ---- 1. Enfermería marca sucia una cama libre y limpia -------------------
  page = await entrar(browser, 'enfermeria');
  const antes = (await tablero(page)) as { siteId: string; units: { cells: { id: string; code: string; v2Code: string; opsVersion: number; openCleaningOrderId: string | null }[] }[] };
  expect(antes.siteId).toBe(d.sede);
  const celda = antes.units.flatMap((u) => u.cells).find((c) => c.v2Code === 'U' && c.openCleaningOrderId === null)!;
  expect(celda, 'una cama libre y lista').toBeDefined();
  const cama = { id: celda.id, code: celda.code };
  await expect(tile(page, cama.code)).toHaveAttribute('data-v2', celda.v2Code);
  await captura(page, '01-board-before', '1440');
  await tile(page, cama.code).click();
  await expect(page.getByTestId('bed-panel')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('bed-mark-dirty').click();
  const dialogo = page.locator('dialog[open]').last();
  await dialogo.locator('textarea').fill('Derrame de suero en la cabecera');
  const sucia = await mutacion(page, 'POST', /\/care-spaces\/[^/]+\/hygiene$/, () => dialogo.getByRole('button', { name: 'Marcar sucia' }).click());
  registro.push({ que: 'marcar sucia · request/response', datos: sucia });
  expect(sucia.status).toBe(200);
  expect(sucia.ifMatchOps).toBe(String(celda.opsVersion));
  expect(sucia.body).toEqual({ action: 'mark-dirty', reasonText: 'Derrame de suero en la cabecera' });
  expect((sucia.response as { requestId?: string }).requestId).toBe(sucia.requestId);
  const filaSucia = sql(`select cc.code, cs.ops_version from practice.care_spaces cs join terminology.catalog_concepts cc on cc.id = cs.hygiene_status_concept_id where cs.id = '${cama.id}'`);
  const orden = sql(`select o.id, cc.code from practice.cleaning_orders o join terminology.catalog_concepts cc on cc.id = o.status_concept_id where o.care_space_id = '${cama.id}' order by o.requested_at desc limit 1`);
  registro.push({ que: 'marcar sucia · SELECT', datos: { care_spaces: filaSucia, cleaning_orders: orden } });
  expect(filaSucia[0]![0]).toBe('HYG_DIRTY');
  expect(orden[0]![1]).toBe('CLN_PENDING');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('bed-board')).toBeVisible({ timeout: 60_000 });
  await expect(tile(page, cama.code)).toHaveAttribute('data-v2', 'H');
  await captura(page, '02-board-dirty-after-reload', '1440');

  // ---- 2. Limpieza: el tablero y su payload sin paciente; empieza y termina
  page = await entrar(browser, 'limpieza');
  const paraLimpieza = (await tablero(page)) as { units: { cells: { occupancy: Record<string, unknown> }[] }[] };
  for (const c of paraLimpieza.units.flatMap((u) => u.cells)) {
    expect(c.occupancy['patient']).toBeUndefined();
    expect(c.occupancy['encounterId'] ?? null).toBeNull();
    expect(c.occupancy['encounterLocationId'] ?? null).toBeNull();
  }
  registro.push({ que: 'limpieza · payload del tablero sin patient/encounterId/encounterLocationId', datos: paraLimpieza.units.flatMap((u) => u.cells).map((c) => c.occupancy) });
  const colaResp = page.waitForResponse((r) => /\/cleaning-orders$/.test(new URL(r.url()).pathname) && r.request().method() === 'GET');
  await page.goto(`/inpatient/cleaning?site=${d.sede}`, { waitUntil: 'domcontentloaded' });
  expect((await colaResp).status()).toBe(200);
  const fila = page.locator('tr, [role=row]', { hasText: cama.code }).first();
  await expect(fila).toBeVisible({ timeout: 60_000 });
  await captura(page, '03-queue-pending', '1440');
  const menu = async (accion: string) => {
    await fila.getByRole('button', { name: /Acciones|Más acciones/ }).first().click();
    await page.getByRole('menuitem', { name: accion }).click();
  };
  const empezar = await mutacion(page, 'POST', /\/cleaning-orders\/[^/]+\/start$/, () => menu('Empezar'));
  expect(empezar.status).toBe(200);
  expect(empezar.ifMatch).not.toBeNull();
  await expect(fila).toContainText('En curso');
  const terminar = await mutacion(page, 'POST', /\/cleaning-orders\/[^/]+\/finish$/, async () => {
    await menu('Terminar');
    await page.locator('dialog[open]').last().getByRole('button', { name: 'Terminar' }).click();
  });
  expect(terminar.status).toBe(200);
  registro.push({ que: 'limpieza · empezar y terminar', datos: [empezar, terminar] });
  const terminada = sql(`select cc.code, o.finished_by_user_id from practice.cleaning_orders o join terminology.catalog_concepts cc on cc.id = o.status_concept_id where o.id = '${orden[0]![0]}'`);
  registro.push({ que: 'limpieza · SELECT', datos: terminada });
  expect(terminada[0]![0]).toBe('CLN_DONE');
  expect(terminada[0]![1]).toBe(d.personal['limpieza']!.userId);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('tr, [role=row]', { hasText: cama.code }).first()).toContainText('Terminada', { timeout: 60_000 });
  await captura(page, '04-queue-finished-after-reload', '1440');

  // ---- 3. La supervisora la inspecciona (otra persona) --------------------
  page = await entrar(browser, 'suplimpieza');
  await page.goto(`/inpatient/cleaning?site=${d.sede}`, { waitUntil: 'domcontentloaded' });
  const filaSup = page.locator('tr, [role=row]', { hasText: cama.code }).first();
  await expect(filaSup).toBeVisible({ timeout: 60_000 });
  const inspeccion = await mutacion(page, 'POST', /\/cleaning-orders\/[^/]+\/inspect$/, async () => {
    await filaSup.getByRole('button', { name: /Acciones|Más acciones/ }).first().click();
    await page.getByRole('menuitem', { name: 'Aprobar inspección' }).click();
    await page.locator('dialog[open]').last().getByRole('button', { name: 'Aprobar' }).click();
  });
  registro.push({ que: 'inspección · request/response', datos: inspeccion });
  expect(inspeccion.status).toBe(200);
  expect(inspeccion.body).toEqual({ result: 'PASS' });
  const inspeccionada = sql(`select cc.code, o.inspected_by_user_id from practice.cleaning_orders o join terminology.catalog_concepts cc on cc.id = o.status_concept_id where o.id = '${orden[0]![0]}'`);
  const higiene = sql(`select cc.code from practice.care_spaces cs join terminology.catalog_concepts cc on cc.id = cs.hygiene_status_concept_id where cs.id = '${cama.id}'`);
  const a20 = sql(`select a.code, t.code, e.request_id from practice.care_space_status_events e join terminology.catalog_concepts a on a.id = e.axis_concept_id join terminology.catalog_concepts t on t.id = e.to_concept_id where e.care_space_id = '${cama.id}' order by e.occurred_at`);
  registro.push({ que: 'inspección · SELECT', datos: { orden: inspeccionada, higiene, a20 } });
  expect(inspeccionada[0]![0]).toBe('CLN_INSPECTED');
  expect(inspeccionada[0]![1]).toBe(d.personal['suplimpieza']!.userId);
  expect(higiene[0]![0]).toBe('HYG_INSPECTED');
  expect(a20.map((r) => r[1])).toEqual(expect.arrayContaining(['HYG_DIRTY', 'HYG_CLEANING', 'HYG_CLEAN', 'HYG_INSPECTED']));
  expect(a20.every((r) => uuidOk(r[2] ?? '') || (r[2] ?? '').length > 0)).toBe(true);
  await tablero(page);
  await expect(tile(page, cama.code)).toHaveAttribute('data-v2', 'U');
  await captura(page, '05-board-inspected-assignable', '1440');
});

for (const ancho of ANCHOS) {
  test(`pantallas contra la API real a ${ancho.nombre}: tablero, panel, cola, censo e indicadores`, async ({ browser }) => {
    test.setTimeout(300_000);
    const d = datos();
    const page = await entrar(browser, 'supervision', { width: ancho.width, height: ancho.height });
    await tablero(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await captura(page, '10-board', ancho.nombre);
    await tile(page, d.camas[1]!.code).click();
    await expect(page.getByTestId('bed-panel')).toBeVisible({ timeout: 60_000 });
    await captura(page, '11-panel', ancho.nombre);
    await page.getByTestId('cajon-cerrar').click();
    await page.goto(`/inpatient/cleaning?site=${d.sede}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('cleaning-queue')).toBeVisible({ timeout: 60_000 });
    await captura(page, '12-queue', ancho.nombre);
    await page.goto(`/inpatient/census?site=${d.sede}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('census-table')).toBeVisible({ timeout: 60_000 });
    await captura(page, '13-census', ancho.nombre);
    await page.goto(`/inpatient/indicators?site=${d.sede}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('indicators')).toBeVisible({ timeout: 60_000 });
    await captura(page, '14-indicators', ancho.nombre);
  });
}

test('M34 contra la API real: S5 (403 de la API y sin acción en /me), S6 (404) y lecturas de F3 sin ingreso', async ({ browser }) => {
  test.setTimeout(300_000);
  const d = datos();
  // Limpieza no tiene censo: la pantalla lo dice (S5) y la API lo confirma con 403.
  const limpieza = await entrar(browser, 'limpieza');
  const meReq = limpieza.waitForRequest((r) => r.url().includes('/practice/infrastructure-access/me'));
  await limpieza.goto(`/inpatient/census?site=${d.sede}`, { waitUntil: 'domcontentloaded' });
  const cabeceras = (await meReq).headers();
  await expect(limpieza.getByText('No tiene acceso a esta sección')).toBeVisible({ timeout: 60_000 });
  await captura(limpieza, '20-s5-census-housekeeping', '1440');
  // La pantalla no pidió el censo; la API, si se lo piden igual, lo niega.
  const r = await limpieza.request.get(`/sites/${d.sede}/census?date=2026-10-30`, { headers: { authorization: cabeceras['authorization'] ?? '', 'x-tenant-id': cabeceras['x-tenant-id'] ?? '' } });
  const directo = { status: r.status(), body: (await r.json().catch(() => null)) as unknown };
  registro.push({ que: 'limpieza · GET census directo', datos: directo });
  expect(directo.status).toBe(403);

  // S6: una internación que no existe → 404 de la API → «No encontramos lo que busca».
  const supervision = await entrar(browser, 'supervision');
  const noExiste = '00000000-0000-4000-8000-000000000000';
  const resp = supervision.waitForResponse((r) => r.url().includes(`/clinical/encounters/${noExiste}/stay`));
  await supervision.goto(`/inpatient/stays/${noExiste}`, { waitUntil: 'domcontentloaded' });
  expect((await resp).status()).toBe(404);
  await expect(supervision.getByText('No encontramos lo que busca')).toBeVisible({ timeout: 60_000 });
  await captura(supervision, '21-s6-stay-not-found', '1440');

  // Censo: el día de ayer abierto (vista previa) con la forma de la API, y los indicadores sin días cerrados (S3).
  const censo = supervision.waitForResponse((r) => /\/sites\/[^/]+\/census$/.test(new URL(r.url()).pathname));
  await supervision.goto(`/inpatient/census?site=${d.sede}`, { waitUntil: 'domcontentloaded' });
  const c = await censo;
  expect(c.status()).toBe(200);
  const dias = (await c.json()) as { status: string; unitId: string | null; counts: Record<string, number> }[];
  registro.push({ que: 'censo · GET (forma de la API)', datos: dias });
  expect(Array.isArray(dias)).toBe(true);
  expect(dias[0]).toMatchObject({ status: 'OPEN' });
  await expect(supervision.getByTestId('census-table')).toContainText('Abierto', { timeout: 60_000 });
  const ind = supervision.waitForResponse((r) => r.url().includes('/inpatient-indicators') && !new URL(r.url()).searchParams.has('unitId'));
  await supervision.goto(`/inpatient/indicators?site=${d.sede}`, { waitUntil: 'domcontentloaded' });
  const i = await ind;
  expect(i.status()).toBe(200);
  const cuerpo = (await i.json()) as { coverage: { daysClosed: number } };
  registro.push({ que: 'indicadores · GET (tal como vienen)', datos: cuerpo });
  if (cuerpo.coverage.daysClosed === 0) await expect(supervision.getByRole('link', { name: /Cerrar el censo del/ })).toBeVisible({ timeout: 60_000 });
  await captura(supervision, '22-indicators-real', '1440');
});
