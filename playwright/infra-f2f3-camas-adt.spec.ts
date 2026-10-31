import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * Franjas F2 (operación de camas, limpieza, tablero) y F3 (internación / ADT)
 * — evidencia de navegador.
 *
 * Contra `ng serve` con la maqueta (`--configuration development,demo`).
 * **Nunca `networkidle`**: con HMR no llega. Se espera siempre un selector.
 *
 * Uso:
 *   E2E_BASE_URL=http://127.0.0.1:4371 yarn pw infra-f2f3-camas-adt --workers=1
 *
 * Deja capturas en `docs/refactor-profesional/trabajo/evidencias/infra-f2f3/`
 * y `resultados.json` con la cadena UI → petición → respuesta → persistencia
 * de la maqueta → recarga → UI de cada mutación.
 */

const SALIDA = join(process.cwd(), 'docs', 'refactor-profesional', 'trabajo', 'evidencias', 'infra-f2f3');
const ANCHOS = [
  { nombre: '1440', width: 1440, height: 900 },
  { nombre: '768', width: 768, height: 1024 },
  { nombre: '390', width: 390, height: 844 },
] as const;

interface Registro {
  readonly que: string;
  readonly datos: unknown;
}
const registro: Registro[] = [];
const consoleErrors: string[] = [];

test.describe.configure({ mode: 'serial' });

if (process.env['PW_CHROMIUM_PATH']) {
  test.use({ launchOptions: { executablePath: process.env['PW_CHROMIUM_PATH'] } });
}

test.beforeAll(() => mkdirSync(SALIDA, { recursive: true }));
/* Se acumula: correr sólo una parte (`-g`) no borra lo que dejó la otra. */
test.afterAll(() => {
  const archivo = join(SALIDA, 'resultados.json');
  const previo = existsSync(archivo) ? (JSON.parse(readFileSync(archivo, 'utf8')) as { corridas?: unknown[] }) : {};
  const corrida = { fecha: new Date().toISOString(), registro, consoleErrors };
  writeFileSync(archivo, JSON.stringify({ corridas: [...(previo.corridas ?? []), corrida] }, null, 2));
});

function escuchar(page: Page): void {
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`${page.url()} :: ${m.text()}`);
  });
  page.on('pageerror', (e) => consoleErrors.push(`${page.url()} :: pageerror ${e.message}`));
}

/** Entra con una cuenta; la maqueta (sessionStorage) se conserva entre cuentas. */
async function entrar(page: Page, correo: string, organizacion = 'Hospital San Lucas'): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('mantra.refresh-token');
    localStorage.removeItem('mantra.session');
    localStorage.removeItem('mantra.selected-tenant');
  }).catch(() => undefined);
  await page.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByTestId('login-identifier').fill(correo);
  await page.getByTestId('login-password').fill('mockup');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization|portal-selector)/, { timeout: 60_000 });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').filter({ hasText: organizacion }).first().click();
    await page.waitForURL(/\/(dashboard|portal-selector)/, { timeout: 60_000 });
  }
  await page.evaluate(() => sessionStorage.setItem('mock:registrar', '1'));
}

interface Escritura {
  readonly method: string;
  readonly path: string;
  readonly ifMatch: string | null;
  readonly ifMatchOps: string | null;
  readonly body: unknown;
  readonly status: number;
  readonly requestId: string | null;
}

async function ultimaEscritura(page: Page, metodo: string, ruta: RegExp): Promise<Escritura> {
  let hallada: Escritura | undefined;
  await expect
    .poll(async () => {
      const lista = await page.evaluate(() => JSON.parse(sessionStorage.getItem('mock:registro') ?? '[]') as Escritura[]);
      hallada = [...lista].reverse().find((e) => e.method === metodo && ruta.test(e.path));
      return hallada !== undefined;
    }, { timeout: 30_000 })
    .toBe(true);
  return hallada!;
}

/** Las filas persistidas por la maqueta (lo que en la API sería un SELECT). */
async function persistido<T>(page: Page, clave: string): Promise<T[]> {
  return page.evaluate((k) => (JSON.parse(sessionStorage.getItem(k) ?? '{"filas":[]}') as { filas: unknown[] }).filas, clave) as Promise<T[]>;
}

async function fallos(page: Page, lista: readonly { patron: string; modo: string; metodos?: string[] }[]): Promise<void> {
  await page.evaluate((l) => (l.length === 0 ? sessionStorage.removeItem('mock:fallos') : sessionStorage.setItem('mock:fallos', JSON.stringify(l))), lista);
}

async function captura(page: Page, nombre: string, ancho: string): Promise<void> {
  const vista = page.viewportSize();
  if (vista !== null) await page.mouse.move(vista.width - 8, Math.round(vista.height / 2));
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(SALIDA, `${nombre}-${ancho}.png`), fullPage: true });
}

async function desborde(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** Regla 6: holgura izquierda ≈ derecha respecto de `.app-main__inner` y ancho ≥ 85 %. */
async function medirTarjeta(page: Page, selector: string): Promise<{ izquierda: number; derecha: number; proporcion: number }> {
  return page.evaluate((sel) => {
    const area = document.querySelector('.app-main__inner')!.getBoundingClientRect();
    const tarjeta = document.querySelector(sel)!.getBoundingClientRect();
    const estilo = getComputedStyle(document.querySelector('.app-main__inner')!);
    const izquierdaArea = area.left + parseFloat(estilo.paddingLeft);
    const derechaArea = area.right - parseFloat(estilo.paddingRight);
    return {
      izquierda: Math.round(tarjeta.left - izquierdaArea),
      derecha: Math.round(derechaArea - tarjeta.right),
      proporcion: Math.round((tarjeta.width / (derechaArea - izquierdaArea)) * 100),
    };
  }, selector);
}

/** Elige una opción de un `app-select` (abre su `<dialog>` y hace clic en la opción). */
async function elegir(page: Page, control: Locator, opcion: string | RegExp): Promise<void> {
  await control.getByRole('combobox').first().click();
  const dialogo = page.locator('dialog[open]').last();
  await dialogo.getByRole('option', { name: opcion }).first().click();
}

/** Una acción de fila: botón directo (hasta dos) o ítem del menú «Acciones» (tres o más). */
async function rowAction(page: Page, fila: Locator, nombre: string): Promise<void> {
  await expect(fila.getByRole('button').first()).toBeVisible({ timeout: 60_000 });
  const directo = fila.getByRole('button', { name: nombre });
  if ((await directo.count()) > 0) {
    await directo.first().click();
    return;
  }
  await fila.getByRole('button', { name: /Acciones/ }).click();
  await page.getByRole('menuitem', { name: nombre }).click();
}

const tile = (page: Page, codigo: string) => page.locator(`[data-testid=bed-tile][data-bed="${codigo}"]`);

async function tablero(page: Page): Promise<void> {
  await page.goto('/inpatient/bed-board', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('bed-board')).toBeVisible({ timeout: 60_000 });
}

/* ========================================================================== */

test('F2/F3 · cadena completa a 1440 (ingreso → traslado → limpieza → inspección → egreso → censo → indicadores)', async ({ page }) => {
  test.setTimeout(900_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  escuchar(page);
  await page.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 120_000 });

  // ---- 1. Ingreso con cama (admisión) -------------------------------------
  await entrar(page, 'admision@alovida.mock');
  await tablero(page);
  await expect(tile(page, '301-B')).toHaveAttribute('data-v2', 'U');
  await captura(page, '10-board-before', '1440');

  await page.goto('/inpatient/admissions/new', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('admission-new')).toBeVisible({ timeout: 60_000 });
  const patientBox = page.getByTestId('admission-patient');
  await patientBox.getByRole('combobox').fill('Torrez');
  await page.getByRole('option', { name: /Torrez/ }).first().click();
  await elegir(page, page.locator('app-form-field', { hasText: 'Profesional a cargo' }), /.+/);
  await captura(page, '11-admission-step-1-patient', '1440');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await elegir(page, page.locator('app-form-field', { hasText: 'Origen del ingreso' }), 'Emergencias');
  await page.locator('app-form-field', { hasText: 'Motivo de internación' }).locator('textarea').fill('Apendicitis aguda operada; posoperatorio inmediato.');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByTestId('bed-picker')).toBeVisible();
  await tile(page, '301-B').click();
  await expect(page.getByTestId('bed-compatible')).toBeVisible();
  await captura(page, '12-admission-step-3-bed-compatible', '1440');
  await page.getByRole('button', { name: 'Siguiente' }).click();
  await expect(page.getByTestId('admission-summary')).toContainText('301-B');
  await captura(page, '13-admission-step-4-confirm', '1440');
  await page.getByTestId('admission-submit').click();
  await page.waitForURL(/\/inpatient\/stays\//, { timeout: 60_000 });
  await expect(page.getByTestId('stay')).toBeVisible();

  const alta = await ultimaEscritura(page, 'POST', /^\/clinical\/admissions$/);
  expect(alta.status).toBe(201);
  const ubicaciones = await persistido<{ careSpaceId: string; statusCode: string; encounterId: string }>(page, 'mock.adt.ubicaciones');
  const eventos = await persistido<{ axisCode: string; toCode: string; requestId: string }>(page, 'mock.ops.eventos-a20');
  registro.push({ que: 'ingreso · petición y respuesta', datos: alta });
  registro.push({ que: 'ingreso · encounter_locations ACTIVE', datos: ubicaciones.filter((u) => u.statusCode === 'LOCATION_ACTIVE') });
  registro.push({ que: 'ingreso · A20 ocupación', datos: eventos.filter((e) => e.requestId === alta.requestId) });
  expect(eventos.some((e) => e.requestId === alta.requestId && e.axisCode === 'AXIS_OCCUPANCY' && e.toCode === 'OCC_OCCUPIED')).toBe(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('stay')).toContainText('301-B');
  await captura(page, '14-stay-after-reload', '1440');
  const fichaUrl = page.url();

  // ---- 2. Traslado 301-B → 303-A (enfermería) -----------------------------
  await entrar(page, 'enfermeria@alovida.mock');
  await tablero(page);
  await expect(tile(page, '301-B')).toHaveAttribute('data-v2', 'O');
  await tile(page, '301-B').click();
  await expect(page.getByTestId('bed-panel')).toBeVisible();
  await captura(page, '20-panel-occupied-bed', '1440');
  await page.getByTestId('bed-transfer').click();
  await elegir(page, page.getByTestId('move-target'), /303-A/);
  await expect(page.getByTestId('move-compatible')).toBeVisible();
  await captura(page, '21-transfer-dialog', '1440');
  await page.getByTestId('move-submit').click();
  const traslado = await ultimaEscritura(page, 'POST', /\/transfer$/);
  expect(traslado.status).toBe(200);
  expect(traslado.ifMatch).not.toBeNull();
  registro.push({ que: 'traslado · petición y respuesta (If-Match del encuentro)', datos: traslado });
  const tras = await persistido<{ careSpaceId: string; statusCode: string; endReasonCode: string | null; periodEnd: string | null }>(page, 'mock.adt.ubicaciones');
  registro.push({ que: 'traslado · origen COMPLETED / destino ACTIVE', datos: tras.slice(-2) });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('bed-board')).toBeVisible({ timeout: 60_000 });
  await expect(tile(page, '301-B')).toHaveAttribute('data-v2', 'H');
  await expect(tile(page, '303-A')).toHaveAttribute('data-v2', 'O');
  await captura(page, '22-board-after-transfer-reload', '1440');

  // ---- 3. Limpieza de la 301-B (limpieza) y su inspección (supervisora) ---
  await entrar(page, 'limpieza@alovida.mock');
  await page.goto('/inpatient/cleaning', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('cleaning-queue')).toBeVisible({ timeout: 60_000 });
  const fila = page.locator('tr, [role=row]', { hasText: '301-B' }).first();
  await expect(fila).toContainText('Traslado');
  await expect(page.getByTestId('cleaning-queue')).not.toContainText('Torrez');
  await captura(page, '30-queue-transfer-order', '1440');
  await rowAction(page, fila, 'Empezar');
  const empezar = await ultimaEscritura(page, 'POST', /\/start$/);
  await expect(fila).toContainText('En curso');
  await rowAction(page, fila, 'Terminar');
  await page.locator('dialog[open]').last().getByRole('button', { name: 'Terminar' }).click();
  const terminar = await ultimaEscritura(page, 'POST', /\/finish$/);
  await expect(fila).toContainText('falta inspección');
  registro.push({ que: 'limpieza · empezar y terminar (If-Match de la orden)', datos: [empezar, terminar] });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('tr, [role=row]', { hasText: '301-B' }).first()).toContainText('falta inspección');
  await captura(page, '31-queue-finished-after-reload', '1440');

  await entrar(page, 'supervisora.limpieza@alovida.mock');
  await page.goto('/inpatient/cleaning', { waitUntil: 'domcontentloaded' });
  const filaSup = page.locator('tr, [role=row]', { hasText: '301-B' }).first();
  await rowAction(page, filaSup, 'Inspeccionar');
  await page.locator('dialog[open]').last().getByRole('button', { name: 'Aprobar' }).click();
  const inspeccion = await ultimaEscritura(page, 'POST', /\/inspect$/);
  expect(inspeccion.status).toBe(200);
  registro.push({ que: 'limpieza · inspección por otra persona', datos: inspeccion });
  const ordenes = await persistido<{ careSpaceId: string; statusCode: string; finishedByUserId: string; inspectedByUserId: string }>(page, 'mock.ops.limpiezas');
  registro.push({ que: 'limpieza · fila de cleaning_orders INSPECTED', datos: ordenes.filter((o) => o.statusCode === 'CLN_INSPECTED').slice(-1) });
  await tablero(page);
  await expect(tile(page, '301-B')).toHaveAttribute('data-v2', 'U');
  await captura(page, '32-board-bed-assignable-again', '1440');

  // ---- 4. Egreso desde la ficha (enfermería) ------------------------------
  await entrar(page, 'enfermeria@alovida.mock');
  await page.goto(`${fichaUrl.split('?')[0]}?tab=discharge`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('stay')).toBeVisible({ timeout: 60_000 });
  await elegir(page, page.getByTestId('stay-disposition'), 'Alta a domicilio');
  await captura(page, '40-stay-discharge', '1440');
  await page.getByRole('button', { name: 'Dar de alta' }).click();
  const confirmar = page.locator('dialog[open]').last().getByRole('button', { name: /Dar de alta|Confirmar/ });
  if (await confirmar.isVisible().catch(() => false)) await confirmar.click();
  const egreso = await ultimaEscritura(page, 'POST', /\/discharge$/);
  expect(egreso.status).toBe(200);
  registro.push({ que: 'egreso · petición y respuesta', datos: egreso });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('stay-status')).toContainText('Egresada');
  await page.goto(`${fichaUrl.split('?')[0]}?tab=movements`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('stay-movements')).toContainText('A02');
  await captura(page, '41-stay-movements-after-discharge', '1440');
  await tablero(page);
  await expect(tile(page, '303-A')).toHaveAttribute('data-v2', 'H');
  await captura(page, '42-board-dirty-after-discharge', '1440');

  // ---- 5. Cierre del censo de ayer (supervisión) e indicadores -------------
  await entrar(page, 'supervision@alovida.mock');
  await page.goto('/inpatient/census', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('census')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('census-table')).toContainText('Abierto');
  await captura(page, '50-census-open', '1440');
  await page.getByTestId('census-close').click();
  await page.locator('dialog[open]').last().getByRole('button', { name: 'Cerrar censo' }).click();
  const cierre = await ultimaEscritura(page, 'POST', /\/census\/.*\/close$/);
  expect(cierre.status).toBe(200);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('census-table')).toContainText('Cerrado');
  await page.getByTestId('census-adjust').first().click();
  await page.getByTestId('adjust-value').locator('input').fill('2');
  await page.getByTestId('adjust-reason').locator('textarea').fill('Ingreso de las 23:50 registrado tarde');
  await page.getByTestId('adjust-submit').click();
  const ajuste = await ultimaEscritura(page, 'POST', /\/adjustments$/);
  expect(ajuste.status).toBe(201);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('census-adjustments')).toContainText('→ 2');
  await captura(page, '51-census-closed-adjusted', '1440');
  registro.push({ que: 'censo · cierre y ajuste', datos: [cierre, ajuste, (await persistido(page, 'mock.adt.ajustes')).slice(-1)] });

  await page.goto('/inpatient/indicators', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('indicators-kpis')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('kpi-occupancy')).toContainText('%');
  await captura(page, '52-indicators', '1440');
});

/* ---- Estados M34 y pantallas a 1440 / 768 / 390 ------------------------------ */

/**
 * S1 y S2 duran lo que la latencia de la maqueta (120 ms), que es un
 * temporizador. Con el reloj de Playwright instalado **antes** de cargar la
 * aplicación, se detiene el tiempo y se entra a la pantalla por el menú (sin
 * recargar): el acceso queda pendiente (S1) y, al avanzar 150 ms, el dato
 * queda cargando (S2). Si no se logra, se anota y no se inventa la captura.
 */
async function congelarNavegacion(page: Page, enlace: string, nombre: string, ancho: string): Promise<void> {
  try {
    const link = page.getByRole('navigation', { name: 'Navegación principal' }).getByRole('link', { name: enlace });
    // Por debajo de 1024 px el menú es un cajón animado: con el reloj detenido no
    // termina de abrirse. S1 y S2 se capturan sólo en el ancho de escritorio.
    if ((page.viewportSize()?.width ?? 0) < 1024 || !(await link.isVisible().catch(() => false))) {
      registro.push({ que: `${nombre} · S1/S2 a ${ancho}`, datos: 'menú lateral plegado en este ancho: no se congeló' });
      return;
    }
    await page.clock.pauseAt(new Date(Date.now() + 1000));
    await link.click();
    // El router también agenda temporizadores: se avanza de a 10 ms hasta ver cada estado.
    const stepUntil = async (visible: () => Promise<boolean>): Promise<boolean> => {
      for (let i = 0; i < 40; i++) {
        if (await visible()) return true;
        await page.clock.runFor(10);
      }
      return visible();
    };
    const s1 = await stepUntil(() => page.getByText('Verificando permisos').first().isVisible().catch(() => false));
    registro.push({ que: `${nombre} · S1 congelado a ${ancho}`, datos: s1 });
    if (s1) await page.screenshot({ path: join(SALIDA, `${nombre}-s1-auth-pending-${ancho}.png`), fullPage: true });
    const s2 = await stepUntil(() => page.locator('.view-state-host__loading').first().isVisible().catch(() => false));
    registro.push({ que: `${nombre} · S2 congelado a ${ancho}`, datos: s2 });
    if (s2) await page.screenshot({ path: join(SALIDA, `${nombre}-s2-loading-${ancho}.png`), fullPage: true });
    await page.clock.resume();
  } catch (e) {
    registro.push({ que: `${nombre} · S1/S2 no se pudieron congelar a ${ancho}`, datos: String(e) });
    await page.clock.resume().catch(() => undefined);
  }
}

for (const ancho of ANCHOS) {
  test.describe(`F2/F3 a ${ancho.nombre}`, () => {
    test.use({ viewport: { width: ancho.width, height: ancho.height } });

    test('tablero: listo, lista, panel y los nueve estados M34', async ({ page }) => {
      test.setTimeout(600_000);
      escuchar(page);
      await page.clock.install();
      await page.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await entrar(page, 'enfermeria@alovida.mock');
      await congelarNavegacion(page, 'Tablero de camas', '68-board', ancho.nombre);

      await tablero(page);
      await expect(page.getByTestId('board-freshness')).toContainText('Actualizado hace');
      expect(await desborde(page)).toBeLessThanOrEqual(0);
      const medida = await medirTarjeta(page, '[data-testid=bed-board]');
      registro.push({ que: `regla 6 · tablero a ${ancho.nombre}`, datos: medida });
      expect(Math.abs(medida.izquierda - medida.derecha)).toBeLessThanOrEqual(2);
      expect(medida.proporcion).toBeGreaterThanOrEqual(85);
      await captura(page, '60-board-grid', ancho.nombre);
      await page.goto('/inpatient/bed-board?view=list', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('board-list')).toBeVisible({ timeout: 60_000 });
      expect(await desborde(page)).toBeLessThanOrEqual(0);
      await captura(page, '61-board-list', ancho.nombre);
      await tablero(page);
      await tile(page, '302-B').click();
      await expect(page.getByTestId('bed-panel')).toContainText('Mantenimiento');
      await captura(page, '62-panel-bed-maintenance', ancho.nombre);
      await page.getByTestId('cajon-cerrar').click();

      // S4: la API rechaza el bloqueo (409 simulado) y el diálogo lo dice.
      await tile(page, '303-A').click();
      await page.getByTestId('bed-block-clinical').click();
      await elegir(page, page.getByTestId('block-reason'), 'Falta de personal');
      await fallos(page, [{ patron: '/availability', modo: 'conflict', metodos: ['POST'] }]);
      await page.getByTestId('block-submit').click();
      await expect(page.locator('dialog[open]').last()).toContainText('Revise lo ingresado');
      await captura(page, '63-s4-block-rejected', ancho.nombre);
      await fallos(page, []);
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');

      // S7: el sondeo falla y quedan los datos previos, con su antigüedad.
      await tablero(page);
      await fallos(page, [{ patron: '/bed-board', modo: 'red' }]);
      await page.getByTestId('board-refresh').click();
      await expect(page.getByText('Está viendo datos que pueden estar atrasados')).toBeVisible();
      await expect(page.getByTestId('bed-board')).toBeVisible();
      await captura(page, '64-s7-stale-data', ancho.nombre);

      // S8 y S9 al entrar; S6 si la sede no responde.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Sin conexión')).toBeVisible({ timeout: 60_000 });
      await captura(page, '65-s8-offline', ancho.nombre);
      await fallos(page, [{ patron: '/bed-board', modo: 'error' }]);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Código de soporte')).toBeVisible({ timeout: 60_000 });
      await captura(page, '66-s9-error-request-id', ancho.nombre);
      await fallos(page, [{ patron: '/bed-board', modo: 'not-found' }]);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByText('No encontramos lo que busca')).toBeVisible({ timeout: 60_000 });
      await captura(page, '67-s6-not-found', ancho.nombre);
      await fallos(page, []);

      // S5: la médica, en el hospital, no tiene rol operativo.
      await entrar(page, 'medica@alovida.mock');
      await page.goto('/inpatient/bed-board', { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('No tiene acceso a esta sección')).toBeVisible({ timeout: 60_000 });
      await captura(page, '69-s5-no-operational-role', ancho.nombre);

      // S3: el anexo norte del hospital no tiene camas → «Crear camas».
      await entrar(page, 'superadmin@alovida.mock');
      await tablero(page);
      await elegir(page, page.getByTestId('board-filters'), /Anexo Norte/);
      await expect(page.getByRole('link', { name: 'Crear camas' })).toBeVisible({ timeout: 60_000 });
      await captura(page, '70-s3-no-beds', ancho.nombre);
    });

    test('cola de limpieza: lista sin pacientes, «mías» vacía y estados', async ({ page }) => {
      test.setTimeout(400_000);
      escuchar(page);
      await page.clock.install();
      await page.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 120_000 });
      await entrar(page, 'limpieza@alovida.mock');
      await congelarNavegacion(page, 'Cola de limpieza', '77-queue', ancho.nombre);
      await page.goto('/inpatient/cleaning', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('queue-table')).toContainText('REC-1', { timeout: 60_000 });
      expect(await desborde(page)).toBeLessThanOrEqual(0);
      await captura(page, '71-queue', ancho.nombre);
      // Limpieza no tiene inspección: la orden en curso ofrece sólo terminar.
      await fallos(page, [{ patron: '/cleaning-orders/', modo: 'conflict', metodos: ['POST'] }]);
      await rowAction(page, page.locator('tr, [role=row]', { hasText: 'REC-1' }).first(), 'Empezar');
      await expect(page.getByTestId('queue-failure')).toContainText('Revise lo ingresado');
      await captura(page, '72-s4-transition-rejected', ancho.nombre);
      await fallos(page, [{ patron: '/cleaning-orders', modo: 'red', metodos: ['GET'] }]);
      await page.getByRole('button', { name: 'Actualizar' }).click();
      await expect(page.getByText('Está viendo datos que pueden estar atrasados')).toBeVisible();
      await captura(page, '73-s7-queue-stale', ancho.nombre);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Sin conexión')).toBeVisible({ timeout: 60_000 });
      await captura(page, '74-s8-queue-offline', ancho.nombre);
      await fallos(page, [{ patron: '/cleaning-orders', modo: 'error', metodos: ['GET'] }]);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Código de soporte')).toBeVisible({ timeout: 60_000 });
      await captura(page, '75-s9-queue-error', ancho.nombre);
      await fallos(page, [{ patron: '/cleaning-orders', modo: 'not-found', metodos: ['GET'] }]);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(page.getByText('No encontramos lo que busca')).toBeVisible({ timeout: 60_000 });
      await captura(page, '76-s6-queue-not-found', ancho.nombre);
      await fallos(page, []);

      await entrar(page, 'supervisora.limpieza@alovida.mock');
      await page.goto('/inpatient/cleaning?scope=mine', { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('No tiene limpiezas asignadas.')).toBeVisible({ timeout: 60_000 });
      await captura(page, '78-s3-mine-empty', ancho.nombre);
      await entrar(page, 'mantenimiento@alovida.mock');
      await page.goto('/inpatient/cleaning', { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('No tiene acceso a esta sección')).toBeVisible({ timeout: 60_000 });
      await captura(page, '79-s5-queue-forbidden', ancho.nombre);
    });

    test('ingreso, ficha, censo e indicadores: pantallas y estados clave', async ({ page }) => {
      test.setTimeout(500_000);
      escuchar(page);
      await page.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 120_000 });

      // S5 del ingreso para limpieza.
      await entrar(page, 'limpieza@alovida.mock');
      await page.goto('/inpatient/admissions/new', { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('No tiene acceso a esta sección')).toBeVisible({ timeout: 60_000 });
      await captura(page, '80-s5-admission-housekeeping', ancho.nombre);

      // Compatibilidad forzable: una mujer en la 301 (comparte con un varón).
      await entrar(page, 'supervision@alovida.mock');
      await page.goto('/inpatient/admissions/new?bed=', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('admission-new')).toBeVisible({ timeout: 60_000 });
      const medidaIngreso = await medirTarjeta(page, '[data-testid=admission-new]');
      registro.push({ que: `regla 6 · ingreso a ${ancho.nombre}`, datos: medidaIngreso });
      expect(Math.abs(medidaIngreso.izquierda - medidaIngreso.derecha)).toBeLessThanOrEqual(2);
      await page.getByTestId('admission-patient').getByRole('combobox').fill('Guzmán');
      await page.getByRole('option', { name: /Guzmán/ }).first().click();
      await elegir(page, page.locator('app-form-field', { hasText: 'Profesional a cargo' }), /.+/);
      expect(await desborde(page)).toBeLessThanOrEqual(0);
      await captura(page, '81-admission-patient-step', ancho.nombre);
      await page.getByRole('button', { name: 'Siguiente' }).click();
      await elegir(page, page.locator('app-form-field', { hasText: 'Origen del ingreso' }), 'Consulta externa');
      await page.locator('app-form-field', { hasText: 'Motivo de internación' }).locator('textarea').fill('Celulitis de miembro inferior');
      await page.getByRole('button', { name: 'Siguiente' }).click();
      await tile(page, '301-B').click();
      await expect(page.getByTestId('bed-violation')).toContainText('otro sexo');
      await expect(page.getByTestId('bed-force')).toBeVisible();
      await captura(page, '82-admission-bed-overridable', ancho.nombre);
      await page.getByTestId('bed-force').click();
      const dialogo = page.locator('dialog[open]').last();
      await dialogo.locator('textarea').fill('Única cama libre del piso; se separa con biombo y se reubica mañana.');
      await dialogo.getByRole('button', { name: 'Forzar con justificación' }).click();
      await expect(page.getByTestId('bed-override')).toBeVisible();
      await captura(page, '83-admission-override-justified', ancho.nombre);
      await page.getByRole('button', { name: 'Siguiente' }).click();
      await page.getByTestId('admission-submit').click();
      await page.waitForURL(/\/inpatient\/stays\//, { timeout: 60_000 });
      const ficha = page.url().split('?')[0]!;
      for (const [i, clave] of ['bed', 'movements', 'incidents', 'discharge'].entries()) {
        await page.goto(`${ficha}?tab=${clave}`, { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('stay')).toBeVisible({ timeout: 60_000 });
        expect(await desborde(page)).toBeLessThanOrEqual(0);
        await captura(page, `84-stay-${i + 1}-${clave}`, ancho.nombre);
      }
      await expect(page.getByTestId('stay-review')).toBeHidden();
      await page.goto(`${ficha}?tab=incidents`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('stay-incidents')).toContainText('Sexo de la habitación');
      const medidaFicha = await medirTarjeta(page, '[data-testid=stay]');
      registro.push({ que: `regla 6 · ficha de internación a ${ancho.nombre}`, datos: medidaFicha });
      expect(Math.abs(medidaFicha.izquierda - medidaFicha.derecha)).toBeLessThanOrEqual(2);
      await page.goto('/inpatient/stays/no-existe', { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('No encontramos lo que busca')).toBeVisible({ timeout: 60_000 });
      await captura(page, '85-s6-stay-missing', ancho.nombre);

      // Censo (abierto, vista previa) e indicadores (faltan días → S7; período sin días → S3).
      await page.goto('/inpatient/census', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('census-table')).toContainText('Abierto', { timeout: 60_000 });
      expect(await desborde(page)).toBeLessThanOrEqual(0);
      await captura(page, '86-census-open', ancho.nombre);
      await page.goto('/inpatient/indicators', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('indicators-missing')).toBeVisible({ timeout: 60_000 });
      expect(await desborde(page)).toBeLessThanOrEqual(0);
      await captura(page, '87-indicators-s7-missing-days', ancho.nombre);
      await page.goto('/inpatient/indicators?from=2025-01-01&to=2025-01-07', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('link', { name: /Cerrar el censo del/ })).toBeVisible({ timeout: 60_000 });
      await captura(page, '88-indicators-s3-no-days', ancho.nombre);

      // La pestaña Operación de la ficha de espacio de F1 (soporte: lectura).
      await entrar(page, 'superadmin@alovida.mock');
      await tablero(page);
      const id = await page.locator('li[data-space-id]', { has: tile(page, '302-B') }).getAttribute('data-space-id');
      await page.goto(`/administration/medical-organization/spaces/${id}?tab=operations`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('space-ops-tab')).toBeVisible({ timeout: 60_000 });
      await expect(page.getByTestId('space-ops-blocks')).toContainText('Falla de equipo');
      await captura(page, '89-space-detail-operations-tab', ancho.nombre);
    });
  });
}
