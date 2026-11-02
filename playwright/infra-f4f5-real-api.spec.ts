import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page, type Response } from '@playwright/test';

/**
 * F4 contra la **API real** (no la maqueta): la cadena
 * UI → petición → respuesta → SELECT en Postgres → recarga → UI.
 *
 * Datos semilla creados **sólo por la API** (organización, sede, quirófano,
 * recurso R0, paciente, profesional con relación asistencial aceptada por el
 * paciente), con nombres propios de F4/F5. El JSON de la semilla llega por
 * `INFRA_REAL_SEED`.
 *
 * Uso (build `development,real-api` servido estático con proxy a :3000):
 *   INFRA_REAL_SEED=…/seed.json E2E_BASE_URL=http://127.0.0.1:4374 PW_CHROMIUM_PATH=… \
 *     yarn playwright test playwright/infra-f4f5-real-api.spec.ts --workers=1
 */

const OUT = join(process.cwd(), 'docs', 'refactor-profesional', 'trabajo', 'evidencias', 'infra-f4f5', 'real-api');
const SEED = JSON.parse(readFileSync(process.env['INFRA_REAL_SEED'] ?? '/dev/null', 'utf8') || '{}') as {
  tag: string;
  password: string;
  tenantId: string;
  siteId: string;
  orId: string;
  patientProfileId: string;
  nurse: { email: string; practitionerProfileId: string };
  supervisor: { email: string };
};

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
test.use({ viewport: { width: 1440, height: 900 } });

test.beforeAll(() => mkdirSync(OUT, { recursive: true }));
test.afterAll(() => writeFileSync(join(OUT, 'resultados.json'), JSON.stringify({ date: new Date().toISOString(), seed: { tag: SEED.tag, tenantId: SEED.tenantId }, log, consoleErrors }, null, 2)));

/** Un SELECT de sólo lectura en la base de la API (evidencia de persistencia). */
function select(sql: string): string[][] {
  const out = execFileSync('docker', ['exec', 'mantra-redesa-postgres-1', 'psql', '-U', 'mantra', '-d', 'alovida', '-At', '-F', '|', '-c', sql], { encoding: 'utf8' });
  return out.trim() === '' ? [] : out.trim().split('\n').map((l) => l.split('|'));
}

async function shot(page: Page, name: string): Promise<void> {
  await page.mouse.move(1432, 450);
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
}

/** Espera la respuesta de la API y la anota con su cuerpo de petición. */
async function capture(page: Page, what: string, method: string, path: RegExp, act: () => Promise<unknown>): Promise<{ status: number; body: unknown; request: unknown }> {
  const waiting = page.waitForResponse((r: Response) => r.request().method() === method && path.test(new URL(r.url()).pathname), { timeout: 60_000 });
  await act();
  const r = await waiting;
  const body: unknown = await r.json().catch(() => null);
  const request = r.request().postDataJSON?.() ?? null;
  const entry = { status: r.status(), body, request, path: new URL(r.url()).pathname, ifMatch: r.request().headers()['if-match'] ?? null };
  log.push({ what, data: entry });
  return entry;
}

async function login(page: Page, email: string = SEED.nurse.email): Promise<void> {
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(`${page.url()} :: ${m.text()}`);
  });
  await page.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await page.getByTestId('login-identifier').fill(email);
  await page.getByTestId('login-password').fill(SEED.password);
  await page.getByTestId('login-submit').click();
  await page.waitForURL((u) => !/\/auth\/?$/.test(u.pathname), { timeout: 60_000 });
  for (let i = 0; i < 4; i++) {
    const tenant = page.getByTestId('tenant-opcion').filter({ hasText: `Hospital ${SEED.tag}` }).first();
    await Promise.race([page.waitForURL(/\/dashboard/, { timeout: 20_000 }).catch(() => undefined), tenant.waitFor({ timeout: 20_000 }).catch(() => undefined)]);
    if (await tenant.isVisible().catch(() => false)) {
      await tenant.click();
      await page.waitForTimeout(1500);
      continue;
    }
    break;
  }
}

async function choose(page: Page, testId: string, option: RegExp): Promise<void> {
  await page.getByTestId(testId).locator('.select-trigger').click();
  await page.locator('dialog.select-dialog[open]').getByRole('option', { name: option }).first().click();
  await expect(page.locator('dialog.select-dialog[open]')).toHaveCount(0);
}

test('F4 contra la API real: programar, check-list OMS, tiempos de sala y recambio', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);

  /* 1 · programar (si la sala ya está reservada, el 409 de la API queda como evidencia y se prueba otra hora) */
  // Un día libre por corrida: tantos días después como casos ya tiene la sala.
  const previous = Number(select(`select count(*) from procedures_perioperative.procedure_cases where operating_room_id = '${SEED.orId}'`)[0]?.[0] ?? 0);
  const day = new Date(Date.now() + (9 + previous) * 86_400_000);
  const dayIso = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  let created: { status: number; body: unknown } | null = null;
  for (const time of ['10:00', '12:30', '15:00', '17:30', '07:00']) {
    await page.goto(`/interventions/new?day=${dayIso}&time=${time}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('schedule-case')).toBeVisible({ timeout: 60_000 });
    await choose(page, 'schedule-room', /QX-F4W/);
    await page.getByTestId('schedule-patient').locator('input').fill(`Paciente F4W`);
    const option = page.locator('[role="option"]').filter({ hasText: 'F4W' }).first();
    await expect(option).toBeVisible({ timeout: 30_000 });
    await option.click();
    await choose(page, 'schedule-surgeon', /Enfermera/);
    await page.getByTestId('schedule-duration').fill('90');
    await expect(page.getByTestId('schedule-preview')).toBeVisible();
    await shot(page, '01-programar');
    const r = await capture(page, `programar caso ${time}`, 'POST', /^\/procedure-cases$/, () => page.getByTestId('schedule-submit').click());
    if (r.status === 409) {
      await expect(page.getByTestId('schedule-failure')).toBeVisible({ timeout: 30_000 });
      await shot(page, '01b-estado-S4-sala-reservada');
      continue;
    }
    created = r;
    break;
  }
  expect(created?.status).toBe(201);
  const caseId = (created!.body as { id: string }).id;
  await page.waitForURL(new RegExp(`/interventions/${caseId}`), { timeout: 60_000 });
  const row = select(`select operating_room_id, reserved_start_at, reserved_end_at, prep_minutes, cleanup_minutes from procedures_perioperative.procedure_cases where id = '${caseId}'`);
  log.push({ what: 'SELECT procedure_cases', data: row });
  expect(row[0]?.[0]).toBe(SEED.orId);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('case-detail')).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('app-page-header')).toContainText('QX-F4W');
  await shot(page, '02-ficha-tras-recarga');

  /* 2 · check-list OMS: iniciar y completar las tres fases */
  await page.goto(`/interventions/${caseId}?tab=checklist`, { waitUntil: 'domcontentloaded' });
  const start = page.getByTestId('checklist-create');
  await expect(start.or(page.getByTestId('checklist-submit'))).toBeVisible({ timeout: 60_000 });
  if (await start.isVisible()) {
    const k = await capture(page, 'crear check-list', 'POST', /\/safety-checklists$/, () => start.click());
    expect([200, 201]).toContain(k.status);
  }
  for (const phase of ['SIGN_IN', 'TIME_OUT', 'SIGN_OUT']) {
    await page.getByTestId('checklist-confirm-all').click();
    const r = await capture(page, `fase ${phase}`, 'POST', /\/responses$/, () => page.getByTestId('checklist-submit').click());
    expect(r.status).toBe(201);
    await expect(page.getByTestId('checklist-submit').or(page.getByTestId('checklist-phase-done'))).toBeVisible({ timeout: 60_000 });
  }
  const phases = select(`select sign_in_completed_at is not null, time_out_completed_at is not null, sign_out_completed_at is not null from procedures_perioperative.surgical_safety_checklists where procedure_case_id = '${caseId}'`);
  log.push({ what: 'SELECT surgical_safety_checklists', data: phases });
  expect(phases[0]).toEqual(['t', 't', 't']);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('checklist-phase-done')).toBeVisible({ timeout: 60_000 });
  await shot(page, '03-checklist-tras-recarga');

  /* 3 · tiempos de sala en orden */
  await page.goto(`/interventions/${caseId}?tab=room`, { waitUntil: 'domcontentloaded' });
  for (const code of ['PATIENT_IN_ROOM', 'ANESTHESIA_START', 'INCISION', 'CLOSURE', 'PATIENT_OUT_OF_ROOM']) {
    const button = page.getByTestId(`room-event-${code}`);
    await expect(button).not.toHaveAttribute('aria-disabled', 'true', { timeout: 60_000 });
    const r = await capture(page, `evento ${code}`, 'POST', /\/room-events$/, () => button.click());
    expect(r.status).toBe(201);
    await page.waitForTimeout(1200);
  }
  // Los cinco tiempos, más el `OR_RESERVED` que la API deja al programar.
  const events = select(`select e.event_type_concept_id, coalesce(c.code, '?'), e.occurred_at from procedures_perioperative.operating_room_utilization_events e left join terminology.catalog_concepts c on c.id = e.event_type_concept_id where e.procedure_case_id = '${caseId}' order by e.occurred_at`);
  log.push({ what: 'SELECT operating_room_utilization_events', data: events });
  expect(events.map((e) => e[1]).filter((c) => c?.includes('OR_EVENT_'))).toEqual(
    ['PATIENT_IN_ROOM', 'ANESTHESIA_START', 'INCISION', 'CLOSURE', 'PATIENT_OUT_OF_ROOM'].map((c) => `procedures_perioperative:OR_EVENT_${c}`),
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('room-events-timeline')).toBeVisible({ timeout: 60_000 });
  await shot(page, '04-tiempos-tras-recarga');

  /*
   * La sala tiene **una** orden de recambio abierta a la vez: si quedó una de un
   * caso anterior, la salida de sala devuelve ésa (`cleaningOrderId`) y el detalle
   * de este caso trae `turnoverCleaning: null`. Se opera en la ficha del caso
   * dueño de la orden (hallazgo anotado para A-F4).
   */
  const out = log.find((e) => e.what === 'evento PATIENT_OUT_OF_ROOM')?.data as { body: { cleaningOrderId: string | null } };
  const orderId = out.body.cleaningOrderId!;
  const owner = select(`select source_ref_id from practice.cleaning_orders where id = '${orderId}'`)[0]?.[0] ?? caseId;
  log.push({ what: 'orden de recambio de la sala', data: { orderId, ownerCaseId: owner, sameCase: owner === caseId } });
  if (owner !== caseId) await page.goto(`/interventions/${owner}?tab=room`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('room-events-turnover')).toBeVisible({ timeout: 60_000 });
  await shot(page, '05-recambio-pendiente');

  /* 4 · recambio: iniciar y terminar (enfermería), sala lista (otra persona: la API separa funciones) */
  for (const step of ['start', 'finish']) {
    const next = page.getByTestId('room-events-turnover-next');
    await expect(next).toBeVisible({ timeout: 60_000 });
    const r = await capture(page, `recambio ${step}`, 'POST', new RegExp(`/cleaning-orders/[^/]+/${step}$`), () => next.click());
    expect(r.status).toBe(200);
    await page.waitForTimeout(1500);
  }
  // Quien terminó no inspecciona: 422 INSPECTION_BY_CLEANER_NOT_ALLOWED, a la vista.
  const own = await capture(page, 'recambio inspect por quien limpió (422)', 'POST', /\/cleaning-orders\/[^/]+\/inspect$/, () => page.getByTestId('room-events-turnover-next').click());
  expect(own.status).toBe(422);
  await expect(page.getByTestId('room-events-failure')).toBeVisible({ timeout: 30_000 });
  await shot(page, '06-estado-S4-inspeccion-propia');
  // Otra cuenta (supervisión de limpieza) inspecciona.
  await page.evaluate(() => localStorage.clear());
  await login(page, SEED.supervisor.email);
  await page.goto(`/interventions/${owner}?tab=room`, { waitUntil: 'domcontentloaded' });
  const inspect = page.getByTestId('room-events-turnover-next');
  await expect(inspect).toBeVisible({ timeout: 60_000 });
  const ok = await capture(page, 'recambio inspect (supervisión)', 'POST', /\/cleaning-orders\/[^/]+\/inspect$/, () => inspect.click());
  expect(ok.status).toBe(200);
  await page.waitForTimeout(1500);
  const order = select(`select o.row_version, c.code from practice.cleaning_orders o join terminology.catalog_concepts c on c.id = o.status_concept_id where o.id = '${orderId}'`);
  log.push({ what: 'SELECT cleaning_orders', data: order });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('room-events-turnover-status')).toContainText('Lista para el próximo caso', { timeout: 60_000 });
  expect(order[0]?.[1]).toBe('practice:CLN_INSPECTED');
  await shot(page, '07-recambio-completo-tras-recarga');
});

test('día-cama contra la API real: la lectura de internados de la sede', async ({ page }) => {
  test.setTimeout(300_000);
  await login(page);
  await page.goto('/administration/services-catalog/bed-day-charges', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('bed-day')).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(3000);
  log.push({ what: 'día-cama: texto de la pantalla', data: (await page.getByTestId('bed-day').innerText()).slice(0, 600) });
  await shot(page, '08-dia-cama');
});
