/**
 * Agenda · who attends has no «Cupos» tab (E4), on the simulator.
 *
 * 1. The doctor sees «Consultas» and «Mis horarios»; the header does not talk
 *    about cupos, and an old `vista=cupos` link leaves her on «Consultas»
 *    without redirecting.
 * 2. She moves a booking from her calendar: «Mover a otro horario» keeps the
 *    mode on the day, whose free slots offer «Mover acá». The «Cupos» tab
 *    never shows up. Leaving the mode moves nothing; picking a slot asks for
 *    the reason and moves the booking.
 * 3. A doctor with no published agenda does not see «Cupos» either.
 * 4. Who hands out appointments keeps «Consultas» and «Cupos».
 * 5. The patient sees neither.
 *
 * Each test signs in on a fresh context, so the simulator state
 * (`sessionStorage`) does not leak: moving the booking in 2 changes nothing
 * for the others.
 *
 * Runs against `ng serve` in demo mode (simulator), with the simulator's own
 * accounts. No red console.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { capturar } from './support/captura';
import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const EVIDENCE = join('docs', 'frontend', 'evidence', 'schedule-tabs-and-reschedule');
const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1920', width: 1920, height: 1080 },
] as const;

test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 1440, height: 900 } });

/** Page errors; the full-glossary probe is expected (see carril 03). */
function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    const glossaryProbe = msg.location().url.includes('/glossary-data/');
    if (msg.type() === 'error' && !/Content Security Policy/.test(msg.text()) && !glossaryProbe) {
      errors.push(msg.text());
    }
  });
  return errors;
}

/** The POSTs that move a booking, to prove when nothing moved. */
function watchMoves(page: Page): string[] {
  const moves: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/reschedule')) {
      moves.push(request.url());
    }
  });
  return moves;
}

async function openSchedule(page: Page, account: string, path = '/schedule'): Promise<void> {
  // The app skips view transitions under reduced motion: captures stay clean.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.clear());
  await entrarAlSimulador(page, account, BASE);
  await page.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
  await esperarAQueSeAsiente(page);
}

/** The tabs of /schedule, without their counters. */
async function tabLabels(page: Page): Promise<string[]> {
  const labels = await page.locator('app-agenda [role="tab"]').allInnerTexts();
  return labels.map((label) => label.replace(/\s*\(\d+\)\s*$/, '').trim());
}

async function waitForTabs(page: Page): Promise<void> {
  await expect(page.locator('app-agenda [role="tab"]').first()).toBeVisible({ timeout: 60_000 });
}

/**
 * Picks «Mover a otro horario» on the first booking of the open day that offers
 * it. With three or more actions they live in a menu hung from `<body>`.
 */
async function startMovingABooking(page: Page): Promise<boolean> {
  const cards = page.getByTestId('dia-acciones');
  const total = await cards.count();
  for (let index = 0; index < total; index += 1) {
    const card = cards.nth(index);
    const inline = card.locator('[data-action="agenda-reprogramar"]');
    if ((await inline.count()) > 0) {
      await inline.first().click();
      return true;
    }
    const trigger = card.getByTestId('row-actions-trigger');
    if ((await trigger.count()) === 0) continue;
    await trigger.click();
    const item = page.locator('[data-action="agenda-reprogramar"]').first();
    const offered = await item.waitFor({ state: 'visible', timeout: 2_000 }).then(
      () => true,
      () => false,
    );
    if (offered) {
      await item.click();
      return true;
    }
    await page.keyboard.press('Escape');
  }
  return false;
}

async function enterMoveMode(page: Page): Promise<void> {
  await openSchedule(page, 'medica');
  await expect(page.getByTestId('agenda-calendario')).toBeVisible({ timeout: 60_000 });
  test.skip(
    !(await startMovingABooking(page)),
    'El día que abre el calendario de la maqueta no tiene una cita vigente que mover.',
  );
}

test.describe('Agenda · quien atiende no tiene «Cupos»', () => {
  test('la médica ve «Consultas» y «Mis horarios», y el encabezado no le habla de cupos', async ({
    page,
  }) => {
    const errors = watchConsole(page);
    await openSchedule(page, 'medica');
    await waitForTabs(page);
    mkdirSync(EVIDENCE, { recursive: true });

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await esperarAQueSeAsiente(page);
      expect(await tabLabels(page)).toEqual(['Consultas', 'Mis horarios']);
      await expect(page.locator('app-agenda app-page-header')).not.toContainText(/cupo/i);
      await capturar(page, join(EVIDENCE, `doctor-tabs-${viewport.name}.png`));
    }
    expect(errors).toEqual([]);
  });

  test('un enlace viejo a vista=cupos deja a la médica en «Consultas», sin redirigir', async ({
    page,
  }) => {
    await openSchedule(page, 'medica', '/schedule?vista=cupos');
    await waitForTabs(page);

    expect(await tabLabels(page)).toEqual(['Consultas', 'Mis horarios']);
    await expect(page.locator('app-agenda [role="tab"][aria-selected="true"]')).toHaveText(
      /^\s*Consultas/,
    );
    expect(new URL(page.url()).searchParams.get('vista')).toBe('cupos');
  });

  test('«Mover a otro horario» deja el modo sobre el día, y salir no mueve nada', async ({
    page,
  }) => {
    const errors = watchConsole(page);
    const moves = watchMoves(page);
    await enterMoveMode(page);

    const banner = page.getByTestId('agenda-reprogramando');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('en el horario libre que quiera');
    await expect(banner).not.toContainText(/cupo/i);
    expect(await tabLabels(page)).toEqual(['Consultas', 'Mis horarios']);
    expect(new URL(page.url()).searchParams.get('vista')).not.toBe('cupos');
    mkdirSync(EVIDENCE, { recursive: true });
    await capturar(page, join(EVIDENCE, 'doctor-moving-1440.png'));

    await page.getByTestId('agenda-reprogramando-salir').click();
    await expect(banner).toHaveCount(0);
    expect(moves).toEqual([]);
    expect(errors).toEqual([]);
  });

  test('«Mover acá» en un rato libre pide el motivo y mueve la cita', async ({ page }) => {
    const errors = watchConsole(page);
    await enterMoveMode(page);

    const moveHere = page.getByTestId('dia-mover-aca').first();
    test.skip(
      (await moveHere.count()) === 0,
      'El día que abre el calendario de la maqueta no tiene horarios libres.',
    );
    await moveHere.click();
    await page.getByLabel('Motivo del cambio').fill('Se cruzó con una cirugía');
    const moved = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' && response.url().includes('/reschedule'),
    );
    await page.getByRole('button', { name: 'Mover la cita' }).click();

    expect((await moved).ok()).toBe(true);
    await expect(page.getByTestId('agenda-reprogramando')).toHaveCount(0);
    await expect(page.getByText('La cita quedó en el horario nuevo.')).toBeVisible();
    expect(await tabLabels(page)).toEqual(['Consultas', 'Mis horarios']);
    expect(errors).toEqual([]);
  });

  test('un médico sin agenda publicada tampoco ve «Cupos»', async ({ page }) => {
    await openSchedule(page, 'medico.nuevo');
    const notPublished = page.getByText('Todavía no publicó su agenda');
    test.skip(
      (await notPublished.count()) === 0,
      'En la maqueta, este médico no llega a /schedule sin agenda propia.',
    );
    await waitForTabs(page);

    expect(await tabLabels(page)).toEqual(['Consultas', 'Mis horarios']);
    await expect(page.locator('app-agenda app-page-header')).not.toContainText(/cupo/i);
    mkdirSync(EVIDENCE, { recursive: true });
    await capturar(page, join(EVIDENCE, 'doctor-without-schedule-1440.png'));
  });

  test('quien reparte turnos conserva «Consultas» y «Cupos»', async ({ page }) => {
    const errors = watchConsole(page);
    await openSchedule(page, 'administrador', '/schedule?vista=cupos');
    await waitForTabs(page);

    expect(await tabLabels(page)).toEqual(['Consultas', 'Cupos']);
    await expect(page.locator('app-agenda [role="tab"][aria-selected="true"]')).toHaveText(
      /^\s*Cupos/,
    );
    await expect(page.locator('app-agenda app-page-header')).toContainText(
      'Las consultas comprometidas y los cupos que quedan por ofrecer.',
    );
    mkdirSync(EVIDENCE, { recursive: true });
    await capturar(page, join(EVIDENCE, 'dispatcher-slots-1440.png'));
    expect(errors).toEqual([]);
  });

  test('la paciente no ve «Cupos» ni «Mover a otro horario»', async ({ page }) => {
    await openSchedule(page, 'paciente');

    expect(await tabLabels(page)).not.toContain('Cupos');
    await expect(page.locator('[data-action="agenda-reprogramar"]')).toHaveCount(0);
    await expect(page.getByTestId('agenda-reprogramando')).toHaveCount(0);
    mkdirSync(EVIDENCE, { recursive: true });
    await capturar(page, join(EVIDENCE, 'patient-schedule-1440.png'));
  });
});
