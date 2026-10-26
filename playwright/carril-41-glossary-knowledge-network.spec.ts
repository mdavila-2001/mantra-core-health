import { expect, test } from '@playwright/test';

import { doctora } from './support/actores';
import { irA } from './support/sesion';
import {
  REAL_API,
  REAL_API_SKIP_REASON,
  openRealSession,
  reloadApp,
  responseOf,
  type RealSession,
} from './support/real-session';

/**
 * Carril 41 · glosario: red de conocimiento, contra la API real.
 *
 * Criterios derivados de `src/app/features/glossary/glossary-network.ts` y su
 * spec Vitest (TAREA-41 F0): sin foco no se pide vecindario; elegir un término
 * central fija `?focus=`; tocar un vecino mueve el foco y deja el recorrido;
 * el foco sobrevive a la recarga porque vive en la dirección.
 *
 * Lo que **no** se puede cubrir: el carril pide «auditoría clínica», pero el
 * front no tiene ninguna acción de auditoría, reporte o corrección de un
 * término (todo el glosario hace sólo `GET`). No hay mutación que probar ni
 * persistencia más allá de la URL.
 *
 *   E2E_API_REAL=1 E2E_API_URL=http://localhost:3005 E2E_BASE_URL=http://localhost:4200 \
 *   corepack yarn pw carril-41-glossary-knowledge-network --workers=1
 */

test.describe.configure({ mode: 'serial' });
test.skip(!REAL_API, REAL_API_SKIP_REASON);

/** Textos con los que se busca un término con relaciones publicadas. */
const CANDIDATE_QUERIES = ['tos', 'neumonía', 'fiebre', 'hipertensión', 'diabetes'] as const;

interface TermWithNeighbors {
  readonly conceptId: string;
  readonly display: string;
  readonly query: string;
}

let session: RealSession;
let term: TermWithNeighbors;

test.beforeAll(async ({ browser }) => {
  session = await openRealSession(browser, doctora());
  term = await findTermWithNeighbors(session);
});

test.afterAll(async () => {
  await session?.close();
});

/**
 * Un término del catálogo real que tenga al menos un vecino.
 *
 * Se descubre por API para no atarse a una siembra concreta: un término sin
 * relaciones dejaría la prueba del clic sobre un vecino sin nada que tocar.
 */
async function findTermWithNeighbors(s: RealSession): Promise<TermWithNeighbors> {
  for (const query of CANDIDATE_QUERIES) {
    const search = await s.api.get('/terminology/concepts', {
      headers: s.authHeaders(),
      params: { lang: 'ES', includeValueSets: 'true', q: query, limit: '10' },
    });
    expect(search.status(), `GET /terminology/concepts?q=${query}`).toBe(200);
    const { items } = (await search.json()) as { items: { conceptId: string; display: string }[] };
    for (const candidate of items) {
      const neighborhood = await s.api.get(
        `/terminology/concepts/${encodeURIComponent(candidate.conceptId)}/glossary-neighborhood`,
        { headers: s.authHeaders(), params: { lang: 'ES', perGroup: '8' } },
      );
      if (!neighborhood.ok()) continue;
      const { groups } = (await neighborhood.json()) as { groups: { items: unknown[] }[] };
      if (groups.some((group) => group.items.length > 0)) {
        return { conceptId: candidate.conceptId, display: candidate.display, query };
      }
    }
  }
  throw new Error(
    `Ningún término de ${CANDIDATE_QUERIES.join(', ')} tiene relaciones publicadas: ` +
      'el catálogo del glosario no está cargado en esta API.',
  );
}

test('busca un término en el glosario y abre su ficha', async () => {
  const { page } = session;
  await irA(page, '/glossary');

  const searchBox = page.getByRole('textbox', { name: 'Buscar un término' });
  await expect(searchBox).toBeVisible();

  // La pantalla ya pidió la lista sin filtro al entrar: se espera la que lleva
  // `q`, que sale después del debounce del buscador.
  const [response] = await Promise.all([
    page.waitForResponse((res) => {
      const url = new URL(res.url());
      return (
        res.request().method() === 'GET' &&
        url.pathname.endsWith('/terminology/concepts') &&
        url.searchParams.get('q') === term.query
      );
    }),
    searchBox.fill(term.query),
  ]);
  expect(response.status()).toBe(200);

  // La búsqueda queda en la dirección: se puede compartir y sobrevive a recargar.
  await expect(page).toHaveURL(new RegExp(`[?&]q=${encodeURIComponent(term.query)}`));
  await expect(page.getByTestId('glosario-conteo')).toBeVisible();

  const termLink = page
    .getByRole('link', { name: new RegExp(`^\\s*${escapeRegExp(term.display)}`) })
    .first();
  await expect(termLink).toBeVisible();
  await termLink.click();
  await expect(page).toHaveURL(new RegExp(`/glossary/${term.conceptId}$`));
  await expect(page.getByRole('link', { name: /Volver al glosario/ })).toBeVisible();
});

test('sin término central el mapa no pide vecindario y lo dice', async () => {
  const { page } = session;
  const neighborhoodRequests: string[] = [];
  const track = (req: { url(): string }): void => {
    if (req.url().includes('/glossary-neighborhood')) neighborhoodRequests.push(req.url());
  };
  page.on('request', track);

  await irA(page, '/glossary');
  await page.getByRole('link', { name: 'Explorar mapa de relaciones' }).click();
  await expect(page).toHaveURL(/\/glossary\/network$/);
  await expect(page.getByText('Elija un término para ver su mapa')).toBeVisible();

  page.off('request', track);
  expect(neighborhoodRequests).toEqual([]);
});

test('elige el término central, navega a un vecino y el foco sobrevive a la recarga', async () => {
  const { page } = session;
  await irA(page, '/glossary/network');

  const central = page.getByRole('combobox', { name: 'Término central' });
  await expect(central).toBeVisible();
  const search = await responseOf(page, 'GET', /\/terminology\/concepts$/, () =>
    central.fill(term.query),
  );
  expect(search.status()).toBe(200);

  const option = page
    .getByRole('listbox', { name: 'Término central' })
    .getByRole('option', { name: new RegExp(`^${escapeRegExp(term.display)}`) })
    .first();
  await expect(option).toBeVisible();

  const neighborhood = await responseOf(
    page,
    'GET',
    new RegExp(`/terminology/concepts/${term.conceptId}/glossary-neighborhood$`),
    () => option.click(),
  );
  expect(neighborhood.status()).toBe(200);
  expect(new URL(neighborhood.url()).searchParams.get('perGroup')).toBe('8');

  await expect(page).toHaveURL(new RegExp(`[?&]focus=${term.conceptId}`));
  await expect(page.locator('#ruta-foco-titulo')).toHaveText(term.display);

  // Un vecino lleva el foco a sí mismo y deja el recorrido con dos pasos.
  const neighbor = page.getByRole('button', { name: /^Ver el mapa de / }).first();
  await expect(neighbor).toBeVisible();
  const neighborName = ((await neighbor.getAttribute('aria-label')) ?? '').replace(
    /^Ver el mapa de /,
    '',
  );
  const next = await responseOf(page, 'GET', /\/glossary-neighborhood$/, () => neighbor.click());
  expect(next.status()).toBe(200);
  const nextFocus = decodeURIComponent(
    new URL(next.url()).pathname.split('/').at(-2) ?? '',
  );

  await expect(page).toHaveURL(new RegExp(`[?&]focus=${escapeRegExp(nextFocus)}`));
  await expect(page.locator('#ruta-foco-titulo')).toHaveText(neighborName);
  const trail = page.getByRole('navigation', { name: 'Términos que ya recorrió' });
  await expect(trail.getByRole('button', { name: term.display })).toBeVisible();
  await expect(trail.locator('[aria-current="true"]')).toHaveText(neighborName);

  // Volver por el recorrido devuelve el foco al término central.
  await trail.getByRole('button', { name: term.display }).click();
  await expect(page).toHaveURL(new RegExp(`[?&]focus=${term.conceptId}`));
  await expect(page.locator('#ruta-foco-titulo')).toHaveText(term.display);

  // Recarga: el foco vive en la dirección, así que la API lo vuelve a servir.
  const [afterReload] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.request().method() === 'GET' &&
        new URL(res.url()).pathname.endsWith(`/${term.conceptId}/glossary-neighborhood`),
      { timeout: 30_000 },
    ),
    reloadApp(page),
  ]);
  expect(afterReload.status()).toBe(200);
  await expect(page.locator('#ruta-foco-titulo')).toHaveText(term.display);

  await page.getByRole('link', { name: 'Abrir la ficha completa' }).click();
  await expect(page).toHaveURL(new RegExp(`/glossary/${term.conceptId}$`));
});

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
