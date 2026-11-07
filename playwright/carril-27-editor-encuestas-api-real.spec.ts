import { expect, test, type APIRequestContext } from '@playwright/test';

import { apiViva, contextoDeApi, doctora, urlDeApi } from './support/actores';
import { firstServiceWithoutSurvey, openServiceSurveys, pickFirstCatalogOption, reloadServiceSurveys } from './support/service-surveys';
import { entrar } from './support/sesion';

/**
 * TAREA-27 · «Encuestas por servicio» against a LIVE API: GET/PUT/DELETE
 * `/surveys/service-assignments` with reloads, read from the network.
 *
 * Opt-in, like the other real-API specs:
 *
 *   E2E_API_REAL=1 E2E_API_URL=http://localhost:3000 E2E_BASE_URL=http://localhost:4289 \
 *     yarn pw playwright/carril-27-editor-encuestas-api-real.spec.ts
 *
 * with `yarn start` (not demo) proxied to the API, seeded with
 * `tools/alovida/seed-dev-data.mjs` and a practitioner offering a service.
 * Without the switch it is reported as skipped, never as a pass. The mock run
 * of the same flow is `carril-27-editor-encuestas.spec.ts`.
 */

const API_REAL = process.env['E2E_API_REAL'] === '1';

test.skip(!API_REAL, 'Omitido: hace falta E2E_API_REAL=1 con la API sembrada y el front en modo real. No es un verde.');

test.describe('Encuestas por servicio · API real', () => {
  let api: APIRequestContext | undefined;

  test.beforeAll(async () => {
    const context = await contextoDeApi();
    api = context;
    expect(await apiViva(context), `La API no responde en ${urlDeApi()}. Levántela y siémbrela con \`node tools/alovida/seed-dev-data.mjs\`.`).toBe(true);
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  test('GET/PUT/DELETE service-assignments contra la API, con recarga', async ({ page }) => {
    test.setTimeout(4 * 60_000);
    const listed = page.waitForResponse((r) => r.request().method() === 'GET' && r.url().endsWith('/surveys/service-assignments'));
    await entrar(page, doctora());
    await openServiceSurveys(page);
    expect((await listed).status()).toBe(200);

    const serviceId = await firstServiceWithoutSurvey(page);
    const row = page.getByTestId(`service-survey-${serviceId}`);
    await row.getByTestId(`service-survey-import-${serviceId}`).click();
    const { code, title } = await pickFirstCatalogOption(page);
    const put = page.waitForResponse((r) => r.request().method() === 'PUT' && r.url().endsWith(`/surveys/service-assignments/${serviceId}`));
    await page.getByTestId('standard-catalog-import').click();
    const putResponse = await put;
    expect(putResponse.status()).toBe(200);
    expect(putResponse.request().postDataJSON()).toEqual({ catalogCode: code });
    expect(await putResponse.json()).toMatchObject({ serviceId, assignment: { catalogCode: code } });

    const afterImport = page.waitForResponse((r) => r.request().method() === 'GET' && r.url().endsWith('/surveys/service-assignments'));
    await reloadServiceSurveys(page);
    const persisted = (await (await afterImport).json()) as { services: { serviceId: string; assignment: { catalogCode: string } | null }[] };
    expect(persisted.services.find((s) => s.serviceId === serviceId)?.assignment?.catalogCode).toBe(code);
    await expect(row).toContainText(title);

    const removal = page.waitForResponse((r) => r.request().method() === 'DELETE' && r.url().endsWith(`/surveys/service-assignments/${serviceId}`));
    await row.getByTestId(`service-survey-remove-${serviceId}`).click();
    await page.getByTestId('dialogo-confirmar').click();
    expect((await removal).status()).toBe(204);

    const afterRemove = page.waitForResponse((r) => r.request().method() === 'GET' && r.url().endsWith('/surveys/service-assignments'));
    await reloadServiceSurveys(page);
    const removed = (await (await afterRemove).json()) as { services: { serviceId: string; assignment: unknown }[] };
    expect(removed.services.find((s) => s.serviceId === serviceId)?.assignment ?? null).toBeNull();
    await expect(row.getByTestId('service-surveys-base-only')).toBeVisible();
  });
});
