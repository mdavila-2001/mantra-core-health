import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

/**
 * El chip de categoría en los cuatro directorios públicos.
 *
 * ## Qué prueba, y por qué así
 *
 * Que la fila de chips **exista y acote**, en el navegador. Las unitarias ya
 * fijan el cálculo —`public-directory-listing.spec.ts`, `public-search.store`,
 * los dos listados de ALOVIDA—; lo que ninguna puede ver es la cadena entera:
 * la semilla declara su categoría, el simulador la sirve en `category`, el
 * cliente la normaliza y la pantalla la dibuja. Si alguno de los cuatro
 * eslabones se corta, el chip desaparece sin que falle una sola unitaria.
 *
 * Se comprueba con nombres concretos —«Farmacorp», «Caja de salud»— y no
 * contando chips: una fila con cuatro botones puede estar llena de etiquetas
 * que no significan nada, y el conteo pasaría.
 *
 * ## Contra qué corre
 *
 * `E2E_BASE_URL`, o `http://localhost:4200`.
 *
 * Uso: `yarn pw --workers=1 categorias-en-directorios`
 */

// `import.meta` no está disponible acá: los specs se cargan como CommonJS.
const CAPTURAS = join(process.cwd(), 'artifacts', 'categorias-directorio');

test.beforeAll(() => {
  mkdirSync(CAPTURAS, { recursive: true });
});

/** Abre una ruta y espera contenido real. Nunca `networkidle`: ver el carril. */
async function abrir(pagina: Page, ruta: string): Promise<void> {
  await pagina.goto(ruta, { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await expect(pagina.locator('main')).toBeVisible({ timeout: 60_000 });
}

/**
 * Abre una pantalla de ALOVIDA y espera a que **haya hidratado**.
 *
 * `main` visible no alcanza en estas dos: el SSR pinta la grilla y los chips
 * antes de que Angular enganche un solo escuchador, así que un click de
 * Playwright llega al botón correcto y no hace nada — la URL no cambia y la
 * prueba falla por un motivo que no es el suyo. `html[data-js="on"]` lo pone
 * `AlovidaRuntimeService` en el arranque del cliente, así que es la señal
 * exacta de que la pantalla ya responde.
 */
async function abrirHidratada(pagina: Page, ruta: string): Promise<void> {
  await abrir(pagina, ruta);
  await expect(pagina.locator('html[data-js="on"]')).toHaveCount(1, { timeout: 60_000 });
}

/**
 * Toca un chip hasta que la URL cambie.
 *
 * ## Por qué reintentar el click y no esperar antes
 *
 * Estas pantallas llegan renderizadas por el servidor: los chips se **ven** y
 * se pueden pulsar mucho antes de que Angular enganche su escuchador. Un click
 * en esa ventana llega al botón correcto y no hace nada, y la prueba falla por
 * un motivo que no es el suyo.
 *
 * Esperar «a que hidrate» no lo resuelve del todo —`html[data-js="on"]` lo pone
 * el arranque del cliente, antes de que el componente concreto esté escuchando—
 * y un `waitForTimeout` fijo sería adivinar. `toPass` reintenta la acción
 * completa hasta que el efecto observable ocurre, que es la forma web-first de
 * esperar a algo que no tiene señal propia.
 */
async function tocarHasta(pagina: Page, chip: Locator, urlEsperada: RegExp): Promise<void> {
  await expect(async () => {
    await chip.click();
    await expect(pagina).toHaveURL(urlEsperada, { timeout: 2_000 });
  }).toPass({ timeout: 60_000 });
}

/**
 * Entra como paciente: los cuatro directorios piden sesión.
 *
 * Sirve cualquier contraseña no vacía — el simulador no valida credenciales.
 */
async function entrarComoPaciente(pagina: Page): Promise<void> {
  await pagina.goto('/auth', { waitUntil: 'domcontentloaded', timeout: 120_000 });
  await pagina.getByTestId('login-identifier').fill('paciente@alovida.mock');
  await pagina.getByTestId('login-password').fill('mockup');
  await pagina.getByTestId('login-submit').click();
  await pagina.waitForURL(/\/(dashboard|auth\/organization)/, { timeout: 60_000 });
  if (pagina.url().includes('/auth/organization')) {
    await pagina.getByTestId('tenant-opcion').first().click();
    await pagina.waitForURL(/\/dashboard/, { timeout: 60_000 });
  }
}

/** Cuántos resultados dice el encabezado del directorio con barra de filtros. */
async function cuantosDice(pagina: Page): Promise<number> {
  const texto = await pagina.locator('main').innerText();
  const encontrados = /(\d+)\s+(?:farmacias|clínicas|centros)\s+encontrad/u.exec(texto);
  return encontrados === null ? -1 : Number(encontrados[1]);
}

test.describe('la categoría acota los directorios de farmacias y clínicas', () => {
  test('farmacias: la cadena es el chip, y elegir una acota la lista', async ({ page }) => {
    await entrarComoPaciente(page);
    await abrir(page, '/pharmacies-directory');

    const barra = page.locator('app-filter-bar');
    await expect(barra.getByText('Categoría', { exact: true })).toBeVisible({ timeout: 60_000 });
    // Las cadenas del corpus, con nombre y apellido.
    await expect(barra.getByRole('button', { name: 'Farmacorp', exact: true })).toBeVisible();
    await expect(
      barra.getByRole('button', { name: 'Farmacia independiente', exact: true }),
    ).toBeVisible();

    const todas = await cuantosDice(page);
    expect(todas).toBeGreaterThan(0);

    await page.screenshot({ path: `${CAPTURAS}/farmacias-chips.png`, fullPage: false });

    await tocarHasta(
      page,
      barra.getByRole('button', { name: 'Farmacias Chávez', exact: true }),
      /categoria=cadena-farmacias-chavez/u,
    );

    const acotadas = await cuantosDice(page);
    expect(acotadas).toBeGreaterThan(0);
    expect(acotadas).toBeLessThan(todas);
    // Y el chip sigue estando: se puede pasar a otra cadena sin limpiar antes.
    await expect(barra.getByRole('button', { name: 'Farmacorp', exact: true })).toBeVisible();

    await page.screenshot({ path: `${CAPTURAS}/farmacias-chavez.png`, fullPage: false });
  });

  test('clínicas: separa clínica privada, hospital público, caja y primer nivel', async ({
    page,
  }) => {
    await entrarComoPaciente(page);
    await abrir(page, '/clinics-directory');

    const barra = page.locator('app-filter-bar');
    await expect(barra.getByText('Categoría', { exact: true })).toBeVisible({ timeout: 60_000 });
    for (const etiqueta of [
      'Clínica privada',
      'Hospital público',
      'Caja de salud',
      'Centro de primer nivel',
    ]) {
      await expect(barra.getByRole('button', { name: etiqueta, exact: true })).toBeVisible();
    }

    const todas = await cuantosDice(page);
    await page.screenshot({ path: `${CAPTURAS}/clinicas-chips.png`, fullPage: false });

    // Una caja de salud no atiende a quien no es su asegurado: es el corte que
    // esta pantalla no ofrecía, y el que más cambia a quién le sirve el
    // resultado.
    await tocarHasta(
      page,
      barra.getByRole('button', { name: 'Caja de salud', exact: true }),
      /categoria=caja-de-salud/u,
    );

    const acotadas = await cuantosDice(page);
    expect(acotadas).toBeGreaterThan(0);
    expect(acotadas).toBeLessThan(todas);

    await page.screenshot({ path: `${CAPTURAS}/clinicas-caja-de-salud.png`, fullPage: false });
  });
});

test.describe('la categoría acota los listados públicos de ALOVIDA', () => {
  test('hospitales y clínicas: los chips están antes del lugar', async ({ page }) => {
    await entrarComoPaciente(page);
    await abrirHidratada(page, '/search/hospitals');

    const chips = page.getByTestId('hospitales-chip-categoria');
    await expect(chips.first()).toBeVisible({ timeout: 60_000 });
    await expect(chips.filter({ hasText: 'Caja de salud' })).toHaveCount(1);

    await page.screenshot({ path: `${CAPTURAS}/hospitales-chips.png`, fullPage: false });

    await tocarHasta(page, chips.filter({ hasText: 'Clínica privada' }), /categoria=clinica-privada/u);
    await expect(page.locator('.centros__grilla > li').first()).toBeVisible({ timeout: 60_000 });

    await page.screenshot({ path: `${CAPTURAS}/hospitales-privadas.png`, fullPage: false });
  });

  test('aseguradoras: el ramo separa las que cubren salud', async ({ page }) => {
    await entrarComoPaciente(page);
    await abrirHidratada(page, '/search/insurers');

    const chips = page.getByTestId('aseguradoras-chip-categoria');
    await expect(chips.first()).toBeVisible({ timeout: 60_000 });
    await expect(chips.filter({ hasText: 'Seguro de salud' })).toHaveCount(1);
    await expect(chips.filter({ hasText: 'Seguros generales y fianzas' })).toHaveCount(1);

    await page.screenshot({ path: `${CAPTURAS}/aseguradoras-chips.png`, fullPage: false });

    await tocarHasta(page, chips.filter({ hasText: 'Seguro de salud' }), /categoria=seguro-de-salud/u);
    await expect(page.locator('.centros__grilla > li').first()).toBeVisible({ timeout: 60_000 });

    await page.screenshot({ path: `${CAPTURAS}/aseguradoras-salud.png`, fullPage: false });
  });
});
