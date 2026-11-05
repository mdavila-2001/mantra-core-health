/**
 * Agenda · who attends has no «Cupos» tab (E4), on the simulator.
 *
 * 1. The doctor sees «Consultas» and «Mis horarios»; the header does not talk
 *    about cupos, and an old `vista=cupos` link leaves her on «Consultas»
 *    without redirecting.
 * 2. She moves a booking from her calendar: «Mover a otro horario» keeps the
 *    mode on the day, whose free slots offer «Mover acá». The «Cupos» tab
 *    never shows up. Leaving the mode moves nothing; picking a slot asks for
 *    the reason and moves the booking. Both are read on the screen: the
 *    simulator answers inside the app, so there is no request to watch.
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

import { expect, test, type Locator, type Page } from '@playwright/test';

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

/** The day's bookings that carry actions: one `<li>` of the day line each. */
function bookings(page: Page): Locator {
  return page.locator('li[data-tipo="cita"]').filter({ has: page.getByTestId('dia-acciones') });
}

/** «Atender a Ana Pérez, viernes 6 de noviembre, 15:00 a 15:20, …»: who, which day, what time. */
async function bookingName(booking: Locator): Promise<string> {
  const name = await booking.getByTestId('dia-ir-a-atender').getAttribute('aria-label');
  if (name === null) throw new Error('A booking on the day line has no accessible name');
  return name;
}

/** The day and the time inside an accessible name: «viernes 6 de noviembre, 15:00 a 15:20». */
function slotOf(accessibleName: string): string {
  const slot = /\p{L}+ \d{1,2} de \p{L}+, \d{2}:\d{2} a \d{2}:\d{2}/u.exec(accessibleName)?.[0];
  if (slot === undefined) throw new Error(`No day and time in «${accessibleName}»`);
  return slot;
}

/**
 * Picks «Mover a otro horario» on the first booking of the open day that offers
 * it and returns that booking's accessible name, or `null` if none does. With
 * three or more actions they live in a menu hung from `<body>`.
 */
async function startMovingABooking(page: Page): Promise<string | null> {
  const list = bookings(page);
  const total = await list.count();
  for (let index = 0; index < total; index += 1) {
    const booking = list.nth(index);
    const name = await bookingName(booking);
    const inline = booking.locator('[data-action="agenda-reprogramar"]');
    if ((await inline.count()) > 0) {
      await inline.first().click();
      return name;
    }
    const trigger = booking.getByTestId('row-actions-trigger');
    if ((await trigger.count()) === 0) continue;
    await trigger.click();
    const item = page.locator('[data-action="agenda-reprogramar"]').first();
    const offered = await item.waitFor({ state: 'visible', timeout: 2_000 }).then(
      () => true,
      () => false,
    );
    if (offered) {
      await item.click();
      return name;
    }
    await page.keyboard.press('Escape');
  }
  return null;
}

/** How far ahead the doctor looks for a day to move a booking on. */
const DAYS_AHEAD = 21;

/**
 * Opens the doctor's calendar and walks forward, day by day, to the first one
 * with a booking she can move and a free slot to move it to; there it starts
 * moving that booking and returns its accessible name.
 *
 * The simulator builds the agenda around today, so which day that is depends
 * on the date (today may have no office hours at all); the walk does not.
 * Not finding one in three weeks fails: it is the feature under test, and
 * skipping would hide it.
 */
async function enterMoveMode(page: Page): Promise<string> {
  await openSchedule(page, 'medica');
  await expect(page.getByTestId('agenda-calendario')).toBeVisible({ timeout: 60_000 });
  for (let day = 0; day < DAYS_AHEAD; day += 1) {
    if ((await page.getByTestId('day-view-free-slot').count()) > 0) {
      const booking = await startMovingABooking(page);
      if (booking !== null) return booking;
    }
    await page.getByTestId('dia-siguiente').click();
    await esperarAQueSeAsiente(page);
  }
  throw new Error(
    `In ${DAYS_AHEAD} days no day has both a booking that offers «Mover a otro horario» and a free slot.`,
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
    const booking = await enterMoveMode(page);

    const banner = page.getByTestId('agenda-reprogramando');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('en el horario libre que quiera');
    await expect(banner).not.toContainText(/cupo/i);
    expect(await tabLabels(page)).toEqual(['Consultas', 'Mis horarios']);
    expect(new URL(page.url()).searchParams.get('vista')).not.toBe('cupos');
    mkdirSync(EVIDENCE, { recursive: true });
    await banner.scrollIntoViewIfNeeded();
    await capturar(page, join(EVIDENCE, 'doctor-moving-1440.png'));
    await page.getByTestId('dia-mover-aca').first().scrollIntoViewIfNeeded();
    await capturar(page, join(EVIDENCE, 'doctor-moving-day-1440.png'));

    await page.getByTestId('agenda-reprogramando-salir').click();
    await expect(banner).toHaveCount(0);
    // Nothing moved: the booking is still in its slot, and the day offers no «Mover acá».
    await expect(page.getByRole('button', { name: booking, exact: true })).toHaveCount(1);
    await expect(page.getByTestId('dia-mover-aca')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('«Mover acá» en un rato libre pide el motivo y mueve la cita', async ({ page }) => {
    const errors = watchConsole(page);
    const booking = await enterMoveMode(page);
    // «Atender a Ana Pérez»: the booking's name up to its day and time.
    const attendPatient = booking.slice(0, booking.indexOf(', '));
    const oldSlot = slotOf(booking);

    const moveHere = page.getByTestId('dia-mover-aca').first();
    const newSlot = slotOf((await moveHere.getAttribute('aria-label')) ?? '');
    await moveHere.click();
    await page.getByLabel('Motivo del cambio').fill('Se cruzó con una cirugía');
    await page.getByRole('button', { name: 'Mover la cita' }).click();

    await expect(page.getByText('La cita quedó en el horario nuevo.')).toBeVisible();
    await expect(page.getByTestId('agenda-reprogramando')).toHaveCount(0);
    // The booking sits in the new slot, and the old one is free again.
    const moved = page.getByRole('button', { name: `${attendPatient}, ${newSlot}` });
    await expect(moved).toHaveCount(1);
    await expect(page.getByRole('button', { name: booking, exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: `Disponible: ${oldSlot}` })).toHaveCount(1);
    expect(await tabLabels(page)).toEqual(['Consultas', 'Mis horarios']);
    mkdirSync(EVIDENCE, { recursive: true });
    await moved.scrollIntoViewIfNeeded();
    await capturar(page, join(EVIDENCE, 'doctor-moved-1440.png'));
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
