import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Page } from '@playwright/test';

import type { Actor } from './support/actores';
import { entrar, irA } from './support/sesion';

/**
 * Carril 18 — corrección del flujo de directorios, en la maqueta (`mockup`).
 *
 * - REQ-18-001: la portada `/directories` muestra un nodo por directorio, con
 *   lo que hay en cada uno.
 * - REQ-18-002: el directorio de médicos entra por una grilla de especialidades
 *   y el clic despliega la lista de doctores de esa especialidad.
 * - REQ-18-006: nodo → categoría → lista → perfil, y la vuelta.
 */
const OUTPUT_DIR = join('docs', 'trabajo', '2026-10-24-carril-18-directorios', 'evidencia');
const PATIENT: Actor = {
  rol: 'paciente',
  identificador: 'paciente@alovida.mock',
  clave: 'mock',
  nombre: 'Paciente',
};

test.beforeEach(() => {
  test.setTimeout(240_000);
  mkdirSync(OUTPUT_DIR, { recursive: true });
});

/** Errores de la página y respuestas 4xx/5xx que provoca el flujo. */
function watchFailures(page: Page): { errors: string[]; failedResponses: string[] } {
  const errors: string[] = [];
  const failedResponses: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  return { errors, failedResponses };
}

for (const width of [1440, 390]) {
  test(`REQ-18-001/002/006 nodo → especialidad → lista → perfil a ${width} px`, async ({
    page,
  }) => {
    const watched = watchFailures(page);
    await page.setViewportSize({ width: width, height: width > 800 ? 1000 : 844 });

    await entrar(page, PATIENT);

    // REQ-18-001 · la portada con un nodo por directorio.
    await irA(page, '/directories');
    const nodes = page.locator('.directories__card');
    await expect(nodes.first()).toBeVisible({ timeout: 30_000 });
    expect(await nodes.count()).toBeGreaterThan(1);
    const practitionersNode = page.locator('li[data-path="directory"] a');
    await expect(practitionersNode).toBeVisible();
    // Cada nodo dice qué hay adentro: nombre accesible = rótulo + descripción.
    expect((await practitionersNode.getAttribute('aria-label')) ?? '').toMatch(/\. .+/u);
    await page.screenshot({ path: join(OUTPUT_DIR, `${width}-1-portada-directorios.png`) });

    // REQ-18-002 · el nodo de médicos abre la grilla de especialidades.
    await practitionersNode.click();
    await expect(page).toHaveURL(/\/directory(\?|$)/u);
    const grid = page.getByTestId('portada-especialidades');
    await expect(grid).toBeVisible({ timeout: 30_000 });
    const cards = grid.locator('a.rejilla__tarjeta');
    expect(await cards.count()).toBeGreaterThan(2);
    await expect(cards.first()).toHaveAccessibleName(/^Todos los médicos, \d+ médicos?$/u);
    await page.screenshot({ path: join(OUTPUT_DIR, `${width}-2-grilla-especialidades.png`) });

    // Teclado: la tarjeta se alcanza y se abre sin ratón.
    const specialty = cards.nth(1);
    const name = (await specialty.locator('.rejilla__nombre').innerText()).trim();
    await specialty.focus();
    await expect(specialty).toBeFocused();
    await page.keyboard.press('Enter');

    // … y el clic despliega la lista de doctores de esa especialidad.
    await expect(page).toHaveURL(/[?&]especialidad=/u);
    await expect(grid).toBeHidden();
    await expect(page.getByText(name).filter({ visible: true }).first()).toBeVisible();
    const backLink = page.getByTestId('volver-a-especialidades');
    await expect(backLink).toBeVisible();
    const profileLinks = page.locator('a[href^="/directory/"]');
    await expect(profileLinks.first()).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: join(OUTPUT_DIR, `${width}-3-lista-de-la-especialidad.png`) });

    // Recargar reproduce la misma lista: la especialidad vive en la URL.
    const listUrl = page.url();
    await page.reload();
    await expect(page.locator('a[href^="/directory/"]').first()).toBeVisible({ timeout: 30_000 });
    expect(page.url()).toBe(listUrl);

    // REQ-18-006 · lista → perfil.
    await page.locator('a[href^="/directory/"]').first().click();
    await expect(page).toHaveURL(/\/directory\/[^/?#]+/u);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: join(OUTPUT_DIR, `${width}-4-perfil.png`) });

    // Y la vuelta a la grilla desde la lista.
    await page.goBack();
    await expect(page.getByTestId('volver-a-especialidades')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('volver-a-especialidades').click();
    await expect(page.getByTestId('portada-especialidades')).toBeVisible();

    // Desde la grilla, escribir un nombre salta directo a la lista.
    await page.getByRole('textbox', { name: 'Buscar por nombre o especialidad' }).fill('zzzz-nadie');
    await expect(page.getByTestId('portada-especialidades')).toBeHidden({ timeout: 30_000 });
    await expect(page.getByText(/Ningún médico coincide con «zzzz-nadie»/u)).toBeVisible();
    await page.screenshot({ path: join(OUTPUT_DIR, `${width}-5-sin-coincidencias.png`) });

    expect(watched.errors).toEqual([]);
    expect(watched.failedResponses).toEqual([]);
  });
}

/** El número de «1–24 de 500 clínicas encontradas» o de «500 centros». */
async function totalIn(page: Page, pattern: RegExp): Promise<number> {
  const text = page.getByText(pattern).first();
  await expect(text).toBeVisible({ timeout: 30_000 });
  return Number((pattern.exec(await text.innerText()) ?? [])[1]);
}

/**
 * REQ-18-003/004 · el directorio de clínicas con sesión usa la misma lógica que
 * la red social: con el mismo corte de categoría encuentra exactamente los
 * mismos centros que `/search/hospitals`, y su ficha no sale del panel.
 */
test('REQ-18-003/004 clínicas con sesión = hospitales de la red social, ficha dentro del panel', async ({
  page,
}) => {
  const watched = watchFailures(page);
  await page.setViewportSize({ width: 1440, height: 1000 });

  // Sin sesión: la red social.
  await page.goto('/search/hospitals');
  const publicTotal = await totalIn(page, /^(\d+) centros?/u);
  await page
    .getByTestId('hospitales-chip-categoria')
    .filter({ hasText: 'Hospital público' })
    .click();
  await expect(page).toHaveURL(/[?&]categoria=/u);
  const categoryCode = new URL(page.url()).searchParams.get('categoria');
  const publicInCategory = await totalIn(page, /^(\d+) centros?/u);
  expect(publicInCategory).toBeLessThan(publicTotal);
  expect(await page.locator('main a[href^="/o/"]').count()).toBeGreaterThan(0);

  // Con sesión: el mismo corte, el mismo número.
  await entrar(page, PATIENT);
  await irA(page, '/clinics-directory');
  // «1–24 de 500 clínicas encontradas», o «19 clínicas encontradas» si caben.
  expect(await totalIn(page, /(\d+) clínicas? encontradas?/u)).toBe(publicTotal);
  await irA(page, `/clinics-directory?categoria=${categoryCode}`);
  expect(await totalIn(page, /(\d+) clínicas? encontradas?/u)).toBe(publicInCategory);
  await page.screenshot({ path: join(OUTPUT_DIR, '1440-6-clinicas-con-sesion.png') });

  // La ficha cuelga del panel, no de la ficha anónima de la red social.
  expect(await page.locator('main a[href^="/o/"]').count()).toBe(0);
  const profileLink = page.locator('main a[href^="/clinics-directory/"]').first();
  await profileLink.click();
  await expect(page).toHaveURL(/\/clinics-directory\/[^/?#]+/u);

  expect(watched.errors).toEqual([]);
  expect(watched.failedResponses).toEqual([]);
});

/**
 * REQ-18-005 · permisos y datos visibles. Sin sesión se ve la red social y los
 * directorios del panel piden entrar; con sesión, cada rol ve sólo sus nodos.
 */
test('REQ-18-005 sin sesión la red social, con sesión el panel; cada rol ve sus directorios', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });

  // Sin sesión: lo público se ve…
  await page.goto('/search/practitioners');
  await expect(page.getByRole('heading', { name: 'Profesionales de salud' })).toBeVisible({
    timeout: 30_000,
  });
  // … sin los datos del panel: no ofrece la agenda del médico.
  await expect(page.getByText('Revisar disponibilidad')).toHaveCount(0);

  // … y el panel pide entrar, en cada directorio.
  for (const route of ['/directories', '/directory', '/clinics-directory', '/pharmacies-directory']) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/auth/u, { timeout: 30_000 });
  }

  // Paciente: ve la guía de médicos, con la agenda de cada uno.
  await entrar(page, PATIENT);
  await irA(page, '/directories');
  await expect(page.locator('li[data-path="directory"]')).toBeVisible({ timeout: 30_000 });
  await irA(page, '/directory?especialidad=todos');
  await expect(page.getByText('Revisar disponibilidad').first()).toBeVisible({ timeout: 30_000 });

  // Administrador: la guía de médicos no es suya, su nodo no aparece.
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await entrar(page, {
    rol: 'administrador',
    identificador: 'admin@alovida.mock',
    clave: 'mock',
    nombre: 'Admin',
  });
  await irA(page, '/directories');
  await expect(page.locator('.directories__card').first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('li[data-path="directory"]')).toHaveCount(0);
  await page.screenshot({ path: join(OUTPUT_DIR, '1440-7-directorios-del-administrador.png') });
});
