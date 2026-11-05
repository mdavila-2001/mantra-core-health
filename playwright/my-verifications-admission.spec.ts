/**
 * «Mis verificaciones» with the verification request (admission), in the simulator.
 *
 * The journey, `UI → request → response → persistence → reload → UI`:
 *
 * 1. the doctor with a request sees its state above the roadmap, and «Títulos»
 *    among the required steps;
 * 2. each way out lands on its exact section of «Editar perfil»;
 * 3. a doctor without a request sends it: the declaration, «Enviar a
 *    verificación», the request shows up «Enviada» and is still there after
 *    reloading;
 * 4. the patient never reaches the screen.
 *
 * The simulator seeds a request for every doctor account it has. To show a
 * doctor without one (most of them in dev), the doctor withdraws it and the
 * test drops that row from the simulator's saved table (`sessionStorage`,
 * `mock.admissions`): the screen then reads a 404, as it does from the API.
 *
 * Runs against `ng serve` in demo mode (simulator). No red console.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

const BASE = process.env['E2E_BASE_URL'] ?? 'http://localhost:4200';
const SCREEN = '/my-account/verifications';
const EVIDENCE = join('docs', 'frontend', 'evidence', 'my-verifications-admission');
const DESKTOP = { width: 1440, height: 900 };
const VIEWPORTS = [
  { name: '390', width: 390, height: 844 },
  { name: '768', width: 768, height: 1024 },
  { name: '1024', width: 1024, height: 768 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1920', width: 1920, height: 1080 },
] as const;

test.describe.configure({ mode: 'serial' });

/** Page errors and red console lines; the full-glossary probe is expected (see carril 03). */
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

async function openScreen(page: Page): Promise<void> {
  await page.goto(`${BASE}${SCREEN}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Mis verificaciones' })).toBeVisible({ timeout: 30_000 });
  await esperarAQueSeAsiente(page);
}

/** The doctor withdraws the request, and the simulator forgets it: the screen reads a 404. */
async function leaveWithoutRequest(page: Page): Promise<void> {
  const card = page.getByTestId('admission-status-card');
  await card.getByTestId('admission-card-withdraw').click();
  await card.getByTestId('admission-card-withdraw-yes').click();
  await expect(card.getByTestId('admission-card-status')).toHaveText(/Retirada/);
  await page.evaluate(() => {
    const key = 'mock.admissions';
    const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null') as {
      filas: { practitioner: { fullName: string } }[];
    } | null;
    if (saved === null) throw new Error('The simulator did not save its admissions table');
    saved.filas = saved.filas.filter((row) => !/Ramiro Céspedes/.test(row.practitioner.fullName));
    sessionStorage.setItem(key, JSON.stringify(saved));
  });
  await openScreen(page);
}

test.beforeAll(() => mkdirSync(EVIDENCE, { recursive: true }));

test('el médico con solicitud ve su estado arriba y «Títulos» entre las etapas obligatorias', async ({ page }) => {
  const errors = watchConsole(page);
  await page.setViewportSize(DESKTOP);
  await entrarAlSimulador(page, 'medico.nuevo', BASE);
  await openScreen(page);

  const card = page.getByTestId('admission-status-card');
  await expect(card.getByTestId('admission-card-status')).toHaveText(/Información requerida/);
  await expect(card.getByTestId('admission-card-submit')).toHaveCount(0);
  const required = page.getByRole('list', { name: 'Etapas de su verificación' });
  await expect(required.getByTestId('verif-tramo-credentials')).toBeVisible();
  await expect(required.getByTestId('verif-tramo-credentials')).not.toContainText('Opcional');
  await page.screenshot({ path: join(EVIDENCE, 'practitioner-01-with-request-1440.png') });
  expect(errors).toEqual([]);
});

test('cada salida de la hoja de ruta baja a su sección exacta de «Editar perfil»', async ({ page }) => {
  const errors = watchConsole(page);
  await page.setViewportSize(DESKTOP);
  await entrarAlSimulador(page, 'medico.nuevo', BASE);

  const exits = [
    ['licenses', 'Revisar mis habilitaciones'],
    ['specialties', 'Revisar mis especialidades'],
  ] as const;
  for (const [section, label] of exits) {
    await openScreen(page);
    // The step's own link, or the main call to action when it is the next step.
    const exit = page
      .getByTestId(`verif-step-action-${section}`)
      .or(page.getByTestId('verif-siguiente').filter({ hasText: label }));
    await exit.first().click();
    await page.waitForURL((url) => url.pathname === '/my-account/edit' && url.hash === `#${section}`, {
      timeout: 30_000,
    });
    await expect(page.locator(`#${section}`)).toBeInViewport({ timeout: 30_000 });
    await page.screenshot({ path: join(EVIDENCE, `practitioner-02-exit-${section}-1440.png`) });
  }
  expect(errors).toEqual([]);
});

test('el médico sin solicitud la envía, la ve «Enviada» y sigue ahí al recargar', async ({ page }) => {
  const errors = watchConsole(page);
  await page.setViewportSize(DESKTOP);
  await entrarAlSimulador(page, 'medico.nuevo', BASE);
  await openScreen(page);
  await leaveWithoutRequest(page);

  const card = page.getByTestId('admission-status-card');
  await expect(card.getByRole('heading', { name: 'Enviar a verificación' })).toBeVisible();
  await expect(card.getByTestId('admission-card-submit')).toBeDisabled();
  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await esperarAQueSeAsiente(page);
    await page.screenshot({ path: join(EVIDENCE, `practitioner-03-without-request-${viewport.name}.png`) });
  }

  await page.setViewportSize(DESKTOP);
  await card.getByText('Declaro que los datos y documentos son verídicos.').click();
  await card.getByTestId('admission-card-submit').click();
  await expect(card.getByTestId('admission-card-status')).toHaveText(/Enviada/, { timeout: 30_000 });
  await page.screenshot({ path: join(EVIDENCE, 'practitioner-04-sent-1440.png') });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('admission-card-status')).toHaveText(/Enviada/, { timeout: 30_000 });
  await expect(page.getByTestId('admission-card-submit')).toHaveCount(0);
  await esperarAQueSeAsiente(page);
  await page.screenshot({ path: join(EVIDENCE, 'practitioner-05-sent-after-reload-1440.png') });
  expect(errors).toEqual([]);
});

test('el paciente no llega a «Mis verificaciones» ni ve el envío', async ({ page }) => {
  await page.setViewportSize(DESKTOP);
  await entrarAlSimulador(page, 'paciente', BASE);
  await page.goto(`${BASE}${SCREEN}`, { waitUntil: 'domcontentloaded' });
  await page.waitForURL((url) => url.pathname !== SCREEN, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Mis verificaciones' })).toHaveCount(0);
  await expect(page.getByTestId('admission-card-submit')).toHaveCount(0);
  await esperarAQueSeAsiente(page);
  await page.screenshot({ path: join(EVIDENCE, 'patient-01-kept-out-1440.png') });
});
