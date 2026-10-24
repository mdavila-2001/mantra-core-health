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
const SALIDA = join('docs', 'trabajo', '2026-10-24-carril-18-directorios', 'evidencia');
const PACIENTE: Actor = {
  rol: 'paciente',
  identificador: 'paciente@alovida.mock',
  clave: 'mock',
  nombre: 'Paciente',
};

test.beforeEach(() => {
  test.setTimeout(240_000);
  mkdirSync(SALIDA, { recursive: true });
});

/** Errores de la página y respuestas 4xx/5xx que provoca el flujo. */
function vigilar(page: Page): { errores: string[]; fallidas: string[] } {
  const errores: string[] = [];
  const fallidas: string[] = [];
  page.on('pageerror', (error) => errores.push(error.message));
  page.on('response', (respuesta) => {
    if (respuesta.status() >= 400) fallidas.push(`${respuesta.status()} ${respuesta.url()}`);
  });
  return { errores, fallidas };
}

for (const ancho of [1440, 390]) {
  test(`REQ-18-001/002/006 nodo → especialidad → lista → perfil a ${ancho} px`, async ({
    page,
  }) => {
    const vigilancia = vigilar(page);
    await page.setViewportSize({ width: ancho, height: ancho > 800 ? 1000 : 844 });

    await entrar(page, PACIENTE);

    // REQ-18-001 · la portada con un nodo por directorio.
    await irA(page, '/directories');
    const nodos = page.locator('.directories__card');
    await expect(nodos.first()).toBeVisible({ timeout: 30_000 });
    expect(await nodos.count()).toBeGreaterThan(1);
    const nodoMedicos = page.locator('li[data-path="directory"] a');
    await expect(nodoMedicos).toBeVisible();
    // Cada nodo dice qué hay adentro: nombre accesible = rótulo + descripción.
    expect((await nodoMedicos.getAttribute('aria-label')) ?? '').toMatch(/\. .+/u);
    await page.screenshot({ path: join(SALIDA, `${ancho}-1-portada-directorios.png`) });

    // REQ-18-002 · el nodo de médicos abre la grilla de especialidades.
    await nodoMedicos.click();
    await expect(page).toHaveURL(/\/directory(\?|$)/u);
    const grilla = page.getByTestId('portada-especialidades');
    await expect(grilla).toBeVisible({ timeout: 30_000 });
    const tarjetas = grilla.locator('a.rejilla__tarjeta');
    expect(await tarjetas.count()).toBeGreaterThan(2);
    await expect(tarjetas.first()).toHaveAccessibleName(/^Todos los médicos, \d+ médicos?$/u);
    await page.screenshot({ path: join(SALIDA, `${ancho}-2-grilla-especialidades.png`) });

    // Teclado: la tarjeta se alcanza y se abre sin ratón.
    const especialidad = tarjetas.nth(1);
    const nombre = (await especialidad.locator('.rejilla__nombre').innerText()).trim();
    await especialidad.focus();
    await expect(especialidad).toBeFocused();
    await page.keyboard.press('Enter');

    // … y el clic despliega la lista de doctores de esa especialidad.
    await expect(page).toHaveURL(/[?&]especialidad=/u);
    await expect(grilla).toBeHidden();
    await expect(page.getByText(nombre).filter({ visible: true }).first()).toBeVisible();
    const volver = page.getByTestId('volver-a-especialidades');
    await expect(volver).toBeVisible();
    const fichas = page.locator('a[href^="/directory/"]');
    await expect(fichas.first()).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: join(SALIDA, `${ancho}-3-lista-de-la-especialidad.png`) });

    // Recargar reproduce la misma lista: la especialidad vive en la URL.
    const enLista = page.url();
    await page.reload();
    await expect(page.locator('a[href^="/directory/"]').first()).toBeVisible({ timeout: 30_000 });
    expect(page.url()).toBe(enLista);

    // REQ-18-006 · lista → perfil.
    await page.locator('a[href^="/directory/"]').first().click();
    await expect(page).toHaveURL(/\/directory\/[^/?#]+/u);
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 30_000 });
    await page.screenshot({ path: join(SALIDA, `${ancho}-4-perfil.png`) });

    // Y la vuelta a la grilla desde la lista.
    await page.goBack();
    await expect(page.getByTestId('volver-a-especialidades')).toBeVisible({ timeout: 30_000 });
    await page.getByTestId('volver-a-especialidades').click();
    await expect(page.getByTestId('portada-especialidades')).toBeVisible();

    // Desde la grilla, escribir un nombre salta directo a la lista.
    await page.getByRole('textbox', { name: 'Buscar por nombre o especialidad' }).fill('zzzz-nadie');
    await expect(page.getByTestId('portada-especialidades')).toBeHidden({ timeout: 30_000 });
    await expect(page.getByText(/Ningún médico coincide con «zzzz-nadie»/u)).toBeVisible();
    await page.screenshot({ path: join(SALIDA, `${ancho}-5-sin-coincidencias.png`) });

    expect(vigilancia.errores).toEqual([]);
    expect(vigilancia.fallidas).toEqual([]);
  });
}

/** El número de «1–24 de 500 clínicas encontradas» o de «500 centros». */
async function totalEn(page: Page, patron: RegExp): Promise<number> {
  const texto = page.getByText(patron).first();
  await expect(texto).toBeVisible({ timeout: 30_000 });
  return Number((patron.exec(await texto.innerText()) ?? [])[1]);
}

/**
 * REQ-18-003/004 · el directorio de clínicas con sesión usa la misma lógica que
 * la red social: con el mismo corte de categoría encuentra exactamente los
 * mismos centros que `/search/hospitals`, y su ficha no sale del panel.
 */
test('REQ-18-003/004 clínicas con sesión = hospitales de la red social, ficha dentro del panel', async ({
  page,
}) => {
  const vigilancia = vigilar(page);
  await page.setViewportSize({ width: 1440, height: 1000 });

  // Sin sesión: la red social.
  await page.goto('/search/hospitals');
  const totalPublico = await totalEn(page, /^(\d+) centros?/u);
  await page
    .getByTestId('hospitales-chip-categoria')
    .filter({ hasText: 'Hospital público' })
    .click();
  await expect(page).toHaveURL(/[?&]categoria=/u);
  const codigo = new URL(page.url()).searchParams.get('categoria');
  const publicoDeLaCategoria = await totalEn(page, /^(\d+) centros?/u);
  expect(publicoDeLaCategoria).toBeLessThan(totalPublico);
  expect(await page.locator('main a[href^="/o/"]').count()).toBeGreaterThan(0);

  // Con sesión: el mismo corte, el mismo número.
  await entrar(page, PACIENTE);
  await irA(page, '/clinics-directory');
  // «1–24 de 500 clínicas encontradas», o «19 clínicas encontradas» si caben.
  expect(await totalEn(page, /(\d+) clínicas? encontradas?/u)).toBe(totalPublico);
  await irA(page, `/clinics-directory?categoria=${codigo}`);
  expect(await totalEn(page, /(\d+) clínicas? encontradas?/u)).toBe(publicoDeLaCategoria);
  await page.screenshot({ path: join(SALIDA, '1440-6-clinicas-con-sesion.png') });

  // La ficha cuelga del panel, no de la ficha anónima de la red social.
  expect(await page.locator('main a[href^="/o/"]').count()).toBe(0);
  const ficha = page.locator('main a[href^="/clinics-directory/"]').first();
  await ficha.click();
  await expect(page).toHaveURL(/\/clinics-directory\/[^/?#]+/u);

  expect(vigilancia.errores).toEqual([]);
  expect(vigilancia.fallidas).toEqual([]);
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
  for (const ruta of ['/directories', '/directory', '/clinics-directory', '/pharmacies-directory']) {
    await page.goto(ruta);
    await expect(page).toHaveURL(/\/auth/u, { timeout: 30_000 });
  }

  // Paciente: ve la guía de médicos, con la agenda de cada uno.
  await entrar(page, PACIENTE);
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
  await page.screenshot({ path: join(SALIDA, '1440-7-directorios-del-administrador.png') });
});
