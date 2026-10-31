import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, request as pwRequest, test, type APIRequestContext, type Page, type Response } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, esperarAplicacionLista, irA } from './support/sesion';

/**
 * Evidencia «funciona de verdad» del panel «Sistema» (`/superadmin/observability`), carril F3-SISTEMA-FRONT.
 *
 * Corre contra `ng serve` (`yarn start:real-api`) y la API REAL con Postgres (`evidencia-f0/ENTORNO.md`). NO vale
 * contra el simulador. Sin `networkidle` (con HMR no llega): se espera por elementos y por respuestas concretas.
 *
 * Qué demuestra: (1) una carga CONOCIDA (12 × 404, 9 × 400, 5 × 403, 30 × 200, 4 × 500) aparece con los conteos
 * exactos que dicen la API y `psql`; (2) un 500 provocado es un grupo con su `requestId`, y ese `requestId` se
 * encuentra en «Buscar por requestId»; (3) el cambio de estado sobrevive a la recarga (UI → PATCH → fila en
 * Postgres → recarga → UI); (4) el panel cumple la composición (una tarjeta a lo ancho), sin desborde horizontal;
 * (5) capturas 390/768/1440 × claro/oscuro de cada pestaña y de los estados vacío / error / sin permiso / atrasado.
 *
 * Variables: `E2E_API_REAL=1` (obligatoria), `E2E_API_URL` (por omisión http://127.0.0.1:3010), `OBS_PG_DSN`,
 * `OBS_EVIDENCIA` (carpeta de salida), `E2E_PLAT_CLAVE`.
 */
const API = process.env['E2E_API_URL'] ?? 'http://127.0.0.1:3010';
const DSN = process.env['OBS_PG_DSN'] ?? 'postgresql://salud:mantra@127.0.0.1:5544/salud';
const SALIDA = process.env['OBS_EVIDENCIA'] ?? 'docs/trabajo/2026-10-31-portal-observabilidad-gobierno/evidencia-f0/F3-sistema';
const CLAVE = process.env['E2E_PLAT_CLAVE'] ?? '12345678';
const ADMIN = 'admin@alovidasalud.com';
const MEDICO = 'medico2org@alovida.test';
const RUN = `r${Date.now().toString(36)}`;

const VIEWPORTS = [
  { nombre: '390', width: 390, height: 844 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '1440', width: 1440, height: 900 },
] as const;
const TEMAS = ['claro', 'oscuro'] as const;
type Pestana = 'resumen' | 'errores' | 'latencia' | 'sql' | 'endpoints' | 'no-medido';
const ETIQUETA: Record<Pestana, string> = {
  resumen: 'Resumen',
  errores: 'Errores',
  latencia: 'Latencia',
  sql: 'Consultas SQL',
  endpoints: 'Endpoints',
  'no-medido': 'No medido',
};

test.skip(process.env['E2E_API_REAL'] !== '1', 'Necesita la API real con Postgres (E2E_API_REAL=1). No es un verde: sin ella no prueba nada.');
test.describe.configure({ mode: 'serial' });
test.setTimeout(300_000);

const bitacora: Record<string, unknown> = { run: RUN, api: API, conteos: {}, verificaciones: [] as unknown[] };
const consola: { tipo: string; texto: string; url: string }[] = [];
const red: { url: string; status: number; requestId: string | undefined; ms: number }[] = [];

function anotar(clave: string, valor: unknown): void {
  (bitacora['verificaciones'] as unknown[]).push({ [clave]: valor });
}

function psql(sql: string): string {
  return execFileSync('psql', [DSN, '-At', '-F', '|', '-c', sql], { encoding: 'utf8' }).trim();
}

async function login(api: APIRequestContext, email: string): Promise<string> {
  const r = await api.post('/iam/auth/login', { data: { email, password: CLAVE } });
  expect(r.ok(), `login ${email}`).toBe(true);
  return ((await r.json()) as { accessToken: string }).accessToken;
}

interface Fila {
  readonly requests: number;
  readonly failed4xx: number;
  readonly failed5xx: number;
}

/** Cuántas peticiones cuenta la API por (método, plantilla) en la ventana `hoy` (La Paz). */
async function contarEndpoints(api: APIRequestContext, token: string): Promise<Map<string, Fila>> {
  const r = await api.get('/admin/observability/endpoints?limit=200&sort=requests', { headers: { authorization: `Bearer ${token}` } });
  expect(r.status()).toBe(200);
  const cuerpo = (await r.json()) as { items: { method: string; route: string; requests: number; failed4xx: number; failed5xx: number }[] };
  return new Map(cuerpo.items.map((i) => [`${i.method} ${i.route}`, { requests: i.requests, failed4xx: i.failed4xx, failed5xx: i.failed5xx }]));
}

const resta = (a: Fila | undefined, b: Fila | undefined): Fila => ({
  requests: (a?.requests ?? 0) - (b?.requests ?? 0),
  failed4xx: (a?.failed4xx ?? 0) - (b?.failed4xx ?? 0),
  failed5xx: (a?.failed5xx ?? 0) - (b?.failed5xx ?? 0),
});

function vigilar(page: Page): void {
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') consola.push({ tipo: m.type(), texto: m.text().slice(0, 400), url: page.url() });
  });
  page.on('response', (r: Response) => {
    const u = new URL(r.url());
    if (!u.pathname.startsWith('/admin/') && !u.pathname.startsWith('/iam/')) return;
    red.push({ url: `${u.pathname}${u.search}`.slice(0, 200), status: r.status(), requestId: r.headers()['x-request-id'], ms: 0 });
  });
}

async function tema(page: Page, t: (typeof TEMAS)[number]): Promise<void> {
  await page.evaluate((valor) => document.documentElement.setAttribute('data-theme', valor), t === 'oscuro' ? 'dark' : 'light');
  await page.waitForTimeout(350);
}

async function abrirPestana(page: Page, p: Pestana): Promise<void> {
  await page.getByRole('tab', { name: ETIQUETA[p], exact: true }).click();
  await expect(page.getByTestId(`obs-tab-${p}`)).toBeVisible({ timeout: 20_000 });
}

/** Espera a que la pestaña deje de mostrar esqueletos / «Cargando» para capturar un estado estable. */
async function reposar(page: Page): Promise<void> {
  await expect(page.locator('[data-testid^="obs-tab-"] app-skeleton, [data-testid^="obs-tab-"] app-spinner')).toHaveCount(0, { timeout: 30_000 });
  await page.waitForTimeout(600);
}

async function capturas(page: Page, nombre: string, vistas: readonly (typeof VIEWPORTS)[number][] = VIEWPORTS): Promise<void> {
  mkdirSync(join(SALIDA, 'capturas'), { recursive: true });
  for (const v of vistas) {
    await page.setViewportSize({ width: v.width, height: v.height });
    await page.waitForTimeout(500);
    for (const t of TEMAS) {
      await tema(page, t);
      await page.screenshot({ path: join(SALIDA, 'capturas', `${nombre}-${v.nombre}-${t}.png`), fullPage: true });
    }
  }
  await tema(page, 'claro');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(300);
}

test.afterAll(() => {
  mkdirSync(SALIDA, { recursive: true });
  writeFileSync(join(SALIDA, `consola-red-${RUN}.json`), JSON.stringify({ consola, red }, null, 2));
  writeFileSync(join(SALIDA, `bitacora-${RUN}.json`), JSON.stringify(bitacora, null, 2));
});

/* ---- la carga conocida -------------------------------------------------------------------------------- */

const errores500: string[] = [];
let antes = new Map<string, Fila>();
let despues = new Map<string, Fila>();
let tokenAdmin = '';
let grupoId = '';

test('carga conocida: los conteos de la API coinciden con lo enviado (12×404, 9×400, 5×403, 30×200)', async () => {
  const api = await pwRequest.newContext({ baseURL: API });
  tokenAdmin = await login(api, ADMIN);
  const tokenMedico = await login(api, MEDICO);
  const auth = { authorization: `Bearer ${tokenAdmin}` };
  antes = await contarEndpoints(api, tokenAdmin);

  for (let i = 0; i < 12; i += 1) expect((await api.get(`/no-existe-${RUN}-${i}`)).status()).toBe(404);
  for (let i = 0; i < 9; i += 1) expect((await api.get('/admin/observability/summary?from=basura', { headers: auth })).status()).toBe(400);
  for (let i = 0; i < 5; i += 1) expect((await api.get('/admin/observability/summary', { headers: { authorization: `Bearer ${tokenMedico}` } })).status()).toBe(403);
  for (let i = 0; i < 30; i += 1) expect((await api.get('/admin/observability/coverage', { headers: auth })).status()).toBe(200);
  for (let i = 0; i < 4; i += 1) {
    const r = await api.get('/internal/observability/selftest/fail?kind=throw', { headers: auth });
    expect(r.status()).toBe(500);
    errores500.push(r.headers()['x-request-id'] ?? ((await r.json()) as { correlationId: string }).correlationId);
  }
  expect(new Set(errores500).size).toBe(4);
  anotar('requestIds500', errores500);

  // El volcado ocurre cada ≤ 10 s: se espera a que la API vea EXACTAMENTE lo enviado.
  const esperado = { unmatched: 12, resumen4xx: 9 + 5, coverage: 30 };
  await expect
    .poll(
      async () => {
        despues = await contarEndpoints(api, tokenAdmin);
        return [
          resta(despues.get('GET UNMATCHED'), antes.get('GET UNMATCHED')).requests,
          resta(despues.get('GET /admin/observability/summary'), antes.get('GET /admin/observability/summary')).failed4xx,
          resta(despues.get('GET /admin/observability/coverage'), antes.get('GET /admin/observability/coverage')).requests,
        ];
      },
      { timeout: 90_000, intervals: [2_000] },
    )
    .toEqual([esperado.unmatched, esperado.resumen4xx, esperado.coverage]);
  (bitacora['conteos'] as Record<string, unknown>)['delta'] = {
    UNMATCHED: resta(despues.get('GET UNMATCHED'), antes.get('GET UNMATCHED')),
    summary: resta(despues.get('GET /admin/observability/summary'), antes.get('GET /admin/observability/summary')),
    coverage: resta(despues.get('GET /admin/observability/coverage'), antes.get('GET /admin/observability/coverage')),
  };
  await api.dispose();
});

test('persistencia: Postgres tiene los mismos conteos y los 4 eventos del 500 con sus requestId', async () => {
  const grupo = psql(`select id, occurrences_total, row_version from observability.error_groups where route_template = '/internal/observability/selftest/fail' and exception_type = 'Error'`);
  expect(grupo).not.toBe('');
  const [id, total, version] = grupo.split('|');
  grupoId = id ?? '';
  const ids = psql(`select request_id from observability.error_events where error_group_id = '${id}' order by occurred_at desc limit 4`).split('\n').sort();
  expect(ids).toEqual([...errores500].sort());
  const unmatched = psql(`select coalesce(sum(requests),0) from observability.http_request_minute_series where route_template='UNMATCHED' and http_method='GET'`);
  expect(Number(unmatched)).toBe(despues.get('GET UNMATCHED')?.requests);
  anotar('psql.grupo500', { id, occurrencesTotal: Number(total), rowVersion: Number(version), requestIds: ids });
  anotar('psql.unmatchedTotalHoy', Number(unmatched));
});

/* ---- la interfaz ---------------------------------------------------------------------------------------- */

test.describe('panel «Sistema» con sesión de SUPERADMIN', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-BO', timezoneId: 'America/La_Paz' });
    page = await contexto.newPage();
    vigilar(page);
    const actor: Actor = { rol: 'administrador', identificador: ADMIN, clave: CLAVE, nombre: ADMIN };
    await entrar(page, actor);
    const resumen = page.waitForResponse((r) => r.url().includes('/admin/observability/summary') && r.request().method() === 'GET', { timeout: 60_000 });
    await irA(page, '/superadmin/observability');
    await esperarAplicacionLista(page);
    await resumen;
  });

  test('una sola tarjeta a lo ancho, centrada, sin desborde horizontal (3 viewports)', async () => {
    await expect(page.getByTestId('obs-card')).toBeVisible({ timeout: 30_000 });
    const medidas: unknown[] = [];
    for (const v of VIEWPORTS) {
      await page.setViewportSize({ width: v.width, height: v.height });
      await page.waitForTimeout(500);
      const m = await page.evaluate(() => {
        const tarjeta = document.querySelector('[data-testid="obs-card"]');
        const area = document.querySelector('.app-main__inner') ?? document.querySelector('main');
        const a = tarjeta?.getBoundingClientRect();
        const b = area?.getBoundingClientRect();
        return {
          tarjetas: document.querySelectorAll('app-card').length,
          izq: a && b ? a.left - b.left : null,
          der: a && b ? b.right - a.right : null,
          ancho: a && b ? a.width / b.width : null,
          sobra: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      });
      medidas.push({ viewport: v.nombre, ...m });
      expect(m.tarjetas, 'una sola tarjeta elevada').toBe(1);
      expect(Math.abs((m.izq ?? 0) - (m.der ?? 0)), `holgura izq-der ${v.nombre}`).toBeLessThanOrEqual(2);
      expect(m.ancho ?? 0, `ancho de la tarjeta ${v.nombre}`).toBeGreaterThanOrEqual(0.85);
      expect(m.sobra, `desborde horizontal ${v.nombre}`).toBeLessThanOrEqual(0);
    }
    anotar('composicion', medidas);
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test('Resumen: la cifra de solicitudes es EXACTAMENTE la de Postgres para la misma ventana y el mismo corte', async () => {
    await abrirPestana(page, 'resumen');
    const espera = page.waitForResponse((r) => r.url().includes('/admin/observability/summary') && r.request().method() === 'GET');
    await page.getByTestId('obs-refresh').click();
    const cuerpo = (await (await espera).json()) as {
      generatedAt: string;
      window: { from: string; to: string };
      kpis: { requests: { value: number }; errorRate5xx: { value: number } };
    };
    await reposar(page);
    const ui = await page.getByTestId('obs-kpi-requests').getByTestId('kpi-value').innerText();
    const bd = psql(
      `select coalesce(sum(requests),0), coalesce(sum(requests) filter (where http_status between 500 and 599),0) from observability.http_request_minute_series where time >= '${cuerpo.window.from}' and time < '${cuerpo.window.to}' and created_at <= '${cuerpo.generatedAt}'`,
    ).split('|');
    anotar('resumen', { ui, api: cuerpo.kpis.requests.value, psql: Number(bd[0]), psql5xx: Number(bd[1]), tasa5xx: cuerpo.kpis.errorRate5xx.value });
    expect(Number(ui.replace(/\D/g, ''))).toBe(cuerpo.kpis.requests.value);
    expect(cuerpo.kpis.requests.value).toBe(Number(bd[0]));
    await expect(page.getByTestId('obs-kpi-error-rate-5xx')).toBeVisible();
    await expect(page.getByTestId('obs-freshness')).toContainText('Último dato volcado');
    await capturas(page, 'resumen');
  });

  test('Errores: el 500 provocado es un grupo con 4 ocurrencias y sus requestId; el requestId copiado se encuentra', async () => {
    await abrirPestana(page, 'errores');
    await reposar(page);
    const filaGrupo = page.getByTestId('obs-errores-tabla').locator('tr[data-testid="tabla-fila"]').filter({ has: page.getByTestId(`obs-estado-${grupoId}`) });
    await expect(filaGrupo).toBeVisible({ timeout: 30_000 });
    await capturas(page, 'errores');
    await filaGrupo.click();
    const detalle = page.getByTestId('obs-error-detalle');
    await expect(detalle).toBeVisible();
    await expect(detalle.getByTestId('obs-error-ocurrencias')).not.toHaveText('', { timeout: 20_000 });
    const total = Number((await detalle.getByTestId('obs-error-ocurrencias').innerText()).replace(/\D/g, ''));
    const bd = psql(`select occurrences_total from observability.error_groups where id = '${grupoId}'`);
    expect(total).toBe(Number(bd));
    const idsUi = (await detalle.getByTestId('obs-error-request-id').allInnerTexts()).map((s) => s.trim());
    for (const id of errores500) expect(idsUi).toContain(id);
    anotar('errores.detalle', { ocurrenciasUi: total, ocurrenciasPsql: Number(bd), requestIdsEnUi: idsUi.length });
    await capturas(page, 'errores-detalle');

    // El requestId que un usuario "copió" se busca y se encuentra.
    await page.getByTestId('obs-request-input').fill(errores500[0] ?? '');
    await page.getByTestId('obs-request-buscar').click();
    const hallazgo = page.getByTestId('obs-request-result');
    await expect(hallazgo).toContainText(errores500[0] ?? '', { timeout: 20_000 });
    await expect(hallazgo).toContainText('500');
    await expect(page.getByTestId('obs-request-notfound')).toHaveCount(0);
    await capturas(page, 'errores-requestid', [VIEWPORTS[2]]);
    // Uno que no existe dice la verdad (sólo se guardan errores y muestras lentas).
    await page.getByTestId('obs-request-input').fill('no-existe-este-id');
    await page.getByTestId('obs-request-buscar').click();
    await expect(page.getByTestId('obs-request-notfound')).toBeVisible({ timeout: 20_000 });
  });

  test('Errores: cambiar el estado con motivo sobrevive a la recarga (UI → PATCH → Postgres → recarga → UI)', async () => {
    const detalle = page.getByTestId('obs-error-detalle');
    await expect(detalle).toBeVisible();
    const form = detalle.getByTestId('obs-error-form');
    await expect(form).toBeVisible();
    const versionAntes = Number(psql(`select row_version from observability.error_groups where id = '${grupoId}'`));
    // Resolver sin motivo: el botón no se habilita.
    await form.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Resuelto' }).click();
    await expect(detalle.getByTestId('obs-error-guardar')).toBeDisabled();
    await form.getByRole('textbox').fill('Falla controlada de la prueba F3: sin causa de producto');
    await expect(detalle.getByTestId('obs-error-guardar')).toBeEnabled();
    const patch = page.waitForResponse((r) => r.request().method() === 'PATCH' && r.url().includes('/admin/observability/errors/groups/'));
    await detalle.getByTestId('obs-error-guardar').click();
    const respuesta = await patch;
    anotar('patch', { status: respuesta.status(), requestId: respuesta.headers()['x-request-id'] });
    expect(respuesta.status(), 'PATCH del estado').toBe(200);
    await expect(detalle.getByTestId('obs-error-estado')).toContainText('Resuelto', { timeout: 20_000 });
    const fila = psql(`select row_version, resolution_note, resolved_at is not null from observability.error_groups where id = '${grupoId}'`).split('|');
    expect(Number(fila[0])).toBe(versionAntes + 1);
    expect(fila[1]).toContain('Falla controlada de la prueba F3');
    expect(fila[2]).toBe('t');
    await capturas(page, 'errores-estado-cambiado', [VIEWPORTS[2]]);
    // Recarga completa: el estado viene de la API, no de la memoria de la pantalla.
    await page.reload();
    await esperarAplicacionLista(page);
    await expect(page.getByTestId('obs-card')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('obs-error-estado')).toContainText('Resuelto', { timeout: 30_000 });
    anotar('recarga', 'el estado Resuelto se ve tras page.reload()');
  });

  test('Latencia: la distribución suma exactamente las solicitudes de la ventana', async () => {
    const espera = page.waitForResponse((r) => r.url().includes('/admin/observability/summary') && r.request().method() === 'GET');
    await abrirPestana(page, 'latencia');
    const cuerpo = (await (await espera).json()) as { kpis: { requests: { value: number } }; latencyBuckets: { leMs: number | null; count: number }[] };
    await reposar(page);
    const total = cuerpo.latencyBuckets.find((b) => b.leMs === null)?.count;
    expect(total).toBe(cuerpo.kpis.requests.value);
    await page.getByTestId('chart-obs-latencia-histograma').getByTestId('chart-more').click();
    await page.getByRole('menuitem', { name: /Ver datos en tabla/ }).click();
    const celdas = await page.getByTestId('tabla-obs-latencia-histograma').locator('tbody tr td:last-child').allInnerTexts();
    const suma = celdas.map((c) => Number(c.replace(/\D/g, ''))).reduce((a, b) => a + b, 0);
    anotar('latencia', { sumaHistograma: suma, solicitudes: cuerpo.kpis.requests.value });
    expect(suma).toBe(cuerpo.kpis.requests.value);
    await capturas(page, 'latencia');
  });

  test('Consultas SQL: la sentencia de mayor coste muestra su SQL normalizado y quién la dispara', async () => {
    await abrirPestana(page, 'sql');
    await reposar(page);
    const filas = page.getByTestId('obs-sql-tabla').locator('tr[data-testid="tabla-fila"]');
    await expect(filas.first()).toBeVisible({ timeout: 30_000 });
    await filas.first().click();
    await expect(page.getByTestId('obs-sql-texto')).toBeVisible({ timeout: 20_000 });
    expect(await page.getByTestId('obs-sql-texto').innerText()).toMatch(/select|insert|update|delete/i);
    await capturas(page, 'sql');
  });

  test('Endpoints: la fila UNMATCHED es EXACTAMENTE la de la API y la de Postgres', async () => {
    const espera = page.waitForResponse((r) => r.url().includes('/admin/observability/endpoints') && r.request().method() === 'GET');
    await abrirPestana(page, 'endpoints');
    const cuerpo = (await (await espera).json()) as { items: { method: string; route: string; requests: number }[] };
    await reposar(page);
    const api = cuerpo.items.find((i) => i.route === 'UNMATCHED')?.requests;
    const fila = page.getByTestId('obs-endpoints-tabla').locator('tr[data-testid="tabla-fila"]').filter({ hasText: 'UNMATCHED' }).first();
    await expect(fila).toBeVisible();
    const textoFila = (await fila.innerText()).replace(/\s+/g, ' ');
    anotar('endpoints', { unmatchedApi: api, fila: textoFila });
    expect(textoFila).toContain(String(api).replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
    expect(api).toBeGreaterThanOrEqual(12);
    await capturas(page, 'endpoints');
  });

  test('No medido: lista los límites que declara la API y la salud de la propia medición', async () => {
    await abrirPestana(page, 'no-medido');
    await reposar(page);
    await expect(page.getByTestId('obs-not-measured')).toContainText('Percentiles estimados');
    await expect(page.getByTestId('obs-dropped-flushes')).toBeVisible();
    await capturas(page, 'no-medido');
  });

  test('teclado: las pestañas se recorren con flechas y se activan con Enter (activación manual)', async () => {
    await page.getByRole('tab', { name: 'Resumen', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('obs-tab-errores')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Errores', exact: true })).toHaveAttribute('aria-selected', 'true');
  });

  test('contexto en la URL: rango y zona se reflejan y un enlace reproduce la vista', async () => {
    await page.getByRole('radio', { name: '24 h', exact: true }).click();
    await page.getByRole('radio', { name: 'UTC', exact: true }).click();
    await expect.poll(() => page.url()).toMatch(/rango=24h/);
    expect(page.url()).toMatch(/tz=UTC/);
    await page.getByRole('tab', { name: 'Resumen', exact: true }).click();
    await expect(page.getByTestId('obs-freshness')).toContainText('UTC');
    await capturas(page, 'resumen-24h-utc', [VIEWPORTS[2]]);
    await page.getByRole('radio', { name: 'Hoy', exact: true }).click();
    await page.getByRole('radio', { name: 'La Paz', exact: true }).click();
  });

  test('estado vacío REAL: un filtro sin coincidencias dice por qué y qué hacer (S3)', async () => {
    await abrirPestana(page, 'errores');
    await page.getByTestId('obs-filtro-codigo').fill(`NOEXISTE_${RUN.toUpperCase()}`);
    await expect(page.getByText('Ningún grupo de errores coincide con los filtros.')).toBeVisible({ timeout: 20_000 });
    await capturas(page, 'estado-vacio-errores');
    await page.getByTestId('obs-filtro-codigo').fill('');
  });

  test('estado de error INDUCIDO (S9 con requestId) y datos atrasados INDUCIDOS (S7): rotulados, no cuentan como evidencia de la API', async () => {
    await abrirPestana(page, 'resumen');
    await page.route('**/admin/observability/summary**', async (ruta) => {
      await ruta.fulfill({ status: 500, headers: { 'x-request-id': 'req-inducido-s9' }, contentType: 'application/json', body: JSON.stringify({ code: 'INTERNAL', message: 'error inducido por la prueba', correlationId: 'req-inducido-s9' }) });
    });
    await page.getByTestId('obs-refresh').click();
    await expect(page.getByText('req-inducido-s9').first()).toBeVisible({ timeout: 20_000 });
    await capturas(page, 'estado-error-inducido-resumen');
    await page.unroute('**/admin/observability/summary**');

    await page.route('**/admin/observability/summary**', async (ruta) => {
      const real = await ruta.fetch();
      const j = (await real.json()) as { freshness: { lagSeconds: number | null; lastFlushAt: string | null } };
      j.freshness = { ...j.freshness, lagSeconds: 900, lastFlushAt: new Date(Date.now() - 900_000).toISOString() };
      await ruta.fulfill({ response: real, json: j });
    });
    await page.getByTestId('obs-refresh').click();
    await expect(page.getByText('Está viendo datos que pueden estar atrasados')).toBeVisible({ timeout: 20_000 });
    await capturas(page, 'estado-atrasado-inducido-resumen');
    await page.unroute('**/admin/observability/summary**');
    await page.getByTestId('obs-refresh').click();
  });

  test('sin permiso INDUCIDO en un widget (S5): los demás widgets siguen vivos', async () => {
    await page.route('**/admin/observability/timeseries**', (ruta) =>
      ruta.fulfill({ status: 403, contentType: 'application/json', headers: { 'x-request-id': 'req-inducido-403' }, body: JSON.stringify({ code: 'FORBIDDEN', message: 'sin permiso', correlationId: 'req-inducido-403' }) }),
    );
    await abrirPestana(page, 'resumen');
    await page.getByTestId('obs-refresh').click();
    await expect(page.getByText('No tiene acceso a esta sección').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('obs-kpi-requests')).toBeVisible();
    await capturas(page, 'estado-sin-permiso-inducido-resumen');
    await page.unroute('**/admin/observability/timeseries**');
  });
});

/* ---- control negativo: una cuenta sin rol de lectura ---------------------------------------------------------- */

test('control negativo: una médica (sin rol de plataforma) no recibe datos del panel ni por la API ni por la pantalla', async ({ browser }) => {
  const api = await pwRequest.newContext({ baseURL: API });
  const token = await login(api, MEDICO);
  const r = await api.get('/admin/observability/summary', { headers: { authorization: `Bearer ${token}` } });
  expect(r.status(), 'la API es la autoridad: 403').toBe(403);
  await api.dispose();

  const contexto = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-BO', timezoneId: 'America/La_Paz' });
  const page = await contexto.newPage();
  vigilar(page);
  const actor: Actor = { rol: 'doctora', identificador: MEDICO, clave: CLAVE, nombre: MEDICO };
  await entrar(page, actor);
  await irA(page, '/superadmin/observability');
  await page.waitForTimeout(2_500);
  await expect(page.getByTestId('obs-card')).toHaveCount(0);
  anotar('sinPermisoReal', { urlFinal: page.url() });
  mkdirSync(join(SALIDA, 'capturas'), { recursive: true });
  for (const t of TEMAS) {
    await tema(page, t);
    await page.screenshot({ path: join(SALIDA, 'capturas', `estado-sin-permiso-real-1440-${t}.png`), fullPage: true });
  }
  await contexto.close();
});
