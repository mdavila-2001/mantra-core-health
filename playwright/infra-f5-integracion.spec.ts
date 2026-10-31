import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * F5b (puntos de toma), F5d (consultorio de la agenda), F5f (activos y centros
 * de costo) y el cierre del caso con cargo de quirófano y recambio — evidencia
 * de navegador. Mismo arnés que `infra-f4f5.spec.ts`.
 *
 * Contra `ng serve` con la maqueta (`mockBackend: true`). **Nunca
 * `networkidle`**: con HMR no llega. Se espera siempre un selector concreto.
 *
 * Uso:
 *   E2E_BASE_URL=http://127.0.0.1:4373 PW_CHROMIUM_PATH=… yarn pw infra-f5-integracion --workers=1
 *
 * Deja capturas en `docs/refactor-profesional/trabajo/evidencias/infra-f5-integracion/`
 * y `resultados.json` con mediciones, la cadena de cada mutación (método,
 * ruta, cuerpo, estado, respuesta) y los errores de consola.
 */

const OUT = join(process.cwd(), 'docs', 'refactor-profesional', 'trabajo', 'evidencias', 'infra-f5-integracion');
const WIDTHS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '768', width: 768, height: 1024 },
  { name: '390', width: 390, height: 844 },
] as const;

interface Entry {
  readonly what: string;
  readonly data: unknown;
}
const log: Entry[] = [];
const consoleErrors: string[] = [];

test.describe.configure({ mode: 'serial' });

if (process.env['PW_CHROMIUM_PATH']) {
  test.use({ launchOptions: { executablePath: process.env['PW_CHROMIUM_PATH'] } });
}

test.beforeAll(() => mkdirSync(OUT, { recursive: true }));
test.afterAll(() => writeFileSync(join(OUT, 'resultados.json'), JSON.stringify({ date: new Date().toISOString(), log, consoleErrors }, null, 2)));

async function login(page: Page, email: string, tenantName = 'Hospital San Lucas'): Promise<void> {
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`${page.url()} :: ${m.text()}`);
  });
  page.on('pageerror', (e) => consoleErrors.push(`${page.url()} :: pageerror ${e.message}`));
  await page.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByTestId('login-identifier').fill(email);
  await page.getByTestId('login-password').fill('mockup');
  await page.getByTestId('login-submit').click();
  await page.waitForURL((u) => !/\/auth\/?$/.test(u.pathname), { timeout: 60_000 });
  // Superadmin pasa por la elección de portal y la de organización.
  for (let i = 0; i < 3; i++) {
    const portal = page.getByRole('link', { name: /Entrar a administración/ });
    const tenant = page.getByTestId('tenant-opcion').filter({ hasText: tenantName }).first();
    await Promise.race([
      page.waitForURL(/\/dashboard/, { timeout: 30_000 }).catch(() => undefined),
      portal.waitFor({ timeout: 30_000 }).catch(() => undefined),
      tenant.waitFor({ timeout: 30_000 }).catch(() => undefined),
    ]);
    const choosing = (await portal.isVisible().catch(() => false)) || (await tenant.isVisible().catch(() => false));
    if (!choosing && !page.url().includes('/auth')) break;
    if (await tenant.isVisible().catch(() => false)) await tenant.click();
    else if (await portal.isVisible().catch(() => false)) await portal.click();
    await page.waitForTimeout(1000);
  }
  await expect(page).not.toHaveURL(/\/auth/, { timeout: 60_000 });
  await page.evaluate(() => sessionStorage.setItem('mock:registrar', '1'));
}

interface Write {
  readonly method: string;
  readonly path: string;
  readonly ifMatch: string | null;
  readonly body: unknown;
  readonly status: number;
  readonly response: unknown;
}

/** La última escritura anotada por la maqueta que cumple el filtro. */
async function lastWrite(page: Page, method: string, path: RegExp): Promise<Write> {
  let found: Write | undefined;
  await expect
    .poll(async () => {
      const list = await page.evaluate(() => JSON.parse(sessionStorage.getItem('mock:registro') ?? '[]') as Write[]);
      found = [...list].reverse().find((e) => e.method === method && path.test(e.path));
      return found !== undefined;
    }, { timeout: 30_000 })
    .toBe(true);
  return found!;
}

async function shot(page: Page, name: string, width: string): Promise<void> {
  const view = page.viewportSize();
  if (view !== null) await page.mouse.move(view.width - 8, Math.round(view.height / 2));
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(OUT, `${name}-${width}.png`), fullPage: true });
}

async function overflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** Regla 6: holgura izquierda ≈ derecha respecto de `.app-main__inner` y ancho ≥ 85 %. */
async function measureCard(page: Page, selector: string): Promise<{ left: number; right: number; ratio: number }> {
  return page.evaluate((sel) => {
    const area = document.querySelector('.app-main__inner')!.getBoundingClientRect();
    const card = document.querySelector(sel)!.getBoundingClientRect();
    const style = getComputedStyle(document.querySelector('.app-main__inner')!);
    const l = area.left + parseFloat(style.paddingLeft);
    const r = area.right - parseFloat(style.paddingRight);
    return { left: Math.round(card.left - l), right: Math.round(r - card.right), ratio: Math.round((card.width / (r - l)) * 100) };
  }, selector);
}

async function choose(page: Page, testId: string, option: RegExp): Promise<void> {
  await page.getByTestId(testId).locator('.select-trigger').click();
  await page.locator('dialog.select-dialog[open]').getByRole('option', { name: option }).first().click();
  await expect(page.locator('dialog.select-dialog[open]')).toHaveCount(0);
}

async function fail(page: Page, pattern: string | null, mode?: string): Promise<void> {
  await page.evaluate(
    ([p, m]) => {
      if (p === null) sessionStorage.removeItem('mock:fallos');
      else sessionStorage.setItem('mock:fallos', JSON.stringify([{ patron: p, modo: m, metodos: ['GET'] }]));
    },
    [pattern, mode ?? null] as const,
  );
}

/** El próximo día de la semana (0 = domingo) a partir de `min` días, `yyyy-mm-dd` local. */
async function nextWeekday(page: Page, weekday: number, min: number): Promise<string> {
  return page.evaluate(
    ([w, m]) => {
      const d = new Date();
      d.setDate(d.getDate() + m);
      while (d.getDay() !== w) d.setDate(d.getDate() + 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    },
    [weekday, min] as const,
  );
}

async function record(page: Page, what: string, method: string, path: RegExp, after: Record<string, unknown> = {}): Promise<Write> {
  const w = await lastWrite(page, method, path);
  log.push({ what, data: { request: { method: w.method, path: w.path, ifMatch: w.ifMatch, body: w.body }, response: { status: w.status, body: w.response }, ...after } });
  return w;
}


/* ---- consulta del paciente sembrado (mismo recorrido que carril-insurance-antifraud) ---- */

const PATIENT_DOCUMENT = '5000000';

async function openConsultation(page: Page): Promise<void> {
  await page.goto('/medical-records', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('clinical-record-national-id').fill(PATIENT_DOCUMENT);
  await page.getByTestId('clinical-record-search-by-document').click();
  await page.getByTestId('paciente-ver-expediente').first().click();
  await page.waitForURL(/\/medical-records\/[^/]+$/, { timeout: 60_000 });
  await page.goto(`${new URL(page.url()).pathname}/consultation`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('consulta-rejilla')).toBeVisible({ timeout: 60_000 });
  const open = page.getByTestId('consulta-abrir-encuentro');
  await expect(open.or(page.getByTestId('encuentros-en-curso')).first()).toBeVisible({ timeout: 30_000 });
  if (await open.isVisible()) await open.click();
  await expect(page.getByTestId('encuentros-en-curso')).toBeVisible({ timeout: 30_000 });
}

async function openBox(page: Page, key: string): Promise<Locator> {
  await page.getByTestId(`consulta-casilla-${key}`).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toBeVisible();
  return modal;
}

async function pick(zone: Locator, trigger: Locator, row: (list: Locator) => Locator): Promise<void> {
  await trigger.click();
  const list = zone.page().locator('dialog.select-dialog[open]');
  await expect(list).toBeVisible();
  await row(list).first().click();
  await expect(list).toHaveCount(0);
}

async function answerField(field: Locator): Promise<void> {
  const no = field.getByRole('radio', { name: 'No' }).or(field.getByRole('button', { name: 'No' }));
  if ((await no.count()) > 0) return no.first().click();
  const combo = field.getByRole('combobox');
  if ((await combo.count()) > 0) return pick(field, combo.first(), (l) => l.getByRole('option').filter({ hasNot: field.page().locator('[aria-disabled=true]') }));
  const area = field.locator('textarea');
  if ((await area.count()) > 0) return area.first().fill('Sin hallazgos relevantes.');
  const num = field.locator('input[type=number]');
  if ((await num.count()) > 0) return num.first().fill('1');
  const text = field.locator('input');
  if ((await text.count()) > 0) return text.first().fill('Sin datos');
}

async function submitMedicalForm(page: Page): Promise<void> {
  const modal = await openBox(page, 'formulario');
  const done = modal.getByTestId('formulario-respondido');
  await expect(done.or(modal.getByTestId('campo-especialidad')).first()).toBeVisible({ timeout: 30_000 });
  if (!(await done.isVisible())) {
    const fields = modal.getByTestId('campo-especialidad');
    for (let i = 0; i < (await fields.count()); i += 1) await answerField(fields.nth(i));
    await modal.getByRole('button', { name: 'Completar formulario' }).click();
    await expect(done).toBeVisible({ timeout: 30_000 });
  }
  await modal.getByTestId('content-dialog-close').click();
  await expect(page.getByTestId('consulta-modal')).toHaveCount(0);
}

async function openOrders(page: Page): Promise<Locator> {
  const modal = await openBox(page, 'ordenes');
  await expect(modal.getByTestId('respuesta-del-formulario')).toBeVisible({ timeout: 30_000 });
  return modal;
}

/* ---- capturas por ancho -------------------------------------------------------------- */

for (const w of WIDTHS) {
  test.describe(`F5b · F5d · F5f a ${w.name}`, () => {
    test.use({ viewport: { width: w.width, height: w.height } });

    test('cola del laboratorio con punto de toma y su filtro', async ({ page }) => {
      test.setTimeout(300_000);
      await login(page, 'medica@alovida.mock');
      await page.goto('/diagnostics', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('diagnostics-point').first()).toBeVisible({ timeout: 60_000 });
      log.push({ what: `cola ${w.name}`, data: { overflow: await overflow(page), points: await page.getByTestId('diagnostics-point').allTextContents() } });
      await shot(page, '01-cola-punto-de-toma', w.name);
      await choose(page, 'diagnostics-point-filter', /LAB-TM1/);
      await expect(page.getByTestId('diagnostics-point').first()).toContainText('LAB-TM1', { timeout: 60_000 });
      // La cola se relee con el filtro: se espera a que quede sólo ese punto.
      await expect.poll(async () => (await page.getByTestId('diagnostics-point').allTextContents()).every((t) => t.includes('LAB-TM1')), { timeout: 30_000 }).toBe(true);
      await shot(page, '02-cola-filtrada', w.name);
    });

    test('activos y centros de costo, y el consultorio de la agenda', async ({ page }) => {
      test.setTimeout(300_000);
      await login(page, 'superadmin@alovida.mock');
      await page.goto('/administration/accounting/infrastructure', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('infra-accounting-path').first()).toBeVisible({ timeout: 60_000 });
      log.push({ what: `activos ${w.name}`, data: { overflow: await overflow(page), card: await measureCard(page, '[data-testid=infra-accounting]') } });
      await shot(page, '10-activos', w.name);
      await page.getByTestId('infra-accounting-locate-AF-0103').click();
      await expect(page.locator('[role=tree]')).toBeVisible();
      await shot(page, '11-activo-arbol', w.name);
      await page.getByRole('tab', { name: 'Centros de costo' }).click();
      await expect(page.getByTestId('infra-accounting-centers')).toContainText('CC-110', { timeout: 60_000 });
      await shot(page, '12-centros-de-costo', w.name);
      await fail(page, '/accounting/infrastructure-items', 'error');
      await page.goto('/administration/accounting/infrastructure', { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Algo salió mal').first()).toBeVisible({ timeout: 60_000 });
      await shot(page, '13-estado-S9-activos', w.name);
      await fail(page, null);
    });

    test('consultorio de la agenda (alta de horario)', async ({ page }) => {
      test.setTimeout(300_000);
      await login(page, 'medica@alovida.mock', 'Clínica Los Olivos');
      await page.goto('/schedule/edit', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('agenda-create-room-open')).toBeVisible({ timeout: 60_000 });
      await page.getByTestId('agenda-create-room-open').click();
      await expect(page.getByTestId('agenda-create-room')).toBeVisible({ timeout: 60_000 });
      await page.getByTestId('agenda-create-room-block').scrollIntoViewIfNeeded();
      log.push({ what: `consultorio ${w.name}`, data: { overflow: await overflow(page) } });
      await shot(page, '20-agenda-consultorio', w.name);
    });
  });
}

/* ---- cadenas UI → request → response → persistencia → recarga → UI (1440) --------------- */

test.describe('Cadenas de integración a 1440', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('F5b · pedir un laboratorio con punto de toma y verlo tras recargar', async ({ page }) => {
    test.setTimeout(600_000);
    await login(page, 'medica@alovida.mock');
    await openConsultation(page);
    await submitMedicalForm(page);
    let modal = await openOrders(page);
    await pick(modal, modal.getByRole('combobox', { name: /^Estudio\b/ }), (l) => l.getByRole('option', { name: /Glucosa/ }));
    // El tipo sólo se pregunta cuando el estudio no lo trae fijado.
    const kind = modal.getByRole('combobox', { name: /^Tipo\b/ });
    if ((await kind.count()) > 0) await pick(modal, kind, (l) => l.getByRole('option', { name: 'Laboratorio', exact: true }));
    await choose(page, 'order-collection-point', /LAB-TM2/);
    await shot(page, '30-orden-punto-de-toma', '1440');
    await modal.getByRole('button', { name: 'Pedir estudio' }).click();
    const w = await record(page, 'pedir laboratorio con punto de toma', 'POST', /^\/clinical\/service-requests$/);
    expect(w.status).toBe(201);
    expect((w.body as { suggestedCareSpaceId?: string }).suggestedCareSpaceId).toBeTruthy();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('consulta-rejilla')).toBeVisible({ timeout: 60_000 });
    modal = await openOrders(page);
    await expect(modal.getByTestId('study-collection-point').first()).toContainText('LAB-TM2', { timeout: 60_000 });
    await shot(page, '31-orden-punto-tras-recarga', '1440');
  });

  test('F5f · ubicar un activo con el árbol y ligar un centro de costo', async ({ page }) => {
    test.setTimeout(600_000);
    await login(page, 'superadmin@alovida.mock');
    await page.goto('/administration/accounting/infrastructure', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('infra-accounting-locate-AF-0103').click();
    await page.locator('[role=tree]').getByRole('treeitem', { name: /Quirófano 2/ }).first().click();
    await page.getByTestId('infra-accounting-locate-confirm').click();
    const located = await record(page, 'ubicar la lámpara cialítica en QX-02', 'PATCH', /^\/accounting\/infrastructure-items\//);
    expect(located.status).toBe(200);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('infra-accounting-items')).toContainText('Quirófano 2', { timeout: 60_000 });
    await shot(page, '40-activo-ubicado-recarga', '1440');

    await page.getByRole('tab', { name: 'Centros de costo' }).click();
    await page.getByTestId('infra-accounting-link-CC-900').click();
    await choose(page, 'infra-accounting-unit', /Internación de medicina interna/);
    await page.getByTestId('infra-accounting-link-confirm').click();
    const conflict = await record(page, 'ligar CC-900 a una unidad que ya tiene centro (409)', 'POST', /\/unit-link$/);
    expect(conflict.status).toBe(409);
    await expect(page.getByTestId('infra-accounting-failure')).toBeVisible({ timeout: 30_000 });
    await shot(page, '41-estado-S4-centro-duplicado', '1440');
    await page.getByTestId('infra-accounting-link-CC-120').click();
    await choose(page, 'infra-accounting-unit', /Bloque quirúrgico/);
    await page.getByTestId('infra-accounting-link-confirm').click();
    const linked = await record(page, 'ligar CC-120 al bloque quirúrgico', 'POST', /\/unit-link$/);
    expect(linked.status).toBe(200);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('tab', { name: 'Centros de costo' }).click();
    await expect(page.getByTestId('infra-accounting-centers')).toContainText('Bloque quirúrgico', { timeout: 60_000 });
    await shot(page, '42-centro-ligado-recarga', '1440');
  });

  test('F4 → F5e · cerrar el caso: cargo de quirófano por tiempo y recambio', async ({ page }) => {
    test.setTimeout(600_000);
    await login(page, 'quirofano@alovida.mock');
    const day = await nextWeekday(page, 0, 8);
    await page.goto(`/interventions/new?day=${day}&time=09:00`, { waitUntil: 'domcontentloaded' });
    await choose(page, 'schedule-room', /QX-02/);
    await page.getByTestId('schedule-patient').locator('input').fill('a');
    await page.locator('[role="option"]').first().click();
    await choose(page, 'schedule-surgeon', /./);
    await page.getByTestId('schedule-duration').fill('60');
    await page.getByTestId('schedule-submit').click();
    await page.waitForURL(/\/interventions\/[0-9a-f-]{36}/, { timeout: 60_000 });
    const caseUrl = page.url().split('?')[0]!;
    await page.goto(`${caseUrl}?tab=checklist`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('checklist-create').click();
    const phase = async (code: string) => {
      await page.goto(`${caseUrl}?tab=checklist`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId(`checklist-items-${code}`)).toBeVisible({ timeout: 60_000 });
      await page.getByTestId('checklist-confirm-all').click();
      await page.getByTestId('checklist-submit').click();
      await lastWrite(page, 'POST', /\/responses$/);
    };
    const event = async (code: string) => {
      await page.goto(`${caseUrl}?tab=room`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId(`room-event-${code}`).click();
      await record(page, `evento ${code}`, 'POST', /\/room-events$/);
    };
    await phase('SIGN_IN');
    await event('PATIENT_IN_ROOM');
    await event('ANESTHESIA_START');
    await phase('TIME_OUT');
    await event('INCISION');
    await event('CLOSURE');
    await phase('SIGN_OUT');
    await event('PATIENT_OUT_OF_ROOM');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('room-events-turnover-status')).toContainText('Sucia', { timeout: 60_000 });
    await shot(page, '50-recambio-pendiente', '1440');
    for (const label of ['Inicio de limpieza', 'Fin de limpieza', 'Sala lista']) {
      await page.getByTestId('room-events-turnover-next').click();
      await record(page, `recambio · ${label}`, 'POST', /^\/cleaning-orders\//);
      await expect(page.getByTestId('room-events-timeline')).toContainText(label, { timeout: 60_000 });
    }
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('room-events-turnover-status')).toContainText('Lista para el próximo caso', { timeout: 60_000 });
    await shot(page, '51-recambio-completo-recarga', '1440');

    // La pestaña «Cargos» la lee Facturación: el uso de quirófano por tiempo.
    // Cambio de cuenta en la misma pestaña: la maqueta vive en su sessionStorage.
    await page.evaluate(() => localStorage.clear());
    await page.goto('/auth', { waitUntil: 'domcontentloaded' });
    await page.reload({ waitUntil: 'domcontentloaded' });
    const billing = page;
    await login(billing, 'facturacion@alovida.mock');
    await billing.goto(`${caseUrl}?tab=charges`, { waitUntil: 'domcontentloaded' });
    await expect(billing.getByTestId('case-charge')).toContainText('ORTIME:', { timeout: 60_000 });
    log.push({ what: 'cargo de quirófano', data: { text: (await billing.getByTestId('case-charge').textContent())?.replace(/\s+/g, ' ').trim() } });
    await shot(billing, '52-cargo-quirofano', '1440');
  });
});
