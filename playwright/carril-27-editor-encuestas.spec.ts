import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { firstServiceWithoutSurvey, openServiceSurveys, pickFirstCatalogOption, reloadServiceSurveys } from './support/service-surveys';
import { entrar, irA } from './support/sesion';

/**
 * TAREA-27 · the practitioner's «Encuestas» after standard surveys per service
 * (06/11/2026). Free creation («Nueva encuesta») is gone: a practitioner only
 * attaches a standard catalog survey to each of their services.
 *
 * Against `yarn start:demo` (mock backend), the mock practitioner. The mock
 * answers inside the browser, so requests/responses come from
 * `window.__mockRequests`. The same flow against a live API lives in
 * `carril-27-editor-encuestas-api-real.spec.ts` (opt-in, `E2E_API_REAL=1`).
 *
 * Proves UI → request → response → persistence → reload → UI for both writes
 * («Importar» = PUT, «Quitar» = DELETE), that the fixed «Cita médica» row offers
 * neither, that a legacy hand-made attachment (catalogCode null) is NOT the
 * service's survey, and that the imported survey is «Se envía» in the Buzón with
 * its answers reachable. Waits on elements, never on network quiescence.
 */

const MOCK_DOCTOR: Actor = { rol: 'doctora', identificador: 'medica@alovida.mock', clave: 'mock', nombre: 'Médica' };

/** The three widths required by the TAREA-27 sheet. */
const VIEWPORTS = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

interface ServedRequest {
  readonly method: string;
  readonly url: string;
  readonly status: number;
  readonly body: unknown;
  readonly respuesta?: unknown;
}

/** What the mock served, from `window.__mockRequests`. */
async function served(page: Page, method: string, prefix: string): Promise<readonly ServedRequest[]> {
  const all = await page.evaluate(() => (window as unknown as { __mockRequests?: ServedRequest[] }).__mockRequests ?? []);
  return all.filter((r) => r.method === method && r.url.startsWith(prefix));
}

test.describe('Encuestas por servicio · backend simulado', () => {
  test('importar y quitar persisten tras recargar; la cita médica es fija; lo importado se lee en el Buzón', async ({ page }) => {
    test.setTimeout(4 * 60_000);
    await entrar(page, MOCK_DOCTOR);
    await openServiceSurveys(page);

    // Free creation is gone from both sub-tabs.
    await expect(page.getByTestId('encuestas-nueva')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /nueva encuesta/i })).toHaveCount(0);

    // --- Fixed «Cita médica» row: system survey, only «Ver preguntas». ------
    const appointment = page.getByTestId('service-surveys-appointment');
    await expect(appointment).toContainText('Cita médica');
    await expect(appointment).toContainText('Del sistema');
    await expect(appointment.getByRole('button', { name: /importar|quitar|cambiar/i })).toHaveCount(0);
    await expect(appointment.getByTestId('service-surveys-appointment-view')).toBeVisible();

    // --- Legacy hand-made attachment (catalogCode null): not the service's survey.
    const legacyRow = page.locator('li[data-testid^="service-survey-"]', { hasText: 'Teleconsulta cardiológica' });
    await expect(legacyRow.getByTestId('service-surveys-base-only')).toBeVisible();
    await expect(legacyRow).not.toContainText('Experiencia de teleconsulta');
    await expect(legacyRow).not.toContainText('Estándar');
    await expect(legacyRow).not.toContainText('Importada el');
    await expect(legacyRow.getByRole('button', { name: /^Importar una encuesta/ })).toBeVisible();

    // --- Importar: UI → PUT → response → row. -------------------------------
    const serviceId = await firstServiceWithoutSurvey(page);
    const row = page.getByTestId(`service-survey-${serviceId}`);
    await expect(row.getByTestId('service-surveys-base-only')).toBeVisible();
    await row.getByTestId(`service-survey-import-${serviceId}`).click();
    const { code, title } = await pickFirstCatalogOption(page);
    await page.getByTestId('standard-catalog-import').click();
    await expect(page.getByTestId('standard-catalog')).toHaveCount(0);
    await expect(row).toContainText(title);
    await expect(row.getByText('Estándar')).toBeVisible();

    const path = `/surveys/service-assignments/${serviceId}`;
    const puts = await served(page, 'PUT', path);
    expect(puts, 'one PUT per import').toHaveLength(1);
    expect(puts[0]!.status).toBe(200);
    expect(puts[0]!.body).toEqual({ catalogCode: code });
    expect(puts[0]!.respuesta).toMatchObject({ serviceId, assignment: { catalogCode: code, title } });

    // --- Persistence: reload and the import is still there. -----------------
    await reloadServiceSurveys(page);
    await expect(row).toContainText(title);
    await expect(row.getByTestId(`service-survey-remove-${serviceId}`)).toBeVisible();
    await expect(row.getByTestId(`service-survey-import-${serviceId}`)).toHaveCount(0);
    const reread = await served(page, 'GET', '/surveys/service-assignments');
    expect(reread.at(-1)?.respuesta).toMatchObject({ services: expect.arrayContaining([expect.objectContaining({ serviceId, assignment: expect.objectContaining({ catalogCode: code }) })]) });

    // --- «Cambiar» opens on the survey in use and does not offer re-importing it.
    await row.getByTestId(`service-survey-change-${serviceId}`).click();
    const inUse = page.getByTestId(`standard-catalog-option-${code}`);
    await expect(inUse).toHaveAttribute('aria-checked', 'true');
    await expect(inUse).toContainText('En uso');
    await expect(page.getByTestId('standard-catalog-import')).toHaveAttribute('aria-disabled', 'true');
    await page.getByTestId('standard-catalog-cancel').click();
    await expect(page.getByTestId('standard-catalog')).toHaveCount(0);
    expect(await served(page, 'PUT', path), 'opening «Cambiar» sends nothing').toHaveLength(0);

    // --- The Buzón: the imported survey is «Se envía» and its answers open. --
    await page.getByRole('tab', { name: 'Buzón', exact: true }).click();
    const imported = page.getByTestId('surveys-inbox-list').locator('li', { hasText: title });
    await expect(imported).toContainText('Se envía', { timeout: 30_000 });
    await imported.getByRole('link', { name: `Ver las respuestas de ${title}` }).click();
    await expect(page.getByTestId('survey-detail-sending')).toHaveText('Se envía', { timeout: 30_000 });
    // Just imported: no answers yet, said as S3 in the answers tab.
    await expect(page.getByTestId('survey-detail-answers')).toContainText('Todavía no respondió nadie');
    await page.goBack();
    await page.getByRole('tab', { name: 'Encuestas por servicio', exact: true }).click();
    await expect(page.getByTestId('service-surveys-list')).toBeVisible({ timeout: 30_000 });

    // --- Quitar: confirm → DELETE 204 → row back to the base survey. --------
    await row.getByTestId(`service-survey-remove-${serviceId}`).click();
    await page.getByTestId('dialogo-confirmar').click();
    await expect(row.getByTestId('service-surveys-base-only')).toBeVisible();
    const deletes = await served(page, 'DELETE', path);
    expect(deletes, 'one DELETE per removal').toHaveLength(1);
    expect(deletes[0]!.status).toBe(204);

    // --- Persistence: reload and it is gone. --------------------------------
    await reloadServiceSurveys(page);
    await expect(row.getByTestId('service-surveys-base-only')).toBeVisible();
    await expect(row).not.toContainText(title);
    await expect(row.getByTestId(`service-survey-remove-${serviceId}`)).toHaveCount(0);
    await expect(appointment.getByRole('button', { name: /importar|quitar|cambiar/i })).toHaveCount(0);
  });

  test('Buzón de solo lectura: las hechas a mano son «anteriores», nada se gestiona', async ({ page }) => {
    await entrar(page, MOCK_DOCTOR);
    await irA(page, '/form-builder');
    await page.getByRole('tab', { name: 'Encuestas', exact: true }).click();
    const list = page.getByTestId('surveys-inbox-list');
    await expect(list).toBeVisible({ timeout: 30_000 });

    // Hand-made surveys, even one still linked to a service (teleconsultation): past, readable.
    for (const legacyTitle of ['Satisfacción con la consulta', 'Experiencia de teleconsulta']) {
      const legacy = list.locator('li', { hasText: legacyTitle });
      await expect(legacy).toContainText('Encuesta anterior (ya no se envía)');
      await expect(legacy.getByRole('link', { name: /Ver las respuestas/ })).toBeVisible();
    }
    await expect(list.locator('li', { hasText: 'Base del sistema' }).first()).toContainText('Se envía');
    // The template imported for the echo (seeded) is sent.
    await expect(list.locator('li', { hasText: 'Estudios por imágenes' })).toContainText('Se envía');

    await expect(list.getByText(/^(Activa|Borrador|Desactivada)$/)).toHaveCount(0);
    await expect(list.getByRole('link', { name: /^Abrir/ })).toHaveCount(0);
    await expect(page.locator('app-surveys-inbox app-view-state-host app-segmented-control')).toHaveCount(0);
    await expect(list).not.toContainText('Encuesta post-cirugía'); // unsent draft: no answers to read
  });

  test('ficha de una encuesta anterior en 390 px: el estado no pisa el dato de al lado ni el de abajo', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await entrar(page, MOCK_DOCTOR);
    await irA(page, '/form-builder');
    await page.getByRole('tab', { name: 'Encuestas', exact: true }).click();
    const legacy = page.getByTestId('surveys-inbox-list').locator('li', { hasText: 'Experiencia de teleconsulta' });
    await legacy.getByRole('link', { name: /Ver las respuestas/ }).click();
    const badge = page.getByTestId('survey-detail-sending');
    await expect(badge).toHaveText('Encuesta anterior (ya no se envía)', { timeout: 30_000 });

    // Every other metadata value: the badge's box must not intersect any of them.
    const facts = page.getByTestId('survey-detail-facts');
    const own = (await badge.boundingBox())!;
    for (const value of await facts.locator('dd').all()) {
      if ((await value.getByTestId('survey-detail-sending').count()) > 0) continue;
      const other = (await value.boundingBox())!;
      const intersects = own.x < other.x + other.width && other.x < own.x + own.width && own.y < other.y + other.height && other.y < own.y + own.height;
      expect(intersects, `the badge overlaps «${(await value.textContent())?.trim()}»`).toBe(false);
    }
    const factsBox = (await facts.boundingBox())!;
    expect(own.x + own.width, 'the badge stays inside the metadata grid').toBeLessThanOrEqual(factsBox.x + factsBox.width + 0.5);
  });

  test.describe('AC-27-21 · sin scroll horizontal en los tres anchos obligatorios', () => {
    for (const viewport of VIEWPORTS) {
      test(`Buzón, Encuestas por servicio y el catálogo en ${viewport.width}px`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await entrar(page, MOCK_DOCTOR);
        await openServiceSurveys(page);

        const overflows = (): Promise<boolean> =>
          page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

        expect(await overflows(), `«Encuestas por servicio» desborda en ${viewport.width}px`).toBe(false);
        await page.screenshot({ path: `artifacts/playwright/tarea-27-encuestas/per-service-${viewport.name}.png` });

        await page.locator('[data-testid^="service-survey-import-"]').first().click();
        await expect(page.getByTestId('standard-catalog-preview')).toBeVisible();
        expect(await overflows(), `el catálogo desborda en ${viewport.width}px`).toBe(false);
        await page.screenshot({ path: `artifacts/playwright/tarea-27-encuestas/catalog-${viewport.name}.png` });
        await page.getByTestId('standard-catalog-cancel').click();
        await expect(page.getByTestId('standard-catalog')).toHaveCount(0);

        await page.getByRole('tab', { name: 'Buzón', exact: true }).click();
        await expect(page.getByTestId('surveys-inbox-list').or(page.getByTestId('surveys-inbox-empty'))).toBeVisible({ timeout: 30_000 });
        expect(await overflows(), `el Buzón desborda en ${viewport.width}px`).toBe(false);
        await page.screenshot({ path: `artifacts/playwright/tarea-27-encuestas/inbox-${viewport.name}.png` });
      });
    }
  });
});
