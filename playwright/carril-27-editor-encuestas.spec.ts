import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, esperarAplicacionLista, irA } from './support/sesion';

/**
 * TAREA-27 · the practitioner's «Encuestas» after standard surveys per service
 * (06/11/2026). Free creation («Nueva encuesta») is gone: a practitioner can
 * only attach a standard catalog survey to each of their services.
 *
 * Runs against the demo build (`yarn start:demo`, mock backend), signed in as
 * the mock practitioner. The mock answers inside the browser, so requests and
 * responses are read from `window.__mockRequests` (Playwright sees no network).
 *
 * Proves UI → request → response → persistence → reload → UI for both writes:
 *   - «Importar»: `PUT /surveys/service-assignments/:serviceId` { catalogCode }.
 *   - «Quitar»:   `DELETE /surveys/service-assignments/:serviceId` → 204.
 * And that the fixed «Cita médica» row (system survey) offers neither.
 *
 * Never waits for `networkidle` (never reached with HMR): waits on elements.
 */

const MEDICA: Actor = {
  rol: 'doctora',
  identificador: 'medica@alovida.mock',
  clave: 'mock',
  nombre: 'Médica',
};

/** The three widths required by the TAREA-27 sheet. */
const VIEWPORTS = [
  { nombre: 'movil', width: 390, height: 844 },
  { nombre: 'tablet', width: 768, height: 1024 },
  { nombre: 'escritorio', width: 1440, height: 900 },
] as const;

interface Atendida {
  readonly method: string;
  readonly url: string;
  readonly status: number;
  readonly body: unknown;
  readonly respuesta?: unknown;
}

async function atendidas(page: Page, method: string, prefijo: string): Promise<readonly Atendida[]> {
  const todas = await page.evaluate(
    () => (window as unknown as { __mockRequests?: Atendida[] }).__mockRequests ?? [],
  );
  return todas.filter((r) => r.method === method && r.url.startsWith(prefijo));
}

/** Formularios → «Encuestas» → «Encuestas por servicio», the way the practitioner gets there. */
async function openServiceSurveys(page: Page): Promise<void> {
  await irA(page, '/form-builder');
  await page.getByRole('tab', { name: 'Encuestas', exact: true }).click();
  await expect(page).toHaveURL(/\/questionnaires/);
  await expect(page.getByRole('tab', { name: 'Buzón', exact: true })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('tab', { name: 'Encuestas por servicio', exact: true }).click();
  await expect(page).toHaveURL(/encuestas=servicios/);
  await expect(page.getByTestId('service-surveys-list')).toBeVisible({ timeout: 30_000 });
}

/** The `serviceId` of the first service row that still offers «Importar». */
async function firstServiceWithoutSurvey(page: Page): Promise<string> {
  const boton = page.locator('[data-testid^="service-survey-import-"]').first();
  await expect(boton).toBeVisible();
  const testId = await boton.getAttribute('data-testid');
  return testId!.replace('service-survey-import-', '');
}

test('Encuestas por servicio: importar y quitar persisten tras recargar; la cita médica es fija', async ({
  page,
}) => {
  test.setTimeout(4 * 60_000);
  await entrar(page, MEDICA);
  await openServiceSurveys(page);

  // Free creation is gone from both sub-tabs.
  await expect(page.getByTestId('encuestas-nueva')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /nueva encuesta/i })).toHaveCount(0);

  // --- Fixed «Cita médica» row: system survey, only «Ver preguntas». --------
  const cita = page.getByTestId('service-surveys-appointment');
  await expect(cita).toContainText('Cita médica');
  await expect(cita).toContainText('Del sistema');
  await expect(cita.getByRole('button', { name: /importar|quitar|cambiar/i })).toHaveCount(0);
  await expect(cita.getByTestId('service-surveys-appointment-view')).toBeVisible();

  // --- Importar: UI → PUT → response → row. ---------------------------------
  const serviceId = await firstServiceWithoutSurvey(page);
  const fila = page.getByTestId(`service-survey-${serviceId}`);
  await expect(fila.getByTestId('service-surveys-base-only')).toBeVisible();

  await fila.getByTestId(`service-survey-import-${serviceId}`).click();
  const catalogo = page.getByTestId('standard-catalog');
  await expect(catalogo).toBeVisible();
  const opcion = catalogo.locator('[data-testid^="standard-catalog-option-"]').first();
  const code = (await opcion.getAttribute('data-testid'))!.replace('standard-catalog-option-', '');
  const titulo = (await opcion.locator('.catalogo__opcion-titulo').textContent())!.trim();
  await opcion.click();
  await expect(page.getByTestId('standard-catalog-preview')).toContainText(titulo);
  await page.getByTestId('standard-catalog-import').click();
  await expect(catalogo).toHaveCount(0);

  await expect(fila).toContainText(titulo);
  await expect(fila.getByText('Estándar')).toBeVisible();
  await expect(fila.getByTestId(`service-survey-remove-${serviceId}`)).toBeVisible();

  const ruta = `/surveys/service-assignments/${serviceId}`;
  const puts = await atendidas(page, 'PUT', ruta);
  expect(puts, 'one PUT per import').toHaveLength(1);
  expect(puts[0]!.status).toBe(200);
  expect(puts[0]!.body).toEqual({ catalogCode: code });
  expect(puts[0]!.respuesta).toMatchObject({ serviceId, assignment: { catalogCode: code, title: titulo } });

  // --- Persistence: reload and the import is still there. -------------------
  await page.reload();
  await esperarAplicacionLista(page);
  await expect(page.getByTestId('service-surveys-list')).toBeVisible({ timeout: 30_000 });
  await expect(fila).toContainText(titulo);
  await expect(fila.getByTestId(`service-survey-remove-${serviceId}`)).toBeVisible();
  await expect(fila.getByTestId(`service-survey-import-${serviceId}`)).toHaveCount(0);

  // --- «Cambiar» opens on the survey in use and does not offer re-importing it.
  await fila.getByTestId(`service-survey-change-${serviceId}`).click();
  const enUso = page.getByTestId(`standard-catalog-option-${code}`);
  await expect(enUso).toHaveAttribute('aria-checked', 'true');
  await expect(enUso).toContainText('En uso');
  await expect(page.getByTestId('standard-catalog-preview')).toContainText(titulo);
  await expect(page.getByTestId('standard-catalog-import')).toHaveAttribute('aria-disabled', 'true');
  await page.getByTestId('standard-catalog-cancel').click();
  await expect(page.getByTestId('standard-catalog')).toHaveCount(0);
  expect(await atendidas(page, 'PUT', ruta), 'opening «Cambiar» sends nothing').toHaveLength(0);

  // --- Quitar: confirm → DELETE 204 → row back to the base survey. ----------
  await fila.getByTestId(`service-survey-remove-${serviceId}`).click();
  await page.getByTestId('dialogo-confirmar').click();
  await expect(fila.getByTestId('service-surveys-base-only')).toBeVisible();
  await expect(fila.getByTestId(`service-survey-import-${serviceId}`)).toBeVisible();

  const deletes = await atendidas(page, 'DELETE', ruta);
  expect(deletes, 'one DELETE per removal').toHaveLength(1);
  expect(deletes[0]!.status).toBe(204);

  // --- Persistence: reload and it is gone. ----------------------------------
  await page.reload();
  await esperarAplicacionLista(page);
  await expect(page.getByTestId('service-surveys-list')).toBeVisible({ timeout: 30_000 });
  await expect(fila.getByTestId('service-surveys-base-only')).toBeVisible();
  await expect(fila).not.toContainText(titulo);
  await expect(fila.getByTestId(`service-survey-remove-${serviceId}`)).toHaveCount(0);

  // The appointment row is still fixed after every write and reload.
  await expect(cita.getByRole('button', { name: /importar|quitar|cambiar/i })).toHaveCount(0);
});

test('Buzón de solo lectura: las hechas a mano son «anteriores», nada se gestiona', async ({ page }) => {
  await entrar(page, MEDICA);
  await irA(page, '/form-builder');
  await page.getByRole('tab', { name: 'Encuestas', exact: true }).click();
  const list = page.getByTestId('surveys-inbox-list');
  await expect(list).toBeVisible({ timeout: 30_000 });

  // A legacy hand-made survey: readable, labelled as past, never «Activa».
  const legacy = list.locator('li', { hasText: 'Satisfacción con la consulta' });
  await expect(legacy).toContainText('Encuesta anterior (ya no se envía)');
  await expect(legacy.getByRole('link', { name: /Ver las respuestas/ })).toBeVisible();
  // The system base surveys are the ones sent.
  await expect(list.locator('li', { hasText: 'Base del sistema' }).first()).toContainText('Se envía');

  // Nothing manages a survey here.
  await expect(list.getByText(/^(Activa|Borrador|Desactivada)$/)).toHaveCount(0);
  await expect(list.getByRole('link', { name: /^Abrir/ })).toHaveCount(0);
  // The summary's period selector lives above the list; no status filter on the list itself.
  await expect(page.locator('app-surveys-inbox app-view-state-host app-segmented-control')).toHaveCount(0);
  await expect(list).not.toContainText('Encuesta post-cirugía'); // unsent draft: no answers to read
});

test.describe('AC-27-21 · sin scroll horizontal en los tres anchos obligatorios', () => {
  for (const viewport of VIEWPORTS) {
    test(`Buzón, Encuestas por servicio y el catálogo en ${viewport.width}px`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await entrar(page, MEDICA);
      await openServiceSurveys(page);

      const desborda = (): Promise<boolean> =>
        page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

      expect(await desborda(), `«Encuestas por servicio» desborda en ${viewport.width}px`).toBe(false);
      await page.screenshot({
        path: `artifacts/playwright/tarea-27-encuestas/por-servicio-${viewport.nombre}.png`,
        fullPage: true,
      });

      await page.locator('[data-testid^="service-survey-import-"]').first().click();
      await expect(page.getByTestId('standard-catalog-preview')).toBeVisible();
      expect(await desborda(), `el catálogo desborda en ${viewport.width}px`).toBe(false);
      await page.screenshot({
        path: `artifacts/playwright/tarea-27-encuestas/catalogo-${viewport.nombre}.png`,
        fullPage: true,
      });
      await page.getByTestId('standard-catalog-cancel').click();
      await expect(page.getByTestId('standard-catalog')).toHaveCount(0);

      await page.getByRole('tab', { name: 'Buzón', exact: true }).click();
      await expect(page.getByTestId('surveys-inbox-list').or(page.getByTestId('surveys-inbox-empty'))).toBeVisible({
        timeout: 30_000,
      });
      expect(await desborda(), `el Buzón desborda en ${viewport.width}px`).toBe(false);
      await page.screenshot({
        path: `artifacts/playwright/tarea-27-encuestas/buzon-${viewport.nombre}.png`,
        fullPage: true,
      });
    });
  }
});
