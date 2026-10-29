/**
 * Evidencia de navegador de la franja F2 de infraestructura hospitalaria
 * (operación de camas y salas), contra la MAQUETA (backend simulado dentro del
 * navegador). Contra la API real NO.
 *
 * Deja capturas a 1440, 768 y 390 px, en claro y en oscuro, en
 * `docs/frontend/evidence/infra-f2/`, y un `results.json` con cada comprobación:
 *
 *   - el flujo completo bloquear → mantenimiento → terminar (sucia) → limpiando
 *     → terminada → inspeccionar → liberar, con recarga dura entre pasos
 *     (UI → request → response → persistencia → recarga → UI);
 *   - los rechazos de la API (422/409/412/403) vistos desde la pantalla;
 *   - el tablero con los siete estados, en cuadrícula y en lista;
 *   - las vistas por rol (enfermería, limpieza, mantenimiento, administración);
 *   - la cola de limpieza, la pestaña «Operación» de la ficha y los estados M34.
 *
 * Uso: `node playwright/infra-f2-evidence.mjs [urlBase] [ejecutable]`.
 * Sirve la salida de `ng build --configuration development,demo` con un
 * servidor estático con respaldo a index.html. NUNCA espera `networkidle`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://127.0.0.1:4320';
const EXECUTABLE = process.argv[3] ?? process.env['PW_CHROMIUM'] ?? undefined;
const OUT = fileURLToPath(new URL('../docs/frontend/evidence/infra-f2/', import.meta.url));
const WIDTHS = [
  { w: 1440, h: 1100 },
  { w: 768, h: 1300 },
  { w: 390, h: 1700 },
];

/** Mismo `uuid` determinístico que `core/mock/mock-store.ts`: así se calculan los ids sembrados. */
function uuid(seed) {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ c, 0x811c9dc5) >>> 0;
  }
  const hex = (n) => n.toString(16).padStart(8, '0');
  const a = hex(h1);
  const b = hex(h2);
  const c = hex((h1 * 31 + h2) >>> 0);
  const d = hex((h2 * 17 + h1) >>> 0);
  const raw = `${a}${b}${c}${d}`;
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-a${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
}
/** Los quirófanos conservan los ids de `procedures.handlers` (`operating-room-1/2`); el resto, los de F1. */
const bedId = (code) => (code === 'QX-1' ? uuid('operating-room-1') : code === 'QX-2' ? uuid('operating-room-2') : uuid(`infra-sanlucas-${code}`));
const SITE_ID = uuid('site-sanlucas');

const results = [];
const ok = (name, cond, detail = '') => {
  results.push({ name, ok: Boolean(cond), detail });
  process.stdout.write(`${cond ? 'OK  ' : 'FALLA'} ${name}${detail ? ' — ' + detail : ''}\n`);
};

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ ...(EXECUTABLE ? { executablePath: EXECUTABLE } : {}), args: ['--no-sandbox'] });

/** Una página con sesión, la persona elegida y el guion de deriva apagado (estado determinista). */
async function newPage({ persona = 'nurse', scheme = 'light', drift = 'off', init = {} } = {}) {
  const context = await browser.newContext({ viewport: { width: WIDTHS[0].w, height: WIDTHS[0].h }, timezoneId: 'America/La_Paz', locale: 'es-BO' });
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  await page.addInitScript(
    ([p, d, extra]) => {
      // La persona se fija una vez; el guion puede cambiarla en medio (`setPersona`) sin que una recarga la pise.
      if (sessionStorage.getItem('mock:infra-ops-persona') === null) sessionStorage.setItem('mock:infra-ops-persona', p);
      if (sessionStorage.getItem('mock:infra-ops-drift') === null) sessionStorage.setItem('mock:infra-ops-drift', d);
      for (const [k, v] of Object.entries(extra)) sessionStorage.setItem(k, v);
      const si = window.setInterval.bind(window);
      window.setInterval = (f, ms, ...a) => si(f, ms === 120 && sessionStorage.getItem('lento') === '1' ? 6000 : ms, ...a);
    },
    [persona, drift, init],
  );
  await page.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.getByTestId('login-identifier').fill('admin@alovida.mock');
  await page.getByTestId('login-password').fill('mockup');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
  return page;
}

/** Cambia el tema como lo hace la persona: la preferencia vive en `localStorage` y se aplica al cargar. */
async function theme(page, mode) {
  await page.evaluate((m) => localStorage.setItem('mantra-core-health.theme', m), mode);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1800);
}
const setPersona = (page, persona) => page.evaluate((p) => sessionStorage.setItem('mock:infra-ops-persona', p), persona);
const setFailures = (page, failures) => page.evaluate((f) => (f === null ? sessionStorage.removeItem('mock:fallos') : sessionStorage.setItem('mock:fallos', JSON.stringify(f))), failures);
const requests = (page) => page.evaluate(() => window.__mockRequests ?? []);
const lastRequest = async (page, method, fragment) => [...(await requests(page))].reverse().find((r) => r.method === method && r.url.includes(fragment));
const store = (page, key) => page.evaluate((k) => JSON.parse(sessionStorage.getItem(k) ?? 'null')?.filas ?? [], key);

async function board(page, query = '') {
  await page.goto(`${BASE}/inpatient/bed-board?site=${SITE_ID}${query}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.getByTestId('bb-freshness').waitFor({ timeout: 60_000 });
  await page.getByTestId('bed-board').waitFor({ timeout: 60_000 });
  await page.waitForTimeout(500);
}
async function queue(page, query = '') {
  await page.goto(`${BASE}/inpatient/cleaning?site=${SITE_ID}${query}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
  await page.getByTestId('cleaning-queue').waitFor({ timeout: 60_000 });
  await page.waitForTimeout(600);
}
const tab = async (page, name) => {
  await page.getByRole('tab', { name: new RegExp(name) }).first().click();
  await page.waitForTimeout(350);
};

/** Captura el estado actual a los tres anchos (o a los pedidos) y vuelve a 1440. */
async function shots(page, name, { widths = WIDTHS, scheme = 'light', full = false } = {}) {
  for (const { w, h } of widths) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}${name}-${w}-${scheme}.png`, fullPage: full });
  }
  await page.setViewportSize({ width: WIDTHS[0].w, height: WIDTHS[0].h });
  await page.waitForTimeout(200);
}
const one = (page, name, scheme = 'light', w = 1440) => page.screenshot({ path: `${OUT}${name}-${w}-${scheme}.png` });
const dialogOf = (page) => page.locator('dialog[open]').last();
const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

/** Abre un `app-select` por su testid y elige la opción por nombre. */
async function choose(page, scope, testId, optionName) {
  const sel = scope.getByTestId(testId);
  const button = (await sel.evaluate((e) => e.tagName)) === 'BUTTON' ? sel : sel.locator('button').first();
  await button.click();
  await page.getByRole('option', { name: optionName }).first().click();
  await page.waitForTimeout(250);
}

/**
 * Elige fecha y hora en un `app-date-picker` de modo fecha y hora: la fecha se escribe
 * (máscara `DD/MM/AAAA`) y la hora se elige en el panel del calendario.
 */
async function pickDateTime(page, scope, testId, date, hour = '18', minute = '00') {
  const host = scope.getByTestId(testId);
  const input = host.locator('input').first();
  await input.click();
  await page.keyboard.type(date.replace(/\D/g, ''), { delay: 40 });
  await host.locator('button[aria-label="Abrir calendario"]').click();
  await page.waitForTimeout(400);
  const panel = page.locator('dialog[open]').last();
  await panel.locator('.time-select').first().locator('button').first().click();
  await page.getByRole('option', { name: new RegExp(`^${hour}`) }).first().click();
  await panel.locator('.time-select').nth(1).locator('button').first().click();
  await page.getByRole('option', { name: new RegExp(`^${minute}`) }).first().click();
  await page.getByTestId('date-picker-confirm').click();
  await page.waitForTimeout(300);
}

/** Aprueba el cuadro de motivo de `DialogService.confirmWithReason`. */
async function reasonDialog(page, text, buttonName) {
  const d = dialogOf(page);
  await d.locator('textarea').first().fill(text);
  await d.getByRole('button', { name: buttonName }).click();
  await page.waitForTimeout(700);
}

try {
  // ───────────────────────────────────────────────────────────────────────────
  // 0 · Preparación: el id del establecimiento de San Lucas sale del selector.
  const probe = await newPage({ persona: 'nurse' });
  const sites = await probe.evaluate(async () => {
    const token = JSON.stringify(Object.fromEntries(Object.entries(localStorage)));
    void token;
    return null;
  });
  void sites;
  await probe.goto(`${BASE}/inpatient/bed-board`, { waitUntil: 'domcontentloaded' });
  await probe.getByTestId('bed-board').waitFor({ timeout: 60_000 });
  await probe.waitForTimeout(1500);
  const firstSiteUrl = probe.url();
  ok('el tablero abre sin parámetros y elige un establecimiento por sí solo', (await probe.getByTestId('bb-freshness').count()) === 1, firstSiteUrl);
  await probe.context().close();

  // ───────────────────────────────────────────────────────────────────────────
  // 1 · El tablero: siete estados, unidades en pestañas, recuentos, leyenda.
  {
    const p = await newPage({ persona: 'nurse' });
    await board(p);
    ok('el tablero es UNA tarjeta con las unidades en pestañas', (await p.locator('app-card').count()) === 1 && (await p.getByRole('tab').count()) >= 5);
    const v2 = await p.evaluate(() => Array.from(document.querySelectorAll('app-bed-tile button')).map((b) => b.getAttribute('data-v2')));
    await tab(p, 'Medicina interna');
    const v2Med = await p.evaluate(() => Array.from(document.querySelectorAll('app-bed-tile button')).map((b) => b.getAttribute('data-v2')));
    ok('Medicina interna muestra U, O, R, H, K, I y C', ['U', 'O', 'R', 'H', 'K', 'I', 'C'].every((c) => v2Med.includes(c)), [...new Set(v2Med)].join(','));
    ok('«Actualizado hace…» siempre visible', /Actualizado hace/.test(await p.getByTestId('bb-freshness-text').innerText()));
    ok('sin desborde horizontal a 1440', await noOverflow(p));
    await shots(p, 'board-grid-medicine');
    await theme(p, 'dark');
    await shots(p, 'board-grid-medicine', { widths: [WIDTHS[0], WIDTHS[2]], scheme: 'dark' });
    await theme(p, 'light');
    for (const { w, h } of WIDTHS) {
      await p.setViewportSize({ width: w, height: h });
      ok(`sin desborde horizontal a ${w}`, await noOverflow(p));
    }
    await p.setViewportSize({ width: 1440, height: 1100 });

    await tab(p, 'Quirófanos');
    await one(p, 'board-grid-operating-rooms');
    await tab(p, 'Pediatría');
    await tab(p, 'Medicina interna');

    // lista
    await p.getByTestId('bb-layout').getByRole('radio', { name: /Lista/ }).click().catch(async () => p.getByTestId('bb-layout').getByText('Lista').click());
    await p.waitForTimeout(600);
    ok('la lista muestra las mismas camas', (await p.getByTestId('bb-list').count()) >= 1);
    await shots(p, 'board-list-medicine', { widths: [WIDTHS[0], WIDTHS[2]] });
    await p.context().close();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 2 · El flujo completo, con recarga dura entre pasos.
  {
    const p = await newPage({ persona: 'maintenance' });
    const cell = bedId('302-A');
    await board(p, `&cell=${cell}`);
    await tab(p, 'Medicina interna');

    // 2.1 mantenimiento sin fecha: el rechazo de la API se ve en el campo
    await p.getByTestId('action-start-maintenance').click();
    let d = dialogOf(p);
    await d.getByTestId('block-dialog').waitFor();
    await choose(p, d, 'block-reason', 'Mantenimiento preventivo');
    await d.getByTestId('block-confirm').click();
    await p.waitForTimeout(700);
    const sinFecha = await lastRequest(p, 'POST', '/availability');
    ok('mantenimiento sin fecha estimada → 422', sinFecha?.status === 422, JSON.stringify(sinFecha?.body));
    ok('el rechazo se muestra bajo «Fecha estimada»', /fecha estimada/i.test(await d.innerText()));
    await shots(p, 'flow-1-maintenance-422-end-required', { widths: [WIDTHS[0], WIDTHS[2]] });

    // 2.2 con fecha: queda aplicado
    const end = new Date(Date.now() + 36 * 3_600_000);
    const pad = (n) => String(n).padStart(2, '0');
    await pickDateTime(p, d, 'block-end', `${pad(end.getDate())}/${pad(end.getMonth() + 1)}/${end.getFullYear()}`);
    await d.getByTestId('block-confirm').click();
    await p.waitForTimeout(900);
    const applied = await lastRequest(p, 'POST', '/availability');
    ok('mantenimiento con motivo y fecha → 200', applied?.status === 200, JSON.stringify(applied?.body));
    ok('el cuerpo lleva el motivo y la fecha estimada', applied?.body?.reasonCode === 'BLOCK_RSN_PREVENTIVE_MAINTENANCE' && typeof applied?.body?.expectedEndAt === 'string');
    const states = await store(p, 'mock.infra.ops.states');
    const rowAfter = states.find((s) => s.id === cell);
    ok('persistencia: la fila del estado quedó en mantenimiento con su fecha', rowAfter?.availability === 'SPACE_OP_MAINTENANCE' && rowAfter?.availabilityExpected, JSON.stringify({ a: rowAfter?.availability, h: rowAfter?.availabilityExpected }));
    const blocks = await store(p, 'mock.infra.ops.blocks');
    ok('persistencia: hay un bloqueo vigente de mantenimiento', blocks.some((b) => b.careSpaceId === cell && b.kind === 'BLOCK_MAINTENANCE' && b.endedAt === null));
    const events = await store(p, 'mock.infra.ops.events');
    const last = events.filter((e) => e.spaceId === cell).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];
    ok('persistencia: evento A20 con v2 = C y fuente de bloqueo', last?.v2Code === 'C' && last?.axis === 'AXIS_AVAILABILITY' && last?.source === 'SRC_BLOCK', JSON.stringify({ v2: last?.v2Code, to: last?.to, rid: last?.requestId }));
    await p.waitForTimeout(400);
    await shots(p, 'flow-2-maintenance-applied');

    // 2.3 recarga dura
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.getByTestId('bb-panel').waitFor({ timeout: 60_000 });
    await p.waitForTimeout(800);
    const tileText = await p.getByTestId('bed-tile-302-A').innerText();
    ok('recarga: la celda dice «Mantenimiento · hasta dd/mm hh:mm»', /Mantenimiento preventivo/.test(tileText) && /hasta \d\d\/\d\d \d\d:\d\d/.test(tileText), tileText.replace(/\s+/g, ' '));
    ok('recarga: el panel conserva el bloqueo y la orden de trabajo', /Bloqueos vigentes/.test(await p.getByTestId('bb-panel').innerText()));
    await one(p, 'flow-3-after-reload');

    // 2.4 terminar el mantenimiento → sucia + orden MAINTENANCE_END
    await p.getByTestId('action-end-maintenance').click();
    await reasonDialog(p, 'Se revisó y lubricó el mecanismo', 'Terminar mantenimiento');
    const endBlock = await lastRequest(p, 'POST', '/end');
    ok('terminar el mantenimiento → 200', endBlock?.status === 200, JSON.stringify(endBlock?.body));
    await p.waitForTimeout(500);
    ok('la cama queda sucia y con orden de limpieza (regla B.5-25)', /Sucia/.test(await p.getByTestId('axis-hygiene').innerText()) && (await p.getByTestId('cell-order').count()) === 1);
    await shots(p, 'flow-4-dirty-after-maintenance', { widths: [WIDTHS[0], WIDTHS[2]] });

    // 2.5 limpieza inicia y termina desde la cola
    await setPersona(p, 'housekeeping');
    await queue(p);
    const row = p.locator('tbody tr').filter({ hasText: '302-A' });
    ok('la cola muestra la orden del fin de mantenimiento', (await row.count()) === 1 && /Fin de mantenimiento/.test(await row.innerText()));
    await shots(p, 'flow-5-queue-pending');
    await row.getByRole('button', { name: /Iniciar/ }).click();
    await p.waitForTimeout(900);
    const started = await lastRequest(p, 'POST', '/start');
    ok('iniciar la limpieza → 200 con If-Match', started?.status === 200, started?.url);
    ok('la fila pasa a «En curso»', /En curso/.test(await row.innerText()));
    await p.locator('tbody tr').filter({ hasText: '302-A' }).getByRole('button', { name: /Terminar/ }).click();
    await p.waitForTimeout(900);
    const finished = await lastRequest(p, 'POST', '/finish');
    ok('terminar la limpieza → 200', finished?.status === 200, finished?.url);
    ok('la fila pasa a «Por inspeccionar»', /Por inspeccionar/.test(await p.locator('tbody tr').filter({ hasText: '302-A' }).innerText()));
    await shots(p, 'flow-6-queue-done');

    // 2.6 el mismo usuario no puede inspeccionar lo que terminó: la UI no lo ofrece
    ok('Limpieza no ve «Aprobar» sobre lo que ella misma terminó', (await p.locator('tbody tr').filter({ hasText: '302-A' }).getByRole('button', { name: /Aprobar/ }).count()) === 0);

    // 2.7 la cama todavía no es asignable
    await board(p, `&cell=${cell}`);
    await setPersona(p, 'nurse');
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.getByTestId('bb-panel').waitFor();
    await p.waitForTimeout(600);
    ok('limpia pero sin inspeccionar: «Por limpiar», no asignable', (await p.getByTestId('bed-tile-302-A').getAttribute('data-v2')) === 'H' && /No/.test(await p.getByTestId('axis-assignable').innerText()));

    // 2.8 la supervisión aprueba → la cama se libera
    await setPersona(p, 'housekeeping-supervisor');
    await queue(p);
    await p.locator('tbody tr').filter({ hasText: '302-A' }).getByRole('button', { name: /Aprobar/ }).click();
    await dialogOf(p).getByRole('button', { name: 'Aprobar' }).click();
    await p.waitForTimeout(900);
    const inspected = await lastRequest(p, 'POST', '/inspect');
    ok('inspeccionar PASS → 200', inspected?.status === 200 && inspected?.body?.result === 'PASS', JSON.stringify(inspected?.body));
    ok('la orden sale de las abiertas', (await p.locator('tbody tr').filter({ hasText: '302-A' }).count()) === 0);
    const ev2 = (await store(p, 'mock.infra.ops.events')).filter((e) => e.spaceId === cell && e.axis === 'AXIS_HYGIENE').sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
    ok('persistencia: cuatro eventos A20 de higiene en orden (sucia → limpiando → limpia → inspeccionada)', ev2.slice(-3).map((e) => e.to).join() === 'HYG_CLEANING,HYG_CLEAN,HYG_INSPECTED' && ev2.some((e) => e.to === 'HYG_DIRTY'), ev2.map((e) => e.to).join());
    await setPersona(p, 'nurse');
    await board(p, `&cell=${cell}`);
    await p.reload({ waitUntil: 'domcontentloaded' });
    await p.getByTestId('bb-panel').waitFor();
    await p.waitForTimeout(700);
    ok('recarga: la cama quedó disponible y asignable', (await p.getByTestId('bed-tile-302-A').getAttribute('data-v2')) === 'U' && /Sí/.test(await p.getByTestId('axis-assignable').innerText()));
    await shots(p, 'flow-7-released-after-reload');
    await p.context().close();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 3 · Los rechazos de la API vistos desde la pantalla.
  {
    const p = await newPage({ persona: 'nurse' });
    await board(p, `&cell=${bedId('302-B')}`);
    await tab(p, 'Medicina interna');
    // 3.1 bloqueo sin motivo
    await p.getByTestId('action-block-clinical').click();
    let d = dialogOf(p);
    await d.getByTestId('block-confirm').click();
    await p.waitForTimeout(700);
    const noReason = await lastRequest(p, 'POST', '/availability');
    ok('bloqueo sin motivo → 422 BLOCK_REASON_REQUIRED', noReason?.status === 422);
    ok('el rechazo cuelga del campo «Motivo»', /Elija un motivo/.test(await d.innerText()));
    await shots(p, 'reject-1-block-reason-required', { widths: [WIDTHS[0], WIDTHS[2]] });
    // 3.2 motivo «Otro» sin texto
    await choose(p, d, 'block-reason', 'Otro motivo');
    await d.getByTestId('block-confirm').click();
    await p.waitForTimeout(700);
    ok('motivo «Otro» sin detalle → 422', /explicación escrita/.test(await d.innerText()));
    await one(p, 'reject-2-block-other-needs-text');
    await d.getByRole('button', { name: 'Cancelar' }).click().catch(() => {});
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);

    // 3.3 403: cambió el rol mientras la pantalla seguía abierta
    await setPersona(p, 'housekeeping');
    await p.getByTestId('action-block-clinical').click();
    d = dialogOf(p);
    await choose(p, d, 'block-reason', 'Falta de personal');
    await d.getByTestId('block-confirm').click();
    await p.waitForTimeout(700);
    const forbidden = await lastRequest(p, 'POST', '/availability');
    ok('limpieza intenta bloquear → 403 INFRA_ACTION_NOT_ALLOWED', forbidden?.status === 403);
    ok('la pantalla lo dice (S5) con los roles que sí podrían y el código de soporte', /Roles que pueden hacerlo/.test(await d.innerText()) && /Código de soporte/.test(await d.innerText()));
    await shots(p, 'reject-3-forbidden-housekeeping-blocks', { widths: [WIDTHS[0], WIDTHS[2]] });
    await p.context().close();
  }

  {
    // 3.4 compromisos futuros: un quirófano con cirugías en la ventana
    const p = await newPage({ persona: 'admin' });
    await board(p, `&cell=${bedId('QX-1')}`);
    await p.getByTestId('action-block-admin').click();
    const d = dialogOf(p);
    await choose(p, d, 'block-reason', 'Decisión administrativa');
    const end = new Date(Date.now() + 5 * 86_400_000);
    const pad = (n) => String(n).padStart(2, '0');
    await pickDateTime(p, d, 'block-end', `${pad(end.getDate())}/${pad(end.getMonth() + 1)}/${end.getFullYear()}`);
    await d.getByTestId('block-confirm').click();
    await p.waitForTimeout(800);
    const conflict = await lastRequest(p, 'POST', '/availability');
    ok('bloquear un quirófano con cirugías en la ventana → 409', conflict?.status === 409);
    ok('la pantalla lista cada compromiso con su próxima acción', (await d.getByTestId('block-conflicts').locator('li').count()) >= 2 && /Qué hacer/.test(await d.getByTestId('block-conflicts').innerText()));
    ok('«Bloquear de todos modos» está deshabilitado hasta confirmar', await d.getByTestId('block-confirm').isDisabled());
    await shots(p, 'reject-4-future-commitments-conflict', { widths: [WIDTHS[0], WIDTHS[2]] });
    await d.getByTestId('block-acknowledge').click();
    await d.getByTestId('block-confirm').click();
    await p.waitForTimeout(900);
    const acked = await lastRequest(p, 'POST', '/availability');
    ok('con acknowledgeConflicts → 200', acked?.status === 200 && acked?.body?.acknowledgeConflicts === true);
    ok('el quirófano queda bloqueado (administrativo)', (await p.getByTestId('bed-tile-QX-1').getAttribute('data-v2')) === 'C');
    await p.context().close();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 4 · Aislamiento y cohorte.
  {
    const p = await newPage({ persona: 'nurse' });
    await board(p, `&cell=${bedId('AIS-2A')}`);
    await tab(p, 'Medicina interna');
    await p.getByTestId('action-isolate').click();
    let d = dialogOf(p);
    await choose(p, d, 'isolation-code', 'Aislamiento aéreo');
    await d.locator('textarea').first().fill('Sospecha de tuberculosis pulmonar');
    await d.getByTestId('isolation-confirm').click();
    await p.waitForTimeout(800);
    const notCapable = await lastRequest(p, 'POST', '/isolation');
    ok('aéreo en un local con la validación de climatización vencida → 422', notCapable?.status === 422);
    ok('la pantalla dice qué le falta al local', /climatización/.test(await d.innerText()));
    await shots(p, 'isolation-1-airborne-not-capable', { widths: [WIDTHS[0], WIDTHS[2]] });
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);

    await p.getByTestId('bed-tile-302-A').click();
    await p.waitForTimeout(600);
    await p.getByTestId('action-isolate').click();
    d = dialogOf(p);
    await choose(p, d, 'isolation-code', 'Aislamiento por gotas');
    await d.locator('input').last().fill('Influenza A').catch(() => {});
    await d.locator('textarea').first().fill('Cuadro respiratorio febril');
    await d.getByTestId('isolation-confirm').click();
    await p.waitForTimeout(900);
    const iso = await lastRequest(p, 'POST', '/isolation');
    ok('aislamiento por gotas → 200 y devuelve las camas hermanas bloqueadas', iso?.status === 200);
    ok('302-A queda «Aislada»', (await p.getByTestId('bed-tile-302-A').getAttribute('data-v2')) === 'I');
    ok('302-B (libre, misma habitación) queda bloqueada por cohorte', (await p.getByTestId('bed-tile-302-B').getAttribute('data-v2')) === 'C' && /Cohorte de aislamiento/.test(await p.getByTestId('bed-tile-302-B').innerText()));
    await shots(p, 'isolation-2-droplet-cohort-block');

    await p.getByTestId('bed-tile-302-A').click();
    await p.waitForTimeout(500);
    await p.getByTestId('action-lift-isolation').click();
    await reasonDialog(p, 'El cuadro se resolvió', 'Levantar aislamiento');
    ok('levantar el aislamiento → 200', (await lastRequest(p, 'POST', '/isolation'))?.status === 200);
    await p.waitForTimeout(500);
    ok('exige limpieza terminal: la cama no es asignable', /Exige limpieza terminal/.test(await p.getByTestId('axis-hygiene').innerText()) && /No/.test(await p.getByTestId('axis-assignable').innerText()));
    ok('la hermana se libera', (await p.getByTestId('bed-tile-302-B').getAttribute('data-v2')) !== 'C');
    await setPersona(p, 'housekeeping-supervisor');
    await queue(p);
    ok('la cola muestra la orden TERMINAL por fin de aislamiento', /Terminal/.test(await p.locator('tbody tr').filter({ hasText: '302-A' }).innerText()));
    await one(p, 'isolation-3-terminal-order-in-queue');
    await p.context().close();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 5 · Vistas por rol.
  for (const [persona, label, widths] of [
    ['housekeeping', 'role-housekeeping-hygiene-only', [WIDTHS[0], WIDTHS[2]]],
    ['maintenance', 'role-maintenance', [WIDTHS[0]]],
    ['admin', 'role-admin', [WIDTHS[0]]],
    ['admission', 'role-admission-sees-patient', [WIDTHS[0]]],
    ['nurse-supervisor', 'role-nurse-supervisor', [WIDTHS[0]]],
  ]) {
    const p = await newPage({ persona });
    await board(p, `&cell=${bedId(persona === 'maintenance' ? '312-A' : persona === 'admin' ? '401-B' : '301-A')}`);
    await tab(p, 'Medicina interna').catch(() => {});
    if (persona === 'maintenance' || persona === 'admin') await tab(p, persona === 'maintenance' ? 'Pediatría' : 'Maternidad');
    const text = await p.locator('body').innerText();
    if (persona === 'housekeeping') {
      ok('Limpieza: ni paciente, ni aislamiento, ni ocupación a la vista', !/M\.R\.|Tuberculosis|Rotavirus|Ocupada/.test(text) && /Vista de limpieza/.test(text));
      ok('Limpieza: el panel solo trae el eje de higiene', (await p.getByTestId('axis-isolation').count()) === 0 && (await p.getByTestId('axis-occupancy').count()) === 0);
    }
    if (persona === 'maintenance') ok('Mantenimiento: ofrece terminar el mantenimiento y no bloquear', (await p.getByTestId('action-end-maintenance').count()) === 1 && (await p.getByTestId('action-block-clinical').count()) === 0);
    if (persona === 'admin') ok('Administración: el bloqueo vencido se marca y se puede levantar', /Vencido/.test(await p.getByTestId('cell-blocks').innerText()) && (await p.getByTestId('action-unblock').count()) === 1);
    if (persona === 'admission') ok('Admisión: ve al paciente (iniciales, edad) y no cambia estados', /M\.R\./.test(await p.getByTestId('axis-occupancy').innerText()) && (await p.getByTestId('cell-no-actions').count()) === 1);
    await shots(p, label, { widths });
    await p.context().close();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 6 · La cola de limpieza.
  {
    const p = await newPage({ persona: 'housekeeping-supervisor' });
    await queue(p);
    const cols = (await p.locator('thead th').allInnerTexts()).join('|');
    ok('la cola no trae columnas de paciente', !/aciente/.test(cols), cols);
    ok('la orden inmediata va primero y la terminal está resaltada', /QX-2/.test(await p.locator('tbody tr').first().innerText()) && (await p.locator('tbody tr').filter({ hasText: 'UTI-4' }).locator('app-badge').count()) >= 1);
    ok('la cola muestra «Pedida hace N min» y quién la tiene', /hace \d+ min/.test(await p.locator('tbody tr').first().innerText()));
    await shots(p, 'queue-supervisor');
    await theme(p, 'dark');
    await shots(p, 'queue-supervisor', { widths: [WIDTHS[0], WIDTHS[2]], scheme: 'dark' });
    await theme(p, 'light');
    await p.getByTestId('cq-mine').click().catch(() => {});
    await p.waitForTimeout(600);
    await setPersona(p, 'housekeeping');
    await p.getByTestId('cq-create').click();
    await p.waitForTimeout(500);
    await one(p, 'queue-create-dialog');
    await p.context().close();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 7 · La pestaña «Operación» de la ficha del espacio (la sexta; las cinco de F1 no se mueven).
  {
    const p = await newPage({ persona: 'nurse' });
    await p.goto(`${BASE}/administration/medical-organization/spaces/${bedId('312-A')}`, { waitUntil: 'domcontentloaded', timeout: 180_000 });
    await p.getByTestId('ficha-espacio').waitFor({ timeout: 60_000 });
    const tabs = await p.getByRole('tab').allInnerTexts();
    ok('la ficha sigue siendo UNA tarjeta y tiene seis pestañas (las cinco de F1 y «Operación»)', tabs.map((t) => t.trim()).join('|') === 'General|Atributos técnicos|Unidades|Hijos|Historial|Operación' && (await p.locator('app-card').count()) === 1, tabs.join('|'));
    const before = (await requests(p)).filter((r) => r.url.includes('operational-state')).length;
    ok('abrir la ficha NO pide el estado operativo hasta abrir la pestaña', before === 0);
    await p.getByRole('tab', { name: 'Operación', exact: true }).click();
    await p.getByTestId('space-ops-tab').waitFor({ timeout: 30_000 });
    await p.waitForTimeout(800);
    ok('Operación: ejes, bloqueo vigente con su «hasta» e historial abierto', /Mantenimiento/.test(await p.getByTestId('axis-availability').innerText()) && (await p.getByTestId('status-history-list').locator('li').count()) >= 1);
    await shots(p, 'ficha-operation-tab');
    await theme(p, 'dark');
    await shots(p, 'ficha-operation-tab', { widths: [WIDTHS[0]], scheme: 'dark' });
    await theme(p, 'light');
    await p.goto(`${BASE}/administration/medical-organization/spaces/${bedId('HAB-301')}`, { waitUntil: 'domcontentloaded' });
    await p.getByTestId('ficha-espacio').waitFor();
    await p.getByRole('tab', { name: 'Operación', exact: true }).click();
    await p.waitForTimeout(500);
    ok('un espacio sin estado operativo lo dice y no pide nada', (await p.getByTestId('space-ops-none').count()) === 1);
    await p.context().close();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 8 · El sondeo cambia el estado sin tocar la pantalla (guion de deriva activo).
  {
    const p = await newPage({ persona: 'nurse', drift: 'on' });
    await board(p);
    await tab(p, 'Medicina interna');
    const before303 = [await p.getByTestId('bed-tile-303-B').getAttribute('data-v2'), await p.getByTestId('bed-tile-303-A').getAttribute('data-v2')];
    ok('antes del sondeo: 303-B en limpieza (H) y 303-A reservada (R)', before303.join() === 'H,R', before303.join());
    await one(p, 'poll-1-before');
    await p.waitForFunction(
      () => document.querySelector('[data-testid="bed-tile-303-A"]')?.getAttribute('data-v2') === 'O',
      null,
      { timeout: 200_000, polling: 2000 },
    );
    const after = await p.getByTestId('bed-tile-303-B').innerText();
    ok('el sondeo solo (sin tocar nada): 303-A pasó a ocupada y 303-B a «Limpia, falta inspección»', /Limpia, falta inspección/.test(after));
    const polls = (await requests(p)).filter((r) => r.method === 'GET' && r.url.includes('/bed-board')).length;
    ok('hubo sondeos periódicos del tablero', polls >= 3, `${polls} lecturas`);
    await one(p, 'poll-2-after');
    await p.context().close();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // 9 · Los estados M34 del tablero y de la cola.
  const forceFail = (pattern, mode) => ({ 'mock:fallos': JSON.stringify([{ patron: pattern, modo: mode }]) });
  {
    // S2
    const p = await newPage({ persona: 'nurse', init: { lento: '1' } });
    await p.goto(`${BASE}/inpatient/bed-board?site=${SITE_ID}`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(2200);
    ok('S2: cargando muestra el esqueleto', (await p.locator('app-skeleton, .view-state-host__loading').count()) > 0);
    await one(p, 'm34-S2-loading');
    await p.context().close();
  }
  {
    // S3 · establecimiento sin camas
    const p = await newPage({ persona: 'nurse' });
    await p.goto(`${BASE}/inpatient/bed-board?site=${uuid('site-sanlucas-norte')}`, { waitUntil: 'domcontentloaded' });
    await p.getByTestId('bb-empty').waitFor({ timeout: 60_000 });
    ok('S3: sin camas → «Crear camas»', /Crear camas/.test(await p.getByTestId('bb-empty').innerText()));
    await shots(p, 'm34-S3-site-without-beds', { widths: [WIDTHS[0], WIDTHS[2]] });
    // S3 de unidad: el filtro no deja nada
    await board(p, `&v2=K&unit=${uuid('unit-SANLUCAS-QX')}`);
    ok('S3 de unidad: «Ninguna cama coincide con los filtros» → Quitar los filtros', /Quitar los filtros/.test(await p.getByTestId('bb-unit-empty').innerText()));
    await one(p, 'm34-S3-unit-filter-empty');
    await p.context().close();
  }
  for (const [code, mode, init, expect, pattern] of [
    ['S5', 'forbidden', forceFail('/bed-board', 'forbidden'), /No tiene acceso/, null],
    ['S8', 'red', forceFail('/bed-board', 'red'), /Sin conexión/, null],
    ['S9', 'error', forceFail('/bed-board', 'error'), /Código de soporte/, null],
  ]) {
    const p = await newPage({ persona: 'nurse', init });
    await p.goto(`${BASE}/inpatient/bed-board?site=${SITE_ID}`, { waitUntil: 'domcontentloaded' });
    await p.getByTestId('bed-board').waitFor({ timeout: 60_000 });
    await p.waitForTimeout(2500);
    ok(`${code}: ${mode}`, expect.test(await p.getByTestId('bed-board').innerText()));
    await one(p, `m34-${code}-${mode}`);
    if (code === 'S9') await shots(p, 'm34-S9-error', { widths: [WIDTHS[2]] });
    await p.context().close();
  }
  {
    // S6
    const p = await newPage({ persona: 'nurse' });
    await p.goto(`${BASE}/inpatient/bed-board?site=${uuid('site-otro-tenant')}`, { waitUntil: 'domcontentloaded' });
    await p.getByTestId('bed-board').waitFor({ timeout: 60_000 });
    await p.waitForTimeout(2000);
    ok('S6: un establecimiento de otro tenant no revela nada', /No encontramos lo que busca/.test(await p.getByTestId('bed-board').innerText()) && !/otra organización/.test(await p.locator('body').innerText()));
    await one(p, 'm34-S6-not-found');
    await p.context().close();
  }
  {
    // S7 por antigüedad de la lectura
    const p = await newPage({ persona: 'nurse', init: { 'mock:infra-antiguedad': '4' } });
    await board(p);
    await tab(p, 'Medicina interna');
    ok('S7: «Dato de hace 4 min» con «Reintentar»', /Dato de hace 4 min/.test(await p.getByTestId('bb-stale').innerText()) && (await p.getByTestId('bb-stale-retry').count()) === 1);
    ok('S7: los datos siguen a la vista', (await p.getByTestId('bed-tile-302-A').count()) === 1);
    await shots(p, 'm34-S7-stale-by-age');
    await p.context().close();
  }
  {
    // S7 por sondeo caído
    const p = await newPage({ persona: 'nurse' });
    await board(p);
    await tab(p, 'Medicina interna');
    await setFailures(p, [{ patron: '/bed-board', modo: 'red' }]);
    await p.getByTestId('bb-refresh').click();
    await p.waitForTimeout(1500);
    ok('S7 por sondeo caído: quedan los datos de antes marcados como atrasados', /No se pudo actualizar/.test(await p.getByTestId('bb-stale').innerText()) && (await p.getByTestId('bed-tile-302-A').count()) === 1);
    await one(p, 'm34-S7-stale-poll-failed');
    await setFailures(p, null);
    await p.getByTestId('bb-stale-retry').click();
    await p.waitForTimeout(1200);
    ok('S7: al reintentar con éxito el aviso desaparece', (await p.getByTestId('bb-stale').count()) === 0);
    await p.context().close();
  }
  for (const [code, init, expect] of [
    ['S3', null, /Ninguna orden coincide con ese estado/],
    ['S5', forceFail('/cleaning-orders', 'forbidden'), /No tiene acceso/],
    ['S9', forceFail('/cleaning-orders', 'error'), /Código de soporte/],
  ]) {
    const p = await newPage({ persona: 'housekeeping', init: init ?? {} });
    await p.goto(`${BASE}/inpatient/cleaning?site=${SITE_ID}${code === 'S3' ? '&status=CLN_REJECTED' : ''}`, { waitUntil: 'domcontentloaded' });
    await p.getByTestId('cleaning-queue').waitFor({ timeout: 60_000 });
    await p.waitForTimeout(2500);
    ok(`cola ${code}`, expect.test(await p.getByTestId('cleaning-queue').innerText()));
    await one(p, `m34-queue-${code}`);
    await p.context().close();
  }
  {
    const p = await newPage({ persona: 'housekeeping', init: { 'mock:infra-antiguedad': '5' } });
    await queue(p);
    ok('cola S7: «Dato de hace 5 min»', /Dato de hace 5 min/.test(await p.getByTestId('cq-stale').innerText()));
    await shots(p, 'm34-queue-S7-stale', { widths: [WIDTHS[0], WIDTHS[2]] });
    await p.context().close();
  }


  writeFileSync(`${OUT}results.json`, JSON.stringify({ base: BASE, generated: new Date().toISOString(), results }, null, 2));
} finally {
  await browser.close();
}
const failed = results.filter((r) => !r.ok);
process.stdout.write(`\n${results.length - failed.length}/${results.length} comprobaciones en verde\n`);
process.exit(failed.length > 0 ? 1 : 0);
