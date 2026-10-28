import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import { entrarAlSimulador, esperarAQueSeAsiente } from './support/simulador';

/**
 * «Publicar agenda» — correcciones del médico, carril C2 (puntos 5, 6 y 7).
 *
 * Corre contra la maqueta (`mockBackend: true`), con las cuentas del propio
 * simulador. Cubre lo que el carril cambia en pantalla:
 *
 * 1. El selector «Organización» arriba de la agenda, con «Mi consultorio» por
 *    omisión, y «Afiliarme a otra organización…» abriendo el formulario de
 *    solicitud en un modal, sin navegar.
 * 2. «Opciones avanzadas» como fila plegable, cerrada y abierta.
 * 3. La vista previa: el globo dice «Lunes» y no «Luness», y los tres tipos de
 *    franja se distinguen por color y por forma, con la leyenda igual, en claro
 *    y en oscuro, a 360 y a 1280.
 *
 * La paciente no publica agenda: se comprueba que la pantalla no se le ofrece.
 *
 * La médica del simulador ya tiene un horario publicado, así que la pantalla
 * se abre para cambiarlo: el encabezado pasa de «Publique su agenda» a «Cambie
 * su horario» cuando ese horario llega, y la semana viene cargada de lunes a
 * sábado. Las pruebas no dependen de ninguna de las dos cosas.
 *
 * Las fotos quedan en `docs/frontend/evidence/correcciones-medico-c2a/`, nunca
 * de página entera: de la pantalla visible o de la pieza que se mira.
 */

const EVIDENCE_DIR = join('docs', 'frontend', 'evidence', 'correcciones-medico-c2a');

/** La pantalla, tal como la enlaza «Mi agenda» (`AGENDA_CREATE_ROUTE`). */
const PUBLISH_ROUTE = '/schedule/new';

/** El encabezado de la pantalla, sin horario publicado y con uno que se cambia. */
const PUBLISH_HEADING = /^(Publique su agenda|Cambie su horario)$/;

const VIEWPORTS = [
  { name: '360', width: 360, height: 800 },
  { name: '1280', width: 1280, height: 800 },
] as const;

const THEMES = ['light', 'dark'] as const;

type Theme = (typeof THEMES)[number];

/** Los siete días de la semana, como los numera la tabla (`agenda-create-dia-N`). */
const WEEK_DAY_INDEXES = [0, 1, 2, 3, 4, 5, 6] as const;

/**
 * Los dos scripts en línea del «event replay» de Angular bajo SSR, que la CSP
 * del servidor bloquea en todas las páginas: es el mismo defecto previo que
 * excluye `horarios-otros-servicios.spec.ts`, por su hash exacto. Cualquier
 * otra violación de CSP sigue haciendo fallar la prueba.
 */
const EVENT_REPLAY_CSP_HASHES = [
  'sha256-VM2mZqyEQZoLzoTrp5EigFvzQ0+f1wSeBuoOn95WHCg=',
  'sha256-kSSVmtxCwx5BcVxBHL/eBew1IVRG78eha+qAq9Y8B38=',
];

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
});

/** Errores de consola y respuestas 5xx, para fallar si la pantalla los produce. */
function watchForProblems(page: Page): string[] {
  const problems: string[] = [];
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    const isEventReplay =
      /Content Security Policy/.test(text) && EVENT_REPLAY_CSP_HASHES.some((h) => text.includes(h));
    if (!isEventReplay) problems.push(`console: ${text}`);
  });
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.status() >= 500) problems.push(`${response.status()} ${response.url()}`);
  });
  return problems;
}

/**
 * Abre «Publicar agenda» y espera a que deje de moverse.
 *
 * El ancla es el selector «Organización», que está desde el primer pintado; el
 * horario vigente llega después y cambia el encabezado, por eso se acepta
 * cualquiera de los dos recién cuando la pantalla se asentó.
 */
async function openPublishScreen(page: Page): Promise<void> {
  await page.goto(PUBLISH_ROUTE, { waitUntil: 'domcontentloaded' });
  await expect(organizationSelect(page)).toBeVisible();
  await esperarAQueSeAsiente(page);
  await expect(page.getByRole('heading', { level: 1, name: PUBLISH_HEADING })).toBeVisible();
}

function organizationSelect(page: Page): Locator {
  return page.getByRole('combobox', { name: 'Organización' });
}

/**
 * Pasa la aplicación al tema pedido como lo hace la médica: con el conmutador
 * del encabezado.
 *
 * El tema lo fija `ThemeService` en `data-theme` y no sigue a
 * `prefers-color-scheme`: emular el esquema del sistema dejaba la pantalla
 * clara y la foto «dark» salía clara. Se comprueba el atributo antes de seguir.
 */
async function useTheme(page: Page, theme: Theme): Promise<void> {
  const root = page.locator('html');
  if ((await root.getAttribute('data-theme')) !== theme) {
    await page.getByTestId('header-theme-toggle').click();
  }
  await expect(root).toHaveAttribute('data-theme', theme);
}

function advancedOptionsRow(page: Page): Locator {
  return page.getByRole('button', { name: 'Opciones avanzadas' });
}

/** Foto de la pantalla visible (nunca de página entera) o de una pieza. */
async function snapshot(target: Page | Locator, name: string): Promise<void> {
  await target.screenshot({ path: join(EVIDENCE_DIR, `${name}.png`) });
}

/** Elige una opción de un `app-select`: la lista se abre en su propio panel. */
async function choose(page: Page, field: Locator, option: string): Promise<void> {
  await field.locator('.select-trigger').click();
  await page.getByRole('option', { name: option, exact: true }).click();
}

/**
 * Vacía la semana con «Limpiar campos»: la que viene cargada es el horario
 * vigente de la médica, de lunes a sábado.
 */
async function clearWeek(page: Page): Promise<void> {
  await page.getByTestId('agenda-create-limpiar').click();
  const confirmation = page.getByTestId('dialogo').filter({ hasText: 'Limpiar el formulario' });
  await expect(confirmation).toBeVisible();
  await confirmation.getByTestId('dialogo-confirmar').click();
  await expect(confirmation).toBeHidden();
  for (const day of WEEK_DAY_INDEXES) {
    await expect(
      page.getByTestId(`agenda-create-dia-${day}`).locator('[data-value="no"]'),
    ).toHaveAttribute('aria-checked', 'true');
  }
}

/**
 * Lunes de consultas, martes de otros servicios y miércoles «Ambos»: los tres
 * tipos de franja en la misma semana, para que la leyenda los muestre todos.
 * Parte de la semana vacía, así que son las tres únicas franjas.
 */
async function buildWeekWithEveryKind(page: Page): Promise<void> {
  await clearWeek(page);
  for (const day of [0, 1, 2]) {
    await page.getByTestId(`agenda-create-dia-${day}`).locator('[data-value="si"]').click();
  }
  await choose(page, page.getByTestId('agenda-create-modo-1'), 'Otros servicios');
  await choose(page, page.getByTestId('agenda-create-modo-2'), 'Ambos');
}

async function openPreview(page: Page): Promise<Locator> {
  await page.getByTestId('agenda-create-previsualizar').click();
  const dialog = page.getByRole('dialog', { name: 'Así va a quedar su horario' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('médica · «Organización» arriba de la agenda, con «Mi consultorio» por omisión', async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await entrarAlSimulador(page, 'medica', '');
  await openPublishScreen(page);

  const select = organizationSelect(page);
  await expect(select).toBeVisible();
  await expect(select).toHaveText(/Mi consultorio/);
  await expect(page.getByRole('heading', { name: '¿En qué organización publica?' })).toBeVisible();

  for (const vp of VIEWPORTS) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await esperarAQueSeAsiente(page);
    await select.scrollIntoViewIfNeeded();
    await snapshot(page, `organization-select-${vp.name}-light`);
  }

  // Las organizaciones donde ya está afiliada, y al final la puerta para pedir otra.
  await page.setViewportSize({ width: 1280, height: 800 });
  await select.click();
  await expect(page.getByRole('option', { name: /Mi consultorio/ })).toBeVisible();
  await expect(page.getByRole('option', { name: 'Clínica Los Olivos' })).toBeVisible();
  await expect(page.getByRole('option', { name: /Afiliarme a otra organización/ })).toBeVisible();
  await snapshot(page, 'organization-select-open-1280-light');
  await page.keyboard.press('Escape');

  expect(problems, problems.join('\n')).toEqual([]);
});

test('médica · «Afiliarme a otra organización…» abre la solicitud en un modal, sin navegar', async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await entrarAlSimulador(page, 'medica', '');
  await openPublishScreen(page);

  const select = organizationSelect(page);
  await select.click();
  await page.getByRole('option', { name: /Afiliarme a otra organización/ }).click();

  const dialog = page.getByRole('dialog', { name: 'Pedir afiliarme a un centro' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('request-form')).toBeVisible();
  // El título se lee una vez: lo dice el modal y el del formulario queda oculto
  // (sigue en el DOM con `display: none`, por eso se cuentan solo los visibles).
  await expect(
    dialog.getByText('Pedir afiliarme a un centro', { exact: true }).filter({ visible: true }),
  ).toHaveCount(1);
  await expect(page).toHaveURL(new RegExp(`${PUBLISH_ROUTE}$`));

  for (const vp of [...VIEWPORTS].reverse()) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await esperarAQueSeAsiente(page);
    await snapshot(page, `affiliation-${vp.name}-light`);
  }

  // Cancelar cierra el modal y el selector sigue donde estaba: pedir no es elegir.
  await dialog.getByTestId('request-cancel').click();
  await expect(dialog).toBeHidden();
  await expect(select).toHaveText(/Mi consultorio/);

  // Y la solicitud sale desde el modal: queda pendiente del centro, el modal se
  // cierra y el selector tampoco cambia.
  await page.setViewportSize({ width: 1280, height: 800 });
  await select.click();
  await page.getByRole('option', { name: /Afiliarme a otra organización/ }).click();
  await expect(dialog).toBeVisible();
  await choose(page, dialog.getByTestId('request-practice'), 'Centro Médico Norte');
  await choose(page, dialog.getByTestId('request-site'), 'Centro Médico Norte · Sede principal');
  // El input nativo está oculto: se pulsa su rótulo visible, como lo haría la persona.
  await dialog.locator('.checkbox-label', { hasText: 'Colonoscopía' }).click();
  await expect(dialog.getByRole('checkbox', { name: 'Colonoscopía' })).toBeChecked();
  await snapshot(page, 'affiliation-filled-1280-light');
  await dialog.getByTestId('request-submit').click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText('Pidió afiliarse por 1 procedimiento.')).toBeVisible();
  await expect(select).toHaveText(/Mi consultorio/);
  await expect(page).toHaveURL(new RegExp(`${PUBLISH_ROUTE}$`));
  await snapshot(page, 'affiliation-sent-1280-light');

  expect(problems, problems.join('\n')).toEqual([]);
});

test('médica · «Opciones avanzadas» es una fila plegable, cerrada y abierta', async ({ page }) => {
  const problems = watchForProblems(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await entrarAlSimulador(page, 'medica', '');
  await openPublishScreen(page);

  const row = advancedOptionsRow(page);
  for (const theme of THEMES) {
    await page.setViewportSize({ width: 1280, height: 800 });
    await useTheme(page, theme);
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await esperarAQueSeAsiente(page);
      await row.scrollIntoViewIfNeeded();

      await expect(row).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByText('Zona horaria')).toBeHidden();
      await snapshot(page, `advanced-closed-${vp.name}-${theme}`);

      await row.click();
      await expect(row).toHaveAttribute('aria-expanded', 'true');
      const region = page.locator(`#${await row.getAttribute('aria-controls')}`);
      await expect(region.getByText('Zona horaria')).toBeVisible();
      await row.scrollIntoViewIfNeeded();
      await snapshot(page, `advanced-open-${vp.name}-${theme}`);

      await row.click();
      await expect(row).toHaveAttribute('aria-expanded', 'false');
    }
  }

  // Con el teclado también: el foco llega a la fila y Enter la abre.
  await row.focus();
  await page.keyboard.press('Enter');
  await expect(row).toHaveAttribute('aria-expanded', 'true');

  expect(problems, problems.join('\n')).toEqual([]);
});

test('médica · la vista previa dice «Lunes» y distingue los tres tipos, también en la leyenda', async ({
  page,
}) => {
  const problems = watchForProblems(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await entrarAlSimulador(page, 'medica', '');
  await openPublishScreen(page);
  await buildWeekWithEveryKind(page);

  const dialog = await openPreview(page);
  const blocks = dialog.getByTestId('horario-bloque');
  await expect(blocks).toHaveCount(3);
  const modes = await blocks.evaluateAll((els) => els.map((e) => e.getAttribute('data-mode')));
  expect([...modes].sort()).toEqual(['CONSULTATIONS', 'MIXED', 'SERVICES']);

  // El globo del lunes nombra el día como se dice.
  await blocks.and(dialog.locator('[aria-label^="lunes"]')).hover();
  const tooltip = page.getByTestId('horario-globo');
  await expect(tooltip).toBeVisible();
  await expect(tooltip.locator('.grilla__globo-titulo')).toHaveText('Lunes');
  await snapshot(page, 'preview-tooltip-monday-1280-light');

  const legend = dialog.getByTestId('horario-leyenda');
  await expect(legend.getByRole('listitem')).toHaveText([
    'Consultas',
    'Otros servicios: cirugías, toma de muestras, tratamientos y similares',
    'Consultas y otros servicios',
  ]);

  // La forma, además del color: trazo continuo, punteado y doble, y la trama.
  const strokes = await blocks.evaluateAll((els) =>
    els.map((e) => ({
      mode: e.getAttribute('data-mode'),
      stroke: getComputedStyle(e).borderInlineStartStyle,
      hatched: getComputedStyle(e).backgroundImage.includes('repeating-linear-gradient'),
    })),
  );
  expect(strokes).toEqual(
    expect.arrayContaining([
      { mode: 'CONSULTATIONS', stroke: 'solid', hatched: false },
      { mode: 'SERVICES', stroke: 'dashed', hatched: true },
      { mode: 'MIXED', stroke: 'double', hatched: false },
    ]),
  );

  // El conmutador de tema está en el encabezado, detrás del modal: se cierra la
  // vista previa, se cambia el tema y se vuelve a abrir con la misma semana.
  const panel = dialog.locator('.content-dialog__panel');
  for (const theme of THEMES) {
    await page.getByTestId('agenda-create-previa-volver').click();
    await expect(dialog).toBeHidden();
    await page.setViewportSize({ width: 1280, height: 800 });
    await useTheme(page, theme);
    await openPreview(page);
    await expect(blocks).toHaveCount(3);
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await esperarAQueSeAsiente(page);
      await legend.scrollIntoViewIfNeeded();
      await expect(legend).toBeVisible();
      await snapshot(legend, `legend-${vp.name}-${theme}`);
      await snapshot(panel, `preview-${vp.name}-${theme}`);
    }
  }

  expect(problems, problems.join('\n')).toEqual([]);
});

test('paciente · «Publicar agenda» no se le ofrece', async ({ page }) => {
  const problems = watchForProblems(page);
  await page.setViewportSize({ width: 1280, height: 800 });
  await entrarAlSimulador(page, 'paciente', '');

  await page.goto(PUBLISH_ROUTE, { waitUntil: 'domcontentloaded' });
  await esperarAQueSeAsiente(page);

  await expect(page.getByRole('heading', { name: PUBLISH_HEADING })).toHaveCount(0);
  await expect(organizationSelect(page)).toHaveCount(0);
  await snapshot(page, 'patient-no-publish-screen-1280-light');

  expect(problems, problems.join('\n')).toEqual([]);
});
