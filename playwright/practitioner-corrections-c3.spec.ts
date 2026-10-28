import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

/**
 * El modal del día de la agenda del médico: lo que dejó de preguntar y lo que
 * ahora valida.
 *
 * ## Contra la maqueta
 *
 * Corre contra la build con el backend simulado (`mockBackend: true`, el
 * entorno `demo`): el interceptor de `src/app/core/mock/` contesta todo y se
 * entra con las cuentas del propio simulador (`medica@alovida.mock`,
 * `paciente@alovida.mock`), personas sintéticas de `core/mock/fixtures/people.ts`.
 *
 * ## Qué fija
 *
 * 1. Con paciente elegido, el modal no pregunta «¿Cómo lo atiende?» ni enlaza a
 *    «Publicar agenda».
 * 2. «Hasta» antes de «Desde» se dice en el campo «Hasta», y Guardar sigue
 *    apagado.
 * 3. Una sesión de más de 4 h pregunta antes de guardar, y «Volver» deja el
 *    modal como estaba.
 * 4. Una cita de 30 min queda agendada, y la paciente la ve en «Mis citas».
 * 5. El campo «Organización» empieza en «Mi consultorio», y «Afiliarme a otra
 *    organización…» abre la solicitud encima del modal del día, que sigue
 *    abierto con lo cargado. La paciente no tiene ese modal.
 *
 * ## Por qué mañana, y por el «+»
 *
 * Hoy puede no tener horas por delante. Mañana sí, y los bloqueos sembrados de
 * la maqueta caen a nueve días o más (`fixtures/agenda.ts`), así que ninguno
 * apaga Guardar. El alta se abre con el «+» del encabezado del día porque es la
 * que deja escribir la franja: tocar un cupo la fija y esconde los campos.
 *
 * ## Una sola pestaña
 *
 * Las reservas de la maqueta viven en `sessionStorage`, que es de la pestaña
 * (`core/mock/README.md`, «Cambio de cuenta»): la paciente ve la cita que
 * agendó la médica sólo si entra en la misma pestaña, después de que ella cierre
 * su sesión.
 */

const EVIDENCE = join('docs', 'frontend', 'evidence', 'correcciones-medico-c3');

const SCHEDULE = '/schedule';
const MY_APPOINTMENTS = '/my-account/appointments';

/** `THEME_STORAGE_KEY` de `core/tokens/theme.service.ts`. */
const THEME_STORAGE_KEY = 'mantra-core-health.theme';

/** La paciente sintética de la maqueta, como la nombra el buscador. */
const PATIENT_NAME = 'Ana Lucía Pérez Quiroga';

/** El motivo de la cita de 30 min: es lo que la paciente lee en «Mis citas». */
const SHORT_APPOINTMENT_REASON = 'Control de presión de media hora';

const END_BEFORE_START_ERROR = 'La hora de fin tiene que ser después de la de inicio';

/** El encabezado del modal de afiliación (`affiliation-dialog.ts`). */
const AFFILIATION_HEADING = 'Pedir afiliarme a un centro';

const VIEWPORTS = [
  { name: '360', width: 360, height: 800 },
  { name: '1280', width: 1280, height: 800 },
] as const;

const THEMES = ['light', 'dark'] as const;

type Viewport = (typeof VIEWPORTS)[number];
type Theme = (typeof THEMES)[number];

/** Cada celda de la matriz: un ancho y un tema. */
const MATRIX = VIEWPORTS.flatMap((viewport) => THEMES.map((theme) => ({ viewport, theme })));

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  mkdirSync(EVIDENCE, { recursive: true });
});

/**
 * Fija el ancho y el tema de la celda, y recarga para que la pantalla arranque
 * así.
 *
 * Se recarga en vez de cambiar en caliente: el cambio de ancho anima el menú
 * lateral y la captura lo saca a medio camino. Recargar no pierde la sesión ni
 * las reservas de la maqueta, que viven en la pestaña.
 */
async function applyCell(page: Page, viewport: Viewport, theme: Theme): Promise<void> {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });
  await page.evaluate(
    ([key, mode]) => window.localStorage.setItem(key, mode),
    [THEME_STORAGE_KEY, theme] as const,
  );
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  await esperarAQueSeAsiente(page);
}

/** Abre el alta de mañana desde el «+» del encabezado del día, con los campos de hora. */
async function openTomorrowDayCard(page: Page): Promise<Locator> {
  await page.getByTestId('dia-siguiente').click();
  await esperarAQueSeAsiente(page);
  await page.getByTestId('dia-agregar').click();

  const card = page
    .getByTestId('content-dialog')
    .filter({ hasText: 'Agregue una cita o un rato ocupado a este día.' });
  await expect(card).toBeVisible();
  await expect(card.getByLabel('Hasta')).toBeVisible();
  return card;
}

/** Elige a la paciente sintética en «¿Con quién?». */
async function choosePatient(page: Page, card: Locator): Promise<void> {
  await card.getByPlaceholder('Nombre o código del paciente').fill('Pérez Quiroga');
  await page.getByRole('option', { name: new RegExp(PATIENT_NAME) }).click();
  await expect(card.getByText('le avisamos al paciente')).toBeVisible();
}

async function writeRange(card: Locator, start: string, end: string): Promise<void> {
  await card.getByLabel('Desde').fill(start);
  await card.getByLabel('Hasta').fill(end);
}

/** El botón Guardar del modal, proyectado en su pie. */
function saveButton(page: Page): Locator {
  return page.getByTestId('tarjeta-guardar');
}

/** El selector «Organización» del modal del día. */
function organizationSelect(card: Locator): Locator {
  return card.getByRole('combobox', { name: 'Organización' });
}

/** El modal de la solicitud de afiliación, que se abre encima del del día. */
function affiliationDialog(page: Page): Locator {
  return page.getByRole('dialog', { name: AFFILIATION_HEADING });
}

test('médica · el modal del día no pregunta el medio, dice qué hora está mal y confirma la sesión larga', async ({
  page,
}) => {
  await entrarAlSimulador(page, 'medica', '');
  await page.goto(SCHEDULE, { waitUntil: 'domcontentloaded' });

  for (const { viewport, theme } of MATRIX) {
    const cell = `${viewport.name}-${theme}`;
    await applyCell(page, viewport, theme);
    const card = await openTomorrowDayCard(page);
    await choosePatient(page, card);

    // Ni la pregunta por el medio ni el enlace al horario semanal.
    await expect(card.getByText('¿Cómo lo atiende?')).toHaveCount(0);
    await expect(card.getByRole('radiogroup')).toHaveCount(0);
    await expect(card.getByText('Horario fijo semanal')).toHaveCount(0);
    await expect(card.getByRole('link', { name: /Publicar agenda/ })).toHaveCount(0);
    await page.screenshot({ path: join(EVIDENCE, `day-card-without-channel-${cell}.png`) });

    // Fin antes del inicio: el error vive en «Hasta» y lo describe.
    await writeRange(card, '21:00', '20:00');
    const end = card.getByLabel('Hasta');
    await expect(end).toHaveAttribute('aria-invalid', 'true');
    const describedBy = await end.getAttribute('aria-describedby');
    expect(describedBy, '«Hasta» tiene que apuntar a su error').not.toBeNull();
    const errorId = (describedBy ?? '').split(' ')[0];
    await expect(page.locator(`[id="${errorId}"]`)).toHaveText(END_BEFORE_START_ERROR);
    await expect(card.getByLabel('Desde')).toHaveAttribute('aria-invalid', 'false');
    await expect(saveButton(page)).toHaveAttribute('aria-disabled', 'true');
    await page.screenshot({ path: join(EVIDENCE, `end-before-start-${cell}.png`) });

    // Cinco horas: se pregunta antes, y «Volver» no guarda ni toca el modal.
    await writeRange(card, '09:00', '14:00');
    await expect(end).toHaveAttribute('aria-invalid', 'false');
    await saveButton(page).click();
    const confirmation = page.getByTestId('dialogo');
    await expect(confirmation.getByTestId('dialogo-titulo')).toHaveText(
      '¿Está seguro de agendar una sesión de 5 horas?',
    );
    await page.screenshot({ path: join(EVIDENCE, `long-session-confirmation-${cell}.png`) });

    await confirmation.getByRole('button', { name: 'Volver' }).click();
    await expect(confirmation).toHaveCount(0);
    await expect(card).toBeVisible();
    await expect(card.getByLabel('Desde')).toHaveValue('09:00');
    await expect(end).toHaveValue('14:00');
    await expect(page.getByText('Cita agendada')).toHaveCount(0);
  }
});

test('médica · el modal del día empieza en «Mi consultorio» y pide afiliación sin cerrarse', async ({
  page,
}) => {
  await entrarAlSimulador(page, 'medica', '');
  await page.goto(SCHEDULE, { waitUntil: 'domcontentloaded' });

  for (const { viewport, theme } of MATRIX) {
    const cell = `${viewport.name}-${theme}`;
    await applyCell(page, viewport, theme);
    const card = await openTomorrowDayCard(page);

    const select = organizationSelect(card);
    await expect(select).toBeVisible();
    await expect(select).toHaveText(/Mi consultorio/);
    await select.scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(EVIDENCE, `day-card-organization-default-${cell}.png`) });
  }

  // Las organizaciones donde ya está afiliada y, al final, la puerta para pedir otra.
  await applyCell(page, VIEWPORTS[1], 'light');
  const card = await openTomorrowDayCard(page);
  await choosePatient(page, card);
  const select = organizationSelect(card);
  await select.click();
  await expect(page.getByRole('option', { name: /Mi consultorio/ })).toBeVisible();
  await expect(page.getByRole('option', { name: /Afiliarme a otra organización/ })).toBeVisible();
  await page.screenshot({ path: join(EVIDENCE, 'day-card-organization-options-1280-light.png') });

  // «Afiliarme…» abre la solicitud encima; el modal del día sigue abierto debajo.
  await page.getByRole('option', { name: /Afiliarme a otra organización/ }).click();
  const affiliation = affiliationDialog(page);
  await expect(affiliation).toBeVisible();
  await expect(affiliation.getByTestId('request-form')).toBeVisible();
  await expect(card).toBeVisible();
  await page.screenshot({ path: join(EVIDENCE, 'day-card-affiliation-1280-light.png') });

  // Cancelar la solicitud deja el modal del día como estaba: pedir no es elegir.
  await affiliation.getByTestId('request-cancel').click();
  await expect(affiliation).toBeHidden();
  await expect(card).toBeVisible();
  await expect(select).toHaveText(/Mi consultorio/);
  await expect(card.getByText('le avisamos al paciente')).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`${SCHEDULE}(\\?|$)`));
  await page.screenshot({ path: join(EVIDENCE, 'day-card-after-affiliation-cancel-1280-light.png') });

  // A 360 la solicitud también cabe encima del modal del día.
  await applyCell(page, VIEWPORTS[0], 'light');
  const narrowCard = await openTomorrowDayCard(page);
  await organizationSelect(narrowCard).click();
  await page.getByRole('option', { name: /Afiliarme a otra organización/ }).click();
  await expect(affiliationDialog(page)).toBeVisible();
  await expect(narrowCard).toBeVisible();
  await page.screenshot({ path: join(EVIDENCE, 'day-card-affiliation-360-light.png') });
});

test('médica agenda una cita de 30 min y la paciente la ve en «Mis citas»', async ({ page }) => {
  await entrarAlSimulador(page, 'medica', '');
  await page.goto(SCHEDULE, { waitUntil: 'domcontentloaded' });
  await applyCell(page, VIEWPORTS[1], 'light');

  const card = await openTomorrowDayCard(page);
  await choosePatient(page, card);
  await writeRange(card, '18:00', '18:30');
  await card.getByLabel('¿Qué pasa?').fill(SHORT_APPOINTMENT_REASON);
  await saveButton(page).click();

  // Media hora no pregunta: se agenda de una.
  await expect(page.getByTestId('dialogo')).toHaveCount(0);
  await expect(page.getByText('Cita agendada')).toBeVisible();
  await expect(card).toHaveCount(0);
  await page.screenshot({ path: join(EVIDENCE, 'short-appointment-booked-1280-light.png') });

  // La paciente entra en la misma pestaña: ahí viven las reservas de la maqueta.
  await page.getByTestId('header-cuenta').click();
  await page.getByTestId('header-cerrar-sesion').click();
  await page.waitForURL((url) => url.pathname.startsWith('/auth'), { timeout: 30_000 });
  await entrarAlSimulador(page, 'paciente', '');
  await page.goto(MY_APPOINTMENTS, { waitUntil: 'domcontentloaded' });

  for (const { viewport, theme } of MATRIX) {
    await applyCell(page, viewport, theme);
    await expect(page.getByText(SHORT_APPOINTMENT_REASON).first()).toBeVisible();
    await page.screenshot({
      path: join(EVIDENCE, `patient-sees-short-appointment-${viewport.name}-${theme}.png`),
    });
  }
});

test('paciente · la agenda del médico no le ofrece el modal del día', async ({ page }) => {
  await entrarAlSimulador(page, 'paciente', '');
  await page.goto(SCHEDULE, { waitUntil: 'domcontentloaded' });
  await applyCell(page, VIEWPORTS[1], 'light');

  // Ni el «+» que abre el modal del día ni su selector de organización.
  await expect(page.getByTestId('dia-agregar')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Organización' })).toHaveCount(0);
  await page.screenshot({ path: join(EVIDENCE, 'patient-no-day-card-1280-light.png') });
});
