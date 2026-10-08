import { mkdir, readFile } from 'node:fs/promises';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

import { esperarAplicacionLista, irA } from './support/sesion';

/**
 * H2.S3.M11: catálogo seed de la demo explícita, sin interceptar la red.
 * Ejecutar sobre start:demo con Chromium, --workers=1 --retries=0.
 * El seed versionado no contiene la ficha CIMA del recorrido original;
 * esta suite no acredita ese corpus ni la API real. El 404 de un concepto
 * inexistente lo produce el interceptor de demo, no una respuesta de red.
 */
const SEED = '/glossary-seed/';
const FULL_MANIFEST = '/glossary-data/manifest.json';
const TERM_ID = '565cf058-754c-4fa6-aa8d-aa4e20727a5e';
const MISSING_ID = '00000000-0000-4000-8000-000000000000';
const EMPTY_QUERY = 'hipertensionhito2sincoincidencias';
const EVIDENCE = 'artifacts/playwright/hito2';

interface SeedManifest {
  source: string;
  total: number;
  pageSize: number;
  categories: { key: string; internalCode: string; count: number; pages: number }[];
}

interface SeedTerm {
  id: string;
  esName: string;
  definition: string;
  plainSummaryEs: string;
  source: string;
  relations: { targetId: string; targetName: string }[];
}

interface AssetResponse {
  path: string;
  status: number;
  contentType: string;
}

function pathOf(url: string): string {
  return new URL(url, 'http://local.invalid').pathname;
}

function observeBrowser(page: Page) {
  const requests: string[] = [];
  const responses: AssetResponse[] = [];
  const errors: string[] = [];
  const expectedConsoleErrors: string[] = [];
  page.on('request', (request) => requests.push(pathOf(request.url())));
  page.on('response', (response) => {
    const path = pathOf(response.url());
    if (path.startsWith(SEED) || path.startsWith('/glossary-data/')) {
      responses.push({ path, status: response.status(), contentType: response.headers()['content-type'] ?? '' });
    }
    if (response.status() >= 400 && !(path === FULL_MANIFEST && response.status() === 404)) {
      errors.push('HTTP ' + response.status() + ': ' + path);
    }
  });
  page.on('requestfailed', (request) => {
    errors.push('Red: ' + pathOf(request.url()) + ' ' + request.failure()?.errorText);
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const path = pathOf(message.location().url);
    if (path === FULL_MANIFEST && /\b404\b/.test(message.text())) {
      expectedConsoleErrors.push(message.text());
    } else {
      errors.push(message.text());
    }
  });
  return { requests, responses, errors, expectedConsoleErrors };
}

async function signInDemo(page: Page): Promise<void> {
  await page.goto('/auth');
  await esperarAplicacionLista(page);
  await expect(page.getByRole('complementary', { name: 'Modo de demostración' })).toBeVisible();
  await page.getByTestId('login-identifier').fill('medica@alovida.mock');
  await page.getByTestId('login-password').fill('mock');
  await expect(page.getByTestId('login-identifier')).toHaveValue('medica@alovida.mock');
  await page.getByTestId('login-submit').click();
  await page.waitForURL(/\/(dashboard|auth\/organization)/);
  if (page.url().includes('/auth/organization')) {
    await page.getByTestId('tenant-opcion').first().click();
    await page.waitForURL(/\/dashboard/);
  }
  await esperarAplicacionLista(page);
}

async function capture(page: Page, name: string, width: number, info: TestInfo): Promise<void> {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth),
    name + ': sin desborde horizontal',
  ).toBe(false);
  await mkdir(EVIDENCE, { recursive: true });
  const path = EVIDENCE + '/glossary-seed-' + name + '-' + width + '.png';
  await page.screenshot({ path, fullPage: true });
  await info.attach('glossary-seed-' + name + '-' + width, { path, contentType: 'image/png' });
}

function expectOnDemandAssets(browser: ReturnType<typeof observeBrowser>, manifest: SeedManifest): void {
  const shards = new Set(browser.responses.filter((response) => response.path.startsWith(SEED + 'shards/'))
    .map((response) => response.path));
  const totalShards = manifest.categories.reduce((sum, category) => sum + category.pages, 0);
  expect(shards.size, 'hay descargas positivas de shards').toBeGreaterThan(0);
  expect(shards.size, 'no se descarga el corpus completo').toBeLessThan(totalShards);
  expect(browser.requests.filter((path) => /glosario\.generated|fixtures\/anatomia/.test(path))).toEqual([]);

  const fallback = browser.responses.filter((response) => response.path === FULL_MANIFEST);
  expect(fallback.length, 'se observa el intento de catálogo completo ausente').toBeGreaterThan(0);
  for (const response of fallback) {
    // leerConFetch trata también el fallback HTML 200 de ng serve como archivo ausente.
    expect(response.status === 404 || (response.status === 200 && !response.contentType.includes('json'))).toBe(true);
  }
  for (const response of browser.responses.filter((asset) => asset.path.startsWith(SEED))) {
    expect(response.status, response.path).toBe(200);
    expect(response.contentType, response.path).toContain('json');
  }
}

async function expectTerm(page: Page, term: SeedTerm): Promise<void> {
  await expect(page.getByRole('heading', { name: term.esName, exact: true })).toBeVisible();
  await expect(page.locator('.termino__intro .termino__definicion')).toHaveText(term.plainSummaryEs);
  await expect(page.locator('.termino__verbatim')).toHaveText(term.definition);
}

test.describe('Hito 2 · glosario seed bajo demanda · solo demo', () => {
  test.describe.configure({ retries: 0 });

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    test('búsqueda, detalle, recarga, vacío e ID inexistente a ' + viewport.width + ' px', async ({ page }, info) => {
      const manifest: SeedManifest = JSON.parse(await readFile('public/glossary-seed/manifest.json', 'utf8'));
      const rows: SeedTerm[] = JSON.parse(await readFile('public/glossary-seed/shards/disease/page-1.json', 'utf8'));
      const term = rows.find((row) => row.id === TERM_ID)!;
      expect(term, 'el término elegido existe en el seed versionado').toBeDefined();
      expect(term.source).toBe('alovida-curated');
      expect(term.relations).toHaveLength(4);
      const disease = manifest.categories.find((category) => category.key === 'disease')!;
      const browser = observeBrowser(page);
      await page.setViewportSize(viewport);

      try {
        await signInDemo(page);
        expect(browser.requests.filter((path) => /^\/glossary-(seed|data)\//.test(path)),
          'el ingreso y panel no descargan el glosario').toEqual([]);

        const manifestLoaded = page.waitForResponse((response) => pathOf(response.url()) === SEED + 'manifest.json');
        await irA(page, '/glossary');
        const servedManifest = await (await manifestLoaded).json();
        expect(servedManifest).toMatchObject({ source: 'seed', total: manifest.total, pageSize: manifest.pageSize });
        expect(servedManifest.categories).toEqual(manifest.categories);
        await expect(page.locator('.glosario__tarjeta')).toHaveCount(manifest.categories.length);
        await expect(page.locator('.glosario__entrada')).toHaveCount(12);
        await expect(page.locator('.pagination__range')).toHaveText('1–12 de ' + manifest.total);
        expectOnDemandAssets(browser, manifest);
        await capture(page, 'categories', viewport.width, info);

        await page.locator('.glosario__tarjeta').filter({ hasText: 'Enfermedades' }).click();
        await expect(page).toHaveURL(new RegExp('category=' + disease.internalCode));
        await expect(page.locator('.pagination__range')).toHaveText('1–12 de ' + disease.count);
        await expect(page.getByRole('button', { name: 'Página anterior', exact: true })).toBeDisabled();
        const firstEntry = await page.locator('.glosario__entrada-enlace').first().textContent();
        await page.getByRole('button', { name: 'Página siguiente', exact: true }).click();
        await expect(page.locator('.pagination__range')).toHaveText('13–24 de ' + disease.count);
        await expect(page.locator('.glosario__entrada-enlace').first()).not.toHaveText(firstEntry!);
        await expect(page.getByRole('button', { name: 'Página 2', exact: true })).toHaveAttribute('aria-current', 'page');
        await expect(page.locator('.glosario__entrada')).toHaveCount(12);
        await capture(page, 'pagination', viewport.width, info);

        await page.getByRole('textbox', { name: 'Buscar un término', exact: true }).fill(term.esName);
        const result = page.locator('.glosario__cuerpo').getByRole('link', { name: term.esName, exact: true });
        await expect(result).toHaveCount(1);
        await expect(result).toHaveAttribute('href', '/glossary/' + TERM_ID);
        expect(browser.responses.some((response) => response.path === SEED + 'mock/search/hi.json')).toBe(true);
        await result.click();
        await expect(page).toHaveURL(new RegExp('/glossary/' + TERM_ID + '$'));
        await expectTerm(page, term);
        expect(browser.responses.some((response) => response.path === SEED + 'mock/ids/56.json')).toBe(true);
        await capture(page, 'detail', viewport.width, info);

        await page.getByRole('tab', { name: 'Relacionados', exact: true }).click();
        await expect(page.locator('.termino__relaciones a')).toHaveCount(term.relations.length);
        for (const relation of term.relations) {
          await expect(page.locator('.termino__relaciones').getByRole('link', { name: relation.targetName, exact: true }))
            .toHaveAttribute('href', '/glossary/' + relation.targetId);
        }
        await page.getByRole('tab', { name: 'Fuente y código', exact: true }).click();
        await expect(page.getByTestId('termino-fuente')).toContainText('Equipo AloVida');

        await page.reload();
        await esperarAplicacionLista(page);
        await expectTerm(page, term);
        await expect(page).toHaveURL(new RegExp('/glossary/' + TERM_ID + '$'));
        await page.getByRole('link', { name: '← Volver al glosario', exact: true }).click();
        await expect(page.locator('.glosario__entrada')).toHaveCount(12);

        // La cubeta hi existe: este límite no necesita fabricar un fallo de red.
        await page.getByRole('textbox', { name: 'Buscar un término', exact: true }).fill(EMPTY_QUERY);
        await expect(page.locator('.glosario__cuerpo app-empty-state')).toContainText(
          'Ningún término coincide con «' + EMPTY_QUERY + '».',
        );
        await expect(page.locator('.glosario__entrada')).toHaveCount(0);
        await expect(page.locator('.glosario__paginacion')).toHaveCount(0);
        await capture(page, 'empty', viewport.width, info);
        await page.getByRole('button', { name: 'Limpiar búsqueda', exact: true }).click();
        await expect(page.getByRole('textbox', { name: 'Buscar un término', exact: true })).toHaveValue('');
        await expect(page.locator('.glosario__entrada')).toHaveCount(12);
        await expect(page.locator('.pagination__range')).toHaveText('1–12 de ' + manifest.total);

        await irA(page, '/glossary/' + MISSING_ID);
        const missing = page.locator('.termino app-empty-state');
        await expect(missing).toHaveAttribute('role', 'status');
        await expect(missing).toHaveAttribute('aria-live', 'polite');
        await expect(missing).toContainText('No encontramos lo que busca');
        await expect(missing).toContainText('Verifique la dirección o vuelva al listado.');
        await expect(page.locator('.termino__tarjeta')).toHaveCount(0);
        expect(browser.responses.some((response) => response.path === SEED + 'mock/ids/00.json')).toBe(true);
        await capture(page, 'missing', viewport.width, info);
        await page.getByRole('link', { name: '← Volver al glosario', exact: true }).click();
        await expect(page.locator('.glosario__entrada')).toHaveCount(12);
        expectOnDemandAssets(browser, manifest);
        expect(browser.errors, 'sin errores inesperados de consola o red').toEqual([]);
      } finally {
        await info.attach('glossary-seed-network-' + viewport.width, {
          body: Buffer.from(JSON.stringify(browser, null, 2)),
          contentType: 'application/json',
        });
      }
    });
  }
});
