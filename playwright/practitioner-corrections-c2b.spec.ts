import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

/**
 * «Publicar agenda» — correcciones del médico, carril C2 (punto 5b): cada día
 * elige si es de horario flexible y, si es de turnos fijos, su descanso.
 *
 * Contra el simulador, con la médica. Capturas en
 * `docs/frontend/evidence/correcciones-medico-c2b/`, sin `fullPage`.
 */

const EVIDENCE_DIR = join('docs', 'frontend', 'evidence', 'correcciones-medico-c2b');
const PUBLISH_ROUTE = '/schedule/new';
const PUBLISH_HEADING = /^(Publique su agenda|Cambie su horario)$/;
const WEEK_DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6] as const;
const THEMES = ['light', 'dark'] as const;

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
});

function watchForProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 500) problems.push(`${response.status()} ${response.url()}`);
  });
  return problems;
}

async function snapshot(target: Page | Locator, name: string): Promise<void> {
  await target.screenshot({ path: join(EVIDENCE_DIR, `${name}.png`) });
}

async function useTheme(page: Page, theme: (typeof THEMES)[number]): Promise<void> {
  const root = page.locator('html');
  if ((await root.getAttribute('data-theme')) !== theme) {
    await page.getByTestId('header-theme-toggle').click();
  }
  await expect(root).toHaveAttribute('data-theme', theme);
}

async function openPublishScreen(page: Page): Promise<void> {
  await page.goto(PUBLISH_ROUTE, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('combobox', { name: 'Organización' })).toBeVisible();
  await esperarAQueSeAsiente(page);
  await expect(page.getByRole('heading', { level: 1, name: PUBLISH_HEADING })).toBeVisible();
}

/** Lunes de turnos fijos y martes de horario flexible, con el resto vacío. */
async function buildMixedWeek(page: Page): Promise<void> {
  await page.getByTestId('agenda-create-limpiar').click();
  const confirmation = page.getByTestId('dialogo').filter({ hasText: 'Limpiar el formulario' });
  await confirmation.getByTestId('dialogo-confirmar').click();
  await expect(confirmation).toBeHidden();
  for (const day of WEEK_DAY_INDEXES) {
    await expect(
      page.getByTestId(`agenda-create-dia-${day}`).locator('[data-value="no"]'),
    ).toHaveAttribute('aria-checked', 'true');
  }
  for (const day of [0, 1]) {
    await page.getByTestId(`agenda-create-dia-${day}`).locator('[data-value="si"]').click();
  }
  // El input nativo del interruptor es transparente: se pulsa su pista, como la persona.
  const flexibleTuesday = page.getByTestId('schedule-day-flexible-1');
  await flexibleTuesday.locator('.switch-track').click();
  await expect(flexibleTuesday.getByRole('switch')).toBeChecked();
}

test('médica · lunes de turnos fijos con descanso y martes de horario flexible', async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await entrarAlSimulador(page, 'medica', '');
  await openPublishScreen(page);
  await buildMixedWeek(page);

  // El descanso es de los días de turnos fijos: el martes flexible no lo tiene.
  await expect(page.getByTestId('schedule-day-gap-0')).toBeVisible();
  await expect(page.getByTestId('schedule-day-gap-1')).toHaveCount(0);
  await expect(page.locator('.schedule-day-row__free')).toHaveText('Sin citas de duración fija');

  const table = page.locator('table').filter({ has: page.getByTestId('schedule-day-flexible-0') });
  for (const theme of THEMES) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await useTheme(page, theme);
    await table.scrollIntoViewIfNeeded();
    await snapshot(page, `mixed-week-1280-${theme}`);
    await page.setViewportSize({ width: 360, height: 800 });
    await esperarAQueSeAsiente(page);
    await table.scrollIntoViewIfNeeded();
    await snapshot(page, `mixed-week-360-${theme}`);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await useTheme(page, 'light');

  // La vista previa trae las dos franjas: la del martes, sin tamaño de turno.
  await page.getByTestId('agenda-create-previsualizar').click();
  const preview = page.getByRole('dialog', { name: 'Así va a quedar su horario' });
  await expect(preview).toBeVisible();
  await expect(preview.getByTestId('horario-bloque')).toHaveCount(2);
  await snapshot(preview.locator('.content-dialog__panel'), 'mixed-week-preview-1280-light');
  await page.getByTestId('agenda-create-previa-ok').click();
  await expect(preview).toBeHidden();

  // Publicar: la maqueta valida el cuerpo contra el contrato de la API, así que
  // una regla con `flexibleHours` que no aceptara volvería con un error.
  await page.getByRole('button', { name: /^(Publicar mi agenda|Guardar mi horario)$/ }).click();
  const success = page.getByTestId('dialogo').filter({ hasText: /^Listo, su/ });
  for (let step = 0; step < 3 && !(await success.isVisible()); step++) {
    const pending = page.getByTestId('dialogo').filter({ hasNotText: /Listo, su/ });
    if (await pending.isVisible()) await pending.getByTestId('dialogo-confirmar').click();
    await esperarAQueSeAsiente(page);
  }
  await expect(success).toBeVisible();
  await snapshot(page, 'mixed-week-published-1280-light');

  expect(problems, problems.join('\n')).toEqual([]);
});
