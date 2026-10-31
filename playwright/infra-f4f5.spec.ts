import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

/**
 * Franjas F4 (quirófanos) y F5 (integración) — evidencia de navegador.
 *
 * Contra `ng serve` con la maqueta (`mockBackend: true`). **Nunca
 * `networkidle`**: con HMR no llega. Se espera siempre un selector concreto.
 *
 * Uso:
 *   E2E_BASE_URL=http://127.0.0.1:4373 PW_CHROMIUM_PATH=… yarn pw infra-f4f5 --workers=1
 *
 * Deja capturas en `docs/refactor-profesional/trabajo/evidencias/infra-f4f5/`
 * y `resultados.json` con mediciones, la cadena de cada mutación (método,
 * ruta, cuerpo, estado, respuesta) y los errores de consola.
 */

const OUT = join(process.cwd(), 'docs', 'refactor-profesional', 'trabajo', 'evidencias', 'infra-f4f5');
const WIDTHS = [
  { name: '1440', width: 1440, height: 900 },
  { name: '768', width: 768, height: 1024 },
  { name: '390', width: 390, height: 844 },
] as const;

/** El `uuid(semilla)` determinista de la maqueta (`core/mock/mock-store.ts`). */
function mockUuid(seed: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
  }
  const hex = (n: number): string => n.toString(16).padStart(8, '0');
  const raw = `${hex(h1)}${hex(h2)}${hex((h1 * 31 + h2) >>> 0)}${hex((h2 * 17 + h1) >>> 0)}`;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-a${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
}

/** Id de un espacio de San Lucas (`idDeEspacio` de `fixtures/infraestructura.ts`). */
const spaceId = (code: string): string => mockUuid(`space-SANLUCAS-${code}`);

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

async function login(page: Page, email: string): Promise<void> {
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
    const tenant = page.getByTestId('tenant-opcion').filter({ hasText: 'Hospital San Lucas' }).first();
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

/* ---- capturas por ancho -------------------------------------------------------------- */

for (const w of WIDTHS) {
  test.describe(`F4/F5 a ${w.name}`, () => {
    test.use({ viewport: { width: w.width, height: w.height } });

    test('quirófanos: agenda, salas, bloques, utilización, ficha y estados', async ({ page }) => {
      test.setTimeout(600_000);
      await login(page, 'quirofano@alovida.mock');

      await page.goto('/interventions', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('interventions-room').first()).toBeVisible({ timeout: 60_000 });
      log.push({ what: `lista ${w.name}`, data: { overflow: await overflow(page), rooms: await page.getByTestId('interventions-room').allTextContents() } });
      await shot(page, '01-intervenciones-lista', w.name);

      await page.goto('/interventions/operating-rooms', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('or-schedule-as-of')).toBeVisible({ timeout: 60_000 });
      log.push({ what: `agenda ${w.name}`, data: { overflow: await overflow(page), card: await measureCard(page, '[data-testid=or-schedule]') } });
      await shot(page, '02-agenda-quirofanos', w.name);

      await page.goto('/interventions/blocks', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('or-blocks-table').locator('tr, [role=row]').nth(1)).toBeVisible({ timeout: 60_000 });
      log.push({ what: `bloques ${w.name}`, data: { overflow: await overflow(page), card: await measureCard(page, '[data-testid=or-blocks]') } });
      await shot(page, '03-bloques-semana', w.name);
      await page.goto('/interventions/blocks?tab=new', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('block-form')).toBeVisible({ timeout: 60_000 });
      await shot(page, '04-bloques-alta', w.name);

      await page.goto('/interventions/utilization', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('or-utilization-rooms')).toBeVisible({ timeout: 60_000 });
      log.push({ what: `utilizacion ${w.name}`, data: { overflow: await overflow(page) } });
      await shot(page, '05-utilizacion', w.name);

      await page.goto('/interventions', { waitUntil: 'domcontentloaded' });
      await page.getByTestId('interventions-case-link').filter({ hasText: 'CX-2026-0104' }).click();
      await expect(page.getByTestId('case-detail')).toBeVisible({ timeout: 60_000 });
      log.push({ what: `ficha ${w.name}`, data: { overflow: await overflow(page), card: await measureCard(page, '[data-testid=case-detail]') } });
      await shot(page, '06-ficha-resumen', w.name);
      await page.getByRole('tab', { name: 'Check-list OMS' }).click();
      await shot(page, '07-ficha-checklist-vacio', w.name);
      await page.getByRole('tab', { name: 'Eventos de sala' }).click();
      await shot(page, '08-ficha-eventos-bloqueados', w.name);

      await page.goto('/interventions/new', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('schedule-case')).toBeVisible({ timeout: 60_000 });
      log.push({ what: `programar ${w.name}`, data: { overflow: await overflow(page), card: await measureCard(page, '[data-testid=schedule-case]') } });
      await shot(page, '09-programar', w.name);

      // S6: un caso que no existe (u otro tenant) no muestra ningún dato.
      await page.goto('/interventions/00000000-0000-4000-a000-000000000000', { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('No encontramos lo que busca')).toBeVisible({ timeout: 60_000 });
      await expect(page.getByTestId('case-detail')).toHaveCount(0);
      await shot(page, '10-estado-S6-caso', w.name);

      // S9 y S8 simulados en la utilización y la agenda.
      await fail(page, '/or-utilization', 'error');
      await page.goto('/interventions/utilization', { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Algo salió mal')).toBeVisible({ timeout: 60_000 });
      await shot(page, '11-estado-S9-utilizacion', w.name);
      await fail(page, '/operating-rooms', 'red');
      await page.goto('/interventions/operating-rooms', { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Sin conexión').first()).toBeVisible({ timeout: 60_000 });
      await shot(page, '12-estado-S8-agenda', w.name);
      await fail(page, null);

      // S3: una semana sin bloques ofrece crear uno.
      await page.goto('/interventions/blocks', { waitUntil: 'domcontentloaded' });
      for (let i = 0; i < 6; i++) await page.getByRole('button', { name: /Semana siguiente/ }).click();
      await expect(page.getByText('No hay bloques esta semana.')).toBeVisible({ timeout: 60_000 });
      await shot(page, '13-estado-S3-bloques', w.name);
    });

    test('F5: tarifas, día-cama, equipos y stock; S5 de facturación en bloques', async ({ page }) => {
      test.setTimeout(600_000);
      await login(page, 'facturacion@alovida.mock');
      await page.goto('/administration/services-catalog?tab=space-tariffs', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('space-tariffs-table')).toContainText('Día-cama', { timeout: 60_000 });
      log.push({ what: `tarifas ${w.name}`, data: { overflow: await overflow(page) } });
      await shot(page, '20-tarifas-espacios', w.name);
      await page.goto('/administration/services-catalog/bed-day-charges', { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('bed-day-stay')).toBeVisible({ timeout: 60_000 });
      await shot(page, '21-dia-cama-sin-estancia', w.name);
      await page.goto('/interventions/blocks', { waitUntil: 'domcontentloaded' });
      // S5 desde el 403 de la API (la web pide; no corta por rol).
      await expect(page.getByText('Su rol no consulta los bloques de quirófano.').first()).toBeVisible({ timeout: 60_000 });
      await shot(page, '22-estado-S5-bloques-facturacion', w.name);
    });

    test('F5: ficha de espacio (Equipos, Stock) y ficha de equipo', async ({ page }) => {
      test.setTimeout(600_000);
      await login(page, 'superadmin@alovida.mock');
      await page.goto(`/administration/medical-organization/spaces/${spaceId('IMG-TC')}?tab=equipment`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('space-equipment-list')).toContainText('SLTC64', { timeout: 60_000 });
      await shot(page, '30-espacio-equipos', w.name);
      await page.goto(`/administration/medical-organization/spaces/${spaceId('A-PN-P3-BOT')}?tab=stock`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('space-stock-list')).toContainText('Paracetamol', { timeout: 60_000 });
      await shot(page, '31-espacio-stock', w.name);
      await page.goto(`/administration/medical-organization/spaces/${spaceId('IMG-TC')}?tab=equipment`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId('space-equipment-list').getByRole('link').first().click();
      await expect(page.getByTestId('equipment-detail')).toBeVisible({ timeout: 60_000 });
      await page.getByRole('tab', { name: 'Ubicación y DICOM' }).click();
      await expect(page.getByTestId('equipment-mwl')).toBeVisible({ timeout: 60_000 });
      log.push({ what: `equipo ${w.name}`, data: { overflow: await overflow(page), card: await measureCard(page, '[data-testid=equipment-detail]') } });
      await shot(page, '32-equipo-ubicacion-dicom', w.name);
    });
  });
}

/* ---- cadenas UI → request → response → persistencia → recarga → UI (1440) --------------- */

test.describe('Cadenas de mutación a 1440', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('programar un caso con su ventana reservada, conflicto 409 y check-list + tiempos de sala', async ({ page }) => {
    test.setTimeout(600_000);
    await login(page, 'quirofano@alovida.mock');
    const day = await nextWeekday(page, 6, 8);

    const fillForm = async (time: string) => {
      await page.goto(`/interventions/new?day=${day}&time=${time}`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId('schedule-case')).toBeVisible({ timeout: 60_000 });
      await choose(page, 'schedule-room', /QX-02 · Quirófano 2/);
      await page.getByTestId('schedule-patient').locator('input').fill('a');
      const option = page.locator('[role="option"]').first();
      await expect(option).toBeVisible({ timeout: 20_000 });
      await option.click();
      await choose(page, 'schedule-surgeon', /./);
      await page.getByTestId('schedule-duration').fill('120');
      await expect(page.getByTestId('schedule-preview')).toBeVisible();
    };

    // 1. El primero: 08:00–10:00 → ventana 07:40–10:30.
    await fillForm('08:00');
    await expect(page.getByTestId('schedule-preview')).toContainText('07:40 a 10:30');
    await shot(page, '40-programar-ventana', '1440');
    await page.getByTestId('schedule-submit').click();
    await page.waitForURL(/\/interventions\/[0-9a-f-]{36}/, { timeout: 60_000 });
    const created = await record(page, 'programar caso (201)', 'POST', /^\/procedure-cases$/);
    expect(created.status).toBe(201);
    const caseUrl = page.url();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('case-detail')).toContainText('07:40–10:30', { timeout: 60_000 });
    log.push({ what: 'programar caso · recarga', data: { url: caseUrl, persisted: await page.evaluate(() => (sessionStorage.getItem('mock.procedures.casos') ?? '').includes('"QX-02"') || (sessionStorage.getItem('mock.procedures.casos') ?? '').length) } });
    await shot(page, '41-caso-programado-recarga', '1440');

    // 2. El segundo a las 10:30 choca con la limpieza del primero → 409 con la próxima ventana.
    await fillForm('10:30');
    await page.getByTestId('schedule-submit').click();
    await expect(page.getByTestId('schedule-next-free')).toBeVisible({ timeout: 60_000 });
    const conflict = await record(page, 'programar en la limpieza del anterior (409)', 'POST', /^\/procedure-cases$/);
    expect(conflict.status).toBe(409);
    await shot(page, '42-estado-S4-conflicto-ventana', '1440');
    await page.getByTestId('schedule-next-free').click();
    await expect(page.getByTestId('schedule-preview')).toContainText('10:30 a 13:20');

    // 3. Check-list OMS completo y tiempos de sala en orden, sobre el caso creado.
    await page.goto(`${caseUrl}?tab=checklist`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('checklist-create').click();
    await expect(page.getByTestId('checklist-items-SIGN_IN')).toBeVisible({ timeout: 60_000 });
    await record(page, 'crear check-list (201)', 'POST', /\/safety-checklists$/);
    const phase = async (code: string, label: RegExp) => {
      await page.goto(`${caseUrl}?tab=checklist`, { waitUntil: 'domcontentloaded' });
      await expect(page.getByTestId(`checklist-items-${code}`)).toBeVisible({ timeout: 60_000 });
      await page.getByTestId('checklist-confirm-all').click();
      await page.getByTestId('checklist-submit').click();
      await record(page, `fase ${code} (201)`, 'POST', /\/responses$/);
      await expect(page.getByRole('tab', { name: 'Check-list OMS' })).toBeVisible();
      void label;
    };
    const event = async (code: string) => {
      await page.goto(`${caseUrl}?tab=room`, { waitUntil: 'domcontentloaded' });
      await page.getByTestId(`room-event-${code}`).click();
      await record(page, `evento ${code} (201)`, 'POST', /\/room-events$/);
    };
    await phase('SIGN_IN', /Entrada/);
    await page.goto(`${caseUrl}?tab=room`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('room-event-INCISION')).toHaveAttribute('aria-disabled', 'true', { timeout: 60_000 });
    await event('PATIENT_IN_ROOM');
    await event('ANESTHESIA_START');
    await page.goto(`${caseUrl}?tab=room`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Exige completar la fase «Pausa quirúrgica» del check-list.')).toBeVisible({ timeout: 60_000 });
    await shot(page, '43-eventos-gate-pausa', '1440');
    await phase('TIME_OUT', /Pausa/);
    await event('INCISION');
    await event('CLOSURE');
    await phase('SIGN_OUT', /Salida/);
    await event('PATIENT_OUT_OF_ROOM');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('room-events-timeline').locator('li')).toHaveCount(5, { timeout: 60_000 });
    await shot(page, '44-eventos-completos-recarga', '1440');
    await page.goto(`${caseUrl}?tab=checklist`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('checklist-phase-done')).toBeVisible({ timeout: 60_000 });
    const summary = await page.evaluate(() => {
      const raw = sessionStorage.getItem('mock.periop.checklists');
      return raw === null ? null : (JSON.parse(raw).filas as { completedAt: Record<string, string | null> }[]).at(-1)?.completedAt;
    });
    log.push({ what: 'check-list · persistido tras recarga', data: summary });
    expect(summary?.['SIGN_OUT']).toBeTruthy();
    await shot(page, '45-checklist-completo-recarga', '1440');
  });

  test('ubicar un equipo en una sala y fijar su AE Title', async ({ page }) => {
    test.setTimeout(600_000);
    await login(page, 'superadmin@alovida.mock');
    const rx = spaceId('IMG-RX');
    await page.goto(`/administration/medical-organization/spaces/${rx}?tab=equipment`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('space-equipment-choice')).toBeVisible({ timeout: 60_000 });
    await choose(page, 'space-equipment-choice', /Ecógrafo/);
    await page.getByTestId('space-equipment-locate').click();
    const located = await record(page, 'ubicar ecógrafo en la sala de rayos X', 'PATCH', /^\/diagnostic-equipment\//);
    expect(located.status).toBe(200);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('space-equipment-list')).toContainText('Ecógrafo', { timeout: 60_000 });
    await shot(page, '50-equipo-ubicado-recarga', '1440');

    await page.getByTestId('space-equipment-list').getByRole('link', { name: 'Ecógrafo' }).click();
    await page.getByRole('tab', { name: 'Ubicación y DICOM' }).click();
    await page.getByTestId('equipment-ae-title').fill('ESTE-AE-TIENE-17C');
    await expect(page.getByText('El AE Title admite hasta 16 caracteres.')).toBeVisible();
    await shot(page, '51-estado-S4-ae-title', '1440');
    await page.getByTestId('equipment-ae-title').fill('SLUS01');
    await page.getByTestId('equipment-station').fill('ECO-PB');
    await page.getByTestId('equipment-save').click();
    await record(page, 'AE Title del ecógrafo', 'PATCH', /^\/diagnostic-equipment\//);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('equipment-mwl')).toContainText('SLUS01', { timeout: 60_000 });
    await expect(page.getByTestId('equipment-mwl')).toContainText('IMG-RX');
    await shot(page, '52-equipo-mwl-recarga', '1440');
  });

  test('generar el cargo de día-cama (regla de medianoche) y re-ejecutar sin duplicar', async ({ page }) => {
    test.setTimeout(600_000);
    await login(page, 'facturacion@alovida.mock');
    await page.goto('/administration/services-catalog/bed-day-charges', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('bed-day-stay')).toBeVisible({ timeout: 60_000 });
    await choose(page, 'bed-day-stay', /./);
    await expect(page.getByTestId('bed-day-run')).toBeVisible({ timeout: 60_000 });
    await shot(page, '60-dia-cama-sin-cargos', '1440');
    await page.getByTestId('bed-day-run').click();
    // `runBedDays` responde 200 con `{created: ChargeCapture[], skipped}`.
    const run = await record(page, 'devengar día-cama (200)', 'POST', /\/bed-day-charges\/run$/);
    expect(run.status).toBe(200);
    const created = ((run.response as { created: unknown[] }).created ?? []).length;
    expect(created).toBeGreaterThan(0);
    await expect(page.getByTestId('bed-day-result')).toContainText(`${created} cargos nuevos`, { timeout: 60_000 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('bed-day-table')).toContainText('BEDDAY:', { timeout: 60_000 });
    const keys = (await page.getByTestId('bed-day-table').textContent())?.match(/BEDDAY:[^\s]+/g) ?? [];
    log.push({ what: 'día-cama · recarga', data: { keys, persisted: await page.evaluate(() => (JSON.parse(sessionStorage.getItem('mock.billing.chargeCaptures') ?? '{"filas":[]}').filas as unknown[]).length) } });
    expect(keys).toHaveLength(created);
    await shot(page, '61-dia-cama-cargos-recarga', '1440');
    await page.getByTestId('bed-day-run').click();
    await expect(page.getByTestId('bed-day-result')).toContainText(`0 cargos nuevos; ${created} días ya estaban devengados`, { timeout: 60_000 });
    await record(page, 'devengar otra vez (idempotente)', 'POST', /\/bed-day-charges\/run$/);
    await shot(page, '62-dia-cama-idempotente', '1440');
  });
});
