import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, irA } from './support/sesion';

/**
 * C4a · «Qué va a completar» en el formulario médico de la consulta.
 *
 * El selector abre con «Hoja en blanco — escribir sin campos» y sigue con las
 * fichas de la especialidad de quien atiende, que vienen del catálogo de
 * plantillas. Ya no ofrece «Diagnóstico — del catálogo CIE-10», «Formulario
 * libre — campo y valor» ni «Laboratorio e imagenología»: el diagnóstico se
 * registra al final de la ficha, en su cierre, y en la casilla «Diagnóstico»
 * de la consulta; el consentimiento informado es una de las fichas generales.
 *
 * Recorrido contra el simulador, con la médica cardióloga, a 1280 px:
 *
 * 1. La rejilla de la consulta conserva la casilla «Diagnóstico».
 * 2. En «Formulario médico», la lista abre con la hoja en blanco, sigue con la
 *    ficha base de cardiología, trae el consentimiento informado y no trae
 *    ninguna de las tres opciones quitadas.
 * 3. Con la ficha elegida, el cierre de la ficha ofrece el diagnóstico tentativo.
 */
const OUTPUT = join('docs', 'frontend', 'evidence', 'correcciones-medico-c4a');
const DOCTOR: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Médica',
};
const SELECTOR_LABEL = 'Qué va a completar';
const BLANK_SHEET = 'Hoja en blanco — escribir sin campos';
const CARDIOLOGY_BASE_SHEET = 'Cardiología — consulta inicial (ficha base)';
const INFORMED_CONSENT = 'Consentimiento informado';
const REMOVED_ENTRIES = [
  'Diagnóstico — del catálogo CIE-10',
  'Formulario libre — campo y valor',
  'Laboratorio e imagenología',
] as const;

test.use({ viewport: { width: 1280, height: 800 } });

test.beforeEach(() => {
  test.setTimeout(240_000);
  mkdirSync(OUTPUT, { recursive: true });
});

async function openConsultation(page: Page): Promise<void> {
  await entrar(page, DOCTOR);
  await irA(page, '/schedule');
  const cards = page.locator('.dia__bloque[data-tipo="cita"]');
  await expect(cards.first()).toBeVisible();
  const inProgress = cards.filter({
    has: page.locator('.dia__estado').filter({ hasText: /en (curso|consulta)/i }),
  });
  const confirmed = cards.filter({
    has: page.locator('.dia__estado').filter({ hasText: /confirmad/i }),
  });
  const card = (await inProgress.count()) > 0 ? inProgress.first() : confirmed.first();
  const attend = card.getByTestId('dia-ir-a-atender');
  await attend.focus();
  await page.keyboard.press('Enter');
  await page.waitForURL(/\/medical-records\/[^/]+\/consultation\?/, { timeout: 30_000 });
  await expect(page.getByTestId('consulta-rejilla')).toBeVisible();
  const openEncounter = page.getByTestId('consulta-abrir-encuentro');
  await expect(openEncounter.or(page.getByTestId('encuentros-en-curso')).first()).toBeVisible();
  if (await openEncounter.isVisible()) await openEncounter.click();
  await expect(page.getByTestId('encuentros-en-curso')).toBeVisible();
}

/** Abre «Formulario médico» y espera a que la ficha de su especialidad quede elegida. */
async function openClinicalForm(page: Page): Promise<Locator> {
  await page.getByTestId('consulta-casilla-formulario').click();
  const modal = page.getByTestId('content-dialog');
  await expect(modal).toBeVisible();
  // La preselección llega con el catálogo y el perfil: antes, la lista sólo
  // tendría la hoja en blanco y la prueba mediría una pantalla a medias.
  await expect(modal.getByRole('combobox', { name: SELECTOR_LABEL, exact: true })).toContainText(
    CARDIOLOGY_BASE_SHEET,
    { timeout: 30_000 },
  );
  return modal;
}

/** Abre la lista del selector y devuelve sus opciones, en orden. */
async function openSelectorOptions(page: Page, modal: Locator): Promise<Locator> {
  await modal.getByRole('combobox', { name: SELECTOR_LABEL, exact: true }).click();
  const listbox = page.getByRole('listbox', { name: SELECTOR_LABEL });
  await expect(listbox).toBeVisible();
  return listbox.getByRole('option');
}

async function optionLabels(options: Locator): Promise<string[]> {
  return (await options.allInnerTexts()).map((label) => label.trim());
}

test('el selector abre con la hoja en blanco, sigue con las fichas de la especialidad y no trae las quitadas', async ({
  page,
}) => {
  await openConsultation(page);
  await expect(page.getByTestId('consulta-casilla-diagnosticos')).toBeVisible();

  const modal = await openClinicalForm(page);
  const options = await openSelectorOptions(page, modal);
  const labels = await optionLabels(options);

  expect(labels[0]).toBe(BLANK_SHEET);
  expect(labels[1]).toBe(CARDIOLOGY_BASE_SHEET);
  expect(labels).toContain(INFORMED_CONSENT);
  expect(labels.filter((label) => (REMOVED_ENTRIES as readonly string[]).includes(label))).toEqual(
    [],
  );
  await page.screenshot({ path: join(OUTPUT, 'practitioner-form-selector-options-1280.png') });
});

test('con la ficha de la especialidad elegida, el diagnóstico sigue al final, en el cierre', async ({
  page,
}) => {
  await openConsultation(page);
  const modal = await openClinicalForm(page);

  // Se elige a mano la misma ficha que vino preseleccionada: es lo que hace
  // quien atiende, y cierra la lista sin descartar nada.
  const options = await openSelectorOptions(page, modal);
  await options.filter({ hasText: CARDIOLOGY_BASE_SHEET }).first().click();
  await expect(page.getByRole('listbox', { name: SELECTOR_LABEL })).toHaveCount(0);

  const closure = modal.getByTestId('cierre-del-formulario');
  await expect(closure).toBeVisible({ timeout: 30_000 });
  await expect(closure).toContainText('Diagnóstico tentativo');
  await expect(closure).toContainText('Orden de análisis');
  await closure.scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(OUTPUT, 'practitioner-form-diagnosis-closure-1280.png') });
});
